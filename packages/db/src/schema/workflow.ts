import {
  boolean,
  index,
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

/**
 * A work queue is a saved definition over some dataset — open denials for payer X,
 * claims within 10 days of timely filing, eligibility exceptions from last night's batch
 * — plus an assignment strategy and an SLA. Queues are where the automation hands
 * work to people; everything that needs a human lands in exactly one.
 */
export const workQueues = pgTable(
  'work_queues',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id'),

    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),

    /** denial | rejection | eligibility | underpayment | timely_filing | coding | patient | general */
    category: text('category').notNull(),
    definition: jsonb('definition').notNull().default({}),

    /** manual | round_robin | least_loaded */
    assignmentStrategy: text('assignment_strategy').notNull().default('manual'),
    slaHours: integer('sla_hours'),
    isSystem: boolean('is_system').notNull().default(false),
    active: boolean('active').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('work_queues_org_key').on(t.orgId, t.key)],
);

export const taskStatus = pgEnum('task_status', [
  'open',
  'in_progress',
  'waiting',
  'snoozed',
  'resolved',
  'cancelled',
]);

export const taskPriority = pgEnum('task_priority', ['low', 'normal', 'high', 'urgent']);

export const tasks = pgTable(
  'tasks',
  {
    id: primaryId,
    orgId,
    practiceId: uuid('practice_id'),
    workQueueId: uuid('work_queue_id').notNull(),

    /** claim | denial | patient | eligibility_check | remittance | encounter */
    subjectType: text('subject_type').notNull(),
    subjectId: uuid('subject_id').notNull(),
    patientId: uuid('patient_id'),

    title: text('title').notNull(),
    detail: jsonb('detail'),
    status: taskStatus('status').notNull().default('open'),
    priority: taskPriority('priority').notNull().default('normal'),

    /** Machine-readable suggested action and whether it can be applied in one click. */
    suggestedAction: text('suggested_action'),
    suggestedActionPayload: jsonb('suggested_action_payload'),

    assignedTo: uuid('assigned_to'),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),

    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by'),
    resolutionCode: text('resolution_code'),
    resolutionNote: text('resolution_note'),

    /** Dedupe key so the automation never files the same task twice. */
    dedupeKey: text('dedupe_key'),
    createdByAutomation: text('created_by_automation'),
    ...timestamps,
  },
  (t) => [
    index('tasks_queue_status_idx').on(t.orgId, t.workQueueId, t.status),
    index('tasks_assigned_idx').on(t.orgId, t.assignedTo, t.status),
    index('tasks_subject_idx').on(t.orgId, t.subjectType, t.subjectId),
    index('tasks_due_idx').on(t.orgId, t.status, t.dueAt),
    uniqueIndex('tasks_dedupe_key').on(t.orgId, t.dedupeKey),
  ],
);

/** Append-only task history. */
export const taskEvents = pgTable(
  'task_events',
  {
    id: primaryId,
    orgId,
    taskId: uuid('task_id').notNull(),
    /** created | assigned | status_changed | commented | snoozed | resolved | reopened */
    eventType: text('event_type').notNull(),
    actorUserId: uuid('actor_user_id'),
    detail: jsonb('detail'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('task_events_task_idx').on(t.orgId, t.taskId, t.occurredAt)],
);

export const taskComments = pgTable(
  'task_comments',
  {
    id: primaryId,
    orgId,
    taskId: uuid('task_id').notNull(),
    authorUserId: uuid('author_user_id').notNull(),
    body: text('body').notNull(),
    ...timestamps,
  },
  (t) => [index('task_comments_task_idx').on(t.orgId, t.taskId, t.createdAt)],
);

/**
 * Saved views — every list in the product is one. Filters, columns, sort and density
 * persist and are shareable, so nobody rebuilds the same worklist every morning.
 */
export const savedViews = pgTable(
  'saved_views',
  {
    id: primaryId,
    orgId,
    ownerUserId: uuid('owner_user_id').notNull(),
    /** claims | denials | patients | tasks | remittances | eligibility */
    dataset: text('dataset').notNull(),
    name: text('name').notNull(),
    definition: jsonb('definition').notNull(),
    isShared: boolean('is_shared').notNull().default(false),
    isDefault: boolean('is_default').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('saved_views_owner_idx').on(t.orgId, t.ownerUserId, t.dataset)],
);
