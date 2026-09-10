import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * THE database chokepoint.
 *
 * There is deliberately no exported `db`. The only way to run a query is inside
 * `withTenant`, which opens a transaction and sets the transaction-local settings
 * that every row-level security policy and every audit trigger reads. You cannot
 * accidentally query without a tenant, because there is no handle to do it with.
 *
 * Two details that are load-bearing:
 *
 *  1. `set_config(..., true)` — the third argument makes the setting LOCAL to the
 *     transaction, so it is discarded at COMMIT/ROLLBACK. Under a transaction-mode
 *     connection pooler a session-level SET would survive into the next tenant's
 *     transaction on the same connection. That is the classic cross-tenant leak.
 *
 *  2. The values are BIND PARAMETERS. `SET LOCAL app.current_org = '...'` cannot be
 *     parameterised, which would mean string interpolation in the single most
 *     security-sensitive statement in the system.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString, {
  max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  // Unnamed statements only: required for compatibility with PgBouncer transaction mode.
  prepare: false,
  // Fail loudly rather than hang a request on a saturated pool.
  connect_timeout: 10,
  idle_timeout: 30,
  // Nothing here should take longer than this; reporting uses its own role and pool.
  connection: { statement_timeout: 15_000 },
});

const db = drizzle(client, { schema });

type RawTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

declare const tenantBrand: unique symbol;

/**
 * A transaction that has had its tenant context set. Query functions accept only this
 * type, and the only way to obtain one is `withTenant` — so the compiler, not a code
 * reviewer, enforces that every query runs with RLS context.
 */
export type TenantTx = RawTx & { readonly [tenantBrand]: true };

export type ActorType = 'user' | 'system' | 'api_client';

export interface TenantContext {
  orgId: string;
  actorType: ActorType;
  /** User ID for interactive sessions, API client ID for the public API, null for system. */
  actorId: string | null;
  sessionId: string | null;
  requestId: string;
  /**
   * `normal`, or `elevation:<access_elevation_id>` when staff have entered a client
   * practice under a time-boxed grant. Stamped on every audit row written during the
   * transaction so "everything this person touched under that grant" is one query.
   */
  accessContext: string;
}

export async function withTenant<T>(
  ctx: TenantContext,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`
      select
        set_config('app.current_org',    ${ctx.orgId},               true),
        set_config('app.actor_type',     ${ctx.actorType},           true),
        set_config('app.actor_id',       ${ctx.actorId ?? ''},       true),
        set_config('app.session_id',     ${ctx.sessionId ?? ''},     true),
        set_config('app.request_id',     ${ctx.requestId},           true),
        set_config('app.access_context', ${ctx.accessContext},       true)
    `);
    return fn(tx as TenantTx);
  });
}

/** Context for background work that acts on behalf of an organisation, not a person. */
export function systemContext(orgId: string, jobName: string): TenantContext {
  return {
    orgId,
    actorType: 'system',
    actorId: null,
    sessionId: null,
    requestId: `job:${jobName}:${crypto.randomUUID()}`,
    accessContext: 'system',
  };
}

/**
 * Enumerates organisations for system jobs that must visit every tenant (outbox relay,
 * chain verification, nightly rollups). It returns IDs only; all real work happens
 * per-tenant inside `withTenant`. There is no code path that reads PHI across tenants.
 */
export async function listOrganizationIds(): Promise<string[]> {
  // SECURITY DEFINER: the one sanctioned cross-tenant read, and it returns IDs only.
  const rows = await client<{ id: string }[]>`select id from app.list_organization_ids() as t(id)`;
  return rows.map((r) => r.id);
}

/**
 * Bootstrap lookups that must run BEFORE a tenant context exists (login, API keys,
 * session resolution). Each maps to a SECURITY DEFINER function that returns only the
 * columns needed to establish context.
 */
export const bootstrap = {
  orgBySlug: (slug: string) =>
    client<{ id: string; name: string; slug: string }[]>`select * from app.resolve_org_slug(${slug})`.then((r) => r[0] ?? null),
  userForLogin: (slug: string, email: string) =>
    client<{ org_id: string; user_id: string; password_hash: string | null; status: string; mfa_enrolled_at: Date | null; failed_login_count: number; locked_until: Date | null }[]>`select * from app.resolve_user_for_login(${slug}, ${email})`.then((r) => r[0] ?? null),
  session: (tokenHash: string) =>
    client<{ org_id: string; session_id: string; user_id: string; idle_expires_at: Date; absolute_expires_at: Date; mfa_satisfied_at: Date | null; revoked_at: Date | null }[]>`select * from app.resolve_session(${tokenHash})`.then((r) => r[0] ?? null),
  apiKey: (publicId: string) =>
    client<{ org_id: string; key_id: string; secret_hash: string; scopes: string[]; practice_ids: string[] | null; ip_allowlist: string[] | null; expires_at: Date; revoked_at: Date | null }[]>`select * from app.resolve_api_key(${publicId})`.then((r) => r[0] ?? null),
  recordLoginFailure: (userId: string, lockAfter = 5, lockMinutes = 15) =>
    client`select app.record_login_failure(${userId}, ${lockAfter}, ${lockMinutes})`.then(() => undefined),
};

export async function closeDatabase(): Promise<void> {
  await client.end({ timeout: 5 });
}

export { schema };
