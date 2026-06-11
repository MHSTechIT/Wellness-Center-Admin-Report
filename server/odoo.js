/**
 * Odoo JSON-RPC client.
 * Maintains a single shared session (re-authenticates if the cookie expires).
 */

const URL_BASE = (process.env.ODOO_URL || '').replace(/\/+$/, '');
const DB       = process.env.ODOO_DB;
const LOGIN    = process.env.ODOO_SERVICE_LOGIN;
const PASSWORD = process.env.ODOO_SERVICE_PASSWORD;

let cookieJar = '';
let uid = null;
let lastAuthAt = 0;
const SESSION_TTL_MS = 30 * 60 * 1000; // re-auth every 30 min

function extractCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  if (!raw.length) return;
  cookieJar = raw.map(c => c.split(';')[0]).join('; ');
}

async function rawRpc(path, params) {
  if (!URL_BASE) throw new Error('ODOO_URL is not set');
  const r = await fetch(URL_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieJar },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: params || {} }),
  });
  extractCookies(r);
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`Odoo returned non-JSON (HTTP ${r.status}): ${text.slice(0, 200)}`); }
  if (json.error) {
    const msg = json.error.data?.message || json.error.message || 'odoo_error';
    const err = new Error(msg);
    err.odooError = json.error;
    throw err;
  }
  return json.result;
}

async function authenticate() {
  if (!LOGIN || !PASSWORD || !DB) throw new Error('Odoo service credentials not configured');
  const result = await rawRpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });
  if (!result?.uid) throw new Error('Odoo auth failed (no uid returned)');
  uid = result.uid;
  lastAuthAt = Date.now();
  return uid;
}

async function ensureSession() {
  if (!uid || Date.now() - lastAuthAt > SESSION_TTL_MS) {
    await authenticate();
  }
}

/**
 * Call any Odoo model method via /web/dataset/call_kw.
 * Retries once after re-auth if the session expired.
 */
export async function callKw(model, method, args = [], kwargs = {}) {
  await ensureSession();
  try {
    return await rawRpc('/web/dataset/call_kw', { model, method, args, kwargs });
  } catch (e) {
    // common session-expired signal: SessionExpiredException or unauthenticated user redirect
    if (/Session expired|SessionExpired|odoo\.exceptions\.AccessDenied|UserError.*not logged in/i.test(e.message || '')) {
      uid = null;
      await ensureSession();
      return await rawRpc('/web/dataset/call_kw', { model, method, args, kwargs });
    }
    throw e;
  }
}

export const odooConfig = { URL_BASE, DB, LOGIN_SET: !!LOGIN };

/* ─────────────── In-memory cache for dashboard responses ─────────────── */
const CACHE_TTL_MS = 60_000;
const cache = new Map();
const _cacheKey = (kw) => JSON.stringify(kw);

export async function cachedDashboard(kwargs) {
  const k = _cacheKey(kwargs);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  const value = await callKw('walkin.team.dashboard', 'get_dashboard_data', [], kwargs);
  cache.set(k, { at: Date.now(), value });
  if (cache.size > 300) {
    const old = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 80);
    old.forEach(([k]) => cache.delete(k));
  }
  return value;
}

/* ─────────────── Concurrency-limited parallel mapper ─────────────── */
export async function parallelMap(items, fn, concurrency = 6) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await fn(items[idx], idx);
      }
    })
  );
  return results;
}

/* ─────────────── Per-bucket ERP dashboard fetch ───────────────
 * For Period view: each row is a date bucket. We call the ERP method
 * for each bucket in parallel so each row's leads/appt/visits/L1/L2/revenue
 * match the ERP exactly.
 */
export async function fetchBucketsDashboard(buckets, extraKwargs = {}) {
  const erpKwargs = { ...extraKwargs };
  if (erpKwargs.batch) { erpKwargs.batch_code = erpKwargs.batch; delete erpKwargs.batch; }
  delete erpKwargs.user_id; delete erpKwargs.hc_id;
  return await parallelMap(
    buckets,
    (b) => cachedDashboard({ from_date: b.from_date, to_date: b.to_date, ...erpKwargs }),
    6
  );
}

/* ─────────────── chunked dashboard fetch ───────────────
 * The ERP's walkin.team.dashboard.get_dashboard_data has an internal 30-day
 * hard-cap for lead-based KPIs. To support longer ranges (Weekly/Monthly/
 * Yearly) we split the window into 30-day chunks, fetch in parallel, then
 * aggregate.
 */
const CHUNK_DAYS = 30;
const ymd = (d) => d.toISOString().slice(0, 10);

