import { useCallback, useEffect, useState } from 'react';
import TopBar from './components/TopBar.jsx';
import ControlBar from './components/ControlBar.jsx';
import FilterBar from './components/FilterBar.jsx';
import SavedViews from './components/SavedViews.jsx';
import SummaryCards from './components/SummaryCards.jsx';
import DataTable from './components/DataTable.jsx';
import ColumnPanel from './components/ColumnPanel.jsx';
import Login from './components/Login.jsx';
import IncentiveCalculator from './components/IncentiveCalculator.jsx';
import { COLS, PRESETS } from './lib/columns.js';
import * as api from './lib/api.js';
import * as auth from './lib/auth.js';

const initialVisible = Object.fromEntries(COLS.map((c) => [c.k, true]));
const initialFilters = { team_id: '', user_id: '', hc_id: '', batch: '', source_id: '', program: '', search: '' };

/* Sort dropdown — a single, fixed set of options. Each `k` is a real row field (or the
 * special 'date' bucket key) handled by DataTable's sort logic, so all options work. */
const SORT_OPTIONS = [
  { k: 'date',    l: 'Sort: Date (Newest First)' },
  { k: 'leads',   l: 'Sort: Leads' },
  { k: 'apptTot', l: 'Sort: Appt Fixed' },
  { k: 'vis',     l: 'Sort: Visited' },
  { k: 'enr',     l: 'Sort: Enrolled' },
  { k: 'rev',     l: 'Sort: Revenue' },
];

/* Human label for the date window each view+period actually uses.
 * Period view = a rolling TREND history; Person/Client = the current calendar period. */
const WIN_SCOPE = {
  period:       { daily: 'Last 30 days', weekly: 'Last 12 weeks', monthly: 'Last 12 months', yearly: 'Last 5 years', custom: 'Custom range' },
  personclient: { daily: 'Today',        weekly: 'This week',      monthly: 'This month',      yearly: 'This year',     custom: 'Custom range' },
};

