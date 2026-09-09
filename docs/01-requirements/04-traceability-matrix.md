# Traceability Matrix

Every Phase 1 requirement traced from statement to implementation to test. A
requirement with no test is not a requirement, it is a hope.

**How to use this.** When a requirement changes, this table names everything
that must change with it. When a test fails, it names what the failure means
commercially.

Legend: **Done** implemented and tested · **Partial** implemented, test gap
recorded · **Planned** in a later phase.

---

## Foundation

| Req    | Story | Schema              | Implementation                      | Test                   | Status     |
| ------ | ----- | ------------------- | ----------------------------------- | ---------------------- | ---------- |
| FR-101 | A2    | `Organization`      | `packages/db/src/tenant.ts`         | `tenant-scope.test.ts` | Done       |
| FR-102 | A2    | —                   | `forOrg()` scoped client            | `tenant-scope.test.ts` | Done       |
| FR-103 | A1    | `User`, `Session`   | `apps/web/src/lib/auth/*`           | `password.test.ts`     | Done       |
| FR-104 | A1    | `User.passwordHash` | `lib/auth/password.ts`              | `password.test.ts`     | Done       |
| FR-105 | A1    | `Session.expiresAt` | `lib/auth/session.ts`               | `session.test.ts`      | Done       |
| FR-106 | A3    | `Membership.role`   | `packages/core/src/access/roles.ts` | `roles.test.ts`        | Done       |
| FR-107 | A3    | —                   | `can()` deny-by-default             | `roles.test.ts`        | Done       |
| FR-109 | A4    | `AuditLog`          | `lib/audit.ts`                      | `audit.test.ts`        | Done       |
| FR-110 | A1    | `LoginAttempt`      | `lib/auth/rate-limit.ts`            | `rate-limit.test.ts`   | Done       |
| FR-111 | —     | `Location`          | schema only                         | —                      | Planned P4 |

## Customers and vehicles

| Req        | Story | Schema                    | Implementation                  | Test                   | Status                                      |
| ---------- | ----- | ------------------------- | ------------------------------- | ---------------------- | ------------------------------------------- |
| FR-201–203 | B1    | `Customer`                | `app/(workshop)/customers`      | `customer.test.ts`     | Done                                        |
| FR-204     | B1    | `VehicleOwnership`        | `core/src/vehicle`              | `ownership.test.ts`    | Done                                        |
| FR-205     | B2    | —                         | customer detail page            | e2e `customer.spec.ts` | Done                                        |
| FR-206     | B1    | unique indexes            | `customer.ts` duplicate guard   | `customer.test.ts`     | Done                                        |
| FR-301     | B3    | `Vehicle.vin @unique`     | global uniqueness               | `vin.test.ts`          | Done                                        |
| FR-304     | B3    | —                         | `core/src/vehicle/vin.ts`       | `vin.test.ts`          | Done                                        |
| FR-305     | B3    | —                         | `lib/vin-decode.ts`             | `vin-decode.test.ts`   | Partial — stub decoder, real provider in P2 |
| FR-306–308 | B4    | `OdometerReading`         | `core/src/vehicle/mileage.ts`   | `mileage.test.ts`      | Done                                        |
| FR-309     | B3    | `VehicleOwnership`        | `core/src/vehicle/ownership.ts` | `ownership.test.ts`    | Done                                        |
| FR-311     | —     | `Recall`, `VehicleRecall` | schema + read model             | `recall.test.ts`       | Partial — no OEM feed yet                   |

## Vehicle passport

