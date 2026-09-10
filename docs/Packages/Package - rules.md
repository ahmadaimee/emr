---
tags: [packages]
---

# @grove/rules

`packages/rules` — Claim scrubbing engine with an AST evaluator, NCCI edits, and MUE rules.

Catching a problem before submission costs a rule evaluation; catching it after costs a denial, rework, and weeks of delay — sometimes the whole claim if timely filing lapses. See [[Revenue Cycle Overview]].

ast.ts and evaluator.ts evaluate tenant-configurable rules; system-rules.ts holds built-ins; facts.ts assembles the claim facts a rule sees; npi.ts validates provider identifiers. Denial rules are configured per tenant — [[Denials and Appeals]].

---

Related: [[Packages Index]] · [[Architecture Overview]]
