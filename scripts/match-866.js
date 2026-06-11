import { q } from '../server/db.js';

console.log('TARGET: 866 (Total Walkin Leads for Gayathri last 30d)');
console.log('TARGET: 154 (Appointments Fixed)');
console.log('TARGET: 17.78% = 154/866 (Conversion Rate)');
console.log();

const tests = [
  // crm_lead ownership-based
  ['leads OWNED, 30d, walkin teams, created_date',
    `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND create_date >= NOW() - INTERVAL '30 days'`],
  ['leads OWNED, write_date in 30d',
    `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND write_date >= NOW() - INTERVAL '30 days'`],

  // call log based
  ['DISTINCT lead_id she called (smartflo, last 30d)',
    `SELECT COUNT(DISTINCT lead_id)::int AS n FROM smartflo_call_log WHERE agent_id=255 AND start_time >= NOW() - INTERVAL '30 days' AND lead_id IS NOT NULL`],
  ['DISTINCT lead_id she called (smartflo, last 60d)',
    `SELECT COUNT(DISTINCT lead_id)::int AS n FROM smartflo_call_log WHERE agent_id=255 AND start_time >= NOW() - INTERVAL '60 days' AND lead_id IS NOT NULL`],
  ['DISTINCT customer_number she called (last 30d)',
    `SELECT COUNT(DISTINCT customer_number)::int AS n FROM smartflo_call_log WHERE agent_id=255 AND start_time >= NOW() - INTERVAL '30 days'`],

  // Union: owned OR called
  ['UNION (owned ∪ called), last 30d',
    `SELECT COUNT(DISTINCT id)::int AS n FROM (
       SELECT id FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND create_date >= NOW() - INTERVAL '30 days'
       UNION
       SELECT lead_id AS id FROM smartflo_call_log WHERE agent_id=255 AND start_time >= NOW() - INTERVAL '30 days' AND lead_id IS NOT NULL
     ) u`],

  // Calendar-based 30 days (Mar 12 .. Apr 12 etc.)
  ['leads owned in current calendar month',
    `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND create_date >= date_trunc('month', NOW())`],
  ['leads owned previous 30 days BY APPOINTMENT date',
    `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND walkin_appointment_date >= NOW() - INTERVAL '30 days'`],

  // SHE was the LAST user to update the lead in the last 30d
  ['leads with last_write_uid = 255, last 30d',
    `SELECT COUNT(*)::int AS n FROM crm_lead WHERE write_uid=255 AND team_id IN (14,15) AND write_date >= NOW() - INTERVAL '30 days'`],

  // Specifically: distinct leads from call_log_summary's total_lead_calls?
  ['SUM(total_lead_calls) - SUM(unique_call_count) … no, just checking',
    `SELECT SUM(total_lead_calls)::int AS n FROM call_log_summary WHERE user_id=255 AND date >= NOW() - INTERVAL '30 days'`],

  // Leads she called via smartflo where lead is in walkin team
  ['Distinct walkin-team leads she called (last 30d, INNER JOIN crm_lead)',
    `SELECT COUNT(DISTINCT scl.lead_id)::int AS n FROM smartflo_call_log scl JOIN crm_lead l ON l.id=scl.lead_id WHERE scl.agent_id=255 AND scl.start_time >= NOW() - INTERVAL '30 days' AND l.team_id IN (14,15)`],
];

for (const [label, sql] of tests) {
  try {
    const r = await q(sql);
    const n = r.rows[0].n;
    const flag = (n === 866 || Math.abs(n - 866) <= 3) ? '  ← MATCH!' : '';
    console.log(' ', String(n).padStart(6), '·', label, flag);
  } catch(e) { console.log('  ERR', label, e.message); }
}

process.exit(0);
