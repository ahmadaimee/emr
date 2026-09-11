import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { amount, buildInterchange, IMPLEMENTATIONS, toCents } from '../envelope';
import { generate270 } from '../generators/270';
import { generate276 } from '../generators/276';
import { generate278 } from '../generators/278';
import { generate837P } from '../generators/837p';
import { checkBalance, parse835 } from '../parsers/835';
import { parse271, summarizeBenefits } from '../parsers/271';
import { serialize, splitTransactionSets, tokenize } from '../tokenizer';
import type { ProfessionalClaim } from '../types';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', name), 'utf8').trim();

describe('tokenizer', () => {
  it('reads delimiters from the ISA and round-trips byte for byte', () => {
    const raw = fixture('sample-835.x12');
    const doc = tokenize(raw);
    expect(doc.delimiters).toEqual({ element: '*', component: ':', repetition: '^', segment: '~' });
    expect(doc.segments[0]?.id).toBe('ISA');
    expect(doc.segments.at(-1)?.id).toBe('IEA');
    expect(serialize(doc.segments, doc.delimiters)).toBe(raw);
  });

  it('handles non-default delimiters', () => {
    const raw = fixture('sample-835.x12').replaceAll('*', '|').replaceAll('~', '\n').replaceAll(':', '>');
    const doc = tokenize(raw);
    expect(doc.delimiters.element).toBe('|');
    expect(doc.delimiters.component).toBe('>');
    const sets = splitTransactionSets(doc);
    expect(sets).toHaveLength(1);
    expect(sets[0]?.type).toBe('835');
  });

  it('validates SE segment counts', () => {
    const raw = fixture('sample-835.x12').replace('SE*43*0001', 'SE*42*0001');
    expect(() => splitTransactionSets(tokenize(raw))).toThrow(/SE01 declares 42/);
  });
});

describe('money', () => {
  it('converts cents to X12 decimals without floating point drift', () => {
    expect(amount(41250)).toBe('412.50');
    expect(amount(100)).toBe('1');
    expect(amount(5)).toBe('0.05');
    expect(amount(-5000)).toBe('-50');
    expect(toCents('412.50')).toBe(41250);
    expect(toCents('.2')).toBe(20);
    expect(toCents('-50')).toBe(-5000);
    expect(toCents('1234.5')).toBe(123450);
  });
});

describe('835 parser', () => {
  const remit = parse835(splitTransactionSets(tokenize(fixture('sample-835.x12')))[0]!);

  it('reads the payment header', () => {
    expect(remit.totalPaidCents).toBe(41250);
    expect(remit.paymentMethod).toBe('ACH');
    expect(remit.paymentDate).toBe('2026-09-03');
    expect(remit.traceNumber).toBe('EFT2026090300123');
    expect(remit.payer.name).toBe('SAMPLE HEALTH PLAN');
    expect(remit.payee.npi).toBe('1234567893');
    expect(remit.payee.taxId).toBe('123456789');
  });

  it('parses claims, lines, and CAS adjustments down to the service line', () => {
    expect(remit.claims).toHaveLength(3);
    const paid = remit.claims[0]!;
    expect(paid.patientControlNumber).toBe('GRV-10041');
    expect(paid.claimStatusCode).toBe('1');
    expect(paid.payerClaimControlNumber).toBe('2026243000123');
    expect(paid.patientResponsibilityCents).toBe(4000);
    expect(paid.lines).toHaveLength(2);

    const line1 = paid.lines[0]!;
    expect(line1.procedureCode).toBe('99214');
    expect(line1.paidCents).toBe(18750);
    expect(line1.allowedCents).toBe(22750);
    expect(line1.lineControlNumber).toBe('L1');
    expect(line1.adjustments).toEqual([
      { group: 'CO', reasonCode: '45', amountCents: 2250 },
      { group: 'PR', reasonCode: '3', amountCents: 4000 },
    ]);
  });

  it('separates denials with remark codes', () => {
    const denied = remit.claims[1]!;
    expect(denied.claimStatusCode).toBe('4');
    expect(denied.lines[0]?.adjustments[0]).toEqual({ group: 'CO', reasonCode: '197', amountCents: 20000 });
    expect(denied.lines[0]?.remarkCodes).toEqual(['N54']);
  });

  it('detects a crossover so we do not double-submit the secondary', () => {
    const crossed = remit.claims[2]!;
    expect(crossed.crossoverCarrier).toEqual({ name: 'STATE MEDICAID', id: 'MCD001' });
  });

  it('parses provider-level adjustments separately from claims', () => {
    expect(remit.providerAdjustments).toHaveLength(1);
    expect(remit.providerAdjustments[0]?.adjustments).toEqual([
      { reasonCode: 'WO', referenceId: '2026243000099', amountCents: -5000 },
      { reasonCode: 'L6', referenceId: undefined, amountCents: 5000 },
    ]);
  });

  it('balances line paid amounts against CLP04', () => {
    expect(checkBalance(remit)).toEqual([]);
  });
});

