import { createHash, randomBytes } from 'node:crypto';
import { and, bootstrap, eq, schema, sql, withTenant, type TenantContext } from '@grove/db';
import type { Actor } from './rbac';

/**
 * Database-backed sessions. A session is a row, so revocation is a DELETE and is
 * effective on the next request — the property JWT-only sessions cannot provide and
 * the reason they are not used here.
 *
 * Timeouts follow 45 CFR 164.312(a)(2)(iii): an idle window that slides on activity,
 * and an absolute ceiling that does not.
 */

const IDLE_MINUTES = Number(process.env.SESSION_IDLE_TIMEOUT_MINUTES ?? 15);
const ABSOLUTE_HOURS = Number(process.env.SESSION_ABSOLUTE_TIMEOUT_HOURS ?? 12);

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface ResolvedSession {
  tenant: TenantContext;
  actor: Actor;
  sessionId: string;
  mfaSatisfied: boolean;
}

export async function createSession(orgId: string, userId: string, meta: { ipAddress?: string | null; userAgent?: string | null; mfaSatisfied: boolean }): Promise<{ token: string; sessionId: string }> {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  const ctx: TenantContext = { orgId, actorType: 'user', actorId: userId, sessionId: null, requestId: `login:${randomBytes(6).toString('hex')}`, accessContext: 'normal' };
  const sessionId = await withTenant(ctx, async (tx) => {
    const [s] = await tx
      .insert(schema.sessions)
      .values({
        orgId, userId, tokenHash: hashToken(token),
        ipAddress: meta.ipAddress ?? null, userAgent: meta.userAgent?.slice(0, 500) ?? null,
        idleExpiresAt: new Date(now.getTime() + IDLE_MINUTES * 60_000),
        absoluteExpiresAt: new Date(now.getTime() + ABSOLUTE_HOURS * 3_600_000),
        mfaSatisfiedAt: meta.mfaSatisfied ? now : null,
      })
      .returning({ id: schema.sessions.id });
    await tx.update(schema.users).set({ lastLoginAt: now, failedLoginCount: 0, lockedUntil: null }).where(eq(schema.users.id, userId));
    return s!.id;
  });
  return { token, sessionId };
}

/**
 * Resolve a bearer/cookie token into a tenant context and an actor, sliding the idle
 * window. Returns null for anything not valid — expired, revoked, unknown — without
 * distinguishing which, so a probe learns nothing.
 */
export async function resolveSession(token: string, requestId: string): Promise<ResolvedSession | null> {
  const row = await bootstrap.session(hashToken(token));
  if (!row) return null;
  const now = new Date();
  if (row.revoked_at || row.idle_expires_at < now || row.absolute_expires_at < now) return null;

  const tenant: TenantContext = { orgId: row.org_id, actorType: 'user', actorId: row.user_id, sessionId: row.session_id, requestId, accessContext: 'normal' };

  const actor = await withTenant(tenant, async (tx) => {
    await tx.update(schema.sessions).set({ idleExpiresAt: new Date(now.getTime() + IDLE_MINUTES * 60_000) }).where(eq(schema.sessions.id, row.session_id));

    const [user] = await tx.select({ status: schema.users.status }).from(schema.users).where(eq(schema.users.id, row.user_id));
    if (!user || user.status !== 'active') return null;

    const grants = await tx
      .select({ resource: schema.rolePermissions.resource, action: schema.rolePermissions.action, constraints: schema.rolePermissions.constraints })
      .from(schema.userRoles)
      .innerJoin(schema.rolePermissions, eq(schema.rolePermissions.roleId, schema.userRoles.roleId))
      .where(eq(schema.userRoles.userId, row.user_id));
    const practices = await tx.select({ practiceId: schema.userPracticeAccess.practiceId }).from(schema.userPracticeAccess).where(eq(schema.userPracticeAccess.userId, row.user_id));
    const [elevation] = await tx
      .select()
      .from(schema.accessElevations)
      .where(and(eq(schema.accessElevations.userId, row.user_id), sql`revoked_at is null`, sql`expires_at > now()`))
      .orderBy(sql`expires_at desc`)
      .limit(1);

    const a: Actor = {
      userId: row.user_id,
      orgId: row.org_id,
      grants: grants.map((g) => ({ resource: g.resource, action: g.action, constraints: (g.constraints as Record<string, unknown> | null) ?? null })),
      practiceIds: practices.map((p) => p.practiceId),
      elevation: elevation ? { id: elevation.id, practiceIds: ((elevation.scope as { practiceIds?: string[] | '*' }).practiceIds ?? '*'), expiresAt: elevation.expiresAt } : null,
      mfaSatisfiedAt: row.mfa_satisfied_at,
    };
    return a;
  });
  if (!actor) return null;

  if (actor.elevation) tenant.accessContext = `elevation:${actor.elevation.id}`;
  return { tenant, actor, sessionId: row.session_id, mfaSatisfied: Boolean(row.mfa_satisfied_at) };
}

export async function revokeSession(tenant: TenantContext, sessionId: string, reason: string): Promise<void> {
  await withTenant(tenant, (tx) =>
    tx.update(schema.sessions).set({ revokedAt: new Date(), revokedReason: reason }).where(eq(schema.sessions.id, sessionId)),
  );
}

export async function revokeAllSessions(tenant: TenantContext, userId: string, reason: string): Promise<void> {
  await withTenant(tenant, (tx) =>
    tx.update(schema.sessions).set({ revokedAt: new Date(), revokedReason: reason }).where(and(eq(schema.sessions.userId, userId), sql`revoked_at is null`)),
  );
}
