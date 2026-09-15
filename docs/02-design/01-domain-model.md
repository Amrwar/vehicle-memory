# Domain Model

## 1. Bounded contexts

The system is not one model. It is five, with deliberate boundaries between
them. Getting these boundaries right is the single most consequential design
decision in the project, because the wrong ones produce a schema where every
change touches everything.

```
  +---------------------------------------------------------------+
  |                    VEHICLE PASSPORT                           |
  |                                                               |
  |  Vehicle - VehicleEvent - Ownership - Share - Recall          |
  |                                                               |
  |  Global. Not tenant-scoped. Append-only. Outlives every       |
  |  relationship in every other context.                         |
  +----------------------------+----------------------------------+
                               ^
                               | writes events, reads history
                               |
  +----------------------------+----------------------------------+
  |                       WORKSHOP                                |
  |                                                               |
  |  Customer - Booking - Job - Inspection - Estimate - Task       |
  |                                                               |
  |  Tenant-scoped. The operational heart. The Job is the         |
  |  aggregate everything else attaches to.                       |
  +------+----------------------------------------------+---------+
         |                                              |
         | consumes parts                               | produces revenue
         v                                              v
  +--------------------+                    +-------------------------+
  |     INVENTORY      |                    |        FINANCE          |
  |                    |                    |                         |
  |  Product           |                    |  Invoice - Payment      |
  |  StockLevel        |   supplier bills   |  Account - Journal      |
  |  StockMovement     +------------------> |  TaxRate - Period       |
  |  PurchaseOrder     |                    |                         |
  |  Supplier          |                    |  Tenant-scoped.         |
  +--------------------+                    +-------------------------+

  +---------------------------------------------------------------+
  |                        IDENTITY                               |
  |  Organization - Location - User - Membership - Session         |
  |  Cross-cutting. Every other context depends on it.             |
  +---------------------------------------------------------------+
```

Two contexts were added later without moving the boundaries above. **People**
(employees, skills, working patterns, timesheets, payroll runs) sits beside the
workshop and feeds the planner and the ledger. **Access** (grants, claims,
shares, API keys) sits between the passport and everything else: it is the
one place that answers "may this organisation or person read this vehicle",
and the network of Phase 18 is that question asked between workshops.

### The boundary that matters most

**Vehicle Passport is not tenant-scoped. Everything else is.**

This is the structural decision the whole product rests on. A vehicle is not
owned by a workshop; it is merely serviced by one, for a while. Modelling
`Vehicle` inside the workshop tenant, which is what every incumbent does, makes
portable history impossible without a migration that touches every row.

The consequence is a discipline: **the workshop context may write events to a
vehicle and may read them subject to disclosure rules, but it never owns the
vehicle record.** Access is mediated, always.

## 2. The ubiquitous language

Terms used in code exactly as defined here. Where the industry uses a word
loosely, we pick one meaning and hold it.

