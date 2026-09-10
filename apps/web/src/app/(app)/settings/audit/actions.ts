'use server';

import { verifyChain } from '@grove/audit';
import { pageContext } from '@/lib/session';

export async function runVerificationAction() {
  const { run } = await pageContext();
  return run('/settings/audit', async (ctx) => {
    try {
      const result = await verifyChain(ctx.tx, ctx.tenant.orgId, { limit: 1000 });
      return { success: true, result };
    } catch (err: any) {
      return { success: false, error: err.message || 'Verification failed' };
    }
  });
}
