---
tags: [domain, money, accounting]
---

# Money and the Ledger

Two invariants govern every financial number in Grove. Both are in
[[Non-Negotiable Rules]] because both are unfixable after the fact.

## Integer cents, always

All currency is stored and computed as integer cents. Never floats, never strings
needing `parseFloat`.

Binary floating point cannot represent most decimal fractions exactly. Summing
thousands of line items in floats produces a total that is *close* — and a reconciliation
that is off by cents is indistinguishable, to an auditor, from one that is off because
something is wrong. Integers make arithmetic exact.

Formatting to dollars happens at the display edge only (`apps/web/src/lib/format.ts`).

## Append-only ledger

`ledger_entries` is append-only. A mistake is corrected by posting a **compensatory
reversal entry**, never by updating or deleting the original row.

This preserves history: the record shows that a charge was posted and later reversed,
which is the truth, rather than showing a charge that appears never to have existed.
Mutable financial history cannot be audited, and it interacts badly with the
tamper-evident chain in [[Audit and PHI Access]].

`packages/domain/src/ledger/post.ts` is the single entry point.

## What lands in the ledger

Charges at claim assembly, payer payments and adjustments at
[[Remittance and Payment Posting]], patient payments, and write-offs from
[[Denials and Appeals]]. AR is derived from the ledger — it is not a stored field that
could drift.

---

Related: [[Revenue Cycle Overview]] · [[Data Model]]
