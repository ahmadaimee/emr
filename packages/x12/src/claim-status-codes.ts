/**
 * Health Care Claim Status Category Codes (STC01-1) — the coarse family a status
 * belongs to. There are dozens of the fine-grained status codes (STC01-2) published
 * by X12, too many to usefully embed here; the category is what a worklist actually
 * groups and prioritizes on, so that's what gets a lookup table.
 */
export type ClaimStatusFamily = 'acknowledged' | 'pending' | 'finalized' | 'info_requested' | 'error' | 'unknown';

const CATEGORY: Record<string, { family: ClaimStatusFamily; description: string }> = {
  A0: { family: 'acknowledged', description: 'Acknowledgement — forwarded by clearinghouse' },
  A1: { family: 'acknowledged', description: 'Acknowledgement — received, but not yet applied to the payer database' },
  A2: { family: 'acknowledged', description: 'Acknowledgement — accepted into the adjudication system' },
  A3: { family: 'error', description: 'Acknowledgement — returned as unprocessable' },
  A4: { family: 'error', description: 'Acknowledgement — not found' },
  A5: { family: 'acknowledged', description: 'Acknowledgement — split into multiple claims' },
  A6: { family: 'error', description: 'Acknowledgement — rejected for missing information' },
  A7: { family: 'error', description: 'Acknowledgement — rejected for invalid information' },
  A8: { family: 'error', description: 'Acknowledgement — rejected for relational field in error' },
  P0: { family: 'pending', description: 'Pending — data review in progress' },
  P1: { family: 'pending', description: 'Pending — payment reflected on a payment advice already' },
  P2: { family: 'pending', description: 'Pending — pending medical review' },
  P3: { family: 'pending', description: 'Pending — payer requires additional information' },
  P4: { family: 'pending', description: 'Pending — payment made, statement to follow' },
  P5: { family: 'pending', description: 'Pending — payer is coordinating benefits with another payer' },
  F0: { family: 'finalized', description: 'Finalized — the claim/encounter has completed adjudication' },
  F1: { family: 'finalized', description: 'Finalized — payment reflected on remittance advice' },
  F2: { family: 'finalized', description: 'Finalized — denial reflected on remittance advice' },
  F3: { family: 'finalized', description: 'Finalized — revised' },
  F4: { family: 'finalized', description: 'Finalized — adjudication complete, no payment forthcoming' },
  R0: { family: 'info_requested', description: 'Requested additional information not received' },
  R1: { family: 'info_requested', description: 'Requested additional information received, unprocessed' },
  R2: { family: 'info_requested', description: 'Requested additional information received, processing' },
  R3: { family: 'info_requested', description: 'Requested additional information received, complete' },
  D0: { family: 'error', description: 'Data — acknowledgement / rejected for relational field in error' },
  D1: { family: 'error', description: 'Data — acknowledgement / rejected for missing information' },
  D2: { family: 'error', description: 'Data — acknowledgement / rejected for invalid information' },
  E0: { family: 'error', description: 'Response not possible — error on submitted transaction' },
  E1: { family: 'error', description: 'Response not possible — error, invalid submitter ID' },
  E2: { family: 'error', description: 'Response not possible — error, invalid provider ID' },
  E3: { family: 'error', description: 'Response not possible — error, invalid subscriber ID' },
};

/** Describe a claim status category code (STC01-1) for a worklist or audit trail. */
export function describeClaimStatusCategory(code: string): { family: ClaimStatusFamily; description: string } {
  return CATEGORY[code] ?? { family: 'unknown', description: `Unrecognized status category ${code}` };
}

/** True when the category represents a hard rejection — corrected claim, not appeal. */
export function isRejectionCategory(code: string): boolean {
  return describeClaimStatusCategory(code).family === 'error';
}
