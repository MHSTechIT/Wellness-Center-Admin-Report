import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';

const { Client } = pg;
const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const out = { generatedAt: new Date().toISOString() };

// 1) Installed Odoo modules — tells us which custom modules to look at
const mods = await client.query(`
  SELECT name, state, latest_version
  FROM ir_module_module
  WHERE state = 'installed'
    AND name NOT LIKE 'l10n_%'
    AND name NOT IN ('base','web','mail','bus','barcodes','iap','digest','resource','calendar','contacts','phone_validation','sms','google_calendar','google_account','google_drive','google_recaptcha','microsoft_account','microsoft_calendar','auth_signup','portal','utm','link_tracker','snailmail','attachment_indexation','document_url','http_routing','website_links','rating','partner_autocomplete','onboarding','privacy_lookup')
  ORDER BY name
`);
out.installedCustomModules = mods.rows;

// 2) All public tables, with row counts where cheap
const tablesQ = await client.query(`
  SELECT
    c.relname AS table,
    c.reltuples::bigint AS approx_rows,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS size
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.reltuples DESC NULLS LAST
  LIMIT 80
`);
out.top80TablesByRows = tablesQ.rows;

// 3) Tables likely to be CRM/sales/health related
const relevantQ = await client.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema='public'
    AND (
      table_name LIKE '%lead%'
      OR table_name LIKE '%appointment%'
      OR table_name LIKE '%appt%'
      OR table_name LIKE '%visit%'
      OR table_name LIKE '%enrol%'
      OR table_name LIKE '%enroll%'
      OR table_name LIKE '%consult%'
      OR table_name LIKE '%health%'
      OR table_name LIKE '%patient%'
      OR table_name LIKE '%batch%'
      OR table_name LIKE '%coach%'
      OR table_name LIKE '%program%'
      OR table_name LIKE '%followup%'
      OR table_name LIKE '%follow_up%'
      OR table_name LIKE '%payment%'
      OR table_name LIKE '%bdm%'
      OR table_name LIKE '%hc_%'
      OR table_name LIKE '%haf%'
      OR table_name LIKE '%sugar%'
      OR table_name LIKE '%diab%'
    )
  ORDER BY table_name
`);
out.likelyRelevantTables = relevantQ.rows.map(r => r.table_name);

// 4) Custom fields added to crm_lead (Odoo std table) -- studio/custom fields usually start with x_ or have specific names
const crmLeadColsQ = await client.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='crm_lead'
  ORDER BY ordinal_position
`);
out.crm_lead_columns = crmLeadColsQ.rows;

// 5) Search ALL columns for MHS-related keywords across all public tables
const colSearchQ = await client.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema='public'
    AND (
      column_name ILIKE '%sugar%'
      OR column_name ILIKE '%haf%'
      OR column_name ILIKE '%appt%'
      OR column_name ILIKE '%appointment%'
      OR column_name ILIKE '%visit%'
      OR column_name ILIKE '%enrol%'
      OR column_name ILIKE '%enroll%'
      OR column_name ILIKE '%batch%'
      OR column_name ILIKE '%coach%'
      OR column_name ILIKE '%bdm%'
      OR column_name ILIKE '%roas%'
      OR column_name ILIKE '%ads_spent%'
      OR column_name ILIKE '%kit_given%'
      OR column_name ILIKE '%l1_%'
      OR column_name ILIKE '%l2_%'
      OR column_name ILIKE '%call_status%'
    )
  ORDER BY table_name, column_name
`);
out.mhsKeywordColumns = colSearchQ.rows;

// 6) Row counts on the most likely tables
async function safeCount(tbl) {
  try {
    const r = await client.query(`SELECT count(*) AS n FROM "${tbl}"`);
    return Number(r.rows[0].n);
  } catch { return null; }
}
const sampleTables = ['crm_lead','crm_stage','crm_team','sale_order','res_partner','res_users','hr_employee', ...out.likelyRelevantTables.slice(0,15)];
out.rowCounts = {};
for (const t of [...new Set(sampleTables)]) out.rowCounts[t] = await safeCount(t);

fs.writeFileSync('introspection.json', JSON.stringify(out, null, 2));
console.log('Wrote introspection.json');
console.log('--- Installed custom modules (' + out.installedCustomModules.length + ') ---');
console.log(out.installedCustomModules.map(m => '  ' + m.name).join('\n'));
console.log('\n--- Tables matching CRM/health keywords (' + out.likelyRelevantTables.length + ') ---');
console.log(out.likelyRelevantTables.map(t => '  ' + t).join('\n'));
console.log('\n--- Columns matching MHS keywords (' + out.mhsKeywordColumns.length + ') ---');
out.mhsKeywordColumns.forEach(c => console.log(`  ${c.table_name}.${c.column_name}  (${c.data_type})`));
console.log('\n--- Row counts ---');
Object.entries(out.rowCounts).forEach(([t,n]) => console.log(`  ${t}: ${n === null ? 'N/A' : n.toLocaleString()}`));

await client.end();
