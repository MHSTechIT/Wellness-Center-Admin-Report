import { q } from '../server/db.js';

console.log('--- smartflo_call_log columns ---');
const cols = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='smartflo_call_log' ORDER BY ordinal_position`);
cols.rows.forEach(c => console.log(' ', c.column_name, '::', c.data_type));

console.log('\n--- call_log_summary columns ---');
const cols2 = await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='call_log_summary' ORDER BY ordinal_position`);
cols2.rows.forEach(c => console.log(' ', c.column_name, '::', c.data_type));

console.log('\n--- sample row from smartflo_call_log ---');
const s = await q('SELECT * FROM smartflo_call_log ORDER BY id DESC LIMIT 2');
s.rows.forEach(r => console.log(' ', JSON.stringify(r)));

console.log('\n--- sample row from call_log_summary ---');
const s2 = await q('SELECT * FROM call_log_summary ORDER BY id DESC LIMIT 2');
s2.rows.forEach(r => console.log(' ', JSON.stringify(r)));

process.exit(0);
