import { q } from '../server/db.js';

console.log('Hypothesis: ERP KPIs reflect CURRENT pipeline state (no date filter), not 30-day rolling.\n');

// ─── Q1. Per-caller "Total new Leads" = current count of leads in 'new' state ───
console.log('═══ Q1. Per-caller pipeline counts (CURRENT, walkin_call_status=new) ═══');
const callers = [['Prem Kumar',254,6],['Gayathri',255,8],['K . Lavanya',256,7],['Pavithra',265,2],['Emilda',300,0],['Pavithra Sakkarai',193,0]];
for (const [name, id, target] of callers) {
  const r = await q(`SELECT
    (SELECT COUNT(*)::int FROM crm_lead WHERE user_id=$1 AND team_id IN (14,15) AND walkin_call_status='new') AS new_now,
    (SELECT COUNT(*)::int FROM crm_lead WHERE user_id=$1 AND team_id IN (14,15) AND (walkin_call_status='new' OR walkin_call_status IS NULL)) AS new_or_null,
    (SELECT COUNT(*)::int FROM crm_lead WHERE user_id=$1 AND team_id IN (14,15) AND walkin_call_status='new' AND create_date >= NOW() - INTERVAL '30 days') AS new_30d
  `, [id]);
  const r2 = r.rows[0];
  console.log(`  ${name.padEnd(22)} (target ${target}): new_now=${r2.new_now}, new_or_null=${r2.new_or_null}, new_30d=${r2.new_30d}`);
}

// ─── Q2. Team-wide "Total Walkin Leads" CURRENT total ───
console.log('\n═══ Q2. Total Walkin Leads = 2642 (team-wise CURRENT count) ═══');
const total = [
  ['leads in walkin teams, walkin_call_status=new (current)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_call_status='new'`],
  ['leads in walkin teams, status IS NULL or new', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND (walkin_call_status='new' OR walkin_call_status IS NULL)`],
  ['leads in walkin teams, status NOT IN closed-out', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_call_status NOT IN ('not_interested','already_paid','disqualified','no_sugar','dnd','wrong_number','invalid','payment_failed')`],
  ['leads in walkin teams, ACTIVE only', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND active = TRUE`],
  ['walkin leads, lost not won yet (probability < 100 OR is_won=false)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND probability < 100`],
  ['walkin leads created in any time, current pipeline', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND active=TRUE AND walkin_call_status NOT IN ('already_paid','not_interested','disqualified','payment_failed','invalid','dnd','no_sugar_not_interested')`],
];
for (const [lbl, sql] of total) {
  const r = await q(sql);
  const n = r.rows[0].n;
  const flag = Math.abs(n - 2642) <= 50 ? '  ← MATCH!' : '';
  console.log('  ' + String(n).padStart(7), '·', lbl, flag);
}

// ─── Q3. Appointments Fixed = 374 (team-wise CURRENT) ───
console.log('\n═══ Q3. Appointments Fixed = 374 (team-wise CURRENT) ═══');
const appt = [
  ['walkin_call_status IN appt_* (CURRENT, no date)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_call_status IN ('appointment_fixed_direct','appointment_fixed_zoom')`],
  ['CURRENT + appt_date set', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_call_status IN ('appointment_fixed_direct','appointment_fixed_zoom') AND walkin_appointment_date IS NOT NULL`],
  ['appt_date set (no date filter)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_appointment_date IS NOT NULL`],
  ['walkin_appt_confirm_status NOT open', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_appt_confirm_status != 'open' AND walkin_appt_confirm_status IS NOT NULL`],
];
for (const [lbl, sql] of appt) {
  const r = await q(sql);
  const n = r.rows[0].n;
  const flag = Math.abs(n - 374) <= 20 ? '  ← MATCH!' : '';
  console.log('  ' + String(n).padStart(7), '·', lbl, flag);
}

// ─── Visits = 346 (CURRENT walkin_call_status=visited) ───
console.log('\n═══ Visits Completed = 346 (team-wise CURRENT) ═══');
const vis = [
  ['walkin_call_status=visited (CURRENT)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_call_status='visited'`],
  ['visited_date IS NOT NULL (any time)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND visited_date IS NOT NULL`],
  ['walkin_visited_radio=visited', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_visited_radio='visited'`],
];
for (const [lbl, sql] of vis) {
  const r = await q(sql);
  const n = r.rows[0].n;
  const flag = Math.abs(n - 346) <= 20 ? '  ← MATCH!' : '';
  console.log('  ' + String(n).padStart(7), '·', lbl, flag);
}

// ─── L1/L2 enrolled (10 / 104) ───
console.log('\n═══ L1 = 10, L2 = 104 (team-wise paid) ═══');
const l1l2 = [
  ['L1: distinct walkin leads w/ payment enrollment_type=l1 in 30d', `SELECT COUNT(DISTINCT pl.lead_id)::int AS n FROM crm_lead_payment_line pl JOIN crm_lead l ON l.id=pl.lead_id WHERE l.team_id IN (14,15) AND pl.enrollment_type='l1' AND pl.payment_date >= NOW() - INTERVAL '30 days'`],
  ['L1: any time, walkin team', `SELECT COUNT(DISTINCT pl.lead_id)::int AS n FROM crm_lead_payment_line pl JOIN crm_lead l ON l.id=pl.lead_id WHERE l.team_id IN (14,15) AND pl.enrollment_type='l1'`],
  ['L1: payment_date last 30d, ANY lead', `SELECT COUNT(DISTINCT lead_id)::int AS n FROM crm_lead_payment_line WHERE enrollment_type='l1' AND payment_date >= NOW() - INTERVAL '30 days'`],
  ['L1: SUM of leads, payment_date last 30d, walkin', `SELECT COUNT(*)::int AS n FROM crm_lead_payment_line pl JOIN crm_lead l ON l.id=pl.lead_id WHERE l.team_id IN (14,15) AND pl.enrollment_type='l1' AND pl.payment_date >= NOW() - INTERVAL '30 days'`],
  ['L2: distinct walkin leads w/ payment enrollment_type=l2 in 30d', `SELECT COUNT(DISTINCT pl.lead_id)::int AS n FROM crm_lead_payment_line pl JOIN crm_lead l ON l.id=pl.lead_id WHERE l.team_id IN (14,15) AND pl.enrollment_type='l2' AND pl.payment_date >= NOW() - INTERVAL '30 days'`],
  ['L2: any time, walkin team', `SELECT COUNT(DISTINCT pl.lead_id)::int AS n FROM crm_lead_payment_line pl JOIN crm_lead l ON l.id=pl.lead_id WHERE l.team_id IN (14,15) AND pl.enrollment_type='l2'`],
  ['L2: payment_date last 90d, ANY lead', `SELECT COUNT(DISTINCT lead_id)::int AS n FROM crm_lead_payment_line WHERE enrollment_type='l2' AND payment_date >= NOW() - INTERVAL '90 days'`],
];
for (const [lbl, sql] of l1l2) {
  const r = await q(sql);
  const n = r.rows[0].n;
  console.log('  ' + String(n).padStart(7), '·', lbl);
}

process.exit(0);
