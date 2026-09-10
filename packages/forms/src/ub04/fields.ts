import type { InstitutionalClaim, UbDiagnosis } from '@grove/x12';

/**
 * UB-04 (CMS-1450) form locator values, keyed by FL number.
 *
 * This is the paper equivalent of the 837I and is derived from the same model, so an
 * institutional claim cannot say one thing on paper and another on the wire.
 *
 * The form differs from the CMS-1500 in three ways that shape everything here: it bills
 * by revenue code rather than procedure, it carries up to three payers side by side in
 * FL 50–65, and its charge lines run 22 to a page with a totals line that must reconcile.
 */
export interface Ub04Fields {
  fl1_name: string;
  fl1_addr1: string;
  fl1_addr2: string;
  fl1_phone: string;
  fl2_name: string;
  fl2_addr1: string;
  fl2_addr2: string;
  fl3a: string;
  fl3b: string;
  fl4: string;
  fl5: string;
  fl6_from: string;
  fl6_through: string;
  fl8a: string;
  fl8b: string;
  fl9a: string;
  fl9b: string;
  fl9c: string;
  fl9d: string;
  fl9e: string;
  fl10: string;
  fl11: string;
  fl12: string;
  fl13: string;
  fl14: string;
  fl15: string;
  fl16: string;
  fl17: string;
  /** FL 18–28, always eleven slots so the boxes line up. */
  fl18_28: string[];
  fl29: string;
  /** FL 31–34, four slots of code + date. */
  fl31_34: Array<{ code: string; date: string }>;
  /** FL 35–36, two slots of code + span. */
  fl35_36: Array<{ code: string; from: string; through: string }>;
  fl38_name: string;
  fl38_addr1: string;
  fl38_addr2: string;
  /** FL 39–41, twelve slots of code + amount. */
  fl39_41: Array<{ code: string; amount: string }>;
  /** FL 42–48, one entry per revenue line, in order. */
  lines: Array<{
    fl42: string;
    fl43: string;
    fl44: string;
    fl45: string;
    fl46: string;
    fl47: string;
    fl48: string;
  }>;
  /** The totals line, revenue code 0001. */
  totals: { fl42: string; fl47: string; fl48: string };
  /** FL 45 line 23 — the date the bill was created. */
  creationDate: string;
  /** Up to three payer columns, A/B/C. */
  payers: Array<{
    fl50: string;
    fl51: string;
    fl52: string;
    fl53: string;
    fl54: string;
    fl55: string;
    fl58: string;
    fl59: string;
    fl60: string;
    fl61: string;
    fl62: string;
    fl63: string;
    fl64: string;
    fl65: string;
  }>;
  fl56: string;
  fl57: string[];
  fl66: string;
  fl67: string;
  fl67_poa: string;
  /** FL 67 A–Q. */
  fl67_other: Array<{ code: string; poa: string }>;
  fl69: string;
  fl70: string[];
  fl71: string;
  fl72: Array<{ code: string; poa: string }>;
  fl74: { code: string; date: string };
  /** FL 74 a–e. */
  fl74_other: Array<{ code: string; date: string }>;
  fl76: UbProviderFields;
  fl77: UbProviderFields;
  fl78: UbProviderFields;
  fl79: UbProviderFields;
  fl80: string;
  fl81: Array<{ qualifier: string; code: string }>;
}

export interface UbProviderFields {
  npi: string;
  qual: string;
  id: string;
  last: string;
  first: string;
}

/** Revenue lines per printed page. Line 23 is the totals line, not a revenue line. */
export const UB04_LINES_PER_PAGE = 22;
/** The revenue code that marks the totals line. */
export const UB04_TOTALS_REVENUE_CODE = '0001';

const mmddyy = (iso?: string) => (iso ? `${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(2, 4)}` : '');
/** UB-04 money is printed without a currency symbol, dollars and cents separated. */
const money = (cents: number) => `${Math.floor(Math.abs(cents) / 100)}${cents < 0 ? '-' : ''} ${String(Math.abs(cents) % 100).padStart(2, '0')}`;
const pad = <T,>(list: T[], size: number, empty: T): T[] => [...list.slice(0, size), ...Array(Math.max(0, size - list.length)).fill(empty)];

const emptyProvider: UbProviderFields = { npi: '', qual: '', id: '', last: '', first: '' };

function providerFields(p?: { npi: string; person: { lastName: string; firstName: string }; qualifier?: string; otherId?: string }): UbProviderFields {
  if (!p) return { ...emptyProvider };
  return {
    npi: p.npi,
    qual: p.qualifier ?? '',
    id: p.otherId ?? '',
    last: p.person.lastName,
    first: p.person.firstName,
  };
}

const dx = (d: UbDiagnosis | undefined) => ({ code: d ? d.code.replace('.', '') : '', poa: d?.presentOnAdmission ?? '' });

