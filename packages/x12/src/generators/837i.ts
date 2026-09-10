import { amount, isoToCcyymmdd, ccyymmdd, hhmm } from '../envelope';
import { seg, type Segment } from '../segment';
import { groupCas } from './837p';
import type {
  Address,
  InstitutionalClaim,
  InstitutionalPayer,
  Provider,
  ReceiverInfo,
  RevenueLine,
  SubmitterInfo,
  UbDiagnosis,
  UbProvider,
} from '../types';

/**
 * 837I generator — 005010X223A2.
 *
 * Produces the transaction-set BODY (everything between ST and SE) for one or more
 * institutional claims sharing a billing provider. Envelope wrapping is done by
 * `buildInterchange`.
 *
 * The institutional transaction is not the professional one with different loop names.
 * Three things drive most of the differences here:
 *
 *  - Service lines are SV2 and keyed on a revenue code. The HCPCS is supporting detail.
 *  - Everything the UB-04 carries in its code boxes — condition, occurrence, value and
 *    span codes, the procedures, the DRG — rides in HI segments, not in dedicated ones.
 *  - The type of bill drives CLM05: its middle digits are the facility code and its
 *    last digit the claim frequency, so a replacement bill is a TOB change, not a
 *    separate field.
 */

export interface Generate837IOptions {
  submitter: SubmitterInfo;
  receiver: ReceiverInfo;
  /** BHT03 — our batch reference. */
  batchReference: string;
  timestamp?: Date;
}

/** HI segments take at most twelve code values; longer lists continue in another HI. */
const HI_MAX = 12;

