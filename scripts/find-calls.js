import { q } from '../server/db.js';

console.log('--- Tables with call_status / phone / duration / talk columns ---');
const t = await q(`SELECT DISTINCT c.table_name FROM information_schema.columns c WHERE c.table_schema='public' AND (c.column_name ILIKE '%duration%' OR c.column_name='call_status' OR c.column_name='phone' OR c.column_name ILIKE '%talk%' OR c.column_name ILIKE '%dialed%' OR c.column_name ILIKE '%dialer%') AND c.table_name NOT LIKE 'crm_iap%' AND c.table_name NOT LIKE 'res_%' ORDER BY c.table_name`);
for (const r of t.rows) {
  let n = 'N/A';
  try { const c = await q(`SELECT COUNT(*)::int AS n FROM "${r.table_name}"`); n = c.rows[0].n; } catch {}
  console.log(' ', r.table_name, '-', n, 'rows');
}

console.log('\n--- walkin_visit_summary recent rows ---');
const wvs = await q('SELECT * FROM walkin_visit_summary ORDER BY date DESC LIMIT 5');
wvs.rows.forEach(r => console.log(' ', JSON.stringify(r)));

console.log('\n--- crm_lead_followup_log ---');
const ful = await q('SELECT COUNT(*)::int AS n FROM crm_lead_followup_log');
console.log(' total rows:', ful.rows[0].n);
const sample = await q(`SELECT log_type, COUNT(*)::int AS n FROM crm_lead_followup_log GROUP BY log_type ORDER BY n DESC LIMIT 10`);
console.log(' by log_type:');
sample.rows.forEach(r => console.log('   ', JSON.stringify(r)));

console.log('\n--- Followup-log volume for Gayathri (255) last 30d ---');
const fg = await q(`SELECT log_type, COUNT(*)::int AS n FROM crm_lead_followup_log WHERE logged_by_id=255 AND logged_at >= NOW() - INTERVAL '30 days' GROUP BY log_type ORDER BY n DESC`);
fg.rows.forEach(r => console.log('   ', JSON.stringify(r)));

console.log('\n--- Big tables (>1000 rows) ---');
const big = await q(`SELECT c.relname AS t, c.reltuples::bigint AS approx FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.reltuples > 1000 ORDER BY c.reltuples DESC LIMIT 25`);
big.rows.forEach(r => console.log(' ', r.t, '-', r.approx));

process.exit(0);
