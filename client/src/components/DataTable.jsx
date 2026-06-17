import { useEffect, useMemo, useState } from 'react';
import { COLS } from '../lib/columns.js';
import { fmtN, fmtRev } from '../lib/format.js';

const PERIOD_PL = { daily: 'pl-d', weekly: 'pl-w', monthly: 'pl-m', yearly: 'pl-y', custom: 'pl-d' };
const PAGE_SIZES = [25, 50, 100, 250];

function PctCell({ value }) {
  if (value == null || value === '') return <td className="zero">—</td>;
  const n = parseFloat(value);
  if (isNaN(n) || n === 0) return <td className="zero">—</td>;
  const cls = n >= 50 ? 'phi' : n >= 20 ? 'pmd' : 'plo';
  const bc  = n >= 50 ? 'var(--green)' : n >= 20 ? 'var(--amber)' : 'var(--red)';
  return (
    <td>
      <div className="pct">
        <span className={'pct-val ' + cls}>{n}%</span>
        <div className="pct-bar" style={{ width: `${Math.min(n, 100)}%`, background: bc }} />
      </div>
    </td>
  );
}

function Cell({ col, row, period, onDrill }) {
  const v = row[col.k];
  if (col.k === 'period') {
    return <td className="sl"><span className={'pl ' + (PERIOD_PL[period] || 'pl-d')}>{v ?? '—'}</span></td>;
  }
  if (col.k === 'leads') return <td className="sl2">{fmtN(v)}</td>;
  if (col.isPct) return <PctCell value={v} />;
  if (col.isRev) return <td style={{ color: 'var(--green)', fontWeight: 600 }}>{fmtRev(v)}</td>;
  if (col.isDur) {
    const n = Number(v || 0);
    if (!n) return <td className="zero">—</td>;
    return <td>{n.toLocaleString('en-IN', { minimumFractionDigits: n < 100 ? 2 : 1, maximumFractionDigits: 2 })}</td>;
  }
  if (col.k === 'batch' && v && v !== '—') return <td><span className="tag tp">{v}</span></td>;
  // Clickable drill cells — open the matching leads in the Client view (exportable).
  // Only active in the Period view (Period rows have row.bucket; Person/Client don't).
  // L1/L2 columns drill by `program`; PAYMENT columns drill by payment status.
  if (onDrill && row.bucket && Number(v) > 0) {
    const PROG_DRILL = { l1tot: 'L1', l2tot: 'L2' };
    const PAY_DRILL  = { enr: 'enrolled', fp: 'full_paid', pp: 'partial', inst: 'instalment', emi: 'emi' };
    const PAY_LABEL  = { enrolled: 'Enrolled', full_paid: 'Full Paid', partial: 'Part Paid', instalment: 'Instalment', emi: 'EMI' };
    if (PROG_DRILL[col.k]) {
      const program = PROG_DRILL[col.k];
      return (
        <td>
          <button
            type="button"
            className="drill-link"
            onClick={() => onDrill({ bucket: row.bucket, program })}
            title={`View these ${fmtN(v)} ${program} leads (drills into Client view, exportable)`}
          >{fmtN(v)}</button>
        </td>
      );
    }
    if (PAY_DRILL[col.k]) {
      const payment = PAY_DRILL[col.k];
      return (
        <td>
          <button
            type="button"
            className="drill-link"
            onClick={() => onDrill({ bucket: row.bucket, payment })}
            title={`View these ${fmtN(v)} ${PAY_LABEL[payment]} leads (drills into Client view, exportable)`}
          >{fmtN(v)}</button>
        </td>
      );
    }
  }
  if (!v || v === 0 || v === '—') return <td className="zero">—</td>;
  if (col.tag) return <td><span className={'tag ' + col.tag}>{fmtN(v)}</span></td>;
  return <td>{typeof v === 'number' ? fmtN(v) : v}</td>;
}

/* Pct helper — identical formula to the server's withDerived() so the TOTAL
 * row reconciles exactly with a hypothetical "all rows combined" row. */
const pct = (a, b) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 100) : 0);

/* Recompute derived columns from SUMMED base columns (NOT by summing the
 * per-row derived values, which is statistically meaningless). */
function deriveTotals(t) {
  const apptTot = (t.apptD || 0) + (t.apptZ || 0);
  return {
    ...t,
    apptTot,
    callTot: ['fu','cb','lb','rnr','dnd','so','oos','wn','open','blank','ni']
      .reduce((s, k) => s + (t[k] || 0), 0),
    m_l2a:   pct(apptTot, t.leads),
    m_a2v:   pct(t.vis, apptTot),
    m_v2e:   pct(t.enr, t.vis),
    m_v2fp:  pct(t.fp, t.vis),
    m_v2fppp:pct((t.fp || 0) + (t.pp || 0), t.vis),
    m_l2v:   pct(t.vis, t.leads),
    m_l2c:   pct(t.enr, t.leads),
    m_chen:  pct(t.enr, t.loc_chennai),
    // weighted average duration = total minutes / total connected calls
    avgDurMin: t.connCalls > 0 ? Math.round((t.totalDurMin / t.connCalls) * 100) / 100 : 0,
  };
}

