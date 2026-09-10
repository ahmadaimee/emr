import { parse271, parse835, splitTransactionSets, tokenize, type EligibilityInquiry270 } from '@grove/x12';
import {
  ClearinghouseError,
  type ClaimStatusRequest,
  type ClaimStatusResult,
  type ClearinghouseAdapter,
  type EligibilityResult,
  type FetchAcknowledgmentsResult,
  type FetchRemittancesResult,
  type SubmitClaimRequest,
  type SubmitClaimResult,
} from './adapter';

/**
 * Stedi Healthcare API connector.
 *
 * Stedi accepts raw X12 for claims and eligibility and returns raw X12 alongside its
 * JSON translation, which suits us: we generate and parse X12 ourselves, so the
 * connector is a thin, auditable transport rather than a second interpretation layer.
 *
 * Endpoint paths and response shapes below follow Stedi's published API as of the
 * 2024-04-01 version. VERIFY against the live docs with sandbox credentials before
 * the first real submission — vendor APIs move, and this is the layer that absorbs it.
 * Published metered pricing (no minimums) is why Stedi is the primary connector.
 */
export interface StediConfig {
  apiKey: string;
  baseUrl?: string;
  /** Per-transaction list prices, cents, for cost metering. */
  pricing?: { eligibilityCents: number; claimCents: number; statusCents: number; eraCents: number };
  fetch?: typeof fetch;
}

const DEFAULT_PRICING = { eligibilityCents: 30, claimCents: 30, statusCents: 30, eraCents: 20 };

