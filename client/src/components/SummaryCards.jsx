import { useMemo } from 'react';
import { fmtN, fmtRev, pct } from '../lib/format.js';

export default function SummaryCards({ rows }) {
  const cards = useMemo(() => {
    // Unified across ALL views — always aggregated from the same `rows` the
    // table shows, so cards always reconcile with the table & each other.
    const t = {
      leads: 0, apptD: 0, apptZ: 0, conf: 0, vis: 0, enr: 0, fp: 0, pp: 0, inst: 0,
      rev: 0, ni: 0, fu: 0, chen: 0, totalCalls: 0, connCalls: 0,
    };
    rows.forEach((r) => Object.keys(t).forEach((k) => { t[k] += Number(r[k] || 0); }));
    return [
      { l: 'Total Leads',  v: fmtN(t.leads), c: 'brand' },
      { l: 'Appointments', v: t.apptD + t.apptZ, c: 'green', s: `D ${t.apptD} · Z ${t.apptZ}` },
      { l: 'Confirmed',    v: fmtN(t.conf), c: 'green' },
      { l: 'Visited',      v: fmtN(t.vis),  c: 'green' },
      { l: 'Enrolled',     v: fmtN(t.enr),  c: 'pink' },
      { l: 'Full Paid',    v: fmtN(t.fp) },
      { l: 'Part Paid',    v: fmtN(t.pp),  c: 'amber' },
      { l: 'Instalment',   v: fmtN(t.inst), c: 'blue' },
      { l: 'Revenue',      v: fmtRev(t.rev), c: 'green' },
      { l: 'Lead→Conv',    v: pct(t.enr, t.leads) + '%' },
      { l: 'Lead→Visit',   v: pct(t.vis, t.leads) + '%', c: 'blue' },
      { l: 'Visit→Enrol',  v: pct(t.enr, t.vis) + '%', c: 'green' },
      { l: 'Total Calls',  v: fmtN(t.totalCalls), c: 'blue' },
      { l: 'Connected',    v: fmtN(t.connCalls), c: 'blue' },
      { l: 'Not Int.',     v: fmtN(t.ni), c: 'red' },
      { l: 'Follow Up',    v: fmtN(t.fu) },
      { l: 'Walkin',       v: fmtN(t.chen), c: 'blue' },
    ];
  }, [rows]);

  return (
    <div className="summary">
      <div className="sum-grid">
        {cards.map((c, i) => (
          <div key={i} className={'kpi ' + (c.c || '')}>
            <div className="lab">{c.l}</div>
            <div className="val">{c.v}</div>
            {c.s && <div className="sub">{c.s}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
