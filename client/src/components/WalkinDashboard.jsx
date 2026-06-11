import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmtN, fmtRev } from '../lib/format.js';

const PERIODS = [
  { k: 'today',  label: 'Today' },
  { k: 'last_7', label: 'Last 7 Days' },
  { k: 'last_30',label: 'Last 30 Days' },
  { k: 'this_m', label: 'This Month' },
  { k: 'custom', label: 'Custom' },
];

function rangeFor(k) {
  const today = new Date();
  const fmt = (d) => d.toISOString().slice(0, 10);
  if (k === 'today')  return { from_date: fmt(today),                                  to_date: fmt(today) };
  if (k === 'last_7') return { from_date: fmt(new Date(today.getTime() - 6 * 86400000)),  to_date: fmt(today) };
  if (k === 'last_30')return { from_date: fmt(new Date(today.getTime() - 29 * 86400000)), to_date: fmt(today) };
  if (k === 'this_m') return { from_date: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to_date: fmt(today) };
  return null;
}

const KPI_DEFS = [
  { k: 'total_walkin_leads',         l: 'Total Walkin Leads',        c: 'cyan' },
  { k: 'appointments_fixed',         l: 'Appointments Fixed',        c: 'cyan' },
  { k: 'visits_completed',           l: 'Visits Completed',          c: 'amber' },
  { k: 'l1_enrolled',                l: 'L1 Enrolled',               c: 'green' },
  { k: 'l2_enrolled',                l: 'L2 Enrolled',               c: 'orange' },
  { k: 'appointment_conversion_pct', l: 'Appt Conversion Rate',      c: 'pink',  suffix: '%' },
];

const CALLER_COLS = [
  { k: 'name',                l: 'Salesperson',     sticky: true },
  { k: 'new_leads',           l: 'New Leads' },
  { k: 'total_calls',         l: 'Total Calls' },
  { k: 'total_unique_calls',  l: 'Unique Calls' },
  { k: 'connected_calls',     l: 'Connected' },
  { k: 'not_connected_calls', l: 'Not Connected' },
  { k: 'total_duration_min',  l: 'Total Dur (min)', dec: true },
  { k: 'avg_duration_min',    l: 'Avg Dur (min)',   dec: true },
  { k: 'appointments_fixed',  l: 'Appt Fixed' },
  { k: 'visits_completed',    l: 'Visits' },
  { k: 'pending_followups',   l: 'Pending FU' },
];

const COACH_COLS = [
  { k: 'name',                l: 'Health Coach', sticky: true },
  { k: 'health_assessments',  l: 'Health Assessments' },
  { k: 'l1_enrolled',         l: 'L1 Enrolled' },
  { k: 'l2_enrolled',         l: 'L2 Enrolled' },
  { k: 'payments_recorded',   l: 'Payments Recorded' },
  { k: 'pending_followups',   l: 'Pending Followups' },
];

export default function WalkinDashboard({ user }) {
  const [period, setPeriod] = useState('last_30');
  const [custom, setCustom] = useState({ from_date: '', to_date: '' });
  const [filters, setFilters] = useState({ user_id: '', batch: '' });
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const userMenuRef = useRef(null);

  const activeRange = useMemo(() => period === 'custom' ? custom : rangeFor(period), [period, custom]);

  const load = useCallback(async () => {
    if (!activeRange || !activeRange.from_date || !activeRange.to_date) return;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({
        from_date: activeRange.from_date,
        to_date: activeRange.to_date,
        ...(filters.user_id ? { user_id: filters.user_id } : {}),
        ...(filters.batch ? { batch: filters.batch } : {}),
      });
      const r = await fetch('/api/walkin/dashboard?' + qs.toString(), { credentials: 'same-origin' });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || j.error || 'fetch_failed');
      setData(j);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [activeRange, filters.user_id, filters.batch]);

  useEffect(() => { load(); }, [load]);

  const formatCell = (col, val) => {
    if (val == null || val === '') return '—';
    if (col.dec) return Number(val).toFixed(2);
    if (typeof val === 'number') return fmtN(val);
    return val;
  };

  return (
    <div className="walkin-page">
      <div className="walkin-topbar">
        <h2>Walk-in Team Dashboard</h2>
        <div className="walkin-controls">
          <select className="sel" value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(p => <option key={p.k} value={p.k}>{p.label}</option>)}
          </select>
          {period === 'custom' && (
            <>
              <input type="date" className="sel" value={custom.from_date} onChange={(e) => setCustom({ ...custom, from_date: e.target.value })} />
              <input type="date" className="sel" value={custom.to_date} onChange={(e) => setCustom({ ...custom, to_date: e.target.value })} />
            </>
          )}
          <select className="sel" value={filters.user_id} onChange={(e) => setFilters({ ...filters, user_id: e.target.value })}>
            <option value="">Select salesperson</option>
            {(data?.users || []).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="sel" value={filters.batch} onChange={(e) => setFilters({ ...filters, batch: e.target.value })}>
            <option value="">Select Batch</option>
            {(data?.batch_data || []).map(b => <option key={b.batch || b.name} value={b.batch || b.name}>{b.batch || b.name}</option>)}
          </select>
          <button className="btn primary" onClick={load} disabled={loading}>{loading ? '…' : 'Apply'}</button>
        </div>
      </div>

      {error && <div className="walkin-err">⚠ {error}</div>}

      {/* KPI cards */}
      <div className="walkin-kpis">
        {KPI_DEFS.map(k => {
          const v = data?.[k.k];
          return (
            <div key={k.k} className={'walkin-kpi ' + (k.c || '')}>
              <div className="wk-l">{k.l}:</div>
              <div className="wk-v">{loading ? '…' : (v == null ? '—' : (typeof v === 'number' ? fmtN(v) : v))}{k.suffix || ''}</div>
            </div>
          );
        })}
      </div>

      {/* Walk-in Callers Summary */}
      <div className="walkin-section">
        <div className="ws-title">📞 Walk-in Callers Summary</div>
        <div className="ws-tablewrap">
          <table className="ws-table">
            <thead>
              <tr>{CALLER_COLS.map(c => <th key={c.k}>{c.l}</th>)}</tr>
            </thead>
            <tbody>
              {(data?.caller_table || []).length === 0 ? (
                <tr><td colSpan={CALLER_COLS.length} className="empty">{loading ? 'Loading…' : 'No data'}</td></tr>
              ) : (
                data.caller_table.map((row, i) => (
                  <tr key={i}>
                    {CALLER_COLS.map(c => (
                      <td key={c.k} className={c.sticky ? 'sticky' : ''}>{formatCell(c, row[c.k])}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Health Coach Summary */}
      <div className="walkin-section">
        <div className="ws-title">🩺 Health Coach Summary</div>
        <div className="ws-tablewrap">
          <table className="ws-table">
            <thead>
              <tr>{COACH_COLS.map(c => <th key={c.k}>{c.l}</th>)}</tr>
            </thead>
            <tbody>
              {(data?.coach_table || []).length === 0 ? (
                <tr><td colSpan={COACH_COLS.length} className="empty">{loading ? 'Loading…' : 'No data'}</td></tr>
              ) : (
                data.coach_table.map((row, i) => (
                  <tr key={i}>
                    {COACH_COLS.map(c => (
                      <td key={c.k} className={c.sticky ? 'sticky' : ''}>{formatCell(c, row[c.k])}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {data?._meta && (
        <div className="walkin-foot">
          Live from Odoo · fetched in {data._meta.durationMs} ms · {data.from_date} → {data.to_date} · revenue ₹{fmtN(data.total_revenue || 0)}
        </div>
      )}
    </div>
  );
}
