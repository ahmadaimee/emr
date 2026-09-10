# Grove Architecture & Engineering Standards

Grove is a multi-tenant practice management and autonomous revenue cycle management (RCM) platform.
The core thesis is that **the revenue cycle should run itself, and pull in a human only for exceptions**.

## Non-Negotiable Rules

1. **Zero Real Patient Data**: Never commit real PHI. All seeds, fixtures, and tests must use synthetic data (e.g. Synthea-derived).
2. **Never Log PHI**: Fastify, logger, and console serializers must redact headers, tokens, passwords, SSNs, and member IDs.
3. **Always Tenant-Scoped (`withTenant`)**: There is no ambient exported `db`. Every query runs inside `withTenant`, setting transaction-local context (`SET LOCAL app.current_org`) enforced by Postgres Row-Level Security (RLS).
4. **Log Every Read of PHI**: Every query that touches patient data must call `phi.touch(patientIds, categories, count)` and flush to `phi_access_events`.
5. **Money is Integer Cents**: Never use floating-point numbers or strings that require `parseFloat`. All currency amounts are stored in cents.
6. **Append-Only Financial Ledger**: `ledger_entries` is append-only. Mistakes are corrected by compensatory reversal entries, never by mutating historical rows.
7. **Tamper-Evident Audit Trail**: Every mutating action and PHI export is appended to `audit_events` with an HMAC-SHA256 hash linked to the previous row.

## Monorepo Layout
- `apps/web`: Next.js 15 App Router operator UI (Inter, Instrument Sans, Geist Mono, Grove design tokens).
- `apps/api`: Fastify public REST API with OpenAPI v3.1 schemas generated from Zod.
- `apps/worker`: pg-boss background jobs and schedulers inside Postgres (no secondary Redis PHI datastore).
- `packages/db`: Drizzle ORM schema, migrations, RLS policies.
- `packages/x12`: ANSI ASC X12 5010 parser and generator (837P, 835, 270/271, 276/277, 999).
- `packages/clearinghouse`: Pluggable clearinghouse adapters (Stedi REST, Claim.MD, mock).
- `packages/rules`: Claim scrubbing engine with AST evaluator, NCCI edits, and MUE rules.
- `packages/forms`: CMS-1500 and UB-04 PDF rendering engines.
- `packages/reporting`: Semantic layer compiling governed metrics and dimensions to parameterized SQL.
- `packages/audit`: HMAC hash-chained audit logging and verification.