| Term             | Definition                                                                                                           | Not to be confused with                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Vehicle**      | A physical car, identified by VIN, existing independently of any owner or workshop.                                  | The customer's record of it                    |
| **Passport**     | The complete, append-only event history of one vehicle.                                                              | A report, which is a rendering of it           |
| **Event**        | One immutable fact about a vehicle at a point in time.                                                               | A job, which is workshop work                  |
| **Customer**     | A party, person or company, in a commercial relationship with one workshop.                                          | Owner                                          |
| **Owner**        | The party who holds the vehicle during a period. May not be a customer of anyone.                                    | Customer                                       |
| **Booking**      | A reserved future slot.                                                                                              | Job                                            |
| **Job**          | One visit's work on one vehicle. The central operational aggregate.                                                  | Booking, invoice                               |
| **Inspection**   | A structured assessment producing per-item results.                                                                  | Diagnosis                                      |
| **Diagnosis**    | The technician's conclusion about a fault.                                                                           | Inspection                                     |
| **Finding**      | One inspection item result requiring action.                                                                         | Recommendation                                 |
| **Estimate**     | A priced proposal requiring customer approval.                                                                       | Quote, invoice                                 |
| **Approval**     | A recorded customer decision on an estimate.                                                                         | Acceptance of the work                         |
| **Labour line**  | Time to be charged, at a rate.                                                                                       | Time entry                                     |
| **Time entry**   | Actual clocked time, used for cost.                                                                                  | Labour line                                    |
| **Part line**    | A part to be charged on a job.                                                                                       | Stock movement                                 |
| **Invoice**      | An issued, immutable demand for payment.                                                                             | Estimate                                       |
| **Bay**          | A physical work position. Constrains scheduling.                                                                     | Location                                       |
| **Location**     | A physical site within an organisation.                                                                              | Organisation                                   |
| **Organisation** | The tenant. One business.                                                                                            | Location                                       |
| **Access grant** | An organisation's entitlement to read or write one vehicle, earned by servicing it or by taking it on.               | A share, which is for a person with no account |
| **Network**      | Vehicles found across workshops by plate or VIN, with each workshop's commercial detail withheld from the others.    | A marketplace, deliberately not built          |
| **Claim**        | A person's request to have a vehicle on their own account, decided by the workshop that last serviced it.            | Ownership transfer                             |
| **Document**     | A piece of the vehicle's paperwork: certificate, insurance, receipt or photograph. Belongs to the car.               | An event, which is a fact about work done      |
| **API key**      | An organisation's credential for reading its own records without a person signed in. Shown once, stored as a digest. | A session                                      |

Two distinctions earn their keep:

- **Labour line versus time entry.** The customer is charged 3.5 hours because
  that is the book time. The technician actually took 4.2 hours. Both are true
  and both are needed: the first is revenue, the second is cost. Conflating
  them makes profitability unmeasurable, which is precisely the failure of the
  incumbent systems.
- **Customer versus owner.** A fleet operator is the customer; the driver may
  be the registered keeper; the finance company may be the legal owner. The
  passport tracks ownership; the workshop tracks who pays.

## 3. Aggregates and invariants

An aggregate is a consistency boundary. Everything inside is updated in one
transaction; everything outside is eventually consistent.

### 3.1 Vehicle aggregate (Passport context)

**Root:** `Vehicle` · **Contains:** `VehicleEvent`, `VehicleOwnership`,
`OdometerReading`

| #   | Invariant                                                       | Enforced by                                       |
| --- | --------------------------------------------------------------- | ------------------------------------------------- |
| V1  | VIN is globally unique                                          | Database unique index                             |
| V2  | Events are append-only. No update, no delete, ever.             | Repository refuses; no update path exists in code |
| V3  | Each event's hash covers its content and its predecessor's hash | `chain.ts`, verified in tests                     |
| V4  | Events are totally ordered per vehicle by sequence number       | Unique index on (vehicleId, sequence)             |
| V5  | At most one open ownership at a time                            | Partial unique index where `endedAt is null`      |
| V6  | A correction is a new event referencing the superseded one      | `supersede()` is the only correction path         |
| V7  | An odometer decrease is recorded and flagged, never rejected    | `mileage.ts`                                      |

V7 deserves a note. The intuitive design rejects impossible readings. That is
wrong: an odometer that goes backwards is either a clerical error or **odometer
fraud**, and the second is exactly the thing a buyer most needs to see.
Rejecting the reading deletes the evidence. We record it and flag it.

### 3.2 Job aggregate (Workshop context)

**Root:** `Job` · **Contains:** `JobStatusEvent`, `JobTask`, `JobLabourLine`,
`JobPartLine`, `JobNote`, `JobAttachment`, `TimeEntry`, `QualityCheck`

| #   | Invariant                                                                 | Enforced by                             |
| --- | ------------------------------------------------------------------------- | --------------------------------------- |
| J1  | Status changes only along permitted transitions                           | `lifecycle.ts` state machine            |
| J2  | Every status change records actor and time                                | Transition function is the only mutator |
| J3  | A job belongs to exactly one vehicle and one customer                     | Non-null foreign keys                   |
| J4  | Totals are derived from lines, never stored independently                 | Computed in `totals.ts`                 |
| J5  | A technician has at most one open time entry                              | Partial unique index                    |
| J6  | Completion requires a passed quality check where the job type demands one | Lifecycle guard                         |
| J7  | Completion writes passport events                                         | Transactional outbox, retried           |

