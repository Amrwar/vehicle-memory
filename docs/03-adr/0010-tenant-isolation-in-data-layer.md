# ADR-0010: Tenant isolation enforced in the data-access layer

**Status:** Accepted
**Date:** 2026-09-09

## Context

Cross-tenant data leakage is the most severe defect this system can have. One
workshop seeing another's customers would be a reportable breach and would end
the business.

The usual implementation puts `where: { orgId }` in every query and relies on
review to catch omissions. That fails eventually, because a missing filter
looks like nothing at all in a diff.

## Decision

Tenant scoping is applied by a Prisma client extension, `forOrg(orgId)`, which
every request-scoped query goes through. It:

- adds the tenant predicate to reads on every tenant-scoped model,
- stamps `orgId` on creates,
- rewrites `findUnique` to `findFirst` with the tenant predicate, so requesting
  another tenant's record by id returns `null` rather than the record.

The route guard returns the scoped client alongside the user, so obtaining a
database handle and obtaining the tenant scope are the same act. There is no
convenient way to get an unscoped client in a page.

Requesting another tenant's record returns **404, not 403**, so existence is
not disclosed.

Passport models are explicitly excluded from the scoped set, per ADR-0004, and
carry their own access checks.

## Alternatives considered

| Option                                      | Why not                                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PostgreSQL row-level security**           | The strongest option, and genuinely better in principle: the database refuses regardless of application bugs. Rejected for now because Prisma's connection pooling makes reliably setting a per-request session variable awkward, and getting it subtly wrong would give false confidence. Revisit in Phase 3, when the ledger raises the stakes. |
| **A database per tenant**                   | Perfect isolation, but the passport is deliberately cross-tenant, so this is incompatible with the product.                                                                                                                                                                                                                                       |
| **Manual filtering with review discipline** | The industry default, and the reason these breaches keep happening.                                                                                                                                                                                                                                                                               |

## Consequences

- The default path is safe; the unsafe path requires deliberately importing the
  unscoped client, which is visible in review.
- `update` and `delete` by id are not narrowed by the extension, because their
  `where` must address a unique row. The convention is to load through the
  scoped client first. This is a documented gap, not an invisible one.
- Cross-tenant isolation tests exist for every tenant-scoped entity (story A2),
  and adding a model without a test is a review failure.
- Some overhead per query, which is not measurable against the cost of the
  alternative.

## The set it works from (Phase 64)

This ADR said the mechanism was a list of tenant-scoped models and an extension
that filters them. It did not say where the list came from, and the answer was
that somebody typed it. Twenty-six names, against a schema that had grown to
eighty-three models carrying an `orgId`. The other fifty-seven went through the
extension untouched — reads unfiltered, writes unstamped — in the one mechanism
this decision exists to provide.

`/reports` was reading `db.membership.findMany({ where: { role: 'TECHNICIAN' }
})` through the scoped client and rendering the result: every technician at
every workshop on Carnet, by name, with their cost rate.

The decision stands and gains a sentence: **the set is derived from the schema,
never maintained beside it.** `infra/scripts/generate-tenant-models.ts` writes
`packages/db/src/tenant-models.ts`, and CI fails when the two disagree. Every
model is now one of three things, and a model that is none of them fails the
build rather than defaulting to unfiltered:

- **scoped** — carries an `orgId`, filtered and stamped;
- **global** — declared by hand with a reason, because "no `orgId` column" and
  "may be read by anybody" are different statements and only a person can make
  the second one;
- **child** — no `orgId`, named with the model it hangs off. The extension has
  nothing to narrow these by, so a read of one must name its parent itself,
  and a check finds any that does not.

The general lesson is one this repository has now learned three times. A list of
"every X" written by a person falls behind on the day somebody adds an X, and
the failure is silent: the screens probe measured fifty-two of a hundred and
twenty-eight screens, the traceability matrix counted itself wrong by two, and
here the isolation mechanism covered a third of what it claimed to.
