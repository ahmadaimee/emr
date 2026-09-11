'use server';

import { revalidatePath } from 'next/cache';
import { createCustomStatusCommand, DomainError, retireCustomStatusCommand } from '@grove/domain';
import { pageContext } from '@/lib/session';

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createClaimStatusAction(formData: FormData): Promise<ActionResult> {
  const label = String(formData.get('label') ?? '');
  const color = String(formData.get('color') ?? 'slate');

  const { run } = await pageContext();
  const result = await run('/settings/claim-statuses', async (ctx) => {
    try {
      await createCustomStatusCommand(ctx, { label, color });
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof DomainError ? err.message : 'Failed to create the status.' };
    }
  });

  revalidatePath('/settings/claim-statuses');
  return result ?? { ok: false, error: 'Database unavailable.' };
}

export async function retireClaimStatusAction(id: string): Promise<ActionResult> {
  const { run } = await pageContext();
  const result = await run('/settings/claim-statuses', async (ctx) => {
    try {
      await retireCustomStatusCommand(ctx, id);
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof DomainError ? err.message : 'Failed to retire the status.' };
    }
  });

  revalidatePath('/settings/claim-statuses');
  return result ?? { ok: false, error: 'Database unavailable.' };
}
