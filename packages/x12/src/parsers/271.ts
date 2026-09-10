import { ccyymmddToIso, toCents } from '../envelope';
import type { Segment } from '../segment';
import type { TransactionSet } from '../tokenizer';
import type { Address, EligibilityBenefit, EligibilityRejection, EligibilityResponse271, Person, Sex } from '../types';

/**
 * 271 parser — 005010X279A1.
 *
 * The payload that matters is the EB loop (2110C/2110D). Payers commonly return
 * dozens — one per benefit type per service type — and each may be followed by
 * REF/DTP/AAA/MSG/III segments that belong to it. We attach those to the open EB.
 */
export function parse271(ts: TransactionSet): EligibilityResponse271 {
  if (ts.type !== '271') throw new Error(`Expected a 271, got ${ts.type}`);

  const r: EligibilityResponse271 = {
    transactionControlNumber: ts.controlNumber,
    traceNumbers: [],
    payer: { name: '' },
    subscriber: { person: { lastName: '', firstName: '' } },
    benefits: [],
    rejections: [],
    isActive: false,
  };

  type Loop = 'none' | 'payer' | 'provider' | 'subscriber' | 'dependent';
  let loop: Loop = 'none';
  let eb: EligibilityBenefit | null = null;
  let pendingAddress: Partial<Address> = {};

  for (const s of ts.segments) {
    switch (s.id) {
      case 'HL': {
        // HL03: 20 payer, 21 information receiver, 22 subscriber, 23 dependent
        const level = s.el(3);
        loop = level === '20' ? 'payer' : level === '21' ? 'provider' : level === '22' ? 'subscriber' : level === '23' ? 'dependent' : 'none';
        eb = null;
        break;
      }

      case 'TRN':
        r.traceNumbers.push(s.el(2));
        break;

      case 'NM1':
        eb = null;
        if (loop === 'payer' && s.el(1) === 'PR') {
          r.payer = { name: s.el(3), id: s.has(9) ? s.el(9) : undefined };
        } else if (loop === 'subscriber' && s.el(1) === 'IL') {
          r.subscriber.person = nm1Person(s);
          if (s.el(8) === 'MI') r.subscriber.memberId = s.el(9);
        } else if (loop === 'dependent' && s.el(1) === '03') {
          r.dependent = { person: nm1Person(s) };
        }
        break;

      case 'REF':
        if (eb) eb.references.push({ qualifier: s.el(1), value: s.el(2) });
        else if (loop === 'subscriber') {
          if (s.el(1) === '6P') r.subscriber.groupNumber = s.el(2);
          else if (s.el(1) === '1L') r.subscriber.groupNumber ??= s.el(2);
        }
        break;

      case 'N3':
        pendingAddress = { line1: s.el(1), line2: s.el(2) || undefined };
        break;

      case 'N4':
        pendingAddress.city = s.el(1);
        pendingAddress.state = s.el(2);
        pendingAddress.postalCode = s.el(3);
        if (loop === 'subscriber' && pendingAddress.line1) r.subscriber.address = pendingAddress as Address;
        pendingAddress = {};
        break;

      case 'DMG': {
        const dob = s.el(1) === 'D8' ? ccyymmddToIso(s.el(2)) : undefined;
        const sex = (s.el(3) || undefined) as Sex | undefined;
        if (loop === 'subscriber') {
          r.subscriber.dateOfBirth = dob;
          r.subscriber.sex = sex;
        } else if (loop === 'dependent' && r.dependent) {
          r.dependent.dateOfBirth = dob;
          r.dependent.sex = sex;
        }
        break;
      }

      case 'INS':
        if (loop === 'dependent' && r.dependent) r.dependent.relationship = s.el(2);
        break;

      case 'DTP': {
        const value = s.el(2) === 'RD8' ? s.el(3) : ccyymmddToIso(s.el(3));
        if (eb) {
          eb.dates.push({ qualifier: s.el(1), value });
        } else if (loop === 'subscriber') {
          // 346 plan begin, 347 plan end, 291 plan (RD8 range)
          r.subscriber.planDates ??= {};
          if (s.el(1) === '346') r.subscriber.planDates.begin = value;
          else if (s.el(1) === '347') r.subscriber.planDates.end = value;
          else if (s.el(1) === '291' && s.el(2) === 'RD8') {
            const [b, e] = s.el(3).split('-');
            r.subscriber.planDates.begin = ccyymmddToIso(b ?? '');
            r.subscriber.planDates.end = ccyymmddToIso(e ?? '');
          }
        }
        break;
      }

      case 'AAA': {
        const rejection: EligibilityRejection = {
          reasonCode: s.el(3),
          followUpActionCode: s.el(4),
          scope: loop === 'none' ? 'payer' : loop,
        };
        r.rejections.push(rejection);
        break;
      }

      case 'EB':
        eb = parseEb(s);
        r.benefits.push(eb);
        break;

      case 'MSG':
        if (eb) eb.messages.push(s.el(1));
        break;

      case 'LS':
      case 'LE':
        // 2120 loop (benefit-related entity) markers. Entities inside are informational.
        break;
    }
  }

  // Active if any EB01=1 covers the generic health plan (30) or has no service type.
  r.isActive = r.benefits.some(
    (b) => b.code === '1' && (b.serviceTypeCodes.length === 0 || b.serviceTypeCodes.includes('30')),
  );
  // An EB01=6 (inactive) on the plan overrides.
  if (r.benefits.some((b) => b.code === '6' && (b.serviceTypeCodes.length === 0 || b.serviceTypeCodes.includes('30')))) {
    r.isActive = false;
  }

  return r;
}

