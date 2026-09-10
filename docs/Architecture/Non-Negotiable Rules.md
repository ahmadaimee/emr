---
tags: [architecture, rules, compliance]
---

# Non-Negotiable Rules

These seven rules are invariants, not preferences. Each exists because violating it
creates a compliance, breach, or financial-integrity problem that cannot be patched
after the fact. A change that breaks one of these is wrong even if it passes tests.

## 1. Zero real patient data

Never commit real PHI. All seeds, fixtures, and tests use synthetic data
(Synthea-derived). See [[Local Development]].

## 2. Never log PHI

Fastify, logger, and console serializers must redact headers, tokens, passwords, SSNs,
and member IDs. A log aggregator is not a BAA-covered PHI store, so PHI must never
reach one.

## 3. Always tenant-scoped

There is no ambient exported `db`. Every query runs inside `withTenant`, which sets
transaction-local context (`SET LOCAL app.current_org`) enforced by Postgres Row-Level
Security. See [[Multi-Tenancy and RLS]].

## 4. Log every read of PHI

Every query that touches patient data calls `phi.touch(patientIds, categories, count)`
and flushes to `phi_access_events`. HIPAA requires an accounting of disclosures; it
cannot be reconstructed later if it was not recorded at read time.
See [[Audit and PHI Access]].

## 5. Money is integer cents

Never use floating-point numbers, and never strings that require `parseFloat`. All
currency is stored in cents. See [[Money and the Ledger]].

## 6. Append-only financial ledger

`ledger_entries` is append-only. Mistakes are corrected by compensatory reversal
entries, never by mutating historical rows. A ledger you can edit is not a ledger.

## 7. Tamper-evident audit trail

Every mutating action and PHI export is appended to `audit_events` with an
HMAC-SHA256 hash linked to the previous row, forming a chain that detects retroactive
edits. See [[Audit and PHI Access]].

---

Related: [[Architecture Overview]]