export function generate837I(claims: InstitutionalClaim[], o: Generate837IOptions): Segment[] {
  if (claims.length === 0) throw new Error('837I requires at least one claim');
  const ts = o.timestamp ?? new Date();
  const out: Segment[] = [];

  // BHT — beginning of hierarchical transaction. BHT06 CH = chargeable.
  out.push(seg('BHT', '0019', '00', o.batchReference, ccyymmdd(ts), hhmm(ts), 'CH'));

  // 1000A Submitter
  out.push(seg('NM1', '41', '2', o.submitter.name, '', '', '', '', '46', o.submitter.id));
  out.push(
    seg(
      'PER',
      'IC',
      o.submitter.contactName,
      ...(o.submitter.contactPhone ? ['TE', o.submitter.contactPhone] : []),
      ...(o.submitter.contactEmail ? ['EM', o.submitter.contactEmail] : []),
    ),
  );

  // 1000B Receiver
  out.push(seg('NM1', '40', '2', o.receiver.name, '', '', '', '', '46', o.receiver.id));

  let hl = 0;

  // Group by billing provider NPI so each gets one 2000A loop.
  const groups = new Map<string, InstitutionalClaim[]>();
  for (const c of claims) {
    groups.set(c.billingProvider.npi, [...(groups.get(c.billingProvider.npi) ?? []), c]);
  }

  for (const group of groups.values()) {
    const first = group[0]!;
    const billing = first.billingProvider;

    // 2000A Billing provider HL.
    const billingHl = ++hl;
    out.push(seg('HL', billingHl, '', '20', '1'));
    if (billing.taxonomyCode) out.push(seg('PRV', 'BI', 'PXC', billing.taxonomyCode));

    // 2010AA Billing provider name. The institutional biller is always an organisation.
    out.push(seg('NM1', '85', '2', billing.organization?.name ?? '', '', '', '', '', 'XX', billing.npi));
    out.push(...addressSegments(billing.address, { requireZip9: true }));
    out.push(seg('REF', billing.taxIdType ?? 'EI', first.federalTaxNumber.replace(/-/g, '')));
    if (billing.contact) {
      out.push(seg('PER', 'IC', billing.contact.name, ...(billing.contact.phone ? ['TE', billing.contact.phone] : [])));
    }

    // 2010AB Pay-to address, only when it differs from the billing provider.
    if (first.payToProvider) {
      out.push(seg('NM1', '87', '2'));
      out.push(...addressSegments(first.payToProvider.address, { requireZip9: true }));
    }

    for (const claim of group) {
      const primary = claim.payers[0];
      if (!primary) throw new Error(`Claim ${claim.patientControlNumber}: at least one payer is required`);

      const patientIsSubscriber = primary.relationship === '18';

      // 2000B Subscriber HL.
      const subscriberHl = ++hl;
      out.push(seg('HL', subscriberHl, billingHl, '22', patientIsSubscriber ? '0' : '1'));
      out.push(
        seg(
          'SBR',
          'P',
          patientIsSubscriber ? '18' : '',
          primary.groupNumber ?? '',
          primary.groupName ?? '',
          '',
          '',
          '',
          '',
          claimFilingIndicator(primary),
        ),
      );

      // 2010BA Subscriber name.
      out.push(seg('NM1', 'IL', '1', ...splitName(primary.insuredName), 'MI', primary.insuredId));
      if (patientIsSubscriber) {
        out.push(...addressSegments(claim.patient.address));
        out.push(seg('DMG', 'D8', isoToCcyymmdd(claim.patient.dateOfBirth), claim.patient.sex));
      }

      // 2010BB Payer name.
      out.push(seg('NM1', 'PR', '2', primary.name, '', '', '', '', 'PI', primary.healthPlanId));

      // 2000C Patient HL — only when the patient is not the subscriber.
      if (!patientIsSubscriber) {
        const patientHl = ++hl;
        out.push(seg('HL', patientHl, subscriberHl, '23', '0'));
        out.push(seg('PAT', primary.relationship));
        out.push(seg('NM1', 'QC', '1', claim.patient.person.lastName, claim.patient.person.firstName, claim.patient.person.middleName ?? ''));
        out.push(...addressSegments(claim.patient.address));
        out.push(seg('DMG', 'D8', isoToCcyymmdd(claim.patient.dateOfBirth), claim.patient.sex));
      }

      // 2300 Claim
      out.push(...claimSegments(claim, primary));

      // 2310A Attending provider — required on every institutional claim.
      out.push(...ubProviderSegments('71', claim.attendingProvider, 'AT'));
      // 2310B Operating physician
      if (claim.operatingProvider) out.push(...ubProviderSegments('72', claim.operatingProvider));
      // 2310C Other operating physician
      for (const p of claim.otherProviders) out.push(...ubProviderSegments('ZZ', p));

      // 2320 / 2330 Other payers — coordination of benefits.
      for (const other of claim.payers.slice(1)) {
        out.push(
          seg('SBR', sequenceFor(claim.payers.indexOf(other)), other.relationship, other.groupNumber ?? '', other.groupName ?? '', '', '', '', '', claimFilingIndicator(other)),
        );
        if (other.priorPaymentsCents) out.push(seg('AMT', 'D', amount(other.priorPaymentsCents)));
        out.push(seg('OI', '', '', other.benefitsAssigned ? 'Y' : 'N', '', '', other.releaseOfInformation));
        out.push(seg('NM1', 'IL', '1', ...splitName(other.insuredName), 'MI', other.insuredId));
        out.push(seg('NM1', 'PR', '2', other.name, '', '', '', '', 'PI', other.healthPlanId));
        if (other.documentControlNumber) out.push(seg('REF', 'F8', other.documentControlNumber));
      }

      // 2400 Service lines
      for (const line of claim.lines) out.push(...revenueLineSegments(line, claim));
    }
  }

  return out;
}

// ---------------------------------------------------------------------------

