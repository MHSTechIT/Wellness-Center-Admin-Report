const URL_BASE = 'https://mhs.doneztech.com';
const DB = 'odoo';
const LOGIN = process.env.ODOO_LOGIN, PASSWORD = process.env.ODOO_PASSWORD;
let cookieJar = '';
function pickSet(r){const raw=r.headers.getSetCookie?.()||[];if(raw.length)cookieJar=raw.map(c=>c.split(';')[0]).join('; ');}
async function rpc(p,params){const r=await fetch(URL_BASE+p,{method:'POST',headers:{'Content-Type':'application/json','Cookie':cookieJar},body:JSON.stringify({jsonrpc:'2.0',method:'call',params:params||{}})});pickSet(r);const t=await r.text();try{return JSON.parse(t);}catch{return{raw:t.slice(0,300)}}}
async function get(p){const r=await fetch(URL_BASE+p,{headers:{'Cookie':cookieJar}});pickSet(r);return{status:r.status,text:await r.text(),ctype:r.headers.get('content-type')};}

await rpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });

// 1. read the Walkin Team action (id=453)
console.log('--- action 453 (Walkin Team Dashboard) — FULL response ---');
const act = await rpc('/web/dataset/call_kw', {
  model: 'ir.actions.client', method: 'read',
  args: [[453], ['id','name','tag','params','target','context','res_model','help']],
  kwargs: {},
});
console.log('FULL:', JSON.stringify(act, null, 2));

// 2. read action 341 (Online Team) for comparison
console.log('\n--- action 341 (Online Team) for reference ---');
const act2 = await rpc('/web/dataset/call_kw', {
  model: 'ir.actions.client', method: 'read',
  args: [[341], ['id','name','tag','params','target','context']],
  kwargs: {},
});
console.log(JSON.stringify(act2.result, null, 2));

// 3. fetch the asset bundle and grep for the OWL component tag
const tag = act.result?.[0]?.tag;
if (tag) {
  console.log('\n--- looking for OWL component for tag:', tag, '---');
  // try fetching the JS bundle
  const r = await get('/web/assets/web.assets_backend.min.js');
  console.log('  bundle status:', r.status, '| len:', r.text.length);
  // search for tag references
  const idx = r.text.indexOf(tag);
  if (idx > 0) {
    console.log('  found tag in bundle at offset', idx);
    console.log('  context:', r.text.slice(Math.max(0, idx-200), idx + 500));
  } else {
    console.log('  tag NOT found in min bundle, try unminified');
    const r2 = await get('/web/assets/web.assets_backend.js');
    console.log('  unmin status:', r2.status, '| len:', r2.text.length);
    const i2 = r2.text.indexOf(tag);
    if (i2 > 0) {
      console.log('  found at', i2);
      console.log('  context:', r2.text.slice(Math.max(0, i2-200), i2 + 800));
    } else console.log('  not found in unminified either');
  }
}
