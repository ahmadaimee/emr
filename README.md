# Grove

Multi-tenant practice management and revenue cycle platform.

Grove is built for a billing company running RCM across many client practices. The
organising principle is that **the revenue cycle should run itself, and pull in a human
only for exceptions**.

## Before you start

**Move this repository out of OneDrive.** OneDrive's sync engine fights `node_modules`
(hundreds of thousands of small files), corrupts `.git` under concurrent writes, and holds
file locks that break installs and migrations. Put it somewhere like `C:\dev\grove`.

## Prerequisites

- **Node.js 24 LTS** — https://nodejs.org (22 is in maintenance and ends April 2027)
- **pnpm 10+** — `corepack enable && corepack prepare pnpm@latest --activate`
- **Docker Desktop** — https://docker.com/products/docker-desktop

## Getting started

```bash
cp .env.example .env      # then fill in the replace-me secrets
pnpm install
pnpm infra:up             # postgres, minio, mailpit
pnpm db:migrate           # schema + row-level security policies + audit triggers
pnpm db:check-rls         # proves every table is isolated; also runs in CI
pnpm db:seed              # synthetic patients only — never real PHI
pnpm dev
```

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| Public API | http://localhost:3001 |
| API docs | http://localhost:3001/docs |
| Mail catcher | http://localhost:8025 |
| Object storage console | http://localhost:9001 |

## Layout

```
apps/web       Next.js operator UI
apps/api       Fastify public REST API
apps/worker    pg-boss processors and schedulers

packages/db             Drizzle schema, migrations, RLS policies, seeds
packages/x12            X12 5010 parser and generator
packages/clearinghouse  Swappable payer-connectivity adapters (Stedi, Claim.MD, mock)
packages/rules          Claim scrubbing rules engine
packages/forms          CMS-1500 and UB-04 renderers
packages/codes          ICD-10, CPT/HCPCS, NCCI, MUE, POS, taxonomy
packages/reporting      Semantic layer for the report builder
packages/audit          Hash-chained audit and activity events
packages/ui             Grove design system
packages/sdk            Generated TypeScript API client
```

## Why there is no Redis

Job payloads carry claim and patient identifiers. Putting those in Redis creates a second
PHI datastore with its own encryption, backup, BAA and breach-scope obligations. Queues
run on pg-boss inside Postgres instead: one datastore for PHI, transactional enqueue via
the outbox, and nothing to reconcile.

## Handling PHI

Rules that are not negotiable in this codebase:

1. **Never commit real patient data.** Seeds are synthetic. Fixtures are synthetic.
2. **Never log PHI.** The logger redacts by default; do not defeat it.
3. **There is no exported `db`.** Every query runs inside `withTenant`, which sets the
   transaction-local tenant context that RLS policies and audit triggers read.
4. **The app connects as `grove_app`** — a non-owner, `NOBYPASSRLS` role. Table owners
   and superusers bypass RLS; that is why the app is neither.
5. **Every read of PHI is logged**, not just writes. See `phi_access_events`.
6. **Money is integer cents.** Never a float, never a string someone will `parseFloat`.
7. **The ledger is append-only.** Mistakes are reversed, never edited.

## Verification

```bash
pnpm verify        # typecheck + lint + unit/integration tests
pnpm db:check-rls  # structural tenant-isolation gate
pnpm test:e2e      # Playwright, full claim lifecycle
```
