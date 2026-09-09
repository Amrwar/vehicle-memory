# ADR-0003: One repository, four workspaces

**Status:** Accepted
**Date:** 2026-09-09

## Context

The domain logic is used by the web application, by the background worker, and
by the seed script. The design system is used by four interface surfaces. A
change to the job lifecycle must land everywhere at once, or the worker and the
web tier disagree about what a valid transition is.

## Decision

A single repository with npm workspaces:

```
packages/db      Prisma schema, migrations, seed, tenant-scoped client
packages/core    domain logic, framework-free, no ORM import
packages/ui      design system: tokens and components
apps/web         Next.js: all four interface surfaces
apps/worker      background jobs: outbox dispatch, reminders, chain audit
```

The dependency rule is one-directional and enforced by review:

```
  apps/web ---> packages/ui
     |     \
     |      ---> packages/core  <--- apps/worker
     |                                  |
      ------> packages/db  <------------
```

`packages/core` imports nothing from `packages/db`, `packages/ui` or either
app. That is the constraint that keeps the domain testable without a database
and portable if the web framework changes (NFR-701).

## Alternatives considered

| Option                           | Why not                                                                                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One Next.js app, no packages** | Simplest, and tempting. Rejected because the worker needs the domain logic, and duplicating the lifecycle state machine into two places guarantees they diverge.                                                    |
| **Separate repositories**        | A lifecycle change would need coordinated releases across three repos. At this team size that is pure overhead.                                                                                                     |
| **Nx or Turborepo**              | Real caching benefits at larger scale. Rejected for now because npm workspaces plus TypeScript project references covers this, and every added tool is a thing a new engineer must learn before their first commit. |

## Consequences

- One pull request can change the schema, the domain rule, the UI and the test.
- Workspace packages ship TypeScript source and are transpiled by the consuming
  app, so there is no build-order dance in development.
- The dependency rule is a convention, not a mechanism. If it starts being
  violated, we add a lint rule rather than relying on vigilance.