describe('271 parser', () => {
  const resp = parse271(splitTransactionSets(tokenize(fixture('sample-271.x12')))[0]!);

  it('reads subscriber and plan dates', () => {
    expect(resp.payer.name).toBe('SAMPLE HEALTH PLAN');
    expect(resp.subscriber.memberId).toBe('ABC123456789');
    expect(resp.subscriber.groupNumber).toBe('GRP5550');
    expect(resp.subscriber.dateOfBirth).toBe('1980-01-01');
    expect(resp.subscriber.planDates?.begin).toBe('2026-01-01');
    expect(resp.traceNumbers).toEqual(['TRC-20260901-0001']);
    expect(resp.isActive).toBe(true);
  });

  it('flattens EB loops into structured benefits', () => {
    expect(resp.benefits).toHaveLength(9);
    const copay = resp.benefits.find((b) => b.code === 'B');
    expect(copay?.serviceTypeCodes).toEqual(['98']);
    expect(copay?.amountCents).toBe(2500);
    expect(copay?.inNetwork).toBe(true);
    const coins = resp.benefits.find((b) => b.code === 'A');
    expect(coins?.percentBps).toBe(2000);
    const limit = resp.benefits.find((b) => b.code === 'F');
    expect(limit?.quantityQualifier).toBe('VS');
    expect(limit?.quantity).toBe(20);
    expect(limit?.messages).toEqual(['MENTAL HEALTH VISITS LIMITED TO 20 PER YEAR']);
  });

  it('answers the front-desk question: what do I collect?', () => {
    const summary = summarizeBenefits(resp, '98');
    expect(summary).toMatchObject({
      active: true,
      planDescription: 'PPO GOLD PLAN',
      copayCents: 2500,
      coinsuranceBps: 2000,
      deductibleTotalCents: 150000,
      deductibleRemainingCents: 115000,
      outOfPocketMaxCents: 500000,
      outOfPocketRemainingCents: 420000,
      planBegin: '2026-01-01',
    });
  });
});

