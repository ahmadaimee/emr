import { date, index, integer, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';
import { money } from './_types';

export const appointmentType = pgEnum('appointment_type', [
  'new',
  'followup',
  'annual',
  'telehealth',
  'procedure',
  'labs',
]);

export const appointmentStatus = pgEnum('appointment_status', [
  'scheduled',
  'checked_in',
  'in_room',
  'completed',
  'no_show',
  'cancelled',
]);

/**
 * A booked slot on a provider's day book. Time of day is stored as minutes-since-
 * midnight local clinic time (not a timestamp) — a day book is inherently a local-time,
 * per-day concept, and this sidesteps timezone arithmetic entirely for slot math.
 *
 * Provider working hours are not yet configurable per provider; the day-book query
 * assumes a standard clinic day. That's a real simplification, not a placeholder —
 * per-provider hours belongs to its own settings feature.
 */
export const appointments = pgTable(
  'appointments',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    providerId: uuid('provider_id').notNull(),
    patientId: uuid('patient_id').notNull(),

    appointmentDate: date('appointment_date').notNull(),
    startMinutes: integer('start_minutes').notNull(),
    durationMinutes: integer('duration_minutes').notNull(),

    type: appointmentType('type').notNull().default('followup'),
    status: appointmentStatus('status').notNull().default('scheduled'),

    reason: text('reason'),
    room: text('room'),

    /** Quoted at booking for front-desk collection; the actual payment lives on the ledger. */
    expectedCopayCents: money('expected_copay_cents'),

    cancelReason: text('cancel_reason'),
    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [
    index('appointments_provider_date_idx').on(t.orgId, t.providerId, t.appointmentDate),
    index('appointments_practice_date_idx').on(t.orgId, t.practiceId, t.appointmentDate),
    index('appointments_patient_idx').on(t.orgId, t.patientId),
  ],
);
