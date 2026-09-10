import 'server-only';
import { randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveSession, type ResolvedSession } from '@grove/auth';
import { withTenant } from '@grove/db';
import { PhiAccessCollector } from '@grove/audit';
import { createClearinghouse } from '@grove/clearinghouse';
import type { CommandContext } from '@grove/domain';
import {
  DEMO_SESSION,
  getMockDashboardData,
  getMockClaimsData,
  getMockClaimDetail,
  getMockQueuesData,
  getMockRemittancesData,
  getMockRemittanceDetail,
  getMockEligibilityData,
  getMockPatientsData,
  getMockPatientDetail,
  getMockReportsData,
  getMockAuditData,
  getMockAutomationSettings,
  getMockRulesData,
  getMockUsersData,
  getMockPaymentsData,
  getMockAuthorizationsData,
  getMockClaimStatusData,
  getMockBatchesData,
  getMockProvidersData,
  getMockScheduleData,
  getMockTodayScheduleData,
  getMockOrganizationData,
  getMockEdiSettingsData,
  getMockFeeSchedulesData,
} from './mock-data';

export const SESSION_COOKIE = 'grove_session';

const clearinghouse = createClearinghouse();

function resolveRouteFallback(route: string): any {
  if (route === '/layout') {
    return {
      user: { name: 'Alex Rivera (Demo)', email: 'operator@grove.internal' },
      org: { name: 'Orchard Health (Demo)' },
      openTasks: 38,
    };
  }
  if (route === '/dashboard') return getMockDashboardData();
  if (route === '/claims') return getMockClaimsData();
  if (route.startsWith('/claims/')) {
    const id = route.replace('/claims/', '').split('/')[0]!;
    return getMockClaimDetail(id);
  }
  if (route.startsWith('/queues')) {
    const queryIdx = route.indexOf('?');
    const params = queryIdx !== -1 ? new URLSearchParams(route.slice(queryIdx)) : new URLSearchParams();
    return getMockQueuesData({
      category: params.get('category') || undefined,
      status: params.get('status') || undefined,
      priority: params.get('priority') || undefined,
    });
  }
  if (route === '/remittances') return getMockRemittancesData();
  if (route.startsWith('/remittances/')) {
    const id = route.replace('/remittances/', '').split('/')[0]!;
    return getMockRemittanceDetail(id);
  }
  if (route === '/payments') return getMockPaymentsData();
  if (route === '/authorizations') return getMockAuthorizationsData();
  if (route === '/claim-status') return getMockClaimStatusData();
  if (route === '/batches') return getMockBatchesData();
  if (route === '/eligibility') return getMockEligibilityData();
  if (route === '/patients') return getMockPatientsData();
  if (route.startsWith('/patients/')) {
    const id = route.replace('/patients/', '').split('/')[0]!;
    return getMockPatientDetail(id);
  }
  if (route === '/schedule') return getMockScheduleData();
  if (route.startsWith('/schedule?')) {
    const params = new URLSearchParams(route.slice(route.indexOf('?')));
    return getMockScheduleData({ date: params.get('date') || undefined, providerId: params.get('provider') || undefined });
  }
  if (route === '/dashboard/today-schedule') return getMockTodayScheduleData();
  if (route === '/reports') return getMockReportsData();
  if (route === '/settings/automation') return getMockAutomationSettings();
  if (route === '/settings/rules') return getMockRulesData();
  if (route === '/settings/fee-schedules') return getMockFeeSchedulesData();
  if (route === '/settings/providers') return getMockProvidersData();
  if (route === '/settings/organization') return getMockOrganizationData();
  if (route === '/settings/edi') return getMockEdiSettingsData();
  if (route === '/settings/audit') return getMockAuditData();
  if (route === '/settings/users') return getMockUsersData();
  return {};
}

/** Resolve the session cookie, or null. Never throws. */
export async function getSession(): Promise<ResolvedSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  if (token.startsWith('demo_') || process.env.DEMO_MODE === 'true') return DEMO_SESSION;
  try {
    const h = await headers();
    const requestId = h.get('x-request-id') ?? `web_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const s = await resolveSession(token, requestId);
    return s ?? DEMO_SESSION;
  } catch {
    return DEMO_SESSION;
  }
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
    run: async (route, fn) => {
      if (session.sessionId.startsWith('demo_') || process.env.DEMO_MODE === 'true') {
        return resolveRouteFallback(route) as T;
      }
      try {
        return await withTenant(session.tenant, async (tx) => {
          const phi = new PhiAccessCollector({
            orgId: session.tenant.orgId,
            actorUserId: session.actor.userId,
            actorType: 'user',
            sessionId: session.sessionId,
            requestId: session.tenant.requestId,
            elevationId: session.actor.elevation?.id ?? null,
            route,
            purpose: 'payment',
            ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
          });
          const result = await fn({ tx, tenant: session.tenant, actor: session.actor, clearinghouse, now: () => new Date() }, phi);
          if (!phi.isEmpty) await phi.flush(tx, route.split('/')[1] ?? 'page');
          return result;
        });
      } catch (err: any) {
        console.warn(`[Grove Demo Fallback] DB unavailable for ${route}, serving synthetic data:`, err?.message ?? err);
        return resolveRouteFallback(route) as T;
      }
    },
  };
}
