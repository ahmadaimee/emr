---
tags: [reference, setup]
---

# Local Development

Node >= 24, pnpm >= 10, Docker.

```bash
pnpm install
pnpm infra:up        # Postgres, MinIO, Mailpit
pnpm db:migrate
pnpm db:seed
pnpm dev             # all apps in parallel
```

## Services

| Service | Port | Purpose |
|---|---|---|
| Postgres 17 | 5432 | Database **and** job queue (pg-boss) |
| MinIO | 9000 / 9001 | S3-compatible document storage |
| Mailpit | 1025 / 8025 | Catches outbound mail; nothing escapes locally |

Postgres initializes with `--locale=C --encoding=UTF8` so index and sort behaviour
matches production rather than the developer's locale.

`docker-compose.yml` is **not** production configuration. Production runs managed
Postgres with encryption at rest, private networking, PITR, and a signed BAA. The local
credentials (`grove` / `grove_local_dev`) are throwaway and must never appear in a
deployed environment.

## Seed data is synthetic

`pnpm db:seed` loads Synthea-derived synthetic patients. Never load real patient data
into a development environment — [[Non-Negotiable Rules|rule 1]]. There is no such
thing as a development environment that is "fine" for real PHI.

## Before committing

```bash
pnpm verify          # typecheck && lint && test
```

## Useful

```bash
pnpm infra:down      # stop services, keep volumes
pnpm infra:nuke      # stop and delete volumes (destroys local data)
pnpm db:check-rls    # assert RLS coverage
```

---

Related: [[Monorepo Layout]] · [[Data Model]]
