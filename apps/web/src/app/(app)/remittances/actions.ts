'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { eq, schema, sql } from '@grove/db';
import { pageContext } from '@/lib/session';

export async function postRemittance(remittanceId: string) {
  const { run, session } = await pageContext();
  await run(`/remittances/${remittanceId}/post`, async (ctx) => {
    // 1. Fetch remittance
    const [remit] = await ctx.tx
      .select()
      .from(schema.remittances)
      .where(eq(schema.remittances.id, remittanceId));

    if (!remit) throw new Error('Remittance not found');
    if (remit.status === 'posted') throw new Error('Remittance is already posted');

    // 2. Mark remittance as posted
    await ctx.tx
      .update(schema.remittances)
      .set({
        status: 'posted',
        postedAt: new Date(),
        postedBy: session.actor.userId,
        updatedAt: new Date(),
      })
      .where(eq(schema.remittances.id, remittanceId));

    // 3. Mark child remittance claims as posted and update target claims if matched
    const rClaims = await ctx.tx
      .select()
      .from(schema.remittanceClaims)
      .where(eq(schema.remittanceClaims.remittanceId, remittanceId));

    for (const rc of rClaims) {
      await ctx.tx
        .update(schema.remittanceClaims)
        .set({ postedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.remittanceClaims.id, rc.id));

      if (rc.claimId) {
        // Update claim balance and status based on payment and patient responsibility
        const isPaidInFull = (rc.totalPaidCents ?? 0) >= (rc.totalChargeCents ?? 0);
        const newStatus = isPaidInFull
          ? 'paid'
          : (rc.patientResponsibilityCents ?? 0) > 0
          ? 'patient_responsibility'
          : 'partially_paid';

        await ctx.tx
          .update(schema.claims)
          .set({
            status: newStatus,
            totalPaidCents: sql`coalesce(total_paid_cents, 0) + ${rc.totalPaidCents ?? 0}`,
            patientResponsibilityCents: rc.patientResponsibilityCents ?? 0,
            balanceCents: sql`greatest(0, coalesce(balance_cents, total_charge_cents) - ${rc.totalPaidCents ?? 0})`,
            updatedAt: new Date(),
          })
          .where(eq(schema.claims.id, rc.claimId));
      }
    }

    // 4. Audit
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId,
      action: 'post',
      resourceType: 'remittance',
      resourceId: remittanceId,
      actorUserId: session.actor.userId,
      sessionId: session.sessionId,
      requestId: ctx.tenant.requestId,
      context: { totalPaidCents: remit.totalPaidCents, claimsCount: rClaims.length },
    });
  });

  revalidatePath(`/remittances/${remittanceId}`);
  revalidatePath('/remittances');
  revalidatePath('/dashboard');
  revalidatePath('/claims');
}

