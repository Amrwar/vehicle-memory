# ADR-0011: Totals are derived, never stored

**Status:** Accepted
**Date:** 2026-09-09

## Context

A job, an estimate and an invoice each have a total. The obvious optimisation
is to store it, so a list view does not recompute across line items.

## Decision

Totals on a **mutable** document are computed from lines on read, never stored
as an independent value. `calculateTotals()` is the single implementation, used
by the job screen, the estimate builder, the portal and the API.

Totals on an **immutable** document are different. When an invoice is issued or
an estimate is approved, the figures are snapshotted onto the record, because
at that moment they stop being a derivation and become the number that was
agreed. `EstimateApproval.approvedTotal` records what the customer actually
said yes to, and it must not change if a price list is edited afterwards.

The rule, stated once: **derive while it can change, snapshot when it is
agreed.**

## Alternatives considered

| Option                                       | Why not                                                                                                                               |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Store totals, recompute on every write**   | Works until one write path forgets. The first time a line changes and the total does not, every figure in the system becomes suspect. |
| **Store totals, recompute in a nightly job** | Guarantees a window in which the displayed total is wrong.                                                                            |
| **Database generated columns**               | Cannot express per-line tax with rates joined from another table.                                                                     |

## Consequences

- A total is never stale, because there is nothing to become stale.
- List views showing totals need the lines. Where that becomes a performance
  problem, the answer is a materialised read model with an explicit name, not a
  quietly denormalised column.
- Snapshot fields are named for what they are (`approvedTotal`, `amountPaid`)
  so nobody mistakes them for a cache of a live value.
