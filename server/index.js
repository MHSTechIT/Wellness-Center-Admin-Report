import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { q } from './db.js';
import {
  buildPeriodQuery, buildPeriodCallsQuery, buildPersonQuery, buildClientQuery, buildClientCountQuery, buildFilterOptionsQueries,
} from './queries.js';
import {
  authenticate, signToken, verifyToken,
  cookieOptions, SESSION_COOKIE, requireAuth,
} from './auth.js';
import { callKw as odooCall, fetchWalkinDashboard, fetchBucketsDashboard } from './odoo.js';

/* ─── Period bucket generator — aligns to calendar boundaries the same way our SQL did ─── */
const ymd = (d) => d.toISOString().slice(0, 10);

/* ─── Normalize a from/to query value into a Postgres timestamp string ───
 * Accepts:
 *   - "YYYY-MM-DD"                       (date only — picker default)
 *   - "YYYY-MM-DDTHH:MM" / "...:SS"      (date + time, from <input type="datetime-local">
 *                                         or our custom date + time-input pair)
 *   - "YYYY-MM-DD HH:MM[:SS]"            (already space-separated; passed through)
 * Output is always "YYYY-MM-DD HH:MM:SS" (an IST wall-clock timestamp; comparisons in
 * SQL are against IST_CREATE which is also IST wall-clock, so no AT TIME ZONE needed).
 *   - For "start": date-only expands to 00:00:00 (start of the from-day).
 *   - For "end":   date-only expands to next-day 00:00:00 and is used with `<`
 *                  (preserves the existing "include whole to-day" behavior).
 * Returns null for missing / unparseable input so the SQL filter is skipped cleanly. */
function tsFor(value, kind /* 'start' | 'end' */) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  // Date only
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    if (kind === 'end') {
      // Next-day midnight, used with `<` for an exclusive upper bound.
      const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      d.setUTCDate(d.getUTCDate() + 1);
      return `${ymd(d)} 00:00:00`;
    }
    return `${s} 00:00:00`;
  }
  // Date + time (T-separator, optional seconds)
  m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (m) return `${m[1]} ${m[2]}:${m[3]}:${m[4] || '00'}`;
  // Unknown — skip the filter instead of injecting a bad value into SQL.
  return null;
}

/* ─── Default date window for a (period, view) pair, when no custom from/to is given ───
 * Period (trend) view: a rolling history window so the table shows a multi-bucket trend
 *   (daily = last 30 days, weekly = 12 weeks, monthly = 12 months, yearly = 5 years).
 * Person / Client views: the period IS the reporting window, aligned to the current
 *   IST calendar (daily = today, weekly = this week from Monday, monthly = this month,
 *   yearly = this year). Boundaries match the SQL's date_trunc(... AT TIME ZONE 'Asia/Kolkata').
 */
