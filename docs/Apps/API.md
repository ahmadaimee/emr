---
tags: [apps, api, backend]
---

# API

`apps/api` — Fastify public REST API. OpenAPI 3.1 schemas are generated from Zod, so
the published contract cannot drift from what the server validates.

## Routes

`src/routes/v1/` — `claims`, `eligibility`, `remittances`, `tasks`.

## Plugins

| Plugin | Responsibility |
|---|---|
| `auth.ts` | API keys and sessions — [[Package - auth]] |
| `tenant.ts` | Resolves the tenant and wraps handlers in `withTenant` |
| `problem.ts` | RFC 7807 `application/problem+json` error responses |

## Why a tenant plugin

Tenant resolution is infrastructure, not per-route code. Centralizing it means a new
route is tenant-scoped by construction rather than by the author remembering — which,
combined with RLS failing closed, gives two independent barriers against cross-tenant
reads. See [[Multi-Tenancy and RLS]].

## Logging

Serializers redact headers, tokens, passwords, SSNs, and member ids. PHI must never
reach the log pipeline — [[Non-Negotiable Rules|rule 2]].

---

Related: [[Web Operator UI]] · [[Worker]] · [[Package - domain]]