describe('837P generator', () => {
  const claim: ProfessionalClaim = {
    patientControlNumber: 'GRV-10041',
    totalChargeCents: 35000,
    placeOfService: '11',
    frequencyCode: '1',
    providerSignatureOnFile: true,
    assignmentCode: 'A',
    benefitsAssigned: true,
    releaseOfInformation: 'Y',
    diagnoses: ['E11.9', 'I10'],
    billingProvider: {
      isPerson: false,
      organization: { name: 'NORTHSIDE FAMILY MEDICINE' },
      npi: '1234567893',
      taxonomyCode: '207Q00000X',
      taxId: '123456789',
      taxIdType: 'EI',
      address: { line1: '100 MAIN ST', city: 'SPRINGFIELD', state: 'IL', postalCode: '627011234' },
    },
    renderingProvider: {
      isPerson: true,
      person: { lastName: 'SMITH', firstName: 'JANE' },
      npi: '1987654328',
      taxonomyCode: '207Q00000X',
    },
    subscriber: {
      person: { lastName: 'ALPHA', firstName: 'ALICE' },
      memberId: 'ABC123456789',
      groupNumber: 'GRP5550',
      dateOfBirth: '1980-01-01',
      sex: 'F',
      address: { line1: '12 OAK LANE', city: 'SPRINGFIELD', state: 'IL', postalCode: '62701' },
      relationshipToPatient: '18',
    },
    payer: { name: 'SAMPLE HEALTH PLAN', payerId: 'SHP001', claimFilingIndicator: 'CI' },
    payerSequence: 'P',
    lines: [
      {
        lineNumber: 1,
        procedureCode: '99214',
        modifiers: ['25'],
        chargeCents: 25000,
        units: 1,
        diagnosisPointers: [1, 2],
        serviceDate: '2026-08-20',
        lineControlNumber: 'L1',
      },
      {
        lineNumber: 2,
        procedureCode: '36415',
        modifiers: [],
        chargeCents: 10000,
        units: 1,
        diagnosisPointers: [1],
        serviceDate: '2026-08-20',
        lineControlNumber: 'L2',
      },
    ],
  };

  const opts = {
    submitter: { name: 'ORCHARD MEDICAL MGMT', id: 'GROVE000001', contactName: 'EDI DESK', contactPhone: '8005550100' },
    receiver: { name: 'STEDI', id: 'STEDI' },
    batchReference: 'BATCH0001',
    timestamp: new Date('2026-09-01T12:00:00Z'),
  };

  it('emits the loop hierarchy in TR3 order with numeric diagnosis pointers', () => {
    const body = generate837P([claim], opts);
    const ids = body.map((s) => s.id);
    expect(ids.slice(0, 6)).toEqual(['BHT', 'NM1', 'PER', 'NM1', 'HL', 'PRV']);

    const clm = body.find((s) => s.id === 'CLM')!;
    expect(clm.el(1)).toBe('GRV-10041');
    expect(clm.el(2)).toBe('350');
    expect(clm.el(5)).toBe('11:B:1');

    const hi = body.find((s) => s.id === 'HI')!;
    expect(hi.el(1)).toBe('ABK:E119');
    expect(hi.el(2)).toBe('ABF:I10');

    const sv1 = body.filter((s) => s.id === 'SV1');
    expect(sv1[0]?.el(1)).toBe('HC:99214:25');
    expect(sv1[0]?.el(7)).toBe('1:2');
    expect(sv1[1]?.el(7)).toBe('1');

    const prv = body.filter((s) => s.id === 'PRV');
    expect(prv.map((p) => p.el(1))).toEqual(['BI', 'PE']);
  });

  it('refuses a corrected claim without the payer control number', () => {
    expect(() => generate837P([{ ...claim, frequencyCode: '7' }], opts)).toThrow(/REF\*F8/);
  });

  it('refuses a 5-digit ZIP in the billing provider loop', () => {
    const bad = { ...claim, billingProvider: { ...claim.billingProvider, address: { ...claim.billingProvider.address!, postalCode: '62701' } } };
    expect(() => generate837P([bad], opts)).toThrow(/9-digit ZIP/);
  });

  it('builds a secondary claim with 2320 and 2430 COB loops', () => {
    const secondary: ProfessionalClaim = {
      ...claim,
      payer: { name: 'STATE MEDICAID', payerId: 'MCD001', claimFilingIndicator: 'MC' },
      payerSequence: 'S',
      otherSubscribers: [
        {
          sequence: 'P',
          relationshipToPatient: '18',
          person: claim.subscriber.person,
          memberId: 'ABC123456789',
          claimFilingIndicator: 'CI',
          payer: claim.payer,
          payerClaimControlNumber: '2026243000123',
          paidAmountCents: 26250,
          claimAdjustments: [],
        },
      ],
      lines: claim.lines.map((l, i) => ({
        ...l,
        priorAdjudications: [
          {
            payerId: 'SHP001',
            procedureCode: l.procedureCode,
            modifiers: l.modifiers,
            paidAmountCents: i === 0 ? 18750 : 7500,
            adjudicationDate: '2026-09-03',
            adjustments: i === 0
              ? [{ group: 'CO', reasonCode: '45', amountCents: 2250 }, { group: 'PR', reasonCode: '3', amountCents: 4000 }]
              : [{ group: 'CO', reasonCode: '45', amountCents: 2500 }],
          },
        ],
      })),
    };
    const body = generate837P([secondary], opts);
    const sbr = body.filter((s) => s.id === 'SBR');
    expect(sbr[0]?.el(1)).toBe('S');
    expect(sbr[1]?.el(1)).toBe('P');
    expect(body.find((s) => s.id === 'AMT')?.el(2)).toBe('262.50');
    const svd = body.filter((s) => s.id === 'SVD');
    expect(svd).toHaveLength(2);
    expect(svd[0]?.el(2)).toBe('187.50');
    const cas = body.filter((s) => s.id === 'CAS');
    expect(cas.some((c) => c.el(1) === 'PR' && c.el(2) === '3' && c.el(3) === '40')).toBe(true);
    expect(body.filter((s) => s.id === 'DTP' && s.el(1) === '573')).toHaveLength(2);
  });

  it('wraps in a valid interchange whose SE count matches', () => {
    const body = generate837P([claim], opts);
    const segments = buildInterchange(
      {
        sender: { qualifier: 'ZZ', id: 'GROVE000001' },
        receiver: { qualifier: 'ZZ', id: 'STEDI' },
        controlNumber: 1,
        usage: 'T',
        timestamp: opts.timestamp,
      },
      { functionalId: 'HC', controlNumber: 1, version: IMPLEMENTATIONS['837P'] },
      [{ type: '837', implementation: IMPLEMENTATIONS['837P'], controlNumber: 1, body }],
    );
    const raw = serialize(segments);
    expect(raw.startsWith('ISA*00*          *00*          *ZZ*GROVE000001    *ZZ*STEDI          *260901*1200*^*00501*000000001*0*T*:~')).toBe(true);
    const doc = tokenize(raw);
    const sets = splitTransactionSets(doc);
    expect(sets).toHaveLength(1);
    expect(sets[0]?.implementation).toBe('005010X222A1');
  });
});

