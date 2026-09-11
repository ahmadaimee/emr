'use server';

import { revalidatePath } from 'next/cache';
import { appendAuditEvent } from '@grove/audit';
import { and, eq, schema } from '@grove/db';
import { pageContext } from '@/lib/session';

export type ActionResult<T = undefined> = ({ ok: true } & (T extends undefined ? {} : { data: T })) | { ok: false; error: string };

export interface OrgSettingsExtra {
  dba?: string;
  phone?: string;
  fax?: string;
  email?: string;
  physicalAddress?: { line1: string; line2?: string; city: string; state: string; zip: string };
  payToAddress?: { line1: string; city: string; state: string; zip: string };
}

export async function updateOrganizationAction(input: { name: string; extra: OrgSettingsExtra }): Promise<ActionResult> {
  if (!input.name.trim()) return { ok: false, error: 'A legal name is required.' };

  const { run, session } = await pageContext();
  const result = await run('/settings/organization', async (ctx) => {
    await ctx.tx.update(schema.organizations).set({ name: input.name.trim(), settings: input.extra as Record<string, unknown>, updatedAt: new Date() }).where(eq(schema.organizations.id, ctx.tenant.orgId));
    await appendAuditEvent(ctx.tx, {
      orgId: ctx.tenant.orgId, action: 'config_change', resourceType: 'organization', resourceId: ctx.tenant.orgId,
      actorUserId: session.actor.userId, sessionId: session.sessionId, requestId: ctx.tenant.requestId, context: { name: input.name },
    });
    return { ok: true as const };
  });

  revalidatePath('/settings/organization');
  return result ?? { ok: false, error: 'Database unavailable.' };
}

export async function createPracticeAction(input: { name: string; npi: string; taxId: string; taxonomyCode?: string; cliaNumber?: string }): Promise<ActionResult<{ practiceId: string }>> {
  if (!input.name.trim()) return { ok: false, error: 'A practice name is required.' };

  const { run, session } = await pageContext();
  const result = await run('/settings/organization', async (ctx) => {
    try {
      const [row] = await ctx.tx
        .insert(schema.practices)
        .values({ orgId: ctx.tenant.orgId, name: input.name.trim(), npi: input.npi.trim() || null, taxId: input.taxId.trim() || null, taxonomyCode: input.taxonomyCode?.trim() || null, cliaNumber: input.cliaNumber?.trim() || null })
        .returning({ id: schema.practices.id });
      await appendAuditEvent(ctx.tx, {
        orgId: ctx.tenant.orgId, action: 'create', resourceType: 'organization', resourceId: row!.id,
        actorUserId: session.actor.userId, sessionId: session.sessionId, requestId: ctx.tenant.requestId, context: { name: input.name, npi: input.npi },
      });
      return { ok: true as const, data: { practiceId: row!.id } };
    } catch (err) {
      return { ok: false as const, error: (err as Error).message.includes('unique') ? 'A practice with that NPI already exists.' : 'Failed to create the practice.' };
    }
  });

  if (result?.ok) {
    revalidatePath('/settings/organization');
    return result;
  }
  return result ?? { ok: false, error: 'Database unavailable.' };
}

export async function createLocationAction(input: { practiceId: string; name: string; line1: string; city: string; state: string; postalCode: string; npi?: string; placeOfService?: string }): Promise<ActionResult> {
  if (!input.practiceId) return { ok: false, error: 'Select a practice.' };
  if (!input.name.trim() || !input.line1.trim() || !input.city.trim() || !input.state.trim() || !input.postalCode.trim()) {
    return { ok: false, error: 'Name, address line 1, city, state, and ZIP are required.' };
  }

  const { run } = await pageContext();
  const result = await run('/settings/organization', async (ctx) => {
    await ctx.tx.insert(schema.locations).values({
      orgId: ctx.tenant.orgId, practiceId: input.practiceId, name: input.name.trim(),
      line1: input.line1.trim(), city: input.city.trim(), state: input.state.trim().toUpperCase().slice(0, 2), postalCode: input.postalCode.trim(),
      npi: input.npi?.trim() || null, placeOfService: input.placeOfService?.trim() || null,
    });
    return { ok: true as const };
  });

  revalidatePath('/settings/organization');
  return result ?? { ok: false, error: 'Database unavailable.' };
}

export async function updatePracticeEftStatusAction(practiceId: string, status: 'not_started' | 'submitted' | 'active', bankName?: string): Promise<ActionResult> {
  const { run } = await pageContext();
  const result = await run('/settings/organization', async (ctx) => {
    await ctx.tx.update(schema.practices).set({ eftEnrollmentStatus: status, eftBankName: bankName?.trim() || null, updatedAt: new Date() }).where(and(eq(schema.practices.id, practiceId), eq(schema.practices.orgId, ctx.tenant.orgId)));
    return { ok: true as const };
  });
  revalidatePath('/settings/organization');
  revalidatePath('/settings/setup');
  return result ?? { ok: false, error: 'Database unavailable.' };
}
