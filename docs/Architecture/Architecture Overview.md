---
tags: [architecture]
---

# Architecture Overview

Grove is a pnpm + Turborepo monorepo. Three deployable apps sit on top of eleven
shared packages, all backed by a single Postgres database.

```
        ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
        │  apps/web    │   │  apps/api    │   │ apps/worker  │
        │ Next.js 16   │   │  Fastify     │   │  pg-boss     │
        │ operator UI  │   │  REST/OpenAPI│   │  jobs        │
        └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
               │                  │                  │
               └──────────────────┼──────────────────┘
                                  │
                   ┌──────────────▼───────────────┐
                   │  @grove/domain               │  business operations
                   ├──────────────────────────────┤
                   │ rules · x12 · forms · codes  │  pure libraries
                   │ clearinghouse · reporting    │
                   │ audit · auth · ui            │
                   ├──────────────────────────────┤
                   │  @grove/db (Drizzle + RLS)   │  the only DB access
                   └──────────────┬───────────────┘
                                  │
                        ┌─────────▼─────────┐
                        │    Postgres 17    │
                        │  RLS + pg-boss    │
                        └───────────────────┘
```

## One datastore for PHI

There is deliberately **no Redis**. Job queues run on pg-boss *inside Postgres*, because
queue payloads carry claim and patient identifiers. Putting those in Redis would create
a second PHI datastore with its own encryption, backup, BAA, and breach-scope
obligations, for no benefit. See [[Local Development]].

## Layering

Dependencies point inward and never cycle:

- **Apps** own transport, session, and presentation. They do not contain business rules.
- **`@grove/domain`** owns operations that change state — create a claim, post a
  remittance, run eligibility. Every function takes a `CommandContext` carrying the
  tenant, the actor, and the transaction.
- **Pure packages** ([[Package - x12]], [[Package - rules]], [[Package - forms]],
  [[Package - reporting]], [[Package - codes]]) are side-effect free. They parse,
  evaluate, render, and compile. They never reach the database, which is what makes
  them cheap to test exhaustively.
- **`@grove/db`** is the sole database boundary and enforces [[Multi-Tenancy and RLS]].

## Writes go through the domain

An app never writes to a table directly. Writes flow through `@grove/domain` so that
state transitions ([[Claim Lifecycle]]), ledger postings ([[Money and the Ledger]]),
and the audit chain ([[Audit and PHI Access]]) happen together in one transaction, or
not at all.

## Asynchrony via outbox

Side effects that leave the system — clearinghouse submissions, webhooks — are written
to an outbox table in the same transaction as the state change, then relayed by
[[Worker]]. This avoids the classic failure where a claim is marked submitted but the
submission never left, or vice versa.

---

Related: [[Non-Negotiable Rules]] · [[Monorepo Layout]] · [[Revenue Cycle Overview]]
