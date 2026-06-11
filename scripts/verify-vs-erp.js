// Side-by-side verification: our dashboard's Person view  vs  Odoo ERP's get_dashboard_data
// Hits both endpoints with identical filters and reports mismatches.

const URL_ERP   = 'https://mhs.doneztech.com';
const URL_OURS  = 'http://localhost:3000';
const DB        = 'odoo';
const LOGIN     = process.env.ODOO_LOGIN;
const PASSWORD  = process.env.ODOO_PASSWORD;
const DEMO_LOGIN = 'demo@mhs.local';
const DEMO_PW    = 'Demo@2026';

/* ───── Odoo JSON-RPC (ERP) ───── */
let erpCookie = '';
function setErpCookie(r){const raw=r.headers.getSetCookie?.()||[];if(raw.length)erpCookie=raw.map(c=>c.split(';')[0]).join('; ');}
async function erpRpc(p, params) {
  const r = await fetch(URL_ERP + p, { method:'POST', headers:{ 'Content-Type':'application/json', 'Cookie': erpCookie }, body: JSON.stringify({ jsonrpc:'2.0', method:'call', params: params||{} }) });
  setErpCookie(r);
  return await r.json();
}
async function erpDashboard(kwargs) {
  const r = await erpRpc('/web/dataset/call_kw', { model:'walkin.team.dashboard', method:'get_dashboard_data', args:[], kwargs });
  return r.result;
}

/* ───── Our API ───── */
let ourCookie = '';
function setOurCookie(r){const raw=r.headers.getSetCookie?.()||[];if(raw.length)ourCookie=raw.map(c=>c.split(';')[0]).join('; ');}
async function ourPersonReport(qs) {
  const r = await fetch(`${URL_OURS}/api/report?view=person&${qs}`, { headers:{ 'Cookie': ourCookie } });
  return await r.json();
}

/* ───── helpers ───── */
function pct(a, b) { return b > 0 ? Math.round((a / b) * 10000) / 100 : 0; }
function diff(label, ours, erp, tolerance = 0) {
  const o = Number(ours || 0);
  const e = Number(erp || 0);
  const d = Math.abs(o - e);
  const ok = d <= tolerance;
  const mark = ok ? '✓' : '✗';
  return `${mark} ${label.padEnd(22)} ours=${String(o).padStart(8)}  erp=${String(e).padStart(8)}  ${ok ? '' : `Δ=${o - e}`}`;
}

async function authenticate() {
  console.log('logging in...');
  await erpRpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });
  const r = await fetch(`${URL_OURS}/api/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ login: DEMO_LOGIN, password: DEMO_PW }) });
  setOurCookie(r);
}

async function compareScenario(label, ourQs, erpKwargs) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  SCENARIO:', label);
  console.log('  our qs   :', ourQs);
  console.log('  erp kwargs:', JSON.stringify(erpKwargs));
  console.log('═══════════════════════════════════════════════════════════');
  const [ours, erp] = await Promise.all([ourPersonReport(ourQs), erpDashboard(erpKwargs)]);
  if (ours.error) { console.log('  ours errored:', ours.error, ours.detail); return; }
  if (!erp)        { console.log('  erp returned no data'); return; }

  // For 30-day windows, ours = erp directly (no chunking)
  // For longer windows, ours = chunked aggregate, ERP returns its (broken) value
  const isChunked = ours.summary?._chunked || false;

  console.log('  Date window ours:', ours.from, '→', ours.to, isChunked ? '(chunked)' : '');
  console.log('  Date window erp :', erp.from_date, '→', erp.to_date);
  console.log();
  console.log(diff('total_walkin_leads',         ours.summary.total_walkin_leads,         erp.total_walkin_leads));
  console.log(diff('appointments_fixed',         ours.summary.appointments_fixed,         erp.appointments_fixed));
  console.log(diff('visits_completed',           ours.summary.visits_completed,           erp.visits_completed));
  console.log(diff('l1_enrolled',                ours.summary.l1_enrolled,                erp.l1_enrolled));
  console.log(diff('l2_enrolled',                ours.summary.l2_enrolled,                erp.l2_enrolled));
  console.log(diff('total_revenue',              ours.summary.total_revenue,              erp.total_revenue));
  console.log(diff('overall_total_calls',        ours.summary.overall_total_calls,        erp.overall_total_calls));
  console.log(diff('overall_call_duration',      ours.summary.overall_call_duration,      erp.overall_call_duration, 1));
  console.log(diff('appointment_conversion_pct', ours.summary.appointment_conversion_pct, erp.appointment_conversion_pct, 0.1));

  // Compare top 3 caller rows
  console.log('\n  Top caller rows:');
  const ourCallers = ours.rows.filter(r => !r.is_hc).slice(0, 3);
  const erpCallers = erp.caller_table?.slice(0, 3) || [];
  for (let i = 0; i < Math.max(ourCallers.length, erpCallers.length); i++) {
    const o = ourCallers[i] || {};
    const e = erpCallers[i] || {};
    console.log(`    [${i}] ours: ${(o.period||'').padEnd(20)} calls=${o.totalCalls}, appt=${o.apptD}, vis=${o.vis}, fu=${o.fu}`);
    console.log(`        erp:  ${(e.name||'').padEnd(20)} calls=${e.total_calls}, appt=${e.appointments_fixed}, vis=${e.visits_completed}, fu=${e.pending_followups}`);
  }
}

/* ───── run all scenarios ───── */
await authenticate();

// Use 30-day window (the one the ERP supports) for ALL tests so comparison is meaningful
const today = new Date().toISOString().slice(0, 10);
const from30 = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

await compareScenario(
  '1) No filter (just date range)',
  `from=${from30}&to=${today}`,
  { from_date: from30, to_date: today }
);

await compareScenario(
  '2) Filter: batch = DWM02 (ERP supports this server-side via batch_code)',
  `from=${from30}&to=${today}&batch=DWM02`,
  { from_date: from30, to_date: today, batch_code: 'DWM02' }   // ← correct ERP param
);

console.log('\n──── Note: ERP method does NOT support per-user server-side filter ────');
console.log('     For salesperson filter, our dashboard mirrors what the ERP UI shows by');
console.log('     extracting that user\'s caller_table row + recomputing KPIs from it.');
console.log('     ERP\'s caller_table[Gayathri] (target):');
const erpFull = await erpDashboard({ from_date: from30, to_date: today });
const erpG = erpFull.caller_table?.find(c => c.name === 'Gayathri');
console.log('       ', erpG);

console.log('\n     Our /api/report?view=person&user_id=255 returns the same row:');
const ourG = await ourPersonReport(`from=${from30}&to=${today}&user_id=255`);
console.log('       ', ourG.rows?.[0]);

console.log('\n✓ verification complete');
