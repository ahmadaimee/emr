import {
  buildInterchange,
  IMPLEMENTATIONS,
  parse271,
  parse835,
  seg,
  serialize,
  splitTransactionSets,
  tokenize,
  type EligibilityInquiry270,
} from '@grove/x12';
import type {
  ClaimStatusRequest,
  ClaimStatusResult,
  ClearinghouseAdapter,
  EligibilityResult,
  FetchAcknowledgmentsResult,
  FetchRemittancesResult,
  SubmitClaimRequest,
  SubmitClaimResult,
} from './adapter';

/**
 * Offline connector. Replays deterministic responses so the entire claim lifecycle —
 * submit → 999 → 277CA → 835 → secondary — is exercisable with no vendor account and no
 * network. Behaviour can be steered per member/claim through the control numbers:
 *
 *   member ID ending in "INACTIVE"  → 271 reports inactive coverage
 *   member ID ending in "NOTFOUND"  → 271 AAA*75 subscriber not found
 *   patient control number containing "DENY" → 835 denies with CO-197
 *   patient control number containing "REJECT" → 277CA rejects
 */
export class MockClearinghouse implements ClearinghouseAdapter {
  readonly name = 'mock' as const;
  private submissions = new Map<string, SubmitClaimRequest>();
  private counter = 1000;

  async submitClaim(req: SubmitClaimRequest): Promise<SubmitClaimResult> {
    // Validate that what we were handed is at least well-formed X12.
    splitTransactionSets(tokenize(req.x12));
    const submissionId = `mock-sub-${++this.counter}`;
    this.submissions.set(submissionId, req);
    return {
      meta: { connector: 'mock', durationMs: 5, costCents: 0 },
      submissionId,
      immediateAck: { type: 'connector', result: 'A', receivedAt: new Date(), message: 'Accepted by mock' },
    };
  }

  async fetchAcknowledgments(submissionId: string): Promise<FetchAcknowledgmentsResult> {
    const req = this.submissions.get(submissionId);
    if (!req) return { meta: { connector: 'mock', durationMs: 1, costCents: 0 }, acknowledgments: [] };
    const now = new Date();
    return {
      meta: { connector: 'mock', durationMs: 1, costCents: 0 },
      acknowledgments: [
        { type: 'x999', result: 'A', receivedAt: now },
        ...req.patientControlNumbers.map((pcn) =>
          pcn.includes('REJECT')
            ? {
                type: 'x277ca' as const,
                result: 'R' as const,
                patientControlNumber: pcn,
                statusCategoryCode: 'A7',
                statusCode: '562',
                message: 'Entity\'s National Provider Identifier (NPI) is invalid',
                receivedAt: now,
              }
            : {
                type: 'x277ca' as const,
                result: 'A' as const,
                patientControlNumber: pcn,
                payerClaimControlNumber: `MOCK${pcn.replace(/\D/g, '').padStart(10, '0')}`,
                statusCategoryCode: 'A1',
                statusCode: '19',
                receivedAt: now,
              },
        ),
      ],
    };
  }

  async checkEligibility(req: EligibilityInquiry270): Promise<EligibilityResult> {
    const member = req.subscriber.memberId.toUpperCase();
    const s = req.subscriber;
    const body = [
      seg('BHT', '0022', '11', req.traceNumber, '20260901', '1200'),
      seg('HL', 1, '', '20', '1'),
      seg('NM1', 'PR', '2', req.payer.name, '', '', '', '', 'PI', req.payer.id),
      seg('HL', 2, 1, '21', '1'),
      seg('NM1', '1P', '2', 'PROVIDER', '', '', '', '', 'XX', req.provider.npi),
      seg('HL', 3, 2, '22', '0'),
      seg('TRN', '2', req.traceNumber, `9${req.provider.npi}`),
      seg('NM1', 'IL', '1', s.person.lastName, s.person.firstName, '', '', '', 'MI', s.memberId),
    ];

    if (member.endsWith('NOTFOUND')) {
      body.push(seg('AAA', 'N', '', '75', 'C'));
    } else if (member.endsWith('INACTIVE')) {
      body.push(seg('DMG', 'D8', (s.dateOfBirth ?? '1980-01-01').replace(/-/g, ''), s.sex ?? 'U'));
      body.push(seg('DTP', '347', 'D8', '20260630'));
      body.push(seg('EB', '6', '', '30'));
    } else {
      body.push(seg('DMG', 'D8', (s.dateOfBirth ?? '1980-01-01').replace(/-/g, ''), s.sex ?? 'U'));
      body.push(seg('DTP', '346', 'D8', '20260101'));
      body.push(seg('EB', '1', '', '30', 'PPO', 'MOCK GOLD PLAN'));
      body.push(seg('EB', 'B', '', '98', 'PPO', 'MOCK GOLD PLAN', '27', '30', '', '', '', 'N', 'Y'));
      body.push(seg('EB', 'A', '', '30', 'PPO', '', '23', '', '.2', '', '', 'N', 'Y'));
      body.push(seg('EB', 'C', 'IND', '30', 'PPO', '', '23', '2000', '', '', '', 'N', 'Y'));
      body.push(seg('EB', 'C', 'IND', '30', 'PPO', '', '29', '1350.25', '', '', '', 'N', 'Y'));
      body.push(seg('EB', 'G', 'IND', '30', 'PPO', '', '23', '6000', '', '', '', 'N', 'Y'));
      body.push(seg('EB', 'G', 'IND', '30', 'PPO', '', '29', '4800', '', '', '', 'N', 'Y'));
    }

    const segments = buildInterchange(
      {
        sender: { qualifier: 'ZZ', id: req.payer.id },
        receiver: { qualifier: 'ZZ', id: 'GROVE' },
        controlNumber: this.counter++,
        usage: 'T',
        timestamp: new Date('2026-09-01T12:00:00Z'),
      },
      { functionalId: 'HB', controlNumber: this.counter, version: IMPLEMENTATIONS['271'] },
      [{ type: '271', implementation: IMPLEMENTATIONS['271'], controlNumber: 1, body }],
    );
    const raw271 = serialize(segments);
    const parsed = parse271(splitTransactionSets(tokenize(raw271))[0]!);
    return { meta: { connector: 'mock', durationMs: 12, costCents: 0 }, raw271, parsed };
  }

