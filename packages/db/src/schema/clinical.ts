import { date, doublePrecision, index, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { orgId, primaryId, timestamps } from './_shared';

export const clinicalNoteStatus = pgEnum('clinical_note_status', ['draft', 'signed', 'amended']);

/**
 * A SOAP encounter note. Vitals are captured directly on the note rather than a
 * separate trending table — this app doesn't yet have a workflow that reads vitals
 * outside the note they were taken in; a dedicated vitals-history table is a real
 * future feature, not something to fake now.
 *
 * A signed note is meant to be immutable — the API enforces that, not the schema.
 */
export const clinicalNotes = pgTable(
  'clinical_notes',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id').notNull(),
    patientId: uuid('patient_id').notNull(),
    encounterId: uuid('encounter_id'),
    /** The user who authored/typed the note. Not necessarily the billing "provider" entity. */
    authorUserId: uuid('author_user_id').notNull(),

    serviceDate: date('service_date').notNull(),
    status: clinicalNoteStatus('status').notNull().default('draft'),

    bloodPressureSystolic: integer('blood_pressure_systolic'),
    bloodPressureDiastolic: integer('blood_pressure_diastolic'),
    heartRate: integer('heart_rate'),
    temperatureF: doublePrecision('temperature_f'),
    respiratoryRate: integer('respiratory_rate'),
    spo2: integer('spo2'),
    weightLbs: doublePrecision('weight_lbs'),
    heightInches: doublePrecision('height_inches'),

    subjective: text('subjective').notNull(),
    objective: text('objective').notNull(),
    primaryDiagnosisCode: text('primary_diagnosis_code').notNull(),
    primaryDiagnosisDescription: text('primary_diagnosis_description').notNull(),
    plan: text('plan').notNull(),

    signedAt: timestamp('signed_at', { withTimezone: true }),

    ...timestamps,
  },
  (t) => [index('clinical_notes_patient_idx').on(t.orgId, t.patientId, t.serviceDate)],
);
