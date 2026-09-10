---
tags: [architecture, reference]
---

# Monorepo Layout

pnpm workspaces + Turborepo. Node >= 24, pnpm >= 10.

## Apps

| Path | Package | Notes |
|---|---|---|
| `apps/web` | `@grove/web` | [[Web Operator UI]] — Next.js 16 App Router |
| `apps/api` | `@grove/api` | [[API]] — Fastify REST, OpenAPI 3.1 from Zod |
| `apps/worker` | `@grove/worker` | [[Worker]] — pg-boss jobs and schedulers |

## Packages

See [[Packages Index]] for a note on each.

| Path | Purpose |
|---|---|
| `packages/db` | Drizzle schema, migrations, RLS policies |
| `packages/domain` | Business operations over the schema |
| `packages/x12` | ANSI ASC X12 5010 parse/generate |
| `packages/clearinghouse` | Pluggable clearinghouse adapters |
| `packages/rules` | Claim scrubbing engine, NCCI/MUE edits |
| `packages/forms` | CMS-1500 / UB-04 PDF rendering |
| `packages/reporting` | Semantic layer: metrics → SQL |
| `packages/audit` | HMAC hash-chained audit logging |
| `packages/auth` | Sessions, RBAC, TOTP, API keys |
| `packages/codes` | Code set ingestion (CPT, ICD, NCCI) |
| `packages/ui` | Design tokens and shared primitives |

## Infra

| Path | Purpose |
|---|---|
| `docker-compose.yml` | Local Postgres, MinIO, Mailpit |
| `infra/postgres/init` | Extension bootstrap SQL |
| `docs/` | This vault |

## Root scripts

```bash
pnpm dev          # turbo run dev --parallel
pnpm verify       # typecheck && lint && test
pnpm db:migrate   # apply migrations
pnpm db:seed      # synthetic seed data
pnpm db:check-rls # assert RLS coverage
pnpm infra:up     # docker compose up -d
```

`pnpm verify` is the gate to run before committing. See [[Local Development]].

---

Related: [[Architecture Overview]]