describe('270 generator', () => {
  it('emits a subscriber inquiry with service types', () => {
    const body = generate270(
      {
        payer: { name: 'SAMPLE HEALTH PLAN', id: 'SHP001' },
        provider: { isPerson: true, person: { lastName: 'SMITH', firstName: 'JANE' }, npi: '1987654328' },
        subscriber: { person: { lastName: 'ALPHA', firstName: 'ALICE' }, memberId: 'ABC123456789', dateOfBirth: '1980-01-01', sex: 'F' },
        serviceDate: '2026-09-02',
        serviceTypeCodes: ['30', '98'],
        traceNumber: 'TRC-20260901-0001',
      },
      { timestamp: new Date('2026-09-01T12:00:00Z') },
    );
    const ids = body.map((s) => s.id);
    expect(ids).toEqual(['BHT', 'HL', 'NM1', 'HL', 'NM1', 'HL', 'TRN', 'NM1', 'DMG', 'DTP', 'EQ', 'EQ']);
    expect(body.find((s) => s.id === 'TRN')?.el(2)).toBe('TRC-20260901-0001');
  });
});

describe('276 generator', () => {
  it('emits a claim status inquiry for the subscriber', () => {
    const body = generate276(
      {
        payer: { name: 'SAMPLE HEALTH PLAN', id: 'SHP001' },
        provider: { isPerson: true, person: { lastName: 'SMITH', firstName: 'JANE' }, npi: '1987654328' },
        subscriber: { person: { lastName: 'ALPHA', firstName: 'ALICE' }, memberId: 'ABC123456789' },
        claim: { patientControlNumber: 'GRV-10041', totalChargeCents: 35000, serviceDateFrom: '2026-08-20' },
        traceNumber: 'TRC-20260901-0002',
      },
      { timestamp: new Date('2026-09-01T13:00:00Z') },
    );
    const ids = body.map((s) => s.id);
    expect(ids).toEqual(['BHT', 'HL', 'NM1', 'HL', 'NM1', 'HL', 'NM1', 'TRN', 'REF', 'AMT', 'DTP']);
    expect(body.find((s) => s.id === 'REF')?.el(2)).toBe('GRV-10041');
    expect(body.find((s) => s.id === 'AMT')?.el(2)).toBe('350');
  });

  it('nests the claim status detail under the dependent when the patient is not the subscriber', () => {
    const body = generate276(
      {
        payer: { name: 'SAMPLE HEALTH PLAN', id: 'SHP001' },
        provider: { isPerson: true, person: { lastName: 'SMITH', firstName: 'JANE' }, npi: '1987654328' },
        subscriber: { person: { lastName: 'ALPHA', firstName: 'ALICE' }, memberId: 'ABC123456789' },
        dependent: { person: { lastName: 'ALPHA', firstName: 'JUNIOR' } },
        claim: { patientControlNumber: 'GRV-10099', serviceDateFrom: '2026-08-20', serviceDateThrough: '2026-08-20' },
        traceNumber: 'TRC-20260901-0003',
      },
      { timestamp: new Date('2026-09-01T13:00:00Z') },
    );
    const ids = body.map((s) => s.id);
    expect(ids).toEqual(['BHT', 'HL', 'NM1', 'HL', 'NM1', 'HL', 'NM1', 'HL', 'NM1', 'TRN', 'REF', 'DTP']);
    expect(body.find((s) => s.id === 'DTP')?.el(3)).toBe('20260820-20260820');
  });
});

describe('278 generator', () => {
  it('emits a prior-authorization request with UM, diagnoses, and service lines', () => {
    const body = generate278(
      {
        payer: { name: 'SAMPLE HEALTH PLAN', id: 'SHP001' },
        requester: { isPerson: true, person: { lastName: 'SMITH', firstName: 'JANE' }, npi: '1987654328' },
        subscriber: { person: { lastName: 'ALPHA', firstName: 'ALICE' }, memberId: 'ABC123456789' },
        certificationTypeCode: 'I',
        serviceTypeCode: 'HC',
        diagnosisCodes: ['M54.5'],
        procedureCodes: ['97110', '97140'],
        serviceDateFrom: '2026-09-15',
        serviceDateThrough: '2026-12-15',
        traceNumber: 'TRC-20260901-0004',
      },
      { timestamp: new Date('2026-09-01T14:00:00Z') },
    );
    const ids = body.map((s) => s.id);
    expect(ids).toEqual(['BHT', 'HL', 'NM1', 'HL', 'NM1', 'HL', 'NM1', 'TRN', 'UM', 'HI', 'DTP', 'SV1', 'SV1']);
    expect(body.find((s) => s.id === 'UM')?.el(1)).toBe('I');
    expect(body.find((s) => s.id === 'HI')?.el(1)).toBe('ABK:M545');
    const sv1 = body.filter((s) => s.id === 'SV1');
    expect(sv1.map((s) => s.el(1))).toEqual(['HC:97110', 'HC:97140']);
  });
});
