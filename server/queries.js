/**
 * Builds the heavy aggregation SQL for the dashboard.
 * Read-only. All user input flows through pg parameters ($1, $2 ...).
 *
 * SCOPE: This dashboard is for the Walkin teams only.
 *   - team 14  Walkin Callers Team
 *   - team 15  Walkin Coach Team
 * Every query, every filter dropdown is constrained to these two teams.
 */
import { CHENNAI_PRED, OUTER_PRED, HAS_LOC_PRED } from './locations.js';

// The Walkin Callers tab in Odoo uses domain [('lead_bucket','=','walkin')], NOT team_id.
// Using lead_bucket gives the exact same set the CRM kanban view shows.
export const WALKIN_TEAMS = [14, 15];                        // still used for crm_team_member lookups
const WALKIN_SCOPE_SQL = `l.lead_bucket = 'walkin'`;

/* ─────────────── CANONICAL L1 / L2 / "BOTH" DEFINITIONS ───────────────
 * Single source of truth. Used by:
 *   - the L1/L2 breakdown columns (l1tot/l2tot/l1fp/...)
 *   - the PROGRAM columns (progL1/progL2/progBoth)
 *   - the Program filter (buildWhere / buildPersonQuery / filter-options)
 * so the same lead is classified identically everywhere.
 *
 * A lead is "enrolled" when it has any real payment status.
 * It is "L2" when any L2 signal is present, otherwise "L1".
 * "Both" is a distinct concept: the lead has both L1 and L2 program ACCESS granted.
 */
export const ENROLLED_PRED = `l.payment_status_summary IN ('partial','paid_full','l2_installment','l2_emi')`;
export const L2_SIGNAL_PRED = `(
  l.payment_status_summary IN ('l2_installment','l2_emi')
  OR COALESCE(l.program_suggested,'') = 'l2'
  OR l.l2_access_date IS NOT NULL
  OR COALESCE(l.payment_plan,'') IN ('advance','inst_2','inst_3','emi')
)`;
export const L1_PRED   = `(${ENROLLED_PRED} AND NOT ${L2_SIGNAL_PRED})`;
export const L2_PRED   = `(${ENROLLED_PRED} AND ${L2_SIGNAL_PRED})`;
export const BOTH_PRED = `(l.l1_access_date IS NOT NULL AND l.l2_access_date IS NOT NULL)`;

/* Reusable Program-filter clause builder (no params — predicates are constant) */
function programClause(program) {
  if (program === 'L1')   return L1_PRED;
  if (program === 'L2')   return L2_PRED;
  if (program === 'Both') return BOTH_PRED;
  return null;
}

/* Payment-status filter (matches the Period-view STATUS_COLS predicates exactly so a
 * drill from a count reaches the same set of leads that count represents). */
function paymentClause(payment) {
  switch (payment) {
    case 'enrolled':   return ENROLLED_PRED;
    case 'full_paid':  return `l.payment_status_summary = 'paid_full'`;
    case 'partial':    return `l.payment_status_summary = 'partial'`;
    case 'instalment': return `(l.payment_plan IN ('inst_2','inst_3','installment') OR l.pstatus_inst3 IS NOT NULL)`;
    case 'emi':        return `(l.payment_plan = 'emi' OR l.pstatus_emi IS NOT NULL)`;
    default: return null;
  }
}

/* ─────────────── TIMEZONE ───────────────
 * crm_lead.create_date is `timestamp WITHOUT time zone` holding UTC (Odoo convention).
 * To get the Indian calendar day we must FIRST tag it UTC, THEN convert to IST:
 *     (create_date AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata'
 * The previous code did only `create_date AT TIME ZONE 'Asia/Kolkata'`, which treats the
 * UTC value as if it were already IST and shifts everything by -5:30 — mis-attributing
 * evening leads to the PREVIOUS day. This single expression is now used for BOTH the
 * day-bucketing and the date filter, so they always agree (no boundary drift / orphan buckets).
 */
export const IST_CREATE = "((l.create_date AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')";

const TRUNC = {
  daily:   `date_trunc('day',   ${IST_CREATE})`,
  weekly:  `date_trunc('week',  ${IST_CREATE})`,
  monthly: `date_trunc('month', ${IST_CREATE})`,
  yearly:  `date_trunc('year',  ${IST_CREATE})`,
  custom:  `date_trunc('day',   ${IST_CREATE})`,
};

