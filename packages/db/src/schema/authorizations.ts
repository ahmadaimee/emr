import { boolean, date, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';

/**
 * Prior authorization / service review (837 loop REF*G1 carries the number once
 * granted; the 278 transaction requests and answers it). Separate from `claims` on
 * purpose — an authorization is requested BEFORE the encounter exists half the time,
 * and one authorization can cover several future claims (e.g. a course of PT visits).
 */
export const authorizationStatus = pgEnum('authorization_status', [
  'draft',
  'submitted',
  'pending',
  'approved',
  'partially_approved',
  'denied',
  'expired',
  'cancelled',
]);

export const authorizationUrgency = pgEnum('authorization_urgency', ['routine', 'urgent']);

export const authorizations = pgTable(
  'authorizations',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    payerId: uuid('payer_id').notNull(),
    coverageId: uuid('coverage_id'),
    renderingProviderId: uuid('rendering_provider_id'),

    status: authorizationStatus('status').notNull().default('draft'),
    urgency: authorizationUrgency('urgency').notNull().default('routine'),

    /** What's being requested. Position matters for `diagnosisPointers`-style linkage on the eventual claim. */
    procedureCodes: text('procedure_codes').array().notNull().default([]),
    diagnosisCodes: text('diagnosis_codes').array().notNull().default([]),

    serviceDateFrom: date('service_date_from').notNull(),
    serviceDateThrough: date('service_date_through'),

    unitsRequested: integer('units_requested'),
    unitsApproved: integer('units_approved'),
    unitsUsed: integer('units_used').notNull().default(0),

    /**
     * The CMS Interoperability and Prior Authorization Final Rule (eff. Jan 1, 2026)
     * requires standard requests answered within 7 calendar days, urgent within 72
     * hours. Computed at request time so an overdue sweep can find what's late without
     * recomputing payer policy per row.
     */
    requestedAt: timestamp('requested_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),

    /** Payer-issued once approved. This is what gets copied onto claims.priorAuthNumber. */
    authorizationNumber: text('authorization_number'),
    expiresOn: date('expires_on'),

    payerResponseCode: text('payer_response_code'),
    payerResponseMessage: text('payer_response_message'),

    /** The generated 278 request, when one was produced — kept for the payer dispute trail. */
    rawRequest278: text('raw_request_278'),

    notes: text('notes'),
    reviewRequired: boolean('review_required').notNull().default(false),

    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [
    index('authorizations_patient_idx').on(t.orgId, t.patientId),
    index('authorizations_practice_status_idx').on(t.orgId, t.practiceId, t.status),
    index('authorizations_due_idx').on(t.orgId, t.status, t.dueAt),
    index('authorizations_payer_idx').on(t.orgId, t.payerId),
  ],
);
