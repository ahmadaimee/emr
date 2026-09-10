---
tags: [domain, moc]
---

# Revenue Cycle Overview

The path a dollar takes, from a patient booking a visit to cash landing and the balance
reaching zero. Each stage links to its own note.

```
  Patient + Coverage
        │
        ▼
  ┌───────────────┐
  │ Eligibility   │  270 out / 271 back — is coverage active, what will it cover?
  └───────┬───────┘
          ▼
  ┌───────────────┐
  │ Encounter     │  the visit; diagnoses and procedures coded
  └───────┬───────┘
          ▼
  ┌───────────────┐
  │ Claim assembly│  charges priced from the fee schedule
  └───────┬───────┘
          ▼
  ┌───────────────┐
  │ Scrubbing     │  NCCI / MUE / payer edits — fix before the payer sees it
  └───────┬───────┘
          ▼
  ┌───────────────┐
  │ Submission    │  837P via clearinghouse; 999 + 277CA acknowledge
  └───────┬───────┘
          ▼
  ┌───────────────┐
  │ Adjudication  │  payer decides; 276/277 to chase silence
  └───────┬───────┘
          ▼
  ┌───────────────┐
  │ Remittance    │  835 ERA — payments and adjustments posted to the ledger
  └───────┬───────┘
          ├──────────────► Denied ──► appeal or write off
          ├──────────────► Secondary payer (COB)
          └──────────────► Patient responsibility ──► statement, payment
```

## Why scrubbing sits before submission

A denial costs far more than an edit. Rework means staff time, a resubmission, and
weeks of delay — and some denials become uncollectable once timely-filing windows
close. Catching the same problem pre-submission costs a rule evaluation. That economics
is why [[Package - rules]] exists as a first-class package rather than a validation
afterthought.

## Stage notes

- [[Eligibility]] — coverage verification
- [[Claim Lifecycle]] — the state machine spanning assembly through closure
- [[Remittance and Payment Posting]] — 835 ingestion and cash application
- [[Denials and Appeals]] — when the payer says no
- [[Coordination of Benefits]] — when there is more than one payer
- [[Money and the Ledger]] — how every one of these moves is recorded

---

Related: [[Automation and Exceptions]] · [[X12 Transactions]]
