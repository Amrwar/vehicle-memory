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

Phase 2 and 3 tables exist in the first migration even though their features
are not built. Adding tables later is cheap; restructuring live data is not,
and the relationships between a part line, a stock movement and a ledger
posting are easier to get right when designed together.

## 2. Keys and identity

| Table | Natural key | Why |
| --- | --- | --- |
| `vehicles` | `vin` unique **globally** | ADR-0004. Two workshops servicing one car operate on one row. |
| `vehicle_events` | `(vehicleId, sequence)` unique | The chain has a total order per vehicle. |
| `jobs` | `(orgId, number)` unique | Job numbers are per workshop and human-quoted. |
| `invoices` | `(orgId, number)` unique | Gapless per organisation, a legal requirement. |
| `memberships` | `(userId, orgId)` unique | One role per person per organisation. |

Surrogate primary keys are cuid values. They are unguessable enough to appear
in URLs, and they sort roughly by creation time, which helps index locality.

## 3. Indexing

Every index exists for a query someone actually runs.

| Index | Serves |
| --- | --- |
| `jobs (orgId, status)` | Dashboard counts, job list filtered by status |
| `jobs (orgId, createdAt desc)` | Job list default order |
| `bookings (locationId, startAt)` | Diary week view |
| `bookings (bayId, startAt)` | Bay lane rendering and clash detection |
| `vehicle_events (vehicleId, occurredAt desc)` | Passport timeline |
| `odometer_readings (vehicleId, readAt desc)` | Latest reading, anomaly assessment |
| `customers gin (displayName)` trigram | Name search while a customer is on the phone |
| `vehicles gin (registration)`, `gin (vin)` | Registration and VIN lookup |
| `outbox_events (processedAt, availableAt)` | Worker poll |

The trigram indexes are not decoration. NFR-102 gives a 400ms budget for a list
view, and a service advisor searching "okon" while someone waits on the line is
the query that budget exists for.

## 4. Event payload shapes

`VehicleEvent.payload` is JSON because event types carry genuinely different
detail. The shape per type is a contract, verified in `packages/core`:

| Type | Payload |
| --- | --- |
| `SERVICE` / `REPAIR` | `{ jobId, jobNumber, workshop, description, diagnosis, jobTypes[], labour[], totalHours }` |
| `PART_FITTED` | `{ jobId, description, partNumber, quantity, workshop }` |
| `INSPECTION` | `{ jobId, inspectionId, passCount, advisoryCount, criticalCount, performedBy, workshop }` |
| `MILEAGE_READING` | `{ km, source, anomaly }` |
| `OWNERSHIP_TRANSFER` | `{ from, to, transferId }` |
| `TIRE` | `{ brand, size, positions[] }` |
| `ACCIDENT` | `{ severity, writeOff, insurerAssessed }` |
| `RECALL_NOTICE` / `RECALL_PERFORMED` | `{ campaignRef }` |

The payload is part of the hash, so its canonical serialisation must be stable.
That is why `canonicalise()` sorts keys at every level rather than relying on
`JSON.stringify`.

## 5. Money and quantity precision

| Use | Type |
| --- | --- |
| Prices, totals, tax | `NUMERIC(12,2)` |
| Unit cost | `NUMERIC(12,4)` — supplier costs carry more precision than sell prices |
| Ledger amounts | `NUMERIC(14,2)` |
| Quantities | `NUMERIC(12,3)` — fluids and part-hours |
| Hours | `NUMERIC(8,2)` |
| Tax rates | `NUMERIC(6,3)` |

Never `float8`. See [ADR-0008](../03-adr/0008-money-as-integer-minor-units.md).

## 6. Constraints the schema language cannot express

Implemented in `20260909000100_invariants` and verified by
`infra/scripts/verify-integrity.ts`, which actively tries to break each one:

| Guarantee | Mechanism |
| --- | --- |
| Vehicle events are append-only | `BEFORE UPDATE OR DELETE` trigger; only `supersededById` may be set, once |
| Audit log is immutable | `BEFORE UPDATE OR DELETE` trigger |
| One open ownership per vehicle | Partial unique index `WHERE endedAt IS NULL` |
| One open time entry per technician | Partial unique index `WHERE endedAt IS NULL` |
| Payments never exceed the invoice | Deferred constraint trigger |
| Journal entries balance | Deferred constraint trigger, checked at commit |
| A journal line is a debit or a credit | `CHECK` constraint |
| Odometer readings are non-negative | `CHECK` constraint |
| Booking ends after it starts | `CHECK` constraint |

## 7. Deletion

Operational records are hard-deleted; there are no `deletedAt` columns. A
soft-delete flag is forgotten from a filter exactly once, and the result is a
cross-tenant leak. History is preserved by the audit log and the append-only
passport, which are better suited to it than a flag on every table.

Cascade rules follow ownership: deleting an organisation removes its
tenant-scoped records; deleting a vehicle cascades to its events, which is
permitted only in development and never through the application.

---

*Next: [Architecture](03-architecture.md).*
