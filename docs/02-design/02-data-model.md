# Data Model

73 tables across five bounded contexts. The authoritative definition is
`packages/db/prisma/schema.prisma`; this document explains the parts of it that
are not obvious from reading the schema.

## 1. Shape

```
  IDENTITY                        PASSPORT  (global, no orgId)
  ---------                       ------------------------------
  Organization                    Vehicle
   +- Location                     +- VehicleEvent      append-only, hash-linked
   |   +- Bay                      +- VehicleOwnership  one open per vehicle
   +- Membership -- User           +- OdometerReading   anomalies kept, not rejected
   +- Session                      +- VehicleAccessGrant
   +- AuditLog       immutable     +- PassportShare
   +- OutboxEvent                  |   +- PassportShareAccess
                                   +- VehicleRecall -- Recall
                                   +- ServiceSchedule

  WORKSHOP  (orgId)                              FINANCE  (orgId)
  -----------------                              ----------------
  Customer                                       TaxRate
  Booking ------------+                          DocumentSequence  gapless
                      v                          Invoice
  Job  <-- the central aggregate                  +- InvoiceLine
   +- JobTechnician    +- JobLabourLine           +- Payment
   +- JobJobType       +- JobPartLine             CreditNote
   +- JobTag           +- JobFeeLine
   +- JobStatusEvent   +- JobNote                 INVENTORY  (orgId, Phase 2)
   +- JobTask          +- JobAttachment           -------------------------
   +- TimeEntry        +- JobFollowUp             Product -- ProductCategory
   +- QualityCheck                                StockLevel / StockMovement
   +- Inspection                                  StockReservation
   |   +- InspectionResult                        Warehouse
   |       +- InspectionPhoto                     Supplier
   +- Estimate                                    PurchaseRequest -> PurchaseOrder
   |   +- EstimateLine                             +- PurchaseOrderLine
   |   +- EstimateShare                            +- GoodsReceipt
   |   +- EstimateApproval                        SupplierBill
   +- Invoice
                                                  ACCOUNTING  (orgId, Phase 3)
                                                  --------------------------
                                                  Account (tree)
                                                  FiscalPeriod
                                                  JournalEntry -- JournalLine
```

Phase 2 and 3 tables existed in the first migration before their features were
built. Adding tables later is cheap; restructuring live data is not, and the
relationships between a part line, a stock movement and a ledger posting are
easier to get right when designed together.

The diagram is the shape as first drawn. Later phases added to it without
moving anything in it; the additions, by context:

| Context  | Added since                                                                                                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passport | `VehicleClaim` (a person asking to have a car on their account), `VehicleDocument` (paperwork, kind-typed, removable with a reason), `Warranty`, condition and prediction tables                                                    |
| Workshop | `Employee`, `WorkingPattern`, `Absence`, `Skill`, `EmployeeSkill`, `JobTypeSkill`, `Timesheet`, `PayrollRun`, `FleetAgreement`, `Location.opensAtMinute/closesAtMinute`, `Customer.preferredTechnicianUserId`, `BookingSource.PLAN` |
| Finance  | `Refund`, `CreditNote`, `SupplierPayment` and its allocations, `BankAccount`, `BankTransaction`, `Expense`, `CounterSale`, `TillSession`                                                                                            |
| Identity | `ApiKey` (digest only, revocable), `AuthToken` (reset and verification, digest only), `MessageLog`, `SuppressedAddress`, `ConsentEvent`                                                                                             |

`packages/db/prisma/schema.prisma` is the authority; this table says where to
look, not what every column is.

## 2. Keys and identity

| Table            | Natural key                    | Why                                                           |
| ---------------- | ------------------------------ | ------------------------------------------------------------- |
| `vehicles`       | `vin` unique **globally**      | ADR-0004. Two workshops servicing one car operate on one row. |
| `vehicle_events` | `(vehicleId, sequence)` unique | The chain has a total order per vehicle.                      |
| `jobs`           | `(orgId, number)` unique       | Job numbers are per workshop and human-quoted.                |
| `invoices`       | `(orgId, number)` unique       | Gapless per organisation, a legal requirement.                |
| `memberships`    | `(userId, orgId)` unique       | One role per person per organisation.                         |

Surrogate primary keys are cuid values. They are unguessable enough to appear
in URLs, and they sort roughly by creation time, which helps index locality.

## 3. Indexing

Every index exists for a query someone actually runs.

| Index                                         | Serves                                        |
| --------------------------------------------- | --------------------------------------------- |
| `jobs (orgId, status)`                        | Dashboard counts, job list filtered by status |
| `jobs (orgId, createdAt desc)`                | Job list default order                        |
| `bookings (locationId, startAt)`              | Diary week view                               |
| `bookings (bayId, startAt)`                   | Bay lane rendering and clash detection        |
| `vehicle_events (vehicleId, occurredAt desc)` | Passport timeline                             |
| `odometer_readings (vehicleId, readAt desc)`  | Latest reading, anomaly assessment            |
| `customers gin (displayName)` trigram         | Name search while a customer is on the phone  |
| `vehicles gin (registration)`, `gin (vin)`    | Registration and VIN lookup                   |
| `outbox_events (processedAt, availableAt)`    | Worker poll                                   |

The trigram indexes are not decoration. NFR-102 gives a 400ms budget for a list
view, and a service advisor searching "okon" while someone waits on the line is
the query that budget exists for.

## 4. Event payload shapes

`VehicleEvent.payload` is JSON because event types carry genuinely different
detail. The shape per type is a contract, verified in `packages/core`:

