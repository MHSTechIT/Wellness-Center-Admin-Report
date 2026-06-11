import { q } from '../server/db.js';

const G = 255;  // Gayathri user_id

console.log('TARGET (from your ERP dashboard) for Gayathri, Last 30 Days:');
console.log('  Total Walkin Leads: 866');
console.log('  Appointments Fixed: 154');
console.log('  Visits Completed (top KPI): 6');
console.log('  Total Calls: 3247, Unique: 2249, Connected: 750, Not-connected: 2497');
console.log('  Total Duration: 1565.63, Avg: 2.09, Appt Fixed: 154, Visits: 38, Pending Followups: 192');
console.log();

// ──────────────────────────────────────────────────────────────────────────
console.log('═══ FROM call_log_summary aggregated for user_id=255, last 30d ═══');
const cs = await q(`
  SELECT
    SUM(total_calls)::int             AS total_calls,
    SUM(unique_call_count)::int       AS unique_calls,
    SUM(total_connected_call_count)::int AS connected,
    SUM(total_duration)::numeric(12,2) AS total_duration,
    SUM(total_lead_calls)::int        AS total_lead_calls
  FROM call_log_summary
  WHERE user_id = $1 AND date >= NOW() - INTERVAL '30 days'`, [G]);
console.log(' ', cs.rows[0]);
const tc = cs.rows[0];
console.log('  Calculated not_connected =', tc.total_calls - tc.connected);
console.log('  Calculated avg_duration  =', tc.connected > 0 ? (tc.total_duration / tc.connected).toFixed(2) : '—');

// Also try seconds / 60 → minutes
console.log('  If duration is in seconds → minutes =', (tc.total_duration / 60).toFixed(2));

console.log();

// ──────────────────────────────────────────────────────────────────────────
console.log('═══ Total Walkin Leads candidates ═══');
const leadCands = [
  ['Leads owned by Gayathri (user_id=255), all-time, walkin teams', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15)`],
  ['Leads owned by Gayathri, last 30d, walkin', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND create_date >= NOW() - INTERVAL '30 days'`],
  ['Distinct leads she CALLED in last 30d (smartflo)', `SELECT COUNT(DISTINCT lead_id)::int AS n FROM smartflo_call_log WHERE agent_id=255 AND start_time >= NOW() - INTERVAL '30 days' AND lead_id IS NOT NULL`],
  ['Distinct lead_ids she called all-time', `SELECT COUNT(DISTINCT lead_id)::int AS n FROM smartflo_call_log WHERE agent_id=255 AND lead_id IS NOT NULL`],
  ['Walkin leads in last 30d total (all users)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND create_date >= NOW() - INTERVAL '30 days'`],
  ['Walkin leads + assigned to Gayathri at any point (via walkin_visit_summary or other)', `SELECT COUNT(DISTINCT l.id)::int AS n FROM crm_lead l WHERE team_id IN (14,15) AND user_id=255`],
];
for (const [label, sql] of leadCands) {
  const r = await q(sql);
  console.log(' ', String(r.rows[0].n).padStart(6), '·', label);
}

console.log();

// ──────────────────────────────────────────────────────────────────────────
console.log('═══ Appointments Fixed candidates ═══');
const apptCands = [
  ['Leads owned by her with walkin_call_status in (appointment_fixed_*)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND walkin_call_status IN ('appointment_fixed_direct','appointment_fixed_zoom')`],
  ['Leads owned by her w/ walkin_appointment_date NOT NULL', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND walkin_appointment_date IS NOT NULL`],
  ['Leads w/ appt date set in last 30d (any user)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_appointment_date >= NOW() - INTERVAL '30 days'`],
  ['Leads owned by her, appt date in last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND walkin_appointment_date >= NOW() - INTERVAL '30 days'`],
  ['Leads she CALLED that have appointment status (any time)', `SELECT COUNT(DISTINCT l.id)::int AS n FROM crm_lead l JOIN smartflo_call_log scl ON scl.lead_id=l.id WHERE scl.agent_id=255 AND scl.start_time >= NOW() - INTERVAL '30 days' AND l.walkin_call_status IN ('appointment_fixed_direct','appointment_fixed_zoom')`],
  ['Leads she touched (via call) with appt_date set, last 30d', `SELECT COUNT(DISTINCT l.id)::int AS n FROM crm_lead l JOIN smartflo_call_log scl ON scl.lead_id=l.id WHERE scl.agent_id=255 AND scl.start_time >= NOW() - INTERVAL '30 days' AND l.walkin_appointment_date IS NOT NULL`],
];
for (const [label, sql] of apptCands) {
  const r = await q(sql);
  console.log(' ', String(r.rows[0].n).padStart(6), '·', label);
}

console.log();

// ──────────────────────────────────────────────────────────────────────────
console.log('═══ Visits Completed candidates ═══');
const visCands = [
  ['Leads owned by her w/ visited status (any time)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND (walkin_call_status='visited' OR walkin_visited_radio='visited' OR visited_date IS NOT NULL)`],
  ['Leads owned by her w/ visited_date in last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=255 AND team_id IN (14,15) AND visited_date >= NOW() - INTERVAL '30 days'`],
  ['Leads she called, visited (any time)', `SELECT COUNT(DISTINCT l.id)::int AS n FROM crm_lead l JOIN smartflo_call_log scl ON scl.lead_id=l.id WHERE scl.agent_id=255 AND (l.walkin_call_status='visited' OR l.visited_date IS NOT NULL)`],
  ['Visits via walkin_visit_summary for caller_user_id=255, last 30d', `SELECT COALESCE(SUM(visit_count),0)::int AS n FROM walkin_visit_summary WHERE caller_user_id=255 AND date >= NOW() - INTERVAL '30 days'`],
];
for (const [label, sql] of visCands) {
  const r = await q(sql);
  console.log(' ', String(r.rows[0].n).padStart(6), '·', label);
}

process.exit(0);
