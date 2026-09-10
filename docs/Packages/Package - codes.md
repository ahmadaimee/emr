---
tags: [packages]
---

# @grove/codes

`packages/codes` — Code set ingestion: CPT, ICD, NCCI, MUE, fee schedules.

Code sets change on published schedules; stale codes cause denials.

parsers.ts reads the published formats, cli.ts loads them. Feeds [[Package - rules]] and fee schedules in the [[Web Operator UI]].

---

Related: [[Packages Index]] · [[Architecture Overview]]
