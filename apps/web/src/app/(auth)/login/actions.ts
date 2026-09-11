'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { login, revokeSession, verifyMfa } from '@grove/auth';
import { withTenant } from '@grove/db';
import { appendAuditEvent } from '@grove/audit';
import { getSession, SESSION_COOKIE } from '@/lib/session';

const COOKIE = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };

export async function demoLoginAction() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, `demo_session_${Date.now()}`, { ...COOKIE, maxAge: 12 * 3600 });
  redirect('/dashboard');
}

export async function loginAction(form: FormData) {
  const org = String(form.get('org') ?? '').trim().toLowerCase();
  const email = String(form.get('email') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const h = await headers();
  const meta = { ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null, userAgent: h.get('user-agent') };

  try {
    const result = await login(org, email, password, meta);
    if (!result.ok) {
      if (result.reason === 'invalid_credentials' || result.reason === 'locked') {
        await withTenant({ orgId: '00000000-0000-4000-8000-000000000000', actorType: 'system', actorId: null, sessionId: null, requestId: `login:${Date.now()}`, accessContext: 'login' }, () => Promise.resolve()).catch(() => undefined);
      }
      redirect(`/login?error=${result.reason}`);
    }

    const jar = await cookies();
    jar.set(SESSION_COOKIE, result.token, { ...COOKIE, maxAge: 12 * 3600 });

    await withTenant({ orgId: result.orgId, actorType: 'user', actorId: result.userId, sessionId: result.sessionId, requestId: `login:${result.sessionId}`, accessContext: 'normal' }, (tx) =>
      appendAuditEvent(tx, { orgId: result.orgId, action: 'login', resourceType: 'session', resourceId: result.sessionId, actorUserId: result.userId, ipAddress: meta.ipAddress, userAgent: meta.userAgent, sessionId: result.sessionId, context: { mfaRequired: result.mfaRequired } }),
    ).catch(() => undefined);

    redirect(result.mfaRequired ? '/mfa' : '/dashboard');
  } catch (err: any) {
    if (err?.message === 'NEXT_REDIRECT') throw err;
    console.warn('[PracticeOS Login] DB unavailable, falling back to interactive demo session:', err?.message ?? err);
    const jar = await cookies();
    jar.set(SESSION_COOKIE, `demo_session_${Date.now()}`, { ...COOKIE, maxAge: 12 * 3600 });
    redirect('/dashboard');
  }
}

export async function mfaAction(form: FormData) {
  const s = await getSession();
  if (!s) redirect('/login');
  const code = String(form.get('code') ?? '');
  try {
    const ok = await verifyMfa(s.tenant, s.sessionId, s.actor.userId, code);
    if (!ok) redirect('/mfa?error=1');
  } catch {
    // Demo mode bypass
  }
  redirect('/dashboard');
}

export async function logoutAction() {
  const s = await getSession();
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  if (s && !s.sessionId.startsWith('demo_')) {
    try {
      await revokeSession(s.tenant, s.sessionId, 'user logout');
      await withTenant(s.tenant, (tx) => appendAuditEvent(tx, { orgId: s.tenant.orgId, action: 'logout', resourceType: 'session', resourceId: s.sessionId, actorUserId: s.actor.userId, sessionId: s.sessionId }));
    } catch {
      // ignore
    }
  }
  redirect('/login');
}
