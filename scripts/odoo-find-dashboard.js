const URL_BASE = 'https://mhs.doneztech.com';
const DB = 'odoo';
const LOGIN = process.env.ODOO_LOGIN;
const PASSWORD = process.env.ODOO_PASSWORD;

let cookieJar = '';
function pickSet(r) {
  const raw = r.headers.getSetCookie?.() || [];
  if (raw.length) cookieJar = raw.map(c => c.split(';')[0]).join('; ');
}
async function rpc(path, params) {
  const r = await fetch(URL_BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': cookieJar },
    body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: params || {} }),
  });
  pickSet(r);
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 500) }; }
}
async function get(path) {
  const r = await fetch(URL_BASE + path, {
    headers: { 'Cookie': cookieJar },
  });
  pickSet(r);
  return { status: r.status, text: await r.text(), ctype: r.headers.get('content-type') };
}

// auth
console.log('auth...');
await rpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });

// 1) child menus of Sales Dashboards (id 272)
console.log('\n--- child menus of Sales Dashboards (id=272) ---');
const m = await rpc('/web/dataset/call_kw', {
  model: 'ir.ui.menu', method: 'search_read',
  args: [[['parent_id','=',272]], ['id','name','action','sequence']],
  kwargs: {},
});
console.log(JSON.stringify(m.result || m, null, 2));

// 2) hunt for any ir.actions that mention online_team_dashboard or walkin
console.log('\n--- actions with type=ir.actions.client and tag like %dashboard% ---');
const acts = await rpc('/web/dataset/call_kw', {
  model: 'ir.actions.client', method: 'search_read',
  args: [[], ['id','name','tag','params','target']],
  kwargs: { limit: 30 },
});
const filtered = (acts.result || []).filter(a => /dash|walk|sales/i.test(a.name || '') || /dash|walk/i.test(a.tag || ''));
console.log(JSON.stringify(filtered, null, 2));

// 3) browse the home page after login — find OWL component refs
console.log('\n--- GET /odoo/sales-dashboards or /web home page (search for tag names) ---');
const home = await get('/odoo');
console.log('status:', home.status, '| ctype:', home.ctype, '| len:', home.text.length);
// Look for dashboard-related script tags / asset URLs
const owl = (home.text.match(/online_team_dashboard[^"'\s]*/g) || []).slice(0, 6);
console.log('online_team_dashboard mentions:', owl);

// 4) try the typical OWL dashboard controller route
console.log('\n--- try common controller routes ---');
for (const path of [
  '/online_team_dashboard/get_data',
  '/online_team_dashboard/data',
  '/online_team_dashboard/walkin_data',
  '/web/dataset/call_kw',  // probe via call_kw to find method names
]) {
  const r = await get(path);
  console.log(' ', path, '->', r.status, '(' + r.ctype + ')', r.text.slice(0, 80).replace(/\n/g,' '));
}
