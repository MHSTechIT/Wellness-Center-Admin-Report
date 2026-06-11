import { useEffect, useState } from 'react';
import { fmtN } from '../lib/format.js';

export default function FilterBar({ options, filters, onChange, onExport, onOpenColPanel }) {
  const [search, setSearch] = useState(filters.search || '');

  useEffect(() => {
    const t = setTimeout(() => onChange({ ...filters, search }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const set = (k) => (e) => onChange({ ...filters, [k]: e.target.value });

  return (
    <div className="ctrl muted">
      <select className="sel" value={filters.batch || ''} onChange={set('batch')}>
        <option value="">All Batches</option>
        {options.batches?.map((b) => (
          <option key={b.code} value={b.code}>{b.code} ({fmtN(b.leads)})</option>
        ))}
      </select>

      <select className="sel" value={filters.team_id || ''} onChange={set('team_id')}>
        <option value="">All Teams</option>
        {options.teams?.map((t) => <option key={t.id} value={t.id}>{t.name || `Team ${t.id}`}</option>)}
      </select>

      <select className="sel" value={filters.user_id || ''} onChange={set('user_id')}>
        <option value="">All Salespersons</option>
        {options.salespersons?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>

      <select className="sel" value={filters.hc_id || ''} onChange={set('hc_id')}>
        <option value="">All HCs</option>
        {options.healthCoaches?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      </select>

      <select className="sel" value={filters.source_id || ''} onChange={set('source_id')}>
        <option value="">All Sources</option>
        {options.sources?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>

      <select className="sel" value={filters.program || ''} onChange={set('program')}>
        <option value="">All Programs</option>
        <option value="L1">L1</option><option value="L2">L2</option><option value="Both">Both</option>
      </select>

      <input className="search" placeholder="Search name / phone…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button className="btn" onClick={onOpenColPanel}>
          <svg viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /></svg>
          Columns
        </button>
        <button className="btn primary" onClick={onExport}>
          <svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Export
        </button>
      </div>
    </div>
  );
}
