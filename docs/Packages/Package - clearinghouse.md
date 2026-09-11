---
tags: [packages]
---

# @grove/clearinghouse

`packages/clearinghouse` — Pluggable clearinghouse adapters.

Practices are not all on the same clearinghouse, and switching should not touch domain code.

adapter.ts is the interface; stedi.ts is the Stedi REST implementation; mock.ts backs tests and local development. Claim.MD is the other target. Used by [[Worker]] for submission and retrieval.

Polling is the default delivery mode for every transaction; `apps/api`'s
`POST /v1/webhooks/stedi` accelerates it by telling the worker to poll immediately
instead of waiting out its schedule. See [[Clearinghouse Setup]] for credentials,
environment variables, and configuring the webhook.

---

Related: [[Packages Index]] · [[Architecture Overview]] · [[Clearinghouse Setup]]
