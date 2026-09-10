---
tags: [packages, moc]
---

# Packages Index

Eleven `@grove/*` libraries under `packages/`. Dependencies point inward and never
cycle — see [[Architecture Overview]].

## Data and operations

- [[Package - db]] — Drizzle schema, migrations, RLS. The only database access.
- [[Package - domain]] — business operations; every state change goes through here.

## Pure libraries

Side-effect free. No database, no network — which is what makes them exhaustively
testable.

- [[Package - x12]] — ANSI ASC X12 5010 parse and generate
- [[Package - rules]] — claim scrubbing engine, NCCI and MUE edits
- [[Package - forms]] — CMS-1500 / UB-04 PDF rendering
- [[Package - reporting]] — governed metrics compiled to SQL
- [[Package - codes]] — code set ingestion

## Cross-cutting

- [[Package - audit]] — hash-chained audit and PHI access logging
- [[Package - auth]] — sessions, RBAC, TOTP, API keys
- [[Package - clearinghouse]] — pluggable clearinghouse adapters
- [[Package - ui]] — design tokens and primitives

---

Related: [[Monorepo Layout]]
