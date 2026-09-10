import { describe, expect, it } from 'vitest';
import { validateRule, RuleValidationError, type RuleDefinition } from '../ast';
import { evaluateRule } from '../evaluator';
import type { ClaimFacts, ReferenceData } from '../facts';
import { isValidNpi } from '../npi';
import { scrubClaim } from '../index';

const baseFacts = (): ClaimFacts => ({
  claim: {
    id: 'c1',
    claimNumber: 'GRV-10041',
    type: 'professional',
    frequencyCode: '1',
    placeOfService: '11',
    totalChargeCents: 35000,
    serviceDateFrom: '2026-08-20',
    diagnoses: ['E119', 'I10'],
    payerSequence: 'P',
    relatedToAutoAccident: false,
    relatedToEmployment: false,
  },
  lines: [
    { lineNumber: 1, procedureCode: '99214', modifiers: ['25'], units: 1, chargeCents: 25000, diagnosisPointers: [1, 2], serviceDate: '2026-08-20', placeOfService: '11', abnObtained: false, emergency: false },
    { lineNumber: 2, procedureCode: '36415', modifiers: [], units: 1, chargeCents: 10000, diagnosisPointers: [1], serviceDate: '2026-08-20', placeOfService: '11', abnObtained: false, emergency: false },
  ],
  patient: { id: 'p1', dateOfBirth: '1980-01-01', sex: 'F', ageAtService: 46 },
  coverage: { memberId: 'ABC123', relationshipCode: '18', effectiveDate: '2026-01-01', lastVerifiedAt: '2026-08-18', lastVerifiedStatus: 'active' },
  payer: { id: 'py1', name: 'Sample Health Plan', type: 'commercial', timelyFilingDays: 180, supportsSecondaryElectronic: true },
  billingProvider: { npi: '1234567893', taxId: '123456789', taxonomyCode: '207Q00000X', postalCode: '627011234' },
  renderingProvider: { npi: '1987654321', taxonomyCode: '207Q00000X', enrollmentStatus: 'participating' },
  location: { postalCode: '627011234', macJurisdiction: 'J6', state: 'IL' },
  sameDayLinesOnOtherClaims: [],
  today: '2026-09-01',
});

const ref: ReferenceData = {
  ncciPtp: (a, b) => (a === '99214' && b === '36415' ? { modifierIndicator: '1' } : a === '99214' && b === '99213' ? { modifierIndicator: '0' } : null),
  mue: (code) => (code === '36415' ? { maxUnits: 1, mai: '3' } : code === 'J3490' ? { maxUnits: 2, mai: '1' } : null),
  addOnPrimaries: (code) => (code === '99292' ? { primaryCodes: ['99291'], addOnType: '1' } : null),
  procedure: (code) => (code === '99214' ? { isAddOn: false } : code === '36415' ? { isAddOn: false } : code === '99292' ? { isAddOn: true } : { isAddOn: false }),
  diagnosis: (code) => (code === 'E119' || code === 'I10' ? { billable: true } : code === 'E11' ? { billable: false } : code === 'N18' ? { billable: true, sexRestriction: 'M' } : null),
  medicalNecessity: (proc, dx) => (proc === '80061' && dx === 'E119' ? 'supports' : proc === '80061' ? 'does_not_support' : 'no_policy'),
  placeOfService: (code) => (['02', '10', '11', '22'].includes(code) ? { facilityRate: code !== '11' && code !== '10' } : null),
};

describe('NPI check digit', () => {
  it('validates real-format NPIs', () => {
    expect(isValidNpi('1234567893')).toBe(true);
    expect(isValidNpi('1987654321')).toBe(true);
    expect(isValidNpi('1234567890')).toBe(false);
    expect(isValidNpi('123456789')).toBe(false);
  });
});