function defaultRange(period, view, now = new Date()) {
  // "Today" in Asia/Kolkata, as a UTC-midnight Date for safe day arithmetic.
  const istYmd = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // "YYYY-MM-DD"
  const today = new Date(istYmd + 'T00:00:00Z');

  if (view === 'person' || view === 'client') {
    const from = new Date(today);
    if (period === 'weekly') {
      const dow = today.getUTCDay();              // 0=Sun..6=Sat
      from.setUTCDate(today.getUTCDate() - ((dow + 6) % 7)); // back to Monday (ISO week)
    } else if (period === 'monthly') {
      from.setUTCDate(1);
    } else if (period === 'yearly') {
      from.setUTCMonth(0, 1);
    }
    // daily (and custom fallback): from === today
    return { from: ymd(from), to: istYmd };
  }

  // Period (trend) view — rolling history window ending today.
  const days = { daily: 30, weekly: 84, monthly: 365, yearly: 365 * 5, custom: 30 }[period] || 30;
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - days);
  return { from: ymd(from), to: istYmd };
}
function periodBuckets(period, fromStr, toStr) {
  const buckets = [];
  // fromStr/toStr may be a plain date ("YYYY-MM-DD") or a datetime
  // ("YYYY-MM-DDTHH:MM[:SS]" / "YYYY-MM-DD HH:MM[:SS]") when the user picks
  // a time-precise custom range. Buckets are aligned to whole IST calendar
  // days regardless, so strip everything past the date.
  const start = new Date(String(fromStr).slice(0, 10) + 'T00:00:00Z');
  const end   = new Date(String(toStr  ).slice(0, 10) + 'T00:00:00Z');
  const cap   = { daily: 31, weekly: 13, monthly: 12, yearly: 5, custom: 31 }[period] || 31;

  if (period === 'monthly') {
    let cur = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
    while (buckets.length < cap && cur >= start) {
      const monthEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0));
      const realEnd  = monthEnd > end ? end : monthEnd;
      buckets.push({
        from_date: ymd(cur), to_date: ymd(realEnd),
        label: cur.toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
        bucket: ymd(cur),
      });
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() - 1, 1));
    }
  } else if (period === 'weekly') {
    // Monday-aligned weeks
    let cur = new Date(end);
    const dow = cur.getUTCDay() || 7;
    cur.setUTCDate(cur.getUTCDate() - dow + 1);  // back to Monday
    while (buckets.length < cap && cur >= start) {
      const weekEnd = new Date(cur); weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const realEnd = weekEnd > end ? end : weekEnd;
      const f = (x) => x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
      buckets.push({
        from_date: ymd(cur), to_date: ymd(realEnd),
        label: `Wk ${f(cur)} – ${f(realEnd)}`,
        bucket: ymd(cur),
      });
      cur.setUTCDate(cur.getUTCDate() - 7);
    }
  } else if (period === 'yearly') {
    let cur = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
    while (buckets.length < cap && cur >= start) {
      const yEnd = new Date(Date.UTC(cur.getUTCFullYear(), 11, 31));
      const realEnd = yEnd > end ? end : yEnd;
      buckets.push({
        from_date: ymd(cur), to_date: ymd(realEnd),
        label: String(cur.getUTCFullYear()),
        bucket: ymd(cur),
      });
      cur = new Date(Date.UTC(cur.getUTCFullYear() - 1, 0, 1));
    }
  } else {
    // daily / custom — one day per bucket
    let cur = new Date(end);
    while (buckets.length < cap && cur >= start) {
      buckets.push({
        from_date: ymd(cur), to_date: ymd(cur),
        label: cur.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', timeZone: 'UTC' }),
        bucket: ymd(cur),
      });
      cur.setUTCDate(cur.getUTCDate() - 1);
    }
  }
  return buckets;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Behind an HTTPS reverse proxy (Caddy/nginx) so req.protocol reflects the
// real scheme → the session cookie's `Secure` flag is set correctly.
app.set('trust proxy', 1);

app.use(express.json());
app.use(cookieParser());

/* ── tiny rate limiter for /api/login (in-memory, per-IP) ── */
const loginAttempts = new Map();
function rateLimitLogin(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const entry = loginAttempts.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60_000; }
  if (entry.count >= 8) return res.status(429).json({ error: 'too_many_attempts' });
  entry.count++;
  loginAttempts.set(ip, entry);
  next();
}

/* ── /api/login ── */
app.post('/api/login', rateLimitLogin, async (req, res) => {
  try {
    const { login, password } = req.body || {};
    const user = await authenticate(login, password);
    if (!user) return res.status(401).json({ error: 'invalid_credentials' });
    const token = signToken(user);
    res.cookie(SESSION_COOKIE, token, cookieOptions(req));
    res.json({ user });
  } catch (e) {
    console.error('[/api/login]', e);
    res.status(500).json({ error: 'server_error' });
  }
});

