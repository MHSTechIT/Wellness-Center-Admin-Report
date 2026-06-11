/**
 * Auth module — verifies passwords against Odoo's `res_users.password` column.
 * Odoo uses passlib's pbkdf2_sha512 with "ab64" encoding ('.' replaces '+').
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { q } from './db.js';

const SECRET = process.env.SESSION_SECRET || 'dev-only-fallback-change-me';
const TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 12);
const COOKIE_NAME = 'mhs_session';

/* ── passlib's "ab64" base64 decoder ── */
function ab64Decode(s) {
  // passlib's ab64 uses '.' in place of '+', no padding
  const fixed = s.replace(/\./g, '+');
  const padding = (4 - (fixed.length % 4)) % 4;
  return Buffer.from(fixed + '='.repeat(padding), 'base64');
}

/**
 * Verify a password against a passlib pbkdf2_sha512 hash.
 * Format: $pbkdf2-sha512$<rounds>$<salt>$<hash>
 */
export function verifyOdooPassword(plain, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const m = stored.match(/^\$pbkdf2-sha512\$(\d+)\$([^$]+)\$([^$]+)$/);
  if (!m) return false;
  const [, rounds, saltB64, hashB64] = m;
  let salt, expected;
  try {
    salt = ab64Decode(saltB64);
    expected = ab64Decode(hashB64);
  } catch { return false; }
  const derived = crypto.pbkdf2Sync(
    Buffer.from(plain, 'utf8'),
    salt,
    Number(rounds),
    expected.length,
    'sha512'
  );
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

/* ── authenticate by login (email) + password ── */
export async function authenticate(login, password) {
  if (!login || !password) return null;

  // Demo bypass — only active when both env vars are set AND not in production.
  const demoLogin = process.env.DEMO_LOGIN;
  const demoPw = process.env.DEMO_PASSWORD;
  if (process.env.NODE_ENV !== 'production' &&
      demoLogin && demoPw &&
      login.trim().toLowerCase() === demoLogin.toLowerCase() &&
      password === demoPw) {
    return { id: 0, login: demoLogin, name: 'Demo User', isHc: false };
  }

  const r = await q(
    `SELECT u.id, u.login, u.password, u.active, u.share, u.is_health_coach_user,
            COALESCE(pr.name, u.login) AS name
       FROM res_users u
       LEFT JOIN res_partner pr ON pr.id = u.partner_id
      WHERE LOWER(u.login) = LOWER($1)
        AND u.active = TRUE
      LIMIT 1`,
    [login.trim()]
  );
  if (!r.rows.length) return null;
  const u = r.rows[0];
  if (u.share) return null;             // portal/public users — block
  if (!u.password) return null;          // OAuth-only users — block (no local password)
  if (!verifyOdooPassword(password, u.password)) return null;
  return {
    id: u.id,
    login: u.login,
    name: u.name,
    isHc: !!u.is_health_coach_user,
  };
}

/* ── sign / verify JWT ── */
export function signToken(user) {
  return jwt.sign(
    { sub: user.id, login: user.login, name: user.name, isHc: user.isHc },
    SECRET,
    { expiresIn: `${TTL_HOURS}h` }
  );
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
}

/* ── cookie helpers ── */
export const cookieOptions = (req) => ({
  httpOnly: true,
  secure: req.protocol === 'https',
  sameSite: 'lax',
  maxAge: TTL_HOURS * 60 * 60 * 1000,
  path: '/',
});

export const SESSION_COOKIE = COOKIE_NAME;

/* ── Express middleware ── */
export function requireAuth(req, res, next) {
  const tok = req.cookies?.[COOKIE_NAME];
  const claims = tok ? verifyToken(tok) : null;
  if (!claims) return res.status(401).json({ error: 'auth_required' });
  req.user = claims;
  next();
}