| Type                                 | Payload                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `SERVICE` / `REPAIR`                 | `{ jobId, jobNumber, workshop, description, diagnosis, jobTypes[], labour[], totalHours }` |
| `PART_FITTED`                        | `{ jobId, description, partNumber, quantity, workshop }`                                   |
| `INSPECTION`                         | `{ jobId, inspectionId, passCount, advisoryCount, criticalCount, performedBy, workshop }`  |
| `MILEAGE_READING`                    | `{ km, source, anomaly }`                                                                  |
| `OWNERSHIP_TRANSFER`                 | `{ from, to, transferId }`                                                                 |
| `TIRE`                               | `{ brand, size, positions[] }`                                                             |
| `ACCIDENT`                           | `{ severity, writeOff, insurerAssessed }`                                                  |
| `RECALL_NOTICE` / `RECALL_PERFORMED` | `{ campaignRef }`                                                                          |

The payload is part of the hash, so its canonical serialisation must be stable.
That is why `canonicalise()` sorts keys at every level rather than relying on
`JSON.stringify`.

## 5. Money and quantity precision

| Use                 | Type                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| Prices, totals, tax | `NUMERIC(12,2)`                                                        |
| Unit cost           | `NUMERIC(12,4)` — supplier costs carry more precision than sell prices |
| Ledger amounts      | `NUMERIC(14,2)`                                                        |
| Quantities          | `NUMERIC(12,3)` — fluids and part-hours                                |
| Hours               | `NUMERIC(8,2)`                                                         |
| Tax rates           | `NUMERIC(6,3)`                                                         |

Never `float8`. See [ADR-0008](../03-adr/0008-money-as-integer-minor-units.md).

## 6. Constraints the schema language cannot express

Implemented in `20260909000100_invariants` and verified by
`infra/scripts/verify-integrity.ts`, which actively tries to break each one:

| Guarantee                                                                                        | Mechanism                                                                                                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Vehicle events are append-only                                                                   | `BEFORE UPDATE OR DELETE` trigger; only `supersededById` may be set, once                                          |
| Audit log is immutable                                                                           | `BEFORE UPDATE OR DELETE` trigger                                                                                  |
| One open ownership per vehicle                                                                   | Partial unique index `WHERE endedAt IS NULL`                                                                       |
| One open time entry per technician                                                               | Partial unique index `WHERE endedAt IS NULL`                                                                       |
| Payments never exceed the invoice                                                                | Deferred constraint trigger                                                                                        |
| Journal entries balance                                                                          | Deferred constraint trigger, checked at commit                                                                     |
| A journal line is a debit or a credit                                                            | `CHECK` constraint                                                                                                 |
| Odometer readings are non-negative                                                               | `CHECK` constraint                                                                                                 |
| Booking ends after it starts                                                                     | `CHECK` constraint                                                                                                 |
| A paid timesheet is final                                                                        | `BEFORE UPDATE OR DELETE` trigger `timesheets_paid_are_final`                                                      |
| A refund, a credit and a refusal carry a reason                                                  | `CHECK` constraints on `refunds`, `credit_notes` and `vehicle_claims`                                              |
| One open claim per person per vehicle                                                            | Partial unique index `vehicle_claims_one_open_each`                                                                |
| A key is named                                                                                   | `CHECK api_keys_are_named`                                                                                         |
| A site opens before it closes                                                                    | `CHECK locations_open_before_close`                                                                                |
| A document is named, has bytes, expires after issue, and is removed with a reason                | Four `CHECK` constraints on `vehicle_documents`                                                                    |
| Consent history is append-only                                                                   | `BEFORE UPDATE OR DELETE` trigger                                                                                  |
| A loyalty entry moves something and says why; only awards expire                                 | `CHECK` constraints `loyalty_entries_move_something`, `loyalty_entries_only_awards_expire`                         |
| A referral pays once, to two different people                                                    | Partial unique index and `CHECK` on `referrals`                                                                    |
| A gift card is sold for something; every entry on it moves something and says why                | `CHECK` constraints `gift_cards_sold_for_something`, `gift_card_entries_move_something`                            |
| A gift card entry's kind agrees with its sign; a cancelled card names its reason                 | `CHECK` constraints `gift_card_entries_kind_matches_sign`, `gift_cards_cancelled_with_a_reason`                    |
| A deposit is taken for something and is never overdrawn; a movement moves something and says why | `CHECK` constraints `deposits_taken_for_something`, `deposits_never_overdrawn`, `deposit_movements_move_something` |

## 6.5 Region (Phase 29)

The organisation carries `country`, `baseCurrency`, `locale` and `timezone`.
The first is a decision and the other three follow it at sign-up from the
country table in core, then stand on their own so an owner can differ. Every
money column on a document carries its own `currency`, written from the
organisation's at the moment the document is raised, so a workshop that
changes currency keeps its old bills honest. There is one currency per set
of books; multi-currency inside a workshop is deliberately not modelled.

## 7. Deletion

Operational records are hard-deleted; there are no `deletedAt` columns. A
soft-delete flag is forgotten from a filter exactly once, and the result is a
cross-tenant leak. History is preserved by the audit log and the append-only
passport, which are better suited to it than a flag on every table.

Three deliberate exceptions, each a state rather than a hidden delete, and each
read through one function that applies the filter: an `ApiKey` is revoked
(`revokedAt`), because the list of keys must still name what was revoked and
when; a `VehicleDocument` is removed (`removedAt`, with a reason the database
insists on), because a scan of the wrong car is a mistake and the removal is
history; and a bay, tax rate or kind of work is retired (`isActive`), because
old work must keep reading the way it did.

Cascade rules follow ownership: deleting an organisation removes its
tenant-scoped records; deleting a vehicle cascades to its events, which is
permitted only in development and never through the application.

---

_Next: [Architecture](03-architecture.md)._
