---
tags: [packages, domain]
---

# @grove/domain

`packages/domain` — the business operations. Apps call into this; it calls into
[[Package - db]].

Every function takes a `CommandContext` (`src/context.ts`) carrying the tenant, the
actor, the transaction, and a `now()` clock. Injecting time keeps operations
deterministic under test. Failures raise `DomainError` with a code and HTTP status,
which [[API]] renders as RFC 7807.

| Area | Notes |
|---|---|
| `claims/` | assembly, create, lifecycle, scrub, submit — [[Claim Lifecycle]] |
| `eligibility/` | run-check, batch, diff — [[Eligibility]] |
| `remittance/post.ts` | [[Remittance and Payment Posting]] |
| `denials/classify.ts` | [[Denials and Appeals]] |
| `cob/generate-secondary.ts` | [[Coordination of Benefits]] |
| `ledger/post.ts` | [[Money and the Ledger]] |
| `tasks/create.ts` | [[Automation and Exceptions]] |
| `outbox.ts` | transactional external side effects — [[Worker]] |

Keeping writes here is what lets a state transition, its ledger entries, its audit row,
and its outbox message commit atomically.

---

Related: [[Architecture Overview]] · [[Packages Index]]
