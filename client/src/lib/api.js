async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status}: ${await r.text()}`);
  return r.json();
}

export const health = () => getJSON('/api/health');

export function filterOptions(filters = {}) {
  const qs = new URLSearchParams(
    Object.fromEntries(Object.entries(filters).filter(([, v]) => v))
  );
  const url = '/api/filters/options' + (qs.toString() ? '?' + qs.toString() : '');
  return getJSON(url);
}

export function report({ view, period, from, to, filters }) {
  const qs = new URLSearchParams({
    view, period,
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
    ...Object.fromEntries(Object.entries(filters || {}).filter(([, v]) => v)),
  });
  return getJSON('/api/report?' + qs.toString());
}