| Req        | Story | Schema                             | Implementation                  | Test                     | Status     |
| ---------- | ----- | ---------------------------------- | ------------------------------- | ------------------------ | ---------- |
| FR-401     | C2    | `VehicleEvent`                     | append-only repository          | `ledger.test.ts`         | Done       |
| FR-402     | C1    | `VehicleEvent.*`                   | `core/src/passport/event.ts`    | `ledger.test.ts`         | Done       |
| FR-403     | C2    | `VehicleEvent.hash`, `.prevHash`   | `core/src/passport/chain.ts`    | `chain.test.ts`          | Done       |
| FR-404     | C2    | —                                  | `verifyChain()`                 | `chain.test.ts`          | Done       |
| FR-405     | C1    | `VehicleEventType`                 | enum                            | `ledger.test.ts`         | Done       |
| FR-406     | C2    | `supersedesId`                     | `supersede()`                   | `chain.test.ts`          | Done       |
| FR-407     | C1    | `VerificationLevel`                | enum                            | `ledger.test.ts`         | Done       |
| FR-408     | C3    | —                                  | job completion writer           | `job-completion.test.ts` | Done       |
| FR-409     | C4    | `PassportShare`                    | share issue and revoke          | `share.test.ts`          | Done       |
| FR-410     | C4    | `PassportShareAccess`              | access logging                  | `share.test.ts`          | Done       |
| FR-411–412 | C5    | `VehicleOwnership`, transfer event | `core/src/passport/transfer.ts` | `transfer.test.ts`       | Done       |
| FR-413     | C1    | —                                  | timeline view                   | e2e `passport.spec.ts`   | Done       |
| FR-414     | —     | —                                  | —                               | —                        | Planned P5 |

## Booking, job, inspection, estimate

| Req        | Story | Schema                         | Implementation                       | Test                     | Status |
| ---------- | ----- | ------------------------------ | ------------------------------------ | ------------------------ | ------ |
| FR-501–502 | D1    | `Booking`, `Bay`               | diary views                          | e2e `diary.spec.ts`      | Done   |
| FR-504–505 | D2    | —                              | reschedule + capacity                | `capacity.test.ts`       | Done   |
| FR-506     | D3    | `Booking.jobId`                | convert action                       | `booking.test.ts`        | Done   |
| FR-601     | E1    | `Job` and relations            | job detail                           | e2e `job.spec.ts`        | Done   |
| FR-602–603 | E2    | `JobStatus`                    | `core/src/job/lifecycle.ts`          | `lifecycle.test.ts`      | Done   |
| FR-604     | E2    | `JobStatusEvent`               | transition recorder                  | `lifecycle.test.ts`      | Done   |
| FR-605     | E1    | `Job.*`                        | job form                             | `job.test.ts`            | Done   |
| FR-608–609 | E1    | `JobLabourLine`, `JobPartLine` | line editors                         | `totals.test.ts`         | Done   |
| FR-610     | E3    | `TimeEntry`                    | clock on/off                         | `time-entry.test.ts`     | Done   |
| FR-611     | E1    | —                              | `core/src/pricing/totals.ts`         | `totals.test.ts`         | Done   |
| FR-612     | E2    | `QualityCheck`                 | gate in lifecycle                    | `lifecycle.test.ts`      | Done   |
| FR-614     | C3    | —                              | completion writer                    | `job-completion.test.ts` | Done   |
| FR-701–704 | F1    | `Inspection*`                  | inspection capture                   | `inspection.test.ts`     | Done   |
| FR-705     | F3    | —                              | `core/src/inspection/to-estimate.ts` | `to-estimate.test.ts`    | Done   |
| FR-709     | F2    | `InspectionResult.measurement` | structured fields                    | `inspection.test.ts`     | Done   |
| FR-801–802 | G1    | `Estimate`, `EstimateLine`     | estimate builder                     | `totals.test.ts`         | Done   |
| FR-803–804 | G1    | `EstimateShare`                | secure link                          | `share.test.ts`          | Done   |
| FR-805–807 | G2    | `EstimateApproval`             | approval handler                     | `approval.test.ts`       | Done   |
| FR-812     | G3    | —                              | threshold check                      | `approval.test.ts`       | Done   |

## Invoicing, portal, reporting

