const URL_BASE = 'https://mhs.doneztech.com';
const DB = 'odoo';
const LOGIN = process.env.ODOO_LOGIN, PASSWORD = process.env.ODOO_PASSWORD;
let cookieJar = '';
function pickSet(r){const raw=r.headers.getSetCookie?.()||[];if(raw.length)cookieJar=raw.map(c=>c.split(';')[0]).join('; ');}
async function rpc(p, params){const r=await fetch(URL_BASE+p,{method:'POST',headers:{'Content-Type':'application/json','Cookie':cookieJar},body:JSON.stringify({jsonrpc:'2.0',method:'call',params:params||{}})});pickSet(r);return await r.json();}

await rpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });
const base = { from_date: '2026-04-12', to_date: '2026-05-12' };

// 1. Try positional args  [user_id]
console.log('═══ Try positional args ═══');
for (const args of [[255], [[255]], [255, 'DWM02'], ['DWM02']]) {
  const r = await rpc('/web/dataset/call_kw', { model:'walkin.team.dashboard', method:'get_dashboard_data', args, kwargs: base });
  if (r.result) console.log('  args=' + JSON.stringify(args).padEnd(20), '→ leads=' + r.result.total_walkin_leads, '| callers=' + r.result.caller_table?.length);
  else console.log('  args=' + JSON.stringify(args).padEnd(20), '→ ERR:', r.error?.data?.message?.split('\n')[0]);
}

// 2. List all methods exposed on walkin.team.dashboard
console.log('\n═══ Probe for other dashboard methods ═══');
const candidateMethods = [
  'get_dashboard_data',
  'get_salesperson_data',
  'get_user_data',
  'get_caller_data',
  'get_data_by_user',
  'get_data_for_user',
  'get_filtered_data',
  'get_kpi',
  'get_user_kpi',
  'get_personal_data',
  'get_individual_data',
  'get_dashboard_data_by_user',
  'fetch_user_dashboard',
  'compute_user_metrics',
];
for (const method of candidateMethods) {
  const r = await rpc('/web/dataset/call_kw', { model:'walkin.team.dashboard', method, args:[], kwargs: { ...base, user_id: 255 } });
  if (r.result !== undefined) {
    console.log('  ✓ ' + method.padEnd(36), '→ TYPE:', typeof r.result, 'keys:', Array.isArray(r.result) ? '[]' : Object.keys(r.result || {}).join(','));
  } else {
    const e = r.error?.data?.name || r.error?.message?.split('\n')[0] || '';
    if (!e.includes('does not exist')) console.log('  ✗ ' + method, '→', e.slice(0, 50));
  }
}

// 3. Try in context
console.log('\n═══ Try passing user_id in context ═══');
const r = await rpc('/web/dataset/call_kw', {
  model:'walkin.team.dashboard',
  method:'get_dashboard_data',
  args:[],
  kwargs: base,
  context: { user_id: 255, active_user: 255 },
});
if (r.result) console.log('  ctx → leads=' + r.result.total_walkin_leads, '| callers=' + r.result.caller_table?.length);