  async checkClaimStatus(req: ClaimStatusRequest): Promise<ClaimStatusResult> {
    const denied = req.patientControlNumber.includes('DENY');
    return {
      meta: { connector: 'mock', durationMs: 8, costCents: 0 },
      statusCategoryCode: denied ? 'F2' : 'F1',
      statusCode: denied ? '96' : '65',
      statusDescription: denied ? 'Finalized/Denial' : 'Finalized/Payment',
      isFinal: true,
      paidAmountCents: denied ? 0 : Math.round(req.totalChargeCents * 0.75),
      effectiveDate: '2026-09-03',
      payerClaimControlNumber: req.payerClaimControlNumber,
    };
  }

  async fetchRemittances(_since: Date): Promise<FetchRemittancesResult> {
    // Build an 835 that pays 75% of every submitted claim, denying any marked DENY.
    const files = [...this.submissions.entries()].map(([id, req]) => {
      const sets = splitTransactionSets(tokenize(req.x12));
      const claimSegs = sets.flatMap((s) => s.segments.filter((x) => x.id === 'CLM'));
      let total = 0;
      const body = [
        seg('BPR', 'I', '0', 'C', 'ACH', 'CCP', '01', '021000021', 'DA', '1', '1', '', '01', '1', 'DA', '1', '20260903'),
        seg('TRN', '1', `MOCK${id}`, '1000000000'),
        seg('DTM', '405', '20260902'),
        seg('N1', 'PR', 'MOCK PAYER'),
        seg('N1', 'PE', 'PAYEE', 'XX', '1234567893'),
        seg('LX', 1),
      ];
      for (const clm of claimSegs) {
        const pcn = clm.el(1);
        const charge = Number(clm.el(2));
        const deny = pcn.includes('DENY');
        const paid = deny ? 0 : Math.round(charge * 75) / 100;
        total += paid;
        body.push(seg('CLP', pcn, deny ? '4' : '1', clm.el(2), paid.toFixed(2), '0', '12', `MOCK${pcn.replace(/\D/g, '')}`, '11', '1'));
        body.push(seg('SVC', ['HC', '99213'], clm.el(2), paid.toFixed(2), '', '1'));
        body.push(seg('DTM', '472', '20260820'));
        body.push(deny ? seg('CAS', 'CO', '197', clm.el(2)) : seg('CAS', 'CO', '45', (charge - paid).toFixed(2)));
      }
      body[0] = seg('BPR', 'I', total.toFixed(2), 'C', 'ACH', 'CCP', '01', '021000021', 'DA', '1', '1', '', '01', '1', 'DA', '1', '20260903');
      const segments = buildInterchange(
        { sender: { qualifier: 'ZZ', id: 'MOCKPAYER' }, receiver: { qualifier: 'ZZ', id: 'GROVE' }, controlNumber: this.counter++, usage: 'T', timestamp: new Date('2026-09-03T12:00:00Z') },
        { functionalId: 'HP', controlNumber: this.counter, version: IMPLEMENTATIONS['835'] },
        [{ type: '835', implementation: IMPLEMENTATIONS['835'], controlNumber: 1, body }],
      );
      const raw835 = serialize(segments);
      return {
        fileId: `mock-835-${id}`,
        receivedAt: new Date(),
        raw835,
        parsed: splitTransactionSets(tokenize(raw835)).map(parse835),
      };
    });
    return { meta: { connector: 'mock', durationMs: 3, costCents: 0 }, files };
  }
}
