# ADR-0009: Four interfaces, one data model

**Status:** Accepted
**Date:** 2026-09-09

## Context

Six personas use this system. John is a technician with gloves on and a wall
tablet. Fatima is a part-time bookkeeper who cares only whether the numbers are
right. David is a used-car buyer who has no account and three minutes.

The standard approach is one application with role-based menu filtering. That
produces an interface designed for nobody: too heavy for the tablet, too
shallow for the ledger, and incomprehensible to someone with no account.

The technician is the case that matters. If the shop-floor interface costs him
thirty seconds of fiddling, the inspection does not get recorded, the passport
stays empty, and the entire product proposition fails. That is hypothesis H2 in
the [MVP definition](../00-product/05-mvp-definition.md), and it is the one we
consider most likely to kill the product.

## Decision

Four distinct interface surfaces over one schema:

| Surface         | Route                                | Audience                            | Character                                       |
| --------------- | ------------------------------------ | ----------------------------------- | ----------------------------------------------- |
| Workshop        | `/dashboard`, `/jobs`, `/diary`, ... | Owner, manager, advisor, bookkeeper | Dense, keyboard-driven, analytical              |
| Shop floor      | `/shop`                              | Technician                          | Large targets, minimal typing, offline-tolerant |
| Portal          | `/portal`                            | Customer                            | Mobile-first, plain language, zero training     |
| Public passport | `/p/<token>`                         | Anonymous reader                    | No account, comprehensible cold                 |

`surfaceFor(role)` decides where a user lands. A technician who reaches a
workshop URL is redirected rather than shown an access-denied page: their
interface is different by design, not by restriction.

Design constraints per surface are binding, not advisory:

- Shop floor: minimum 48px touch targets, no hover-dependent interaction, no
  modal that can lose work, voice-to-text on every note field.
- Portal and public: readable on a phone with no horizontal scrolling,
  photographic evidence as the trust mechanism, no jargon without a plain
  explanation.

## Alternatives considered

| Option                                                | Why not                                                                                                                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **One responsive interface with role-filtered menus** | Cheapest to build, and the reason most workshop software is unusable on the shop floor. The information density a bookkeeper needs is exactly what makes a screen unusable with gloves on. |
| **A separate native mobile app for technicians**      | Better ergonomics, materially more cost, and a second deployment pipeline. Deferred to Phase 5, and only if the responsive surface proves insufficient against measured evidence.          |
| **A separate application per surface**                | Four deployables and four auth integrations, for a benefit already obtained by route groups sharing one schema.                                                                            |

## Consequences

- Components in `packages/ui` come in desktop and touch variants; the design
  system carries that distinction rather than each page reinventing it.
- The passport timeline component is shared across three surfaces, so a buyer
  comparing what the seller showed them against what they see themselves sees
  the same thing.
- Four surfaces mean four sets of acceptance criteria and four accessibility
  audits.
- A feature reaching all surfaces costs more. Most features do not need to.
