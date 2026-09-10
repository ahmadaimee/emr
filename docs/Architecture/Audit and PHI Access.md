---
tags: [architecture, security, compliance]
---

# Audit and PHI Access

Two separate trails, answering two different regulatory questions.

| Trail | Table | Question it answers |
|---|---|---|
| Audit chain | `audit_events` | Who *changed* what, and has the record been altered since? |
| PHI access log | `phi_access_events` | Who *read* which patient's data, and why? |

## The audit chain is tamper-evident

Every mutating action and every PHI export appends a row to `audit_events`. Each row
carries an HMAC-SHA256 hash computed over its canonical form **plus the previous row's
hash**, forming a chain.

Editing or deleting a historical row breaks every hash after it, which verification
detects. This is the difference between an audit log and an audit log you can trust:
without the chain, anyone with database access could rewrite history silently.

- `packages/audit/src/canonical.ts` — deterministic serialization, so the same event
  always hashes identically
- `packages/audit/src/chain.ts` — link and verify
- Operators verify from **Settings → Audit** in the [[Web Operator UI]]

## Every PHI read is logged

Reading patient data is itself a regulated event — HIPAA requires an accounting of
disclosures. Any query touching patient data calls:

```ts
phi.touch(patientIds, categories, count)
```

which buffers and flushes to `phi_access_events`. This has to happen at read time; it
cannot be reconstructed afterwards from application logs, because [[Non-Negotiable Rules|rule 2]]
forbids PHI in logs in the first place.

## Consequences for new code

- A new read path over patient data is incomplete until it calls `phi.touch`.
- A new mutation is incomplete until it appends to the audit chain in the *same*
  transaction — an audit row written separately can be lost when the write rolls back.

---

Related: [[Non-Negotiable Rules]] · [[Multi-Tenancy and RLS]] · [[Package - audit]]
