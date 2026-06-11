const URL_BASE = 'https://mhs.doneztech.com';
const DB = 'odoo';
const LOGIN = process.env.ODOO_LOGIN, PASSWORD = process.env.ODOO_PASSWORD;
let cookieJar = '';
function pickSet(r){const raw=r.headers.getSetCookie?.()||[];if(raw.length)cookieJar=raw.map(c=>c.split(';')[0]).join('; ');}
async function rpc(p, params){const r=await fetch(URL_BASE+p,{method:'POST',headers:{'Content-Type':'application/json','Cookie':cookieJar},body:JSON.stringify({jsonrpc:'2.0',method:'call',params:params||{}})});pickSet(r);return await r.json();}

await rpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });

const tests = [
  { label: '1 day (today only)',    from_date: '2026-05-12', to_date: '2026-05-12' },
  { label: '7 days (last week)',    from_date: '2026-05-05', to_date: '2026-05-12' },
  { label: '30 days',               from_date: '2026-04-12', to_date: '2026-05-12' },
  { label: '85 days (weekly view)', from_date: '2026-02-17', to_date: '2026-05-13' },
  { label: '365 days (monthly)',    from_date: '2025-05-13', to_date: '2026-05-13' },
];

const cols = ['total_walkin_leads', 'appointments_fixed', 'visits_completed', 'l1_enrolled', 'l2_enrolled', 'total_revenue', 'appointment_conversion_pct', 'overall_total_calls', 'overall_call_duration'];

console.log('Period'.padEnd(28), cols.map(c => c.slice(0,10).padStart(11)).join(' '));
console.log('─'.repeat(28 + cols.length * 12));

for (const t of tests) {
  const r = await rpc('/web/dataset/call_kw', {
    model: 'walkin.team.dashboard', method: 'get_dashboard_data',
    args: [], kwargs: { from_date: t.from_date, to_date: t.to_date },
  });
  const d = r.result;
  const vals = cols.map(c => {
    const v = d?.[c];
    if (v == null) return '—'.padStart(11);
    if (typeof v === 'number') return v.toLocaleString().padStart(11);
    return String(v).padStart(11);
  });
  console.log(t.label.padEnd(28), vals.join(' '));
}
