import { and, eq, inArray, schema } from '@grove/db';
import type { ClaimFacts, LineFacts } from '@grove/rules';
import type { ProfessionalClaim, Provider, ServiceLine } from '@grove/x12';
import { NotFoundError, type CommandContext } from '../context';

/**
 * Everything needed to build, scrub, and render one claim, loaded once. Kept as plain
 * row shapes so the mapping functions below are pure and unit-testable without a
 * database.
 */
export interface ClaimAssembly {
  organization: typeof schema.organizations.$inferSelect;
  claim: typeof schema.claims.$inferSelect;
  encounter: typeof schema.encounters.$inferSelect;
  lines: Array<typeof schema.serviceLines.$inferSelect>;
  patient: typeof schema.patients.$inferSelect;
  coverage: typeof schema.coverages.$inferSelect;
  payer: typeof schema.payers.$inferSelect;
  plan: typeof schema.payerPlans.$inferSelect | null;
  practice: typeof schema.practices.$inferSelect;
  location: typeof schema.locations.$inferSelect;
  renderingProvider: typeof schema.providers.$inferSelect;
  referringProvider: typeof schema.providers.$inferSelect | null;
  supervisingProvider: typeof schema.providers.$inferSelect | null;
  renderingEnrollment: typeof schema.providerEnrollments.$inferSelect | null;
  /** Other claims' lines for the same patient and dates, for MUE MAI 2/3. */
  sameDayLinesOnOtherClaims: Array<Pick<typeof schema.serviceLines.$inferSelect, 'procedureCode' | 'units' | 'modifier1' | 'modifier2' | 'modifier3' | 'modifier4'>>;
  /** For secondary claims: what the prior payer did. */
  priorAdjudications: Array<typeof schema.claimLinePriorAdjudications.$inferSelect>;
  primaryRemittanceClaim: typeof schema.remittanceClaims.$inferSelect | null;
  primaryCoverage: typeof schema.coverages.$inferSelect | null;
  primaryPayer: typeof schema.payers.$inferSelect | null;
}