export const STATUS_COLS = `
  -- INFO columns: most-frequent batch / source / city in the bucket
  MODE() WITHIN GROUP (ORDER BY NULLIF(l.batch_code_full,''))             AS batch,
  MODE() WITHIN GROUP (ORDER BY NULLIF(s.name,''))                        AS src,
  MODE() WITHIN GROUP (ORDER BY NULLIF(TRIM(l.city),''))                  AS loc,
  COUNT(*) FILTER (WHERE l.walkin_call_status='follow_up')                AS fu,
  COUNT(*) FILTER (WHERE l.walkin_call_status='call_back')                AS cb,
  COUNT(*) FILTER (WHERE l.walkin_call_status='line_busy')                AS lb,
  COUNT(*) FILTER (WHERE l.walkin_call_status='rnr')                      AS rnr,
  COUNT(*) FILTER (WHERE l.walkin_call_status='dnd')                      AS dnd,
  COUNT(*) FILTER (WHERE l.walkin_call_status='switched_off')             AS so,
  COUNT(*) FILTER (WHERE l.walkin_call_status='out_of_service')           AS oos,
  COUNT(*) FILTER (WHERE l.walkin_call_status='wrong_number')             AS wn,
  COUNT(*) FILTER (WHERE l.walkin_call_status='new')                      AS "open",
  COUNT(*) FILTER (WHERE l.walkin_call_status IS NULL)                    AS blank,
  COUNT(*) FILTER (WHERE l.walkin_call_status='not_interested')           AS ni,
  COUNT(*) FILTER (WHERE l.walkin_call_status='no_sugar' OR l.sugar_level='no_sugar') AS nosugar,
  -- "Other" call statuses that map to no named column (future_follow_up, not_registered,
  -- invalid, disqualified, confirmed-as-call-status, …) so the breakdown reconciles to Leads.
  COUNT(*) FILTER (WHERE l.walkin_call_status IS NOT NULL AND l.walkin_call_status NOT IN (
    'follow_up','call_back','line_busy','rnr','dnd','switched_off','out_of_service','wrong_number',
    'new','not_interested','no_sugar','already_paid',
    'appointment_fixed_direct','appointment_fixed_zoom','visited'
  )) AS oth,
  COUNT(*) FILTER (WHERE l.walkin_call_status='appointment_fixed_direct') AS "apptD",
  COUNT(*) FILTER (WHERE l.walkin_call_status='appointment_fixed_zoom')   AS "apptZ",
  COUNT(*) FILTER (WHERE l.walkin_appt_confirm_status='confirmed')        AS conf,
  COUNT(*) FILTER (WHERE l.walkin_call_status='visited' OR l.walkin_visited_radio='visited' OR l.visited_date IS NOT NULL) AS vis,
  COUNT(*) FILTER (WHERE l.sugar_level='above_250_sugar_level')           AS "sugarHi",
  COUNT(*) FILTER (WHERE l.sugar_level='150-250_sugar_level')             AS "sugarMid",
  COUNT(*) FILTER (WHERE l.sugar_level='no_sugar')                        AS "sugarNo",
  COUNT(*) FILTER (WHERE ha.haf_status='done')                            AS "hafDone",
  COUNT(*) FILTER (WHERE ha.id IS NOT NULL AND COALESCE(ha.haf_status,'')<>'done') AS "hafPart",
  COUNT(*) FILTER (WHERE ${L1_PRED})   AS "progL1",
  COUNT(*) FILTER (WHERE ${L2_PRED})   AS "progL2",
  COUNT(*) FILTER (WHERE ${BOTH_PRED}) AS "progBoth",
  -- PAYMENT — use crm_lead.payment_status_summary (the lead-level snapshot) which has the right semantics
  COUNT(*) FILTER (WHERE ${ENROLLED_PRED})                               AS enr,
  COUNT(*) FILTER (WHERE l.payment_status_summary = 'paid_full')          AS fp,
  COUNT(*) FILTER (WHERE l.payment_status_summary = 'partial')            AS pp,
  COUNT(*) FILTER (WHERE l.payment_plan IN ('inst_2','inst_3','installment') OR l.pstatus_inst3 IS NOT NULL) AS inst,
  COUNT(*) FILTER (WHERE l.payment_plan = 'emi' OR l.pstatus_emi IS NOT NULL) AS emi,
  COALESCE(SUM(p.revenue), 0)::bigint                                     AS rev,
  -- L1/L2 breakdown — uses the SINGLE canonical L1_PRED / L2_PRED defined above,
  -- so these numbers always reconcile with progL1/progL2 and the Program filter.
  COUNT(*) FILTER (WHERE ${L1_PRED})                                          AS "l1tot",
  COUNT(*) FILTER (WHERE ${L2_PRED})                                          AS "l2tot",
  COUNT(*) FILTER (WHERE ${L1_PRED} AND l.payment_status_summary = 'paid_full') AS "l1fp",
  COUNT(*) FILTER (WHERE ${L1_PRED} AND l.payment_status_summary = 'partial')   AS "l1pp",
  COUNT(*) FILTER (WHERE ${L2_PRED} AND l.payment_status_summary = 'paid_full') AS "l2fp",
  COUNT(*) FILTER (WHERE ${L2_PRED} AND l.payment_status_summary = 'partial')   AS "l2pp",
  COUNT(*) FILTER (WHERE ${CHENNAI_PRED})                                                  AS "loc_chennai",
  COUNT(*) FILTER (WHERE NOT ${CHENNAI_PRED} AND ${OUTER_PRED})                            AS "loc_outer",
  COUNT(*) FILTER (WHERE NOT ${CHENNAI_PRED} AND NOT ${OUTER_PRED} AND ${HAS_LOC_PRED})    AS "loc_other",
  -- REFUND placeholders (no DB source identified yet; payment cancellations could be proxy)
  COUNT(*) FILTER (WHERE l.pstatus_advance='adv_cancelled' OR l.pstatus_emi='emi_cancelled') AS "refundReq",
  0 AS "refundDone",
  -- CONSULTATION (mapped to crm_lead.consultation_status)
  COUNT(*) FILTER (WHERE l.consultation_status='join_immediately')        AS "consWJ",
  COUNT(*) FILTER (WHERE l.consultation_status='this_week')               AS "consTW",
  COUNT(*) FILTER (WHERE l.consultation_status='next_week')               AS "consNW",
  COUNT(*) FILTER (WHERE l.consultation_status='this_month')              AS "consTM",
  COUNT(*) FILTER (WHERE l.consultation_status='queries')                 AS "consQD",
  COUNT(*) FILTER (WHERE l.recording_status='done')                       AS "recDone",
  -- PAYMENT subcategories (mapped to crm_lead.pstatus_* / consultation_status / welcome_kit_status)
  COUNT(*) FILTER (WHERE l.pstatus_advance IN ('adv_paid','adv_bal_pending','adv_full_paid')) AS "adv",
  COUNT(*) FILTER (WHERE l.followup_status='scheduled' OR l.collection_status='promised')     AS "payFU",
  COUNT(*) FILTER (WHERE l.followup_status='dropped' OR l.consultation_status='not_interested') AS "payNI",
  COUNT(*) FILTER (WHERE l.consultation_status='already_paid' OR l.walkin_call_status='already_paid') AS "alrPaid",
  COUNT(*) FILTER (WHERE l.welcome_kit_status='given')                    AS "kitGiven",
  -- REVENUE & ROAS — still no ads-spend in DB; values from a config or external API would go here
  0 AS "spent", 0 AS "roasAll", 0 AS "roasFPPP", 0 AS "roasEnr",
  COUNT(*) FILTER (WHERE l.pstatus_inst3 IS NOT NULL)                     AS "instCnt",
  0 AS "roasInst",
  -- FOLLOW-UP (mapped to paid_feedback_outcome, followup_status, collection_status)
  COUNT(*) FILTER (WHERE l.paid_feedback_outcome IN ('attended','completed')) AS "fbCall",
  COUNT(*) FILTER (WHERE l.followup_status='scheduled')                   AS "fuSched",
  COUNT(*) FILTER (WHERE l.collection_status='payment_collected')         AS "payCol",
  COUNT(*) FILTER (WHERE l.collection_status='service_issues')            AS "svcIssue",
  -- AUDIT
  COUNT(*) FILTER (WHERE l.bdm_audit_score IS NOT NULL AND l.bdm_audit_score <> '') AS "bdmScore",
  COUNT(*) FILTER (WHERE l.team_id = 14 OR LOWER(COALESCE(s.name,'')) LIKE '%walk%') AS chen,
  COUNT(*) FILTER (WHERE l.bdm_audit_status='done')                       AS "selfAudit"
`;

