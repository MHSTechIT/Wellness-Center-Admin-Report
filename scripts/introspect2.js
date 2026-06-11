import 'dotenv/config';
import pg from 'pg';
import fs from 'node:fs';

const { Client } = pg;
const client = new Client({
  host: process.env.PGHOST, port: Number(process.env.PGPORT),
  user: process.env.PGUSER, password: process.env.PGPASSWORD, database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const out = {};

// 1) Distinct values + counts for enum-like columns on crm_lead
async function distrib(col, tbl='crm_lead') {
  const r = await client.query(`SELECT ${col} AS v, count(*)::bigint AS n FROM ${tbl} WHERE ${col} IS NOT NULL GROUP BY ${col} ORDER BY n DESC LIMIT 30`);
  return r.rows;
}
out.distrib = {};
for (const c of ['call_status','walkin_call_status','walkin_visit_status','walkin_appt_confirm_status','walkin_visited_radio','sugar_level','haf_status','bdm_audit_status','l1_price_type','batch_code_full','access_batch_code']) {
  try { out.distrib['crm_lead.' + c] = await distrib(c); } catch(e){ out.distrib['crm_lead.' + c] = 'ERR ' + e.message }
}

// 2) crm_stage names (stage_id pipeline)
out.stages = (await client.query(`SELECT id, name->>'en_US' AS name, sequence, is_won FROM crm_stage ORDER BY sequence`)).rows;

// 3) crm_team names
out.teams = (await client.query(`SELECT id, name FROM crm_team ORDER BY id`)).rows;

// 4) utm_source distribution
try {
  out.sources = (await client.query(`
    SELECT u.name->>'en_US' AS source, count(l.id)::bigint AS n
    FROM crm_lead l LEFT JOIN utm_source u ON u.id=l.source_id
    WHERE l.create_date >= NOW() - INTERVAL '60 days'
    GROUP BY u.name ORDER BY n DESC LIMIT 20`)).rows;
} catch(e){ out.sources = 'ERR ' + e.message }

// 5) Health-coach users
out.healthCoaches = (await client.query(`
  SELECT u.id, u.login, p.name FROM res_users u JOIN res_partner p ON p.id=u.partner_id
  WHERE u.is_health_coach_user = TRUE AND u.active = TRUE ORDER BY p.name`)).rows;

// 6) Salespersons w/ lead counts (last 30 days)
out.salespersons = (await client.query(`
  SELECT u.id, p.name AS salesperson, count(l.id)::bigint AS leads_30d
  FROM crm_lead l JOIN res_users u ON u.id=l.user_id JOIN res_partner p ON p.id=u.partner_id
  WHERE l.create_date >= NOW() - INTERVAL '30 days'
  GROUP BY u.id, p.name ORDER BY leads_30d DESC LIMIT 30`)).rows;

// 7) Date range — to know if "current" means anything
out.dateRange = (await client.query(`
  SELECT MIN(create_date)::date AS oldest, MAX(create_date)::date AS newest,
         COUNT(*) FILTER (WHERE create_date >= NOW() - INTERVAL '7 days')::bigint AS leads_7d,
         COUNT(*) FILTER (WHERE create_date >= NOW() - INTERVAL '30 days')::bigint AS leads_30d,
         COUNT(*) FILTER (WHERE visited_date IS NOT NULL AND visited_date >= NOW() - INTERVAL '30 days')::bigint AS visited_30d
  FROM crm_lead`)).rows[0];

// 8) Sample row to see real shape
out.sampleLead = (await client.query(`
  SELECT id, name, create_date, user_id, team_id, stage_id, source_id, source_id,
         call_status, walkin_call_status, walkin_visit_status, walkin_appt_confirm_status,
         walkin_appointment_date, visited_date, sugar_level, haf_status, bdm_audit_score,
         l1_access_date, l2_access_date, batch_code_full, access_batch_code, is_l2_fully_paid,
         expected_revenue, probability
  FROM crm_lead WHERE visited_date IS NOT NULL ORDER BY create_date DESC LIMIT 3`)).rows;

// 9) Columns in supporting tables
async function cols(tbl){ return (await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`,[tbl])).rows }
for (const t of ['crm_lead_call_log','crm_lead_followup_log','crm_lead_payment_line','crm_lead_health_assessment','crm_lead_recording','walkin_visit_summary','crm_lead_lost']) out['cols_'+t] = await cols(t);

// 10) Payment line distribution
try {
  out.paymentLineEnrollTypes = (await client.query(`SELECT enrollment_type, count(*)::bigint AS n FROM crm_lead_payment_line GROUP BY enrollment_type ORDER BY n DESC LIMIT 20`)).rows;
} catch(e){}

// 11) Check ads spend / ROAS source
out.adsSpendTables = (await client.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND (table_name ILIKE '%ad%spend%' OR table_name ILIKE '%marketing%spend%' OR table_name ILIKE '%campaign%spend%' OR table_name ILIKE '%utm%' OR table_name ILIKE '%budget%')
  ORDER BY table_name`)).rows.map(r=>r.table_name);

fs.writeFileSync('introspection2.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await client.end();
