import {
  boolean,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';
import { money } from './_types';

/*
 * Platform plumbing: the transactional outbox, webhooks, API credentials, idempotency,
 * documents, reports, and the automation controls.
 */

/**
 * Transactional outbox. Domain events are written here IN THE SAME TRANSACTION as the
 * change that caused them, and a relay hands them to pg-boss. This is what makes
 * "the claim was saved but the submission job was never queued" impossible.
 */
export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: primaryId,
    orgId,
    eventType: text('event_type').notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    payload: jsonb('payload').notNull(),
    /** Stable key so re-delivery is detectable downstream. */
    idempotencyKey: text('idempotency_key').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
  },
  (t) => [
    index('outbox_events_unpublished_idx').on(t.publishedAt, t.occurredAt),
    uniqueIndex('outbox_events_idempotency_key').on(t.idempotencyKey),
    index('outbox_events_aggregate_idx').on(t.aggregateType, t.aggregateId),
  ],
);

/**
 * Every call to a clearinghouse, payer, or payment processor, with its cost.
 * Automation without cost control is how a scheduler bug generates a five-figure bill
 * over a weekend; daily budgets and circuit breakers read from this table.
 */
export const externalCalls = pgTable(
  'external_calls',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id'),
    /** stedi | claimmd | stripe | ... */
    connector: text('connector').notNull(),
    /** eligibility | claim_submit | claim_status | era_fetch | payment | ... */
    operation: text('operation').notNull(),
    subjectType: text('subject_type'),
    subjectId: uuid('subject_id'),

    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    durationMs: integer('duration_ms'),
    httpStatus: integer('http_status'),
    /** ok | error | timeout | rate_limited */
    outcome: text('outcome').notNull(),
    costCents: money('cost_cents').notNull().default(0),
    triggeredBy: text('triggered_by'),
    errorClass: text('error_class'),
  },
  (t) => [
    index('external_calls_budget_idx').on(t.orgId, t.startedAt, t.connector),
    index('external_calls_subject_idx').on(t.subjectType, t.subjectId),
  ],
);

/**
 * Per-organisation automation switches. Each automation can be paused independently
 * and there is a global pause — reachable in one click — because the answer to "the
 * automation is doing something wrong" must never be "wait for a deploy".
 */
export const automationSettings = pgTable(
  'automation_settings',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id'),

    globalPaused: boolean('global_paused').notNull().default(false),
    pausedReason: text('paused_reason'),
    pausedBy: uuid('paused_by'),
    pausedAt: timestamp('paused_at', { withTimezone: true }),

    autoEligibilityPreVisit: boolean('auto_eligibility_pre_visit').notNull().default(true),
    autoEligibilityPreVisitDays: integer('auto_eligibility_pre_visit_days').notNull().default(3),
    autoEligibilityCheckIn: boolean('auto_eligibility_check_in').notNull().default(true),
    autoEligibilityMonthly: boolean('auto_eligibility_monthly').notNull().default(true),

    autoClaimStatus: boolean('auto_claim_status').notNull().default(true),
    /** Submit every "ready" claim automatically at `autoSubmitHourUtc`, no human touch. */
    autoSubmitReadyClaims: boolean('auto_submit_ready_claims').notNull().default(false),
    /** 0-23. Default is 13 (09:00 US/Eastern) to land submissions early in a payer's business day. */
    autoSubmitHourUtc: integer('auto_submit_hour_utc').notNull().default(13),
    autoSecondaryClaims: boolean('auto_secondary_claims').notNull().default(true),
    /** Submit auto-generated secondaries without review when they scrub clean. */
    autoSubmitSecondary: boolean('auto_submit_secondary').notNull().default(false),
    secondaryMinBalanceCents: money('secondary_min_balance_cents').notNull().default(500),

    autoTransferPatientResponsibility: boolean('auto_transfer_patient_responsibility')
      .notNull()
      .default(true),
    /** Generate frequency-7 corrections for the allowlisted CARC/RARC combinations. */
    autoCorrectedClaims: boolean('auto_corrected_claims').notNull().default(false),
    autoCorrectedClaimAllowlist: jsonb('auto_corrected_claim_allowlist').notNull().default([]),

    /** Evaluate and log, but do not act. Required before enabling any automation for a new org. */
    dryRun: boolean('dry_run').notNull().default(true),

    dailyBudgetCents: money('daily_budget_cents').notNull().default(50000),
    ...timestamps,
  },
  (t) => [uniqueIndex('automation_settings_key').on(t.orgId, t.practiceId)],
);

