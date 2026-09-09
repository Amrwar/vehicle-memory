# ADR-0002: TypeScript, Next.js and PostgreSQL

**Status:** Accepted
**Date:** 2026-09-09

## Context

This system needs four distinct interface surfaces (workshop desktop,
shop-floor tablet, customer portal, public passport), a domain model of real
intricacy, correct money handling, and a small team that must hold the whole
model in their heads.

The difficulty here is the domain, not the infrastructure. Job lifecycle,
double-entry posting and an append-only ledger are where the risk lives.

## Decision

TypeScript end to end. Next.js with the App Router for the web tier and its
route handlers for the API. PostgreSQL via Prisma. Deployed in containers.

The stack is deliberately conservative. We decline to spend novelty budget on
the parts of this problem that are already solved.

Specifically:

- **TypeScript everywhere** so a domain type is defined once and shared by the
  server, the client and the background worker. Money, job status and severity
  are the sort of concepts that get quietly re-typed at each boundary in a
  polyglot stack, and each re-typing is a place for them to disagree.
- **PostgreSQL** because we need transactions, partial unique indexes,
  constraint triggers, `NUMERIC` for money, and JSON for event payloads.
  Every one of those is used in the first migration.
- **Prisma** for typed access and migrations, with the escape hatch of raw SQL
  where a query needs it (the vehicle row lock in the ledger append is one).
- **Next.js** because server components let a page fetch exactly what it
  renders without an API round trip, and the same framework serves the public
  passport page, which must be fast and cheap for anonymous readers.

## Alternatives considered

| Option                                        | Why not                                                                                                                                                                                                                            |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NestJS API plus a separate React frontend** | Cleaner module boundaries, and a genuinely reasonable choice. Rejected because it doubles the deployables and adds a network hop and a hand-maintained client for a team of three. Revisit if the API gains third-party consumers. |
| **Django and DRF**                            | Excellent admin, which would give free back-office CRUD. Rejected because it splits the team across two languages and the domain layer could not then be shared with the frontend.                                                 |
| **Rails**                                     | Fast to build. Rejected for the same typing reason: money and status enums crossing an untyped boundary is exactly the class of bug that is most expensive here.                                                                   |
| **MySQL**                                     | No partial indexes, weaker JSON, weaker constraint triggers. The invariants migration would not be expressible.                                                                                                                    |
| **MongoDB**                                   | The domain is relational to its core. A job joins nine tables on one screen.                                                                                                                                                       |
| **A blockchain for the ledger**               | Addressed separately in ADR-0005.                                                                                                                                                                                                  |

## Consequences

- One language, one type system, one place where a domain rule lives.
- Server components mean the workshop UI ships very little JavaScript, which
  matters on a workshop tablet over patchy Wi-Fi.
- Prisma's abstraction occasionally has to be bypassed for locking and for the
  append-only trigger. Those places are commented and tested.
- If a third-party API becomes a product requirement, we extract route handlers
  into a dedicated service rather than retrofitting one now.
