---
tags: [moc]
---

# Grove

Multi-tenant practice management and **autonomous revenue cycle management** (RCM).

> The core thesis: the revenue cycle should run itself, and pull in a human only for exceptions.

This vault is the engineering knowledge base for the Grove monorepo. It documents the
*why* behind the architecture — the rules that are not up for negotiation, the domain
model, and how the pieces fit. Code is the source of truth for *how*; these notes exist
to explain intent that the code cannot state on its own.

## Start here

- [[Non-Negotiable Rules]] — read before writing any code that touches patient data
- [[Architecture Overview]] — the shape of the system
- [[Monorepo Layout]] — what lives where
- [[Local Development]] — getting it running

## Architecture

- [[Multi-Tenancy and RLS]] — how tenant isolation is actually enforced
- [[Audit and PHI Access]] — the tamper-evident trail and access logging
- [[Automation and Exceptions]] — what runs itself, and when a human is pulled in

## Domain

- [[Revenue Cycle Overview]] — the end-to-end money path
- [[Claim Lifecycle]] — every status and the legal transitions between them
- [[Eligibility]] · [[Remittance and Payment Posting]] · [[Denials and Appeals]]
- [[Coordination of Benefits]] · [[Money and the Ledger]]

## Code

- Apps: [[Web Operator UI]] · [[API]] · [[Worker]]
- [[Packages Index]] — the eleven `@grove/*` libraries
- [[Data Model]] · [[X12 Transactions]]

## Conventions

- [[Vault Guide]] — how to write and link notes in here
