'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { eq, schema, sql } from '@grove/db';
import { pageContext } from '@/lib/session';

export async function toggleGlobalPause(paused: boolean, reason?: string) {
  const { run, session } = await pageContext();
  await run('/settings/automation', async (ctx) => {
    await ctx.tx
      .update(schema.automationSettings)
      .set({
        globalPaused: paused,
        pausedReason: paused ? (reason ?? 'Manual pause by operator') : null,
        pausedBy: paused ? session.actor.userId : null,
        pausedAt: paused ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(sql`practice_id is null`);

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'config_change',
      resourceType: 'automation_settings',
      resourceId: ctx.tenant.orgId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { globalPaused: paused, reason },
    });
  });

  revalidatePath('/settings/automation');
  revalidatePath('/dashboard');
}

export async function updateAutomation(formData: FormData) {
  const dryRun = formData.get('dryRun') === 'on';
  const autoEligibilityPreVisit = formData.get('autoEligibilityPreVisit') === 'on';
  const autoSecondaryClaims = formData.get('autoSecondaryClaims') === 'on';
  const autoSubmitSecondary = formData.get('autoSubmitSecondary') === 'on';
  const autoTransferPatientResponsibility = formData.get('autoTransferPatientResponsibility') === 'on';
  const autoCorrectedClaims = formData.get('autoCorrectedClaims') === 'on';

  const { run, session } = await pageContext();
  await run('/settings/automation', async (ctx) => {
    await ctx.tx
      .update(schema.automationSettings)
      .set({
        dryRun,
        autoEligibilityPreVisit,
        autoSecondaryClaims,
        autoSubmitSecondary,
        autoTransferPatientResponsibility,
        autoCorrectedClaims,
        updatedAt: new Date(),
      })
      .where(sql`practice_id is null`);

    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'config_change',
      resourceType: 'automation_settings',
      resourceId: ctx.tenant.orgId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { dryRun, autoSecondaryClaims },
    });
  });

  revalidatePath('/settings/automation');
  revalidatePath('/dashboard');
}

