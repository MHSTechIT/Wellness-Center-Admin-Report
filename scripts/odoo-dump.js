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

// Call with no date filter (default = Last 30 Days?)
const r = await rpc('/web/dataset/call_kw', {
  model: 'walkin.team.dashboard',
  method: 'get_dashboard_data',
  args: [],
  kwargs: {},
});

const d = r.result;
console.log('═══════ KPIs ═══════');
console.log({
  from_date: d.from_date, to_date: d.to_date,
  total_walkin_leads: d.total_walkin_leads,
  appointments_fixed: d.appointments_fixed,
  visits_completed: d.visits_completed,
  assessments_completed: d.assessments_completed,
  l1_enrolled: d.l1_enrolled,
  l2_enrolled: d.l2_enrolled,
  total_revenue: d.total_revenue,
  appointment_conversion_pct: d.appointment_conversion_pct,
  visit_conversion_pct: d.visit_conversion_pct,
  assessment_completion_pct: d.assessment_completion_pct,
  enrollment_conversion_pct: d.enrollment_conversion_pct,
  overall_total_calls: d.overall_total_calls,
  overall_call_duration: d.overall_call_duration,
  status: d.status,
});

console.log('\n═══════ caller_table ═══════');
console.log(JSON.stringify(d.caller_table, null, 2));

console.log('\n═══════ coach_table ═══════');
console.log(JSON.stringify(d.coach_table, null, 2));

console.log('\n═══════ users (sample) ═══════');
console.log(JSON.stringify(d.users?.slice?.(0, 5) ?? d.users, null, 2));

console.log('\n═══════ batch_data (sample) ═══════');
console.log(JSON.stringify((d.batch_data?.slice?.(0, 5)) ?? d.batch_data, null, 2));

console.log('\n═══════ status_pie_data ═══════');
console.log(JSON.stringify(d.status_pie_data, null, 2));

console.log('\n═══════ call_counts_by_date (sample) ═══════');
console.log(JSON.stringify((d.call_counts_by_date?.slice?.(0, 5)) ?? d.call_counts_by_date, null, 2));

// Also save full payload to disk
import('node:fs').then(({ writeFileSync }) =>
  writeFileSync('walkin-erp-payload.json', JSON.stringify(d, null, 2))
);
console.log('\nFull payload saved to walkin-erp-payload.json');
