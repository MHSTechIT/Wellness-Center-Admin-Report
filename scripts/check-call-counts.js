import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const { callKw } = await import('../server/odoo.js');

const r = await callKw('walkin.team.dashboard', 'get_dashboard_data', [], {
  from_date: '2026-04-01', to_date: '2026-04-30',
});
console.log('call_counts_by_date (first 5):');
console.log(JSON.stringify(r.call_counts_by_date?.slice?.(0, 5), null, 2));
console.log('\ncall_counts_by_date length:', r.call_counts_by_date?.length);
console.log('\nstatus_pie_data (first 5):');
console.log(JSON.stringify(r.status_pie_data?.slice?.(0, 5), null, 2));
console.log('\nbatch_data (first 5):');
console.log(JSON.stringify(r.batch_data?.slice?.(0, 5), null, 2));

process.exit(0);
