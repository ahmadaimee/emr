---
tags: [packages]
---

# @grove/audit

`packages/audit` — HMAC hash-chained audit logging and PHI access verification.

See [[Audit and PHI Access]] for why the chain exists.

canonical.ts gives deterministic serialization so the same event always hashes identically; chain.ts links and verifies; phi-access.ts buffers phi.touch() calls; activity.ts renders human-readable timelines.

---

Related: [[Packages Index]] · [[Architecture Overview]]