export function claimToUb04(c: InstitutionalClaim, opts: { creationDate?: string } = {}): Ub04Fields {
  const bill = c.billingProvider;
  const addr = bill.address;

  return {
    fl1_name: bill.organization?.name ?? '',
    fl1_addr1: addr?.line1 ?? '',
    fl1_addr2: addr ? cityLine(addr) : '',
    fl1_phone: bill.contact?.phone ?? '',
    fl2_name: c.payToProvider?.organization?.name ?? '',
    fl2_addr1: c.payToProvider?.address?.line1 ?? '',
    fl2_addr2: c.payToProvider?.address ? cityLine(c.payToProvider.address) : '',

    fl3a: c.patientControlNumber,
    fl3b: c.medicalRecordNumber ?? '',
    fl4: c.typeOfBill,
    fl5: c.federalTaxNumber,
    fl6_from: mmddyy(c.statementFrom),
    fl6_through: mmddyy(c.statementThrough),

    fl8a: c.patient.patientId ?? '',
    fl8b: [c.patient.person.lastName, c.patient.person.firstName, c.patient.person.middleName?.charAt(0)]
      .filter(Boolean)
      .join(', '),
    fl9a: c.patient.address.line1,
    fl9b: c.patient.address.city,
    fl9c: c.patient.address.state,
    fl9d: c.patient.address.postalCode,
    fl9e: c.patient.address.countryCode ?? '',
    fl10: mmddyy(c.patient.dateOfBirth),
    fl11: c.patient.sex,

    fl12: mmddyy(c.admission?.date),
    fl13: c.admission?.hour ?? '',
    fl14: c.admission?.priority ?? '',
    fl15: c.admission?.pointOfOrigin ?? '',
    fl16: c.dischargeHour ?? '',
    fl17: c.patientStatus,

    fl18_28: pad(c.conditionCodes, 11, ''),
    fl29: c.accidentState ?? '',
    fl31_34: pad(
      c.occurrenceCodes.map((o) => ({ code: o.code, date: mmddyy(o.date) })),
      4,
      { code: '', date: '' },
    ),
    fl35_36: pad(
      c.occurrenceSpans.map((o) => ({ code: o.code, from: mmddyy(o.from), through: mmddyy(o.through) })),
      2,
      { code: '', from: '', through: '' },
    ),

    fl38_name: c.responsibleParty?.name ?? '',
    fl38_addr1: c.responsibleParty?.address?.line1 ?? '',
    fl38_addr2: c.responsibleParty?.address ? cityLine(c.responsibleParty.address) : '',

    fl39_41: pad(
      c.valueCodes.map((v) => ({ code: v.code, amount: money(v.amountCents) })),
      12,
      { code: '', amount: '' },
    ),

    lines: c.lines.map((l) => ({
      fl42: l.revenueCode,
      fl43: l.description ?? '',
      // FL 44 holds the HCPCS with its modifiers appended, space separated.
      fl44: [l.hcpcs, ...l.modifiers.slice(0, 4)].filter(Boolean).join(' '),
      fl45: mmddyy(l.serviceDate),
      fl46: String(l.units),
      fl47: money(l.chargeCents),
      fl48: l.nonCoveredCents ? money(l.nonCoveredCents) : '',
    })),
    totals: {
      fl42: UB04_TOTALS_REVENUE_CODE,
      fl47: money(c.totalChargeCents),
      fl48: money(c.lines.reduce((s, l) => s + (l.nonCoveredCents ?? 0), 0)),
    },
    creationDate: mmddyy(opts.creationDate ?? c.statementThrough),

    payers: c.payers.slice(0, 3).map((p) => ({
      fl50: p.name,
      fl51: p.healthPlanId,
      fl52: p.releaseOfInformation,
      fl53: p.benefitsAssigned ? 'Y' : 'N',
      fl54: p.priorPaymentsCents ? money(p.priorPaymentsCents) : '',
      fl55: p.estimatedDueCents !== undefined ? money(p.estimatedDueCents) : '',
      fl58: p.insuredName,
      fl59: p.relationship,
      fl60: p.insuredId,
      fl61: p.groupName ?? '',
      fl62: p.groupNumber ?? '',
      fl63: p.treatmentAuthCode ?? '',
      fl64: p.documentControlNumber ?? '',
      fl65: p.employerName ?? '',
    })),

    fl56: bill.npi,
    fl57: pad(
      (bill.secondaryIds ?? []).map((s) => s.value),
      3,
      '',
    ),

    fl66: c.icdVersion,
    fl67: dx(c.principalDiagnosis).code,
    fl67_poa: dx(c.principalDiagnosis).poa,
    fl67_other: pad(c.otherDiagnoses.map(dx), 17, { code: '', poa: '' }),
    fl69: c.admittingDiagnosis?.replace('.', '') ?? '',
    fl70: pad(
      c.reasonForVisit.map((r) => r.replace('.', '')),
      3,
      '',
    ),
    fl71: c.ppsCode ?? '',
    fl72: pad(c.externalCauseCodes.map(dx), 3, { code: '', poa: '' }),
    fl74: c.principalProcedure
      ? { code: c.principalProcedure.code, date: mmddyy(c.principalProcedure.date) }
      : { code: '', date: '' },
    fl74_other: pad(
      c.otherProcedures.map((p) => ({ code: p.code, date: mmddyy(p.date) })),
      5,
      { code: '', date: '' },
    ),

    fl76: providerFields(c.attendingProvider),
    fl77: providerFields(c.operatingProvider),
    fl78: providerFields(c.otherProviders[0]),
    fl79: providerFields(c.otherProviders[1]),

    fl80: c.remarks ?? '',
    fl81: pad(c.codeCode, 4, { qualifier: '', code: '' }),
  };
}

function cityLine(a: { city: string; state: string; postalCode: string }): string {
  const zip = a.postalCode.length === 9 ? `${a.postalCode.slice(0, 5)}-${a.postalCode.slice(5)}` : a.postalCode;
  return `${a.city} ${a.state} ${zip}`;
}
