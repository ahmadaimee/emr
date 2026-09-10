---
tags: [domain, eligibility]
---

# Eligibility

Verifying that coverage is active and knowing what it will pay, *before* the visit —
the cheapest point at which a downstream denial can be prevented.

## Flow

A 270 inquiry goes to the payer through the clearinghouse; a 271 response comes back
with coverage, plan dates, and benefit detail. See [[X12 Transactions]].

- `packages/domain/src/eligibility/run-check.ts` — single check
- `packages/domain/src/eligibility/batch.ts` — sweep upcoming appointments
- `packages/domain/src/eligibility/diff.ts` — compare the response to what is on file

## The diff is the point

Running a check is easy; noticing that it *changed something* is the valuable part.
`diff.ts` compares the 271 against stored coverage and surfaces material differences —
a terminated plan, a new member id, a changed copay or deductible.

Only material differences become tasks ([[Automation and Exceptions]]). A response that
merely confirms what was already on file is recorded and requires no attention. This
keeps the queue meaningful rather than a stream of no-ops.

## Batch checks

Eligibility is swept ahead of scheduled appointments by [[Worker]], so problems surface
while there is still time to fix them — a patient can be called before the visit rather
than balance-billed after it.

---

Related: [[Revenue Cycle Overview]] · [[Claim Lifecycle]] · [[Package - clearinghouse]]
