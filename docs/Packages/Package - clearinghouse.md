---
tags: [packages]
---

# @grove/clearinghouse

`packages/clearinghouse` — Pluggable clearinghouse adapters.

Practices are not all on the same clearinghouse, and switching should not touch domain code.

adapter.ts is the interface; stedi.ts is the Stedi REST implementation; mock.ts backs tests and local development. Claim.MD is the other target. Used by [[Worker]] for submission and retrieval.

---

Related: [[Packages Index]] · [[Architecture Overview]]
