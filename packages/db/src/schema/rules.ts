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
import { money } from './_types';

export const ruleSeverity = pgEnum('rule_severity', ['error', 'warning', 'info']);
export const ruleStatus = pgEnum('rule_status', ['draft', 'testing', 'active', 'retired']);

/**
 * A scrubbing rule. Rules are DATA — a versioned AST in `rule_versions.definition`,
 * evaluated by a safe interpreter, never by `eval`. This is what lets the customer
 * see, edit, and backtest every rule instead of trusting a black box.
 *
 * `isSystem` rules ship with the product (NCCI, MUE, add-on, medical necessity, POS,
 * modifier logic, timely filing). They cannot be edited, only disabled or overridden
 * by a tenant rule with a narrower scope.
 */
export const rules = pgTable(
  'rules',
  {
    id: primaryId,
    orgId,
    key: text('key').notNull(),
    name: text('name').notNull(),
    description: text('description'),

    /** coding | eligibility | payer | provider | timely_filing | modifier | pos | custom */
    category: text('category').notNull(),
    severity: ruleSeverity('severity').notNull().default('error'),
    status: ruleStatus('status').notNull().default('draft'),
    isSystem: boolean('is_system').notNull().default(false),

    /** Which version is live. Null while in draft. */
    activeVersionId: uuid('active_version_id'),

    /** Where this rule came from when it is a system rule: ncci_ptp_2026q3 etc. */
    sourceReference: text('source_reference'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('rules_org_key').on(t.orgId, t.key),
    index('rules_status_idx').on(t.orgId, t.status, t.category),
  ],
);

/**
 * Immutable rule versions. `definition.$schema` is versioned ("grove.rule/v1") from day
 * one because once customers author hundreds of rules, the AST is a data format we must
 * migrate forever.
 */
export const ruleVersions = pgTable(
  'rule_versions',
  {
    id: primaryId,
    orgId,
    ruleId: uuid('rule_id').notNull(),
    versionNumber: integer('version_number').notNull(),

    definition: jsonb('definition').notNull(),
    /** Human-readable rendering of the definition, regenerated on save. */
    plainLanguage: text('plain_language'),

    /** Message shown to the biller, with {{placeholders}} resolved at evaluation. */
    messageTemplate: text('message_template').notNull(),
    /** Suggested fix as a structured action the UI can apply in one click. */
    suggestedFix: jsonb('suggested_fix'),

    changeNote: text('change_note'),
    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [uniqueIndex('rule_versions_key').on(t.ruleId, t.versionNumber)],
);

/**
 * Scoping. A rule applies to the intersection of its bindings: all payers unless bound
 * to some; all practices unless bound to some. A tenant binding with `enabled = false`
 * disables a system rule for that scope.
 */
export const ruleBindings = pgTable(
  'rule_bindings',
  {
    id: primaryId,
    orgId,
    ruleId: uuid('rule_id').notNull(),
    /** payer | practice | provider | specialty | claim_type | place_of_service */
    scopeType: text('scope_type').notNull(),
    scopeValue: text('scope_value').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    /** Severity override for this scope, e.g. a warning that is an error for one payer. */
    severityOverride: text('severity_override'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('rule_bindings_key').on(t.ruleId, t.scopeType, t.scopeValue),
    index('rule_bindings_scope_idx').on(t.orgId, t.scopeType, t.scopeValue),
  ],
);

/**
 * What a scrub run found. Every finding names the rule and version that produced it,
 * so a hold is never a bare rejection code — the biller sees which rule, why, and what
 * to do. Explainability is the baseline here, not a premium feature.
 */
export const ruleFindings = pgTable(
  'rule_findings',
  {
    id: primaryId,
    orgId,
    claimId: uuid('claim_id').notNull(),
    claimVersionId: uuid('claim_version_id'),
    serviceLineId: uuid('service_line_id'),
    ruleId: uuid('rule_id').notNull(),
    ruleVersionId: uuid('rule_version_id').notNull(),

    severity: ruleSeverity('severity').notNull(),
    message: text('message').notNull(),
    /** JSON pointer into the claim payload, e.g. /lines/2/modifiers/0 */
    path: text('path'),
    suggestedFix: jsonb('suggested_fix'),
    evidence: jsonb('evidence'),

    /** open | fixed | overridden | obsolete */
    status: text('status').notNull().default('open'),
    overriddenBy: uuid('overridden_by'),
    overrideReason: text('override_reason'),
    overriddenAt: timestamp('overridden_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('rule_findings_claim_idx').on(t.orgId, t.claimId, t.status),
    index('rule_findings_rule_idx').on(t.orgId, t.ruleId, t.createdAt),
  ],
);

/**
 * "What would this rule have caught last quarter, and what would it have falsely
 * flagged?" — answered before a rule goes live, against real historical claims and
 * their actual outcomes.
 */
export const ruleBacktests = pgTable(
  'rule_backtests',
  {
    id: primaryId,
    orgId,
    ruleVersionId: uuid('rule_version_id').notNull(),

    /** queued | running | completed | failed */
    status: text('status').notNull().default('queued'),
    dateFrom: text('date_from').notNull(),
    dateTo: text('date_to').notNull(),
    practiceIds: uuid('practice_ids').array(),

    claimsEvaluated: integer('claims_evaluated').notNull().default(0),
    claimsFlagged: integer('claims_flagged').notNull().default(0),
    /** Flagged claims that were in fact later denied for a related reason. */
    truePositives: integer('true_positives').notNull().default(0),
    /** Flagged claims that were paid cleanly — the rule would have caused friction. */
    falsePositives: integer('false_positives').notNull().default(0),
    /** Dollars on the true-positive claims: the revenue this rule protects. */
    dollarsAtRiskCents: money('dollars_at_risk_cents').notNull().default(0),

    sampleFindings: jsonb('sample_findings'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    ...timestamps,
  },
  (t) => [index('rule_backtests_version_idx').on(t.orgId, t.ruleVersionId)],
);