export async function loadClaimAssembly(ctx: CommandContext, claimId: string): Promise<ClaimAssembly> {
  const orgId = ctx.tenant.orgId;
  const [claim] = await ctx.tx.select().from(schema.claims).where(eq(schema.claims.id, claimId));
  if (!claim) throw new NotFoundError('claim', claimId);

  const [organization] = await ctx.tx.select().from(schema.organizations).where(eq(schema.organizations.id, orgId));
  const [encounter] = await ctx.tx.select().from(schema.encounters).where(eq(schema.encounters.id, claim.encounterId));
  const [patient] = await ctx.tx.select().from(schema.patients).where(eq(schema.patients.id, claim.patientId));
  const [coverage] = await ctx.tx.select().from(schema.coverages).where(eq(schema.coverages.id, claim.coverageId));
  const [payer] = await ctx.tx.select().from(schema.payers).where(eq(schema.payers.id, claim.payerId));
  const [practice] = await ctx.tx.select().from(schema.practices).where(eq(schema.practices.id, claim.practiceId));
  if (!organization || !encounter || !patient || !coverage || !payer || !practice) {
    throw new NotFoundError('claim assembly', claimId);
  }
  const [location] = await ctx.tx.select().from(schema.locations).where(eq(schema.locations.id, encounter.locationId));
  const [renderingProvider] = await ctx.tx.select().from(schema.providers).where(eq(schema.providers.id, encounter.renderingProviderId));
  if (!location || !renderingProvider) throw new NotFoundError('claim assembly', claimId);

  const lines = await ctx.tx
    .select()
    .from(schema.serviceLines)
    .where(eq(schema.serviceLines.encounterId, encounter.id))
    .orderBy(schema.serviceLines.lineNumber);

  const plan = coverage.planId ? (await ctx.tx.select().from(schema.payerPlans).where(eq(schema.payerPlans.id, coverage.planId)))[0] ?? null : null;
  const referringProvider = encounter.referringProviderId ? (await ctx.tx.select().from(schema.providers).where(eq(schema.providers.id, encounter.referringProviderId)))[0] ?? null : null;
  const supervisingProvider = encounter.supervisingProviderId ? (await ctx.tx.select().from(schema.providers).where(eq(schema.providers.id, encounter.supervisingProviderId)))[0] ?? null : null;
  const [renderingEnrollment] = await ctx.tx
    .select()
    .from(schema.providerEnrollments)
    .where(and(eq(schema.providerEnrollments.providerId, renderingProvider.id), eq(schema.providerEnrollments.payerId, payer.id)));

  // Lines on OTHER claims for the same patient and date(s) of service.
  const otherEncounters = await ctx.tx
    .select({ id: schema.encounters.id })
    .from(schema.encounters)
    .where(and(eq(schema.encounters.patientId, patient.id), eq(schema.encounters.serviceDate, encounter.serviceDate)));
  const otherIds = otherEncounters.map((e) => e.id).filter((id) => id !== encounter.id);
  const sameDayLinesOnOtherClaims = otherIds.length
    ? await ctx.tx
        .select({
          procedureCode: schema.serviceLines.procedureCode,
          units: schema.serviceLines.units,
          modifier1: schema.serviceLines.modifier1,
          modifier2: schema.serviceLines.modifier2,
          modifier3: schema.serviceLines.modifier3,
          modifier4: schema.serviceLines.modifier4,
        })
        .from(schema.serviceLines)
        .where(inArray(schema.serviceLines.encounterId, otherIds))
    : [];

  let priorAdjudications: ClaimAssembly['priorAdjudications'] = [];
  let primaryRemittanceClaim: ClaimAssembly['primaryRemittanceClaim'] = null;
  let primaryCoverage: ClaimAssembly['primaryCoverage'] = null;
  let primaryPayer: ClaimAssembly['primaryPayer'] = null;
  if (claim.coverageRank !== 'primary' && claim.primaryRemittanceClaimId) {
    primaryRemittanceClaim = (await ctx.tx.select().from(schema.remittanceClaims).where(eq(schema.remittanceClaims.id, claim.primaryRemittanceClaimId)))[0] ?? null;
    if (primaryRemittanceClaim?.claimId) {
      const [primaryClaim] = await ctx.tx.select().from(schema.claims).where(eq(schema.claims.id, primaryRemittanceClaim.claimId));
      if (primaryClaim) {
        primaryCoverage = (await ctx.tx.select().from(schema.coverages).where(eq(schema.coverages.id, primaryClaim.coverageId)))[0] ?? null;
        primaryPayer = (await ctx.tx.select().from(schema.payers).where(eq(schema.payers.id, primaryClaim.payerId)))[0] ?? null;
        priorAdjudications = await ctx.tx
          .select()
          .from(schema.claimLinePriorAdjudications)
          .where(and(eq(schema.claimLinePriorAdjudications.claimId, primaryClaim.id), eq(schema.claimLinePriorAdjudications.priorPayerId, primaryClaim.payerId)));
      }
    }
  }

  return {
    organization, claim, encounter, lines, patient, coverage, payer, plan, practice, location,
    renderingProvider, referringProvider, supervisingProvider, renderingEnrollment: renderingEnrollment ?? null,
    sameDayLinesOnOtherClaims, priorAdjudications, primaryRemittanceClaim, primaryCoverage, primaryPayer,
  };
}

// ---------------------------------------------------------------------------
// Pure mappings
// ---------------------------------------------------------------------------

const strip = (code: string) => code.replace('.', '').toUpperCase();
const mods = (l: { modifier1: string | null; modifier2: string | null; modifier3: string | null; modifier4: string | null }) =>
  [l.modifier1, l.modifier2, l.modifier3, l.modifier4].filter((m): m is string => Boolean(m));

function providerToX12(p: typeof schema.providers.$inferSelect, enrollment?: typeof schema.providerEnrollments.$inferSelect | null): Provider {
  return {
    isPerson: true,
    person: { lastName: p.lastName.toUpperCase(), firstName: p.firstName.toUpperCase(), middleName: p.middleName?.toUpperCase(), suffix: p.suffix ?? undefined },
    npi: p.npi,
    taxonomyCode: enrollment?.enrolledTaxonomyCode ?? p.taxonomyCode ?? undefined,
    secondaryIds: enrollment?.ptan ? [{ qualifier: 'G2', value: enrollment.ptan }] : undefined,
  };
}

