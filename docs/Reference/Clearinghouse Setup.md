---
tags: [reference, setup, edi]
---

# Clearinghouse Setup

How to go from `CLEARINGHOUSE_PROVIDER=mock` to a real, live clearinghouse connection.
See [[Package - clearinghouse]] for the adapter architecture; this note is the
operational side — credentials, environment, and going live safely.

## The three connectors

| Connector | File | Status |
|---|---|---|
| `mock` | `mock.ts` | Default. Replays deterministic X12 offline — see its docstring for the steering conventions (member ID suffixes, `DENY`/`REJECT` in a patient control number). |
| `stedi` | `stedi.ts` | Real. Makes authenticated HTTPS calls to Stedi's Healthcare API and round-trips real X12 through `@grove/x12`. |
| `claimmd` | — | Not implemented. The adapter interface is ready for it; nothing currently registers it. |

Switching connectors is one environment variable — `CLEARINGHOUSE_PROVIDER` — because
`ClearinghouseAdapter` is the only thing domain code and the worker depend on. Nothing
downstream needs to know which connector is active.

## Going live with Stedi

1. **Get credentials.** Sign up at stedi.com, create a Healthcare API key in the sandbox
   environment first. Do not request production access until claims round-trip cleanly
   in sandbox.
2. **Set the environment variables** (`.env` / your deployment's secret store):
   ```bash
   CLEARINGHOUSE_PROVIDER=stedi
   STEDI_API_KEY=<your key>
   STEDI_BASE_URL=https://healthcare.us.stedi.com/2024-04-01   # sandbox and production share this host
   ```
3. **Set the submitter identity** at Settings → Billing & EDI in the operator UI —
   `organizations.ediSubmitterId` / `ediSubmitterName`, the values that land in
   ISA06/GS02 and NM1*41 of every outbound envelope. Stedi (or your trading-partner
   agreement) assigns these.
4. **Leave the usage indicator on `T` (Test)** until the clearinghouse and every payer
   on your list have approved production submission. This is ISA15 on literally every
   transaction Grove sends — flipping it early is how claims get rejected or a trading
   partner relationship gets suspended. The settings page requires an explicit
   confirmation step before saving `P`.
5. **Verify the round trip in sandbox**, in this order — each depends on the previous
   one working:
   - Submit a test claim (`submitClaim`) and confirm a `999` comes back accepted.
   - Confirm a `277CA` follows and the claim status in `/claims` moves to `acknowledged`
     (or `rejected`, with a reason, if you deliberately sent something wrong).
   - Run a real-time eligibility check (`checkEligibility`) against a sandbox payer and
     confirm parsed benefits render on the patient's coverage.
   - Wait for (or trigger) a sandbox `835` and confirm it posts through
     `postRemittanceCommand` — claim balances update, a denial or underpayment files
     the tasks you'd expect.
6. **Only then** request production access from Stedi, get the payers on your list
   approved, and flip the usage indicator.

## Real-time vs. polling

Without a webhook configured, everything works — just on a schedule:

| What | Cadence |
|---|---|
| Eligibility pre-visit sweep | daily, `0 23 * * *` UTC |
| ERA (835) fetch | every 30 minutes |
| 999/277CA ack retry | 5m → 15m → 30m → 1h → 2h → 4h backoff, up to 48h |
| 276/277 claim status poll | learned per-payer cadence (p90 days-to-remit ÷ 2, min 5 / max 30 days) |

A webhook doesn't replace any of this — it **accelerates** it. Configuring
`STEDI_WEBHOOK_SECRET` and an event destination in Stedi's dashboard makes Grove check
immediately instead of waiting for the next scheduled run, while the scheduled jobs
keep running underneath as the safety net for a webhook that never arrives.

### Configuring the webhook

1. In the Stedi dashboard, create an event destination pointing at:
   ```
   https://<your-api-domain>/v1/webhooks/stedi
   ```
   (shown on the Settings → Billing & EDI page, resolved from your deployment's API
   base URL).
2. Bind it to the transaction-processed events for `999`, `277`/`277CA`, and `835`.
3. Set its credential to an **API Key**, with the header value being a secret you
   generate yourself (not a Stedi-issued key — this is what Grove checks on the way
   in). A random 32+ byte value is fine.
4. Set that same value as `STEDI_WEBHOOK_SECRET` in Grove's environment and redeploy
   the API app.
5. Settings → Billing & EDI shows "Real-Time Webhook: Configured" once the secret is
   present. There's nothing else to verify from Grove's side — the next accepted claim
   or posted ERA will arrive within seconds instead of on the next poll.

**Why a shared secret and not a signature.** Stedi's webhook auth model is a
credential you attach to the event destination (API key or Basic Auth), not an
HMAC-signed body the way some other webhook providers work. `apps/api`'s handler does
a constant-time comparison against `STEDI_WEBHOOK_SECRET` and, on a match, tells the
worker to poll right now — it does not parse or trust the event body, so a future
change to Stedi's payload shape can't break delivery.

## Multi-tenant note

`createClearinghouse()` reads its configuration from process environment once, at
worker/API startup — today's deployment shares one clearinghouse account across every
organisation Grove serves. Per-organisation clearinghouse credentials (a billing
company whose different client practices are each contracted with a different
clearinghouse) would need `ClearinghouseAdapter` resolved per-org instead of once
per-process — not implemented, and worth planning for before it's needed rather than
after.

---

Related: [[Package - clearinghouse]] · [[X12 Transactions]] · [[Local Development]]
