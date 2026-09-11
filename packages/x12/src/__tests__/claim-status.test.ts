import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { describeClaimStatusCategory, isRejectionCategory } from '../claim-status-codes';
import { parse277 } from '../parsers/277';
import { parse277CA } from '../parsers/277ca';
import { parse999 } from '../parsers/999';
import { splitTransactionSets, tokenize } from '../tokenizer';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(join(here, 'fixtures', name), 'utf8').trim();

describe('999 parser', () => {
  const ack = parse999(splitTransactionSets(tokenize(fixture('sample-999.x12')))[0]!);

  it('reads the functional group header and reports clean acceptance', () => {
    expect(ack.functionalIdCode).toBe('HC');
    expect(ack.groupControlNumber).toBe('202');
    expect(ack.statusCode).toBe('A');
    expect(ack.accepted).toBe(true);
  });

  it('lists the acknowledged transaction set', () => {
    expect(ack.transactionSets).toHaveLength(1);
    expect(ack.transactionSets[0]).toMatchObject({ transactionSetIdCode: '837', transactionSetControlNumber: '0001', statusCode: 'A' });
  });

  it('flags a rejected group as not accepted', () => {
    const raw = fixture('sample-999.x12').replace('AK5*A~', 'AK5*R*5~').replace('AK9*A*1*1*1~', 'AK9*R*1*1*0~');
    const rejected = parse999(splitTransactionSets(tokenize(raw))[0]!);
    expect(rejected.accepted).toBe(false);
    expect(rejected.transactionSets[0]?.statusCode).toBe('R');
    expect(rejected.transactionSets[0]?.errorCodes).toEqual(['5']);
  });
});

describe('277CA parser', () => {
  const ca = parse277CA(splitTransactionSets(tokenize(fixture('sample-277ca.x12')))[0]!);

  it('reads the payer and submitter names', () => {
    expect(ca.payer.name).toBe('SAMPLE CLEARINGHOUSE');
    expect(ca.submitter.name).toBe('ORCHARD MEDICAL MGMT');
  });

  it('reports one status per HL*PT claim loop, keyed on our own patient control number', () => {
    expect(ca.claims).toHaveLength(2);
    const accepted = ca.claims[0]!;
    expect(accepted.patientControlNumber).toBe('GRV-10041');
    expect(accepted.payerClaimControlNumber).toBe('2026243000123');
    expect(accepted.status).toEqual({ categoryCode: 'A2', statusCode: '20', entityCode: undefined, effectiveDate: '2026-09-01', totalChargeCents: 35000 });

    const rejected = ca.claims[1]!;
    expect(rejected.patientControlNumber).toBe('GRV-10042');
    expect(rejected.payerClaimControlNumber).toBeUndefined();
    expect(rejected.status.categoryCode).toBe('A7');
  });

  it('classifies category codes into acknowledged vs. error families', () => {
    expect(describeClaimStatusCategory('A2').family).toBe('acknowledged');
    expect(isRejectionCategory('A7')).toBe(true);
    expect(isRejectionCategory('A2')).toBe(false);
  });
});

describe('277 parser', () => {
  const resp = parse277(splitTransactionSets(tokenize(fixture('sample-277.x12')))[0]!);

  it('reads the payer and subscriber', () => {
    expect(resp.payer.name).toBe('SAMPLE HEALTH PLAN');
    expect(resp.subscriber.memberId).toBe('ABC123456789');
    expect(resp.traceNumbers).toEqual(['TRC-20260901-0002']);
  });

  it('attaches the STC status and control numbers to the claim', () => {
    expect(resp.claims).toHaveLength(1);
    const claim = resp.claims[0]!;
    expect(claim.patientControlNumber).toBe('GRV-10041');
    expect(claim.payerClaimControlNumber).toBe('2026243000123');
    expect(claim.statuses).toHaveLength(1);
    expect(claim.statuses[0]).toMatchObject({
      categoryCode: 'F1',
      statusCode: '65',
      totalChargeCents: 35000,
      totalPaidCents: 26250,
      patientResponsibilityCents: 4000,
    });
  });
});
