import { useEffect, useState } from 'react';

const PERIODS = [
  ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'],
  ['yearly', 'Yearly'], ['custom', 'Custom'],
];
const VIEWS = [['period', 'Period'], ['person', 'Person'], ['client', 'Client']];

/* Split a committed prop value ("YYYY-MM-DD" or "YYYY-MM-DDTHH:MM[:SS]") into
 * separate date and time strings for the date + time-picker pair. */
function splitDateTime(v) {
  if (!v) return { date: '', time: '' };
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  return m ? { date: m[1], time: m[2] || '' } : { date: '', time: '' };
}

/* Combine into the wire format the server expects. Time is optional: if blank,
 * the value is date-only and the server normalizes it to a full IST day. */
function combine(date, time) {
  if (!date) return '';
  return time ? `${date}T${time}` : date;
}

export default function ControlBar({ period, view, from, to, onPeriod, onView, onCustomRange, onRefresh }) {
  // Local "draft" range — the inputs are bound to this, NOT to the committed
  // props. The report only re-fetches when the user clicks Apply (or Clear),
  // which commits the draft up to the parent via onCustomRange. This avoids
  // firing a request with a half-picked range as the user clicks From then To.
  const fromInit = splitDateTime(from);
  const toInit   = splitDateTime(to);
  const [draftFrom,     setDraftFrom    ] = useState(fromInit.date);
  const [draftFromTime, setDraftFromTime] = useState(fromInit.time);
  const [draftTo,       setDraftTo      ] = useState(toInit.date);
  const [draftToTime,   setDraftToTime  ] = useState(toInit.time);

  // Sync drafts whenever the committed range changes from outside (e.g. the
  // parent clears it when switching away from Custom, or a saved view loads one).
  useEffect(() => {
    const f = splitDateTime(from); setDraftFrom(f.date); setDraftFromTime(f.time);
  }, [from]);
  useEffect(() => {
    const t = splitDateTime(to);   setDraftTo(t.date);   setDraftToTime(t.time);
  }, [to]);

  // Validate. Time is optional, but if set on one end its presence is allowed.
  // We compare the combined "YYYY-MM-DDTHH:MM" form so 5 Jun 18:00 > 5 Jun (date-only),
  // which compares as "2026-06-05T18:00" > "2026-06-05" lexically (still correct).
  const fromCombined = combine(draftFrom, draftFromTime);
  const toCombined   = combine(draftTo,   draftToTime);
  const valid = !!draftFrom && !!draftTo && fromCombined <= toCombined;
  const dirty = fromCombined !== (from || '') || toCombined !== (to || '');
  const canApply = valid && dirty;

  const apply = () => { if (valid) onCustomRange({ from: fromCombined, to: toCombined }); };
  const clear = () => {
    setDraftFrom(''); setDraftFromTime(''); setDraftTo(''); setDraftToTime('');
    if (from || to) onCustomRange({ from: '', to: '' });
  };
  const onKey = (e) => { if (e.key === 'Enter' && canApply) apply(); };

  return (
    <div className="ctrl">
      <span className="label">Period</span>
      <div className="tog">
        {PERIODS.map(([k, l]) => (
          <button key={k} className={'tog-btn' + (period === k ? ' on' : '')} onClick={() => onPeriod(k)}>{l}</button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="custom-range show">
          <span className="label">From</span>
          <input
            type="date"
            className="date-input"
            value={draftFrom}
            max={draftTo || undefined}
            onChange={(e) => setDraftFrom(e.target.value)}
            onKeyDown={onKey}
          />
          <input
            type="time"
            className="date-input time-input"
            value={draftFromTime}
            onChange={(e) => setDraftFromTime(e.target.value)}
            onKeyDown={onKey}
            title="From time (optional — leaves the From day to start at 00:00)"
            aria-label="From time"
          />
          <span className="label">To</span>
          <input
            type="date"
            className="date-input"
            value={draftTo}
            min={draftFrom || undefined}
            onChange={(e) => setDraftTo(e.target.value)}
            onKeyDown={onKey}
          />
          <input
            type="time"
            className="date-input time-input"
            value={draftToTime}
            onChange={(e) => setDraftToTime(e.target.value)}
            onKeyDown={onKey}
            title="To time (optional — leaves the To day to end at 23:59)"
            aria-label="To time"
          />
          <button
            className={'btn' + (canApply ? ' primary' : '')}
            onClick={apply}
            disabled={!canApply}
            title={valid ? 'Apply date/time range' : 'Pick a valid From and To (From ≤ To)'}
          >
            Apply
          </button>
          {(from || to || draftFrom || draftTo || draftFromTime || draftToTime) && (
            <button className="btn" onClick={clear} title="Clear date/time range">Clear</button>
          )}
        </div>
      )}

      <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />

      <span className="label">View</span>
      <div className="tog">
        {VIEWS.map(([k, l]) => (
          <button key={k} className={'tog-btn' + (view === k ? ' on blue' : '')} onClick={() => onView(k)}>{l}</button>
        ))}
      </div>

      <div style={{ marginLeft: 'auto' }}>
        <button className="btn" onClick={onRefresh} title="Refresh">
          <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" /></svg>
          Refresh
        </button>
      </div>
    </div>
  );
}