// ---------------------------------------------------------------------------
// Public API credentials
// ---------------------------------------------------------------------------

export const apiClients = pgTable(
  'api_clients',
  {
    id: primaryId,
    orgId,
    name: text('name').notNull(),
    /** Public identifier used in OAuth2 client credentials. */
    clientId: text('client_id').notNull(),
    /** Argon2id hash of the client secret. */
    clientSecretHash: text('client_secret_hash').notNull(),
    scopes: text('scopes').array().notNull().default([]),
    practiceIds: uuid('practice_ids').array(),
    ipAllowlist: inet('ip_allowlist').array(),
    /** Pinned API revision, Stripe-style: '2026-09-01'. */
    apiVersion: text('api_version').notNull(),
    /** active | suspended | revoked */
    status: text('status').notNull().default('active'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [uniqueIndex('api_clients_client_id_key').on(t.clientId)],
);

/** Scoped API keys: `grv_live_<public>_<secret>`. The secret is shown exactly once. */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: primaryId,
    orgId,
    apiClientId: uuid('api_client_id'),
    name: text('name').notNull(),
    publicId: text('public_id').notNull(),
    secretHash: text('secret_hash').notNull(),
    last4: text('last4').notNull(),
    scopes: text('scopes').array().notNull().default([]),
    practiceIds: uuid('practice_ids').array(),
    ipAllowlist: inet('ip_allowlist').array(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    lastUsedIp: inet('last_used_ip'),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [uniqueIndex('api_keys_public_id_key').on(t.publicId)],
);

/**
 * Idempotency records for the public API. `Idempotency-Key` is REQUIRED on every
 * write — optional idempotency is idempotency nobody uses.
 */
export const idempotencyRecords = pgTable(
  'idempotency_records',
  {
    orgId,
    key: text('key').notNull(),
    clientId: uuid('client_id').notNull(),
    endpoint: text('endpoint').notNull(),
    requestHash: text('request_hash').notNull(),
    /** in_progress | completed */
    state: text('state').notNull(),
    responseStatus: integer('response_status'),
    responseBody: jsonb('response_body'),
    lockedAt: timestamp('locked_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex('idempotency_records_key').on(t.orgId, t.key),
    index('idempotency_records_expiry_idx').on(t.expiresAt),
  ],
);

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: primaryId,
    orgId,
    url: text('url').notNull(),
    description: text('description'),
    /** Encrypted. Two may be active during rotation. */
    secretEncrypted: text('secret_encrypted').notNull(),
    previousSecretEncrypted: text('previous_secret_encrypted'),
    secretRotatedAt: timestamp('secret_rotated_at', { withTimezone: true }),
    eventTypes: text('event_types').array().notNull(),
    apiVersion: text('api_version').notNull(),
    /** full | thin — thin sends IDs only, for customers whose compliance teams require it. */
    payloadMode: text('payload_mode').notNull().default('full'),
    /** active | disabled | auto_disabled */
    status: text('status').notNull().default('active'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    disabledReason: text('disabled_reason'),
    ...timestamps,
  },
  (t) => [index('webhook_endpoints_org_idx').on(t.orgId, t.status)],
);

export const webhookDeliveryStatus = pgEnum('webhook_delivery_status', [
  'pending',
  'delivered',
  'failed',
  'exhausted',
]);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: primaryId,
    orgId,
    endpointId: uuid('endpoint_id').notNull(),
    outboxEventId: uuid('outbox_event_id').notNull(),
    eventType: text('event_type').notNull(),
    payloadHash: text('payload_hash').notNull(),
    attempt: integer('attempt').notNull().default(1),
    status: webhookDeliveryStatus('status').notNull().default('pending'),
    httpStatus: integer('http_status'),
    /** First 1KB of the response, redacted. */
    responseSnippet: text('response_snippet'),
    durationMs: integer('duration_ms'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    nextAttemptAt: timestamp('next_attempt_at', { withTimezone: true }),
  },
  (t) => [
    index('webhook_deliveries_pending_idx').on(t.status, t.nextAttemptAt),
    index('webhook_deliveries_endpoint_idx').on(t.orgId, t.endpointId, t.scheduledAt),
  ],
);

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const documents = pgTable(
  'documents',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id'),
    /** Object-store key. Opaque; never contains PHI or a human-readable name. */
    storageKey: text('storage_key').notNull(),
    bucket: text('bucket').notNull(),
    /** Original filename, shown to users, never used as the storage key. */
    displayName: text('display_name').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    /**
     * x12_837 | x12_835 | x12_271 | x12_277 | pdf_cms1500 | pdf_ub04 | eob_scan |
     * medical_record | statement | correspondence | appeal | insurance_card |
     * baa | w9 | caqh_attestation | malpractice_certificate | board_certification
     */
    kind: text('kind').notNull(),
    /** Retention class drives the archival job. */
    retentionClass: text('retention_class').notNull().default('standard'),
    legalHold: boolean('legal_hold').notNull().default(false),
    uploadedBy: uuid('uploaded_by'),
    ...timestamps,
  },
  (t) => [index('documents_org_kind_idx').on(t.orgId, t.kind, t.createdAt)],
);

