/**
 * Reference data importer.
 *
 *   pnpm --filter @grove/codes import icd10cm ./icd10cm_order_2026.txt 2026-10-01
 *   pnpm --filter @grove/codes import ncci_ptp ./ccipract.csv 2026-10-01
 *   pnpm --filter @grove/codes import mue ./mue_pract.csv 2026-10-01
 *   pnpm --filter @grove/codes import addon ./addon.csv 2026-10-01
 *   pnpm --filter @grove/codes import carc ./carc.csv
 *   pnpm --filter @grove/codes import rarc ./rarc.csv
 *   pnpm --filter @grove/codes import pos
 *   pnpm --filter @grove/codes import hcpcs ./hcpcs.csv 2026-01-01
 *   pnpm --filter @grove/codes import cpt ./cpt.csv 2026-01-01
 *
 * `cpt` expects a CSV of Code,Description,Short Description that YOU build from your
 * own AMA-licensed CPT data file — this tool never ships or fetches CPT text itself.
 * `hcpcs` is public domain and can be exported straight from the CMS quarterly file.
 *
 * Runs as the owner role: reference tables are global (no org_id) and read by every
 * tenant. Each import is recorded in code_set_versions with a checksum.
 */
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import postgres from 'postgres';
import { parseAddOnCodes, parseIcd10Order, parseMue, parseNcciPtp, parseProcedureCodes, parseReasonCodes } from './parsers';
import { PLACE_OF_SERVICE_CODES } from './pos';

const [set, file, effective] = process.argv.slice(2);
if (!set || (set !== 'pos' && !file)) {
  console.error('usage: import <icd10cm|ncci_ptp|mue|addon|carc|rarc|hcpcs|cpt> <file> [effective-date]');
  console.error('       import pos');
  process.exit(2);
}
const url = process.env.DATABASE_MIGRATION_URL;
if (!url) throw new Error('DATABASE_MIGRATION_URL is not set');

const sql = postgres(url, { max: 1 });
const text = set === 'pos' ? '' : await readFile(file!, 'utf8');
const checksum = createHash('sha256').update(text).digest('hex');
const eff = effective ?? new Date().toISOString().slice(0, 10);
let count = 0;

try {
  await sql.begin(async (tx) => {
    switch (set) {
      case 'pos': {
        await tx`insert into place_of_service_codes ${tx(PLACE_OF_SERVICE_CODES.map((r) => ({ code: r.code, name: r.name, facility_rate: r.facilityRate })))} on conflict (code) do update set name = excluded.name, facility_rate = excluded.facility_rate`;
        count = PLACE_OF_SERVICE_CODES.length;
        break;
      }
      case 'icd10cm': {
        const rows = parseIcd10Order(text);
        for (const chunk of chunks(rows, 1000)) {
          await tx`insert into diagnosis_codes ${tx(chunk.map((r) => ({ code: r.code, description: r.description, short_description: r.shortDescription, billable: r.billable, effective_date: eff })))} on conflict (code, effective_date) do update set description = excluded.description, short_description = excluded.short_description, billable = excluded.billable`;
        }
        count = rows.length;
        break;
      }
      case 'ncci_ptp': {
        const rows = parseNcciPtp(text);
        for (const chunk of chunks(rows, 1000)) {
          await tx`insert into ncci_ptp_edits ${tx(chunk.map((r) => ({ edit_set: 'practitioner', column_one_code: r.columnOneCode, column_two_code: r.columnTwoCode, modifier_indicator: r.modifierIndicator, effective_date: r.effectiveDate, deletion_date: r.deletionDate })))} on conflict (edit_set, column_one_code, column_two_code, effective_date) do update set modifier_indicator = excluded.modifier_indicator, deletion_date = excluded.deletion_date`;
        }
        count = rows.length;
        break;
      }
      case 'mue': {
        const rows = parseMue(text);
        for (const chunk of chunks(rows, 1000)) {
          await tx`insert into mue_edits ${tx(chunk.map((r) => ({ edit_set: 'practitioner', code: r.code, max_units: r.maxUnits, mai: r.mai, rationale: r.rationale, effective_date: eff })))} on conflict (edit_set, code, effective_date) do update set max_units = excluded.max_units, mai = excluded.mai, rationale = excluded.rationale`;
        }
        count = rows.length;
        break;
      }
      case 'addon': {
        const rows = parseAddOnCodes(text);
        for (const chunk of chunks(rows, 1000)) {
          await tx`insert into add_on_code_edits ${tx(chunk.map((r) => ({ add_on_code: r.addOnCode, primary_code: r.primaryCode, add_on_type: r.addOnType, effective_date: r.effectiveDate, deletion_date: r.deletionDate })))} on conflict (add_on_code, primary_code, effective_date) do update set add_on_type = excluded.add_on_type, deletion_date = excluded.deletion_date`;
        }
        count = rows.length;
        break;
      }
      case 'cpt':
      case 'hcpcs': {
        const codeSystem = set === 'cpt' ? 'CPT' : 'HCPCS';
        const rows = parseProcedureCodes(text);
        for (const chunk of chunks(rows, 1000)) {
          await tx`insert into procedure_codes ${tx(chunk.map((r) => ({ code: r.code, code_system: codeSystem, description: r.description, short_description: r.shortDescription, effective_date: eff })))} on conflict (code, code_system, effective_date) do update set description = excluded.description, short_description = excluded.short_description`;
        }
        count = rows.length;
        break;
      }
      case 'carc':
      case 'rarc': {
        const rows = parseReasonCodes(text, set.toUpperCase() as 'CARC' | 'RARC');
        for (const chunk of chunks(rows, 1000)) {
          await tx`insert into adjustment_reason_codes ${tx(chunk.map((r) => ({ code_type: r.codeType, code: r.code, description: r.description, effective_date: r.effectiveDate, deactivated_date: r.deactivatedDate })))} on conflict (code_type, code) do update set description = excluded.description, effective_date = excluded.effective_date, deactivated_date = excluded.deactivated_date`;
        }
        count = rows.length;
        break;
      }
      default:
        throw new Error(`Unknown code set ${set}`);
    }
    await tx`insert into code_set_versions (code_set, version, effective_date, record_count, source_url, checksum) values (${set}, ${eff}, ${eff}, ${count}, ${file ?? 'packages/codes/src/pos.ts'}, ${checksum}) on conflict (code_set, version) do update set record_count = excluded.record_count, checksum = excluded.checksum`;
  });
  console.log(`✓ ${set}: ${count} rows loaded (effective ${eff}, sha256 ${checksum.slice(0, 12)})`);
} finally {
  await sql.end();
}

function* chunks<T>(arr: T[], size: number): Generator<T[]> {
  for (let i = 0; i < arr.length; i += size) yield arr.slice(i, i + size);
}
