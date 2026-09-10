---
tags: [packages]
---

# @grove/auth

`packages/auth` — Sessions, RBAC, TOTP, API keys, password hashing.

Authorization is a grant model, not a role string check — an actor carries scopes and practice ids that RBAC evaluates.

rbac.ts and permissions.ts evaluate grants; session.ts and login.ts handle web sessions; totp.ts covers MFA; api-key.ts authenticates [[API]] clients.

---

Related: [[Packages Index]] · [[Architecture Overview]]