/** Build the transport-neutral 837P model from loaded rows. */
export function assembleProfessionalClaim(a: ClaimAssembly): ProfessionalClaim {
  const { claim, encounter, patient, coverage, payer, practice, location, lines } = a;
  const subscriberIsPatient = coverage.relationshipCode === '18';

  const billingProvider: Provider = {
    isPerson: false,
    organization: { name: practice.name.toUpperCase() },
    npi: practice.npi ?? a.renderingProvider.npi,
    taxonomyCode: practice.taxonomyCode ?? undefined,
    taxId: practice.taxId ?? undefined,
    taxIdType: practice.taxIdType === 'SY' ? 'SY' : 'EI',
    address: { line1: location.line1.toUpperCase(), line2: location.line2?.toUpperCase(), city: location.city.toUpperCase(), state: location.state, postalCode: location.postalCode },
  };

  const x12Lines: ServiceLine[] = lines
    .filter((l) => !l.voidedAt)
    .map((l) => {
      const prior = a.priorAdjudications.filter((p) => p.serviceLineId === l.id);
      return {
        lineNumber: l.lineNumber,
        procedureCode: l.procedureCode,
        modifiers: mods(l),
        chargeCents: l.chargeCents,
        units: l.units,
        unitType: l.unitType === 'MJ' ? 'MJ' : 'UN',
        diagnosisPointers: l.diagnosisPointers,
        serviceDate: l.serviceDate,
        serviceDateThrough: l.serviceDateThrough ?? undefined,
        placeOfService: l.placeOfService ?? undefined,
        emergency: l.emergency,
        epsdt: l.epsdt,
        familyPlanning: l.familyPlanning,
        lineControlNumber: `L${l.lineNumber}`,
        ndc: l.ndcCode ? { code: l.ndcCode, quantity: (l.ndcQuantity ?? 1000) / 1000, unit: l.ndcUnitOfMeasure ?? 'UN' } : undefined,
        priorAdjudications: prior.length
          ? prior.map((p) => ({
              payerId: a.primaryPayer?.payerIdCode ?? '',
              procedureCode: p.procedureCode,
              modifiers: p.modifiers ?? [],
              paidAmountCents: p.paidAmountCents,
              paidUnits: p.paidUnits ?? undefined,
              adjudicationDate: p.adjudicationDate,
              adjustments: (p.adjustments as Array<{ group: 'CO' | 'PR' | 'OA' | 'PI' | 'CR'; reasonCode: string; amountCents: number; quantity?: number }>),
            }))
          : undefined,
      };
    });

  const out: ProfessionalClaim = {
    patientControlNumber: claim.claimNumber,
    totalChargeCents: x12Lines.reduce((s, l) => s + l.chargeCents, 0),
    placeOfService: encounter.placeOfService,
    frequencyCode: claim.frequency === 'replacement' ? '7' : claim.frequency === 'void' ? '8' : '1',
    originalPayerClaimControlNumber: claim.payerClaimControlNumber ?? undefined,
    providerSignatureOnFile: true,
    assignmentCode: practice.acceptsAssignment ? 'A' : 'C',
    benefitsAssigned: coverage.assignmentOfBenefits,
    releaseOfInformation: coverage.releaseOfInformation === 'I' ? 'I' : 'Y',
    relatedCauses: encounter.relatedToAutoAccident || encounter.relatedToEmployment || encounter.relatedToOtherAccident
      ? { autoAccident: encounter.relatedToAutoAccident, employment: encounter.relatedToEmployment, otherAccident: encounter.relatedToOtherAccident, state: encounter.accidentState ?? undefined }
      : undefined,
    diagnoses: encounter.diagnosisCodes.map(strip),
    dates: {
      onset: encounter.onsetDate ?? undefined,
      initialTreatment: encounter.initialTreatmentDate ?? undefined,
      lastSeen: encounter.lastSeenDate ?? undefined,
      accident: encounter.accidentDate ?? undefined,
      hospitalizedFrom: encounter.hospitalizedFrom ?? undefined,
      hospitalizedTo: encounter.hospitalizedTo ?? undefined,
    },
    priorAuthorizationNumber: encounter.priorAuthorizationNumber ?? undefined,
    referralNumber: encounter.referralNumber ?? undefined,
    cliaNumber: encounter.clia ?? undefined,
    billingProvider,
    renderingProvider: providerToX12(a.renderingProvider, a.renderingEnrollment),
    referringProvider: a.referringProvider ? providerToX12(a.referringProvider) : undefined,
    supervisingProvider: a.supervisingProvider ? providerToX12(a.supervisingProvider) : undefined,
    // Service facility is required when the place of service is not the billing address.
    serviceFacility: location.npi && location.npi !== practice.npi
      ? { isPerson: false, organization: { name: location.name.toUpperCase() }, npi: location.npi, address: billingProvider.address }
      : undefined,
    subscriber: {
      person: subscriberIsPatient
        ? { lastName: patient.lastName.toUpperCase(), firstName: patient.firstName.toUpperCase(), middleName: patient.middleName?.toUpperCase(), suffix: patient.suffix ?? undefined }
        : { lastName: (coverage.subscriberLastName ?? '').toUpperCase(), firstName: (coverage.subscriberFirstName ?? '').toUpperCase() },
      memberId: coverage.memberId,
      groupNumber: coverage.groupNumber ?? undefined,
      groupName: coverage.groupName ?? undefined,
      dateOfBirth: subscriberIsPatient ? patient.dateOfBirth : coverage.subscriberDateOfBirth ?? undefined,
      sex: subscriberIsPatient ? patient.sex : ((coverage.subscriberSex as 'M' | 'F' | 'U' | null) ?? undefined),
      address: subscriberIsPatient
        ? patientAddress(patient)
        : coverage.subscriberAddressLine1
          ? { line1: coverage.subscriberAddressLine1.toUpperCase(), city: (coverage.subscriberCity ?? '').toUpperCase(), state: coverage.subscriberState ?? '', postalCode: coverage.subscriberPostalCode ?? '' }
          : undefined,
      relationshipToPatient: coverage.relationshipCode,
    },
    patient: subscriberIsPatient
      ? undefined
      : {
          person: { lastName: patient.lastName.toUpperCase(), firstName: patient.firstName.toUpperCase(), middleName: patient.middleName?.toUpperCase(), suffix: patient.suffix ?? undefined },
          dateOfBirth: patient.dateOfBirth,
          sex: patient.sex,
          address: patientAddress(patient) ?? { line1: '', city: '', state: '', postalCode: '' },
          relationshipToSubscriber: coverage.relationshipCode,
        },
    payer: {
      name: payer.name.toUpperCase(),
      payerId: payer.payerIdCode ?? '',
      claimFilingIndicator: payer.claimFilingIndicator ?? 'CI',
      address: payer.addressLine1 ? { line1: payer.addressLine1.toUpperCase(), city: (payer.city ?? '').toUpperCase(), state: payer.state ?? '', postalCode: payer.postalCode ?? '' } : undefined,
    },
    payerSequence: claim.coverageRank === 'secondary' ? 'S' : claim.coverageRank === 'tertiary' ? 'T' : 'P',
    lines: x12Lines,
  };

  // Coordination of benefits: describe the primary payer's adjudication.
  if (out.payerSequence !== 'P' && a.primaryRemittanceClaim && a.primaryCoverage && a.primaryPayer) {
    const rc = a.primaryRemittanceClaim;
    out.otherSubscribers = [
      {
        sequence: 'P',
        relationshipToPatient: a.primaryCoverage.relationshipCode,
        person: out.subscriber.person,
        memberId: a.primaryCoverage.memberId,
        groupNumber: a.primaryCoverage.groupNumber ?? undefined,
        claimFilingIndicator: a.primaryPayer.claimFilingIndicator ?? 'CI',
        payer: { name: a.primaryPayer.name.toUpperCase(), payerId: a.primaryPayer.payerIdCode ?? '', claimFilingIndicator: a.primaryPayer.claimFilingIndicator ?? 'CI' },
        payerClaimControlNumber: rc.payerClaimControlNumber ?? undefined,
        paidAmountCents: rc.totalPaidCents,
        claimAdjustments: [],
        remainingPatientLiabilityCents: rc.patientResponsibilityCents,
      },
    ];
  }

  return out;
}

