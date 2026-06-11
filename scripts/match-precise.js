import { q } from '../server/db.js';

console.log('Hunting for: Gayathri "Total new Leads = 8", Team-total 2642, Appt 374, L1=10, L2=104');
console.log();

const G = 255;

// ── A. Gayathri "new leads" = 8 ──
console.log('═══ A. Gayathri "Total new Leads" = 8 ═══');
const tries = [
  ['user_id=G, create_date last 1 day', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=${G} AND team_id IN (14,15) AND create_date >= NOW() - INTERVAL '1 day'`],
  ['user_id=G, create last 3 days', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=${G} AND team_id IN (14,15) AND create_date >= NOW() - INTERVAL '3 days'`],
  ['user_id=G, walkin_call_status=new (current state)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=${G} AND team_id IN (14,15) AND walkin_call_status='new' AND create_date >= NOW() - INTERVAL '30 days'`],
  ['user_id=G, walkin_call_status IS NULL (untouched), 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=${G} AND team_id IN (14,15) AND walkin_call_status IS NULL AND create_date >= NOW() - INTERVAL '30 days'`],
  ['user_id=G, created TODAY', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=${G} AND team_id IN (14,15) AND DATE(create_date AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE`],
  ['user_id=G, created last 12h', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=${G} AND team_id IN (14,15) AND create_date >= NOW() - INTERVAL '12 hours'`],
  ['walkin_visit_summary count for caller_user_id=G last 30d', `SELECT COALESCE(SUM(visit_count),0)::int AS n FROM walkin_visit_summary WHERE caller_user_id=${G} AND date >= NOW() - INTERVAL '30 days'`],
];
for (const [lbl, sql] of tries) {
  const r = await q(sql);
  const n = r.rows[0].n;
  const flag = n === 8 ? '  ← MATCH 8!' : '';
  console.log('  ' + String(n).padStart(6), '·', lbl, flag);
}

// Show all callers' "new leads" candidates side-by-side
console.log('\n═══ A2. Per-caller "new leads (created 30d AND walkin_call_status=new)" ═══');
const callers = [
  ['Prem Kumar', 254, 6], ['Gayathri', 255, 8], ['K . Lavanya', 256, 7],
  ['Pavithra', 265, 2], ['Emilda', 300, 0], ['Pavithra Sakkarai', 193, 0],
];
for (const [name, id, target] of callers) {
  const r = await q(`SELECT
    (SELECT COUNT(*)::int FROM crm_lead WHERE user_id=$1 AND team_id IN (14,15) AND DATE(create_date AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE) AS today_n,
    (SELECT COUNT(*)::int FROM crm_lead WHERE user_id=$1 AND team_id IN (14,15) AND DATE(create_date AT TIME ZONE 'Asia/Kolkata') = CURRENT_DATE - INTERVAL '1 day') AS yest_n,
    (SELECT COUNT(*)::int FROM crm_lead WHERE user_id=$1 AND team_id IN (14,15) AND DATE(create_date AT TIME ZONE 'Asia/Kolkata') >= CURRENT_DATE - INTERVAL '1 day') AS today_yest_n,
    (SELECT COUNT(*)::int FROM crm_lead WHERE user_id=$1 AND team_id IN (14,15) AND create_date >= NOW() - INTERVAL '30 days') AS m30_n
  `, [id]);
  const r2 = r.rows[0];
  console.log(`  ${name.padEnd(22)} (target ${target}): today→${r2.today_n}, yest→${r2.yest_n}, today+yest→${r2.today_yest_n}, 30d→${r2.m30_n}`);
}

// ── B. Team total 2642 ──
console.log('\n═══ B. Total Walkin Leads = 2642 ═══');
const totalTries = [
  ['leads in 30d (created OR last activity)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND (create_date >= NOW() - INTERVAL '30 days' OR write_date >= NOW() - INTERVAL '30 days')`],
  ['leads with create_date >= 2 months ago', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND create_date >= NOW() - INTERVAL '60 days'`],
  ['leads created in current calendar month', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND create_date >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Kolkata')`],
  ['leads created since 1 Apr 2026 (current FY q)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND create_date >= '2026-04-01'`],
  ['leads created last 45 days', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND create_date >= NOW() - INTERVAL '45 days'`],
  ['leads created last 60 days', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND create_date >= NOW() - INTERVAL '60 days'`],
  ['leads (created OR appt_date OR visited_date OR called) last 30d', `SELECT COUNT(DISTINCT id)::int AS n FROM (
    SELECT id FROM crm_lead WHERE team_id IN (14,15) AND create_date >= NOW() - INTERVAL '30 days'
    UNION
    SELECT id FROM crm_lead WHERE team_id IN (14,15) AND walkin_appointment_date >= NOW() - INTERVAL '30 days'
    UNION
    SELECT id FROM crm_lead WHERE team_id IN (14,15) AND visited_date >= NOW() - INTERVAL '30 days'
    UNION
    SELECT DISTINCT scl.lead_id AS id FROM smartflo_call_log scl JOIN crm_lead l ON l.id=scl.lead_id WHERE l.team_id IN (14,15) AND scl.start_time >= NOW() - INTERVAL '30 days'
  ) u`],
];
for (const [lbl, sql] of totalTries) {
  const r = await q(sql);
  const n = r.rows[0].n;
  const flag = Math.abs(n - 2642) <= 20 ? '  ← CLOSE!' : '';
  console.log('  ' + String(n).padStart(6), '·', lbl, flag);
}

// ── C. Appointments Fixed = 374 ──
console.log('\n═══ C. Appointments Fixed = 374 ═══');
const apptTries = [
  ['appointment_date OR appt_request_raised in 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND (walkin_appointment_date >= NOW() - INTERVAL '30 days' OR walkin_appt_request_raised >= NOW() - INTERVAL '30 days')`],
  ['walkin_call_status=appt_* (current) + appt_date in last 60d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_call_status IN ('appointment_fixed_direct','appointment_fixed_zoom') AND walkin_appointment_date IS NOT NULL`],
  ['appt_date set, last 45d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_appointment_date >= NOW() - INTERVAL '45 days'`],
  ['appt_request OR appt_date OR confirm_status, 30d', `SELECT COUNT(DISTINCT id)::int AS n FROM (
    SELECT id FROM crm_lead WHERE team_id IN (14,15) AND walkin_appointment_date >= NOW() - INTERVAL '30 days'
    UNION
    SELECT id FROM crm_lead WHERE team_id IN (14,15) AND walkin_appt_request_raised >= NOW() - INTERVAL '30 days'
  ) u`],
];
for (const [lbl, sql] of apptTries) {
  const r = await q(sql);
  const n = r.rows[0].n;
  const flag = Math.abs(n - 374) <= 20 ? '  ← CLOSE!' : '';
  console.log('  ' + String(n).padStart(6), '·', lbl, flag);
}

// ── D. L1/L2 Enrolled (10, 104) ──
console.log('\n═══ D. L1 = 10, L2 = 104 ═══');
const enrTries = [
  ['L1: payment_line enrollment=l1 last 30d, walkin', `SELECT COUNT(DISTINCT pl.lead_id)::int AS n FROM crm_lead_payment_line pl JOIN crm_lead l ON l.id=pl.lead_id WHERE l.team_id IN (14,15) AND pl.enrollment_type='l1' AND pl.payment_date >= NOW() - INTERVAL '30 days'`],
  ['L1: payment_line enrollment=l1 last 90d', `SELECT COUNT(DISTINCT pl.lead_id)::int AS n FROM crm_lead_payment_line pl JOIN crm_lead l ON l.id=pl.lead_id WHERE l.team_id IN (14,15) AND pl.enrollment_type='l1' AND pl.payment_date >= NOW() - INTERVAL '90 days'`],
  ['L1: l1_access_date set in last 60d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND l1_access_date >= NOW() - INTERVAL '60 days'`],
  ['L1: l1_access_date set in last 90d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND l1_access_date >= NOW() - INTERVAL '90 days'`],
  ['L1: l1_special_offer_amount > 0', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND l1_special_offer_amount > 0 AND write_date >= NOW() - INTERVAL '30 days'`],
  ['L2: payment_line enrollment=l2 last 30d, walkin', `SELECT COUNT(DISTINCT pl.lead_id)::int AS n FROM crm_lead_payment_line pl JOIN crm_lead l ON l.id=pl.lead_id WHERE l.team_id IN (14,15) AND pl.enrollment_type='l2' AND pl.payment_date >= NOW() - INTERVAL '30 days'`],
  ['L2: l2_access_date set last 60d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND l2_access_date >= NOW() - INTERVAL '60 days'`],
  ['L2: l2_access_date set last 90d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND l2_access_date >= NOW() - INTERVAL '90 days'`],
  ['L2: is_l2_fully_paid=true, last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND is_l2_fully_paid=TRUE AND write_date >= NOW() - INTERVAL '30 days'`],
];
for (const [lbl, sql] of enrTries) {
  const r = await q(sql);
  const n = r.rows[0].n;
  console.log('  ' + String(n).padStart(6), '·', lbl);
}

process.exit(0);
