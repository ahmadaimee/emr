import {
  bigserial,
  boolean,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';

export const auditAction = pgEnum('audit_action', [
  'create',
  'read',
  'update',
  'delete',
  'login',
  'login_failed',
  'logout',
  'export',
  'print',
  'submit',
  'post',
  'void',
  'elevate_access',
  'permission_change',
  'config_change',
]);

/**
 * The compliance audit trail — 45 CFR 164.312(b).
 *
 * Two properties matter and are enforced at the database level, not by convention:
 *
 *  1. APPEND-ONLY. The application role is granted INSERT and SELECT only. There is no
 *     UPDATE or DELETE privilege, so a compromised application cannot rewrite history.
 *
 *  2. TAMPER-EVIDENT. Each row stores an HMAC over its own content plus the previous
 *     row's hash, forming a chain. Altering or removing any row breaks verification
 *     from that point forward, and a scheduled job verifies the chain continuously.
 *
 * `sequence` is a bigserial rather than a timestamp because chain order must be
 * total and gap-detectable; clocks are neither.
 *
 * Note that READ is an audited action. Logging only writes is the common shortcut, and
 * it fails the one question an investigation actually asks — who looked at this chart.
 */
export const auditEvents = pgTable(
  'audit_events',
  {
    id: primaryId,
    sequence: bigserial('sequence', { mode: 'bigint' }).notNull(),
    orgId,

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),

    /** Null when the actor is the system itself; `actorType` says which. */
    actorUserId: uuid('actor_user_id'),
    actorType: text('actor_type').notNull().default('user'), // user | system | api_client
    actorLabel: text('actor_label'),
    /** Set when the action was taken under a time-boxed cross-practice elevation. */
    elevationId: uuid('elevation_id'),

    action: auditAction('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: uuid('resource_id'),

    /** Denormalised so PHI-access questions can be answered without joins. */
    patientId: uuid('patient_id'),
    practiceId: uuid('practice_id'),

    /** Field-level diff. Values that are themselves PHI are stored redacted. */
    changes: jsonb('changes'),
    context: jsonb('context'),

    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    sessionId: uuid('session_id'),
    requestId: text('request_id'),

    /** HMAC-SHA256 over this row's canonical content plus `previousHash`. */
    previousHash: text('previous_hash'),
    hash: text('hash').notNull(),
  },
  (t) => [
    index('audit_events_org_time_idx').on(t.orgId, t.occurredAt),
    index('audit_events_actor_idx').on(t.orgId, t.actorUserId, t.occurredAt),
    index('audit_events_resource_idx').on(t.orgId, t.resourceType, t.resourceId),
    index('audit_events_patient_idx').on(t.orgId, t.patientId, t.occurredAt),
    index('audit_events_sequence_idx').on(t.sequence),
  ],
);

/**
 * The human-readable activity feed.
 *
 * Deliberately separate from `auditEvents`. The audit log is a legal record optimised
 * for completeness and immutability; this is a product feature optimised for reading.
 * Deriving the feed from the audit log at query time would either leak redacted detail
 * or force the audit log to carry presentation concerns, so they stay distinct.
 */
export const activityEvents = pgTable(
  'activity_events',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id'),

    /** What this activity attaches to: patient | claim | encounter | denial | batch. */
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),

    actorUserId: uuid('actor_user_id'),
    actorType: text('actor_type').notNull().default('user'),
    actorLabel: text('actor_label'),

    /** Machine key, e.g. `claim.submitted`, used to pick an icon and phrasing. */
    verb: text('verb').notNull(),
    /** Rendered sentence, e.g. "submitted claim 10041 to Aetna". */
    summary: text('summary').notNull(),
    detail: jsonb('detail'),

    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [
    index('activity_events_subject_idx').on(t.orgId, t.subjectType, t.subjectId, t.occurredAt),
    index('activity_events_actor_idx').on(t.orgId, t.actorUserId, t.occurredAt),
  ],
);

/**
 * Result of each scheduled verification pass over the audit chain. A failed
 * verification is an incident, and having its history recorded is what lets us say
 * when tampering began rather than merely that it happened.
 */
