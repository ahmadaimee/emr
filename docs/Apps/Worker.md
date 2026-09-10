---
tags: [apps, worker, jobs]
---

# Worker

`apps/worker` — background jobs and schedulers on **pg-boss**, which runs the queue
inside Postgres itself.

## No Redis, deliberately

Queue payloads carry claim and patient identifiers. A Redis queue would be a second PHI
datastore, with its own encryption, backup, BAA, and breach-scope obligations, for no
benefit. One datastore for PHI. See [[Architecture Overview]].

A useful side effect: a job can be enqueued in the *same transaction* as the state
change that triggers it, so the two cannot diverge.

## Jobs

| Job | Purpose |
|---|---|
| `claims.ts` | Scrub, assemble, submit — [[Claim Lifecycle]] |
| `eligibility.ts` | Batch checks ahead of appointments — [[Eligibility]] |
| `remittance.ts` | Fetch and post 835s — [[Remittance and Payment Posting]] |
| `cob.ts` | Generate secondary claims — [[Coordination of Benefits]] |
| `outbox-relay.ts` | Relay outbox rows to external systems |
| `webhooks.ts` | Outbound tenant webhooks |
| `maintenance.ts` | Housekeeping and retention |

## The outbox pattern

External side effects are written to an outbox table inside the transaction that
changed state, then relayed by `outbox-relay.ts`. Without this you get the classic
split-brain: a claim marked `submitted` whose 837P never left, or a file sent twice
after a retry.

## Tenancy in jobs

Jobs have no user, so they run under `systemContext(orgId, jobName)` — still RLS-scoped,
still attributed in the audit trail. Schedulers fan out with `listOrganizationIds()`.

---

Related: [[Multi-Tenancy and RLS]] · [[Package - clearinghouse]]
