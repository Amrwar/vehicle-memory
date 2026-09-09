# ADR-0012: Photographs are the trust mechanism

**Status:** Accepted
**Date:** 2026-09-09

## Context

Two trust problems, and they turn out to have the same answer.

Maria (persona P4) is asked to approve 1,509 pounds of brake work. She knows
nothing about cars. Her only options are to trust the workshop or not, and she
has no basis for either.

David (persona P5) reads a passport entry saying "front brake pads replaced".
He has no way to distinguish a workshop that did the work from one that typed
the words.

## Decision

Photographic evidence is a first-class part of the data model, not an
attachment feature.

1. Inspection items carry photographs, captured on the tablet at the moment of
   inspection.
2. Photographs flow through to the estimate the customer sees. The approval
   screen shows Maria her own brake pads.
3. The verification level of a passport event is **derived from whether
   evidence exists**: `WORKSHOP_VERIFIED` when photographs back it,
   `WORKSHOP_RECORDED` when they do not.
4. The distinction is shown to the reader, with an explanation of what it
   means.

That third point is the substantive one. It converts photography from a
courtesy into something with a consequence: a workshop that photographs its
findings produces a more valuable history, and history value is what the
revenue share pays for.

## Alternatives considered

| Option                                             | Why not                                                                                                                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Photographs as generic job attachments**         | They exist but nothing depends on them, so under time pressure they stop being taken.                                                                                                        |
| **Mandatory photographs on every finding**         | Would guarantee coverage and would also guarantee that technicians photograph the floor to get past the screen. A requirement that can be satisfied meaninglessly produces meaningless data. |
| **Treat all workshop entries as equally verified** | Simpler, and dishonest. A buyer is entitled to weigh "a garage typed this" differently from "a garage typed this and here is the picture".                                                   |

## Consequences

- Storage cost is real: an average of two megabytes per photograph across
  twenty million photographs (NFR-205). Budgeted, and served through an
  authorising handler rather than a public bucket.
- Capture must be genuinely one tap on the tablet, or it will not happen.
- Retention interacts with erasure: a photograph of a brake disc is the
  vehicle's record, not the owner's personal data, and is retained through an
  erasure request. A photograph incidentally containing a person is not, and
  the runbook covers that case.
