---
tags: [packages, database]
---

# @grove/db

`packages/db` — Drizzle ORM schema, migrations, and Row-Level Security policies. The
sole database boundary.

Exports no ambient connection. Access is through `withTenant` only, which is what makes
[[Multi-Tenancy and RLS]] enforceable rather than aspirational.

- `src/schema/` — table definitions, see [[Data Model]]
- `src/tenant.ts` — `withTenant`, `systemContext`, `listOrganizationIds`
- `src/tools/check-rls-coverage.ts` — fails if a tenant table lacks a policy
- `src/seed/` — synthetic seed data
- `src/__tests__/tenant-isolation.test.ts` — proves isolation behaviourally

---

Related: [[Package - domain]] · [[Packages Index]]