/** Typed links from documents to the things they belong to. No polymorphic strings. */
export const documentLinks = pgTable(
  'document_links',
  {
    id: primaryId,
    orgId,
    documentId: uuid('document_id').notNull(),
    patientId: uuid('patient_id'),
    claimId: uuid('claim_id'),
    encounterId: uuid('encounter_id'),
    remittanceId: uuid('remittance_id'),
    denialId: uuid('denial_id'),
    taskId: uuid('task_id'),
    statementId: uuid('statement_id'),
    /** Credentialing documents (CAQH attestation, malpractice certificate, board cert) belong to a provider, not a patient. */
    providerId: uuid('provider_id'),
    ...timestamps,
  },
  (t) => [
    index('document_links_document_idx').on(t.documentId),
    index('document_links_patient_idx').on(t.orgId, t.patientId),
    index('document_links_claim_idx').on(t.orgId, t.claimId),
    index('document_links_provider_idx').on(t.orgId, t.providerId),
  ],
);

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const reportDefinitions = pgTable(
  'report_definitions',
  {
    id: primaryId,
    orgId,
    ownerUserId: uuid('owner_user_id').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    /** Semantic-layer query: dataset, measures, dimensions, filters, sort. Never SQL. */
    definition: jsonb('definition').notNull(),
    /** Computed by the compiler: does the result include any patient-grain dimension? */
    containsPhi: boolean('contains_phi').notNull().default(false),
    isShared: boolean('is_shared').notNull().default(false),
    isSystem: boolean('is_system').notNull().default(false),
    /** Set when the definition was produced from a natural-language question. */
    sourcePrompt: text('source_prompt'),
    ...timestamps,
  },
  (t) => [index('report_definitions_owner_idx').on(t.orgId, t.ownerUserId)],
);

export const reportSchedules = pgTable(
  'report_schedules',
  {
    id: primaryId,
    orgId,
    reportId: uuid('report_id').notNull(),
    cron: text('cron').notNull(),
    timezone: text('timezone').notNull().default('America/New_York'),
    /** csv | xlsx | pdf */
    format: text('format').notNull().default('xlsx'),
    recipientUserIds: uuid('recipient_user_ids').array().notNull(),
    filtersOverride: jsonb('filters_override'),
    enabled: boolean('enabled').notNull().default(true),
    lastRunAt: timestamp('last_run_at', { withTimezone: true }),
    nextRunAt: timestamp('next_run_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('report_schedules_next_run_idx').on(t.enabled, t.nextRunAt)],
);

export const reportRuns = pgTable(
  'report_runs',
  {
    id: primaryId,
    orgId,
    reportId: uuid('report_id').notNull(),
    scheduleId: uuid('schedule_id'),
    requestedBy: uuid('requested_by'),
    /** queued | running | completed | failed */
    status: text('status').notNull().default('queued'),
    rowCount: integer('row_count'),
    durationMs: integer('duration_ms'),
    documentId: uuid('document_id'),
    /** PHI-bearing results are fetched through an authenticated link, never attached. */
    downloadExpiresAt: timestamp('download_expires_at', { withTimezone: true }),
    downloadCount: integer('download_count').notNull().default(0),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('report_runs_report_idx').on(t.orgId, t.reportId, t.createdAt)],
);