describe('system rules', () => {
  it('passes a clean claim', () => {
    const result = scrubClaim(baseFacts(), ref);
    // 36415 with 99214 is an indicator-1 pair; line 2 has no bypass modifier.
    expect(result.findings.map((f) => f.ruleKey)).toEqual(['sys.ncci.ptp']);
    expect(result.clean).toBe(false);
    const f = result.findings[0]!;
    expect(f.suggestedFix?.action).toBe('add_modifier');
    expect(f.evidence?.['modifierIndicator']).toBe('1');
  });

  it('accepts a bypass modifier on an indicator-1 pair', () => {
    const facts = baseFacts();
    facts.lines[1]!.modifiers = ['XU'];
    expect(scrubClaim(facts, ref).clean).toBe(true);
  });

  it('never lets a modifier unbundle an indicator-0 pair', () => {
    const facts = baseFacts();
    facts.lines[1] = { ...facts.lines[1]!, procedureCode: '99213', modifiers: ['59'] };
    const result = scrubClaim(facts, ref);
    const f = result.findings.find((x) => x.ruleKey === 'sys.ncci.ptp')!;
    expect(f.severity).toBe('error');
    expect(f.message).toMatch(/indicator 0/);
    expect(f.message).toMatch(/will not be honoured/);
    expect(f.suggestedFix?.action).toBe('remove_line');
  });

  it('sums MUE units across other same-day claims for MAI 2/3', () => {
    const facts = baseFacts();
    facts.lines[1]!.modifiers = ['XU'];
    facts.sameDayLinesOnOtherClaims = [{ procedureCode: '36415', units: 1, modifiers: [] }];
    const result = scrubClaim(facts, ref);
    const f = result.findings.find((x) => x.ruleKey === 'sys.mue')!;
    expect(f).toBeDefined();
    expect(f.evidence?.['totalUnits']).toBe(2);
    expect(f.evidence?.['otherClaimUnits']).toBe(1);
    expect(f.message).toMatch(/MAI 3/);
  });

  it('judges MAI 1 per line', () => {
    const facts = baseFacts();
    facts.lines = [
      { ...facts.lines[0]!, procedureCode: 'J3490', units: 2 },
      { ...facts.lines[1]!, procedureCode: 'J3490', units: 2, modifiers: ['76'] },
    ];
    const result = scrubClaim(facts, ref);
    expect(result.findings.filter((f) => f.ruleKey === 'sys.mue')).toHaveLength(0);
    facts.lines[0]!.units = 3;
    expect(scrubClaim(facts, ref).findings.find((f) => f.ruleKey === 'sys.mue')?.suggestedFix?.value).toBe(2);
  });

  it('flags an add-on billed alone', () => {
    const facts = baseFacts();
    facts.lines = [{ ...facts.lines[0]!, procedureCode: '99292', modifiers: [] }];
    const f = scrubClaim(facts, ref).findings.find((x) => x.ruleKey === 'sys.addon');
    expect(f?.message).toMatch(/99291/);
  });

  it('catches out-of-range and missing diagnosis pointers', () => {
    const facts = baseFacts();
    facts.lines[0]!.diagnosisPointers = [1, 3];
    facts.lines[1]!.diagnosisPointers = [];
    facts.lines[1]!.modifiers = ['XU'];
    const keys = scrubClaim(facts, ref).findings.filter((f) => f.ruleKey === 'sys.dx.pointers');
    expect(keys).toHaveLength(2);
  });

  it('requires a telehealth modifier for POS 02/10', () => {
    const facts = baseFacts();
    facts.lines = [{ ...facts.lines[0]!, placeOfService: '10' }];
    const f = scrubClaim(facts, ref).findings.find((x) => x.ruleKey === 'sys.pos');
    expect(f?.suggestedFix?.value).toBe('95');
  });

  it('warns about medical necessity for Medicare and recommends GA when an ABN exists', () => {
    const facts = baseFacts();
    facts.payer.type = 'medicare';
    facts.claim.diagnoses = ['I10'];
    facts.lines = [{ ...facts.lines[0]!, procedureCode: '80061', modifiers: [], diagnosisPointers: [1], abnObtained: true }];
    const f = scrubClaim(facts, ref).findings.find((x) => x.ruleKey === 'sys.medical_necessity')!;
    expect(f.suggestedFix?.action).toBe('add_modifier');
    expect(f.suggestedFix?.value).toBe('GA');
    facts.lines[0]!.abnObtained = false;
    expect(scrubClaim(facts, ref).findings.find((x) => x.ruleKey === 'sys.medical_necessity')?.suggestedFix?.action).toBe('obtain_abn');
  });

  it('escalates timely filing as the window closes', () => {
    const facts = baseFacts();
    facts.lines[1]!.modifiers = ['XU'];
    facts.today = '2026-09-01';
    expect(scrubClaim(facts, ref).findings.find((f) => f.ruleKey === 'sys.timely_filing')).toBeUndefined();
    facts.today = '2027-02-10';
    expect(scrubClaim(facts, ref).findings.find((f) => f.ruleKey === 'sys.timely_filing')?.severity).toBe('warning');
    facts.today = '2027-03-01';
    expect(scrubClaim(facts, ref).findings.find((f) => f.ruleKey === 'sys.timely_filing')?.severity).toBe('error');
  });

  it('demands REF*F8 on corrected claims', () => {
    const facts = baseFacts();
    facts.claim.frequencyCode = '7';
    expect(scrubClaim(facts, ref).findings.some((f) => f.ruleKey === 'sys.frequency')).toBe(true);
    facts.claim.originalPayerClaimControlNumber = '2026243000123';
    expect(scrubClaim(facts, ref).findings.some((f) => f.ruleKey === 'sys.frequency')).toBe(false);
  });
});

