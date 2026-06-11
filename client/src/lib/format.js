export const fmtN = (n) => (n == null || n === 0 || n === '0') ? '—' : Number(n).toLocaleString('en-IN');

export const fmtRev = (n) => {
  const v = Number(n || 0);
  if (!v) return '—';
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + 'Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return '₹' + (v / 1e3).toFixed(0) + 'K';
  return '₹' + v;
};

export const pct = (a, b) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 100) : 0);
