import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const pool = new pg.Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
});

pool.on('error', (err) => console.error('[pg pool error]', err.message));

export async function q(text, params) {
  const t0 = Date.now();
  const r = await pool.query(text, params);
  const ms = Date.now() - t0;
  if (ms > 1500) console.warn(`[slow query ${ms}ms]`, text.slice(0, 120));
  return r;
}
