import { useState } from 'react';
import * as auth from '../lib/auth.js';

const ERR_MAP = {
  invalid_credentials: 'Wrong email or password.',
  too_many_attempts: 'Too many attempts — wait a minute and try again.',
  server_error: 'Server error. Try again or contact admin.',
};

const MailIcon = () => (
  <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" /></svg>
);
const EyeIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
);
const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
);

/* Modules a user can sign in to. Add more here as the product grows. */
export const MODULES = [
  { id: 'admin',     label: 'MHS Admin Report',    icon: '📊', desc: 'Leads, walk-ins & sales analytics' },
  { id: 'incentive', label: 'Incentive Calculator', icon: '🧮', desc: 'Compute team & coach incentives' },
];

export default function Login({ onSuccess, initialModule = 'admin' }) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [module, setModule] = useState(initialModule);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const showInfo = (msg) => { setInfo(msg); setError(null); setTimeout(() => setInfo(null), 6000); };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!login || !password) return;
    setSubmitting(true); setError(null); setInfo(null);
    try {
      const { user } = await auth.login(login.trim(), password);
      onSuccess(user, module);
    } catch (err) {
      setError(ERR_MAP[err.message] || err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-bg">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src="/mhs-logo.png" alt="MHS" className="login-logo-img" />

        <h1 className="login-title">
          Welcome <span className="login-title-accent">back</span>
        </h1>
        <p className="login-sub">Please enter your details to access your account</p>

        <div className="login-input-wrap">
          <input
            className="login-input"
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="Enter your email"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            disabled={submitting}
            required
          />
          <span className="login-input-icon" aria-hidden="true"><MailIcon /></span>
        </div>

        <div className="login-input-wrap">
          <input
            className="login-input"
            type={showPw ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            required
          />
          <button
            type="button"
            className="login-input-icon"
            onClick={() => setShowPw((s) => !s)}
            tabIndex={-1}
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>

        <div className="login-forgot">
          <a onClick={() => showInfo('To reset your password, ask your admin to update it in Odoo (Settings → Users).')}>
            Forgot password?
          </a>
        </div>

        <div className="login-module">
          <label className="login-module-label" htmlFor="login-module-select">Select Module to Open</label>
          <div className="login-select-wrap">
            <select
              id="login-module-select"
              className="login-select"
              value={module}
              onChange={(e) => setModule(e.target.value)}
              disabled={submitting}
            >
              {MODULES.map((m) => (
                <option key={m.id} value={m.id}>{m.icon}  {m.label}</option>
              ))}
            </select>
            <span className="login-select-caret" aria-hidden="true">▾</span>
          </div>
        </div>

        {error && <div className="login-msg login-err">{error}</div>}
        {info && <div className="login-msg login-info">{info}</div>}

        <button className="login-btn" type="submit" disabled={submitting}>
          {submitting
            ? 'Signing in…'
            : module === 'incentive' ? 'Login → Incentive Calculator' : 'Login → Admin Report'}
        </button>

        <div className="login-foot">
          Don't have an account?
          <a onClick={() => showInfo('Ask your admin to create your Odoo user account.')}>Sign up</a>
        </div>

        <div className="login-demo">
          <b>Demo access</b> — for local testing only<br />
          <code>demo@mhs.local</code> / <code>Demo@2026</code>
          <br />
          <a
            style={{ color: '#7C3AED', cursor: 'pointer', fontWeight: 500, marginTop: 6, display: 'inline-block' }}
            onClick={() => { setLogin('demo@mhs.local'); setPassword('Demo@2026'); }}
          >
            Click to fill
          </a>
        </div>
      </form>
    </div>
  );
}
