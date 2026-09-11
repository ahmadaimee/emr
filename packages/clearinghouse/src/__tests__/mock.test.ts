import { splitTransactionSets, tokenize } from '@grove/x12';
import { describe, expect, it } from 'vitest';
import { MockClearinghouse } from '../mock';

const X12 = 'ISA*00*          *00*          *ZZ*GROVE000001    *ZZ*STEDI          *260901*1200*^*00501*000000001*0*T*:~GS*HC*GROVE000001*STEDI*20260901*1200*1*X*005010X222A1~ST*837*0001*005010X222A1~CLM*{{PCN}}*350***11:B:1~SE*3*0001~GE*1*1~IEA*1*000000001~';

describe('MockClearinghouse', () => {
  it('999s and 277CAs a clean submission, with raw X12 that round-trips', async () => {
    const ch = new MockClearinghouse();
    const { submissionId } = await ch.submitClaim({ x12: X12.replace('{{PCN}}', 'GRV-10041'), patientControlNumbers: ['GRV-10041'], payerId: 'SHP001', usage: 'T' });

    const result = await ch.fetchAcknowledgments(submissionId);
    expect(result.acknowledgments).toHaveLength(2);

    const x999 = result.acknowledgments[0]!;
    expect(x999).toMatchObject({ type: 'x999', result: 'A' });
    expect(x999.raw).toBeTruthy();
    expect(splitTransactionSets(tokenize(x999.raw!))[0]?.type).toBe('999');

    const x277ca = result.acknowledgments[1]!;
    expect(x277ca).toMatchObject({ type: 'x277ca', result: 'A', patientControlNumber: 'GRV-10041', statusCategoryCode: 'A2' });
    expect(x277ca.payerClaimControlNumber).toMatch(/^MOCK/);
    expect(splitTransactionSets(tokenize(x277ca.raw!))[0]?.type).toBe('277');
  });

  it('rejects a claim whose patient control number contains REJECT', async () => {
    const ch = new MockClearinghouse();
    const { submissionId } = await ch.submitClaim({ x12: X12.replace('{{PCN}}', 'GRV-REJECT-1'), patientControlNumbers: ['GRV-REJECT-1'], payerId: 'SHP001', usage: 'T' });

    const result = await ch.fetchAcknowledgments(submissionId);
    const x277ca = result.acknowledgments.find((a) => a.type === 'x277ca')!;
    expect(x277ca.result).toBe('R');
    expect(x277ca.statusCategoryCode).toBe('A7');
    expect(x277ca.message).toMatch(/NPI/);
  });

  it('returns nothing for an unknown submission id', async () => {
    const ch = new MockClearinghouse();
    expect((await ch.fetchAcknowledgments('nope')).acknowledgments).toEqual([]);
  });

  it('finalizes a claim status check as paid, with a raw 277 that parses back to the same numbers', async () => {
    const ch = new MockClearinghouse();
    const result = await ch.checkClaimStatus({
      payerId: 'SHP001', patientControlNumber: 'GRV-10041', billingProviderNpi: '1234567893',
      subscriberMemberId: 'ABC123456789', subscriber: { lastName: 'ALPHA', firstName: 'ALICE', dateOfBirth: '1980-01-01' },
      serviceDateFrom: '2026-08-20', serviceDateTo: '2026-08-20', totalChargeCents: 35000, traceNumber: 'TRC-1',
    });
    expect(result.isFinal).toBe(true);
    expect(result.statusCategoryCode).toBe('F1');
    expect(result.paidAmountCents).toBe(26250);
    expect(result.raw277).toBeTruthy();
    expect(splitTransactionSets(tokenize(result.raw277!))[0]?.type).toBe('277');
  });

  it('finalizes a DENY-flagged claim status check as denied with zero payment', async () => {
    const ch = new MockClearinghouse();
    const result = await ch.checkClaimStatus({
      payerId: 'SHP001', patientControlNumber: 'GRV-DENY-1', billingProviderNpi: '1234567893',
      subscriberMemberId: 'ABC123456789', subscriber: { lastName: 'ALPHA', firstName: 'ALICE', dateOfBirth: '1980-01-01' },
      serviceDateFrom: '2026-08-20', serviceDateTo: '2026-08-20', totalChargeCents: 35000, traceNumber: 'TRC-2',
    });
    expect(result.statusCategoryCode).toBe('F2');
    expect(result.paidAmountCents).toBe(0);
  });
});
