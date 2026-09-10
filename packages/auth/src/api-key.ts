import { randomBytes } from 'node:crypto';
import { bootstrap, schema, withTenant, type TenantContext } from '@grove/db';
import { hashPassword, verifyPassword } from './password';
import type { Actor } from './rbac';

/**
 * Scoped API keys: `grv_live_<public>_<secret>`. The secret is shown exactly once at
 * creation; only its Argon2id hash is stored. Keys carry scopes, optional practice
 * restriction, and an optional IP allowlist, and expire by default in a year.
 */
export const KEY_PREFIX = 'grv_live_';

export async function createApiKey(tenant: TenantContext, input: { name: string; scopes: string[]; practiceIds?: string[]; ipAllowlist?: string[]; expiresInDays?: number; apiClientId?: string; createdBy?: string }): Promise<{ id: string; key: string; publicId: string }> {
  const publicId = randomBytes(8).toString('hex');
  const secret = randomBytes(24).toString('base64url');
  const key = `${KEY_PREFIX}${publicId}_${secret}`;
  const secretHash = await hashPassword(secret);
  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 365) * 86_400_000);

  const id = await withTenant(tenant, async (tx) => {
    const [row] = await tx
      .insert(schema.apiKeys)
      .values({
        orgId: tenant.orgId, apiClientId: input.apiClientId ?? null, name: input.name, publicId, secretHash, last4: secret.slice(-4),
        scopes: input.scopes, practiceIds: input.practiceIds ?? null, ipAllowlist: input.ipAllowlist ?? null, expiresAt, createdBy: input.createdBy ?? null,
      })
      .returning({ id: schema.apiKeys.id });
    return row!.id;
  });
  return { id, key, publicId };
}

export interface ResolvedApiKey {
  tenant: TenantContext;
  actor: Actor;
  keyId: string;
  scopes: string[];
}

export async function resolveApiKey(key: string, requestId: string, remoteIp?: string): Promise<ResolvedApiKey | null> {
  if (!key.startsWith(KEY_PREFIX)) return null;
  const rest = key.slice(KEY_PREFIX.length);
  const sep = rest.indexOf('_');
  if (sep < 0) return null;
  const publicId = rest.slice(0, sep);
  const secret = rest.slice(sep + 1);

  const row = await bootstrap.apiKey(publicId);
  if (!row || row.revoked_at || row.expires_at < new Date()) return null;
  if (!(await verifyPassword(row.secret_hash, secret))) return null;
  if (row.ip_allowlist && row.ip_allowlist.length && remoteIp && !row.ip_allowlist.includes(remoteIp)) return null;

  const tenant: TenantContext = { orgId: row.org_id, actorType: 'api_client', actorId: row.key_id, sessionId: null, requestId, accessContext: `api_key:${row.key_id}` };
  const actor: Actor = {
    userId: row.key_id,
    orgId: row.org_id,
    grants: row.scopes.map((s) => {
      const [resource = '*', action = '*'] = s.split(':');
      return { resource, action };
    }),
    // A key with no practice restriction may touch every practice in the org.
    practiceIds: row.practice_ids ?? [],
    elevation: row.practice_ids ? null : { id: `api_key:${row.key_id}`, practiceIds: '*', expiresAt: row.expires_at },
    // API keys are machine credentials; step-up does not apply, but sensitive scopes
    // require admin approval at creation time instead.
    mfaSatisfiedAt: new Date(),
  };
  return { tenant, actor, keyId: row.key_id, scopes: row.scopes };
}
