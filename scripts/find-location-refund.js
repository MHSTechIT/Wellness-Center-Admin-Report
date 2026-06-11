import { q } from '../server/db.js';

// 1) Look for location-ish columns on crm_lead
console.log('═══ Location columns on crm_lead ═══');
const locCols = await q(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crm_lead'
    AND (column_name IN ('city','zip','street','state_id','country_id','district','area','region','location','address')
      OR column_name ILIKE '%city%' OR column_name ILIKE '%district%' OR column_name ILIKE '%area%' OR column_name ILIKE '%region%' OR column_name ILIKE '%pincode%' OR column_name ILIKE '%postal%')
  ORDER BY column_name`);
locCols.rows.forEach(c => console.log(' ', c.column_name, '::', c.data_type));

console.log('\n═══ City distribution (top 25) — walkin teams ═══');
const cities = await q(`
  SELECT TRIM(city) AS city, COUNT(*)::int AS n
  FROM crm_lead WHERE team_id IN (14,15) AND city IS NOT NULL AND TRIM(city) <> ''
  GROUP BY TRIM(city) ORDER BY n DESC LIMIT 25`);
cities.rows.forEach(r => console.log('  ' + String(r.n).padStart(6), '·', r.city));

console.log('\n═══ Refund-related columns / tables ═══');
const refCols = await q(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public'
    AND (column_name ILIKE '%refund%' OR column_name ILIKE '%cancel%')
  ORDER BY table_name, column_name`);
refCols.rows.forEach(c => console.log(' ', c.table_name + '.' + c.column_name, '::', c.data_type));

console.log('\n═══ payment_line: line_type and refund-status distinct values ═══');
try {
  const pl = await q(`SELECT line_type, COUNT(*)::int AS n FROM crm_lead_payment_line GROUP BY line_type ORDER BY n DESC LIMIT 20`);
  pl.rows.forEach(r => console.log('  line_type:', r.line_type, '→', r.n));
} catch(e) { console.log('  ERR', e.message); }

console.log('\n═══ Look for refund-status on crm_lead ═══');
const rs = await q(`
  SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crm_lead' AND column_name ILIKE '%refund%' OR table_name='crm_lead' AND column_name ILIKE '%return%'
  ORDER BY column_name`);
rs.rows.forEach(c => console.log(' ', c.column_name, '::', c.data_type));

console.log('\n═══ Distinct city values starting with "Chen" (case-insensitive) — to see Chennai variations ═══');
const chen = await q(`SELECT DISTINCT TRIM(city) AS city FROM crm_lead WHERE team_id IN (14,15) AND city ILIKE 'chen%' LIMIT 20`);
chen.rows.forEach(r => console.log('  ' + r.city));

process.exit(0);
