/**
 * Parsers for the free CMS/CDC reference files. Each takes the file's text and returns
 * rows in our table shape. Formats are documented inline because CMS changes them
 * without notice and the next person will need to know what to compare against.
 *
 * Licensing: ICD-10-CM, HCPCS, NCCI, MUE, POS and CARC/RARC are free to redistribute.
 * CPT is NOT — there is deliberately no CPT description loader here; descriptions
 * are populated only under an AMA distributor licence, through a separate path.
 */

export interface DiagnosisRow {
  code: string;
  shortDescription: string;
  description: string;
  billable: boolean;
}

/**
 * CDC/CMS `icd10cm_order_YYYY.txt`. Fixed width:
 *   cols 1-5   order number
 *   cols 7-13  code (no decimal), left-justified
 *   col  15    header flag: 0 = header (not billable), 1 = valid for submission
 *   cols 17-76 short description
 *   cols 78+   long description
 */
export function parseIcd10Order(text: string): DiagnosisRow[] {
  const out: DiagnosisRow[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.length < 78) continue;
    const code = line.slice(6, 13).trim();
    if (!code) continue;
    out.push({
      code,
      billable: line.charAt(14) === '1',
      shortDescription: line.slice(16, 76).trim(),
      description: line.slice(77).trim(),
    });
  }
  return out;
}

export interface NcciPtpRow {
  columnOneCode: string;
  columnTwoCode: string;
  effectiveDate: string;
  deletionDate: string | null;
  modifierIndicator: '0' | '1' | '9';
}

/**
 * NCCI PTP practitioner edits, CSV export. Columns (header row present):
 *   Column 1, Column 2, * = In existence prior to 1996, Effective Date, Deletion Date, Modifier 0=not allowed 1=allowed 9=not applicable, PTP Edit Rationale
 * Dates are YYYYMMDD. A deletion date of "*" means none.
 */
export function parseNcciPtp(text: string): NcciPtpRow[] {
  const rows = parseCsv(text);
  const out: NcciPtpRow[] = [];
  for (const r of rows.slice(1)) {
    const [c1, c2, , eff, del, mod] = r;
    if (!c1 || !c2 || !eff || !/^\d{8}$/.test(eff)) continue;
    const indicator = (mod ?? '').trim().charAt(0);
    if (indicator !== '0' && indicator !== '1' && indicator !== '9') continue;
    out.push({ columnOneCode: c1.trim(), columnTwoCode: c2.trim(), effectiveDate: yyyymmdd(eff), deletionDate: del && /^\d{8}$/.test(del) ? yyyymmdd(del) : null, modifierIndicator: indicator });
  }
  return out;
}

export interface MueRow {
  code: string;
  maxUnits: number;
  mai: '1' | '2' | '3';
  rationale: string | null;
}

/**
 * MUE practitioner services, CSV export. Columns:
 *   HCPCS/CPT Code, Practitioner Services MUE Values, MUE Adjudication Indicator, MUE Rationale
 * The MAI column reads like "2 Date of Service Edit: Policy"; the leading digit is the indicator.
 */
export function parseMue(text: string): MueRow[] {
  const rows = parseCsv(text);
  const out: MueRow[] = [];
  for (const r of rows.slice(1)) {
    const [code, units, mai, rationale] = r;
    const m = (mai ?? '').trim().charAt(0);
    const n = Number(units);
    if (!code || !Number.isInteger(n) || (m !== '1' && m !== '2' && m !== '3')) continue;
    out.push({ code: code.trim(), maxUnits: n, mai: m, rationale: rationale?.trim() || null });
  }
  return out;
}

export interface AddOnRow {
  addOnCode: string;
  primaryCode: string;
  addOnType: string;
  effectiveDate: string;
  deletionDate: string | null;
}

/**
 * NCCI add-on code edits, CSV. Columns:
 *   Add-on Code, Primary Code, Type (1/2/3), Effective Date, Deletion Date
 */
export function parseAddOnCodes(text: string): AddOnRow[] {
  const rows = parseCsv(text);
  const out: AddOnRow[] = [];
  for (const r of rows.slice(1)) {
    const [addOn, primary, type, eff, del] = r;
    if (!addOn || !eff || !/^\d{8}$/.test(eff)) continue;
    out.push({ addOnCode: addOn.trim(), primaryCode: (primary ?? '').trim() || '*', addOnType: (type ?? '1').trim(), effectiveDate: yyyymmdd(eff), deletionDate: del && /^\d{8}$/.test(del) ? yyyymmdd(del) : null });
  }
  return out;
}

export interface ReasonCodeRow {
  codeType: 'CARC' | 'RARC';
  code: string;
  description: string;
  effectiveDate: string | null;
  deactivatedDate: string | null;
}

/**
 * X12 external code list export (CARC list 139 / RARC list 411), CSV:
 *   Code, Description, Start Date, Last Modified, Stop Date, Notes
 */
export function parseReasonCodes(text: string, codeType: 'CARC' | 'RARC'): ReasonCodeRow[] {
  const rows = parseCsv(text);
  const out: ReasonCodeRow[] = [];
  for (const r of rows.slice(1)) {
    const [code, description, start, , stop] = r;
    if (!code || !description) continue;
    out.push({ codeType, code: code.trim(), description: description.trim(), effectiveDate: toIsoDate(start), deactivatedDate: toIsoDate(stop) });
  }
  return out;
}

export interface ProcedureRow {
  code: string;
  description: string;
  shortDescription: string | null;
}

/**
 * Generic procedure-code CSV: Code, Description, Short Description (header row present).
 * Used for both HCPCS Level II (public domain — export straight from the CMS HCPCS
 * quarterly file) and CPT (Level I) — for CPT, this must be built from your own
 * AMA-licensed data file; this loader has no opinion on where the CSV came from, but
 * `procedureCodes.description` may only be populated for an org whose AMA distributor
 * licence is on file. Never construct this file from scraped or unlicensed sources.
 */
export function parseProcedureCodes(text: string): ProcedureRow[] {
  const rows = parseCsv(text);
  const out: ProcedureRow[] = [];
  for (const r of rows.slice(1)) {
    const [code, description, shortDescription] = r;
    if (!code || !description) continue;
    out.push({ code: code.trim().toUpperCase(), description: description.trim(), shortDescription: shortDescription?.trim() || null });
  }
  return out;
}

// ---------------------------------------------------------------------------

/** RFC 4180-ish CSV: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

function yyyymmdd(v: string): string {
  return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
}

function toIsoDate(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (/^\d{8}$/.test(t)) return yyyymmdd(t);
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1]!.padStart(2, '0')}-${m[2]!.padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return null;
}
