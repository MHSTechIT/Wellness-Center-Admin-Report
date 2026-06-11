const URL_BASE = 'https://mhs.doneztech.com';
const DB = 'odoo';
const LOGIN = process.env.ODOO_LOGIN, PASSWORD = process.env.ODOO_PASSWORD;
let cookieJar = '';
function pickSet(r){const raw=r.headers.getSetCookie?.()||[];if(raw.length)cookieJar=raw.map(c=>c.split(';')[0]).join('; ');}
async function rpc(p, params){
  const r = await fetch(URL_BASE + p, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieJar },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: params || {} }),
  });
  pickSet(r);
  return await r.json();
}

await rpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });

// Try multiple parameter names — ERP dashboards often use date_from/date_to or from_date/to_date
const tries = [
  { date_from: '2026-04-12', date_to: '2026-05-12' },
  { from_date: '2026-04-12', to_date: '2026-05-12' },
  { start_date: '2026-04-12', end_date: '2026-05-12' },
  { date_range: 'last_30_days' },
  { period: 'last_30_days' },
];

for (const kwargs of tries) {
  console.log('═══ kwargs:', JSON.stringify(kwargs), '═══');
  const r = await rpc('/web/dataset/call_kw', {
    model: 'walkin.team.dashboard', method: 'get_dashboard_data',
    args: [], kwargs,
  });
  const d = r.result;
  if (!d) { console.log('  ✗', r.error?.message?.split('\n')[0]); continue; }
  console.log('  from_date:', d.from_date, '→ to_date:', d.to_date);
  console.log('  KPIs: leads=' + d.total_walkin_leads, '· appt=' + d.appointments_fixed, '· visits=' + d.visits_completed, '· L1=' + d.l1_enrolled, '· L2=' + d.l2_enrolled, '· conv%=' + d.appointment_conversion_pct);
  if (d.from_date !== d.to_date) {
    console.log('  ★ DATE RANGE APPLIED — this is the magic kwargs');
    console.log('  Gayathri row:', JSON.stringify(d.caller_table?.find(c => c.name === 'Gayathri')));
    break;
  }
}