export default function App() {
  /* Auth */
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  /* Active module ("admin" report dashboard | "incentive" calculator).
   * Persisted so a page refresh (which restores the session via /api/me
   * without going through the login form) keeps the user in the same module. */
  const [module, setModule] = useState(() => localStorage.getItem('mhs-module') || 'admin');
  const switchModule = useCallback((m) => {
    setModule(m);
    localStorage.setItem('mhs-module', m);
  }, []);
  const handleLoginSuccess = useCallback((u, m) => {
    if (m) switchModule(m);
    setUser(u);
  }, [switchModule]);

  /* Dashboard state */
  const [period, setPeriod] = useState('daily');
  const [view, setView] = useState('period');
  const [customRange, setCustomRange] = useState({ from: '', to: '' });
  const [filters, setFilters] = useState(initialFilters);
  const [visible, setVisible] = useState(initialVisible);
  const [activePreset, setActivePreset] = useState('all');
  const [sortKey, setSortKey] = useState('date');
  // When the view changes, switch the default sort to something sensible.
  // Period view → date-desc (Mon 12 May first), Person/Client → leads-desc.
  useEffect(() => {
    setSortKey(view === 'period' ? 'date' : 'leads');
  }, [view]);
  const [theme, setTheme] = useState(localStorage.getItem('mhs-theme') || 'light');
  const [colPanelOpen, setColPanelOpen] = useState(false);
  const [options, setOptions] = useState({});
  const [healthInfo, setHealthInfo] = useState({ ok: false, lead_count: 0 });
  const [reportData, setReportData] = useState({ rows: [], count: 0, from: '', to: '', durationMs: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  /* Theme */
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('mhs-theme', theme);
  }, [theme]);

  /* Check auth on mount */
  useEffect(() => {
    auth.me().then((u) => { setUser(u); setAuthChecking(false); }).catch(() => setAuthChecking(false));
  }, []);

  /* Once authenticated: fetch health (one-shot) */
  useEffect(() => {
    if (!user) return;
    api.health().then(setHealthInfo).catch(() => setHealthInfo({ ok: false, lead_count: 0 }));
  }, [user]);

  /* Refetch filter options whenever any filter changes (cascade). Debounced 200ms. */
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => {
      api.filterOptions({
        batch:     filters.batch,
        team_id:   filters.team_id,
        user_id:   filters.user_id,
        hc_id:     filters.hc_id,
        source_id: filters.source_id,
        program:   filters.program,
      }).then(setOptions).catch((e) => setError('Filters: ' + e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [user, filters.batch, filters.team_id, filters.user_id, filters.hc_id, filters.source_id, filters.program]);

  /* Load report */
  const loadReport = useCallback(async () => {
    if (!user) return;
    setLoading(true); setError(null);
    const t0 = performance.now();
    try {
      const from = period === 'custom' ? customRange.from : null;
      const to   = period === 'custom' ? customRange.to   : null;
      const j = await api.report({ view, period, from, to, filters });
      setReportData({ ...j, durationMs: Math.round(performance.now() - t0) });
    } catch (e) {
      // Cookie expired? bounce to login
      if (String(e.message).includes('401') || String(e.message).includes('auth_required')) {
        setUser(null); return;
      }
      setError(e.message);
      setReportData({ rows: [], count: 0, from: '', to: '', durationMs: 0 });
    } finally {
      setLoading(false);
    }
  }, [user, period, view, customRange.from, customRange.to, filters]);

  useEffect(() => { loadReport(); }, [loadReport]);

  /* Auth handlers */
  const handleLogout = useCallback(async () => {
    try { await auth.logout(); } catch {}
    setUser(null);
    setReportData({ rows: [], count: 0, from: '', to: '', durationMs: 0 });
    setOptions({});
  }, []);

  /* Preset / column toggles */
  const applyPreset = useCallback((name) => {
    setActivePreset(name);
    const keys = PRESETS[name];
    const next = {};
    COLS.forEach((c) => { next[c.k] = keys ? (keys.includes(c.k) || c.always) : true; });
    setVisible(next);
  }, []);
  const toggleCol = useCallback((k, v) => setVisible((prev) => ({ ...prev, [k]: v })), []);
  const toggleAllCols = useCallback((v) => {
    const next = {};
    COLS.forEach((c) => { next[c.k] = c.always ? true : v; });
    setVisible(next);
  }, []);

  /* Export */
  const exportCSV = useCallback(() => {
    const cols = COLS.filter((c) => visible[c.k]);
    const head = cols.map((c) => c.l).join(',');
    const body = reportData.rows.map((r) => cols.map((c) => {
      const v = r[c.k];
      if (v == null) return '';
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([head + '\n' + body], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `mhs_${view}_${period}_${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [reportData.rows, visible, view, period]);

  /* ── Render ── */
  if (authChecking) {
    return <div className="login-bg"><div className="spinner" /></div>;
  }
  if (!user) {
    return <Login onSuccess={handleLoginSuccess} initialModule={module} />;
  }

  /* Incentive Calculator module (basic mockup for now). */
  if (module === 'incentive') {
    return (
      <IncentiveCalculator
        user={user}
        onLogout={handleLogout}
      />
    );
  }

  const titles = { period: 'Period View', person: 'Salesperson / HC', client: 'Client / Lead' };
  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1);
  const winScope = (view === 'period' ? WIN_SCOPE.period : WIN_SCOPE.personclient)[period] || '';
  const countText = (view === 'client' && reportData.fullCount != null && reportData.fullCount > reportData.count)
    ? `Showing ${reportData.count.toLocaleString('en-IN')} of ${reportData.fullCount.toLocaleString('en-IN')} leads`
    : `${reportData.count.toLocaleString('en-IN')} rows`;
  // Custom range may be a "YYYY-MM-DDTHH:MM" timestamp; replace the 'T' with a space
  // so the status line reads naturally ("2026-06-01 09:00 → 2026-06-05 18:00").
  const prettyTs = (v) => (v ? String(v).replace('T', ' ') : v);
  const subline = error
    ? `⚠ ${error}`
    : `${winScope} · ${prettyTs(reportData.from)} → ${prettyTs(reportData.to)} · ${countText} · loaded in ${reportData.durationMs} ms`;

  return (
    <div className="app">
      <TopBar
        leadCount={healthInfo.lead_count}
        online={healthInfo.ok}
        theme={theme}
        user={user}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onLogout={handleLogout}
      />

      <ControlBar
        period={period}
        view={view}
        from={customRange.from}
        to={customRange.to}
        onPeriod={(p) => { setPeriod(p); if (p !== 'custom') setCustomRange({ from: '', to: '' }); }}
        onView={setView}
        onCustomRange={setCustomRange}
        onRefresh={loadReport}
      />

      <FilterBar
        options={options}
        filters={filters}
        onChange={setFilters}
        onExport={exportCSV}
        onOpenColPanel={() => setColPanelOpen(true)}
      />

      <SavedViews active={activePreset} onSelect={applyPreset} />

      <SummaryCards rows={reportData.rows} />

      <div className="sec-hd">
        <div>
          <div className="sec-title">{periodLabel} Report — {titles[view]}</div>
          <div className="sec-sub">{subline}</div>
        </div>
        <select
          className="sel"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          title="Sort the table (descending)"
        >
          {SORT_OPTIONS.map((o) => <option key={o.k} value={o.k}>{o.l}</option>)}
        </select>
      </div>

      <DataTable rows={reportData.rows} visible={visible} sortKey={sortKey} period={period} loading={loading} />

      <ColumnPanel
        open={colPanelOpen}
        visible={visible}
        onClose={() => setColPanelOpen(false)}
        onToggle={toggleCol}
        onToggleAll={toggleAllCols}
        onPreset={applyPreset}
      />
    </div>
  );
}
