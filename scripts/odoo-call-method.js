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
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0, 400) }; }
}

await rpc('/web/session/authenticate', { db: DB, login: LOGIN, password: PASSWORD });

const MODEL = 'walkin.team.dashboard';
const METHODS = [
  'get_dashboard_data',
  'get_data',
  'get_walkin_dashboard_data',
  'fetch_data',
  'compute_data',
  'load_data',
  'get_kpi_data',
  'get_summary_data',
  '_get_dashboard_data',
];

// Common arg patterns for dashboard methods
const argShapes = [
  { name: 'no args', args: [], kwargs: {} },
  { name: 'with dates', args: [], kwargs: { date_from: '2026-04-12', date_to: '2026-05-12' } },
  { name: 'period only', args: [], kwargs: { period: 'last_30_days' } },
];

for (const method of METHODS) {
  for (const shape of argShapes) {
    const r = await rpc('/web/dataset/call_kw', {
      model: MODEL, method, args: shape.args, kwargs: shape.kwargs,
    });
    const ok = r.result !== undefined;
    const err = r.error?.data?.name || r.error?.message?.split('\n')[0] || '';
    if (ok || !err.includes('does not exist')) {
      console.log(`  ${method.padEnd(28)} (${shape.name.padEnd(12)}) → ${ok ? '✓ SUCCESS' : '✗ ' + err.slice(0, 80)}`);
      if (ok) {
        console.log('     RESULT TYPE:', typeof r.result, '| keys:', Array.isArray(r.result) ? `array(${r.result.length})` : (r.result ? Object.keys(r.result).join(',') : r.result));
      }
    }
  }
}
