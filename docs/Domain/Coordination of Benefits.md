---
tags: [domain, cob]
---

# Coordination of Benefits

When a patient has more than one payer, COB determines who pays first and what the next
payer is asked for.

## Secondary claim generation

`packages/domain/src/cob/generate-secondary.ts` builds the secondary claim from the
primary's remittance. The secondary payer needs to know precisely what the primary did
— its payment and its CAS adjustments ride along in the 837P, so the secondary can
adjudicate against the remaining balance rather than the original charge.

This is why a secondary claim cannot be produced until the primary 835 has posted: the
inputs literally do not exist before then. The [[Claim Lifecycle]] encodes this with
`secondary_ready`, reachable only from `paid` or `partially_paid`.

## Ordering

Which payer is primary follows coverage rules — plan type, subscriber relationship,
and, for dependents, birthday-rule style ordering. It is stored on coverage rather than
inferred per claim, so it stays consistent across a patient's claims.

## After the secondary

Whatever neither payer covers becomes `patient_responsibility`. See
[[Remittance and Payment Posting]] for how the split is posted.

---

Related: [[Revenue Cycle Overview]] · [[Money and the Ledger]]
