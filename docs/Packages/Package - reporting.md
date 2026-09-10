---
tags: [packages]
---

# @grove/reporting

`packages/reporting` — Semantic layer compiling governed metrics and dimensions to parameterized SQL.

Metrics are defined once and compiled, so "days in AR" means the same thing on every screen instead of being re-derived per query.

model.ts defines metrics and dimensions; compiler.ts emits parameterized SQL. Parameterized, so a report cannot become an injection vector, and RLS still applies — [[Multi-Tenancy and RLS]].

---

Related: [[Packages Index]] · [[Architecture Overview]]
