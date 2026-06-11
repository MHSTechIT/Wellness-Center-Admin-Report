const VIEWS = [
  ['all', 'All Columns'],
  ['telephony', 'Telephony'],
  ['callers', 'Callers'],
  ['sales', 'Sales Only'],
  ['health', 'Health Only'],
  ['roas', 'Revenue'],
  ['metric', 'Conversion'],
  ['l1l2', 'L1 / L2'],
  ['audit', 'Audit'],
];

export default function SavedViews({ active, onSelect }) {
  return (
    <div className="saved">
      <span className="label" style={{ marginRight: 4 }}>Views</span>
      {VIEWS.map(([k, l]) => (
        <span key={k} className={'chip' + (active === k ? ' on' : '')} onClick={() => onSelect(k)}>{l}</span>
      ))}
    </div>
  );
}