/* Revenue = ONLY real ("actual") payment lines. The table also stores "plan" lines
 * (scheduled/projected amounts, e.g. ₹41k all-time) which must NOT count as revenue.
 * The old code summed every line_type → over-stated revenue. The line_type values in
 * this DB are only 'actual' / 'plan', so the old is_full/is_part/is_emi flags (which
 * looked for 'full_paid'/'part_paid'/'emi') never matched and have been removed; the
 * client view now derives paid status from crm_lead.payment_status_summary instead. */
export const PAID_CTE = `
  WITH paid AS (
    SELECT
      lead_id,
      SUM(amount_paid) FILTER (WHERE line_type = 'actual')::bigint AS revenue,
      BOOL_OR(installment_sequence > 0)   AS is_inst,
      BOOL_OR(enrollment_type = 'l1')     AS is_l1,
      BOOL_OR(enrollment_type = 'l2')     AS is_l2
    FROM crm_lead_payment_line
    GROUP BY lead_id
  )
`;

function buildWhere(filters, paramIdx) {
  const conds = [WALKIN_SCOPE_SQL];  // baseline: only Walkin Callers + Walkin Coach teams
  const params = [];
  let i = paramIdx;
  // Filter by the IST wall-clock timestamp (same expression as the bucketing) so the
  // window boundaries and the day buckets always agree. filters.from / filters.to are
  // normalized by the route handler to a "YYYY-MM-DD HH:MM:SS" IST timestamp, where:
  //   - date-only `to` is expanded to the NEXT day's midnight (exclusive `<`),
  //     preserving the existing "include the whole to-day" semantics, and
  //   - date+time `to` keeps the picked minute (also exclusive `<` — picking
  //     "to 18:00" means up to but not into the 18:00 minute itself).
  if (filters.from) { conds.push(`${IST_CREATE} >= $${i++}::timestamp`); params.push(filters.from); }
  if (filters.to)   { conds.push(`${IST_CREATE} <  $${i++}::timestamp`); params.push(filters.to); }
  if (filters.team_id)  { conds.push(`l.team_id = $${i++}`); params.push(Number(filters.team_id)); }
  // user_id (salesperson) and hc_id both map to l.user_id. If both are set,
  // match EITHER (IN list) instead of ANDing two equalities → always-empty.
  const userIds = [];
  if (filters.user_id) userIds.push(Number(filters.user_id));
  if (filters.hc_id)   userIds.push(Number(filters.hc_id));
  if (userIds.length === 1) { conds.push(`l.user_id = $${i++}`); params.push(userIds[0]); }
  else if (userIds.length > 1) {
    conds.push(`l.user_id IN ($${i}, $${i + 1})`); params.push(userIds[0], userIds[1]); i += 2;
  }
  if (filters.batch)    { conds.push(`l.batch_code_full = $${i++}`); params.push(filters.batch); }
  if (filters.source_id){ conds.push(`l.source_id = $${i++}`); params.push(Number(filters.source_id)); }
  const progSql = programClause(filters.program);
  if (progSql) conds.push(progSql);
  const paySql = paymentClause(filters.payment);
  if (paySql) conds.push(paySql);
  if (filters.search) {
    conds.push(`(l.name ILIKE $${i} OR l.phone ILIKE $${i} OR l.email_from ILIKE $${i})`);
    params.push('%' + filters.search + '%'); i++;
  }
  return { whereSql: conds.length ? 'WHERE ' + conds.join(' AND ') : '', params, nextIdx: i };
}

