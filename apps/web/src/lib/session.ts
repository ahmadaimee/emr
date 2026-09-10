import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveSession, type ResolvedSession } from '@grove/auth';
import { withTenant } from '@grove/db';
import { PhiAccessCollector } from '@grove/audit';
import { createClearinghouse } from '@grove/clearinghouse';
import type { CommandContext } from '@grove/domain';

export const SESSION_COOKIE = 'grove_session';

const clearinghouse = createClearinghouse();

/** Resolve the session cookie, or null. Never throws. */
export async function getSession(): Promise<ResolvedSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const h = await headers();
  const requestId = h.get('x-request-id') ?? `web_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  return resolveSession(token, requestId);
}

/**
 * For every page under (app): a valid, MFA-satisfied session or a redirect. Because
 * this runs in the layout, there is no route that can render PHI without it.
 */
export async function requireSession(): Promise<ResolvedSession> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (!s.mfaSatisfied) redirect('/mfa');
  return s;
}

export interface PageContext {
  session: ResolvedSession;
  /** Run a domain command or query in the request's tenant transaction, logging PHI reads. */
  run<T>(route: string, fn: (ctx: CommandContext, phi: PhiAccessCollector) => Promise<T>): Promise<T>;
}

export async function pageContext(): Promise<PageContext> {
  const session = await requireSession();
  const h = await headers();
  return {
    session,
    run: (route, fn) =>
      withTenant(session.tenant, async (tx) => {
        const phi = new PhiAccessCollector({ orgId: session.tenant.orgId, actorUserId: session.actor.userId, actorType: 'user', sessionId: session.sessionId, requestId: session.tenant.requestId, elevationId: session.actor.elevation?.id ?? null, route, purpose: 'payment', ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null });
        const result = await fn({ tx, tenant: session.tenant, actor: session.actor, clearinghouse, now: () => new Date() }, phi);
        if (!phi.isEmpty) await phi.flush(tx, route.split('/')[1] ?? 'page');
        return result;
      }),
  };
}
