import { STEP_UP_REQUIRED, type Permission } from './permissions';

/**
 * Authorization engine: RBAC for what a role may do, plus practice scoping for
 * minimum-necessary access, plus optional ABAC constraints on a grant.
 *
 * Pure and synchronous. The transport loads the actor once per request; every check
 * after that is an in-memory lookup.
 */

export interface Grant {
  resource: string;
  action: string;
  /** e.g. { maxClaimAmountCents: 500000 } */
  constraints?: Record<string, unknown> | null;
}

export interface Elevation {
  id: string;
  /** Practices reachable under this elevation. `'*'` for all in the org. */
  practiceIds: string[] | '*';
  expiresAt: Date;
}

export interface Actor {
  userId: string;
  orgId: string;
  grants: Grant[];
  /** Practices this user is assigned to. Empty means none. */
  practiceIds: string[];
  elevation?: Elevation | null;
  /** When the session last satisfied MFA. Drives step-up. */
  mfaSatisfiedAt?: Date | null;
}

export interface ResourceScope {
  practiceId?: string | null;
  /** Attributes evaluated against grant constraints. */
  attributes?: Record<string, unknown>;
}

export interface Decision {
  allowed: boolean;
  /** Present when denied. */
  reason?: 'no_grant' | 'practice_out_of_scope' | 'constraint_failed' | 'step_up_required' | 'elevation_expired';
  /** Which grant permitted the action, for the audit record. */
  grant?: Grant;
  viaElevation?: string;
}

export function can(actor: Actor, permission: Permission, scope: ResourceScope = {}, now: Date = new Date(), freshMinutes = 5): Decision {
  const [resource, action] = permission.split(':') as [string, string];

  const grant = actor.grants.find(
    (g) => (g.resource === '*' || g.resource === resource) && (g.action === '*' || g.action === action),
  );
  if (!grant) return { allowed: false, reason: 'no_grant' };

  // Practice scoping. A resource with a practice must be within the actor's assigned
  // practices, or within an active elevation. Resources without a practice (org-level
  // settings) skip this check.
  let viaElevation: string | undefined;
  if (scope.practiceId) {
    const assigned = actor.practiceIds.includes(scope.practiceId);
    if (!assigned) {
      const el = actor.elevation;
      if (!el) return { allowed: false, reason: 'practice_out_of_scope' };
      if (el.expiresAt.getTime() <= now.getTime()) return { allowed: false, reason: 'elevation_expired' };
      if (el.practiceIds !== '*' && !el.practiceIds.includes(scope.practiceId)) {
        return { allowed: false, reason: 'practice_out_of_scope' };
      }
      viaElevation = el.id;
    }
  }

  if (grant.constraints && !constraintsSatisfied(grant.constraints, scope.attributes ?? {})) {
    return { allowed: false, reason: 'constraint_failed', grant };
  }

  if (STEP_UP_REQUIRED.has(permission)) {
    const satisfied = actor.mfaSatisfiedAt && now.getTime() - actor.mfaSatisfiedAt.getTime() <= freshMinutes * 60_000;
    if (!satisfied) return { allowed: false, reason: 'step_up_required', grant };
  }

  return { allowed: true, grant, viaElevation };
}

/**
 * Constraint semantics, kept small and named. User-editable authorisation LOGIC is a
 * footgun; user-editable authorisation VALUES against a fixed set of predicates is not.
 */
function constraintsSatisfied(constraints: Record<string, unknown>, attrs: Record<string, unknown>): boolean {
  for (const [key, limit] of Object.entries(constraints)) {
    switch (key) {
      case 'maxClaimAmountCents':
      case 'maxPaymentAmountCents':
      case 'maxWriteOffCents': {
        const value = attrs[key.replace(/^max/, '').replace(/^./, (c) => c.toLowerCase())];
        if (typeof value === 'number' && typeof limit === 'number' && value > limit) return false;
        break;
      }
      case 'payerTypes': {
        const t = attrs['payerType'];
        if (Array.isArray(limit) && typeof t === 'string' && !limit.includes(t)) return false;
        break;
      }
      case 'ownOnly': {
        if (limit === true && attrs['ownerUserId'] !== attrs['actorUserId']) return false;
        break;
      }
      default:
        // Unknown constraint keys fail closed.
        return false;
    }
  }
  return true;
}

export class ForbiddenError extends Error {
  constructor(
    public readonly permission: Permission,
    public readonly decision: Decision,
  ) {
    super(`Forbidden: ${permission} (${decision.reason})`);
    this.name = 'ForbiddenError';
  }
}

/** Throwing variant for command handlers. */
export function assertCan(actor: Actor, permission: Permission, scope: ResourceScope = {}): Decision {
  const d = can(actor, permission, scope);
  if (!d.allowed) throw new ForbiddenError(permission, d);
  return d;
}
