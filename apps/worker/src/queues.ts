/**
 * Queue names and the outbox routing table.
 *
 * Every queue payload is IDs and small scalars only. Nothing here carries a name, a
 * date of birth, or a dollar amount that could identify a person — the job reloads
 * what it needs inside its own tenant transaction.
 */
export const Q = {
  outboxRelay: 'outbox.relay',
  webhookDispatch: 'webhooks.dispatch',
  webhookDeliver: 'webhooks.deliver',

  eligibilityCheck: 'eligibility.check',
  eligibilityBatchFanout: 'eligibility.batch.fanout',
  eligibilityPreVisit: 'eligibility.pre-visit',
  eligibilityMonthly: 'eligibility.monthly',

  claimSubmit: 'claim.submit',
  claimAckFetch: 'claim.ack.fetch',
  claimAckFetchSweep: 'claim.ack.fetch.sweep',
  claimStatusPoll: 'claim.status.poll',
  claimTimelyFilingSweep: 'claim.timely-filing.sweep',
  claimAutoSubmitSweep: 'claim.auto-submit.sweep',

  authorizationOverdueSweep: 'authorization.overdue.sweep',

  eraFetch: 'era.fetch',
  eraPost: 'era.post',

  cobGenerateSecondary: 'cob.generate-secondary',
  cobCrossoverWait: 'cob.crossover-wait',

  auditVerifyChain: 'audit.verify-chain',
  balancesReconcile: 'balances.reconcile',
} as const;

export type QueueName = (typeof Q)[keyof typeof Q];

export interface OutboxRoute {
  queue: QueueName;
  /** Delay before the job becomes eligible, in seconds. */
  startAfterSeconds?: number;
  /** Build the job payload from the event payload. */
  map: (payload: Record<string, unknown>) => Record<string, unknown>;
  singletonKey?: (payload: Record<string, unknown>) => string;
}

/**
 * Which domain events trigger which follow-up jobs. Everything ALSO goes to the
 * webhook dispatcher, which is handled separately in the relay.
 */
export const ROUTES: Partial<Record<string, OutboxRoute[]>> = {
  'claim.submitted': [
    { queue: 'claim.ack.fetch', startAfterSeconds: 5 * 60, map: (p) => ({ claimId: p['claimId'] ?? p['aggregateId'], submissionId: p['submissionId'], connectorSubmissionId: p['connectorSubmissionId'], attempt: 1 }), singletonKey: (p) => `ack:${p['submissionId']}` },
  ],
  'claim.acknowledged': [
    // First status check waits for the payer's typical adjudication window; the poller
    // reads learned payer behaviour and reschedules itself.
    { queue: 'claim.status.poll', startAfterSeconds: 7 * 86_400, map: (p) => ({ claimId: p['claimId'] ?? p['aggregateId'], attempt: 1 }), singletonKey: (p) => `status:${p['claimId'] ?? p['aggregateId']}` },
  ],
  'claim.secondary_ready': [
    { queue: 'cob.generate-secondary', map: (p) => ({ primaryClaimId: p['aggregateId'], remittanceClaimId: p['remittanceClaimId'], secondaryCoverageId: p['secondaryCoverageId'] }), singletonKey: (p) => `secondary:${p['remittanceClaimId']}` },
  ],
  'claim.crossover_expected': [
    { queue: 'cob.crossover-wait', startAfterSeconds: (Number(process.env.CROSSOVER_WAIT_DAYS ?? 30)) * 86_400, map: (p) => ({ primaryClaimId: p['aggregateId'], secondaryCoverageId: p['secondaryCoverageId'] }), singletonKey: (p) => `crossover:${p['aggregateId']}` },
  ],
};
