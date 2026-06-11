import { q } from '../server/db.js';

console.log('--- distinct walkin_call_status labels in tracking ---');
const r = await q(`
  SELECT mtv.new_value_char, COUNT(*)::int AS n
  FROM mail_tracking_value mtv
  JOIN ir_model_fields imf ON imf.id = mtv.field_id
  WHERE imf.name = 'walkin_call_status' AND imf.model = 'crm.lead'
  GROUP BY mtv.new_value_char
  ORDER BY n DESC
  LIMIT 30
`);
r.rows.forEach(row => console.log(' ', JSON.stringify(row)));

console.log('\n--- transitions to "Appointment Fixed" / "Visited" labels in walkin team, last 30d ---');
const t = await q(`
  SELECT mtv.new_value_char, COUNT(DISTINCT mm.res_id)::int AS distinct_leads, COUNT(*)::int AS transitions
  FROM mail_tracking_value mtv
  JOIN ir_model_fields imf ON imf.id = mtv.field_id
  JOIN mail_message mm ON mm.id = mtv.mail_message_id
  JOIN crm_lead l ON l.id = mm.res_id
  WHERE imf.name = 'walkin_call_status' AND imf.model = 'crm.lead'
    AND l.team_id IN (14,15)
    AND mtv.new_value_char ILIKE '%appointment%'
       OR (imf.name = 'walkin_call_status' AND imf.model = 'crm.lead' AND mtv.new_value_char ILIKE '%visit%')
    AND mm.create_date >= NOW() - INTERVAL '30 days'
  GROUP BY mtv.new_value_char
  ORDER BY transitions DESC
`);
t.rows.forEach(row => console.log(' ', JSON.stringify(row)));

console.log('\n--- precise: appointment/visit transitions team-scoped 30d ---');
const t2 = await q(`
  SELECT mtv.new_value_char,
         COUNT(DISTINCT mm.res_id)::int AS distinct_leads,
         COUNT(*)::int AS transitions
  FROM mail_tracking_value mtv
  JOIN ir_model_fields imf ON imf.id = mtv.field_id
  JOIN mail_message mm ON mm.id = mtv.mail_message_id
  JOIN crm_lead l ON l.id = mm.res_id
  WHERE imf.model = 'crm.lead'
    AND imf.name = 'walkin_call_status'
    AND l.team_id IN (14,15)
    AND mtv.new_value_char IN ('Appointment Fixed - Direct', 'Appointment Fixed - Zoom', 'Visited')
    AND mm.create_date >= NOW() - INTERVAL '30 days'
  GROUP BY mtv.new_value_char
`);
t2.rows.forEach(row => console.log(' ', JSON.stringify(row)));

process.exit(0);
