import { q } from '../server/db.js';

console.log('--- mail_tracking_value columns ---');
const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='mail_tracking_value' ORDER BY ordinal_position`);
cols.rows.forEach(c => console.log(' ', c.column_name, '::', c.data_type));

console.log('\n--- sample tracking entries for walkin_call_status changes ---');
try {
  const s = await q(`
    SELECT mtv.*, mm.create_date AS msg_date, imf.name AS field_name, imf.model
    FROM mail_tracking_value mtv
    JOIN ir_model_fields imf ON imf.id = mtv.field_id
    JOIN mail_message mm ON mm.id = mtv.mail_message_id
    WHERE imf.name = 'walkin_call_status' AND imf.model = 'crm.lead'
    ORDER BY mtv.id DESC
    LIMIT 3
  `);
  s.rows.forEach(r => console.log(' ', JSON.stringify(r, null, 2)));
} catch (e) { console.log('Q1 error', e.message); }

console.log('\n--- count of walkin_call_status transitions to "appointment_fixed_*" in last 30d ---');
try {
  const r = await q(`
    SELECT mtv.new_value_char, COUNT(*)::int AS n
    FROM mail_tracking_value mtv
    JOIN ir_model_fields imf ON imf.id = mtv.field_id
    JOIN mail_message mm ON mm.id = mtv.mail_message_id
    WHERE imf.name = 'walkin_call_status' AND imf.model = 'crm.lead'
      AND mtv.new_value_char IN ('appointment_fixed_direct', 'appointment_fixed_zoom', 'visited')
      AND mm.create_date >= NOW() - INTERVAL '30 days'
    GROUP BY mtv.new_value_char
    ORDER BY n DESC
  `);
  r.rows.forEach(row => console.log(' ', JSON.stringify(row)));
} catch (e) { console.log('Q2 error', e.message); }

console.log('\n--- transitions to appt_* and visited - WALKIN team leads only ---');
try {
  const r = await q(`
    SELECT mtv.new_value_char, COUNT(DISTINCT mm.res_id)::int AS distinct_leads, COUNT(*)::int AS total_transitions
    FROM mail_tracking_value mtv
    JOIN ir_model_fields imf ON imf.id = mtv.field_id
    JOIN mail_message mm ON mm.id = mtv.mail_message_id
    JOIN crm_lead l ON l.id = mm.res_id
    WHERE imf.name = 'walkin_call_status' AND imf.model = 'crm.lead'
      AND l.team_id IN (14, 15)
      AND mtv.new_value_char IN ('appointment_fixed_direct', 'appointment_fixed_zoom', 'visited')
      AND mm.create_date >= NOW() - INTERVAL '30 days'
    GROUP BY mtv.new_value_char
  `);
  r.rows.forEach(row => console.log(' ', JSON.stringify(row)));
} catch (e) { console.log('Q3 error', e.message); }

console.log('\n--- Total walkin leads = count of leads with walkin team activity, 30d (try different defs) ---');
try {
  // Maybe 2642 = distinct walkin leads with ANY mail_message in last 30d
  const r = await q(`
    SELECT COUNT(DISTINCT mm.res_id)::int AS n
    FROM mail_message mm
    JOIN crm_lead l ON l.id = mm.res_id
    WHERE mm.model = 'crm.lead'
      AND l.team_id IN (14, 15)
      AND mm.create_date >= NOW() - INTERVAL '30 days'
  `);
  console.log('  Walkin leads w/ any mail_message in 30d:', r.rows[0].n);
} catch (e) { console.log('Q4 error', e.message); }

console.log('\n--- L1/L2 enrolled — count of payment_line rows by enrollment_type and walkin team ---');
const enr = await q(`
  SELECT pl.enrollment_type, pl.line_type, COUNT(*)::int AS n_rows, COUNT(DISTINCT pl.lead_id)::int AS n_leads
  FROM crm_lead_payment_line pl
  JOIN crm_lead l ON l.id = pl.lead_id
  WHERE l.team_id IN (14, 15)
    AND pl.payment_date >= NOW() - INTERVAL '30 days'
  GROUP BY pl.enrollment_type, pl.line_type
  ORDER BY n_rows DESC
`);
enr.rows.forEach(r => console.log(' ', JSON.stringify(r)));

console.log('\n--- All enrollment_type values in walkin team payments (any time) ---');
const all = await q(`
  SELECT pl.enrollment_type, COUNT(*)::int AS n_rows, COUNT(DISTINCT pl.lead_id)::int AS n_leads
  FROM crm_lead_payment_line pl
  JOIN crm_lead l ON l.id = pl.lead_id
  WHERE l.team_id IN (14, 15)
  GROUP BY pl.enrollment_type
  ORDER BY n_rows DESC
`);
all.rows.forEach(r => console.log(' ', JSON.stringify(r)));

process.exit(0);
