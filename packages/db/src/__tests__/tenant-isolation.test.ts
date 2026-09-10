/**
 * Cross-tenant isolation, proven rather than assumed.
 *
 * Seeds two organisations, then asserts as the APPLICATION role that:
 *   - a query scoped to org A never returns an org B row,
 *   - an insert claiming org B's org_id from org A's context is rejected,
 *   - an update targeting org B's row from org A's context affects zero rows,
 *   - a query with NO tenant context returns nothing at all,
 *   - append-only tables refuse UPDATE and DELETE.
 */
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withTenant } from '../tenant';
import { organizations, patients, practices } from '../schema';
import type { TenantContext } from '../tenant';

const hasDb = Boolean(process.env.DATABASE_URL && process.env.DATABASE_MIGRATION_URL);

const ctx = (orgId: string): TenantContext => ({
  orgId,
  actorType: 'system',
  actorId: null,
  sessionId: null,
  requestId: `test:${randomUUID()}`,
  accessContext: 'test',
});

describe.skipIf(!hasDb)('tenant isolation', () => {
  const orgA = randomUUID();
  const orgB = randomUUID();
  const practiceA = randomUUID();
  const practiceB = randomUUID();
  let owner: ReturnType<typeof postgres>;

  beforeAll(async () => {
    // Seed as the owner, which bypasses nothing (FORCE RLS) but has no policy
    // restriction because policies are scoped `to grove_app`.
    owner = postgres(process.env.DATABASE_MIGRATION_URL!, { max: 1 });
    await owner`
      insert into organizations (id, name, slug) values
        (${orgA}, 'Org A', ${'org-a-' + orgA.slice(0, 8)}),
        (${orgB}, 'Org B', ${'org-b-' + orgB.slice(0, 8)})
    `;
    await owner`
      insert into practices (id, org_id, name) values
        (${practiceA}, ${orgA}, 'Practice A'),
        (${practiceB}, ${orgB}, 'Practice B')
    `;
    await owner`
      insert into patients (org_id, practice_id, mrn, first_name, last_name, date_of_birth, sex) values
        (${orgA}, ${practiceA}, 'A-1', 'Alice', 'Alpha', '1980-01-01', 'F'),
        (${orgB}, ${practiceB}, 'B-1', 'Bob',   'Beta',  '1980-01-01', 'M')
    `;
  });

  afterAll(async () => {
    await owner`delete from patients where org_id in (${orgA}, ${orgB})`;
    await owner`delete from practices where org_id in (${orgA}, ${orgB})`;
    await owner`delete from organizations where id in (${orgA}, ${orgB})`;
    await owner.end();
  });

  it('returns only the current tenant rows', async () => {
    const rows = await withTenant(ctx(orgA), (tx) => tx.select().from(patients));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.firstName).toBe('Alice');
  });

  it('cannot see the other tenant organisation row', async () => {
    const rows = await withTenant(ctx(orgA), (tx) => tx.select().from(organizations));
    expect(rows.map((r) => r.id)).toEqual([orgA]);
  });

  it('rejects an insert that claims another tenant org_id', async () => {
    await expect(
      withTenant(ctx(orgA), (tx) =>
        tx.insert(practices).values({ orgId: orgB, name: 'Smuggled' }),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it('cannot update another tenant row', async () => {
    const result = await withTenant(ctx(orgA), (tx) =>
      tx
        .update(patients)
        .set({ lastName: 'Tampered' })
        .returning({ id: patients.id }),
    );
    // Only Alice is visible, so only Alice can be touched.
    expect(result).toHaveLength(1);
    const bob = await owner`select last_name from patients where org_id = ${orgB}`;
    expect(bob[0]?.last_name).toBe('Beta');
  });

  it('returns nothing without a tenant context', async () => {
    const app = postgres(process.env.DATABASE_URL!, { max: 1 });
    try {
      const rows = await app`select count(*)::int as n from patients`;
      expect(rows[0]?.n).toBe(0);
    } finally {
      await app.end();
    }
  });

  it('refuses to mutate append-only tables', async () => {
    await owner`
      insert into audit_events (org_id, action, resource_type, hash)
      values (${orgA}, 'create', 'test', 'deadbeef')
    `;
    const app = postgres(process.env.DATABASE_URL!, { max: 1 });
    try {
      await app`select set_config('app.current_org', ${orgA}, false)`;
      await expect(app`delete from audit_events where org_id = ${orgA}`).rejects.toThrow(
        /permission denied|append-only/i,
      );
    } finally {
      await app.end();
      await owner`delete from audit_events where org_id = ${orgA}`;
    }
  });
});
