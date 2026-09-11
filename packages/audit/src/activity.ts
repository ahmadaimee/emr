import { sql, type TenantTx } from '@grove/db';

/**
 * The human-readable activity feed. Curated verbs with structured params, rendered
 * client-side, so phrasing, i18n and permission-based redaction change without a data
 * migration. Kept separate from the audit chain on purpose.
 */
export type ActivityVerb =
  | 'patient.created' | 'patient.updated' | 'patient.merged'
  | 'coverage.added' | 'coverage.updated' | 'coverage.terminated'
  | 'eligibility.verified' | 'eligibility.changed' | 'eligibility.batch_completed'
  | 'encounter.created' | 'charge.added'
  | 'claim.created' | 'claim.scrubbed' | 'claim.submitted' | 'claim.acknowledged' | 'claim.rejected'
  | 'claim.status_updated' | 'claim.paid' | 'claim.denied' | 'claim.corrected' | 'claim.voided'
  | 'claim.secondary_generated' | 'claim.timely_filing_warning' | 'claim.custom_status_changed'
  | 'claim_custom_status.created' | 'claim_custom_status.retired'
  | 'remittance.received' | 'remittance.posted' | 'remittance.out_of_balance'
  | 'denial.created' | 'denial.assigned' | 'denial.resolved' | 'denial.appealed'
  | 'underpayment.detected'
  | 'authorization.requested' | 'authorization.decided'
  | 'payment.received' | 'payment.applied' | 'payment.refunded'
  | 'statement.generated' | 'statement.sent' | 'statement.viewed' | 'statement.paid'
  | 'task.created' | 'task.assigned' | 'task.resolved'
  | 'automation.paused' | 'automation.resumed'
  | 'access.elevated' | 'access.elevation_ended';

export interface ActivityInput {
  orgId: string;
  practiceId?: string | null;
  subjectType: 'patient' | 'claim' | 'encounter' | 'denial' | 'remittance' | 'eligibility_batch' | 'task' | 'statement' | 'organization' | 'claim_custom_status';
  subjectId: string;
  verb: ActivityVerb;
  /** Rendered sentence, e.g. "submitted claim GRV-10041 to Aetna". */
  summary: string;
  detail?: Record<string, unknown>;
  actorUserId?: string | null;
  actorType?: 'user' | 'system' | 'api_client';
  actorLabel?: string | null;
}

export async function recordActivity(tx: TenantTx, a: ActivityInput): Promise<void> {
  await tx.execute(sql`
    insert into activity_events (org_id, practice_id, subject_type, subject_id, actor_user_id, actor_type, actor_label, verb, summary, detail)
    values (${a.orgId}, ${a.practiceId ?? null}, ${a.subjectType}, ${a.subjectId}, ${a.actorUserId ?? null},
            ${a.actorType ?? 'user'}, ${a.actorLabel ?? null}, ${a.verb}, ${a.summary},
            ${a.detail ? JSON.stringify(a.detail) : null}::jsonb)
  `);
}
