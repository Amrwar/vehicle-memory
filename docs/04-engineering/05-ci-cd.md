# CI/CD

## Pipeline

```
  push / PR
     |
     +-- format:check      prettier          ~10s
     +-- lint              eslint            ~30s
     +-- typecheck         tsc --build       ~45s
     +-- test              vitest + coverage ~30s   (Postgres service)
     +-- build             next build        ~90s
     +-- verify:*          one script per phase (seeded database)
     +-- crawls            every page, every role, against the built app
     +-- audit             npm audit, secret scan
     |
     v
  all green -> merge allowed
```

Under ten minutes end to end (NFR-707). A slow pipeline gets bypassed.

## Gates

Nothing merges to `main` without a green pipeline and one approval. Bypassing
requires a recorded exception naming who authorised it and why.

Critical dependency vulnerabilities block the merge (NFR-409). High
vulnerabilities open an issue with a deadline.

## Environments

|            | Development   | Staging               | Production              |
| ---------- | ------------- | --------------------- | ----------------------- |
| Deploys    | Local         | Every merge to `main` | Tagged release          |
| Data       | Seed          | Anonymised copy       | Real                    |
| Secrets    | `.env`        | Vault                 | Vault                   |
| Migrations | `migrate dev` | `migrate deploy`      | `migrate deploy`, gated |

## Migrations

**Expand, migrate, contract.** Every migration is backward compatible with the
previous application version (NFR-309), so a rolling deploy never has a moment
where running code and live schema disagree.

```
  1. Expand    add the new column, nullable. Old code ignores it.
  2. Migrate   backfill. Deploy code writing both. Then reading new.
  3. Contract  a later release drops the old column.
```

A destructive migration in the same release as the code that needs it is the
single most common cause of a failed deployment, and it is rejected in review.

## Deployment

Rolling, zero downtime (NFR-308).

```
  tag v1.2.0
     -> build image
     -> migrate (deploy, forward-only)
     -> roll replicas one at a time, health-gated
     -> smoke test against production
     -> announce
```

Rollback is a redeploy of the previous image. Migrations are **not** rolled
back; forward-only, because a down migration that has to discard data is worse
than the bug it was reverting.

## Monitoring a release

For thirty minutes after a deployment, watch error rate, p95 latency, queue
depth, and jobs created per minute. The last is the business signal: if
workshops stop creating jobs, something is broken that no error counter caught.

---

_Next: [Observability](06-observability.md)._
