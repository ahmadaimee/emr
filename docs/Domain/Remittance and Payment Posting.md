---
tags: [domain, remittance, money]
---

# Remittance and Payment Posting

The 835 Electronic Remittance Advice is the payer explaining what it paid and what it
did not. Posting it is where claims meet [[Money and the Ledger]].

## Ingestion

`packages/x12/src/parsers/835.ts` parses the file; `packages/domain/src/remittance/post.ts`
applies it. For each claim payment the 835 carries:

- the paid amount
- **CAS adjustments** — reason-coded reductions (contractual write-off, deductible,
  coinsurance, denial)
- patient responsibility amounts
- a claim status code

## Adjustments are not one thing

The distinction that matters: a **contractual adjustment** is revenue the practice
agreed never to collect, and is written off. **Patient responsibility** is revenue that
moves to the patient, not lost. Collapsing the two misstates AR — the practice would
either chase money it agreed to forgo, or silently lose money it was owed. Each CAS
group code is posted to a different ledger treatment.

## Matching

Remittances arrive keyed by the payer's own identifiers and must be matched back to
claims. Unmatched lines become exceptions rather than being force-fitted — posting cash
to the wrong claim is harder to unwind than leaving it unposted, and the ledger is
[[Non-Negotiable Rules|append-only]].

## After posting

Posting drives the next transition in the [[Claim Lifecycle]]: `paid`,
`partially_paid`, or `denied`, and from there to [[Coordination of Benefits]] or
patient responsibility.

---

Related: [[Revenue Cycle Overview]] · [[Denials and Appeals]] · [[X12 Transactions]]
