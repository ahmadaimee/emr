---
tags: [domain, claims]
---

# Claim Lifecycle

A claim is a state machine. `packages/domain/src/claims/lifecycle.ts` holds the
transition table, and `transitionClaim()` is the **only** way status changes.

> Anything not listed is a bug or an attack, and throws.

An illegal transition raises `DomainError('invalid_transition', 409)` rather than
quietly writing the new status. Every accepted transition also appends a row to
`claim_state_transitions` recording the `from`, `to`, trigger, and reason.

## Triggers

A transition is attributed to one of: `user`, `system`, `era`, `ack`, `status_check`.
This is how the timeline in the [[Web Operator UI]] can say *why* a claim moved, and
how automated movement is distinguished from operator action.

## States

**Pre-submission** — `draft` → `scrubbing` → `needs_review` / `ready` → `queued`

`needs_review` is the exception state feeding the operator queue
([[Automation and Exceptions]]). `ready` means scrubbed clean and awaiting batching.

**In flight** — `submitted` → `acknowledged` → `in_process`

Set when the 837P leaves and the 999/277CA come back. See [[X12 Transactions]].

**Resolved** — `paid`, `partially_paid`, `denied`, `rejected`

`rejected` differs from `denied`: a rejection never reached adjudication (a format or
eligibility problem), so it can be corrected and resubmitted — it transitions back to
`scrubbing`. A denial *was* adjudicated and must be appealed. See [[Denials and Appeals]].

**Downstream** — `secondary_ready` → `secondary_submitted` ([[Coordination of Benefits]]),
`patient_responsibility`, `appealed`, `closed`

**Terminal** — `voided`

`voided` is reachable from almost every state because a void is a correction of record,
not a workflow step. `closed` can still be voided; `voided` goes nowhere.

## Timestamps

`transitionClaim` stamps `submittedAt`, `acknowledgedAt`, and `closedAt` as the
corresponding states are entered, so aging and days-in-AR are derived from the
transition itself rather than recomputed later.

---

Related: [[Revenue Cycle Overview]] · [[Package - domain]] · [[Package - rules]]
