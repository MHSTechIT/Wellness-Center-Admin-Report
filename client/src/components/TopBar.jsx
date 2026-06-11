import { useEffect, useRef, useState } from 'react';
import { fmtN } from '../lib/format.js';

export default function TopBar({ leadCount, online, theme, user, onToggleTheme, onLogout }) {
  const [now, setNow] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onDocClick(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const dateStr = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const initial = (user?.name || user?.login || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="topbar">
      <img src="/mhs-logo.png" alt="MHS" className="logo-img" />
      <span className="tb-title">MHS · Admin Report</span>
      <span className="tb-badge">Live · Read-only</span>
      <div className="tb-right">
        <span className={'tb-conn' + (online ? '' : ' bad')}>
          <span className="dot" />
          {online ? `Live · ${fmtN(leadCount)} leads` : 'Offline'}
        </span>
        <button className="theme-btn" onClick={onToggleTheme} title="Toggle theme">
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <span className="tb-date">{dateStr}</span>
        {user && (
          <div className="user-menu" ref={menuRef}>
            <button className="user-btn" onClick={() => setMenuOpen((o) => !o)} title={user.login}>
              <span className="user-av">{initial}</span>
              <span className="user-name">{user.name}</span>
              {user.isHc && <span className="user-tag">HC</span>}
              <span className="user-caret">▾</span>
            </button>
            {menuOpen && (
              <div className="user-dropdown">
                <div className="ud-info">
                  <div className="ud-name">{user.name}</div>
                  <div className="ud-login">{user.login}</div>
                </div>
                <button className="ud-item" onClick={onLogout}>Sign out</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
