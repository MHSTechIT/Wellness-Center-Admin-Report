import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { callKw } = await import('../server/odoo.js');

const r = await callKw('walkin.team.dashboard', 'get_dashboard_data', [], { from_date: '2026-04-01', to_date: '2026-04-30' });
console.log('ERP — April 2026 (01-04-2026 to 30-04-2026):');
console.log('  total_walkin_leads:', r.total_walkin_leads);
console.log('  appointments_fixed:', r.appointments_fixed);
console.log('  visits_completed:  ', r.visits_completed);
console.log('  l1_enrolled:       ', r.l1_enrolled);
console.log('  l2_enrolled:       ', r.l2_enrolled);
console.log('  conv%:             ', r.appointment_conversion_pct);
console.log('  total_revenue:     ', r.total_revenue);

// Now compare with our SQL count of leads created in April
const { q } = await import('../server/db.js');
const sql = await q(`
  SELECT COUNT(*)::int AS n
  FROM crm_lead l
  WHERE l.team_id IN (14,15)
    AND l.create_date >= '2026-04-01'::date
    AND l.create_date <  '2026-05-01'::date
`);
console.log('\nOur SQL — leads CREATED in April 2026 (walkin teams): ', sql.rows[0].n);

// Try: leads with write_date in April
const sql2 = await q(`
  SELECT COUNT(*)::int AS n
  FROM crm_lead l
  WHERE l.team_id IN (14,15)
    AND l.write_date >= '2026-04-01'::date
    AND l.write_date <  '2026-05-01'::date
`);
console.log('Our SQL — leads UPDATED in April (write_date): ', sql2.rows[0].n);

// Try: distinct leads with any walkin activity in April (call or status)
const sql3 = await q(`
  SELECT COUNT(DISTINCT l.id)::int AS n
  FROM crm_lead l
  WHERE l.team_id IN (14,15)
    AND (
      (l.create_date >= '2026-04-01'::date AND l.create_date < '2026-05-01'::date)
      OR (l.write_date >= '2026-04-01'::date AND l.write_date < '2026-05-01'::date)
      OR (l.walkin_appointment_date >= '2026-04-01'::date AND l.walkin_appointment_date < '2026-05-01'::date)
      OR (l.visited_date >= '2026-04-01'::date AND l.visited_date < '2026-05-01'::date)
    )
`);
console.log('Our SQL — DISTINCT leads with any walkin activity in April:', sql3.rows[0].n);

process.exit(0);