function patientAddress(p: typeof schema.patients.$inferSelect) {
  return p.addressLine1
    ? { line1: p.addressLine1.toUpperCase(), line2: p.addressLine2?.toUpperCase(), city: (p.city ?? '').toUpperCase(), state: p.state ?? '', postalCode: p.postalCode ?? '' }
    : undefined;
}

/** Build the rules-engine view of the same claim. */
export function assembleClaimFacts(a: ClaimAssembly, today: string): ClaimFacts {
  const { claim, encounter, patient, coverage, payer, plan, practice, location, lines } = a;
  const ageAtService = yearsBetween(patient.dateOfBirth, encounter.serviceDate);
  const lineFacts: LineFacts[] = lines
    .filter((l) => !l.voidedAt)
    .map((l) => ({
      lineNumber: l.lineNumber,
      procedureCode: l.procedureCode,
      modifiers: mods(l),
      units: l.units,
      chargeCents: l.chargeCents,
      diagnosisPointers: l.diagnosisPointers,
      serviceDate: l.serviceDate,
      placeOfService: l.placeOfService ?? encounter.placeOfService,
      renderingProviderNpi: a.renderingProvider.npi,
      abnObtained: l.abnObtained,
      ndcCode: l.ndcCode ?? undefined,
      emergency: l.emergency,
    }));

  return {
    claim: {
      id: claim.id,
      claimNumber: claim.claimNumber,
      type: claim.type === 'institutional' ? 'institutional' : 'professional',
      frequencyCode: claim.frequency === 'replacement' ? '7' : claim.frequency === 'void' ? '8' : '1',
      originalPayerClaimControlNumber: claim.payerClaimControlNumber ?? undefined,
      placeOfService: encounter.placeOfService,
      totalChargeCents: lineFacts.reduce((s, l) => s + l.chargeCents, 0),
      serviceDateFrom: encounter.serviceDate,
      serviceDateThrough: encounter.serviceDateThrough ?? undefined,
      diagnoses: encounter.diagnosisCodes.map(strip),
      priorAuthorizationNumber: encounter.priorAuthorizationNumber ?? undefined,
      referralNumber: encounter.referralNumber ?? undefined,
      payerSequence: claim.coverageRank === 'secondary' ? 'S' : claim.coverageRank === 'tertiary' ? 'T' : 'P',
      relatedToAutoAccident: encounter.relatedToAutoAccident,
      relatedToEmployment: encounter.relatedToEmployment,
      accidentDate: encounter.accidentDate ?? undefined,
    },
    lines: lineFacts,
    patient: { id: patient.id, dateOfBirth: patient.dateOfBirth, sex: patient.sex, ageAtService, state: patient.state ?? undefined },
    coverage: {
      memberId: coverage.memberId,
      groupNumber: coverage.groupNumber ?? undefined,
      relationshipCode: coverage.relationshipCode,
      effectiveDate: coverage.effectiveDate ?? undefined,
      terminationDate: coverage.terminationDate ?? undefined,
      lastVerifiedAt: coverage.lastVerifiedAt ?? undefined,
      lastVerifiedStatus: coverage.lastVerifiedStatus ?? undefined,
    },
    payer: {
      id: payer.id,
      name: payer.name,
      type: payer.type,
      claimFilingIndicator: payer.claimFilingIndicator ?? undefined,
      timelyFilingDays: plan?.timelyFilingDays ?? undefined,
      supportsSecondaryElectronic: payer.supportsSecondaryElectronic,
    },
    billingProvider: {
      npi: practice.npi ?? a.renderingProvider.npi,
      taxId: practice.taxId ?? undefined,
      taxonomyCode: practice.taxonomyCode ?? undefined,
      postalCode: location.postalCode,
    },
    renderingProvider: {
      npi: a.renderingProvider.npi,
      taxonomyCode: a.renderingProvider.taxonomyCode ?? undefined,
      enrollmentStatus: a.renderingEnrollment?.status ?? undefined,
    },
    location: { postalCode: location.postalCode, macJurisdiction: location.macJurisdiction ?? undefined, state: location.state },
    sameDayLinesOnOtherClaims: a.sameDayLinesOnOtherClaims.map((l) => ({ procedureCode: l.procedureCode, units: l.units, modifiers: mods(l) })),
    today,
  };
}

export function yearsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso + 'T00:00:00Z');
  const to = new Date(toIso + 'T00:00:00Z');
  let years = to.getUTCFullYear() - from.getUTCFullYear();
  const beforeBirthday = to.getUTCMonth() < from.getUTCMonth() || (to.getUTCMonth() === from.getUTCMonth() && to.getUTCDate() < from.getUTCDate());
  if (beforeBirthday) years--;
  return years;
}
