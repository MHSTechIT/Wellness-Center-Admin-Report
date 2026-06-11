import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

const start = Date.now();
try {
  console.log(`[1/3] Connecting to ${process.env.PGHOST}:${process.env.PGPORT} ...`);
  await client.connect();
  console.log(`[2/3] Connected in ${Date.now() - start} ms`);

  const v = await client.query('SELECT version(), current_user, current_database()');
  console.log('[3/3] Server info:');
  console.log('  version  :', v.rows[0].version.split(',')[0]);
  console.log('  user     :', v.rows[0].current_user);
  console.log('  database :', v.rows[0].current_database);

  const sizes = await client.query(`
    SELECT
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public') AS public_tables,
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'mhs_%') AS mhs_tables,
      (SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'x_%') AS studio_tables
  `);
  console.log('Schema overview:', sizes.rows[0]);
  process.exit(0);
} catch (err) {
  console.error('CONNECTION FAILED:', err.code || '', err.message);
  if (err.message.includes('timeout') || err.code === 'ETIMEDOUT') {
    console.error('\n--> Likely cause: your public IP is not in the RDS security group.');
    console.error('    Get your IP at https://ipv4.icanhazip.com and ask DB owner to allowlist it on port 5432.');
  }
  process.exit(1);
}