describe('tenant rule language', () => {
  const rule: RuleDefinition = {
    $schema: 'grove.rule/v1',
    scope: 'line',
    when: {
      op: 'and',
      args: [
        { op: 'eq', left: { op: 'get', path: 'payer.name' }, right: { op: 'lit', value: 'Sample Health Plan' } },
        { op: 'startsWith', left: { op: 'var', name: 'line', path: 'procedureCode' }, right: { op: 'lit', value: '992' } },
        { op: 'not', arg: { op: 'contains', left: { op: 'var', name: 'line', path: 'modifiers' }, right: { op: 'lit', value: '25' } } },
        {
          op: 'any',
          over: { op: 'get', path: 'lines' },
          as: 'other',
          where: { op: 'ne', left: { op: 'var', name: 'other', path: 'lineNumber' }, right: { op: 'var', name: 'line', path: 'lineNumber' } },
        },
      ],
    },
    message: '{{payer.name}} requires modifier 25 on {{line.procedureCode}} when billed with another service.',
    path: '/lines/{{lineIndex}}/modifiers',
    suggestedFix: { action: 'add_modifier', target: '/lines/{{lineIndex}}/modifiers', value: '25', explanation: 'Payer policy.' },
  };

  it('validates and evaluates a quantified line rule', () => {
    validateRule(rule);
    const facts = baseFacts();
    facts.lines[0]!.modifiers = [];
    const findings = evaluateRule({ key: 't.em25', name: 'E/M with 25', severity: 'error', definition: rule }, facts);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.message).toBe('Sample Health Plan requires modifier 25 on 99214 when billed with another service.');
    expect(findings[0]?.path).toBe('/lines/0/modifiers');
    expect(findings[0]?.suggestedFix?.target).toBe('/lines/0/modifiers');
  });

  it('rejects unknown operators, unbound variables, and unsafe regexes', () => {
    expect(() => validateRule({ ...rule, when: { op: 'eval', code: 'x' } })).toThrow(RuleValidationError);
    expect(() => validateRule({ ...rule, scope: 'claim', when: { op: 'var', name: 'line' } })).toThrow(/unbound/);
    expect(() => validateRule({ ...rule, when: { op: 'matches', left: { op: 'lit', value: 'a' }, pattern: '(' } })).toThrow(/invalid regular expression/);
  });

  it('supports sum, count and daysBetween', () => {
    const def: RuleDefinition = {
      $schema: 'grove.rule/v1',
      scope: 'claim',
      when: {
        op: 'and',
        args: [
          { op: 'gt', left: { op: 'sum', over: { op: 'get', path: 'lines' }, as: 'l', select: { op: 'var', name: 'l', path: 'chargeCents' } }, right: { op: 'lit', value: 30000 } },
          { op: 'eq', left: { op: 'count', over: { op: 'get', path: 'lines' }, as: 'l' }, right: { op: 'lit', value: 2 } },
          { op: 'gt', left: { op: 'daysBetween', from: { op: 'get', path: 'claim.serviceDateFrom' }, to: { op: 'get', path: 'today' } }, right: { op: 'lit', value: 10 } },
        ],
      },
      message: 'Claim over $300 with 2 lines, aged more than 10 days.',
    };
    validateRule(def);
    expect(evaluateRule({ key: 't', name: 't', severity: 'info', definition: def }, baseFacts())).toHaveLength(1);
  });
});