export function parseEb(s: Segment): EligibilityBenefit {
  const b: EligibilityBenefit = {
    code: s.el(1),
    coverageLevel: s.el(2) || undefined,
    serviceTypeCodes: s.reps(3),
    insuranceType: s.el(4) || undefined,
    planDescription: s.el(5) || undefined,
    timePeriodQualifier: s.el(6) || undefined,
    amountCents: s.has(7) ? toCents(s.el(7)) : undefined,
    percentBps: s.has(8) ? Math.round(Number(s.el(8)) * 10_000) : undefined,
    quantityQualifier: s.el(9) || undefined,
    quantity: s.has(10) ? Number(s.el(10)) : undefined,
    authorizationRequired: s.has(11) ? s.el(11) === 'Y' : undefined,
    inNetwork: s.has(12) ? s.el(12) === 'Y' : undefined,
    dates: [],
    messages: [],
    references: [],
  };
  if (s.has(13)) {
    const [qualifier = '', code = '', ...modifiers] = s.comps(13);
    b.procedure = { qualifier, code, modifiers };
  }
  return b;
}

function nm1Person(s: Segment): Person {
  return { lastName: s.el(3), firstName: s.el(4), middleName: s.el(5) || undefined, suffix: s.el(7) || undefined };
}

/**
 * Summarise a 271 into the question the front desk actually asks: what do I collect?
 * Picks the most specific in-network benefit for the requested service type, falling
 * back to the plan-level (30) benefit.
 */
export interface BenefitSummary {
  active: boolean;
  planDescription?: string;
  insuranceType?: string;
  copayCents?: number;
  coinsuranceBps?: number;
  deductibleTotalCents?: number;
  deductibleRemainingCents?: number;
  outOfPocketMaxCents?: number;
  outOfPocketRemainingCents?: number;
  authorizationRequired?: boolean;
  planBegin?: string;
  planEnd?: string;
}

export function summarizeBenefits(r: EligibilityResponse271, serviceType = '98'): BenefitSummary {
  const pick = (code: string, opts: { remaining?: boolean; level?: string } = {}) => {
    const candidates = r.benefits.filter(
      (b) =>
        b.code === code &&
        (b.inNetwork !== false) &&
        (opts.level ? b.coverageLevel === opts.level : true) &&
        (opts.remaining ? b.timePeriodQualifier === '29' : b.timePeriodQualifier !== '29'),
    );
    return (
      candidates.find((b) => b.serviceTypeCodes.includes(serviceType)) ??
      candidates.find((b) => b.serviceTypeCodes.includes('30')) ??
      candidates.find((b) => b.serviceTypeCodes.length === 0)
    );
  };

  const plan = r.benefits.find((b) => b.code === '1') ?? r.benefits[0];
  return {
    active: r.isActive,
    planDescription: plan?.planDescription,
    insuranceType: plan?.insuranceType,
    copayCents: pick('B')?.amountCents,
    coinsuranceBps: pick('A')?.percentBps,
    deductibleTotalCents: pick('C', { level: 'IND' })?.amountCents,
    deductibleRemainingCents: pick('C', { level: 'IND', remaining: true })?.amountCents,
    outOfPocketMaxCents: pick('G', { level: 'IND' })?.amountCents,
    outOfPocketRemainingCents: pick('G', { level: 'IND', remaining: true })?.amountCents,
    authorizationRequired: r.benefits.some((b) => b.serviceTypeCodes.includes(serviceType) && b.authorizationRequired === true),
    planBegin: r.subscriber.planDates?.begin,
    planEnd: r.subscriber.planDates?.end,
  };
}