function claimSegments(c: InstitutionalClaim, payer: InstitutionalPayer): Segment[] {
  const out: Segment[] = [];

  const tob = c.typeOfBill.padStart(4, '0');
  // CLM05-1 is the facility type plus bill classification — digits 2 and 3 of the type
  // of bill. CLM05-3 is the frequency, its last digit. 0111 becomes 11:A:1.
  const facilityCode = tob.slice(1, 3);
  const frequency = tob.slice(3);

  out.push(
    seg(
      'CLM',
      c.patientControlNumber,
      amount(c.totalChargeCents),
      '',
      '',
      [facilityCode, 'A', frequency],
      '',
      '',
      payer.benefitsAssigned ? 'Y' : 'N',
      payer.releaseOfInformation,
    ),
  );

  // DTP*434 — the period the bill covers. Required on every institutional claim, and
  // sent as a range even when the stay is a single day.
  out.push(seg('DTP', '434', 'RD8', `${isoToCcyymmdd(c.statementFrom)}-${isoToCcyymmdd(c.statementThrough)}`));

  // DTP*435 — admission date and hour, as CCYYMMDDHHMM. Inpatient bills only.
  if (c.admission?.date) {
    const hour = (c.admission.hour ?? '00').padStart(2, '0');
    out.push(seg('DTP', '435', 'DT', `${isoToCcyymmdd(c.admission.date)}${hour}00`));
  }
  if (c.dischargeHour) out.push(seg('DTP', '096', 'TM', `${c.dischargeHour.padStart(2, '0')}00`));

  // CL1 — admission type, admission source, patient status.
  if (c.admission || c.patientStatus) {
    out.push(seg('CL1', c.admission?.priority ?? '', c.admission?.pointOfOrigin ?? '', c.patientStatus));
  }

  // A replacement or void must name the claim it replaces, or the payer treats it as a
  // new original and denies it as a duplicate.
  if (frequency !== '1' && frequency !== '0') {
    const dcn = c.payers.find((p) => p.documentControlNumber)?.documentControlNumber;
    if (!dcn) {
      throw new Error(`Claim ${c.patientControlNumber}: type of bill ${tob} is a replacement or void and requires the payer's document control number (REF*F8)`);
    }
    out.push(seg('REF', 'F8', dcn));
  }
  if (payer.treatmentAuthCode) out.push(seg('REF', 'G1', payer.treatmentAuthCode));
  if (c.medicalRecordNumber) out.push(seg('REF', 'EA', c.medicalRecordNumber));
  if (c.remarks) out.push(seg('NTE', 'ADD', c.remarks.slice(0, 80)));

  out.push(...hiSegments(c));
  return out;
}

/**
 * The HI block. Everything the UB-04 keeps in its code boxes lives here, and the order
 * matters: principal diagnosis first, then admitting, then the code groups.
 */
function hiSegments(c: InstitutionalClaim): Segment[] {
  const out: Segment[] = [];
  const icd10 = c.icdVersion === '0';

  // Principal diagnosis. The POA indicator is the NINTH component, not the third.
  out.push(seg('HI', diagnosisComposite(icd10 ? 'ABK' : 'BK', c.principalDiagnosis)));

  // Other diagnoses, twelve to a segment.
  for (const chunk of chunked(c.otherDiagnoses, HI_MAX)) {
    out.push(seg('HI', ...chunk.map((d) => diagnosisComposite(icd10 ? 'ABF' : 'BF', d))));
  }

  if (c.admittingDiagnosis) {
    out.push(seg('HI', [icd10 ? 'ABJ' : 'BJ', strip(c.admittingDiagnosis)]));
  }
  if (c.reasonForVisit.length > 0) {
    out.push(seg('HI', ...c.reasonForVisit.slice(0, 3).map((r) => [icd10 ? 'APR' : 'PR', strip(r)])));
  }
  for (const chunk of chunked(c.externalCauseCodes, 3)) {
    out.push(seg('HI', ...chunk.map((d) => diagnosisComposite(icd10 ? 'ABN' : 'BN', d))));
  }

  // Procedures carry their date in components 3 and 4.
  if (c.principalProcedure) {
    out.push(seg('HI', [icd10 ? 'BBR' : 'BR', strip(c.principalProcedure.code), 'D8', isoToCcyymmdd(c.principalProcedure.date)]));
  }
  for (const chunk of chunked(c.otherProcedures, HI_MAX)) {
    out.push(seg('HI', ...chunk.map((p) => [icd10 ? 'BBQ' : 'BQ', strip(p.code), 'D8', isoToCcyymmdd(p.date)])));
  }

  // Condition codes — BG. Value codes — BE, whose amount is the FIFTH component.
  for (const chunk of chunked(c.conditionCodes, HI_MAX)) {
    out.push(seg('HI', ...chunk.map((code) => ['BG', code])));
  }
  for (const chunk of chunked(c.occurrenceCodes, HI_MAX)) {
    out.push(seg('HI', ...chunk.map((o) => ['BH', o.code, 'D8', isoToCcyymmdd(o.date)])));
  }
  for (const chunk of chunked(c.occurrenceSpans, HI_MAX)) {
    out.push(seg('HI', ...chunk.map((o) => ['BI', o.code, 'RD8', `${isoToCcyymmdd(o.from)}-${isoToCcyymmdd(o.through)}`])));
  }
  for (const chunk of chunked(c.valueCodes, HI_MAX)) {
    out.push(seg('HI', ...chunk.map((v) => ['BE', v.code, '', '', amount(v.amountCents)])));
  }

  return out;
}