function TotalCell({ col, totals }) {
  if (col.k === 'period') return <td className="sl">TOTAL / AVG</td>;
  if (col.k === 'leads')  return <td className="sl2">{fmtN(totals.leads || 0)}</td>;
  if (col.isPct) return <PctCell value={totals[col.k] || 0} />;
  if (col.isRev) return <td style={{ color: 'var(--green)', fontWeight: 700 }}>{fmtRev(totals[col.k] || 0)}</td>;
  if (col.isDur) {
    const n = Number(totals[col.k] || 0);
    if (!n) return <td>—</td>;
    return <td>{n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>;
  }
  if (['batch', 'src', 'loc'].includes(col.k)) return <td>—</td>;
  return <td>{fmtN(totals[col.k] || 0)}</td>;
}

export default function DataTable({ rows, visible, sortKey, period, loading, onDrill }) {
  const cols = useMemo(() => COLS.filter((c) => visible[c.k]), [visible]);

  // Header-click sort overrides the dropdown sort. null = use `sortKey` prop.
  const [hdrSort, setHdrSort] = useState(null); // { k, dir }
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // When the Sort dropdown changes, clear any header-click override (otherwise the
  // dropdown selection would be ignored while a header sort is active) and reset to page 1.
  useEffect(() => { setHdrSort(null); setPage(0); }, [sortKey]);

  function onHeaderClick(k) {
    setPage(0);
    setHdrSort((prev) => {
      if (!prev || prev.k !== k) return { k, dir: 'desc' };
      if (prev.dir === 'desc') return { k, dir: 'asc' };
      return null; // third click → reset to default
    });
  }

  const { sortedRows, totals } = useMemo(() => {
    let sorted;
    const active = hdrSort || (sortKey === 'date' ? { k: '__date', dir: 'desc' } : { k: sortKey, dir: 'desc' });

    if (active.k === '__date') {
      sorted = [...rows].sort((a, b) => {
        const ka = a.bucket || a.period || '';
        const kb = b.bucket || b.period || '';
        return ka < kb ? 1 : ka > kb ? -1 : 0;
      });
    } else {
      const dir = active.dir === 'asc' ? 1 : -1;
      sorted = [...rows].sort((a, b) => {
        const va = a[active.k], vb = b[active.k];
        const na = Number(va), nb = Number(vb);
        const bothNum = !isNaN(na) && !isNaN(nb) && va !== '' && vb !== '' && va != null && vb != null;
        if (bothNum) return (na - nb) * dir;
        return String(va ?? '').localeCompare(String(vb ?? '')) * dir;
      });
    }

    // Sum ONLY raw base columns; derived columns are recomputed afterwards.
    const t = {};
    sorted.forEach((r) => Object.keys(r).forEach((k) => {
      const n = Number(r[k]);
      if (!isNaN(n) && r[k] !== '' && r[k] != null) t[k] = (t[k] || 0) + n;
    }));
    return { sortedRows: sorted, totals: deriveTotals(t) };
  }, [rows, sortKey, hdrSort]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const curPage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => sortedRows.slice(curPage * pageSize, curPage * pageSize + pageSize),
    [sortedRows, curPage, pageSize]
  );

  const groups = {};
  cols.forEach((c) => { groups[c.g] = (groups[c.g] || 0) + 1; });
  const seen = {};
  const activeSortKey = hdrSort ? hdrSort.k : (sortKey === 'date' ? '__date' : sortKey);

  return (
    <>
      <div className="tbl-wrap">
        <table>
          <thead>
            <tr className="grp-row">
              {cols.map((c) => {
                if (seen[c.g]) return null;
                seen[c.g] = true;
                return <th key={c.g} className={c.gc || 'g-info'} colSpan={groups[c.g]}>{c.g}</th>;
              })}
            </tr>
            <tr className="col-row">
              {cols.map((c) => {
                const isActive = activeSortKey === c.k;
                const arrow = isActive ? (hdrSort?.dir === 'asc' ? '▲' : '▼') : '▾';
                return (
                  <th
                    key={c.k}
                    className={(c.sticky || '') + (isActive ? ' sorted' : '')}
                    onClick={() => onHeaderClick(c.k)}
                    style={{ cursor: 'pointer', userSelect: 'none' }}
                    title="Click to sort"
                  >
                    <span>{c.l}</span><span className="arr">{arrow}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length === 0 ? (
              <tr><td colSpan={cols.length} className="empty">No data for current filters. Try widening the date range or clearing filters.</td></tr>
            ) : (
              <>
                {pageRows.map((r, i) => (
                  <tr key={i}>
                    {cols.map((c) => <Cell key={c.k} col={c} row={r} period={period} onDrill={onDrill} />)}
                  </tr>
                ))}
                <tr className="total">
                  {cols.map((c) => <TotalCell key={c.k} col={c} totals={totals} />)}
                </tr>
              </>
            )}
          </tbody>
        </table>
        {loading && <div className="loading-overlay on"><div className="spinner" /></div>}
      </div>

      {sortedRows.length > 0 && (
        <div className="pager">
          <span className="pager-info">
            {curPage * pageSize + 1}–{Math.min((curPage + 1) * pageSize, sortedRows.length)} of {sortedRows.length.toLocaleString('en-IN')}
          </span>
          <div className="pager-ctrls">
            <button className="btn" disabled={curPage === 0} onClick={() => setPage(0)}>« First</button>
            <button className="btn" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}>‹ Prev</button>
            <span className="pager-page">Page {curPage + 1} / {pageCount}</span>
            <button className="btn" disabled={curPage >= pageCount - 1} onClick={() => setPage(curPage + 1)}>Next ›</button>
            <button className="btn" disabled={curPage >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>Last »</button>
            <select className="sel" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s} / page</option>)}
            </select>
          </div>
        </div>
      )}
    </>
  );
}
