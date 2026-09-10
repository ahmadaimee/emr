---
tags: [architecture, domain]
---

# Automation and Exceptions

The product thesis is that the revenue cycle runs itself and escalates only exceptions.
That shapes the architecture: the default path is automated, and human attention is a
scarce resource that the system must *justify* spending.

## The exception queue is the product surface

Work that cannot proceed automatically becomes a task ([[Package - domain|tasks/create.ts]])
and lands in the operator queue. An operator's day is the queue, not a list of claims.

Tasks are created when — and only when — automation is genuinely blocked:

- A claim fails scrubbing with an edit a machine cannot resolve ([[Package - rules]])
- A denial classifies to a reason requiring judgment ([[Denials and Appeals]])
- Eligibility comes back materially different from what was on file ([[Eligibility]])
- A remittance cannot be matched to a claim ([[Remittance and Payment Posting]])

## Automation settings are per-tenant

**Settings → Automation** controls how far the system goes without asking. This is a
deliberate trust dial: a practice new to Grove starts with more review steps, then
widens automation as confidence grows.

## Design rule

When adding a step, the question is not "should a human confirm this?" but "what does a
human know here that the system does not?" If the answer is nothing, automate it and
record it in the audit chain. If the answer is real, create a task with enough context
that the operator can decide without going hunting.

---

Related: [[Revenue Cycle Overview]] · [[Web Operator UI]] · [[Claim Lifecycle]]
