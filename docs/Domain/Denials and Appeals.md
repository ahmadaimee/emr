---
tags: [domain, denials]
---

# Denials and Appeals

A denial is the payer adjudicating a claim and refusing payment. It is not the same as
a **rejection**, which never reached adjudication — see [[Claim Lifecycle]].

## Classification

`packages/domain/src/denials/classify.ts` turns raw CARC/RARC codes from the 835 into
an actionable category. The raw codes are too granular and too inconsistent across
payers to route on directly.

Classification decides the disposition:

- **Correctable** — coding or data error; fix and resubmit
- **Appealable** — clinically or contractually disputable; needs documentation
- **Write-off** — genuinely not payable; stop spending staff time on it
- **Patient responsibility** — moves to the patient rather than being lost

## Why the write-off branch matters

Chasing an uncollectable denial costs more than it recovers. Deciding *not* to pursue is
as much a product feature as pursuing well — it is what keeps operator attention on the
denials that will actually turn into cash.

## Denial rules

Tenants configure denial handling in **Settings → Rules & Denial Engine** in the
[[Web Operator UI]], so a practice can encode "this payer always denies X the first
time, resubmit with Y" as a rule rather than as staff folklore.

Appeals move the claim to `appealed`, from which it can reach `paid`, `partially_paid`,
`denied`, or `closed`.

---

Related: [[Remittance and Payment Posting]] · [[Package - rules]] · [[Automation and Exceptions]]
