import type { Actor } from '@grove/auth';
import type { ClearinghouseAdapter } from '@grove/clearinghouse';
import type { TenantContext, TenantTx } from '@grove/db';

/**
 * Everything a command handler needs. Transports (Fastify routes, Next server actions,
 * pg-boss workers) build one of these and call a handler; handlers never reach for
 * globals. That is what makes the same command behave identically from the UI, the
 * public API, and a background job — and what makes it testable.
 */
export interface CommandContext {
  tx: TenantTx;
  tenant: TenantContext;
  /** Null for system jobs. Authorization is skipped for system actors by design —
   *  they are not users, and their permission is the job schedule itself. */
  actor: Actor | null;
  clearinghouse: ClearinghouseAdapter;
  /** Injectable clock, for deterministic tests and backtesting. */
  now: () => Date;
}

export const todayIso = (ctx: CommandContext): string => ctx.now().toISOString().slice(0, 10);

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status = 422,
    public readonly detail?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id: string) {
    // 404, not 403: never confirm the existence of a resource in another tenant.
    super(`${resource} not found`, 'not_found', 404, { resource, id });
  }
}