/* ─────────────── PERIOD VIEW ───────────────
 * LEAD-ONLY aggregation. Calls used to be joined here keyed by lead-day, which silently
 * DROPPED every call made on a day with no walk-in lead. Calls are now fetched separately
 * (buildPeriodCallsQuery) and merged per-bucket in the API layer, so call totals are complete
 * and reconcile to the DB regardless of whether that day had any leads. */
export function buildPeriodQuery(period, filters) {
  const trunc = TRUNC[period] || TRUNC.daily;
  const { whereSql, params } = buildWhere(filters, 1);
  return {
    text: `
      ${PAID_CTE}
      SELECT
        TO_CHAR(${trunc}, 'YYYY-MM-DD') AS bucket,
        COUNT(*) AS leads,
        ${STATUS_COLS}
      FROM crm_lead l
      LEFT JOIN paid p              ON p.lead_id = l.id
      LEFT JOIN crm_lead_health_assessment ha ON ha.lead_id = l.id
      LEFT JOIN utm_source s        ON s.id = l.source_id
      ${whereSql}
      GROUP BY TO_CHAR(${trunc}, 'YYYY-MM-DD')
      ORDER BY 1 DESC
      LIMIT 366
    `,
    params,
  };
}

/* Per-bucket telephony totals for the Period view — COMPLETE for every day in the window.
 *
 * Sourced from `smartflo_call_log` (per-call records with `start_time` timestamps) so the
 * range can be filtered by EXACT hour, not just whole days — picking 08:00–13:00 returns
 * only those hours. (Previously we summed `call_log_summary`, a daily rollup, so any time
 * range that touched a day pulled the whole day. Daily totals between the two sources
 * have been verified identical, so this switch preserves prior numbers while adding
 * time-of-day precision.)
 *
 * `start_time` is timestamp-without-tz holding UTC. To compare to an IST bound we shift
 * by 5h30m (the fixed UTC↔IST offset). For bucketing we add 5h30m before date_trunc so the
 * bucket key reflects the IST calendar day. */