/* ── /api/logout ── */
app.post('/api/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

/* ── /api/me — current user from cookie ── */
app.get('/api/me', (req, res) => {
  const tok = req.cookies?.[SESSION_COOKIE];
  const claims = tok ? verifyToken(tok) : null;
  if (!claims) return res.status(401).json({ error: 'auth_required' });
  res.json({ user: { id: claims.sub, login: claims.login, name: claims.name, isHc: claims.isHc } });
});

/* ── derived metrics injected server-side so frontend doesn't double-compute ── */
function withDerived(row) {
  const n = (k) => Number(row[k] || 0);
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const appT = n('apptD') + n('apptZ');
  const callTot = n('fu') + n('cb') + n('lb') + n('rnr') + n('dnd') +
                  n('so') + n('oos') + n('wn') + n('open') + n('blank') + n('ni');
  row.apptTot = appT;
  row.callTot = callTot;
  row.m_l2a = pct(appT, n('leads'));
  row.m_a2v = pct(n('vis'), appT);
  row.m_v2e = pct(n('enr'), n('vis'));
  row.m_v2fp = pct(n('fp'), n('vis'));
  row.m_v2fppp = pct(n('fp') + n('pp'), n('vis'));
  row.m_l2v = pct(n('vis'), n('leads'));
  row.m_l2c = pct(n('enr'), n('leads'));
  row.m_chen = pct(n('enr'), n('loc_chennai'));
  return row;
}

/* ── /api/report ── */
app.get('/api/report', requireAuth, async (req, res) => {
  try {
    const view   = req.query.view   || 'period';
    const period = req.query.period || 'daily';

    if (!req.query.from || !req.query.to) {
      // View-aware default window. Period (trend) view = rolling history so the
      // table shows multiple buckets; Person/Client views = the current calendar
      // period (Daily = today, Weekly = this week, Monthly = this month, ...).
      const range = defaultRange(period, view);
      req.query.from = req.query.from || range.from;
      req.query.to   = req.query.to   || range.to;
    }

    // SQL filters take normalized timestamps (date-only is expanded to start/next-day
    // midnight; date+time keeps the picked minute). The response still echoes the
    // original user-supplied from/to so the UI status line shows what was picked.
    const fromTs = tsFor(req.query.from, 'start');
    const toTs   = tsFor(req.query.to,   'end');

    const filters = {
      from: fromTs, to: toTs,
      team_id: req.query.team_id, user_id: req.query.user_id, hc_id: req.query.hc_id,
      batch: req.query.batch, source_id: req.query.source_id, program: req.query.program,
      payment: req.query.payment,
      search: req.query.search, limit: req.query.limit,
    };

    // Is any non-date, non-batch filter active? (ERP only honors batch server-side.)
    const hasSqlOnlyFilter = !!(filters.team_id || filters.user_id || filters.hc_id ||
                                filters.source_id || filters.program || filters.search);

    // Default-zero row so buckets/persons with no leads still render every column.
    const ZERO_ROW = {
      fu:0, cb:0, lb:0, rnr:0, dnd:0, so:0, oos:0, wn:0, open:0, ni:0, nosugar:0, oth:0, callTot:0,
      apptD:0, apptZ:0, apptTot:0, conf:0, vis:0,
      sugarHi:0, sugarMid:0, sugarNo:0,
      consWJ:0, consTW:0, consNW:0, consTM:0, consQD:0, recDone:0,
      progL1:0, progL2:0, progBoth:0,
      enr:0, fp:0, pp:0, inst:0, emi:0, adv:0, payFU:0, payNI:0, alrPaid:0, kitGiven:0,
      rev:0, spent:0, roasAll:0, roasFPPP:0, roasEnr:0, instCnt:0, roasInst:0,
      l1tot:0, l2tot:0, l1fp:0, l1pp:0, l2fp:0, l2pp:0,
      m_l2a:0, m_a2v:0, m_v2e:0, m_v2fp:0, m_v2fppp:0, m_l2v:0, m_l2c:0, m_chen:0,
      chen:0, selfAudit:0, bdmScore:0,
      fbCall:0, fuSched:0, payCol:0, svcIssue:0,
      loc_chennai:0, loc_outer:0, loc_other:0,
      totalCalls:0, uniqueCalls:0, connCalls:0, notConnCalls:0, inCalls:0, outCalls:0, totalDurMin:0, avgDurMin:0,
      newPipeline:0, leadsCalled:0, apptAction:0, visitedAction:0, confirmedAction:0,
      refundReq:0, refundDone:0,
    };

    let rows;
    let erpSummary = null;
    let fullCount = null;   // Client view: true (uncapped) match count

    if (view === 'period') {
      /* DB-AUTHORITATIVE. Every displayed number comes from the database so the table,
       * cards and page totals always reconcile to the DB.
       *  - Lead metrics come from buildPeriodQuery (one consistent source per row).
       *  - Telephony comes from buildPeriodCallsQuery, merged per-bucket so calls on
       *    days with no leads are NOT dropped (they were silently lost before).
       *  - ERP "gap-fill" (live Odoo numbers for days missing from the replica) is now
       *    OPT-IN via ?gapfill=1. It is OFF by default because it injects numbers that do
       *    not exist in the DB and cannot be reconciled. */
      const allowGapfill = req.query.gapfill === '1' && !hasSqlOnlyFilter;

      const sql = buildPeriodQuery(period, filters);
      const callsQ = buildPeriodCallsQuery(period, filters);
      const [sqlRes, callsRes] = await Promise.all([
        q(sql.text, sql.params),
        q(callsQ.text, callsQ.params),
      ]);
      const sqlByBucket = Object.fromEntries(sqlRes.rows.map((r) => [r.bucket, r]));
      const callsByBucket = Object.fromEntries(callsRes.rows.map((r) => [r.bucket, r]));
      const buckets = periodBuckets(period, req.query.from, req.query.to);

      // Merge complete telephony into a row (used for every bucket, lead or not).
      const applyCalls = (row, bucket) => {
        const c = callsByBucket[bucket] || {};
        const tc = Number(c.tc || 0), cc = Number(c.cc || 0), dur = Number(c.dur_sec || 0);
        row.totalCalls   = tc;
        row.uniqueCalls  = Number(c.uc || 0);
        row.connCalls    = cc;
        row.notConnCalls = Math.max(tc - cc, 0);
        row.inCalls      = Number(c.ic || 0);
        row.outCalls     = Number(c.oc || 0);
        row.totalDurMin  = dur ? Math.round((dur / 60) * 10) / 10 : 0;
        row.avgDurMin    = cc > 0 ? Math.round((dur / 60 / cc) * 100) / 100 : 0;
        return row;
      };

      let erpByBucket = {};
      if (allowGapfill) {
        try {
          const erpResponses = await fetchBucketsDashboard(buckets, {
            ...(filters.batch ? { batch: filters.batch } : {}),
          });
          erpByBucket = Object.fromEntries(buckets.map((b, i) => [b.bucket, erpResponses[i]]));
        } catch (e) {
          console.warn('[period view] ERP gap-fill fetch failed (DB still authoritative):', e.message);
        }
      }

      rows = buckets.map((b) => {
        const sqlRow = sqlByBucket[b.bucket];
        if (sqlRow && Number(sqlRow.leads || 0) > 0) {
          const out = applyCalls(withDerived({ ...ZERO_ROW, ...sqlRow }), b.bucket);
          out.period = b.label;
          out.bucket = b.bucket;
          out._source = 'db';
          return out;
        }
        // No leads in DB for this bucket. Default = honest zero row (with real calls).
        // Optional ERP gap-fill only when explicitly requested (?gapfill=1).
        const base = applyCalls(withDerived({ ...ZERO_ROW, ...(sqlRow || {}) }), b.bucket);
        const erp = erpByBucket[b.bucket] || {};
        const erpLeads = Number(erp.total_walkin_leads || 0);
        if (allowGapfill && erpLeads > 0) {
          base.leads   = erpLeads;
          base.apptTot = Number(erp.appointments_fixed || 0);
          base.vis     = Number(erp.visits_completed || 0);
          base.progL1  = Number(erp.l1_enrolled || 0);
          base.progL2  = Number(erp.l2_enrolled || 0);
          base.l1tot   = Number(erp.l1_enrolled || 0);
          base.l2tot   = Number(erp.l2_enrolled || 0);
          base.enr     = Number((erp.l1_enrolled || 0) + (erp.l2_enrolled || 0));
          base.rev     = Number(erp.total_revenue || 0);
          base._source = 'erp-gapfill';
        } else {
          base._source = 'db';
        }
        base.period = b.label;
        base.bucket = b.bucket;
        return base;
      });
    } else if (view === 'person') {
      /* PRIORITY 1 = SQL. Person view is built from buildPersonQuery (respects
       * ALL filters + computes the rich per-user metrics). ERP proxy is the
       * fallback ONLY if the SQL path throws (e.g. a telephony table missing). */
      try {
        const sql = buildPersonQuery({ ...filters, from: req.query.from, to: req.query.to });
        const pRows = (await q(sql.text, sql.params)).rows;
        rows = pRows.map((r) => {
          const out = withDerived({ ...ZERO_ROW, ...r });
          out.person_id = r.person_id;
          out.is_hc = r.is_hc;
          out.period = (r.is_hc ? '🩺 ' : '') + (r.person_name || '—');
          return out;
        });
      } catch (e) {
        console.warn('[person view] SQL path failed, falling back to ERP proxy:', e.message);
        let erp;
        try {
          erp = await fetchWalkinDashboard(req.query.from, req.query.to, {
            ...(filters.batch ? { batch: filters.batch } : {}),
          });
        } catch (e2) {
          console.error('[person view] ERP fallback also failed:', e2.message);
          return res.status(502).json({ error: 'person_view_unavailable', detail: e2.message });
        }
        const pickUserId = Number(filters.user_id || filters.hc_id) || null;
        if (pickUserId) {
          const pc = (erp.caller_table || []).find((c) => c.id === pickUserId);
          const ph = (erp.coach_table  || []).find((c) => c.id === pickUserId);
          erp.caller_table = pc ? [pc] : [];
          erp.coach_table  = ph ? [ph] : [];
        }
        const callerRows = (erp.caller_table || []).map((c) => withDerived({
          ...ZERO_ROW,
          period: c.name, person_id: c.id, is_hc: false,
          leads: c.new_leads || 0, newPipeline: c.new_leads || 0,
          totalCalls: c.total_calls || 0, uniqueCalls: c.total_unique_calls || 0,
          connCalls: c.connected_calls || 0, notConnCalls: c.not_connected_calls || 0,
          totalDurMin: Number(c.total_duration_min || 0), avgDurMin: Number(c.avg_duration_min || 0),
          apptD: c.appointments_fixed || 0, apptTot: c.appointments_fixed || 0,
          apptAction: c.appointments_fixed || 0, vis: c.visits_completed || 0,
          visitedAction: c.visits_completed || 0, fu: c.pending_followups || 0,
        }));
        const coachRows = (erp.coach_table || []).map((c) => withDerived({
          ...ZERO_ROW,
          period: '🩺 ' + c.name, person_id: c.id, is_hc: true,
          progL1: c.l1_enrolled || 0, progL2: c.l2_enrolled || 0,
          hafDone: c.health_assessments || 0,
          enr: (c.l1_enrolled || 0) + (c.l2_enrolled || 0),
          fp: c.payments_recorded || 0, fu: c.pending_followups || 0,
        }));
        rows = [...callerRows, ...coachRows];
      }
    } else {
      // Per-lead call-status → disposition column (mirrors the Period view's STATUS_COLS),
      // so the Client view's CALL STATUS columns are populated per row instead of all blank.
      const CS_COL = {
        follow_up: 'fu', call_back: 'cb', line_busy: 'lb', rnr: 'rnr', dnd: 'dnd',
        switched_off: 'so', out_of_service: 'oos', wrong_number: 'wn', new: 'open',
        not_interested: 'ni',
      };
      const CS_KNOWN = new Set([
        ...Object.keys(CS_COL), 'no_sugar', 'already_paid',
        'appointment_fixed_direct', 'appointment_fixed_zoom', 'visited',
      ]);
      const sql = buildClientQuery(filters);
      const cnt = buildClientCountQuery(filters);
      const [clientRes, cntRes] = await Promise.all([q(sql.text, sql.params), q(cnt.text, cnt.params)]);
      fullCount = Number(cntRes.rows[0]?.n || 0);
      rows = clientRes.rows.map((r) => {
        const cs = r.walkin_call_status;
        const dispo = {};
        if (CS_COL[cs]) dispo[CS_COL[cs]] = 1;
        if (cs === 'no_sugar' || r.sugar_level === 'no_sugar') dispo.nosugar = 1;
        if (cs === 'already_paid') dispo.alrPaid = 1;
        if (cs && !CS_KNOWN.has(cs)) dispo.oth = 1;
        return withDerived({
        ...ZERO_ROW,
        period: r.name || '—',
        leads: 1,
        ...dispo,
        apptD: r.walkin_call_status === 'appointment_fixed_direct' ? 1 : 0,
        apptZ: r.walkin_call_status === 'appointment_fixed_zoom'   ? 1 : 0,
        conf: r.walkin_appt_confirm_status === 'confirmed' ? 1 : 0,
        vis: (r.walkin_call_status === 'visited' || r.visited_date) ? 1 : 0,
        enr: ['partial', 'paid_full', 'l2_installment', 'l2_emi'].includes(r.payment_status_summary) ? 1 : 0,
        fp: r.payment_status_summary === 'paid_full' ? 1 : 0,
        pp: r.payment_status_summary === 'partial' ? 1 : 0,
        inst: r.is_inst ? 1 : 0,
        rev: Number(r.revenue || 0),
        sugarHi: r.sugar_level === 'above_250_sugar_level' ? 1 : 0,
        sugarMid: r.sugar_level === '150-250_sugar_level' ? 1 : 0,
        sugarNo: r.sugar_level === 'no_sugar' ? 1 : 0,
        hafDone: r.haf_status === 'done' ? 1 : 0,
        progL1: r.l1_access_date && !r.l2_access_date ? 1 : 0,
        progL2: r.l2_access_date && !r.l1_access_date ? 1 : 0,
        progBoth: r.l1_access_date && r.l2_access_date ? 1 : 0,
        // LOCATION classification per lead (same buckets as Period/Person views).
        loc_chennai: r.is_chennai ? 1 : 0,
        loc_outer: (!r.is_chennai && r.is_outer) ? 1 : 0,
        loc_other: (!r.is_chennai && !r.is_outer && r.has_loc) ? 1 : 0,
        batch: r.batch_code_full || '—',
        src: r.source || '—',
        // Team Location = the lead's city, consistent with Period/Person views (was the team name).
        loc: (r.city && String(r.city).trim()) || '—',
        doi: r.create_date ? new Date(r.create_date).toLocaleDateString('en-IN') : '—',
        salesperson: r.salesperson,
        phone: r.phone,
        });
      });
    }

    res.json({ view, period, from: req.query.from, to: req.query.to, count: rows.length, fullCount, rows, summary: erpSummary });
  } catch (err) {
    console.error('[/api/report]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── /api/filters/options (cascade-aware) ── */
app.get('/api/filters/options', requireAuth, async (req, res) => {
  try {
    const filters = {
      batch:     req.query.batch || '',
      team_id:   req.query.team_id || '',
      user_id:   req.query.user_id || '',
      hc_id:     req.query.hc_id || '',
      source_id: req.query.source_id || '',
      program:   req.query.program || '',
    };
    const Q = buildFilterOptionsQueries(filters);
    const [teams, sps, hcs, srcs, batches] = await Promise.all([
      q(Q.teams.text,        Q.teams.params),
      q(Q.salespersons.text, Q.salespersons.params),
      q(Q.healthCoaches.text,Q.healthCoaches.params),
      q(Q.sources.text,      Q.sources.params),
      q(Q.batches.text,      Q.batches.params),
    ]);
    res.json({
      teams: teams.rows, salespersons: sps.rows, healthCoaches: hcs.rows,
      sources: srcs.rows, batches: batches.rows,
    });
  } catch (err) {
    console.error('[/api/filters/options]', err);
    res.status(500).json({ error: err.message });
  }
});

/* ── /api/walkin/dashboard — proxies Odoo's walkin.team.dashboard.get_dashboard_data ── */
app.get('/api/walkin/dashboard', requireAuth, async (req, res) => {
  try {
    const kwargs = {};
    if (req.query.from_date) kwargs.from_date = String(req.query.from_date);
    if (req.query.to_date)   kwargs.to_date   = String(req.query.to_date);
    if (req.query.user_id)   kwargs.user_id   = Number(req.query.user_id);
    if (req.query.batch)     kwargs.batch     = String(req.query.batch);

    const t0 = Date.now();
    const data = await odooCall('walkin.team.dashboard', 'get_dashboard_data', [], kwargs);
    res.json({
      ...data,
      _meta: { fetchedAt: new Date().toISOString(), durationMs: Date.now() - t0, source: 'odoo' },
    });
  } catch (e) {
    console.error('[/api/walkin/dashboard]', e.message);
    res.status(502).json({ error: 'odoo_proxy_error', detail: e.message });
  }
});

/* ── /api/health (auth-gated — was leaking lead_count unauthenticated) ── */
app.get('/api/health', requireAuth, async (_req, res) => {
  try {
    const r = await q('SELECT NOW() AS server_time, count(*)::bigint AS lead_count FROM crm_lead');
    res.json({ ok: true, ...r.rows[0] });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

/* ── static frontend ── */
app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(PORT, () => {
  console.log(`MHS dashboard up at http://localhost:${PORT}`);
});
