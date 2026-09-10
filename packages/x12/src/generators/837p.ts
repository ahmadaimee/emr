import { amount, isoToCcyymmdd, ccyymmdd, hhmm } from '../envelope';
import { seg, type Segment } from '../segment';
import type {
  Address,
  CasAdjustment,
  Person,
  ProfessionalClaim,
  Provider,
  ReceiverInfo,
  ServiceLine,
  SubmitterInfo,
} from '../types';

/**
 * 837P generator — 005010X222A1.
 *
 * Produces the transaction-set BODY (everything between ST and SE) for one or more
 * claims sharing a billing provider. Envelope wrapping is done by `buildInterchange`.
 *
 * Structure follows the TR3 loop hierarchy exactly; comments name the loops so a
 * rejection pointing at "2310B PRV03" can be located in seconds.
 */

export interface Generate837POptions {
  submitter: SubmitterInfo;
  receiver: ReceiverInfo;
  /** BHT03 — our batch reference. */
  batchReference: string;
  timestamp?: Date;
}

export function generate837P(claims: ProfessionalClaim[], o: Generate837POptions): Segment[] {
  if (claims.length === 0) throw new Error('837P requires at least one claim');
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

  // Group claims by billing provider NPI so each gets one 2000A loop.
  const groups = new Map<string, ProfessionalClaim[]>();
  for (const c of claims) {
    const key = c.billingProvider.npi;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  for (const group of groups.values()) {
    const first = group[0]!;
    const billing = first.billingProvider;

    // 2000A Billing provider HL. HL03=20, HL04=1 (has children).
    const billingHl = ++hl;
    out.push(seg('HL', billingHl, '', '20', '1'));
    if (billing.taxonomyCode) out.push(seg('PRV', 'BI', 'PXC', billing.taxonomyCode));

    // 2010AA Billing provider name
    out.push(...nm1Provider('85', billing));
    out.push(...addressSegments(billing.address, { requireZip9: true }));
    if (billing.taxId) out.push(seg('REF', billing.taxIdType ?? 'EI', billing.taxId));
    if (billing.contact) {
      out.push(
        seg('PER', 'IC', billing.contact.name, ...(billing.contact.phone ? ['TE', billing.contact.phone] : [])),
      );
    }

    // 2010AB Pay-to address, only when it differs from the billing provider
    if (first.payToProvider) {
      out.push(seg('NM1', '87', '2'));
      out.push(...addressSegments(first.payToProvider.address, { requireZip9: true }));
    }

    for (const claim of group) {
      const patientIsSubscriber = !claim.patient;

      // 2000B Subscriber HL. HL04 = 0 when the subscriber is the patient, else 1.
      const subscriberHl = ++hl;
      out.push(seg('HL', subscriberHl, billingHl, '22', patientIsSubscriber ? '0' : '1'));
      out.push(
        seg(
          'SBR',
          claim.payerSequence,
          patientIsSubscriber ? '18' : claim.subscriber.relationshipToPatient,
          claim.subscriber.groupNumber ?? '',
          claim.subscriber.groupName ?? '',
          '',
          '',
          '',
          '',
          claim.payer.claimFilingIndicator,
        ),
      );

      // 2010BA Subscriber name
      out.push(seg('NM1', 'IL', '1', ...personName(claim.subscriber.person), 'MI', claim.subscriber.memberId));
      if (patientIsSubscriber || claim.subscriber.address) {
        const addr = claim.subscriber.address ?? claim.patient?.address;
        out.push(...addressSegments(addr));
      }
      if (patientIsSubscriber) {
        // DMG is required on the subscriber when they are the patient.
        const p = claim.patient;
        const dob = claim.subscriber.dateOfBirth ?? p?.dateOfBirth;
        const sex = claim.subscriber.sex ?? p?.sex;
        if (dob) out.push(seg('DMG', 'D8', isoToCcyymmdd(dob), sex ?? 'U'));
      } else if (claim.subscriber.dateOfBirth) {
        out.push(seg('DMG', 'D8', isoToCcyymmdd(claim.subscriber.dateOfBirth), claim.subscriber.sex ?? 'U'));
      }

      // 2010BB Payer name
      out.push(seg('NM1', 'PR', '2', claim.payer.name, '', '', '', '', 'PI', claim.payer.payerId));
      if (claim.payer.address) out.push(...addressSegments(claim.payer.address));

      // 2000C Patient HL + 2010CA, only when patient ≠ subscriber
      let claimParentHl = subscriberHl;
      if (claim.patient) {
        const patientHl = ++hl;
        claimParentHl = patientHl;
        out.push(seg('HL', patientHl, subscriberHl, '23', '0'));
        out.push(seg('PAT', claim.patient.relationshipToSubscriber ?? claim.subscriber.relationshipToPatient));
        out.push(seg('NM1', 'QC', '1', ...personName(claim.patient.person)));
        out.push(...addressSegments(claim.patient.address));
        out.push(seg('DMG', 'D8', isoToCcyymmdd(claim.patient.dateOfBirth), claim.patient.sex));
      }
      void claimParentHl;

      // 2300 Claim
      out.push(...claimSegments(claim));

      // 2310A Referring provider
      if (claim.referringProvider) out.push(...nm1Provider('DN', claim.referringProvider));

      // 2310B Rendering provider (only when it differs from billing)
      if (claim.renderingProvider && claim.renderingProvider.npi !== billing.npi) {
        out.push(...nm1Provider('82', claim.renderingProvider));
        if (claim.renderingProvider.taxonomyCode) {
          out.push(seg('PRV', 'PE', 'PXC', claim.renderingProvider.taxonomyCode));
        }
      }

      // 2310C Service facility location (required when POS is not the billing address)
      if (claim.serviceFacility) {
        out.push(...nm1Provider('77', claim.serviceFacility));
        out.push(...addressSegments(claim.serviceFacility.address, { requireZip9: true }));
      }

      // 2310D Supervising provider
      if (claim.supervisingProvider) out.push(...nm1Provider('DQ', claim.supervisingProvider));

      // 2320 / 2330 Other subscriber & payer — coordination of benefits
      for (const other of claim.otherSubscribers ?? []) {
        out.push(
          seg(
            'SBR',
            other.sequence,
            other.relationshipToPatient,
            other.groupNumber ?? '',
            '',
            '',
            '',
            '',
            '',
            other.claimFilingIndicator,
          ),
        );
        for (const cas of groupCas(other.claimAdjustments)) out.push(cas);
        out.push(seg('AMT', 'D', amount(other.paidAmountCents)));
        if (other.remainingPatientLiabilityCents !== undefined) {
          out.push(seg('AMT', 'EAF', amount(other.remainingPatientLiabilityCents)));
        }
        // OI — other insurance coverage information. OI03 benefits assignment, OI06 release.
        out.push(seg('OI', '', '', claim.benefitsAssigned ? 'Y' : 'N', '', '', claim.releaseOfInformation));
        // 2330A Other subscriber name
        out.push(seg('NM1', 'IL', '1', ...personName(other.person), 'MI', other.memberId));
        // 2330B Other payer name
        out.push(seg('NM1', 'PR', '2', other.payer.name, '', '', '', '', 'PI', other.payer.payerId));
        if (other.payerClaimControlNumber) out.push(seg('REF', 'F8', other.payerClaimControlNumber));
      }

      // 2400 Service lines
      for (const line of claim.lines) {
        out.push(...serviceLineSegments(line, claim));
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------

function claimSegments(c: ProfessionalClaim): Segment[] {
  const out: Segment[] = [];

  // CLM05 = POS : facility code qualifier B : frequency
  out.push(
    seg(
      'CLM',
      c.patientControlNumber,
      amount(c.totalChargeCents),
      '',
      '',
      [c.placeOfService, 'B', c.frequencyCode],
      c.providerSignatureOnFile ? 'Y' : 'N',
      c.assignmentCode,
      c.benefitsAssigned ? 'Y' : 'N',
      c.releaseOfInformation,
      '',
      relatedCauses(c),
    ),
  );

  const d = c.dates ?? {};
  if (d.onset) out.push(seg('DTP', '431', 'D8', isoToCcyymmdd(d.onset)));
  if (d.initialTreatment) out.push(seg('DTP', '454', 'D8', isoToCcyymmdd(d.initialTreatment)));
  if (d.lastSeen) out.push(seg('DTP', '304', 'D8', isoToCcyymmdd(d.lastSeen)));
  if (d.accident) out.push(seg('DTP', '439', 'D8', isoToCcyymmdd(d.accident)));
  if (d.hospitalizedFrom) out.push(seg('DTP', '435', 'D8', isoToCcyymmdd(d.hospitalizedFrom)));
  if (d.hospitalizedTo) out.push(seg('DTP', '096', 'D8', isoToCcyymmdd(d.hospitalizedTo)));

  // Frequency 7/8 MUST carry the payer's original claim number or it is treated as a
  // duplicate original and denied.
  if (c.frequencyCode !== '1') {
    if (!c.originalPayerClaimControlNumber) {
      throw new Error(`Claim ${c.patientControlNumber}: frequency ${c.frequencyCode} requires the original payer claim control number (REF*F8)`);
    }
    out.push(seg('REF', 'F8', c.originalPayerClaimControlNumber));
  }
  if (c.priorAuthorizationNumber) out.push(seg('REF', 'G1', c.priorAuthorizationNumber));
  if (c.referralNumber) out.push(seg('REF', '9F', c.referralNumber));
  if (c.cliaNumber) out.push(seg('REF', 'X4', c.cliaNumber));
  if (c.note) out.push(seg('NTE', 'ADD', c.note.slice(0, 80)));

  // HI — diagnoses. ABK = principal, ABF = other. Up to 12. No decimal points.
  if (c.diagnoses.length === 0) throw new Error(`Claim ${c.patientControlNumber}: at least one diagnosis is required`);
  if (c.diagnoses.length > 12) throw new Error(`Claim ${c.patientControlNumber}: 837P allows at most 12 diagnoses`);
  const hi = c.diagnoses.map((code, i) => [i === 0 ? 'ABK' : 'ABF', code.replace('.', '')]);
  out.push(seg('HI', ...hi));

  return out;
}

function serviceLineSegments(l: ServiceLine, c: ProfessionalClaim): Segment[] {
  const out: Segment[] = [];
  out.push(seg('LX', l.lineNumber));

  // Pointers are numeric positions 1..12. Validate against the diagnosis list.
  if (l.diagnosisPointers.length === 0 || l.diagnosisPointers.length > 4) {
    throw new Error(`Line ${l.lineNumber}: 1–4 diagnosis pointers required`);
  }
  for (const p of l.diagnosisPointers) {
    if (!Number.isInteger(p) || p < 1 || p > c.diagnoses.length) {
      throw new Error(`Line ${l.lineNumber}: diagnosis pointer ${p} is out of range (claim has ${c.diagnoses.length})`);
    }
  }

  // SV1: [HC:code:mod1:mod2:mod3:mod4] charge UN units POS '' '' [ptr1:ptr2:ptr3:ptr4] '' emergency '' epsdt familyPlanning
  out.push(
    seg(
      'SV1',
      ['HC', l.procedureCode, ...l.modifiers.slice(0, 4)],
      amount(l.chargeCents),
      l.unitType ?? 'UN',
      l.units,
      l.placeOfService ?? '',
      '',
      l.diagnosisPointers,
      '',
      l.emergency ? 'Y' : '',
      '',
      l.epsdt ? 'Y' : '',
      l.familyPlanning ? 'Y' : '',
    ),
  );

  if (l.serviceDateThrough && l.serviceDateThrough !== l.serviceDate) {
    out.push(seg('DTP', '472', 'RD8', `${isoToCcyymmdd(l.serviceDate)}-${isoToCcyymmdd(l.serviceDateThrough)}`));
  } else {
    out.push(seg('DTP', '472', 'D8', isoToCcyymmdd(l.serviceDate)));
  }

  if (l.lineControlNumber) out.push(seg('REF', '6R', l.lineControlNumber));

  // 2410 Drug identification
  if (l.ndc) {
    out.push(seg('LIN', '', 'N4', l.ndc.code));
    out.push(seg('CTP', '', '', '', l.ndc.quantity, l.ndc.unit));
  }

  // 2420A Line-level rendering provider. Situational: send it ONLY when the line's
  // provider differs from the one already reported at claim level (2310B). Repeating an
  // identical loop on every line is a TR3 violation and some payers reject the file.
  const claimRendering = c.renderingProvider?.npi ?? c.billingProvider.npi;
  if (l.renderingProvider && l.renderingProvider.npi !== claimRendering) {
    out.push(...nm1Provider('82', l.renderingProvider));
    if (l.renderingProvider.taxonomyCode) out.push(seg('PRV', 'PE', 'PXC', l.renderingProvider.taxonomyCode));
  }

  // 2430 Line adjudication information (secondary claims)
  for (const adj of l.priorAdjudications ?? []) {
    out.push(
      seg(
        'SVD',
        adj.payerId,
        amount(adj.paidAmountCents),
        ['HC', adj.procedureCode, ...adj.modifiers.slice(0, 4)],
        '',
        adj.paidUnits ?? l.units,
      ),
    );
    for (const cas of groupCas(adj.adjustments)) out.push(cas);
    out.push(seg('DTP', '573', 'D8', isoToCcyymmdd(adj.adjudicationDate)));
  }

  return out;
}

/**
 * CAS segments carry up to six reason/amount pairs per group code. Group adjustments by
 * their group code and chunk into sixes.
 */
export function groupCas(adjustments: CasAdjustment[]): Segment[] {
  const byGroup = new Map<string, CasAdjustment[]>();
  for (const a of adjustments) byGroup.set(a.group, [...(byGroup.get(a.group) ?? []), a]);
  const out: Segment[] = [];
  for (const [group, list] of byGroup) {
    for (let i = 0; i < list.length; i += 6) {
      const chunk = list.slice(i, i + 6);
      const values: Array<string | number> = [group];
      for (const a of chunk) values.push(a.reasonCode, amount(a.amountCents), a.quantity ?? '');
      out.push(seg('CAS', ...values));
    }
  }
  return out;
}

function nm1Provider(entityCode: string, p: Provider): Segment[] {
  const segs: Segment[] = [];
  if (p.isPerson) {
    if (!p.person) throw new Error(`Provider ${p.npi}: isPerson requires person`);
    segs.push(seg('NM1', entityCode, '1', ...personName(p.person), 'XX', p.npi));
  } else {
    if (!p.organization) throw new Error(`Provider ${p.npi}: organization name required`);
    segs.push(seg('NM1', entityCode, '2', p.organization.name, '', '', '', '', 'XX', p.npi));
  }
  for (const id of p.secondaryIds ?? []) segs.push(seg('REF', id.qualifier, id.value));
  return segs;
}

/** [last, first, middle, '', suffix] — NM103..NM107 */
function personName(p: Person): [string, string, string, string, string] {
  return [p.lastName, p.firstName, p.middleName ?? '', '', p.suffix ?? ''];
}

function addressSegments(a: Address | undefined, opts: { requireZip9?: boolean } = {}): Segment[] {
  if (!a) return [];
  const zip = a.postalCode.replace(/\D/g, '');
  if (opts.requireZip9 && zip.length !== 9) {
    throw new Error(`Address "${a.line1}": a 9-digit ZIP is required in this loop (got "${a.postalCode}")`);
  }
  return [seg('N3', a.line1, a.line2 ?? ''), seg('N4', a.city, a.state, zip, a.countryCode && a.countryCode !== 'US' ? a.countryCode : '')];
}

function relatedCauses(c: ProfessionalClaim): string[] | string {
  const r = c.relatedCauses;
  if (!r) return '';
  const codes: string[] = [];
  if (r.autoAccident) codes.push('AA');
  if (r.employment) codes.push('EM');
  if (r.otherAccident) codes.push('OA');
  if (codes.length === 0) return '';
  // CLM11: cause1 : cause2 : cause3 : state : country
  return [...codes, ...Array(3 - codes.length).fill(''), r.state ?? ''];
}