J7 is deliberately _not_ a synchronous invariant. If passport writing fails,
the job still completes and the write is retried. A workshop losing a completed
job because a downstream write failed is unacceptable; a passport event
arriving ninety seconds late is not a problem.

### 3.3 Estimate aggregate

**Root:** `Estimate` · **Contains:** `EstimateLine`, `EstimateApproval`,
`EstimateShare`

| #   | Invariant                                                  | Enforced by                        |
| --- | ---------------------------------------------------------- | ---------------------------------- |
| E1  | A sent estimate is immutable; changes create a new version | `revise()` returns a new aggregate |
| E2  | Approval records the exact total agreed at that moment     | Snapshot stored on approval        |
| E3  | Line-level decisions sum to the recorded approved total    | Checked on approval                |
| E4  | A share token is single-vehicle, expiring, revocable       | `share.ts`                         |

### 3.4 Invoice aggregate (Finance context)

**Root:** `Invoice` · **Contains:** `InvoiceLine`, `Payment`

| #   | Invariant                                              | Enforced by                                |
| --- | ------------------------------------------------------ | ------------------------------------------ |
| I1  | An issued invoice is immutable                         | Status guard; corrections are credit notes |
| I2  | Numbers are sequential and gapless per organisation    | `DocumentSequence` row lock                |
| I3  | Payments never exceed the invoice total                | Checked on payment                         |
| I4  | Paid status is derived from payments, not set directly | Computed                                   |

I2 requires a row-level lock rather than a sequence, because a database
sequence produces gaps on rollback, and gapless numbering is a legal
requirement in several jurisdictions (NFR-902).

### 3.5 Stock aggregate (Inventory context, Phase 2)

**Root:** `Product` · **Contains:** `StockLevel`, `StockMovement`,
`StockReservation`

| #   | Invariant                                   | Enforced by          |
| --- | ------------------------------------------- | -------------------- |
| S1  | On-hand equals the sum of movements         | Reconciliation check |
| S2  | Available equals on-hand minus reservations | Computed             |
| S3  | Reservations never exceed available         | Checked under lock   |
| S4  | Every movement names its cause              | Non-null reference   |

### 3.6 Loyalty and referral (Retention context, Phases 24 and 25)

**Root:** `Customer` · **Contains:** `LoyaltyEntry`, `Referral`

| #   | Invariant                                                          | Enforced by                                        |
| --- | ------------------------------------------------------------------ | -------------------------------------------------- |
| L1  | The balance is the sum of the entries, never a stored figure       | Computed; no balance column exists                 |
| L2  | A bill paid in full earns once, on the money actually paid         | Idempotency on the invoice; points earn no points  |
| L3  | A redemption is refused, never clamped                             | `assertRedeemable` in core                         |
| L4  | A referral pays both sides once, only after the newcomer has spent | `assertCreditable`, one transaction for both sides |
| L5  | A person is introduced at most once, and never by themselves       | Checked on use                                     |

### 3.7 Gift card (Finance context, Phase 26)

**Root:** `GiftCard` · **Contains:** `GiftCardEntry`

| #   | Invariant                                                                  | Enforced by                                    |
| --- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| G1  | The balance is the sum of the entries                                      | Computed                                       |
| G2  | Sold for whole pounds between a floor and a ceiling, paid for with money   | `assertCardSellable`; never points or a card   |
| G3  | A card is a liability until spent, and a redemption never touches the bank | Postings 3.14 and 3.15                         |
| G4  | A redemption is refused, never clamped, and spends nothing on a refusal    | `assertCardRedeemable`, checked before writing |

### 3.7.5 Money held (Finance context, Phase 30)

**Root:** `Deposit` · **Contains:** `DepositMovement`

