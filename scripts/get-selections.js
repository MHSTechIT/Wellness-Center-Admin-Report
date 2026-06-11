import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { callKw } = await import('../server/odoo.js');

const f = await callKw('crm.lead', 'fields_get', [], { attributes: ['string', 'type', 'selection'] });

const TARGETS = [
  'consultation_status',
  'recording_status',
  'welcome_kit_status',
  'pstatus_advance',
  'pstatus_emi',
  'pstatus_inst3',
  'payment_plan',
  'payment_status_summary',
  'followup_status',
  'collection_status',
  'collection_payment_type',
  'paid_feedback_outcome',
  'walkin_status',
  'walkin_call_status',
  'walkin_visit_status',
  'walkin_visited_radio',
  'walkin_appt_confirm_status',
  'program_suggested',
  'emi_payment_status',
  'advance_mode',
  'emi_provider',
];

for (const fname of TARGETS) {
  const meta = f[fname];
  if (!meta) { console.log(fname, '— NOT FOUND'); continue; }
  console.log('\n' + fname.padEnd(28), '(' + meta.type + ', "' + meta.string + '"):');
  if (meta.selection) {
    meta.selection.forEach(([code, label]) => console.log('   ' + code.padEnd(28) + ' → "' + label + '"'));
  }
}
process.exit(0);
