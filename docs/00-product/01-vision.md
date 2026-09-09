# Vision

## 1. The problem

**A car outlives every record of it.**

A vehicle typically passes through four or five owners and a dozen workshops
across a twenty-year life. At every step, someone writes something down. Almost
none of it survives.

```
                    WHAT ACTUALLY HAPPENS TO A CAR'S HISTORY

  Dealer          Mechanic A      Owner 1        Mechanic B      Owner 2
  ------          ----------      -------        ----------      -------
  PDI report      Job card #412   Shoebox of     Different       Bought it,
  Warranty        Their own DB    receipts       software        knows nothing
  First service   Closed system   Half lost      Starts blank    Starts blank
     |                 |              |              |               |
     v                 v              v              v               v
  +======================================================================+
  |   Five partial histories. No one holds the whole. The car is mute.   |
  +======================================================================+
```

The consequences are concrete and expensive:

| Who                        | What it costs them                                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Buyer**                  | Pays for a car whose real condition is unknowable. Odometer fraud, undisclosed accident damage, skipped timing-belt intervals. Buys risk blind.                         |
| **Seller**                 | Cannot prove the thousands they spent on diligent maintenance. A well-kept car sells for the same price as a neglected one. Their care evaporates at the point of sale. |
| **Workshop**               | Every unfamiliar car is diagnosed from zero. "When were the plugs last done?" _Nobody knows._ Hours spent rediscovering facts someone already established.              |
| **Owner**                  | Cannot judge whether a quote is reasonable, because they have no record of what was already replaced. Pays twice for the same part more often than anyone admits.       |
| **Manufacturer / insurer** | Recall campaigns reach a fraction of affected vehicles. Claims are assessed on assertion rather than evidence.                                                          |

The record exists. It is simply **scattered across parties who have no
mechanism, and no incentive, to share it.**

## 2. The insight

Every existing attempt to fix this starts from the wrong end.

- **Vehicle history reports** aggregate what institutions already report:
  registrations, insurance write-offs, some franchised-dealer servicing. They
  are thin on the thing that matters most, the routine maintenance performed by
  the independent workshops that service most cars. They can only report what
  somebody else already digitised.
- **Service booklets** are paper, forgeable, and lost with the glovebox.
- **Workshop software** captures excellent data, then locks it inside one
  workshop's tenant, where it dies the moment the customer goes elsewhere.

The data that would make a complete vehicle history **already gets typed into a
computer**, every day, by the mechanic doing the work. It goes into workshop
management software and is buried there.

> **The insight: do not ask anyone to contribute vehicle history. Give
> workshops a genuinely better system for running their business, and let the
> history be the exhaust of them doing their ordinary work.**

## 3. The product

Carnet is one data core with two surfaces.

```
                 +-----------------------------------------+
                 |          CARNET PASSPORT                |
                 |                                         |
                 |  The vehicle's permanent timeline.      |
                 |  Keyed to VIN, not to an owner or shop. |
                 |  Append-only. Tamper-evident.           |
                 |  Transfers on sale.                     |
                 |                                         |
                 |  Owners - Buyers - Sellers      (free)  |
                 +--------------------+--------------------+
                                      |
                       events written as a by-product
                                      |
                 +--------------------+--------------------+
                 |          CARNET WORKSHOP                |
                 |                                         |
                 |  Booking > Job > Inspection > Estimate  |
                 |  > Approval > Parts > Work > QC         |
                 |  > Invoice > Payment > Ledger           |
                 |                                         |
                 |  Workshops - Technicians - Owners (paid)|
                 +-----------------------------------------+
```

**Carnet Workshop** is the business we sell. It is a workshop management system
with a real ERP underneath it: every operational act posts its financial
consequence automatically, so the owner sees job-level profitability rather
than just an invoice total.

**Carnet Passport** is the network we build. Every job a workshop completes
writes verified, attributed, immutable events to the vehicle's timeline:

