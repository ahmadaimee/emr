'use server';

import { and, eq, ilike, isNull, or, schema, sql } from '@grove/db';
import { pageContext } from './session';

export interface CodeMatch {
  code: string;
  description: string;
  billable?: boolean;
}

/**
 * ICD-10-CM (public domain). Loaded once from the official CDC/CMS order file into
 * `diagnosis_codes` via `pnpm --filter @grove/codes import icd10cm <file> <effective-date>`
 * — see packages/codes/src/cli.ts — rather than calling out to an external API on every
 * keystroke. Re-run that import each October when CMS/CDC publish the new fiscal-year
 * file (mid-year April addenda are rare but the same command applies them).
 */
export async function searchDiagnosisCodes(query: string): Promise<CodeMatch[]> {
  const term = query.trim().toUpperCase().replace(/\./g, '');
  if (term.length < 2) return [];
  const { run } = await pageContext();
  const rows = await run('/codes/diagnoses/search', async (ctx) => {
    return ctx.tx
      .select({ code: schema.diagnosisCodes.code, description: schema.diagnosisCodes.description, billable: schema.diagnosisCodes.billable })
      .from(schema.diagnosisCodes)
      .where(
        and(
          or(ilike(schema.diagnosisCodes.code, `${term}%`), ilike(schema.diagnosisCodes.description, `%${term}%`)),
          isNull(schema.diagnosisCodes.terminationDate),
        ),
      )
      .orderBy(sql`${schema.diagnosisCodes.code} = ${term} desc`, schema.diagnosisCodes.code)
      .limit(10);
  });
  return Array.isArray(rows) ? rows : [];
}

/**
 * CPT (Level I) descriptions are AMA copyrighted — they may only be shown to an
 * organisation with an AMA distributor licence on file, which is why
 * `procedureCodes.description` is nullable and populated only through the licensed
 * import path (packages/codes' CLI), never scraped or hardcoded here. HCPCS (Level II)
 * has no such restriction. This looks up whatever the org has actually loaded.
 */
export async function searchProcedureCodes(query: string): Promise<CodeMatch[]> {
  const term = query.trim().toUpperCase();
  if (term.length < 2) return [];
  const { run } = await pageContext();
  const rows = await run('/codes/procedures/search', async (ctx) => {
    return ctx.tx
      .select({ code: schema.procedureCodes.code, description: schema.procedureCodes.description, shortDescription: schema.procedureCodes.shortDescription })
      .from(schema.procedureCodes)
      .where(or(ilike(schema.procedureCodes.code, `${term}%`), ilike(schema.procedureCodes.shortDescription, `%${term}%`)))
      .limit(10);
  });
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({ code: r.code, description: r.description ?? r.shortDescription ?? '(no description on file — CPT descriptions require an AMA licence import)' }));
}

export async function verifyPlaceOfService(code: string): Promise<CodeMatch | null> {
  const { run } = await pageContext();
  const rows = await run('/codes/pos/verify', async (ctx) => {
    return ctx.tx.select({ code: schema.placeOfServiceCodes.code, name: schema.placeOfServiceCodes.name }).from(schema.placeOfServiceCodes).where(eq(schema.placeOfServiceCodes.code, code)).limit(1);
  });
  if (!Array.isArray(rows) || !rows[0]) return null;
  return { code: rows[0].code, description: rows[0].name };
}
