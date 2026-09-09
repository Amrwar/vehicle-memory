# Architecture

## 1. Context

```
                    +---------------------+
                    |   Workshop staff    |
                    | owner, manager,     |
                    | advisor, bookkeeper |
                    +----------+----------+
                               |
   +--------------+            v            +------------------+
   | Technician   |     +-------------+     | Vehicle owner    |
   | (tablet)     |---->|   CARNET    |<----| (phone)          |
   +--------------+     +------+------+     +------------------+
                               |
        +----------------------+----------------------+
        |            |         |          |           |
        v            v         v          v           v
   +---------+  +--------+ +-------+ +---------+ +-----------+
   | Buyer   |  | Email  | | SMS   | | VIN     | | Payments  |
   | (link,  |  | (SMTP) | |       | | decode  | | (Phase 3) |
   | no acct)|  +--------+ +-------+ +---------+ +-----------+
   +---------+
```

Every external dependency is optional to the core workflow. If SMS, email or
VIN decoding is down, a workshop can still book, inspect, estimate, repair,
invoice and take payment (NFR-307).

## 2. Containers

```
  +-------------------------------------------------------------+
  |                        apps/web                             |
  |  Next.js. Server components render; route handlers serve     |
  |  the API. Four surfaces:                                     |
  |    /dashboard /diary /jobs /customers /vehicles   workshop   |
  |    /shop                                          shop floor |
  |    /portal                                        customer   |
  |    /p/<token>  /e/<token>                         public     |
  +--------------------------+----------------------------------+
                             |
        +--------------------+---------------------+
        |                    |                     |
        v                    v                     v
  +-----------+     +----------------+     +---------------+
  | packages/ |     |  packages/db   |     | packages/ui   |
  |   core    |     |  Prisma +      |     | design system |
  | domain,   |     |  forOrg() scope|     +---------------+
  | no ORM,   |     +--------+-------+
  | no React  |              |
  +-----------+              v
        ^            +---------------+
        |            |  PostgreSQL   |
        |            +---------------+
        |                    ^
  +-----+---------+          |
  | apps/worker   |----------+
  | outbox, chain |
  | audit,        |     +---------+
  | reminders     |---->|  Redis  |
  +---------------+     +---------+
```

## 3. Request path

A page render, end to end:

```
  Browser
    -> Next.js route
       -> requireSession(permission)
            -> currentUser()      cookie -> session digest -> user + role
            -> assertCan()        deny-by-default permission check
            -> forOrg(orgId)      tenant-scoped Prisma client
       -> page queries through the scoped client only
       -> domain logic from packages/core for anything derived
       -> React server components render on the server
    <- HTML, minimal JavaScript
```

Two properties fall out of this shape, and both matter:

**Obtaining a database handle and obtaining the tenant scope are the same act.**
There is no convenient way to query unscoped from a page, so the safe path is
also the shortest one.

**Server components mean the workshop UI ships almost no JavaScript.** On a
workshop tablet over patchy Wi-Fi, that is the difference between a list that
appears and a spinner that does not.

## 4. Write path, and where consistency is traded

Completing a job is the most consequential write in the system.

```
  BEGIN
    job.status -> COMPLETED
    JobStatusEvent appended
    OutboxEvent 'job.completed' written        <- same transaction
  COMMIT
       |
       v  (worker, at-least-once)
  passport events appended    <- idempotency key job:<id>:part:<lineId>
  stock reservations consumed
  ledger entries posted
  customer notified
```

The trade is deliberate. The job completing is strongly consistent, because a
workshop losing a completed job is unacceptable. Everything downstream is
eventually consistent, because a passport event arriving ninety seconds late is
not a problem. See [ADR-0007](../03-adr/0007-transactional-outbox.md).

Within the ledger append itself, concurrency is handled with a row lock on the
vehicle, because two workshops completing jobs on the same car in the same
second must not both claim sequence 41.

## 5. Layering rules

| Layer | May import | Must not import |
| --- | --- | --- |
| `packages/core` | nothing from this repo | Prisma, React, Next |
| `packages/db` | core | React, Next |
| `packages/ui` | core, React | Prisma, Next |
| `apps/web` | all packages | — |
| `apps/worker` | core, db | React, ui |

`packages/core` importing nothing is what makes the domain testable without a
database and portable if the framework changes. 192 tests run in under half a
second because none of them touch Postgres.

## 6. Deployment

```
  Internet
     |
     v
  Reverse proxy / TLS termination
     |
     +--> apps/web        stateless, horizontally scalable, N replicas
     |
     +--> apps/worker     single logical consumer, at-least-once
              |
              v
     PostgreSQL (primary + read replica)   Redis   Object storage
```

The application tier holds no state, so scaling is adding replicas. Sessions
live in the database, not in memory, which is also what makes them revocable.

**Migrations are expand, migrate, contract.** Every migration is backward
compatible with the previous application version (NFR-309), so a rolling deploy
never has a moment where running code and live schema disagree.

## 7. Failure modes and what happens

| Failure | Behaviour |
| --- | --- |
| Postgres unavailable | Application returns 503. No degraded write path; a workshop system that silently drops writes is worse than one that is down. |
| Redis unavailable | Rate limiting falls back to the database. Queues pause. Core workflow continues. |
| SMS or email provider down | Message queued in the outbox and retried. The estimate still exists and can be read from the portal. |
| VIN decode unavailable | Manual entry. The field is never blocking. |
| Worker down | Outbox accumulates. Jobs still complete. Passport events arrive when it returns. Alert fires on queue depth. |
| Object storage down | Photograph upload fails with a clear message; the inspection item still records its finding. |

The pattern throughout: **never let a peripheral dependency stop the shop
floor.**

## 8. What we would change at ten times the scale

Recorded now so it is a decision later rather than a surprise:

- Outbox polling becomes a real broker.
- Read replicas for reporting, which is already the only read-heavy workload.
- Passport events partitioned by vehicle, since that table grows without bound.
- Row-level security in Postgres, replacing the client extension
  ([ADR-0010](../03-adr/0010-tenant-isolation-in-data-layer.md) names this as
  the intended successor).

---

*Next: [State machines](04-state-machines.md).*
