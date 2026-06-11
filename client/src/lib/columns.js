/**
 * Column schema for the dashboard.
 * Groups + columns mirror the original MHS Admin Report spec.
 * Items marked "(no data source)" return 0 until the source is identified.
 */
export const COLS = [
  /* ── INFO ── */
  { k:'period',  l:'Period / Name', g:'INFO',  gc:'g-info', always:true, sticky:'sl' },
  { k:'leads',   l:'Leads',         g:'INFO',  gc:'g-info', always:true, sticky:'sl2' },
  { k:'batch',   l:'Batch',         g:'INFO',  gc:'g-info' },
  { k:'src',     l:'Lead Source',   g:'INFO',  gc:'g-info' },
  { k:'loc',     l:'Location',      g:'INFO',  gc:'g-info' },

  /* ── CALL STATUS (Blank removed per spec) ── */
  { k:'fu',      l:'Follow Up',     g:'CALL STATUS', gc:'g-call', tag:'tp' },
  { k:'cb',      l:'Call Back',     g:'CALL STATUS', gc:'g-call' },
  { k:'lb',      l:'Line Busy',     g:'CALL STATUS', gc:'g-call' },
  { k:'rnr',     l:'RNR',           g:'CALL STATUS', gc:'g-call' },
  { k:'dnd',     l:'DND',           g:'CALL STATUS', gc:'g-call', tag:'tr' },
  { k:'so',      l:'Switched Off',  g:'CALL STATUS', gc:'g-call' },
  { k:'oos',     l:'Out of Svc',    g:'CALL STATUS', gc:'g-call' },
  { k:'wn',      l:'W/N',           g:'CALL STATUS', gc:'g-call' },
  { k:'open',    l:'Open',          g:'CALL STATUS', gc:'g-call', tag:'ta' },
  { k:'ni',      l:'Not Int.',      g:'CALL STATUS', gc:'g-call', tag:'tr' },
  { k:'nosugar', l:'No Sugar',      g:'CALL STATUS', gc:'g-call', tag:'ta' },
  { k:'oth',     l:'Invalid',       g:'CALL STATUS', gc:'g-call', tag:'ta' },
  // "Dispositioned" = count of leads summed across call-status dispositions (NOT phone calls).
  // Renamed from "Total Calls" to avoid clashing with the TELEPHONY "Total Calls" (phone calls).
  { k:'callTot', l:'Dispositioned', g:'CALL STATUS', gc:'g-call' },

  /* ── APPOINTMENTS (Appt Conf. Status removed per spec) ── */
  { k:'apptD',   l:'Appt Direct',   g:'APPOINTMENTS', gc:'g-appt', tag:'tg' },
  { k:'apptZ',   l:'Appt Zoom',     g:'APPOINTMENTS', gc:'g-appt', tag:'tb' },
  { k:'apptTot', l:'Total Appt',    g:'APPOINTMENTS', gc:'g-appt' },
  { k:'conf',    l:'Confirmed',     g:'APPOINTMENTS', gc:'g-appt', tag:'tg' },
  { k:'vis',     l:'Visited',       g:'APPOINTMENTS', gc:'g-appt', tag:'tg' },

  /* ── HEALTH PROFILE (HAF Done / HAF Partial removed per spec) ── */
  { k:'sugarHi', l:'Sugar >250',    g:'HEALTH PROFILE', gc:'g-health' },
  { k:'sugarMid',l:'Sugar 150-250', g:'HEALTH PROFILE', gc:'g-health' },
  { k:'sugarNo', l:'No Sugar',      g:'HEALTH PROFILE', gc:'g-health' },

  /* ── CONSULTATION (no data source yet — placeholders) ── */
  { k:'consWJ',  l:'Will Join',     g:'CONSULTATION', gc:'g-cons' },
  { k:'consTW',  l:'This Week',     g:'CONSULTATION', gc:'g-cons' },
  { k:'consNW',  l:'Next Week',     g:'CONSULTATION', gc:'g-cons' },
  { k:'consTM',  l:'This Month',    g:'CONSULTATION', gc:'g-cons' },
  { k:'consQD',  l:'Queries',       g:'CONSULTATION', gc:'g-cons' },
  { k:'recDone', l:'Recording Done',g:'CONSULTATION', gc:'g-cons' },

  /* ── PROGRAM (Date of Joining removed per spec) ── */
  { k:'progL1',  l:'L1 Count',      g:'PROGRAM', gc:'g-prog' },
  { k:'progL2',  l:'L2 Count',      g:'PROGRAM', gc:'g-prog' },
  { k:'progBoth',l:'Both Count',    g:'PROGRAM', gc:'g-prog' },

  /* ── PAYMENT (Advance / Pay Follow Up / Pay Not Int / Alr. Paid / Kit Given — placeholders for missing data) ── */
  { k:'enr',     l:'Enrolled',      g:'PAYMENT', gc:'g-pay', tag:'tg' },
  { k:'fp',      l:'Full Paid',     g:'PAYMENT', gc:'g-pay', tag:'tg' },
  { k:'pp',      l:'Part Paid',     g:'PAYMENT', gc:'g-pay', tag:'ta' },
  { k:'inst',    l:'Instalment',    g:'PAYMENT', gc:'g-pay', tag:'tb' },
  { k:'emi',     l:'EMI',           g:'PAYMENT', gc:'g-pay', tag:'tb' },
  { k:'adv',     l:'Advance',       g:'PAYMENT', gc:'g-pay' },
  { k:'payFU',   l:'Pay Follow Up', g:'PAYMENT', gc:'g-pay' },
  { k:'payNI',   l:'Pay Not Int.',  g:'PAYMENT', gc:'g-pay' },
  { k:'alrPaid', l:'Alr. Paid',     g:'PAYMENT', gc:'g-pay' },
  { k:'kitGiven',l:'Kit Given',     g:'PAYMENT', gc:'g-pay' },

  /* ── REVENUE & ROAS (FP/PP > 500 Cnt removed per spec) ── */
  { k:'rev',     l:'Revenue (₹)',   g:'REVENUE & ROAS', gc:'g-roas', isRev:true },
  { k:'spent',   l:'Ads Spent (₹)', g:'REVENUE & ROAS', gc:'g-roas', isRev:true },
  { k:'roasAll', l:'ROAS Overall',  g:'REVENUE & ROAS', gc:'g-roas', isRoas:true },
  { k:'roasFPPP',l:'ROAS FP/PP',    g:'REVENUE & ROAS', gc:'g-roas', isRoas:true },
  { k:'roasEnr', l:'ROAS Enrolled', g:'REVENUE & ROAS', gc:'g-roas', isRoas:true },
  { k:'instCnt', l:'Inst. Count',   g:'REVENUE & ROAS', gc:'g-roas' },
  { k:'roasInst',l:'ROAS Inst.',    g:'REVENUE & ROAS', gc:'g-roas', isRoas:true },

  /* ── L1/L2 BREAKDOWN ── */
  { k:'l1fp',    l:'L1 FP',         g:'L1/L2 BREAKDOWN', gc:'g-l1l2' },
  { k:'l1pp',    l:'L1 PP',         g:'L1/L2 BREAKDOWN', gc:'g-l1l2' },
  { k:'l1tot',   l:'L1 Total',      g:'L1/L2 BREAKDOWN', gc:'g-l1l2' },
  { k:'l2fp',    l:'L2 FP',         g:'L1/L2 BREAKDOWN', gc:'g-l1l2' },
  { k:'l2pp',    l:'L2 PP',         g:'L1/L2 BREAKDOWN', gc:'g-l1l2' },
  { k:'l2tot',   l:'L2 Total',      g:'L1/L2 BREAKDOWN', gc:'g-l1l2' },

  /* ── CONVERSION METRICS ── */
  { k:'m_l2a',   l:'Lead→Appt %',   g:'CONVERSION METRICS', gc:'g-metric', isPct:true },
  { k:'m_a2v',   l:'Appt→Visit %',  g:'CONVERSION METRICS', gc:'g-metric', isPct:true },
  { k:'m_v2e',   l:'Visit→Enrol %', g:'CONVERSION METRICS', gc:'g-metric', isPct:true },
  { k:'m_v2fp',  l:'Visit→FP %',    g:'CONVERSION METRICS', gc:'g-metric', isPct:true },
  { k:'m_v2fppp',l:'Visit→FP+PP %', g:'CONVERSION METRICS', gc:'g-metric', isPct:true },
  { k:'m_l2v',   l:'Lead→Visit %',  g:'CONVERSION METRICS', gc:'g-metric', isPct:true },
  { k:'m_l2c',   l:'Lead→Conv %',   g:'CONVERSION METRICS', gc:'g-metric', isPct:true },
  { k:'m_chen',  l:'Chennai→Conv %',g:'CONVERSION METRICS', gc:'g-metric', isPct:true },

  /* ── AUDIT ── */
  { k:'selfAudit',l:'Self Audit',   g:'AUDIT', gc:'g-audit' },
  { k:'bdmScore', l:'BDM Score',    g:'AUDIT', gc:'g-audit' },

  /* ── FOLLOW-UP (no data source yet — placeholders) ── */
  { k:'fbCall',  l:'Feedback Calls',g:'FOLLOW-UP', gc:'g-fu', tag:'tg' },
  { k:'fuSched', l:'FU Scheduled',  g:'FOLLOW-UP', gc:'g-fu' },
  { k:'payCol',  l:'Pay Collected', g:'FOLLOW-UP', gc:'g-fu', tag:'tg' },
  { k:'svcIssue',l:'Service Issues',g:'FOLLOW-UP', gc:'g-fu', tag:'tr' },

  /* ── LOCATION (Chennai vs Outer Chennai vs Other District, based on lead city/zip) ── */
  { k:'loc_chennai', l:'Chennai',         g:'LOCATION', gc:'g-info', tag:'tg' },
  { k:'loc_outer',   l:'Outer Chennai',   g:'LOCATION', gc:'g-info', tag:'tb' },
  { k:'loc_other',   l:'Other District',  g:'LOCATION', gc:'g-info', tag:'ta' },

  /* ── REFUND (data source TBD — values 0 until refund tracking is wired) ── */
  { k:'refundReq',  l:'Refund Requested',  g:'REFUND', gc:'g-pay', tag:'ta' },
  { k:'refundDone', l:'Refund Completed',  g:'REFUND', gc:'g-pay', tag:'tg' },

  /* ── PIPELINE (Person view — current state + tracked transitions) ── */
  { k:'newPipeline',  l:'New Leads (pipeline)', g:'PIPELINE',   gc:'g-info',  tag:'ta' },
  { k:'apptAction',   l:'Appt Fixed (action)',  g:'PIPELINE',   gc:'g-appt',  tag:'tg' },
  { k:'visitedAction',l:'Visits (action)',      g:'PIPELINE',   gc:'g-health',tag:'tg' },
  { k:'confirmedAction',l:'Confirmed (action)', g:'PIPELINE',   gc:'g-appt',  tag:'tb' },

  /* ── TELEPHONY (call_log_summary + smartflo_call_log) ── */
  { k:'leadsCalled',  l:'Leads Called',   g:'TELEPHONY', gc:'g-call', tag:'tp' },
  { k:'totalCalls',   l:'Total Calls',    g:'TELEPHONY', gc:'g-call' },
  { k:'uniqueCalls',  l:'Unique Calls',   g:'TELEPHONY', gc:'g-call' },
  { k:'connCalls',    l:'Connected',      g:'TELEPHONY', gc:'g-call', tag:'tg' },
  { k:'notConnCalls', l:'Not Connected',  g:'TELEPHONY', gc:'g-call', tag:'tr' },
  { k:'inCalls',      l:'Incoming',       g:'TELEPHONY', gc:'g-call', tag:'tb' },
  { k:'outCalls',     l:'Outgoing',       g:'TELEPHONY', gc:'g-call', tag:'tp' },
  { k:'totalDurMin',  l:'Total Dur (min)',g:'TELEPHONY', gc:'g-call', isDur:true },
  { k:'avgDurMin',    l:'Avg Dur (min)',  g:'TELEPHONY', gc:'g-call', isDur:true },
];

