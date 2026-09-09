# ADR-0004: The vehicle is global, not tenant-scoped

**Status:** Accepted
**Date:** 2026-09-09

## Context

This is the load-bearing decision of the entire product. Everything else could
change without invalidating the proposition; this could not.

Every workshop management system we examined models the vehicle as a child of
the workshop's tenant. When a customer leaves, their vehicle's history stays
behind, inert, in a tenant that no longer services it. That is precisely the
fragmentation the product exists to fix.

## Decision

`Vehicle`, `VehicleEvent`, `VehicleOwnership`, `OdometerReading`,
`VehicleAccessGrant`, `PassportShare` and the recall tables are **not**
tenant-scoped. They carry no `orgId` filter and are excluded from the
`forOrg()` scoping extension.

A vehicle is uniquely identified by VIN across the entire platform. Two
workshops servicing the same car operate on the same row.

Workshop access is mediated rather than owned:

- A workshop gains write access by servicing the vehicle, recorded as a
  `VehicleAccessGrant` with reason `SERVICED`.
- Prior events are readable at the disclosure level the owner permits.
- The owner may grant, scope and revoke access, and every third-party read is
  logged and visible to them (FR-409, FR-410).

## Alternatives considered

| Option                                                                  | Why not                                                                                                                                                                                            |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vehicle inside the tenant, synchronised to a shared registry**        | The obvious incremental design. Rejected because two copies of a fact diverge, and then the question "what is this vehicle's mileage" has two answers. The whole product rests on there being one. |
| **Vehicle in the tenant, with a separate global passport keyed by VIN** | Better, but it splits the vehicle's identity from its history, and every write becomes a two-phase operation across a boundary. Also makes the "same car, two workshops" case a merge problem.     |
| **Global vehicle, but history private per workshop unless shared**      | This is the status quo with extra steps. Coverage would never accumulate.                                                                                                                          |

## Consequences

**What this buys.** History follows the car. A workshop opening an unfamiliar
vehicle sees what was done to it elsewhere. Ownership transfer is a row, not a
migration. The competitive moat in
[market and competition](../00-product/03-market-and-competition.md) becomes
possible at all.

**What this costs, honestly.**

- Tenant isolation is no longer uniform, which is a security risk. Every
  passport read path needs an explicit access check, and those checks cannot be
  delegated to the ORM extension the way tenant-scoped models can. They are
  tested individually.
- A vehicle row is written by multiple organisations, so ledger appends need a
  row lock to serialise sequence allocation.
- Data-protection handling is more subtle: erasing a person must not erase the
  vehicle's history, because the history is the vehicle's, not theirs
  (NFR-503).
- VIN quality becomes critical. A mistyped VIN merges two cars' histories, which
  is the worst failure this system can have. Hence the validation in
  `packages/core/src/vehicle/vin.ts` and the duplicate check on entry.

The last point is the one to watch. It is on the
[risk register](../05-project/04-risk-register.md).