export function buildPeriodCallsQuery(period, filters) {
  const unit = ({ daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year', custom: 'day' })[period] || 'day';
  const params = [];
  let i = 1;
  let fromUtc, toUtc;
  if (filters.from) { fromUtc = `($${i++}::timestamp - INTERVAL '5 hours 30 minutes')`; params.push(filters.from); }
  else fromUtc = `(NOW() - INTERVAL '30 days')`;
  if (filters.to)   { toUtc   = `($${i++}::timestamp - INTERVAL '5 hours 30 minutes')`; params.push(filters.to); }
  else toUtc = `NOW()`;
  return {
    text: `
      SELECT
        TO_CHAR(date_trunc('${unit}', start_time + INTERVAL '5 hours 30 minutes'), 'YYYY-MM-DD') AS bucket,
        COUNT(*)::int                                       AS tc,
        COUNT(DISTINCT customer_number)::int                AS uc,
        COUNT(*) FILTER (WHERE call_connected = TRUE)::int  AS cc,
        COUNT(*) FILTER (WHERE direction = 'inbound')::int  AS ic,
        COUNT(*) FILTER (WHERE direction = 'outbound')::int AS oc,
        COALESCE(SUM(duration), 0)::double precision        AS dur_sec
      FROM smartflo_call_log
      WHERE start_time >= ${fromUtc} AND start_time < ${toUtc}
        AND agent_id IN (
          SELECT user_id FROM crm_team_member
          WHERE crm_team_id IN (${WALKIN_TEAMS.join(',')}) AND active = TRUE
        )
      GROUP BY 1
    `,
    params,
  };
}

/* ─────────────── PERSON VIEW (salesperson / HC) ─────────────── */
export function buildPersonQuery(filters) {
  // Person view rows come from team membership (so users with 0 leads still appear).
  // Lead-side metrics are aggregated per user_id within the date window.
  // Params: $1=from-timestamp (inclusive), $2=to-timestamp (EXCLUSIVE — date-only
  // `to` was already expanded to next-day midnight by the route, datetime keeps
  // the picked minute), then optional $3=user filter, then lead-side filters.
  const params = [filters.from, filters.to];
  let idx = 3;

  // Optional user filter (drives both the members CTE and the lead aggregation).
  // user_id (salesperson) + hc_id both map to res_users.id / l.user_id → match EITHER.
  let userClause = '';
  let leadUserClause = '';
  const pUserIds = [];
  if (filters.user_id) pUserIds.push(Number(filters.user_id));
  if (filters.hc_id)   pUserIds.push(Number(filters.hc_id));
  if (pUserIds.length === 1) {
    userClause = `AND u.id = $${idx}`;
    leadUserClause = `l.user_id = $${idx}`;
    params.push(pUserIds[0]); idx++;
  } else if (pUserIds.length > 1) {
    userClause = `AND u.id IN ($${idx}, $${idx + 1})`;
    leadUserClause = `l.user_id IN ($${idx}, $${idx + 1})`;
    params.push(pUserIds[0], pUserIds[1]); idx += 2;
  }

  // Other lead-side filters. $2 is already an EXCLUSIVE upper bound (see params doc above).
  const leadConds = [WALKIN_SCOPE_SQL, `${IST_CREATE} >= $1::timestamp`, `${IST_CREATE} <  $2::timestamp`];
  if (leadUserClause) leadConds.push(leadUserClause);
  if (filters.team_id)   { leadConds.push(`l.team_id = $${idx}`); params.push(Number(filters.team_id)); idx++; }
  if (filters.batch)     { leadConds.push(`l.batch_code_full = $${idx}`); params.push(filters.batch); idx++; }
  if (filters.source_id) { leadConds.push(`l.source_id = $${idx}`); params.push(Number(filters.source_id)); idx++; }
  const pProgSql = programClause(filters.program);
  if (pProgSql) leadConds.push(pProgSql);
  if (filters.search) {
    leadConds.push(`(l.name ILIKE $${idx} OR l.phone ILIKE $${idx} OR l.email_from ILIKE $${idx})`);
    params.push('%' + filters.search + '%'); idx++;
  }
  const leadWhere = 'WHERE ' + leadConds.join(' AND ');

  return {
    text: `
      ${PAID_CTE},
      lead_stats AS (
        SELECT
          l.user_id AS person_id,
          COUNT(*) AS leads,
          ${STATUS_COLS}
        FROM crm_lead l
        LEFT JOIN paid p ON p.lead_id = l.id
        LEFT JOIN crm_lead_health_assessment ha ON ha.lead_id = l.id
        LEFT JOIN utm_source s ON s.id = l.source_id
        ${leadWhere}
        GROUP BY l.user_id
      ),
      -- Per-call source (smartflo_call_log.start_time) so telephony respects EXACT
      -- time-of-day, not just whole days. start_time stores UTC in a timestamp-without-tz
      -- column; $1/$2 are IST bounds, so we subtract the fixed 5h30m offset.
      calls AS (
        SELECT
          agent_id AS user_id,
          COUNT(*)::int                                       AS tc,
          COUNT(DISTINCT customer_number)::int                AS uc,
          COUNT(*) FILTER (WHERE call_connected = TRUE)::int  AS cc,
          COUNT(*) FILTER (WHERE direction = 'inbound')::int  AS ic,
          COUNT(*) FILTER (WHERE direction = 'outbound')::int AS oc,
          COALESCE(SUM(duration), 0)::double precision        AS dur_sec
        FROM smartflo_call_log
        WHERE start_time >= ($1::timestamp - INTERVAL '5 hours 30 minutes')
          AND start_time <  ($2::timestamp - INTERVAL '5 hours 30 minutes')
          AND agent_id IS NOT NULL
        GROUP BY agent_id
      ),
      called_leads AS (
        SELECT
          agent_id AS user_id,
          COUNT(DISTINCT customer_number)::int AS leads_called
        FROM smartflo_call_log
        WHERE start_time >= ($1::timestamp - INTERVAL '5 hours 30 minutes')
          AND start_time <  ($2::timestamp - INTERVAL '5 hours 30 minutes')
          AND agent_id IS NOT NULL
        GROUP BY agent_id
      ),
      -- Action-based attribution: transitions tracked by mail_tracking_value.
      -- mail_message.create_date is UTC; shift the IST bounds by 5h30m for the comparison.
      transitions AS (
        SELECT
          mm.create_uid AS user_id,
          COUNT(*) FILTER (WHERE mtv.new_value_char IN ('Appointment Fixed - Direct','Appointment Fixed - Zoom')) AS appt_fix_action,
          COUNT(*) FILTER (WHERE mtv.new_value_char = 'Visited')   AS visited_action,
          COUNT(*) FILTER (WHERE mtv.new_value_char = 'Confirmed') AS confirmed_action
        FROM mail_tracking_value mtv
        JOIN ir_model_fields imf ON imf.id = mtv.field_id
        JOIN mail_message mm     ON mm.id = mtv.mail_message_id
        JOIN crm_lead l          ON l.id = mm.res_id
        WHERE imf.name = 'walkin_call_status' AND imf.model = 'crm.lead'
          AND l.lead_bucket = 'walkin'
          AND mm.create_date >= ($1::timestamp - INTERVAL '5 hours 30 minutes')
          AND mm.create_date <  ($2::timestamp - INTERVAL '5 hours 30 minutes')
        GROUP BY mm.create_uid
      ),
      -- Current pipeline: leads still in 'new' state per user (NOT date-filtered)
      new_pipeline AS (
        SELECT user_id, COUNT(*)::int AS new_pipeline
        FROM crm_lead
        WHERE lead_bucket = 'walkin' AND walkin_call_status = 'new'
        GROUP BY user_id
      ),
      members AS (
        SELECT DISTINCT u.id AS user_id, COALESCE(pr.name, u.login, '—') AS person_name,
               COALESCE(u.is_health_coach_user, FALSE) AS is_hc
        FROM crm_team_member tm
        JOIN res_users    u  ON u.id = tm.user_id
        JOIN res_partner  pr ON pr.id = u.partner_id
        WHERE tm.crm_team_id IN (14,15) AND tm.active = TRUE AND u.active = TRUE
              ${userClause}
      )
      SELECT
        m.user_id                            AS person_id,
        m.person_name                        AS person_name,
        m.is_hc                              AS is_hc,
        ls.batch                             AS batch,
        ls.src                               AS src,
        ls.loc                               AS loc,
        COALESCE(ls.leads, 0)                AS leads,
        COALESCE(ls.fu, 0)                   AS fu,
        COALESCE(ls.cb, 0)                   AS cb,
        COALESCE(ls.lb, 0)                   AS lb,
        COALESCE(ls.rnr, 0)                  AS rnr,
        COALESCE(ls.dnd, 0)                  AS dnd,
        COALESCE(ls.so, 0)                   AS so,
        COALESCE(ls.oos, 0)                  AS oos,
        COALESCE(ls.wn, 0)                   AS wn,
        COALESCE(ls."open", 0)               AS "open",
        COALESCE(ls.blank, 0)                AS blank,
        COALESCE(ls.ni, 0)                   AS ni,
        COALESCE(ls.nosugar, 0)              AS nosugar,
        COALESCE(ls.oth, 0)                  AS oth,
        COALESCE(ls."apptD", 0)              AS "apptD",
        COALESCE(ls."apptZ", 0)              AS "apptZ",
        COALESCE(ls.conf, 0)                 AS conf,
        COALESCE(ls.vis, 0)                  AS vis,
        COALESCE(ls."sugarHi", 0)            AS "sugarHi",
        COALESCE(ls."sugarMid", 0)           AS "sugarMid",
        COALESCE(ls."sugarNo", 0)            AS "sugarNo",
        COALESCE(ls."hafDone", 0)            AS "hafDone",
        COALESCE(ls."hafPart", 0)            AS "hafPart",
        COALESCE(ls."progL1", 0)             AS "progL1",
        COALESCE(ls."progL2", 0)             AS "progL2",
        COALESCE(ls."progBoth", 0)           AS "progBoth",
        COALESCE(ls.enr, 0)                  AS enr,
        COALESCE(ls.fp, 0)                   AS fp,
        COALESCE(ls.pp, 0)                   AS pp,
        COALESCE(ls.inst, 0)                 AS inst,
        COALESCE(ls.emi, 0)                  AS emi,
        COALESCE(ls.rev, 0)                  AS rev,
        COALESCE(ls."l1tot", 0)              AS "l1tot",
        COALESCE(ls."l2tot", 0)              AS "l2tot",
        COALESCE(ls.chen, 0)                 AS chen,
        COALESCE(ls."selfAudit", 0)          AS "selfAudit",
        -- Columns computed in lead_stats (STATUS_COLS) but previously not projected → were blank.
        COALESCE(ls."l1fp", 0)               AS "l1fp",
        COALESCE(ls."l1pp", 0)               AS "l1pp",
        COALESCE(ls."l2fp", 0)               AS "l2fp",
        COALESCE(ls."l2pp", 0)               AS "l2pp",
        COALESCE(ls."consWJ", 0)             AS "consWJ",
        COALESCE(ls."consTW", 0)             AS "consTW",
        COALESCE(ls."consNW", 0)             AS "consNW",
        COALESCE(ls."consTM", 0)             AS "consTM",
        COALESCE(ls."consQD", 0)             AS "consQD",
        COALESCE(ls."recDone", 0)            AS "recDone",
        COALESCE(ls."adv", 0)                AS "adv",
        COALESCE(ls."payFU", 0)              AS "payFU",
        COALESCE(ls."payNI", 0)              AS "payNI",
        COALESCE(ls."alrPaid", 0)            AS "alrPaid",
        COALESCE(ls."kitGiven", 0)           AS "kitGiven",
        COALESCE(ls."instCnt", 0)            AS "instCnt",
        COALESCE(ls."spent", 0)              AS "spent",
        COALESCE(ls."roasAll", 0)            AS "roasAll",
        COALESCE(ls."roasFPPP", 0)           AS "roasFPPP",
        COALESCE(ls."roasEnr", 0)            AS "roasEnr",
        COALESCE(ls."roasInst", 0)           AS "roasInst",
        COALESCE(ls."fbCall", 0)             AS "fbCall",
        COALESCE(ls."fuSched", 0)            AS "fuSched",
        COALESCE(ls."payCol", 0)             AS "payCol",
        COALESCE(ls."svcIssue", 0)           AS "svcIssue",
        COALESCE(ls."bdmScore", 0)           AS "bdmScore",
        COALESCE(ls."loc_chennai", 0)        AS "loc_chennai",
        COALESCE(ls."loc_outer", 0)          AS "loc_outer",
        COALESCE(ls."loc_other", 0)          AS "loc_other",
        COALESCE(ls."refundReq", 0)          AS "refundReq",
        COALESCE(ls."refundDone", 0)         AS "refundDone",
        COALESCE(c.tc, 0)                    AS "totalCalls",
        COALESCE(c.uc, 0)                    AS "uniqueCalls",
        COALESCE(c.cc, 0)                    AS "connCalls",
        COALESCE(c.tc - c.cc, 0)             AS "notConnCalls",
        COALESCE(c.ic, 0)                    AS "inCalls",
        COALESCE(c.oc, 0)                    AS "outCalls",
        COALESCE(ROUND((c.dur_sec / 60.0)::numeric, 1), 0) AS "totalDurMin",
        CASE WHEN COALESCE(c.cc,0) > 0
             THEN ROUND((c.dur_sec / 60.0 / c.cc)::numeric, 2)
             ELSE 0 END                      AS "avgDurMin",
        COALESCE(cl.leads_called, 0)         AS "leadsCalled",
        COALESCE(np.new_pipeline, 0)         AS "newPipeline",
        COALESCE(tr.appt_fix_action, 0)::int AS "apptAction",
        COALESCE(tr.visited_action, 0)::int  AS "visitedAction",
        COALESCE(tr.confirmed_action, 0)::int AS "confirmedAction"
      FROM members m
      LEFT JOIN lead_stats    ls ON ls.person_id = m.user_id
      LEFT JOIN calls         c  ON c.user_id   = m.user_id
      LEFT JOIN called_leads  cl ON cl.user_id  = m.user_id
      LEFT JOIN new_pipeline  np ON np.user_id  = m.user_id
      LEFT JOIN transitions   tr ON tr.user_id  = m.user_id
      ORDER BY "totalCalls" DESC NULLS LAST, leads DESC NULLS LAST
      LIMIT 100
    `,
    params,
  };
}

/* ─────────────── CLIENT VIEW (one row per lead) ─────────────── */
export function buildClientQuery(filters) {
  const { whereSql, params, nextIdx } = buildWhere(filters, 1);
  return {
    text: `
      ${PAID_CTE}
      SELECT
        l.id, l.name, l.phone, l.create_date,
        l.walkin_call_status, l.walkin_appt_confirm_status,
        l.sugar_level, l.haf_status, l.batch_code_full,
        l.visited_date, l.l1_access_date, l.l2_access_date, l.bdm_audit_score,
        l.payment_status_summary, l.city,
        COALESCE(pr.name, '—') AS salesperson,
        COALESCE(s.name, '—')  AS source,
        COALESCE(t.name->>'en_US', t.name->>'en_IN') AS team,
        (${CHENNAI_PRED}) AS is_chennai,
        (${OUTER_PRED})   AS is_outer,
        (${HAS_LOC_PRED}) AS has_loc,
        p.revenue, p.is_inst, p.is_l1, p.is_l2
      FROM crm_lead l
      LEFT JOIN paid       p  ON p.lead_id = l.id
      LEFT JOIN res_users  u  ON u.id  = l.user_id
      LEFT JOIN res_partner pr ON pr.id = u.partner_id
      LEFT JOIN utm_source s  ON s.id  = l.source_id
      LEFT JOIN crm_team   t  ON t.id  = l.team_id
      ${whereSql}
      ORDER BY l.create_date DESC
      LIMIT $${nextIdx}
    `,
    params: [...params, Math.min(Number(filters.limit) || 1000, 2000)],
  };
}

/* True (uncapped) count of leads matching the Client-view filters — so the UI can show
 * "showing N of TOTAL" instead of letting the row cap masquerade as the total. */
export function buildClientCountQuery(filters) {
  const { whereSql, params } = buildWhere(filters, 1);
  return {
    text: `SELECT COUNT(*)::int AS n FROM crm_lead l ${whereSql}`,
    params,
  };
}

/* ─────────────── Per-user LOCATION breakdown (Chennai / Outer / Other) ───────────────
 * Used to enrich the Person view (which is sourced from the ERP payload that
 * doesn't include geo). Uses the same predicates as the Period view.
 */
export function buildLocationByUserQuery({ from_date, to_date, batch } = {}) {
  const conds = [`l.lead_bucket = 'walkin'`];
  const params = [];
  let i = 1;
  if (from_date) { conds.push(`l.create_date >= $${i++}`); params.push(from_date); }
  if (to_date)   { conds.push(`l.create_date <  $${i++}`); params.push(to_date); }
  if (batch)     { conds.push(`l.batch_code_full = $${i++}`); params.push(batch); }
  return {
    text: `
      SELECT
        l.user_id AS user_id,
        COUNT(*) FILTER (WHERE ${CHENNAI_PRED})                                          AS loc_chennai,
        COUNT(*) FILTER (WHERE NOT ${CHENNAI_PRED} AND ${OUTER_PRED})                    AS loc_outer,
        COUNT(*) FILTER (WHERE NOT ${CHENNAI_PRED} AND NOT ${OUTER_PRED} AND ${HAS_LOC_PRED}) AS loc_other,
        MODE() WITHIN GROUP (ORDER BY NULLIF(l.batch_code_full,'')) AS batch,
        MODE() WITHIN GROUP (ORDER BY NULLIF(TRIM(l.city),''))      AS loc
      FROM crm_lead l
      WHERE ${conds.join(' AND ')}
      GROUP BY l.user_id`,
    params,
  };
}

/* ─────────────── FILTER OPTIONS (all Walkin-scoped, cascade-aware) ─────────────── */
/**
 * Returns 5 dropdowns (teams, salespersons, healthCoaches, sources, batches).
 * Each list is filtered by the OTHER current selections so the dropdowns
 * narrow as the user makes choices — bidirectional cascade.
 */
export function buildFilterOptionsQueries(filters = {}) {
  const TEAMS = WALKIN_TEAMS.join(',');

  // Build a reusable "lead context" WHERE clause excluding one dimension at a time.
  // exclude = which filter to NOT apply (so its list is computed independently)
  // NOTE: no hidden `batch ILIKE 'DW%'` scope here — dropdown options now reflect
  // the SAME population the report queries use (was a silent inconsistency).
  function leadCtx(exclude) {
    const conds = [`l.lead_bucket = 'walkin'`];
    const params = [];
    let i = 1;
    if (exclude !== 'batch'   && filters.batch)    { conds.push(`l.batch_code_full = $${i++}`); params.push(filters.batch); }
    if (exclude !== 'team'    && filters.team_id)  { conds.push(`l.team_id = $${i++}`);          params.push(Number(filters.team_id)); }
    // salesperson + HC both map to l.user_id → match EITHER (avoids empty lists)
    const uIds = [];
    if (exclude !== 'user' && filters.user_id) uIds.push(Number(filters.user_id));
    if (exclude !== 'hc'   && filters.hc_id)   uIds.push(Number(filters.hc_id));
    if (uIds.length === 1) { conds.push(`l.user_id = $${i++}`); params.push(uIds[0]); }
    else if (uIds.length > 1) { conds.push(`l.user_id IN ($${i}, $${i + 1})`); params.push(uIds[0], uIds[1]); i += 2; }
    if (exclude !== 'source'  && filters.source_id){ conds.push(`l.source_id = $${i++}`);        params.push(Number(filters.source_id)); }
    if (exclude !== 'program') {
      const pc = programClause(filters.program);
      if (pc) conds.push(pc);
    }
    return { where: 'WHERE ' + conds.join(' AND '), params };
  }

  const sourcesCtx   = leadCtx('source');
  const batchesCtx   = leadCtx('batch');

  // People/team dropdowns list EVERY active member of the Walk-in teams — NOT only those who
  // already have leads — so any salesperson/HC/team is always selectable as a filter (e.g. to
  // confirm a zero result). Not narrowed by the Team filter, because HC/caller membership in
  // crm_team_member doesn't cleanly split across the two teams (would otherwise blank the list).
  const teamScope = `IN (${TEAMS})`;

  return {
    teams: {
      text: `
        SELECT t.id, COALESCE(t.name->>'en_US', t.name->>'en_IN') AS name
        FROM crm_team t
        WHERE t.id IN (${TEAMS})
        ORDER BY t.id`,
      params: [],
    },

    // Salespersons = ALL active members of the Walk-in teams not flagged as HC.
    salespersons: {
      text: `
        SELECT DISTINCT u.id, COALESCE(pr.name, u.login) AS name
        FROM crm_team_member tm
        JOIN res_users u    ON u.id = tm.user_id
        JOIN res_partner pr ON pr.id = u.partner_id
        WHERE tm.crm_team_id ${teamScope}
          AND tm.active = TRUE AND u.active = TRUE AND u.share = FALSE
          AND COALESCE(u.is_health_coach_user, FALSE) = FALSE
        ORDER BY name`,
      params: [],
    },

    // Health Coaches = ALL active members of the Walk-in teams flagged as HC.
    healthCoaches: {
      text: `
        SELECT DISTINCT u.id, COALESCE(pr.name, u.login) AS name
        FROM crm_team_member tm
        JOIN res_users u    ON u.id = tm.user_id
        JOIN res_partner pr ON pr.id = u.partner_id
        WHERE tm.crm_team_id ${teamScope}
          AND tm.active = TRUE AND u.active = TRUE
          AND u.is_health_coach_user = TRUE
        ORDER BY name`,
      params: [],
    },

    sources: {
      text: `
        SELECT s.id, s.name
        FROM utm_source s
        WHERE EXISTS (SELECT 1 FROM crm_lead l ${sourcesCtx.where} AND l.source_id = s.id)
        ORDER BY s.name`,
      params: sourcesCtx.params,
    },

    batches: {
      text: `
        SELECT l.batch_code_full AS code, COUNT(*)::bigint AS leads
        FROM crm_lead l
        ${batchesCtx.where}
          AND l.batch_code_full IS NOT NULL AND l.batch_code_full <> ''
        GROUP BY l.batch_code_full
        ORDER BY l.batch_code_full ASC`,
      params: batchesCtx.params,
    },
  };
}
