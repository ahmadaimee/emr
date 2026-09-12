'use server';

import { eq, ilike, or, schema, sql } from '@grove/db';
import { pageContext } from './session';

export interface PatientMatch {
  id: string;
  name: string;
  mrn: string;
  dateOfBirth: string;
  matchedOn?: string;
}

/**
 * Searches by name, MRN, date of birth, last-4 SSN, or subscriber/member ID — not just
 * name. Runs server-side rather than shipping every patient's DOB/SSN-last4 to the
 * browser for client-side filtering: SSN is a distinct, more sensitive PHI field class
 * than demographics, so only patients that actually match are ever sent down, and the
 * read is logged under 'ssn' like any other SSN-touching query.
 */
export async function searchPatients(query: string): Promise<PatientMatch[]> {
  const term = query.trim();
  if (term.length < 2) return [];

  const { run } = await pageContext();
  const digits = term.replace(/\D/g, '');
  const isSsnLast4 = /^\d{4}$/.test(digits) && digits === term.replace(/\s/g, '');

  const rows = await run('/patients/search', async (ctx, phi) => {
    const matches = await ctx.tx
      .selectDistinct({
        id: schema.patients.id,
        firstName: schema.patients.firstName,
        lastName: schema.patients.lastName,
        mrn: schema.patients.mrn,
        dateOfBirth: schema.patients.dateOfBirth,
        ssnLast4: schema.patients.ssnLast4,
      })
      .from(schema.patients)
      .leftJoin(schema.coverages, eq(schema.coverages.patientId, schema.patients.id))
      .where(
        or(
          ilike(schema.patients.firstName, `%${term}%`),
          ilike(schema.patients.lastName, `%${term}%`),
          ilike(schema.patients.mrn, `%${term}%`),
          sql`${schema.patients.dateOfBirth}::text ilike ${'%' + term + '%'}`,
          sql`to_char(${schema.patients.dateOfBirth}, 'MM/DD/YYYY') ilike ${'%' + term + '%'}`,
          isSsnLast4 ? eq(schema.patients.ssnLast4, digits) : sql`false`,
          ilike(schema.coverages.memberId, `${term}%`),
        ),
      )
      .limit(20);

    if (matches.length > 0) {
      phi.touch(
        matches.map((m) => m.id),
        ['demographics', 'ssn'],
      );
    }

    return matches;
  });

  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    id: r.id,
    name: `${r.lastName}, ${r.firstName}`,
    mrn: r.mrn,
    dateOfBirth: r.dateOfBirth,
  }));
}