| Req          | Story | Schema                   | Implementation       | Test                    | Status |
| ------------ | ----- | ------------------------ | -------------------- | ----------------------- | ------ |
| FR-901–903   | I1    | `Invoice`, `InvoiceLine` | invoice generation   | `invoice.test.ts`       | Done   |
| FR-902       | I1    | `DocumentSequence`       | gapless numbering    | `sequence.test.ts`      | Done   |
| FR-905–906   | I2    | `Payment`                | payment recording    | `invoice.test.ts`       | Done   |
| FR-907       | I1    | —                        | immutability guard   | `invoice.test.ts`       | Done   |
| FR-1301–1308 | J2    | —                        | portal routes        | e2e `portal.spec.ts`    | Done   |
| FR-1401–1402 | J1    | —                        | dashboard            | e2e `dashboard.spec.ts` | Done   |
| FR-1407      | —     | —                        | coverage report      | `coverage.test.ts`      | Done   |
| FR-1501–1502 | G1    | `MessageLog`             | notification service | `notify.test.ts`        | Done   |
| FR-1504      | —     | `ServiceSchedule`        | due calculation      | `service-due.test.ts`   | Done   |

## Inventory and procurement (Phase 2)

| Req     | Story | Schema                       | Implementation        | Test                  | Status     |
| ------- | ----- | ---------------------------- | --------------------- | --------------------- | ---------- |
| FR-1001 | —     | `Product`, `ProductCategory` | `/parts`              | `smoke.ts`            | Done       |
| FR-1002 | —     | `StockLevel`, `Warehouse`    | `lib/inventory.ts`    | `inventory.test.ts`   | Done       |
| FR-1003 | —     | `StockReservation`           | `reserveForJobLine()` | `verify-inventory.ts` | Done       |
| FR-1004 | —     | `StockMovement`              | every write path      | `verify-inventory.ts` | Done       |
| FR-1005 | —     | `StockLevel.avgCost`         | `applyReceipt()`      | `inventory.test.ts`   | Done       |
| FR-1006 | —     | `Product.reorderPoint`       | `summariseStock()`    | `inventory.test.ts`   | Done       |
| FR-1007 | —     | —                            | `suggestReorder()`    | `inventory.test.ts`   | Done       |
| FR-1008 | —     | `StockMovement.reason`       | `adjustStock()`       | `inventory.test.ts`   | Done       |
| FR-1009 | —     | —                            | `recordStocktake()`   | `inventory.test.ts`   | Done       |
| FR-1010 | —     | `Warehouse`                  | schema only           | —                     | Planned P4 |
| FR-1011 | —     | `JobPartLine.unitCost`       | `consumeForJob()`     | `verify-inventory.ts` | Done       |
| FR-1101 | —     | `Supplier`                   | `/suppliers`          | `smoke.ts`            | Done       |
| FR-1102 | —     | `PurchaseRequest`            | shortfall path        | `verify-inventory.ts` | Done       |
| FR-1103 | —     | —                            | `approvalRequired()`  | `inventory.test.ts`   | Done       |
| FR-1104 | —     | `PurchaseOrder`, lines       | `/purchasing`         | `smoke.ts`            | Done       |
| FR-1105 | —     | `GoodsReceipt`               | `validateReceipt()`   | `verify-inventory.ts` | Done       |
| FR-1106 | —     | `StockMovement`              | `receiveGoods()`      | `verify-inventory.ts` | Done       |
| FR-1107 | —     | `SupplierBill`               | `matchBill()`         | `inventory.test.ts`   | Done       |
| FR-1108 | —     | `PurchaseRequest.jobId`      | shortfall path        | `verify-inventory.ts` | Done       |

---

## Coverage summary

| Area                      | Requirements in Phase 1 | Traced  | Automated test |
| ------------------------- | ----------------------- | ------- | -------------- |
| Foundation                | 9                       | 9       | 9              |
| Customers and vehicles    | 13                      | 13      | 12             |
| Passport                  | 13                      | 13      | 13             |
| Booking and job           | 20                      | 20      | 19             |
| Inspection and estimate   | 15                      | 15      | 15             |
| Invoice and payment       | 8                       | 8       | 8              |
| Portal, dashboard, notify | 14                      | 14      | 11             |
| Inventory and procurement | 18                      | 18      | 18             |
| **Total**                 | **110**                 | **110** | **105 (95%)**  |

The five without automated coverage are visual and interaction concerns
verified by usability testing rather than assertion. They are named in the
[testing strategy](../04-engineering/04-testing-strategy.md) section 7 so the
gap is deliberate and visible rather than accidental.
