import type { EligibilityInquiry270, EligibilityResponse271, Remittance835 } from '@grove/x12';

/**
 * The clearinghouse adapter contract.
 *
 * Everything above this interface speaks in X12 and typed models; everything below it
 * speaks whatever the vendor speaks (Stedi's JSON, Claim.MD's form posts, an SFTP drop).
 * The interface is designed against two real vendors so it does not accidentally encode
 * one vendor's shape — and because the 2024 Change Healthcare outage made
 * multi-sourcing a resilience requirement, not a preference.
 *
 * Every call is metered: implementations MUST report `costCents` so the automation
 * budget and circuit breakers have something to read.
 */

export type ConnectorName = 'stedi' | 'claimmd' | 'mock';

export interface CallMeta {
  connector: ConnectorName;
  /** Vendor's own identifier for the transaction, for support tickets. */
  vendorTransactionId?: string;
  durationMs: number;
  costCents: number;
  httpStatus?: number;
}

export interface SubmitClaimRequest {
  /** The complete interchange, ISA through IEA. */
  x12: string;
  /** For vendors that want structured metadata alongside the X12. */
  patientControlNumbers: string[];
  payerId: string;
  usage: 'T' | 'P';
}

export interface SubmitClaimResult {
  meta: CallMeta;
  /** Vendor's submission/batch identifier. Stored on claim_submissions. */
  submissionId: string;
  /** Some vendors validate synchronously and return an immediate accept/reject. */
  immediateAck?: Acknowledgment;
}

export interface Acknowledgment {
  /** 'ta1' | '999' | '277ca' | 'connector' */
  type: 'ta1' | 'x999' | 'x277ca' | 'connector';
  /** A accepted, R rejected, E accepted with errors. */
  result: 'A' | 'R' | 'E';
  patientControlNumber?: string;
  payerClaimControlNumber?: string;
  statusCategoryCode?: string;
  statusCode?: string;
  message?: string;
  segmentId?: string;
  elementPosition?: number;
  receivedAt: Date;
  raw?: string;
}

export interface EligibilityResult {
  meta: CallMeta;
  raw270?: string;
  raw271: string;
  parsed: EligibilityResponse271;
}

export interface ClaimStatusRequest {
  payerId: string;
  patientControlNumber: string;
  payerClaimControlNumber?: string;
  billingProviderNpi: string;
  subscriberMemberId: string;
  subscriber: { lastName: string; firstName: string; dateOfBirth: string };
  serviceDateFrom: string;
  serviceDateTo: string;
  totalChargeCents: number;
  traceNumber: string;
}

export interface ClaimStatusResult {
  meta: CallMeta;
  raw277?: string;
  statusCategoryCode: string;
  statusCode: string;
  statusDescription?: string;
  /** True when the payer reports a final disposition — stop polling. */
  isFinal: boolean;
  paidAmountCents?: number;
  effectiveDate?: string;
  payerClaimControlNumber?: string;
}

export interface RemittanceFile {
  /** Vendor's file identifier, used to acknowledge receipt and avoid re-fetching. */
  fileId: string;
  fileName?: string;
  receivedAt: Date;
  raw835: string;
  parsed: Remittance835[];
}

export interface FetchRemittancesResult {
  meta: CallMeta;
  files: RemittanceFile[];
}

export interface FetchAcknowledgmentsResult {
  meta: CallMeta;
  acknowledgments: Acknowledgment[];
}

export interface ClearinghouseAdapter {
  readonly name: ConnectorName;

  submitClaim(req: SubmitClaimRequest): Promise<SubmitClaimResult>;

  /** Fetch any acknowledgments that have arrived for a submission. */
  fetchAcknowledgments(submissionId: string): Promise<FetchAcknowledgmentsResult>;

  /** Real-time 270/271. Implementations MUST return within the CAQH CORE 20s SLA or fail. */
  checkEligibility(req: EligibilityInquiry270): Promise<EligibilityResult>;

  /** 276/277. */
  checkClaimStatus(req: ClaimStatusRequest): Promise<ClaimStatusResult>;

  /** Retrieve 835 files received since a watermark. Idempotent: re-fetching returns the same file IDs. */
  fetchRemittances(since: Date): Promise<FetchRemittancesResult>;

  /** Tell the vendor a file was processed, where the vendor supports it. */
  acknowledgeRemittance?(fileId: string): Promise<void>;
}

export class ClearinghouseError extends Error {
  constructor(
    message: string,
    public readonly connector: ConnectorName,
    /** transport | auth | validation | rate_limited | payer_unavailable | unknown */
    public readonly errorClass: string,
    public readonly retryable: boolean,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'ClearinghouseError';
  }
}
