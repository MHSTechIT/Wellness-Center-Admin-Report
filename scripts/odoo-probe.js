// Probe the Odoo web instance to find the dashboard endpoint and read its exact response.
// Credentials are passed via environment variables — never hardcoded.

const URL_BASE = process.env.ODOO_URL || 'https://mhs.doneztech.com';
const DB       = process.env.ODOO_DB  || 'Odoo';
const LOGIN    = process.env.ODOO_LOGIN;
const PASSWORD = process.env.ODOO_PASSWORD;

if (!LOGIN || !PASSWORD) {
  console.error('ERR: set ODOO_LOGIN and ODOO_PASSWORD env vars');
  process.exit(1);
}

let cookieJar = '';
function pickSetCookies(res) {
  const raw = res.headers.getSetCookie?.() || [];
  if (raw.length) cookieJar = raw.map(c => c.split(';')[0]).join('; ');
}

async function rpc(path, params) {
  const r = await fetch(URL_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieJar },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: params || {} }),
    redirect: 'follow',
  });
  pickSetCookies(r);
  const text = await r.text();
  try { return { status: r.status, json: JSON.parse(text) }; }
  catch { return { status: r.status, raw: text.slice(0, 500) }; }
}

console.log('[1/4] auth as', LOGIN, 'on', URL_BASE);
const auth = await rpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });
if (auth.status !== 200 || !auth.json?.result?.uid) {
  console.error('  AUTH FAILED', JSON.stringify(auth, null, 2).slice(0, 800));
  process.exit(1);
}
console.log('  uid:', auth.json.result.uid, '| name:', auth.json.result.name, '| company:', auth.json.result.company_id);
console.log('  user_companies:', auth.json.result.user_companies?.allowed_companies && Object.keys(auth.json.result.user_companies.allowed_companies));

console.log('\n[2/4] list installed modules — confirm dashboard module is reachable');
const mods = await rpc('/web/dataset/call_kw', {
  model: 'ir.module.module', method: 'search_read',
  args: [[['state','=','installed'],['name','ilike','dashboard']],
         ['name','shortdesc','state']],
  kwargs: {},
});
console.log(' ', JSON.stringify(mods.json?.result || mods.raw || mods, null, 2));

console.log('\n[3/4] list all controllers/routes registered by online_team_dashboard module via ir.module.module info');
const dashInfo = await rpc('/web/dataset/call_kw', {
  model: 'ir.module.module', method: 'search_read',
  args: [[['name','=','online_team_dashboard']],
         ['name','shortdesc','installed_version','author','description']],
  kwargs: {},
});
console.log(' ', JSON.stringify(dashInfo.json?.result || dashInfo.raw, null, 2));

console.log('\n[4/4] look for menu items related to "dashboard" (gives us the action and method)');
const menus = await rpc('/web/dataset/call_kw', {
  model: 'ir.ui.menu', method: 'search_read',
  args: [[['name','ilike','dashboard']],
         ['id','name','action','parent_id']],
  kwargs: {},
});
console.log(' ', JSON.stringify(menus.json?.result || menus.raw, null, 2));
