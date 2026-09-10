'use server';

import { redirect } from 'next/navigation';
import { encryptSecret, generateRecoveryCodes, generateTotpSecret, verifyTotp } from '@grove/auth';
import { appendAuditEvent } from '@grove/audit';
import { eq, schema, withTenant } from '@grove/db';
import { getSession } from '@/lib/session';

export async function enrolTotpAction() {
  const s = await getSession();
  if (!s) redirect('/login');
  const [user] = await withTenant(s.tenant, (tx) => tx.select({ email: schema.users.email }).from(schema.users).where(eq(schema.users.id, s.actor.userId)));
  const { uri } = generateTotpSecret();
  redirect(`/mfa?enrol=${encodeURIComponent(uri(user?.email ?? 'grove'))}`);
}

export async function confirmTotpAction(form: FormData) {
  const s = await getSession();
  if (!s) redirect('/login');
  const uri = String(form.get('uri') ?? '');
  const code = String(form.get('code') ?? '');
  const secret = new URL(uri).searchParams.get('secret') ?? '';
  if (!secret || !verifyTotp(secret, code)) redirect(`/mfa?enrol=${encodeURIComponent(uri)}&error=1`);

  const enc = encryptSecret(secret);
  const recovery = generateRecoveryCodes();
  await withTenant(s.tenant, async (tx) => {
    await tx.insert(schema.mfaMethods).values({ orgId: s.tenant.orgId, userId: s.actor.userId, type: 'totp', label: 'Authenticator app', secretEncrypted: enc.ciphertext, keyVersion: enc.keyVersion });
    for (const r of recovery) {
      const e = encryptSecret(r);
      await tx.insert(schema.mfaMethods).values({ orgId: s.tenant.orgId, userId: s.actor.userId, type: 'recovery_code', secretEncrypted: e.ciphertext, keyVersion: e.keyVersion });
    }
    await tx.update(schema.users).set({ mfaEnrolledAt: new Date(), status: 'active' }).where(eq(schema.users.id, s.actor.userId));
    await tx.update(schema.sessions).set({ mfaSatisfiedAt: new Date() }).where(eq(schema.sessions.id, s.sessionId));
    await appendAuditEvent(tx, { orgId: s.tenant.orgId, action: 'config_change', resourceType: 'mfa_method', actorUserId: s.actor.userId, sessionId: s.sessionId, context: { enrolled: 'totp', recoveryCodes: recovery.length } });
  });
  // Recovery codes are shown once, on the dashboard banner, via a short-lived cookie.
  redirect(`/dashboard?recovery=${encodeURIComponent(recovery.join(','))}`);
}
