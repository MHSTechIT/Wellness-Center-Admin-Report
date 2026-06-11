import { useMemo, useState } from 'react';
import { fmtN } from '../lib/format.js';

/*
 * IncentiveCalculator — BASIC MOCKUP / DRAFT LAYOUT
 * --------------------------------------------------
 * This is an initial placeholder layout built from current workflow understanding.
 * The real incentive rules, slabs, and final UI/UX will be provided later by the
 * product owner. All numbers below are illustrative (client-side only) — nothing
 * here is wired to the backend yet.
 */

const MONTHS = [
  '2026-05', '2026-04', '2026-03', '2026-02', '2026-01', '2025-12',
];

// Illustrative draft rows — replace with real /api data once rules are finalized.
const DRAFT_ROWS = [
  { id: 1, name: 'Santhosh Kumar', role: 'Salesperson', enrolments: 18, revenue: 540000, ratePct: 2.0 },
  { id: 2, name: 'Priya R',        role: 'Salesperson', enrolments: 12, revenue: 372000, ratePct: 2.0 },
  { id: 3, name: 'Dr. Meera',      role: 'Health Coach', enrolments: 9,  revenue: 270000, ratePct: 1.5 },
  { id: 4, name: 'Arun V',         role: 'Salesperson', enrolments: 7,  revenue: 196000, ratePct: 1.5 },
];

export default function IncentiveCalculator({ user, onLogout }) {
  const [month, setMonth] = useState(MONTHS[0]);
  const [role, setRole] = useState('all');
  const [target, setTarget] = useState(10); // illustrative enrolment target / threshold

  const rows = useMemo(() => {
    return DRAFT_ROWS
      .filter((r) => role === 'all' || r.role === role)
      .map((r) => {
        // Draft formula: base incentive = revenue × rate%, plus a flat bonus
        // when enrolments meet the target. Purely illustrative.
        const base = Math.round((r.revenue * r.ratePct) / 100);
        const bonus = r.enrolments >= target ? 5000 : 0;
        return { ...r, base, bonus, total: base + bonus, metTarget: r.enrolments >= target };
      });
  }, [role, target]);

  const totals = useMemo(() => rows.reduce(
    (a, r) => ({
      enrolments: a.enrolments + r.enrolments,
      revenue: a.revenue + r.revenue,
      total: a.total + r.total,
    }),
    { enrolments: 0, revenue: 0, total: 0 },
  ), [rows]);

  const initial = (user?.name || user?.login || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="app">
      {/* ── Top bar ── */}
      <div className="topbar">
        <img src="/mhs-logo.png" alt="MHS" className="logo-img" />
        <span className="tb-title">MHS · Incentive Calculator</span>
        <span className="tb-badge draft">Draft · Mockup</span>
        <div className="tb-right">
          {user && (
            <div className="user-menu">
              <button className="user-btn" title={user.login}>
                <span className="user-av">{initial}</span>
                <span className="user-name">{user.name}</span>
              </button>
            </div>
          )}
          <button className="ud-item ic-signout" onClick={onLogout}>Sign out</button>
        </div>
      </div>

      {/* ── Draft notice ── */}
      <div className="ic-notice">
        🚧 <b>Work in progress.</b> This is a basic placeholder layout. Incentive rules,
        slabs and the final design will be added later. All figures shown are sample data.
      </div>

      {/* ── Controls ── */}
      <div className="ic-controls">
        <label className="ic-field">
          <span>Month</span>
          <select className="sel" value={month} onChange={(e) => setMonth(e.target.value)}>
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <label className="ic-field">
          <span>Role</span>
          <select className="sel" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="all">All</option>
            <option value="Salesperson">Salesperson</option>
            <option value="Health Coach">Health Coach</option>
          </select>
        </label>
        <label className="ic-field">
          <span>Enrolment target (bonus)</span>
          <input
            className="date-input"
            type="number"
            min="0"
            value={target}
            onChange={(e) => setTarget(Number(e.target.value) || 0)}
          />
        </label>
        <button className="ic-btn" type="button" title="Recalculate (placeholder)">Calculate</button>
      </div>

      {/* ── Summary cards ── */}
      <div className="ic-cards">
        <div className="ic-card">
          <div className="ic-card-label">People</div>
          <div className="ic-card-val">{rows.length}</div>
        </div>
        <div className="ic-card">
          <div className="ic-card-label">Total Enrolments</div>
          <div className="ic-card-val">{fmtN(totals.enrolments)}</div>
        </div>
        <div className="ic-card">
          <div className="ic-card-label">Total Revenue</div>
          <div className="ic-card-val">₹{fmtN(totals.revenue)}</div>
        </div>
        <div className="ic-card accent">
          <div className="ic-card-label">Total Incentive</div>
          <div className="ic-card-val">₹{fmtN(totals.total)}</div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="ic-table-wrap">
        <table className="ic-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th className="num">Enrolments</th>
              <th className="num">Revenue (₹)</th>
              <th className="num">Rate %</th>
              <th className="num">Base (₹)</th>
              <th className="num">Bonus (₹)</th>
              <th className="num">Total Incentive (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.role}</td>
                <td className="num">
                  {r.enrolments}
                  {r.metTarget && <span className="ic-pill">target ✓</span>}
                </td>
                <td className="num">{fmtN(r.revenue)}</td>
                <td className="num">{r.ratePct.toFixed(1)}</td>
                <td className="num">{fmtN(r.base)}</td>
                <td className="num">{fmtN(r.bonus)}</td>
                <td className="num strong">{fmtN(r.total)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className="num">{fmtN(totals.enrolments)}</td>
              <td className="num">{fmtN(totals.revenue)}</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num">—</td>
              <td className="num strong">{fmtN(totals.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