export const auditChainVerifications = pgTable(
  'audit_chain_verifications',
  {
    id: primaryId,
    orgId,
    fromSequence: text('from_sequence').notNull(),
    toSequence: text('to_sequence').notNull(),
    /** passed | failed */
    result: text('result').notNull(),
    brokenAtSequence: text('broken_at_sequence'),
    checkedAt: timestamp('checked_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (t) => [index('audit_chain_verifications_org_idx').on(t.orgId, t.checkedAt)],
);

/**
 * PHI access log — the READ half of 45 CFR 164.312(b).
 *
 * Row-change triggers capture writes automatically. Reads are the harder and more
 * legally significant half: the classic HIPAA violation is an employee looking at a
 * chart they have no business with, and that is an ordinary SELECT. This table logs
 * at the request boundary — one row per request with the array of patients touched —
 * which keeps a 500-row worklist at one row instead of five hundred.
 *
 * Never sampled. Completeness is the requirement. Volume is managed by granularity
 * and monthly partitioning, not by dropping events.
 */
export const phiAccessEvents = pgTable(
  'phi_access_events',
  {
    id: primaryId,
    orgId,
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),

    actorUserId: uuid('actor_user_id'),
    actorType: text('actor_type').notNull().default('user'),
    sessionId: uuid('session_id'),
    requestId: text('request_id'),
    elevationId: uuid('elevation_id'),

    route: text('route').notNull(),
    /** treatment | payment | operations | patient_request */
    purpose: text('purpose'),
    resourceType: text('resource_type').notNull(),
    patientIds: uuid('patient_ids').array().notNull(),
    recordCount: integer('record_count').notNull(),
    /** demographics | financial | clinical | ssn */
    fieldClasses: text('field_classes').array(),

    /** True for exports, bulk downloads and reports — separately alertable. */
    isExport: boolean('is_export').notNull().default(false),
    ipAddress: inet('ip_address'),
  },
  (t) => [
    index('phi_access_events_actor_idx').on(t.orgId, t.actorUserId, t.occurredAt),
    index('phi_access_events_time_idx').on(t.orgId, t.occurredAt),
    index('phi_access_events_export_idx').on(t.orgId, t.isExport, t.occurredAt),
  ],
);

/** Flags raised by the nightly access-anomaly job, for the privacy officer. */
export const complianceAlerts = pgTable(
  'compliance_alerts',
  {
    id: primaryId,
    orgId,
    /** volume_anomaly | surname_match | out_of_scope_practice | off_hours | large_export | chain_break */
    alertType: text('alert_type').notNull(),
    severity: text('severity').notNull().default('medium'),
    actorUserId: uuid('actor_user_id'),
    summary: text('summary').notNull(),
    evidence: jsonb('evidence'),
    /** open | reviewed | dismissed | escalated */
    status: text('status').notNull().default('open'),
    reviewedBy: uuid('reviewed_by'),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('compliance_alerts_status_idx').on(t.orgId, t.status, t.createdAt)],
);

/**
 * Trigger-captured row changes. Written by `app.capture_row_change()`, which is
 * attached to every tenant table by the policy migration and reads the actor, session
 * and request from the transaction-local settings that `withTenant` sets. Zero
 * application plumbing: a developer who bypasses the domain layer and writes raw SQL
 * is still captured, because the database does it, not the code.
 */
export const auditRowChanges = pgTable(
  'audit_row_changes',
  {
    id: primaryId,
    orgId,
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    tableName: text('table_name').notNull(),
    rowId: uuid('row_id'),
    /** INSERT | UPDATE | DELETE */
    op: text('op').notNull(),
    changedColumns: text('changed_columns').array(),
    oldValues: jsonb('old_values'),
    newValues: jsonb('new_values'),
    actorUserId: uuid('actor_user_id'),
    sessionId: uuid('session_id'),
    requestId: text('request_id'),
    accessContext: text('access_context'),
  },
  (t) => [
    index('audit_row_changes_row_idx').on(t.orgId, t.tableName, t.rowId),
    index('audit_row_changes_time_idx').on(t.orgId, t.occurredAt),
    index('audit_row_changes_actor_idx').on(t.orgId, t.actorUserId, t.occurredAt),
  ],
);
