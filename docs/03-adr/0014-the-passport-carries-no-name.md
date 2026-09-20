# ADR-0014: The passport carries no personal name

**Status:** Accepted
**Date:** 2026-09-19

## Context

Two promises of this product collide, and Phase 62 is where they met.

ADR-0005 makes the vehicle event ledger append-only and hash-linked. There is
no update path: a correction appends a superseding event and **both remain
visible**. That is not a limitation of the scheme, it is the scheme — a chain
whose contents can be quietly revised proves nothing to the buyer it exists for.

FR-209 and NFR-503 say a person may ask to be forgotten, and that their name,
address and contact details must then go.

The security model reconciled these on paper from the first month, with a
sentence saying erasure "supersedes events carrying personal identifiers with
redacted versions, which keeps the chain intact and the fact preserved". When
Phase 62 built the erasure that section specifies, the probe demonstrated that
this does not work, and that the reason it does not is exactly what makes the
ledger worth having:

- Superseding **preserves** the original event, including the name in it.
- Rewriting the original's payload would change its hash and break the chain —
  and a chain that can be rewritten to satisfy a request can be rewritten to
  satisfy anything.

So a name written into the passport can never be taken out. ADR-0005 named
this hazard in its own alternatives table, as one of the reasons against a
blockchain — "an immutable-personal-data conflict with data-protection law" —
without noticing that the hash chain had brought the same conflict with it in
miniature.

## Decision

**The passport carries no personal name.** Not "names are redacted on request";
never written in the first place.

1. `ownershipTransferEvent` takes a **keeper number**, not an outgoing and
   incoming owner name. It reads "Changed hands. The third keeper on record."
2. Who those keepers were lives in `vehicle_ownerships`, an ordinary table,
   where erasure can anonymise the name and keep the dates — because how long
   a car sat in one pair of hands is the vehicle's record and the next buyer's
   business, while whose hands they were is not, once they have asked.
3. No event payload may carry a name, an email address, a telephone number or
   an address. The vehicle, the work, the readings and the findings are the
   subject matter; the person is not.
4. Erasure therefore **does not touch the passport at all**, and
   `verify-erasure` asserts the chain is afterwards both valid and of exactly
   the same length.
5. Events written before this decision may still carry a name. `eraseCustomer`
   reports each one it finds rather than reporting a clean erasure it did not
   perform.

This is what the security model already implied and what the code was not
doing: a passport event describes the vehicle, not the person.

## Alternatives considered

| Option                                                     | Why not                                                                                                                                                                                                                             |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Supersede the event with a redacted copy**               | What the security model said, and it does not erase anything. The original event, name included, is still in the chain and still visible — that is the definition of superseding.                                                   |
| **Rewrite the payload and recompute the chain from there** | Destroys the one property the chain exists to provide. If the operator can recompute hashes for a good reason, they can recompute them for a bad one, and no third party can tell the two apart.                                    |
| **Encrypt names in payloads and throw the key away**       | Genuinely tempting, and it keeps the chain intact. Rejected because the ciphertext is still personal data until the key is provably gone, key custody becomes a data-protection question of its own, and the name was never needed. |
| **Keep names and refuse erasure for passport events**      | Tells a person the record of a car they no longer own makes them permanently unforgettable. Not defensible, and not lawful.                                                                                                         |
| **Drop the hash chain so events can be edited**            | Then the passport is a database table and the product's central claim is false. ADR-0005 covers this.                                                                                                                               |

## Consequences

**A keeper number is more useful than a name anyway.** "The third keeper on
record" is what a buyer actually wants to know; the previous owner's name tells
them nothing and was only ever there because it was to hand.

**The ledger stops being a data-protection liability.** Erasure and
immutability no longer compete, because they no longer overlap: everything
personal lives in tables that can be changed, and everything in the chain is
about the vehicle.

**Historic events remain.** There is no honest way to remove them, so they are
reported rather than swallowed, and the number will only ever go down.

**It was already being broken when it was written.** The check that enforces
this ADR takes every name in the database and looks for it in every passport
event. On its first run it found an OWNERSHIP_TRANSFER event, summary and
payload, naming both parties — written by the seed, from wording that came
straight out of the wireframe in the design book. The two paths a real
transfer goes through had never done it. A decision recorded and not checked
is a decision held only by whoever remembers it.

**A new event type is a decision point.** Anything appended to the passport
from here must be checked for personal data before it is written, because
afterwards is too late. That is the cost of this ADR and it is permanent.