export class StediClearinghouse implements ClearinghouseAdapter {
  readonly name = 'stedi' as const;
  private readonly baseUrl: string;
  private readonly pricing: NonNullable<StediConfig['pricing']>;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: StediConfig) {
    this.baseUrl = (config.baseUrl ?? 'https://healthcare.us.stedi.com/2024-04-01').replace(/\/$/, '');
    this.pricing = config.pricing ?? DEFAULT_PRICING;
    this.fetchImpl = config.fetch ?? fetch;
  }

  async submitClaim(req: SubmitClaimRequest): Promise<SubmitClaimResult> {
    const { json, meta } = await this.call<{ transactionId?: string; fileExecutionId?: string; status?: string }>(
      'POST',
      '/change/medicalnetwork/professionalclaims/v3/raw-x12-submission',
      { x12: req.x12 },
      this.pricing.claimCents * req.patientControlNumbers.length,
    );
    return {
      meta,
      submissionId: json.transactionId ?? json.fileExecutionId ?? '',
      immediateAck: json.status
        ? { type: 'connector', result: json.status.toLowerCase().includes('reject') ? 'R' : 'A', receivedAt: new Date(), message: json.status }
        : undefined,
    };
  }

  async fetchAcknowledgments(submissionId: string): Promise<FetchAcknowledgmentsResult> {
    const { json, meta } = await this.call<{ items?: Array<{ x12?: string; transactionSetId?: string }> }>(
      'GET',
      `/change/medicalnetwork/reports/v2?submissionId=${encodeURIComponent(submissionId)}`,
      undefined,
      0,
    );
    // Acknowledgment X12 (999 / 277CA) is parsed by the worker's ack pipeline; here we
    // surface the raw documents so nothing is lost if a shape changes.
    return {
      meta,
      acknowledgments: (json.items ?? [])
        .filter((i) => i.x12)
        .map((i) => ({
          type: i.transactionSetId === '999' ? ('x999' as const) : ('x277ca' as const),
          result: 'A' as const,
          receivedAt: new Date(),
          raw: i.x12,
        })),
    };
  }

  async checkEligibility(req: EligibilityInquiry270): Promise<EligibilityResult> {
    const { generate270, buildInterchange, IMPLEMENTATIONS, serialize } = await import('@grove/x12');
    const body = generate270(req);
    const x12 = serialize(
      buildInterchange(
        { sender: { qualifier: 'ZZ', id: 'GROVE' }, receiver: { qualifier: 'ZZ', id: 'STEDI' }, controlNumber: Date.now() % 1_000_000_000, usage: 'P' },
        { functionalId: 'HS', controlNumber: 1, version: IMPLEMENTATIONS['270'] },
        [{ type: '270', implementation: IMPLEMENTATIONS['270'], controlNumber: 1, body }],
      ),
    );
    const { json, meta } = await this.call<{ x12?: string }>(
      'POST',
      '/change/medicalnetwork/eligibility/v3/raw-x12',
      { x12 },
      this.pricing.eligibilityCents,
    );
    if (!json.x12) throw new ClearinghouseError('Stedi eligibility response had no X12 body', 'stedi', 'unknown', false, meta.httpStatus);
    const parsed = parse271(splitTransactionSets(tokenize(json.x12))[0]!);
    return { meta, raw270: x12, raw271: json.x12, parsed };
  }

  async checkClaimStatus(req: ClaimStatusRequest): Promise<ClaimStatusResult> {
    const { json, meta } = await this.call<{
      claims?: Array<{ claimStatus?: { statusCategoryCode?: string; statusCode?: string; statusCategoryCodeValue?: string; claimPaymentAmount?: string; effectiveDate?: string; trackingNumber?: string } }>;
    }>(
      'POST',
      '/change/medicalnetwork/claimstatus/v2',
      {
        controlNumber: req.traceNumber.slice(-9),
        tradingPartnerServiceId: req.payerId,
        providers: [{ npi: req.billingProviderNpi, providerType: 'BillingProvider' }],
        subscriber: { memberId: req.subscriberMemberId, firstName: req.subscriber.firstName, lastName: req.subscriber.lastName, dateOfBirth: req.subscriber.dateOfBirth.replace(/-/g, '') },
        encounter: { beginningDateOfService: req.serviceDateFrom.replace(/-/g, ''), endDateOfService: req.serviceDateTo.replace(/-/g, ''), submittedAmount: (req.totalChargeCents / 100).toFixed(2), trackingNumber: req.patientControlNumber },
      },
      this.pricing.statusCents,
    );
    const status = json.claims?.[0]?.claimStatus ?? {};
    const category = status.statusCategoryCode ?? '';
    return {
      meta,
      statusCategoryCode: category,
      statusCode: status.statusCode ?? '',
      statusDescription: status.statusCategoryCodeValue,
      isFinal: category.startsWith('F'),
      paidAmountCents: status.claimPaymentAmount ? Math.round(Number(status.claimPaymentAmount) * 100) : undefined,
      effectiveDate: status.effectiveDate,
      payerClaimControlNumber: status.trackingNumber,
    };
  }

  async fetchRemittances(since: Date): Promise<FetchRemittancesResult> {
    const { json, meta } = await this.call<{ items?: Array<{ fileId: string; fileName?: string; receivedAt?: string; x12: string }> }>(
      'GET',
      `/change/medicalnetwork/reports/v2?transactionType=835&since=${encodeURIComponent(since.toISOString())}`,
      undefined,
      0,
    );
    const files = (json.items ?? []).map((f) => ({
      fileId: f.fileId,
      fileName: f.fileName,
      receivedAt: f.receivedAt ? new Date(f.receivedAt) : new Date(),
      raw835: f.x12,
      parsed: splitTransactionSets(tokenize(f.x12)).map(parse835),
    }));
    meta.costCents = this.pricing.eraCents * files.length;
    return { meta, files };
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body: unknown, costCents: number) {
    const started = Date.now();
    let res: Response;
    try {
      res = await this.fetchImpl(this.baseUrl + path, {
        method,
        headers: { Authorization: `Key ${this.config.apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(25_000),
      });
    } catch (err) {
      throw new ClearinghouseError(`Stedi transport failure: ${(err as Error).message}`, 'stedi', 'transport', true);
    }
    const durationMs = Date.now() - started;
    const text = await res.text();
    if (!res.ok) {
      const cls = res.status === 401 || res.status === 403 ? 'auth' : res.status === 429 ? 'rate_limited' : res.status >= 500 ? 'payer_unavailable' : 'validation';
      throw new ClearinghouseError(`Stedi ${res.status}: ${text.slice(0, 300)}`, 'stedi', cls, res.status === 429 || res.status >= 500, res.status);
    }
    const json = (text ? JSON.parse(text) : {}) as T;
    return { json, meta: { connector: 'stedi' as const, durationMs, costCents, httpStatus: res.status } };
  }
}