export const PRESETS = {
  all: null,
  sales:  ['period','leads','batch','src','loc','fu','cb','lb','rnr','dnd','so','oos','wn','open','ni','nosugar','oth','callTot','apptD','apptZ','apptTot','conf','vis','m_l2a','m_a2v','m_l2v','m_l2c'],
  health: ['period','leads','sugarHi','sugarMid','sugarNo','consWJ','consTW','consNW','consTM','consQD','recDone','progL1','progL2','progBoth','enr','fp','pp','inst','emi'],
  roas:   ['period','leads','enr','fp','pp','inst','rev','spent','roasAll','roasFPPP','roasEnr','instCnt','roasInst','l1tot','l2tot'],
  metric: ['period','leads','apptD','apptZ','conf','vis','enr','fp','pp','m_l2a','m_a2v','m_v2e','m_v2fp','m_v2fppp','m_l2v','m_l2c','m_chen'],
  l1l2:   ['period','leads','enr','fp','pp','l1fp','l1tot','l2fp','l2pp','l2tot','progL1','progL2','progBoth','rev'],
  audit:  ['period','leads','vis','enr','selfAudit','bdmScore','fbCall','fuSched','payCol','svcIssue'],
  telephony: ['period','leads','newPipeline','leadsCalled','totalCalls','uniqueCalls','connCalls','notConnCalls','totalDurMin','avgDurMin','apptAction','visitedAction'],
  callers:   ['period','leads','newPipeline','totalCalls','uniqueCalls','connCalls','notConnCalls','totalDurMin','avgDurMin','apptAction','visitedAction'],
};
