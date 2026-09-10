import { createHmac } from 'node:crypto';
import { sql, type TenantTx } from '@grove/db';
import { canonicalize, CHAIN_VERSION } from './canonical';

/**
 * The tamper-evident audit chain.
 *
 * Each event's hash is an HMAC-SHA256 over its canonical content plus the previous
 * event's hash for the same organisation. Altering or removing any row breaks
 * verification from that point forward. The HMAC key (`AUDIT_CHAIN_SECRET`) means an
 * attacker with database access but not the key cannot recompute a consistent chain.
 *
 * The chain is per organisation, serialised with a transaction-scoped advisory lock,
 * so one tenant's volume never stalls another's and a per-tenant export is
 * independently verifiable.
 */

export type AuditAction =
  | 'create' | 'read' | 'update' | 'delete' | 'login' | 'login_failed' | 'logout' | 'export'
  | 'print' | 'submit' | 'post' | 'void' | 'elevate_access' | 'permission_change' | 'config_change';

export interface AuditEventInput {
  orgId: string;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | null;
  patientId?: string | null;
  practiceId?: string | null;
  actorUserId?: string | null;
  actorType?: 'user' | 'system' | 'api_client';
  actorLabel?: string | null;
  elevationId?: string | null;
  /** Field-level diff. Callers must redact PHI values before passing. */
  changes?: Record<string, unknown> | null;
  context?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
}

interface HashableRow {
  chainVersion: number;
  orgId: string;
  sequence: string;
  occurredAt: string;
  actorUserId: string | null;
  actorType: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  patientId: string | null;
  changes: unknown;
  context: unknown;
  previousHash: string | null;
}

export function computeHash(row: HashableRow, secret: string): string {
  return createHmac('sha256', secret).update(canonicalize(row)).digest('hex');
}

function secretOrThrow(): string {
  const s = process.env.AUDIT_CHAIN_SECRET;
  if (!s || s === 'replace-me') throw new Error('AUDIT_CHAIN_SECRET is not configured');
  return s;
}

/**
 * Append an event inside the caller's tenant transaction. Must be called INSIDE the
 * same transaction as the change it records, so the audit row and the change commit
 * or roll back together.
 */
export async function appendAuditEvent(tx: TenantTx, e: AuditEventInput): Promise<{ id: string; sequence: string; hash: string }> {
  const secret = secretOrThrow();

  // Serialise appends per organisation for the duration of this transaction.
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${e.orgId}))`);

  const prev = await tx.execute<{ hash: string }>(sql`
    select hash from audit_events where org_id = ${e.orgId} order by sequence desc limit 1
  `);
  const previousHash = prev[0]?.hash ?? null;

  // Reserve the sequence and timestamp first so the hash covers the real values.
  const reserved = await tx.execute<{ sequence: string; occurred_at: string }>(sql`
    select nextval(pg_get_serial_sequence('audit_events', 'sequence'))::text as sequence,
           now()::text as occurred_at
  `);
  const sequence = reserved[0]!.sequence;
  const occurredAt = reserved[0]!.occurred_at;

  const hash = computeHash(
    {
      chainVersion: CHAIN_VERSION,
      orgId: e.orgId,
      sequence,
      occurredAt,
      actorUserId: e.actorUserId ?? null,
      actorType: e.actorType ?? 'user',
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId ?? null,
      patientId: e.patientId ?? null,
      changes: e.changes ?? null,
      context: e.context ?? null,
      previousHash,
    },
    secret,
  );

  const inserted = await tx.execute<{ id: string }>(sql`
    insert into audit_events (
      sequence, org_id, occurred_at, actor_user_id, actor_type, actor_label, elevation_id,
      action, resource_type, resource_id, patient_id, practice_id, changes, context,
      ip_address, user_agent, session_id, request_id, previous_hash, hash
    ) values (
      ${sequence}::bigint, ${e.orgId}, ${occurredAt}::timestamptz, ${e.actorUserId ?? null}, ${e.actorType ?? 'user'},
      ${e.actorLabel ?? null}, ${e.elevationId ?? null}, ${e.action}, ${e.resourceType},
      ${e.resourceId ?? null}, ${e.patientId ?? null}, ${e.practiceId ?? null},
      ${e.changes ? JSON.stringify(e.changes) : null}::jsonb, ${e.context ? JSON.stringify({ ...e.context, chainVersion: CHAIN_VERSION }) : JSON.stringify({ chainVersion: CHAIN_VERSION })}::jsonb,
      ${e.ipAddress ?? null}, ${e.userAgent ?? null}, ${e.sessionId ?? null}, ${e.requestId ?? null},
      ${previousHash}, ${hash}
    ) returning id
  `);

  return { id: inserted[0]!.id, sequence, hash };
}

export interface ChainVerification {
  ok: boolean;
  checked: number;
  fromSequence: string | null;
  toSequence: string | null;
  brokenAtSequence?: string;
  reason?: string;
}

/**
 * Recompute every hash in a range and confirm each links to its predecessor. Runs on a
 * schedule; a failure is an incident, not a log line.
 */
export async function verifyChain(tx: TenantTx, orgId: string, opts: { fromSequence?: string; limit?: number } = {}): Promise<ChainVerification> {
  const secret = secretOrThrow();
  const rows = await tx.execute<{
    sequence: string; occurred_at: string; actor_user_id: string | null; actor_type: string; action: string;
    resource_type: string; resource_id: string | null; patient_id: string | null; changes: unknown; context: unknown;
    previous_hash: string | null; hash: string;
  }>(sql`
    select sequence::text, occurred_at::text, actor_user_id, actor_type, action, resource_type, resource_id,
           patient_id, changes, context, previous_hash, hash
      from audit_events
     where org_id = ${orgId}
       and sequence >= ${opts.fromSequence ?? '0'}::bigint
     order by sequence asc
     limit ${opts.limit ?? 100_000}
  `);

  if (rows.length === 0) return { ok: true, checked: 0, fromSequence: null, toSequence: null };

  let expectedPrev: string | null | undefined = undefined;
  for (const r of rows) {
    if (expectedPrev !== undefined && r.previous_hash !== expectedPrev) {
      return { ok: false, checked: rows.length, fromSequence: rows[0]!.sequence, toSequence: rows.at(-1)!.sequence, brokenAtSequence: r.sequence, reason: 'previous_hash does not match the preceding row' };
    }
    const ctx = (r.context ?? {}) as Record<string, unknown>;
    const stripped = { ...ctx };
    delete stripped['chainVersion'];
    const recomputed = computeHash(
      {
        chainVersion: Number(ctx['chainVersion'] ?? CHAIN_VERSION),
        orgId,
        sequence: r.sequence,
        occurredAt: r.occurred_at,
        actorUserId: r.actor_user_id,
        actorType: r.actor_type,
        action: r.action,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        patientId: r.patient_id,
        changes: r.changes ?? null,
        context: Object.keys(stripped).length ? stripped : null,
        previousHash: r.previous_hash,
      },
      secret,
    );
    if (recomputed !== r.hash) {
      return { ok: false, checked: rows.length, fromSequence: rows[0]!.sequence, toSequence: rows.at(-1)!.sequence, brokenAtSequence: r.sequence, reason: 'hash does not match row content' };
    }
    expectedPrev = r.hash;
  }
  return { ok: true, checked: rows.length, fromSequence: rows[0]!.sequence, toSequence: rows.at(-1)!.sequence };
}
