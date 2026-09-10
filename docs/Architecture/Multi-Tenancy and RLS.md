---
tags: [architecture, security, tenancy]
---

# Multi-Tenancy and RLS

Grove is multi-tenant on shared tables. Isolation is enforced by **Postgres Row-Level
Security**, not by application `WHERE` clauses — because a forgotten `WHERE` is a
cross-tenant PHI leak, and RLS fails closed instead.

## There is no ambient `db`

`@grove/db` deliberately does not export a ready-to-use connection. The only way to
reach the database is `withTenant`:

```ts
await withTenant(tenantContext, async (tx) => {
  // every query in here runs with app.current_org set
});
```

`withTenant` opens a transaction and issues `SET LOCAL app.current_org = $1` before
running the callback. RLS policies on every tenant-scoped table compare `org_id`
against that setting, so a query that forgets to filter by org returns *nothing* rather
than another tenant's rows.

## Why `SET LOCAL` with bind parameters

Two properties matter:

1. **`LOCAL`** scopes the setting to the transaction. A pooled connection handed to the
   next request cannot inherit a previous tenant's context.
2. **Bind parameters** — the org id is passed as a parameter, never interpolated. This
   is noted explicitly in `packages/db/src/tenant.ts` because `SET LOCAL app.current_org = '...'`
   built by string concatenation would be injectable.

## System contexts

Background work has no user, but still needs a tenant. `systemContext(orgId, jobName)`
produces a `TenantContext` with an actor type of `system`, so [[Worker]] jobs are
subject to the same RLS and still attribute their actions in the audit trail.
`listOrganizationIds()` exists for schedulers that must fan out across all tenants —
it is one of the few deliberately cross-tenant reads.

## Verifying coverage

```bash
pnpm db:check-rls
```

`packages/db/src/tools/check-rls-coverage.ts` asserts that every tenant-scoped table
actually has a policy. A new table without one fails the check rather than silently
shipping unprotected. `packages/db/src/__tests__/tenant-isolation.test.ts` proves
isolation behaviourally by attempting cross-tenant reads.

---

Related: [[Non-Negotiable Rules]] · [[Data Model]] · [[Audit and PHI Access]]
