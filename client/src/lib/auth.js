async function postJSON(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body || {}),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}

export const login  = (login, password) => postJSON('/api/login', { login, password });
export const logout = () => postJSON('/api/logout');

export async function me() {
  const r = await fetch('/api/me', { credentials: 'same-origin' });
  if (r.status === 401) return null;
  if (!r.ok) throw new Error(await r.text());
  const data = await r.json();
  return data.user;
}
