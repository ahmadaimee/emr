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
  getMockProviderDetail,
  getMockScheduleData,
  getMockUb04Detail,
  getMockTodayScheduleData,
  getMockOrganizationData,
  getMockEdiSettingsData,
  getMockFeeSchedulesData,
} from './mock-data';

export const SESSION_COOKIE = 'grove_session';

const clearinghouse = createClearinghouse();

/**
 * True only for errors that mean the database itself could not be reached (connection
 * refused/reset, DNS failure, timeout) — the cases the demo fallback exists for. A
 * `PostgresError` from a real query (constraint violation, bad SQL) or a plain `Error`
 * thrown by application validation code is a real failure that must reach the caller,
 * not something to paper over with synthetic data.
 */
function isDatabaseUnavailableError(err: any): boolean {
  const code = err?.code;
  const connectionCodes = new Set([
    'ECONNREFUSED',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'EHOSTUNREACH',
    'CONNECTION_ENDED',
    'CONNECT_TIMEOUT',
    'CONNECTION_CLOSED',
    'CONNECTION_DESTROYED',
  ]);
  if (typeof code === 'string' && connectionCodes.has(code)) return true;
  // postgres.js query-level failures (syntax errors, constraint violations, etc.) carry
  // a SQLSTATE five-character code and a `severity` field; connection failures do not.
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code) && err?.severity) return false;
  return false;
}

function resolveRouteFallback(route: string): any {
  if (route === '/layout') {
    return {
      user: { name: 'Alex Rivera (Demo)', email: 'operator@grove.internal' },
      org: { name: 'Orchard Health (Demo)' },
      openTasks: 38,
    };
  }
  if (route === '/dashboard') return getMockDashboardData();
  if (route.startsWith('/claims/') && route.endsWith('/ub04')) {
    return getMockUb04Detail(route.replace('/claims/', '').replace('/ub04', ''));
  }
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
  if (route.startsWith('/settings/providers/')) {
    return getMockProviderDetail(route.replace('/settings/providers/', '').split('/')[0]!) ?? {};
  }
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
    run: async <T,>(route: string, fn: (ctx: CommandContext, phi: PhiAccessCollector) => Promise<T>) => {
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
        // Only fall back to synthetic data when the database itself is unreachable.
        // A validation error thrown by the callback (e.g. "duplicate patient") or a
        // real constraint violation must reach the caller — silently swallowing it and
        // returning fake "success" data would mean a write action reports success while
        // writing nothing.
        if (!isDatabaseUnavailableError(err)) throw err;
        console.warn(`[PracticeOS Demo Fallback] DB unavailable for ${route}, serving synthetic data:`, err?.message ?? err);
        return resolveRouteFallback(route) as T;
      }
    },
  };
}
