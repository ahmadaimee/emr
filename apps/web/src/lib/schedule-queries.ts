import 'server-only';
import { and, eq, inArray, schema } from '@grove/db';
import { buildProviderDay, type RawAppointment } from './schedule';

const RANK_ORDER: Record<string, number> = { primary: 0, secondary: 1, tertiary: 2 };

/**
 * Assembles one day's book across some or all active providers: real appointments,
 * joined to the patient's name/MRN and their best-ranked active coverage (for the
 * payer label and eligibility indicator).
 */
export async function loadScheduleDay(ctx: { tx: any }, opts: { date: string; providerId?: string }) {
  const allProviders = await ctx.tx
    .select({ id: schema.providers.id, firstName: schema.providers.firstName, lastName: schema.providers.lastName, credentials: schema.providers.credentials, npi: schema.providers.npi })
    .from(schema.providers)
    .where(eq(schema.providers.active, true))
    .orderBy(schema.providers.lastName);

  const targetProviders = opts.providerId ? allProviders.filter((p: { id: string }) => p.id === opts.providerId) : allProviders;
  const providerIds = targetProviders.map((p: { id: string }) => p.id);

  const apptRows = providerIds.length
    ? await ctx.tx
        .select()
        .from(schema.appointments)
        .where(and(eq(schema.appointments.appointmentDate, opts.date), inArray(schema.appointments.providerId, providerIds)))
        .orderBy(schema.appointments.startMinutes)
    : [];

  const patientIds = [...new Set(apptRows.map((a: { patientId: string }) => a.patientId))] as string[];

  const patientRows = patientIds.length
    ? await ctx.tx.select({ id: schema.patients.id, firstName: schema.patients.firstName, lastName: schema.patients.lastName, mrn: schema.patients.mrn }).from(schema.patients).where(inArray(schema.patients.id, patientIds))
    : [];
  const patientById = new Map(patientRows.map((p: { id: string }) => [p.id, p]));

  const coverageRows = patientIds.length
    ? await ctx.tx
        .select({ patientId: schema.coverages.patientId, rank: schema.coverages.rank, payerId: schema.coverages.payerId, lastVerifiedStatus: schema.coverages.lastVerifiedStatus })
        .from(schema.coverages)
        .where(and(inArray(schema.coverages.patientId, patientIds), eq(schema.coverages.active, true)))
    : [];
  const bestCoverageByPatient = new Map<string, (typeof coverageRows)[number]>();
  for (const c of coverageRows as { patientId: string; rank: string }[]) {
    const existing = bestCoverageByPatient.get(c.patientId);
    if (!existing || (RANK_ORDER[c.rank] ?? 9) < (RANK_ORDER[existing.rank] ?? 9)) bestCoverageByPatient.set(c.patientId, c as any);
  }

  const payerIds = [...new Set([...bestCoverageByPatient.values()].map((c: any) => c.payerId).filter(Boolean))] as string[];
  const payerRows = payerIds.length ? await ctx.tx.select({ id: schema.payers.id, name: schema.payers.name }).from(schema.payers).where(inArray(schema.payers.id, payerIds)) : [];
  const payerNameById = new Map(payerRows.map((p: { id: string; name: string }) => [p.id, p.name]));

  const rawAppts: RawAppointment[] = apptRows.map((a: any) => {
    const patient = patientById.get(a.patientId) as { firstName: string; lastName: string; mrn: string } | undefined;
    const coverage = bestCoverageByPatient.get(a.patientId) as { payerId: string; lastVerifiedStatus: string | null } | undefined;
    return {
      id: a.id,
      providerId: a.providerId,
      patientId: a.patientId,
      patientName: patient ? `${patient.lastName}, ${patient.firstName}` : 'Unknown patient',
      mrn: patient?.mrn ?? '',
      startMinutes: a.startMinutes,
      durationMinutes: a.durationMinutes,
      type: a.type,
      status: a.status,
      reason: a.reason,
      payerName: coverage ? payerNameById.get(coverage.payerId) ?? null : null,
      eligibilityStatus: coverage?.lastVerifiedStatus ?? null,
      expectedCopayCents: a.expectedCopayCents,
    };
  });

  const providers = targetProviders.map((p: { id: string; firstName: string; lastName: string; credentials: string | null; npi: string }) =>
    buildProviderDay({ id: p.id, name: `Dr. ${p.firstName} ${p.lastName}`, credentials: p.credentials, npi: p.npi }, rawAppts.filter((a) => a.providerId === p.id)),
  );

  const totals = {
    appointments: rawAppts.length,
    completed: providers.reduce((s: number, p: any) => s + p.completed, 0),
    remaining: providers.reduce((s: number, p: any) => s + p.remaining, 0),
    noShows: providers.reduce((s: number, p: any) => s + p.noShows, 0),
    freeMinutes: providers.reduce((s: number, p: any) => s + p.freeMinutes, 0),
    bookedMinutes: providers.reduce((s: number, p: any) => s + p.bookedMinutes, 0),
    capacityMinutes: providers.reduce((s: number, p: any) => s + p.capacityMinutes, 0),
    expectedCopayCents: providers.reduce((s: number, p: any) => s + p.expectedCopayCents, 0),
    eligibilityIssues: rawAppts.filter((a) => a.eligibilityStatus !== 'active').length,
  };

  return {
    providers,
    totals,
    allProviders: allProviders.map((p: { id: string; firstName: string; lastName: string; credentials: string | null }) => ({ id: p.id, name: `Dr. ${p.firstName} ${p.lastName}`, credentials: p.credentials ?? '' })),
  };
}
