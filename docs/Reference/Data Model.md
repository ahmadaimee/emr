---
tags: [reference, database]
---

# Data Model

Drizzle ORM. Schema modules live in `packages/db/src/schema/`, migrations in
`packages/db/migrations/`, RLS policies alongside them.

## Schema modules

| Module | Holds |
|---|---|
| `tenancy.ts` | Organizations and practices — the root of every scope |
| `identity.ts` | Users, roles, sessions |
| `patients.ts` | Demographics, MRNs, merge state |
| `coverage.ts` | Payer coverage, subscribers, COB order |
| `payers.ts` | Payer directory and payer-specific config |
| `encounters.ts` | Visits, diagnoses, procedures |
| `claims.ts` | Claims, lines, state transitions |
| `eligibility.ts` | 270/271 checks and parsed benefits |
| `remittance.ts` | 835 headers, claim payments, CAS adjustments |
| `payments.ts` | Patient and payer payments |
| `ledger.ts` | Append-only `ledger_entries` — [[Money and the Ledger]] |
| `codes.ts` | CPT, ICD, NCCI, MUE, fee schedules |
| `rules.ts` | Scrubbing and denial rules — [[Package - rules]] |
| `workflow.ts` | Tasks and queues — [[Automation and Exceptions]] |
| `audit.ts` | `audit_events`, `phi_access_events` — [[Audit and PHI Access]] |
| `platform.ts` | Outbox, webhooks, job bookkeeping |
| `_shared.ts`, `_types.ts` | Common column builders and enums |

## Conventions

- Nearly every table carries `org_id` and an RLS policy — [[Multi-Tenancy and RLS]]
- Money columns are integer cents, suffixed `...Cents` — [[Money and the Ledger]]
- Enums (claim status, actor type, adjustment group) live in `_types.ts` and are the
  source of truth for the corresponding TypeScript unions

## Commands

```bash
pnpm db:generate    # generate migration from schema changes
pnpm db:migrate     # apply
pnpm db:seed        # synthetic seed data only
pnpm db:reset       # drop, migrate, seed
pnpm db:check-rls   # fail if a tenant table lacks a policy
```

Adding a tenant-scoped table means adding its RLS policy in the same change, or
`db:check-rls` fails — which is the intent.

---

Related: [[Package - db]] · [[Local Development]]