```
CAR  (VIN WBAJA9C509G000000)
|
+-- Ownership          who held it, and when
+-- Mileage            every reading ever recorded, monotonic-checked
+-- Repairs            what failed, what was done, by whom
+-- Parts              exactly which part number went in, and when
+-- Accidents          damage, assessment, repair
+-- Inspections        every checklist result, with photographs
+-- Tires              fitted, rotated, replaced, tread depths
+-- Recalls            campaign issued, campaign performed
+-- Modifications      what was changed from factory
+-- Maintenance        services performed against the schedule
```

When the car is sold, **the history goes with the car.** The seller hands over a
passport. The buyer reads twenty years of evidence.

## 4. Why this wins where others have not

Every vehicle-history network faces the same cold-start problem: the history is
worthless until coverage is high, and nobody contributes until it is valuable.

Carnet's answer is that **contribution is not a favour, it is a side effect.**

```
  Workshop adopts Carnet because it is better workshop software
              |
              v
  Workshop runs its jobs in Carnet (self-interested, daily)
              |
              v
  Each completed job writes verified events to that vehicle's passport
              |
              v
  Coverage rises without anyone doing extra data entry
              |
              v
  Passports become valuable, so owners ask their workshop for one
              |
              v
  Owners prefer workshops that can issue one  ---+
              |                                  |
              v                                  |
  Workshops adopt Carnet to keep those owners ---+
```

Two further mechanisms compound it:

1. **Revenue share.** When a passport is sold as a verified report at the point
   of vehicle sale, the workshops whose work populated it are paid a share.
   Contributing data becomes a revenue line, not an act of charity.
2. **Portability as a feature, not a threat.** A workshop's instinctive fear is
   that sharing history helps a competitor. In practice the workshop that holds
   the relationship wins: the passport shows the buyer exactly who maintained
   the car well, and links to them.

## 5. What we are not building

Naming these keeps the scope honest.

- **Not a blockchain.** Tamper-evidence is achieved with a hash-linked
  append-only event log, see
  [ADR-0005](../03-adr/0005-append-only-vehicle-event-ledger.md). Distributed
  consensus solves a problem we do not have, and adds cost, latency and
  regulatory exposure we cannot justify.
- **Not a general-purpose ERP.** We build the accounting a workshop actually
  needs and integrate with Xero and QuickBooks for the rest. We are not
  competing with SAP.
- **Not a marketplace.** We do not sell parts or broker repairs. That would put
  us in competition with our own customers.
- **Not a diagnostic tool.** We record what the technician found. We do not read
  the OBD bus in version 1.

## 6. What winning looks like

| Horizon       | Measure of success                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **12 months** | 50 paying workshops, running software they would refuse to give up. 20,000 vehicles carrying at least one verified event.                  |
| **24 months** | 400 workshops. 250,000 vehicles. A meaningful share of second-hand sales in one region where the buyer asks for a Carnet passport by name. |
| **48 months** | A passport is a normal part of a private vehicle sale. Insurers price against it. A vehicle without one is the one that raises questions.  |

The end state, stated plainly:

> **The history becomes part of the vehicle's identity. Not the owner's. Not the
> workshop's. The car's.**

## 7. Principles

These are the tie-breakers when a design decision is genuinely balanced.

1. **The car is the subject.** Every record answers "what happened to this
   vehicle", never "what did this workshop do this month". Reporting is a
   projection of the timeline, not the other way round.
2. **The technician's time is the scarcest resource.** If a screen costs a
   mechanic thirty seconds of fiddling, it will not be used, and the data will
   not exist. Shop-floor UI is designed for gloved hands on a tablet.
3. **Never make someone re-enter what the system already knows.** A VIN entered
   once populates make, model, year, engine and open recalls.
4. **Truth is append-only.** Corrections are new events that supersede old ones.
   Nothing is silently rewritten, because a history you can quietly edit is a
   history no buyer can trust.
5. **The owner controls disclosure.** The workshop writes events; the owner
   decides who may read the timeline. Consent is explicit, scoped and revocable.
6. **Every operational act has a financial consequence, posted automatically.**
   No parallel bookkeeping, no month-end reconciliation of the same facts.

---

_Next: [Proposal](02-proposal.md)._
