const URL_BASE = 'https://mhs.doneztech.com';
const DB = 'odoo';
const LOGIN = process.env.ODOO_LOGIN, PASSWORD = process.env.ODOO_PASSWORD;
let cookieJar = '';
function pickSet(r){const raw=r.headers.getSetCookie?.()||[];if(raw.length)cookieJar=raw.map(c=>c.split(';')[0]).join('; ');}
async function rpc(p, params){const r=await fetch(URL_BASE+p,{method:'POST',headers:{'Content-Type':'application/json','Cookie':cookieJar},body:JSON.stringify({jsonrpc:'2.0',method:'call',params:params||{}})});pickSet(r);return await r.json();}

await rpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });

const baseKwargs = { from_date: '2026-04-12', to_date: '2026-05-12' };
const GAYATHRI = 255;
const DWM02 = 'DWM02';

console.log('Baseline (no salesperson filter): expected leads=2638, gayathri row should be present');
const base = (await rpc('/web/dataset/call_kw', { model:'walkin.team.dashboard', method:'get_dashboard_data', args:[], kwargs: baseKwargs })).result;
console.log('  leads:', base.total_walkin_leads, '| callers:', base.caller_table?.length, '| total calls:', base.overall_total_calls);
console.log();

// Try various parameter names for user filter
const userParamNames = [
  'user_id', 'user_ids', 'salesperson_id', 'salesperson', 'caller_id', 'caller_ids',
  'agent_id', 'employee_id', 'user', 'sales_person', 'selected_user', 'filter_user_id',
  'team_member_id',
];

console.log('═══ Hunting for the salesperson filter param ═══');
console.log('  When the right one is found, leads should drop (e.g. ~525 for Gayathri)');
console.log();
for (const name of userParamNames) {
  // Try as scalar
  try {
    const r1 = (await rpc('/web/dataset/call_kw', { model:'walkin.team.dashboard', method:'get_dashboard_data', args:[], kwargs: { ...baseKwargs, [name]: GAYATHRI } })).result;
    const note = r1?.total_walkin_leads !== base.total_walkin_leads ? '  ★ FILTER APPLIED!' : '';
    console.log(`  ${name.padEnd(22)} = ${GAYATHRI} (scalar)  →  leads=${r1?.total_walkin_leads}  callers=${r1?.caller_table?.length}${note}`);
  } catch(e) { console.log(`  ${name.padEnd(22)} = scalar          → ERR: ${e.message}`); }

  // Try as array
  try {
    const r2 = (await rpc('/web/dataset/call_kw', { model:'walkin.team.dashboard', method:'get_dashboard_data', args:[], kwargs: { ...baseKwargs, [name]: [GAYATHRI] } })).result;
    const note = r2?.total_walkin_leads !== base.total_walkin_leads ? '  ★ FILTER APPLIED!' : '';
    console.log(`  ${name.padEnd(22)} = [${GAYATHRI}] (array) →  leads=${r2?.total_walkin_leads}  callers=${r2?.caller_table?.length}${note}`);
  } catch(e) { console.log(`  ${name.padEnd(22)} = array           → ERR: ${e.message}`); }
}

console.log();
console.log('═══ Hunting for the batch filter param ═══');
const batchParamNames = ['batch','batch_id','batch_code','batch_code_full','batch_name','selected_batch','filter_batch'];
for (const name of batchParamNames) {
  try {
    const r = (await rpc('/web/dataset/call_kw', { model:'walkin.team.dashboard', method:'get_dashboard_data', args:[], kwargs: { ...baseKwargs, [name]: DWM02 } })).result;
    const note = r?.total_walkin_leads !== base.total_walkin_leads ? '  ★ FILTER APPLIED!' : '';
    console.log(`  ${name.padEnd(22)} = "${DWM02}"  →  leads=${r?.total_walkin_leads}${note}`);
  } catch(e) { console.log(`  ${name.padEnd(22)}  → ERR: ${e.message}`); }
}