function revenueLineSegments(l: RevenueLine, c: InstitutionalClaim): Segment[] {
  const out: Segment[] = [];
  out.push(seg('LX', l.lineNumber));

  if (!/^\d{4}$/.test(l.revenueCode)) {
    throw new Error(`Line ${l.lineNumber}: revenue code ${l.revenueCode || '(missing)'} must be four digits`);
  }

  // SV2: revenue code, procedure composite, charge, unit basis, units, rate, non-covered.
  out.push(
    seg(
      'SV2',
      l.revenueCode,
      l.hcpcs ? ['HC', l.hcpcs, ...l.modifiers.slice(0, 4)] : '',
      amount(l.chargeCents),
      'UN',
      l.units,
      '',
      l.nonCoveredCents ? amount(l.nonCoveredCents) : '',
    ),
  );

  // Outpatient lines carry a service date; an inpatient stay is covered by DTP*434.
  if (l.serviceDate) out.push(seg('DTP', '472', 'D8', isoToCcyymmdd(l.serviceDate)));
  if (l.lineControlNumber) out.push(seg('REF', '6R', l.lineControlNumber));

  // 2430 Line adjudication, for secondary bills.
  for (const adj of l.priorAdjudications ?? []) {
    out.push(seg('SVD', adj.payerId, amount(adj.paidAmountCents), ['HC', adj.procedureCode, ...adj.modifiers.slice(0, 4)], l.revenueCode, adj.paidUnits ?? l.units));
    for (const cas of groupCas(adj.adjustments)) out.push(cas);
    out.push(seg('DTP', '573', 'D8', isoToCcyymmdd(adj.adjudicationDate)));
  }

  void c;
  return out;
}

function ubProviderSegments(entityCode: string, p: UbProvider, taxonomyQualifier?: string): Segment[] {
  const out: Segment[] = [
    seg('NM1', entityCode, '1', p.person.lastName, p.person.firstName, p.person.middleName ?? '', '', '', 'XX', p.npi),
  ];
  if (taxonomyQualifier && p.taxonomyCode) out.push(seg('PRV', taxonomyQualifier, 'PXC', p.taxonomyCode));
  if (p.qualifier && p.otherId) out.push(seg('REF', p.qualifier, p.otherId));
  return out;
}

function addressSegments(a: Address | undefined, opts: { requireZip9?: boolean } = {}): Segment[] {
  if (!a) return [];
  if (opts.requireZip9 && a.postalCode.replace(/-/g, '').length !== 9) {
    throw new Error(`Address ${a.line1}: a nine-digit ZIP is required here, got "${a.postalCode}"`);
  }
  const out = [seg('N3', a.line1, ...(a.line2 ? [a.line2] : []))];
  out.push(seg('N4', a.city, a.state, a.postalCode.replace(/-/g, '')));
  return out;
}

function diagnosisComposite(qualifier: string, d: UbDiagnosis): string[] {
  // C022-09 carries the present-on-admission indicator.
  return [qualifier, strip(d.code), '', '', '', '', '', '', d.presentOnAdmission ?? ''];
}

const strip = (code: string) => code.replace('.', '');

function splitName(full: string): [string, string, string] {
  const [last = '', rest = ''] = full.split(',').map((s) => s.trim());
  const [first = '', middle = ''] = rest.split(/\s+/);
  return [last, first, middle];
}

function claimFilingIndicator(p: InstitutionalPayer): string {
  // Derived from the plan when the caller has not said otherwise: Medicare Part A bills
  // go out as MA, everything else defaults to commercial insurance.
  return /medicare/i.test(p.name) ? 'MA' : /medicaid/i.test(p.name) ? 'MC' : 'CI';
}

function sequenceFor(index: number): 'P' | 'S' | 'T' {
  return index === 0 ? 'P' : index === 1 ? 'S' : 'T';
}

function chunked<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
