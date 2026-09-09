# ADR-0005: Append-only hash-linked ledger, not a blockchain

**Status:** Accepted
**Date:** 2026-09-09

## Context

The passport is only worth anything if a buyer can believe it. David
(persona P5) is deciding whether to spend fourteen thousand pounds on a
stranger's car. "Trust us, we did not edit it" is not an answer.

The specific threat is not an external attacker. It is the plausible insider:
a workshop that wants a bad inspection to disappear, an owner who wants a
mileage correction, or an operator under commercial pressure.

## Decision

The vehicle event log is **append-only and hash-linked**.

1. Each event carries `sequence`, `hash` and `prevHash`. The hash covers a
   canonical serialisation of the event content plus the previous event's hash
   plus a deployment secret.
2. There is no update or delete path in the application. A correction appends a
   superseding event that references the original; both remain visible.
3. The rule is enforced in the database by a trigger, not only in code, so it
   holds for a direct psql session. The single permitted mutation is setting
   the `supersededById` back-reference, once.
4. Verification recomputes the chain and reports the first divergence
   (FR-404).
5. Canonical JSON sorts object keys at every level, so structurally identical
   payloads always hash identically. Without this, verification would fail on
   data that never changed.

## Alternatives considered

| Option                                   | Why not                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A blockchain, public or permissioned** | Distributed consensus answers "who decides what is true when nobody is trusted". Our question is narrower: "can the operator silently rewrite the past". A hash chain answers that. A chain adds transaction cost, latency, key management, an immutable-personal-data conflict with data-protection law, and a governance problem, in exchange for solving a problem we do not have. |
| **Database audit log only**              | An audit log the operator can also edit proves nothing to a third party.                                                                                                                                                                                                                                                                                                              |
| **Signed events with per-workshop keys** | Genuinely stronger, and the natural next step. Deferred because it requires key distribution and rotation across hundreds of small workshops, which is an operational burden we cannot carry at launch. The chain format carries a version field so signatures can be added without invalidating existing events.                                                                     |
| **No integrity mechanism**               | Then the passport is a database table, and the product's central claim is false.                                                                                                                                                                                                                                                                                                      |

## Honest limits of this scheme

Stated plainly, because overclaiming here would be worse than the weakness
itself:

- **It proves nothing about what was never recorded.** A workshop that simply
  does not enter a bad finding leaves no trace. The chain proves that what is
  recorded has not changed, not that the record is complete.
- **An attacker with both database write access and the chain salt can rewrite
  the whole chain end to end** and it will verify. The salt raises the bar from
  "anyone with a psql session" to "anyone who has also compromised application
  secrets", which is a meaningful step, not a guarantee.
- **Mitigation, planned for Phase 5:** publish a periodic digest of every
  chain head to an external append-only store. A rewrite would then have to
  match a value we no longer control. This is cheap and closes the gap.

## Consequences

- Corrections are visible, which is a feature: a passport showing an amended
  entry is more trustworthy than one that shows nothing.
- The salt must never be rotated. Rotating it invalidates every existing chain.
  This is stated in `.env.example` and enforced by nothing but discipline,
  which is a weakness we accept and document.
- Appends must be serialised per vehicle, so the write path takes a row lock.
