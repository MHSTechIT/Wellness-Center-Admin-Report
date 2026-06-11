import { useMemo, useState } from 'react';
import { COLS } from '../lib/columns.js';

export default function ColumnPanel({ open, visible, onClose, onToggle, onPreset, onToggleAll }) {
  const [q, setQ] = useState('');

  const groups = useMemo(() => {
    const out = {}; const order = [];
    COLS.forEach((c) => { if (!out[c.g]) { out[c.g] = []; order.push(c.g); } out[c.g].push(c); });
    return order.map((g) => ({ g, cols: out[g] }));
  }, []);

  const ql = q.toLowerCase();

  return (
    <div className={'panel' + (open ? ' open' : '')}>
      <div className="panel-hd">
        <h3>Manage Columns</h3>
        <button className="x-btn" onClick={onClose}>✕</button>
      </div>
      <div className="panel-search">
        <input className="sel" type="text" placeholder="Search columns…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="panel-acts">
        <button className="mini" onClick={() => onToggleAll(true)}>Show All</button>
        <button className="mini" onClick={() => onToggleAll(false)}>Hide All</button>
        <button className="mini" onClick={() => onPreset('sales')}>Sales</button>
        <button className="mini" onClick={() => onPreset('health')}>Health</button>
        <button className="mini" onClick={() => onPreset('roas')}>Revenue</button>
      </div>
      <div className="panel-list">
        {groups.map(({ g, cols }) => {
          const filtered = cols.filter((c) => !ql || c.l.toLowerCase().includes(ql));
          if (!filtered.length) return null;
          return (
            <div key={g}>
              <div className="panel-grp">{g}</div>
              {filtered.map((c) => (
                <label key={c.k} className="panel-item">
                  <input
                    type="checkbox"
                    checked={!!visible[c.k]}
                    disabled={c.always}
                    onChange={(e) => onToggle(c.k, e.target.checked)}
                  />
                  <span>{c.l}</span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
