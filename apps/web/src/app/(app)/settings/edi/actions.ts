'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { eq, schema } from '@grove/db';
import { pageContext } from '@/lib/session';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function updateEdiSettingsAction(input: { ediSubmitterId: string; ediSubmitterName: string; ediUsageIndicator: 'T' | 'P' }): Promise<ActionResult> {
  if (!input.ediSubmitterId.trim()) return { ok: false, error: 'A submitter ID is required.' };

  const { run, session } = await pageContext();
  const result = await run('/settings/edi', async (ctx) => {
    await ctx.tx
      .update(schema.organizations)
      .set({ ediSubmitterId: input.ediSubmitterId.trim(), ediSubmitterName: input.ediSubmitterName.trim() || null, ediUsageIndicator: input.ediUsageIndicator, updatedAt: new Date() })
      .where(eq(schema.organizations.id, ctx.tenant.orgId));

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'config_change',
      resourceType: 'organization',
      resourceId: ctx.tenant.orgId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { ediSubmitterId: input.ediSubmitterId, ediUsageIndicator: input.ediUsageIndicator },
    });
    return { ok: true as const };
  });

  revalidatePath('/settings/edi');
  return result ?? { ok: false, error: 'Database unavailable.' };
}
