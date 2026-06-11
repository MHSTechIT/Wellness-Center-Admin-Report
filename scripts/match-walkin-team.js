import { q } from '../server/db.js';

console.log('TARGET (your ERP, last 30 days, Walk-in Callers Summary):');
console.log('  Total Walkin Leads: 2642 · Appt Fixed: 374 · Visits: 346 · L1: 10 · L2: 104');
console.log('  Salespersons: Prem Kumar(6), Gayathri(8), K.Lavanya(7), Pavithra(2), Emilda(0), Pavithra Sakkarai(0)');
console.log();

// ── 1. Team membership tables ──
console.log('═══ 1. Team membership tables ═══');
const memTabs = await q(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public'
    AND (table_name LIKE 'crm_team%' OR table_name LIKE 'team_member%' OR table_name LIKE 'sale_team%')
  ORDER BY table_name`);
memTabs.rows.forEach(r => console.log(' ', r.table_name));

// ── 2. crm_team_member rows ──
console.log('\n═══ 2. Members of Walkin Callers Team (id=14) ═══');
try {
  const mem = await q(`SELECT u.id, COALESCE(pr.name, u.login) AS name FROM crm_team_member tm JOIN res_users u ON u.id = tm.user_id JOIN res_partner pr ON pr.id = u.partner_id WHERE tm.crm_team_id = 14 AND tm.active = TRUE`);
  mem.rows.forEach(r => console.log('  id=' + r.id + ' · ' + r.name));
} catch (e) { console.log('  crm_team_member query failed:', e.message); }

console.log('\n═══ 3. Members of Walkin Coach Team (id=15) ═══');
try {
  const mem = await q(`SELECT u.id, COALESCE(pr.name, u.login) AS name FROM crm_team_member tm JOIN res_users u ON u.id = tm.user_id JOIN res_partner pr ON pr.id = u.partner_id WHERE tm.crm_team_id = 15 AND tm.active = TRUE`);
  mem.rows.forEach(r => console.log('  id=' + r.id + ' · ' + r.name));
} catch (e) { console.log('  crm_team_member query failed:', e.message); }

// ── 4. Per-user "new leads" exploration ──
console.log('\n═══ 4. Per-user "new leads" in last 30d (Gayathri=255 → target 8) ═══');
const G = 255;
const v = [
  ['user_id = Gayathri (owned)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE user_id=${G} AND team_id IN (14,15) AND create_date >= NOW() - INTERVAL '30 days'`],
  ['create_uid = Gayathri (created by her)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE create_uid=${G} AND team_id IN (14,15) AND create_date >= NOW() - INTERVAL '30 days'`],
  ['create_uid = Gayathri + walkin teams + created last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE create_uid=${G} AND create_date >= NOW() - INTERVAL '30 days'`],
];
for (const [lbl, sql] of v) {
  const r = await q(sql);
  console.log('  ' + String(r.rows[0].n).padStart(6), '·', lbl);
}

// ── 5. Walkin team-wide totals (target 2642 / 374 / 346 / 10 / 104) ──
console.log('\n═══ 5. Walkin team-wide KPIs (last 30d) ═══');
const kpi = [
  ['Total Walkin Leads (target 2642): leads with create_date last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND create_date >= NOW() - INTERVAL '30 days'`],
  ['Variant: lead in walkin team AND walkin_call_status NOT NULL, last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND create_date >= NOW() - INTERVAL '30 days' AND walkin_call_status IS NOT NULL`],
  ['Variant: leads ever touched on walkin teams, last 30d activity (write_date)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND write_date >= NOW() - INTERVAL '30 days'`],
  ['Variant: walkin leads with any smartflo call in last 30d', `SELECT COUNT(DISTINCT l.id)::int AS n FROM crm_lead l JOIN smartflo_call_log scl ON scl.lead_id=l.id WHERE l.team_id IN (14,15) AND scl.start_time >= NOW() - INTERVAL '30 days'`],
  ['Variant: walkin leads with walkin_appointment_date in last 60 days', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_appointment_date >= NOW() - INTERVAL '60 days'`],
  ['', null],
  ['Appt Fixed (target 374): walkin_call_status IN (appt_*) in last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_call_status IN ('appointment_fixed_direct','appointment_fixed_zoom') AND write_date >= NOW() - INTERVAL '30 days'`],
  ['Appt Fixed: walkin_appointment_date set, last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_appointment_date >= NOW() - INTERVAL '30 days'`],
  ['Appt Fixed: walkin_appt_request_raised set, last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_appt_request_raised >= NOW() - INTERVAL '30 days'`],
  ['', null],
  ['Visits (target 346): visited_date last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND visited_date >= NOW() - INTERVAL '30 days'`],
  ['Visits: walkin_call_status=visited (last 30d updates)', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND walkin_call_status='visited' AND write_date >= NOW() - INTERVAL '30 days'`],
  ['Visits: walkin_visit_summary sum over 30d', `SELECT COALESCE(SUM(visit_count),0)::int AS n FROM walkin_visit_summary WHERE date >= NOW() - INTERVAL '30 days'`],
  ['', null],
  ['L1 Enrolled (target 10): l1_access_date set in last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND l1_access_date >= NOW() - INTERVAL '30 days'`],
  ['L1 Enrolled: payment_line enrollment_type=l1 in last 30d', `SELECT COUNT(DISTINCT pl.lead_id)::int AS n FROM crm_lead_payment_line pl JOIN crm_lead l ON l.id=pl.lead_id WHERE l.team_id IN (14,15) AND pl.enrollment_type='l1' AND pl.payment_date >= NOW() - INTERVAL '30 days'`],
  ['L2 Enrolled (target 104): l2_access_date set last 30d', `SELECT COUNT(*)::int AS n FROM crm_lead WHERE team_id IN (14,15) AND l2_access_date >= NOW() - INTERVAL '30 days'`],
  ['L2 Enrolled: payment enrollment_type=l2 last 30d', `SELECT COUNT(DISTINCT pl.lead_id)::int AS n FROM crm_lead_payment_line pl JOIN crm_lead l ON l.id=pl.lead_id WHERE l.team_id IN (14,15) AND pl.enrollment_type='l2' AND pl.payment_date >= NOW() - INTERVAL '30 days'`],
];
for (const [lbl, sql] of kpi) {
  if (!sql) { console.log(); continue; }
  const r = await q(sql);
  console.log('  ' + String(r.rows[0].n).padStart(6), '·', lbl);
}

process.exit(0);
