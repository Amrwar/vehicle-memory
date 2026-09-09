<div align="center">

# Carnet

**A portable vehicle history that follows the car, not the owner or the workshop.**

Workshop management and ERP, built so that every job a garage completes writes a
verified, tamper-evident entry to the vehicle's permanent record.

[Documentation](docs/README.md) ·
[Business case](docs/Carnet-Business-Case.docx) ·
[Architecture decisions](docs/03-adr/) ·
[Getting started](docs/04-engineering/01-getting-started.md)

</div>

---

## The problem

A car passes through four or five owners and a dozen workshops across twenty
years. At every step somebody writes something down, and almost none of it
survives.

```
  Dealer        Mechanic A     Owner 1       Mechanic B    Owner 2
  ------        ----------     -------       ----------    -------
  PDI report    Job card       Shoebox of    Different     Bought it,
  Warranty      Closed system  receipts      software      knows nothing
  First service Never shared   Half lost     Starts blank  Starts blank
     |              |             |              |             |
     v              v             v              v             v
  +======================================================================+
  |  Five partial histories. No one holds the whole. The car is mute.    |
  +======================================================================+
```

The buyer inherits a car whose condition is unknowable. The seller cannot prove
the money they spent looking after it. The next mechanic diagnoses from zero.

## The idea

The data that would fix this **already gets typed into a computer**, every day,
by the mechanic doing the work. It goes into workshop software and is buried
inside one tenant, where it dies the moment the customer goes elsewhere.

> Do not ask anyone to contribute vehicle history. Give workshops a genuinely
> better system for running their business, and let the history be the exhaust
> of them doing their ordinary work.

Two surfaces, one data core:

|                     | Who                                           | What                                                                                                                   |
| ------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Carnet Workshop** | Workshops, technicians, advisors, bookkeepers | Booking, jobs, digital inspections, estimates, customer approval, invoicing, and a real double-entry ledger underneath |
| **Carnet Passport** | Owners, buyers, sellers                       | The vehicle's permanent, append-only, tamper-evident timeline. It transfers when the car is sold.                      |

## Quick start

```bash
npm install
cp .env.example .env          # fill in the three secrets
cp .env packages/db/.env && cp .env apps/web/.env
docker compose up -d postgres redis mailpit
npm run db:generate && npm run db:deploy && npm run db:seed
npm run dev                   # http://localhost:3000
```

Sign in as `ahmed@hillsidemotors.test` with `carnet-demo-2026`.

Then open the **BMW X5**. It arrives carrying seven history entries, three of
them written by a different workshop, three previous owners, an open safety
recall, and one deliberately impossible odometer reading. That screen is the
product.

Full instructions, including troubleshooting, are in
[getting started](docs/04-engineering/01-getting-started.md).

## What is built

**Phase 1, the MVP, is implemented and running.**

- Multi-tenant foundation, six roles, immutable audit log
- Customers and vehicles, VIN validation with the ISO 3779 check digit
- **The vehicle passport**: append-only hash-linked event ledger, verification,
  owner-controlled sharing, ownership transfer
- Booking diary with per-day capacity and bay lanes
- The job lifecycle engine: fourteen statuses, guards, and a reason on every
  refusal
- Digital vehicle inspections with structured measurements
- Estimates, secure customer approval, line-by-line decisions
- Invoicing and payments with gapless document numbering
- Four interface surfaces: workshop, shop floor, customer portal, public
  passport

**Phase 2, Inventory and Procurement, is also implemented.**

- Parts catalogue, warehouses, bins, stock levels and movements
- Weighted average cost, recalculated on every receipt
- Reservation against available stock rather than on-hand, with partial
  reservation and an automatic purchase request for the shortfall
- Reorder suggestions from observed usage, lead time and outstanding orders,
  each reported with its own confidence
- Purchase requests with an approval threshold, orders, partial receiving
- Three-way match of supplier bills against what was ordered and what arrived

Phases 3 to 6 (ERP, multi-site, automation, intelligence) are specified in the
[roadmap](docs/00-product/06-roadmap.md), and their tables are already in the
first migration so later migrations stay additive.

## The two decisions everything rests on

**[ADR-0004](docs/03-adr/0004-vehicle-is-global.md) — the vehicle is global.**
Every incumbent models the vehicle inside the workshop's tenant, which is
exactly why history cannot follow the car. Here, `Vehicle` and its events carry
no `orgId`. A workshop earns access by servicing the vehicle; the owner
controls disclosure.

**[ADR-0005](docs/03-adr/0005-append-only-vehicle-event-ledger.md) — append-only, hash-linked, not a blockchain.**
Each event's hash covers its content and its predecessor's hash. The rule is
enforced by a database trigger, so it holds even from a psql session. The ADR
also states, plainly, what this scheme does _not_ prove.

```bash
npx tsx infra/scripts/verify-integrity.ts
```

That script does not check the guarantees are configured. It **tries to break
them** — rewriting a passport entry, deleting an audit record, posting an
unbalanced journal — and fails the build if any succeeds.

## Layout

```
packages/db      Prisma schema, migrations, seed, tenant-scoped client
packages/core    domain logic. Imports nothing. 259 tests, under half a second.
packages/ui      design system: tokens and components
apps/web         Next.js: all four interface surfaces
apps/worker      outbox dispatch, chain audit, reminders
infra/           Docker, CI scripts, integrity and smoke tests
docs/            46 documents: product, requirements, design, ADRs, engineering
```

`packages/core` importing nothing from this repository is the constraint that
makes the domain testable without a database and portable if the framework
changes.

## Verification

| Command                                     | What it proves                                                                                  |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm test`                                  | 259 domain tests, including 67 for inventory and procurement.                                   |
| `npx tsx infra/scripts/verify-integrity.ts` | Chains verify; the database refuses every attempt to violate an invariant                       |
| `npx tsx infra/scripts/smoke.ts`            | 19 routes render real content across five roles, including role redirects                       |
| `npx tsx infra/scripts/verify-inventory.ts` | Weighted average cost, over-receipt refusal and reservation arithmetic, against a real database |
| `npm run verify`                            | Everything CI runs                                                                              |

## Documentation

46 documents. The ones worth reading first:

|                                                             |                                                                                  |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Vision](docs/00-product/01-vision.md)                      | The problem and why this approach works where others have not                    |
| [Proposal](docs/00-product/02-proposal.md)                  | Scope, team, cost, timeline, payment schedule                                    |
| [MVP definition](docs/00-product/05-mvp-definition.md)      | Three falsifiable hypotheses, and what would disprove them                       |
| [Competition](docs/00-product/03-market-and-competition.md) | Verified feature comparison against a named incumbent                            |
| [Domain model](docs/02-design/01-domain-model.md)           | Bounded contexts, aggregates, invariants, and what we deliberately did not model |
| [Design system](docs/02-design/08-design-system.md)         | Why petrol and brass, and why the brand colour could not be blue                 |
| [ADRs](docs/03-adr/)                                        | Twelve decisions, each with the options rejected and why                         |

## Stack

TypeScript throughout. Next.js 16 with React 19, PostgreSQL 17 via Prisma,
Tailwind 4, Vitest. Deliberately conservative: the difficulty here is the
domain model, not the infrastructure, and we decline to spend novelty budget on
the parts that are solved. See
[ADR-0002](docs/03-adr/0002-technology-stack.md).

## Licence

MIT. See [LICENSE](LICENSE).

---

<div align="center">

**The history becomes part of the vehicle's identity.**
**Not the owner's. Not the workshop's. The car's.**

</div>
