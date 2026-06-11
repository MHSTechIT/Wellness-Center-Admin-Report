import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { callKw } = await import('../server/odoo.js');

const LEAD_ID = 306303;

// 1) Get the list of ALL field names for crm.lead
const fields = await callKw('crm.lead', 'fields_get', [], { attributes: ['string', 'type'] });
const fieldNames = Object.keys(fields);
console.log('crm.lead has', fieldNames.length, 'fields total\n');

// 2) Read the lead with ALL fields
const [lead] = await callKw('crm.lead', 'read', [[LEAD_ID]], { fields: fieldNames });
if (!lead) { console.log('Lead not found'); process.exit(1); }

console.log('═══ Lead', LEAD_ID, '·', lead.name, '═══');
console.log();

// 3) Categorise: split into "interesting" (non-empty, non-system) vs "empty"
const SKIP = /^(_|create_date|create_uid|write_date|write_uid|message_|activity_|partner_|email_cc|email_bounced|email_normalized|favorite_user_ids|favorite_caller_user_ids|display_name|tag_ids|tag_color|country_code|kanban_state|priority|color|lang_code|stage_id|active|date_action_last|date_open|date_closed|date_conversion|date_deadline|date_last_stage_update|day_open|day_close|days_to_convert|street2|recurring_revenue_monthly|recurring_revenue_monthly_prorated|prorated_revenue|recurring_plan|order_ids|quotation_count|sale_amount_total|sale_number|expected_revenue|probability|automated_probability|state_id|country_id|website|user_id|user_login|user_email|user_company_ids|company_id|currency_id|team_id|campaign_id|medium_id|source_id|website_message_ids|access_url|access_token|access_warning|has_message)$/;

const nonEmpty = [];
const empty = [];
for (const fname of fieldNames) {
  if (SKIP.test(fname)) continue;
  const v = lead[fname];
  const empty_v = v === false || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  const entry = `${fname.padEnd(40)} [${fields[fname].type.padEnd(10)}] = ${JSON.stringify(v)}`.slice(0, 250);
  (empty_v ? empty : nonEmpty).push({ fname, type: fields[fname].type, value: v, label: fields[fname].string, line: entry });
}

console.log('━━━━━━━━━━ POPULATED FIELDS (' + nonEmpty.length + ') ━━━━━━━━━━');
nonEmpty.forEach(e => console.log(e.line));
console.log();

// 4) Hunt for placeholder-matching fields
console.log('━━━━━━━━━━ FIELDS THAT MAY MATCH PLACEHOLDER COLUMNS ━━━━━━━━━━');
const KEYWORDS = ['refund','cancel','return','dropout','kit','consultation','followup','feedback','complaint','issue','service','advance','token','booking','enrollment','installment','emi','ads','spent','roas','recording'];
for (const kw of KEYWORDS) {
  const hits = fieldNames.filter(f => f.toLowerCase().includes(kw) && !SKIP.test(f));
  if (hits.length) {
    console.log('\n  Keyword "' + kw + '":');
    hits.forEach(f => {
      const v = lead[f];
      console.log('    ' + f.padEnd(40) + ' (' + fields[f].type + ', "' + fields[f].string + '") = ' + JSON.stringify(v).slice(0, 100));
    });
  }
}

process.exit(0);
