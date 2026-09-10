import { createClearinghouse } from '@grove/clearinghouse';
import { systemContext, withTenant } from '@grove/db';
import type { CommandContext } from '@grove/domain';
import { and, eq, schema, sql } from '@grove/db';

const clearinghouse = createClearinghouse();

/**
 * Run a domain command for one organisation as the system actor. Every job body
 * goes through here, so every job is tenant-scoped, audited, and metered.
 */
export async function forOrg<T>(orgId: string, jobName: string, fn: (ctx: CommandContext) => Promise<T>): Promise<T> {
  const tenant = systemContext(orgId, jobName);
  return withTenant(tenant, (tx) => fn({ tx, tenant, actor: null, clearinghouse, now: () => new Date() }));
}

export interface AutomationGate {
  allowed: boolean;
  reason?: string;
  dryRun: boolean;
}

/**
 * The kill switch and the budget, checked before every automated external call.
 * Answers are: go, go-but-only-log (dry run), or stop with a reason a human can read.
 */
export async function automationGate(ctx: CommandContext, practiceId: string | null, flag: keyof typeof schema.automationSettings.$inferSelect): Promise<AutomationGate> {
  const rows = await ctx.tx
    .select()
    .from(schema.automationSettings)
    .where(and(eq(schema.automationSettings.orgId, ctx.tenant.orgId), practiceId ? sql`(practice_id is null or practice_id = ${practiceId})` : sql`practice_id is null`))
    .orderBy(sql`practice_id nulls last`);
  const s = rows[0];
  if (!s) return { allowed: false, reason: 'no automation settings for organisation', dryRun: true };
  if (s.globalPaused) return { allowed: false, reason: `automation paused: ${s.pausedReason ?? 'no reason given'}`, dryRun: s.dryRun };
  if (s[flag] === false) return { allowed: false, reason: `${String(flag)} is disabled`, dryRun: s.dryRun };

  const [spend] = await ctx.tx
    .select({ cents: sql<number>`coalesce(sum(cost_cents), 0)::bigint` })
    .from(schema.externalCalls)
    .where(and(eq(schema.externalCalls.orgId, ctx.tenant.orgId), sql`started_at >= date_trunc('day', now())`));
  if (Number(spend?.cents ?? 0) >= s.dailyBudgetCents) {
    return { allowed: false, reason: `daily automation budget of ${(s.dailyBudgetCents / 100).toFixed(2)} reached`, dryRun: s.dryRun };
  }
  return { allowed: true, dryRun: s.dryRun };
}
