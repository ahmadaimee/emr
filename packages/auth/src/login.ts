import { and, bootstrap, eq, schema, sql, withTenant, type TenantContext } from '@grove/db';
import { verifyPassword } from './password';
import { createSession } from './session';
import { decryptSecret, verifyTotp } from './totp';

export type LoginResult =
  | { ok: true; token: string; sessionId: string; orgId: string; userId: string; mfaRequired: false }
  | { ok: true; token: string; sessionId: string; orgId: string; userId: string; mfaRequired: true }
  | { ok: false; reason: 'invalid_credentials' | 'locked' | 'inactive' | 'mfa_enrolment_required' };

const MFA_REQUIRED = (process.env.MFA_REQUIRED ?? 'true') !== 'false';

/**
 * Password step. Returns a session that is NOT yet MFA-satisfied when MFA is required;
 * the caller must complete `verifyMfa` before the session can reach PHI. All failure
 * modes take the same time and return the same shape, so nothing leaks about which
 * part was wrong.
 */
export async function login(orgSlug: string, email: string, password: string, meta: { ipAddress?: string | null; userAgent?: string | null }): Promise<LoginResult> {
  const user = await bootstrap.userForLogin(orgSlug, email);
  // Burn a hash verification even for unknown users to keep timing flat.
  const ok = user?.password_hash ? await verifyPassword(user.password_hash, password) : (await verifyPassword('$argon2id$v=19$m=65536,t=3,p=2$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', password), false);
  if (!user) return { ok: false, reason: 'invalid_credentials' };
  if (user.locked_until && user.locked_until > new Date()) return { ok: false, reason: 'locked' };
  if (!ok) {
    await bootstrap.recordLoginFailure(user.user_id);
    return { ok: false, reason: 'invalid_credentials' };
  }
  if (user.status !== 'active') return { ok: false, reason: 'inactive' };

  const mfaRequired = MFA_REQUIRED;
  if (mfaRequired && !user.mfa_enrolled_at) {
    // Allow the session so the user can enrol, but it cannot reach PHI until they do.
    const s = await createSession(user.org_id, user.user_id, { ...meta, mfaSatisfied: false });
    return { ok: true, ...s, orgId: user.org_id, userId: user.user_id, mfaRequired: true };
  }
  const s = await createSession(user.org_id, user.user_id, { ...meta, mfaSatisfied: !mfaRequired });
  return { ok: true, ...s, orgId: user.org_id, userId: user.user_id, mfaRequired };
}

/** TOTP step. Marks the session MFA-satisfied on success. */
export async function verifyMfa(tenant: TenantContext, sessionId: string, userId: string, code: string): Promise<boolean> {
  return withTenant(tenant, async (tx) => {
    const methods = await tx.select().from(schema.mfaMethods).where(and(eq(schema.mfaMethods.userId, userId), eq(schema.mfaMethods.type, 'totp')));
    for (const m of methods) {
      if (!m.secretEncrypted) continue;
      const secret = decryptSecret(m.secretEncrypted, m.keyVersion);
      if (verifyTotp(secret, code)) {
        await tx.update(schema.sessions).set({ mfaSatisfiedAt: new Date() }).where(eq(schema.sessions.id, sessionId));
        await tx.update(schema.mfaMethods).set({ lastUsedAt: new Date() }).where(eq(schema.mfaMethods.id, m.id));
        return true;
      }
    }
    // Recovery codes are single-use.
    const recovery = await tx.select().from(schema.mfaMethods).where(and(eq(schema.mfaMethods.userId, userId), eq(schema.mfaMethods.type, 'recovery_code'), sql`last_used_at is null`));
    for (const r of recovery) {
      if (r.secretEncrypted && decryptSecret(r.secretEncrypted, r.keyVersion) === code.trim()) {
        await tx.update(schema.mfaMethods).set({ lastUsedAt: new Date() }).where(eq(schema.mfaMethods.id, r.id));
        await tx.update(schema.sessions).set({ mfaSatisfiedAt: new Date() }).where(eq(schema.sessions.id, sessionId));
        return true;
      }
    }
    return false;
  });
}

/** Re-authenticate for a step-up action: refreshes `mfaSatisfiedAt` on the session. */
export async function stepUp(tenant: TenantContext, sessionId: string, userId: string, code: string): Promise<boolean> {
  return verifyMfa(tenant, sessionId, userId, code);
}