function buildChunks(fromStr, toStr) {
  const out = [];
  let cur = new Date(fromStr + 'T00:00:00Z');
  const end = new Date(toStr   + 'T00:00:00Z');
  while (cur <= end) {
    const chunkEnd = new Date(cur);
    chunkEnd.setUTCDate(chunkEnd.getUTCDate() + CHUNK_DAYS - 1);
    if (chunkEnd > end) chunkEnd.setTime(end.getTime());
    out.push({ from_date: ymd(cur), to_date: ymd(chunkEnd) });
    cur = new Date(chunkEnd);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

function mergeCallerRows(chunks) {
  const byId = new Map();
  for (const ct of chunks) {
    for (const row of (ct.caller_table || [])) {
      const cur = byId.get(row.id) || {
        id: row.id, name: row.name,
        total_calls: 0, total_unique_calls: 0,
        connected_calls: 0, not_connected_calls: 0,
        total_duration_min: 0, avg_duration_min: 0,
        appointments_fixed: 0, visits_completed: 0,
        pending_followups: 0, new_leads: 0,
      };
      cur.total_calls         += Number(row.total_calls || 0);
      cur.total_unique_calls  += Number(row.total_unique_calls || 0);
      cur.connected_calls     += Number(row.connected_calls || 0);
      cur.not_connected_calls += Number(row.not_connected_calls || 0);
      cur.total_duration_min  += Number(row.total_duration_min || 0);
      cur.appointments_fixed  += Number(row.appointments_fixed || 0);
      cur.visits_completed    += Number(row.visits_completed || 0);
      cur.pending_followups   += Number(row.pending_followups || 0);
      cur.new_leads           += Number(row.new_leads || 0);
      byId.set(row.id, cur);
    }
  }
  // recompute weighted avg_duration_min = total_duration / connected
  for (const c of byId.values()) {
    c.total_duration_min = Math.round(c.total_duration_min * 100) / 100;
    c.avg_duration_min = c.connected_calls > 0
      ? Math.round((c.total_duration_min / c.connected_calls) * 100) / 100
      : 0;
  }
  return [...byId.values()].sort((a, b) => b.total_calls - a.total_calls);
}

function mergeCoachRows(chunks) {
  const byId = new Map();
  for (const ct of chunks) {
    for (const row of (ct.coach_table || [])) {
      const cur = byId.get(row.id) || {
        id: row.id, name: row.name,
        health_assessments: 0, l1_enrolled: 0, l2_enrolled: 0,
        payments_recorded: 0, pending_followups: 0,
      };
      cur.health_assessments += Number(row.health_assessments || 0);
      cur.l1_enrolled        += Number(row.l1_enrolled || 0);
      cur.l2_enrolled        += Number(row.l2_enrolled || 0);
      cur.payments_recorded  += Number(row.payments_recorded || 0);
      cur.pending_followups  += Number(row.pending_followups || 0);
      byId.set(row.id, cur);
    }
  }
  return [...byId.values()];
}

/**
 * Returns the same shape as a single get_dashboard_data call, but covering
 * the full from_date → to_date span by aggregating 30-day chunks.
 *
 * Filter params the ERP accepts at the server side:
 *   - batch_code: STRING (verified — filters lead counts)
 * Filter params the ERP IGNORES (must be handled by us client-side):
 *   - user_id, hc_id, source_id, program
 * We translate `batch` → `batch_code` here. The caller can apply user/HC filtering
 * downstream by trimming the caller_table / coach_table rows we return.
 */
export async function fetchWalkinDashboard(from_date, to_date, extraKwargs = {}) {
  const erpKwargs = { ...extraKwargs };
  // Translate our internal key → ERP's actual accepted parameter name
  if (erpKwargs.batch) { erpKwargs.batch_code = erpKwargs.batch; delete erpKwargs.batch; }
  // Drop kwargs the ERP doesn't accept (otherwise no harm but cleaner)
  delete erpKwargs.user_id; delete erpKwargs.hc_id;

  const windows = buildChunks(from_date, to_date);
  const responses = await Promise.all(
    windows.map((w) =>
      callKw('walkin.team.dashboard', 'get_dashboard_data', [], { ...w, ...erpKwargs })
    )
  );

  // Aggregate scalar fields by sum (booleans/strings = take first non-null)
  const sumKeys = [
    'total_walkin_leads', 'appointments_fixed', 'visits_completed',
    'assessments_completed', 'l1_enrolled', 'l2_enrolled',
    'total_revenue', 'overall_total_calls', 'overall_call_duration',
  ];
  const agg = { from_date, to_date };
  for (const k of sumKeys) {
    agg[k] = responses.reduce((s, r) => s + Number(r?.[k] || 0), 0);
  }
  // round duration to 2 decimal
  agg.overall_call_duration = Math.round(agg.overall_call_duration * 100) / 100;
  agg.total_revenue = Math.round(agg.total_revenue);

  // recompute conversion %
  agg.appointment_conversion_pct =
    agg.total_walkin_leads > 0
      ? Math.round((agg.appointments_fixed / agg.total_walkin_leads) * 10000) / 100
      : 0;
  agg.visit_conversion_pct =
    agg.appointments_fixed > 0
      ? Math.round((agg.visits_completed / agg.appointments_fixed) * 10000) / 100
      : 0;
  agg.enrollment_conversion_pct =
    agg.visits_completed > 0
      ? Math.round(((agg.l1_enrolled + agg.l2_enrolled) / agg.visits_completed) * 10000) / 100
      : 0;

  // merge per-user tables
  agg.caller_table = mergeCallerRows(responses);
  agg.coach_table  = mergeCoachRows(responses);

  // pass through metadata from the first chunk
  agg.users      = responses[0]?.users || [];
  agg.batch_data = responses[0]?.batch_data || [];
  agg.status     = responses[0]?.status || [];

  agg._chunked = { chunks: windows.length };
  return agg;
}