| #   | Invariant                                                          | Enforced by                          |
| --- | ------------------------------------------------------------------ | ------------------------------------ |
| D1  | Held is what came in less what went out; never stored              | Computed; `deposits_never_overdrawn` |
| D2  | A deposit is a liability until an invoice takes it or it goes back | Postings 3.17                        |
| D3  | Applying is refused, never clamped, and never exceeds held or owed | `assertDepositApplicable`            |
| D4  | Money goes back with a reason, the way money goes                  | `assertDepositReturnable`            |

### 3.8 Region (Phase 29)

Not an aggregate: a value on the organisation, carried on the session and
read by every page. The invariant is that no figure or date reaches a person
formatted by a default. The country table is the only place a country's
currency, locale, timezone and first tax rate are written down.

### 3.9 Subscription (Phase 31)

Not an aggregate either: a state read from four dates on the organisation,
carried on the session. The invariant is that a read-only workshop can lose
nothing: every write is turned away at the guard, every read and export
still answers, and choosing a plan restores writing without touching a
record. The plan's limits and features are asserted inside the function
that makes or does the thing, so a page that forgets its wall changes what
somebody sees and never what they can do.

### 3.10 Payment attempt (Finance context, Phase 32)

An aggregate of one row: a try at paying some of an invoice through the
provider. Its invariant is that the money is recorded exactly once, at the
move to succeeded, and that the provider is a witness and never the record.
The provider sits behind a seam of four calls in core (`PaymentProvider`);
the rules about what can be tried, how an attempt moves, what can go back
through the provider and what differs between the two records are pure
functions in `packages/core/src/payments`, tested without a provider.

### 3.11 Import (Phase 33)

Not a context of its own: a door into the others. An import batch holds a
file as it came and a mapping; the rules for reading a cell, suggesting a
mapping and validating a row are pure functions in
`packages/core/src/importing`, and the import itself calls the same
functions the pages call, so an imported customer is exactly a customer and
the invariants of each context hold for imported rows as for typed ones.
Opening balances are the exception that proves it: they post as one
balanced journal entry through `postEntry`, which refuses an unbalanced one.

## 4. Cross-context communication

Contexts communicate through domain events, not by reaching into each other's
tables.

```
  WORKSHOP                        PASSPORT
  Job.completed  ------------->   append service event
                                  append part events
                                  append inspection event
                                  append mileage reading

  WORKSHOP                        INVENTORY
  PartLine.added ------------->   reserve stock
  Job.completed  ------------->   consume reservation, record cost

  INVENTORY                       FINANCE
  Stock.consumed ------------->   post cost of goods sold

  FINANCE                         WORKSHOP
  Payment.recorded ----------->   advance job to Paid

  WORKSHOP                        FINANCE
  Invoice.issued  ------------>   post receivable and revenue
```

Delivery uses a **transactional outbox**: the domain event is written in the
same transaction as the state change, then dispatched by the worker. This gives
at-least-once delivery, so every handler must be idempotent. See
[ADR-0007](../03-adr/0007-transactional-outbox.md).

## 5. What we deliberately did not model

| Rejected                                                                | Why                                                                                                                                                                                         |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A `Party` supertype for Customer, Supplier and Employee                 | Elegant in theory. In practice it forces a join for every read of a customer name, and the three have almost no shared behaviour.                                                           |
| Event sourcing for the whole system                                     | We event-source the vehicle, where immutability is the product. Event-sourcing the diary would make "move this booking" needlessly hard.                                                    |
| A generic `Document` supertype for estimate, invoice and purchase order | Their lifecycles differ materially. The abstraction leaks immediately.                                                                                                                      |
| Soft deletes everywhere                                                 | Deleted-flag filtering is forgotten exactly once and then leaks data across tenants. We hard-delete operational records and rely on the audit log and the append-only passport for history. |
| Storing computed totals on the job                                      | The first time a line changes and the total does not, trust is gone. Totals are derived.                                                                                                    |

---

_Next: [Data model](02-data-model.md)._
