---
tags: [reference, x12, edi]
---

# X12 Transactions

Healthcare EDI runs on ANSI ASC X12 5010. `@grove/x12` ([[Package - x12]]) implements
the subset Grove needs, in both directions.

## The set

| Txn | Direction | Meaning | Code |
|---|---|---|---|
| **270** | out | Eligibility inquiry | `generators/270.ts` |
| **271** | in | Eligibility response | `parsers/271.ts` |
| **837P** | out | Professional claim | `generators/837p.ts` |
| **837I** | out | Institutional claim (the UB-04 on the wire) | `generators/837i.ts` |
| **835** | in | Remittance advice (ERA) | `parsers/835.ts` |
| **999** | in | Functional acknowledgement — was the file syntactically valid? | |
| **277CA** | in | Claim acknowledgement — did the payer accept the claim? | |
| **276/277** | out/in | Claim status inquiry and response | |

## Two acknowledgements, two meanings

A **999** says the interchange parsed. A **277CA** says the payer accepted the claim
into adjudication. A file can pass the 999 and still have every claim rejected at the
277CA — which is why [[Claim Lifecycle]] distinguishes `acknowledged` from `submitted`,
and `rejected` from `denied`.

## Professional and institutional are not the same transaction

The 837I is not the 837P with different loop names. Three differences drive the rest:

- Lines are **SV2** and keyed on a **revenue code**; the HCPCS is supporting detail.
- Everything the UB-04 holds in its code boxes — condition, occurrence, value and span
  codes, procedures, the DRG — rides in **HI** segments rather than dedicated ones, and
  the present-on-admission indicator sits in the *ninth* component of the diagnosis.
- The **type of bill** drives CLM05: its middle digits are the facility code and its last
  digit the claim frequency, so a replacement bill is a change of TOB rather than a
  separate field. See [[Package - forms]] for the paper form.

## Structure

Hierarchical and delimiter-driven, not positional: an interchange (ISA/IEA) wraps
functional groups (GS/GE) wrapping transaction sets (ST/SE). Delimiters are declared in
the ISA header rather than fixed, so the tokenizer reads them from the file.

- `tokenizer.ts` → `segment.ts` → `envelope.ts` are the parsing layers
- `types.ts` holds the shared shapes

## Testing

Fixtures live in `packages/x12/src/__tests__/fixtures/` (`sample-271.x12`,
`sample-835.x12`). Being a pure package, X12 handling is tested exhaustively without a
database — see [[Architecture Overview]].

---

Related: [[Revenue Cycle Overview]] · [[Package - clearinghouse]]
