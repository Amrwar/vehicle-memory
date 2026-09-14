# Traceability Matrix

Every shipped requirement traced from statement to implementation to test. A
requirement with no test is not a requirement, it is a hope.

**How to use this.** When a requirement changes, this table names everything
that must change with it. When a test fails, it names what the failure means
commercially.

Legend: **Done** implemented and tested · **Partial** implemented, test gap
recorded · **Planned** in a later phase.

The story column names a story in [user stories](03-user-stories.md) where one
exists: epics A to J for Phase 1, K to T for Phases 15.1 to 23. Where it reads
P2 or P5 it names the persona the requirement was written for, from phases
traced before stories were written for them; where it reads — there is neither,
and the requirement is traced by code and test alone.

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

## Finance and ledger

| Req     | Story | Schema                                              | Implementation                                        | Test                 | Status |
| ------- | ----- | --------------------------------------------------- | ----------------------------------------------------- | -------------------- | ------ |
| FR-1201 | —     | `Account`                                           | `STANDARD_CHART`                                      | `accounting.test.ts` | Done   |
| FR-1202 | —     | `journal_lines_balance`, `_debit_xor_credit`        | deferred constraint trigger                           | `verify-ledger.ts`   | Done   |
| FR-1203 | —     | `JournalEntry`, `JournalLine`                       | `postEntry()` from operational events                 | `verify-ledger.ts`   | Done   |
| FR-1204 | —     | `JournalEntry.reversesId`, immutability trigger     | `reverse()`                                           | `accounting.test.ts` | Done   |
| FR-1205 | —     | `JournalEntry.sourceType`, `.sourceId`              | posting rules                                         | `accounting.test.ts` | Done   |
| FR-1206 | —     | —                                                   | `trialBalance()`, `profitAndLoss()`, `balanceSheet()` | `accounting.test.ts` | Done   |
| FR-1207 | —     | `FiscalPeriod.isClosed`                             | `postEntry()` period guard                            | `verify-ledger.ts`   | Done   |
| FR-1208 | —     | `Invoice`, `SupplierBill`                           | `ageAnalysis()`                                       | `verify-ledger.ts`   | Done   |
| FR-1209 | —     | `BankAccount`, `BankStatement`, `BankStatementLine` | `suggestMatches()`                                    | `banking.test.ts`    | Done   |
| FR-1210 | —     | `TaxRate`                                           | `taxReturn()`                                         | `accounting.test.ts` | Done   |
| FR-1211 | —     | `Expense`                                           | `recordExpense()`, `postExpense()`                    | `banking.test.ts`    | Done   |
| FR-613  | —     | `TimeEntry.costRate`                                | `jobProfit()`                                         | `smoke.ts`           | Done   |

**A correction.** These rows were misaligned by one from FR-1202 down. The
matrix said FR-1207 was the profit and loss statement when the requirement is
fiscal periods, said FR-1209 was aged debt when the requirement is bank
reconciliation, and traced an FR-1212 that has never existed in the
requirements document. Every one of those implementations was real; they were
filed against the wrong requirement, which is the failure mode of a matrix
maintained by hand and the reason the coverage summary is now computed from
the file rather than typed.

The note that used to sit here, saying bank reconciliation and expense capture
were unbuilt remainder of Phase 3, was also stale. Both shipped in Phase 4.8.

## People and multi-site

| Req     | Story | Schema                            | Implementation              | Test                | Status |
| ------- | ----- | --------------------------------- | --------------------------- | ------------------- | ------ |
| FR-1601 | —     | `Employee`                        | `/people`                   | `smoke.ts`          | Done   |
| FR-1602 | —     | `PayRate`, `pay_rates_no_overlap` | `rateOn()`, `costOfHours()` | `people.test.ts`    | Done   |
| FR-1603 | —     | `AttendanceRecord`                | `attendedMinutes()`         | `people.test.ts`    | Done   |
| FR-1604 | —     | —                                 | `productivityFor()`         | `people.test.ts`    | Done   |
| FR-1605 | —     | `timesheets_paid_are_final`       | `assertTimesheetTransition` | `people.test.ts`    | Done   |
| FR-1606 | —     | `Absence`                         | `/people/[id]`              | `smoke.ts`          | Done   |
| FR-1607 | —     | `Certification`                   | `expiringCertifications()`  | `smoke.ts`          | Done   |
| FR-1608 | —     | `CommissionScheme`, bands         | `calculateCommission()`     | `people.test.ts`    | Done   |
| FR-1701 | —     | `Membership.locationId`           | `scopeFor()`                | `multisite.test.ts` | Done   |
| FR-1702 | —     | `StockTransfer`, `_lines`         | `/transfers`                | `multisite.test.ts` | Done   |
| FR-1703 | —     | —                                 | `consolidate()`             | `multisite.test.ts` | Done   |
| FR-1704 | —     | —                                 | `/group` spread panel       | `multisite.test.ts` | Done   |
| FR-1705 | —     | `StockMovement.referenceType`     | `netInterSite()`            | `multisite.test.ts` | Done   |

## What the record supports saying

| Req     | Story | Schema                    | Implementation          | Test              | Status |
| ------- | ----- | ------------------------- | ----------------------- | ----------------- | ------ |
| FR-2601 | —     | `OdometerReading`         | `inspectHistory()`      | `history.test.ts` | Done   |
| FR-2602 | —     | —                         | `MASKED_ROLLBACK`       | `history.test.ts` | Done   |
| FR-2603 | —     | —                         | `HistoryConfidence`     | `history.test.ts` | Done   |
| FR-2604 | —     | —                         | `THIN_HISTORY`          | `history.test.ts` | Done   |
| FR-2605 | —     | —                         | `MileageFindings`       | `smoke.ts`        | Done   |
| FR-2606 | —     | `StockMovement`           | `recommendReorder()`    | `stock.test.ts`   | Done   |
| FR-2607 | —     | —                         | `Recommendation`        | `stock.test.ts`   | Done   |
| FR-2608 | —     | `PurchaseOrder`, receipts | `typicalLeadTimeDays()` | `smoke.ts`        | Done   |
| FR-2609 | —     | `TimeEntry`               | `durationFor()`         | `stock.test.ts`   | Done   |
| FR-2610 | —     | `JobType.defaultHours`    | `assessQuoting()`       | `stock.test.ts`   | Done   |

Estimate suggestion from free-text symptoms is deliberately absent. It needs a
corpus that does not exist yet, and a wrong suggestion on a brake fault is not
a small error.

## Scheduled work

| Req     | Story | Schema | Implementation                | Test                  | Status |
| ------- | ----- | ------ | ----------------------------- | --------------------- | ------ |
| FR-2501 | —     | —      | `vercel.json` crons           | `smoke.ts`            | Done   |
| FR-2502 | —     | —      | `@carnet/jobs`                | `verify-messaging.ts` | Done   |
| FR-2503 | —     | —      | claim-before-work in each job | `verify-messaging.ts` | Done   |
| FR-2504 | —     | —      | `authorised()`                | `smoke.ts`            | Done   |
| FR-2505 | —     | —      | `authorised()`                | `smoke.ts`            | Done   |
| FR-2506 | —     | —      | `/api/cron/[job]`             | `smoke.ts`            | Done   |

The development worker and the production schedule are two drivers over one
package. Two implementations of the same job would mean one of them quietly
stopping matching the other, and the one that stopped would be the one nobody
runs locally.

## Outbound messaging

| Req     | Story | Schema                           | Implementation          | Test                  | Status |
| ------- | ----- | -------------------------------- | ----------------------- | --------------------- | ------ |
| FR-2401 | —     | `MessageLog.status`, `.error`    | `/messages`             | `smoke.ts`            | Done   |
| FR-2402 | —     | `MessageLog.provider`, `.sentAt` | `sendQueuedMessages()`  | `verify-messaging.ts` | Done   |
| FR-2403 | —     | `MessageLog.attempts`            | `classifyFailure()`     | `verify-messaging.ts` | Done   |
| FR-2404 | —     | `MessageLog.availableAt`         | `afterFailure()`        | `messaging.test.ts`   | Done   |
| FR-2405 | —     | `MessageLog.availableAt`         | `quietHours()`          | `verify-messaging.ts` | Done   |
| FR-2406 | —     | —                                | `normaliseFor()`        | `messaging.test.ts`   | Done   |
| FR-2407 | —     | —                                | `render()`              | `messaging.test.ts`   | Done   |
| FR-2408 | —     | —                                | `redact()`              | `messaging.test.ts`   | Done   |
| FR-2409 | —     | —                                | `configureTransports()` | `verify-messaging.ts` | Done   |

Nothing in the web application sends. It writes rows; the worker drains them.
A "send now" button anywhere in the workshop interface would be lying about
where the work happens.

## After a message leaves

| Req     | Story | Schema                                   | Implementation          | Test                       | Status |
| ------- | ----- | ---------------------------------------- | ----------------------- | -------------------------- | ------ |
| FR-4001 | —     | `DeliveryEvent`                          | `recordDeliveryEvent()` | `verify-deliverability.ts` | Done   |
| FR-4002 | —     | `SuppressedAddress`                      | `bounceKind()`          | `events.test.ts`           | Done   |
| FR-4003 | —     | `ConsentRecord`                          | `reactTo()`             | `verify-deliverability.ts` | Done   |
| FR-4004 | —     | `suppressed_addresses_lift_is_explained` | `lift()`                | `verify-deliverability.ts` | Done   |
| FR-4005 | —     | —                                        | `sendQueuedMessages()`  | `verify-deliverability.ts` | Done   |
| FR-4006 | —     | `delivery_events` unique provider ref    | `recordDeliveryEvent()` | `verify-deliverability.ts` | Done   |
| FR-4007 | —     | —                                        | `reactTo()`             | `events.test.ts`           | Done   |
| FR-4008 | —     | `Organization.slug`                      | `REPLY_DOMAIN`          | `verify-deliverability.ts` | Done   |

## Getting in, and mail coming back

| Req     | Story | Schema                                                         | Implementation                                                               | Test                                                             | Status |
| ------- | ----- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| FR-3901 | A1    | —                                                              | `requestReset()`                                                             | `verify-credentials.ts`                                          | Done   |
| FR-3902 | A1    | `AuthToken.usedAt`                                             | `redeemReset()`                                                              | `verify-credentials.ts`                                          | Done   |
| FR-3903 | A1    | `auth_tokens_one_live_per_purpose`                             | `issue()`                                                                    | `verify-credentials.ts`                                          | Done   |
| FR-3904 | A1    | `User.emailVerifiedAt`                                         | `unverifiedWarning()`                                                        | `tokens.test.ts`                                                 | Done   |
| FR-3905 | A1    | —                                                              | `redeemVerification()`                                                       | `verify-credentials.ts`                                          | Done   |
| FR-3906 | A1    | —                                                              | `checkPassword()`                                                            | `tokens.test.ts`                                                 | Done   |
| FR-4101 | K1    | —                                                              | `registerCustomer()`                                                         | `verify-claims.ts`                                               | Done   |
| FR-4102 | K1    | `vehicle_claims_one_open_each`                                 | `claimVehicle()`                                                             | `verify-claims.ts`                                               | Done   |
| FR-4103 | K1    | `vehicles_registration_normalised`                             | `identifierKind()`                                                           | `verify-claims.ts`                                               | Done   |
| FR-4104 | A1    | `vehicle_claims_refusal_is_explained`                          | `decideClaim()`                                                              | `verify-claims.ts`                                               | Done   |
| FR-4105 | K1    | —                                                              | `describeClaim()`                                                            | `claims.test.ts`                                                 | Done   |
| FR-4106 | A1    | `User.emailVerifiedAt`                                         | `(workshop)/layout.tsx`                                                      | `verify-empty.ts`                                                | Done   |
| FR-4107 | K2    | —                                                              | `sendMessageNow()`                                                           | `verify-records.ts`                                              | Done   |
| FR-4108 | A2    | —                                                              | `createCustomer()`                                                           | `verify-records.ts`                                              | Done   |
| FR-4109 | A2    | `products_orgId_partNumber_key`                                | `createProduct()`                                                            | `verify-records.ts`                                              | Done   |
| FR-4110 | A2    | —                                                              | `createPurchaseOrder()`                                                      | `verify-records.ts`                                              | Done   |
| FR-4111 | A2    | `EstimateShare.tokenHash`                                      | `sendEstimate()`                                                             | `verify-records.ts`                                              | Done   |
| FR-4112 | A1    | —                                                              | `inviteColleague()`                                                          | `verify-team.ts`                                                 | Done   |
| FR-4113 | A1    | —                                                              | `sendCampaign()`                                                             | `verify-automation.ts`                                           | Done   |
| FR-4114 | K3    | —                                                              | `NOT_FOUND_MARKER`                                                           | `verify-controls.ts`                                             | Done   |
| FR-4201 | E2    | `JobStatusEvent`                                               | `moveJob()`                                                                  | `verify-money.ts`                                                | Done   |
| FR-4202 | E2    | `StockMovement`, `VehicleEvent`                                | `moveJob()` on COMPLETED                                                     | `verify-money.ts`                                                | Done   |
| FR-4203 | E1    | `JobLabourLine`, `JobPartLine`                                 | `recordDecision()`                                                           | `verify-money.ts`                                                | Done   |
| FR-4204 | G1    | `Invoice`, `invoices_orgId_number_key`                         | `issueInvoice()`                                                             | `verify-money.ts`                                                | Done   |
| FR-4205 | G1    | `Job.invoicedAt`                                               | `issueInvoice()`                                                             | `verify-money.ts`                                                | Done   |
| FR-4206 | G2    | `Payment`                                                      | `recordPayment()`                                                            | `verify-money.ts`                                                | Done   |
| FR-4207 | G3    | `CreditNote`                                                   | `raiseCreditNote()`                                                          | `verify-money.ts`                                                | Done   |
| FR-4208 | G3    | `refunds_amount_is_positive`                                   | `recordRefund()`                                                             | `verify-money.ts`                                                | Done   |
| FR-4209 | L2    | —                                                              | `postEntry()`                                                                | `invoicing.test.ts`, `verify-money.ts`                           | Done   |
| FR-4301 | M1    | `SupplierBill`, `supplier_bills_orgId_reference_key`           | `bookBill()`                                                                 | `verify-erp.ts`                                                  | Done   |
| FR-4302 | M1    | `BillStatus`                                                   | `approveBill()`, `disputeBill()`                                             | `verify-erp.ts`                                                  | Done   |
| FR-4303 | M1    | `SupplierPaymentAllocation`                                    | `allocateAcrossBills()`                                                      | `payables.test.ts`, `verify-erp.ts`                              | Done   |
| FR-4304 | M1    | `SupplierPayment`                                              | `paySupplier()`, `remittanceAdvice()`                                        | `verify-erp.ts`                                                  | Done   |
| FR-4305 | M2    | `PayrollRun`, `Timesheet.payrollRunId`                         | `runPayroll()`                                                               | `verify-erp.ts`                                                  | Done   |
| FR-4306 | M2    | —                                                              | `PAYROLL_COLUMNS`                                                            | `payroll.test.ts`                                                | Done   |
| FR-4307 | M2    | `payroll_runs_paid_has_a_time`                                 | `markPayrollPaid()`                                                          | `verify-erp.ts`                                                  | Done   |
| FR-4308 | M3    | `FleetAgreement`, `fleet_agreements_discounts_are_percentages` | `saveFleetAgreement()`                                                       | `fleet.test.ts`, `verify-erp.ts`                                 | Done   |
| FR-4309 | M3    | `InvoiceLine.jobId`                                            | `consolidateMonth()`                                                         | `verify-erp.ts`                                                  | Done   |
| FR-4310 | M3    | —                                                              | `assertConsolidatable()`                                                     | `fleet.test.ts`, `verify-erp.ts`                                 | Done   |
| FR-4401 | N1    | —                                                              | `parseQuestion()`, `COVERAGE`                                                | `questions.test.ts`, `verify-answers.ts`                         | Done   |
| FR-4402 | N1    | —                                                              | `answer()`                                                                   | `verify-answers.ts`                                              | Done   |
| FR-4403 | N1    | —                                                              | `refusal()`                                                                  | `questions.test.ts`, `verify-answers.ts`                         | Done   |
| FR-4404 | N1    | —                                                              | `observeRevenue()`                                                           | `observations.test.ts`                                           | Done   |
| FR-4405 | N2    | —                                                              | `customerSummary()`                                                          | `summary.test.ts`                                                | Done   |
| FR-4406 | N2    | —                                                              | `verifyAgainstFacts()`, `polish()`                                           | `summary.test.ts`, `verify-answers.ts`                           | Done   |
| FR-4407 | N2    | —                                                              | `sendCustomerSummary()` is a person's action                                 | `verify-controls.ts`                                             | Done   |
| FR-4408 | N2    | —                                                              | `/ask` page copy                                                             | `verify-empty.ts`                                                | Done   |
| FR-4501 | O1    | `vehicles_registration_normalised`                             | `findOnNetwork()`                                                            | `verify-network.ts`                                              | Done   |
| FR-4502 | O1    | —                                                              | `summariseNetwork()`                                                         | `network.test.ts`, `verify-network.ts`                           | Done   |
| FR-4503 | O1    | `VehicleAccessGrant`                                           | `adoptVehicle()`, `grantServicingAccess()`                                   | `verify-network.ts`                                              | Done   |
| FR-4504 | O1    | —                                                              | `redactForNetwork()`, `WITHHELD_KEYS`                                        | `network.test.ts`, `verify-network.ts`                           | Done   |
| FR-4505 | O1    | `VehicleEvent.prevHash`                                        | `writeJobCompletion()`                                                       | `verify-network.ts`                                              | Done   |
| FR-4506 | O1    | `Vehicle.vinValid`                                             | `registerVehicle()`                                                          | `verify-network.ts`                                              | Done   |
| FR-4507 | O2    | `ApiKey`                                                       | `issueApiKey()`, `createApiKey()`                                            | `api-keys.test.ts`, `verify-network.ts`                          | Done   |
| FR-4508 | O2    | —                                                              | `/api/v1/vehicles/[vin]`, `networkHistory()`                                 | `verify-network.ts`                                              | Done   |
| FR-4509 | O2    | —                                                              | `sinceFrom()`, `assertKeyUsable()`                                           | `api-keys.test.ts`, `verify-network.ts`                          | Done   |
| FR-4601 | P1    | —                                                              | `updateOrganisation()`                                                       | `settings.test.ts`, `verify-settings.ts`                         | Done   |
| FR-4602 | P1    | —                                                              | `updateSite()`, `normaliseCode()`                                            | `settings.test.ts`, `verify-settings.ts`                         | Done   |
| FR-4603 | P1    | `locations_open_before_close`                                  | `gather()` reads the site's hours                                            | `verify-settings.ts`                                             | Done   |
| FR-4604 | P1    | —                                                              | `saveBay()`, `saveTaxRate()`, `saveJobType()`                                | `verify-settings.ts`                                             | Done   |
| FR-4605 | P1    | —                                                              | `setDefaultTaxRate()`, `setTaxRateActive()`                                  | `verify-settings.ts`                                             | Done   |
| FR-4606 | P2    | `Booking.jobId` unique, `BookingSource.PLAN`                   | `acceptPlan()`, `diaryDraftsFor()`                                           | `accept.test.ts`, `verify-settings.ts`                           | Done   |
| FR-4607 | P1    | —                                                              | `setNumberingPrefix()`                                                       | `verify-settings.ts`                                             | Done   |
| FR-4608 | P1    | `AuditLog`                                                     | `audit()` on every settings write                                            | `verify-settings.ts`                                             | Done   |
| FR-4701 | Q1    | `VehicleDocument`, `VehicleDocumentKind`                       | `addDocument()`                                                              | `verify-documents.ts`                                            | Done   |
| FR-4702 | Q1    | —                                                              | `mayHandleDocuments()`                                                       | `verify-documents.ts`                                            | Done   |
| FR-4703 | Q1    | `vehicle_documents_expire_after_issue`                         | `assertDocumentAcceptable()`                                                 | `documents.test.ts`, `verify-documents.ts`                       | Done   |
| FR-4704 | Q1    | `vehicle_documents_have_bytes`                                 | `/api/vehicle-documents` ticket then record                                  | `verify-documents.ts`                                            | Done   |
| FR-4705 | Q1    | —                                                              | `paperworkSummary()`, `paperworkDue()`                                       | `documents.test.ts`, `verify-documents.ts`                       | Done   |
| FR-4706 | Q2    | `Customer.preferredTechnicianUserId`                           | `setPreferredTechnician()`, `jobFormOptions()`                               | `verify-documents.ts`                                            | Done   |
| FR-4707 | Q1    | `vehicle_documents_removal_is_explained`                       | `assertRemovable()`, `removeDocument()`                                      | `documents.test.ts`, `verify-documents.ts`                       | Done   |
| FR-4708 | Q1    | `AuditLog`                                                     | `audit()`, `/api/v1/vehicles/[vin]`                                          | `verify-documents.ts`                                            | Done   |
| FR-4801 | R1    | —                                                              | `proxy.ts`, `contentSecurityPolicy()`                                        | `hardening.test.ts`, `verify-headers.ts`                         | Done   |
| FR-4802 | R2    | —                                                              | `breachedPasswordProblem()`, `passwordRange()`                               | `hardening.test.ts`, `verify-hardening.ts`                       | Done   |
| FR-4803 | R3    | `ApiKey.windowStartedAt`, `ApiKey.windowCount`                 | `decideRate()`, `authenticateApiKey()`                                       | `hardening.test.ts`, `verify-network.ts`                         | Done   |
| FR-4804 | R4    | —                                                              | `verify-backup.ts`                                                           | `verify-backup.ts` in CI                                         | Done   |
| FR-4805 | R5    | —                                                              | `openApiDocument`, `/api/v1/openapi.json`, `build-openapi.ts`                | `docs:openapi:check`, `verify-network.ts`                        | Done   |
| FR-4806 | R1    | —                                                              | `next.config.ts` headers, `REQUIRED_SECURITY_HEADERS`                        | `verify-headers.ts`                                              | Done   |
| FR-4901 | S1    | `AssistantExchange`                                            | `explainJob()`, `explainFor()`                                               | `assistant.test.ts`, `verify-assistant.ts`                       | Done   |
| FR-4902 | S2    | —                                                              | `draftMessage()`, `draftFor()`, `draftAllowances()`                          | `assistant.test.ts`, `verify-assistant.ts`                       | Done   |
| FR-4903 | S2    | `AssistantExchange.sentMessageId`                              | `sendDraft()`                                                                | `verify-assistant.ts`                                            | Done   |
| FR-4904 | S3    | `AssistantExchange`, `assistant_exchanges_have_words`          | `record()` in `lib/assistant.ts`                                             | `verify-assistant.ts`                                            | Done   |
| FR-4905 | S3    | `Organization.assistantTokenBudget`                            | `assistantBudget()`, `budgetFor()`, `setAssistantBudget()`                   | `assistant.test.ts`, `verify-assistant.ts`                       | Done   |
| FR-4906 | S2    | —                                                              | `compose()` in `lib/ai.ts`, `verifyAgainstFacts()`                           | `summary.test.ts`, `verify-assistant.ts`                         | Done   |
| FR-4907 | S1    | —                                                              | `askAssistant()`                                                             | `verify-assistant.ts`                                            | Done   |
| FR-5001 | T1    | —                                                              | `VehiclePassport` in `components/vehicle-passport.tsx`                       | `verify-controls.ts`, `verify-access.ts`                         | Done   |
| FR-5002 | T1    | —                                                              | `mrzLines()`, `mrzVerify()`                                                  | `mrz.test.ts`                                                    | Done   |
| FR-5003 | T1    | —                                                              | `PassportStamp`, `inkFor()`, `stampTilt()`                                   | `verify-access.ts`                                               | Done   |
| FR-5004 | T1    | —                                                              | `detailFor()`, `authorityFor()`                                              | reviewed on the page                                             | Done   |
| FR-5005 | T2    | —                                                              | `BackToOrigin`                                                               | `verify-controls.ts`                                             | Done   |
| FR-5006 | T2    | —                                                              | `PassportBooklet`                                                            | `verify-controls.ts`, `verify-access.ts`                         | Done   |
| FR-5101 | U1    | `LoyaltyEntry`                                                 | `awardForInvoice()`, `recordPayment()`                                       | `verify-loyalty.ts`                                              | Done   |
| FR-5102 | U1    | `PaymentMethod.LOYALTY`, account 6400                          | `redeemAgainstInvoice()`, `accountForMethod()`                               | `accounting.test.ts`, `verify-loyalty.ts`                        | Done   |
| FR-5103 | U1    | —                                                              | `assertRedeemable()`, `assertPaymentRecordable()`                            | `retention.test.ts`, `verify-loyalty.ts`                         | Done   |
| FR-5104 | U1    | `LoyaltyEntry.reason`                                          | `awardByHand()`                                                              | `verify-loyalty.ts`                                              | Done   |
| FR-5105 | U1    | —                                                              | `loyaltyCardFor()`, the Points card on `/customers/[id]`                     | `verify-controls.ts`, `verify-empty.ts`                          | Done   |
| FR-5106 | U2    | —                                                              | `pointsForPortalUser()`, the portal home                                     | `verify-controls.ts`, `verify-empty.ts`                          | Done   |
| FR-5107 | U1    | `Account`                                                      | `ensureChartOfAccounts()`                                                    | `verify-loyalty.ts`                                              | Done   |
| FR-5201 | V2    | `Referral.code`                                                | `referralFor()`, `referralsForPortalUser()`                                  | `verify-referrals.ts`                                            | Done   |
| FR-5202 | V1    | —                                                              | `checkCode()`, `redeemCode()`, `useReferral()`                               | `retention.test.ts`, `verify-referrals.ts`                       | Done   |
| FR-5203 | V1    | `Referral.referredCustomerId`                                  | `redeemCode()`                                                               | `verify-referrals.ts`                                            | Done   |
| FR-5204 | V1    | `Referral.creditedAt`                                          | `creditReferral()`, `assertCreditable()`                                     | `retention.test.ts`, `verify-referrals.ts`                       | Done   |
| FR-5205 | V1    | —                                                              | `settleReferralsFor()` from `recordPayment()`                                | `verify-referrals.ts`                                            | Done   |
| FR-5206 | V1    | —                                                              | `referralCardFor()`, the Referrals card on `/customers/[id]`                 | `verify-controls.ts`, `verify-empty.ts`                          | Done   |
| FR-5301 | W1    | `GiftCard`, `gift_cards_sold_for_something`                    | `assertCardSellable()`, `sellGiftCard()`                                     | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5302 | W1    | `PaymentMethod.GIFT_CARD`, account 2300                        | `postGiftCardSold()`, `accountForMethod()`                                   | `accounting.test.ts`, `verify-giftcards.ts`                      | Done   |
| FR-5303 | W1    | `GiftCard.code`                                                | `giftCardCode()`, `looksLikeGiftCode()`, `findGiftCard()`                    | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5304 | W2    | —                                                              | `assertCardRedeemable()`, `redeemGiftCard()`                                 | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5305 | W2    | `GiftCardEntry`, `gift_card_entries_move_something`            | `giftCardBalance()`, `giftCardDetail()`                                      | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5306 | W1    | —                                                              | `giftCardsFor()`, `/gift-cards`                                              | `verify-controls.ts`, `verify-empty.ts`                          | Done   |
| FR-5401 | X1    | —                                                              | `passportsForOrg()`, `/passports`                                            | `verify-passports.ts`                                            | Done   |
| FR-5402 | X1    | —                                                              | `verifyVehicleChain()` per row in `lib/passports.ts`                         | `verify-passports.ts`                                            | Done   |
| FR-5403 | X2    | `VehicleOwnership.endedAt`                                     | `passportsForOwner()`, `/portal/passports`                                   | `verify-passports.ts`                                            | Done   |
| FR-5404 | X1    | —                                                              | `app/icon.svg`, `app/apple-icon.tsx`                                         | reviewed in the browser                                          | Done   |
| FR-5501 | Y1    | `GiftCardEntry.kind`, `gift_card_entries_kind_matches_sign`    | `sellGiftCard()`, `redeemGiftCard()`, `refundOntoCard()`, `adjustGiftCard()` | `verify-giftcards.ts`                                            | Done   |
| FR-5502 | Y2    | —                                                              | `giftCardStatus()`                                                           | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5503 | Y2    | `GiftCard.expiresAt`, `GiftCard.locationId`                    | `assertCardSellable()`, `assertCardRedeemable()`, `giftCardExpiry()`         | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5504 | Y1    | `TenderKind.GIFT_CARD`, `GiftCardEntry.counterSaleId`          | `redeemAtCounter()`, `settle()`, `postCounterSale()`                         | `pos.test.ts`, `verify-giftcards.ts`                             | Done   |
| FR-5505 | Y1    | —                                                              | `refundOntoCard()` from `recordRefund()`                                     | `verify-giftcards.ts`                                            | Done   |
| FR-5506 | Y2    | —                                                              | `assertCardAdjustable()`, `adjustGiftCard()`, `postGiftCardAdjustment()`     | `giftcards.test.ts`, `accounting.test.ts`, `verify-giftcards.ts` | Done   |
| FR-5507 | Y2    | `gift_cards_cancelled_with_a_reason`                           | `disableGiftCard()`                                                          | `verify-giftcards.ts`                                            | Done   |
| FR-5601 | Z1    | `Organization.country`                                         | `COUNTRIES`, `regionOf()`, `updateOrganisation()`                            | `region.test.ts`, `verify-region.ts`                             | Done   |
| FR-5602 | Z1    | —                                                              | `createWorkshop()`, `regionForCountry()`, `countryFor()`                     | `verify-region.ts`                                               | Done   |
| FR-5603 | Z1    | —                                                              | `Session.region`, every workshop page                                        | `verify-region.ts`, `verify-controls.ts`                         | Done   |
| FR-5604 | Z2    | —                                                              | `regionForUser()`, `pointsForPortalUser()`                                   | `verify-region.ts`                                               | Done   |
| FR-5605 | Z1    | —                                                              | `regionFor()` in `lib/money.ts`, `lib/fleet.ts`, `lib/estimates.ts`          | `verify-region.ts`                                               | Done   |
| FR-5606 | Z1    | —                                                              | the settings page                                                            | reviewed on the page                                             | Done   |
| FR-3907 | A1    | —                                                              | `assertNotFlooding()`                                                        | `verify-credentials.ts`                                          | Done   |
| FR-3908 | A1    | `auth_tokens.tokenHash`                                        | `digest()`                                                                   | `verify-credentials.ts`                                          | Done   |
| FR-3801 | —     | —                                                              | `/api/inbound/resend`                                                        | `smoke.ts`                                                       | Done   |
| FR-3802 | —     | —                                                              | `verify()` tolerance                                                         | `smoke.ts`                                                       | Done   |
| FR-3803 | —     | `Organization.slug`                                            | `organisationFor()`                                                          | `smoke.ts`                                                       | Done   |
| FR-3804 | —     | —                                                              | `INBOUND_WEBHOOK_SECRET`                                                     | `smoke.ts`                                                       | Done   |

## What people say afterwards

| Req     | Story | Schema                                 | Implementation       | Test                  | Status |
| ------- | ----- | -------------------------------------- | -------------------- | --------------------- | ------ |
| FR-3601 | —     | `DocumentSequence`                     | `createJob()`        | `verify-controls.ts`  | Done   |
| FR-3602 | —     | —                                      | `createJob()`        | `verify-controls.ts`  | Done   |
| FR-3603 | —     | `OdometerReading`                      | `createJob()`        | `verify-controls.ts`  | Done   |
| FR-3604 | —     | —                                      | `JobError`           | `verify-controls.ts`  | Done   |
| FR-3605 | —     | —                                      | `verify-controls.ts` | `verify-controls.ts`  | Done   |
| FR-3701 | —     | `review_requests_jobId_key`            | `shouldAsk()`        | `verify-retention.ts` | Done   |
| FR-3702 | —     | `ReviewRouting`                        | `routeRating()`      | `retention.test.ts`   | Done   |
| FR-3703 | —     | —                                      | `askable()`          | `verify-retention.ts` | Done   |
| FR-3704 | —     | —                                      | `satisfactionOf()`   | `retention.test.ts`   | Done   |
| FR-3705 | —     | `InboundMessage.confidence`            | `matchInbound()`     | `inbound.test.ts`     | Done   |
| FR-3706 | —     | —                                      | `priorityOf()`       | `verify-retention.ts` | Done   |
| FR-3707 | —     | `inbound_messages` unique provider ref | `receiveInbound()`   | `verify-retention.ts` | Done   |
| FR-3708 | —     | `loyalty_entries_move_something`       | `balanceOf()`        | `retention.test.ts`   | Done   |
| FR-3709 | —     | `referrals_are_between_two_people`     | `assertCreditable()` | `verify-retention.ts` | Done   |

## The technician's own device

| Req     | Story | Schema                            | Implementation      | Test                | Status |
| ------- | ----- | --------------------------------- | ------------------- | ------------------- | ------ |
| FR-3501 | P2    | `SyncedAction`                    | `flush()`           | `verify-offline.ts` | Done   |
| FR-3502 | P2    | `synced_actions` unique client id | `enqueue()`         | `verify-offline.ts` | Done   |
| FR-3503 | —     | —                                 | `kindOf()`          | `sync.test.ts`      | Done   |
| FR-3504 | —     | —                                 | `replayOrder()`     | `sync.test.ts`      | Done   |
| FR-3505 | —     | —                                 | `decideQueued()`    | `verify-offline.ts` | Done   |
| FR-3506 | P2    | —                                 | `OutboxStatus`      | `sync.test.ts`      | Done   |
| FR-3507 | —     | —                                 | `ACTIONS`           | `verify-offline.ts` | Done   |
| FR-3508 | P2    | —                                 | `sw.js`, manifest   | `verify-offline.ts` | Done   |
| FR-3509 | —     | `synced_actions_have_a_device_id` | `assertQueueable()` | `sync.test.ts`      | Done   |

## Proof of everything, and parts that fit

| Req     | Story | Schema                         | Implementation        | Test                   | Status |
| ------- | ----- | ------------------------------ | --------------------- | ---------------------- | ------ |
| FR-3401 | —     | `AuditLog`                     | `lifeOf()`            | `life.test.ts`         | Done   |
| FR-3402 | —     | —                              | `diffOf()`            | `verify-provenance.ts` | Done   |
| FR-3403 | —     | —                              | `READABLE`, `lifeFor` | `verify-provenance.ts` | Done   |
| FR-3404 | —     | `PartFitment`                  | `recordFitment()`     | `verify-provenance.ts` | Done   |
| FR-3405 | —     | —                              | `fitsVehicle()`       | `fitment.test.ts`      | Done   |
| FR-3406 | —     | —                              | `fitmentWarning()`    | `fitment.test.ts`      | Done   |
| FR-3407 | —     | `part_fitments_one_claim_each` | schema constraints    | `verify-provenance.ts` | Done   |
| FR-3408 | —     | `audit_logs_immutable`         | schema trigger        | `verify-provenance.ts` | Done   |

## The workshop plans itself

| Req     | Story | Schema                             | Implementation    | Test                 | Status |
| ------- | ----- | ---------------------------------- | ----------------- | -------------------- | ------ |
| FR-3301 | —     | `WorkingPattern`, `Absence`        | `capacityFor()`   | `planning.test.ts`   | Done   |
| FR-3302 | —     | `Bay`                              | `capacityFor()`   | `planning.test.ts`   | Done   |
| FR-3303 | —     | `Skill`, `EmployeeSkill`           | `setSkill()`      | `verify-planning.ts` | Done   |
| FR-3304 | —     | —                                  | `skillMatrix()`   | `planning.test.ts`   | Done   |
| FR-3305 | —     | `JobTypeSkill`                     | `planDay()`       | `verify-planning.ts` | Done   |
| FR-3306 | —     | —                                  | `planDay()`       | `verify-planning.ts` | Done   |
| FR-3307 | —     | —                                  | `proposeDay()`    | `verify-planning.ts` | Done   |
| FR-3308 | —     | `JobPartLine.status`               | `proposeDay()`    | `planning.test.ts`   | Done   |
| FR-3309 | —     | `working_patterns_is_a_real_shift` | schema constraint | `verify-planning.ts` | Done   |
| FR-3310 | —     | —                                  | `setSkill()`      | `verify-planning.ts` | Done   |

## The passport leaves the workshop

| Req     | Story | Schema                                    | Implementation          | Test                 | Status |
| ------- | ----- | ----------------------------------------- | ----------------------- | -------------------- | ------ |
| FR-3201 | P5    | `vehicle_ownerships_one_open_per_vehicle` | `transferOwnership()`   | `verify-handover.ts` | Done   |
| FR-3202 | P5    | `VehicleEvent.payload`                    | `transferEvent()`       | `verify-handover.ts` | Done   |
| FR-3203 | P5    | derived                                   | `buildReport()`         | `handover.test.ts`   | Done   |
| FR-3204 | P5    | `PassportShare.tokenHash`                 | `/verify`, `/p/[token]` | `smoke.ts`           | Done   |
| FR-3205 | —     | `Recall`, `VehicleRecall`                 | `/recalls`              | `verify-empty.ts`    | Done   |
| FR-3206 | —     | —                                         | `assertTransferable()`  | `handover.test.ts`   | Done   |
| FR-3207 | P5    | append-only trigger                       | schema trigger          | `verify-handover.ts` | Done   |
| FR-3208 | P5    | —                                         | `buildReport()`         | `handover.test.ts`   | Done   |

## The vehicle's own condition

| Req     | Story | Schema                            | Implementation       | Test                  | Status |
| ------- | ----- | --------------------------------- | -------------------- | --------------------- | ------ |
| FR-3101 | —     | derived                           | `healthOf()`         | `condition.test.ts`   | Done   |
| FR-3102 | —     | derived                           | `healthOf()` skip    | `condition.test.ts`   | Done   |
| FR-3103 | —     | —                                 | `HealthInput`        | `verify-condition.ts` | Done   |
| FR-3104 | —     | `JobPartLine`, `Job.odometerInKm` | `componentsFrom()`   | `verify-condition.ts` | Done   |
| FR-3105 | —     | `Vehicle.lastOdometerKm`          | `componentsFrom()`   | `condition.test.ts`   | Done   |
| FR-3106 | —     | —                                 | `classifyPart()`     | `condition.test.ts`   | Done   |
| FR-3107 | —     | `OdometerReading`                 | `predictDue()`       | `verify-condition.ts` | Done   |
| FR-3108 | —     | —                                 | `ownInterval()`      | `condition.test.ts`   | Done   |
| FR-3109 | —     | `Warranty`                        | `coverWorthChecking` | `verify-condition.ts` | Done   |
| FR-3110 | —     | —                                 | `LoadingCar`         | `verify-access.ts`    | Done   |

## Warranty, fleets and the whole story

| Req     | Story | Schema                                  | Implementation      | Test                 | Status |
| ------- | ----- | --------------------------------------- | ------------------- | -------------------- | ------ |
| FR-3001 | —     | `Warranty`                              | `warrantyBook()`    | `cover.test.ts`      | Done   |
| FR-3002 | —     | `warranties_distance_needs_a_start`     | `coverStatusOf()`   | `verify-warranty.ts` | Done   |
| FR-3003 | —     | `Warranty.supplierMonths`               | `positionFor()`     | `verify-warranty.ts` | Done   |
| FR-3004 | —     | `warranty_claims_goodwill_is_explained` | `assertClaimable()` | `verify-warranty.ts` | Done   |
| FR-3005 | —     | `warranty_claims_one_open_per_warranty` | `settleClaim()`     | `verify-warranty.ts` | Done   |
| FR-3006 | —     | `warranties_void_is_explained`          | schema constraint   | `verify-warranty.ts` | Done   |
| FR-3010 | —     | `Customer.kind`                         | `fleets()`          | `verify-empty.ts`    | Done   |
| FR-3011 | —     | `ServiceSchedule.dueAt`                 | `fleetDetail()`     | `verify-controls.ts` | Done   |
| FR-3012 | —     | `Job`, `Invoice`, `Payment`, `Booking`  | `timelineFor()`     | `verify-controls.ts` | Done   |

## The diary and the floor

| Req     | Story | Schema                       | Implementation | Test            | Status |
| ------- | ----- | ---------------------------- | -------------- | --------------- | ------ |
| FR-2901 | —     | `Booking`, `Bay`             | `rangeFor()`   | `views.test.ts` | Done   |
| FR-2902 | —     | —                            | `lanesFor()`   | `views.test.ts` | Done   |
| FR-2903 | —     | —                            | `DiaryBoard`   | `smoke.ts`      | Done   |
| FR-2904 | —     | —                            | `assertMove()` | `views.test.ts` | Done   |
| FR-2905 | —     | `Bay`, `Booking.endAt`       | `floorAt()`    | `views.test.ts` | Done   |
| FR-2906 | —     | `AuditLog`, `Job.promisedAt` | `/dashboard`   | `smoke.ts`      | Done   |

## Suppliers and counter bookings

| Req     | Story | Schema                     | Implementation       | Test                 | Status |
| ------- | ----- | -------------------------- | -------------------- | -------------------- | ------ |
| FR-2801 | —     | `Supplier`, `GoodsReceipt` | `supplierDetail()`   | `verify-controls.ts` | Done   |
| FR-2802 | —     | `suppliers` unique name    | `createSupplier()`   | `verify-controls.ts` | Done   |
| FR-2803 | —     | `Booking.status`           | `/bookings/[id]`     | `verify-controls.ts` | Done   |
| FR-2804 | —     | `Booking.source`           | `createBooking()`    | `verify-empty.ts`    | Done   |
| FR-2805 | —     | `PurchaseOrderLine`        | `supplierDetail()`   | `verify-controls.ts` | Done   |
| FR-2806 | —     | —                          | `verify-controls.ts` | `verify-controls.ts` | Done   |

## Carrying out an inspection

| Req     | Story | Schema                            | Implementation         | Test                   | Status |
| ------- | ----- | --------------------------------- | ---------------------- | ---------------------- | ------ |
| FR-2701 | —     | `Inspection`, `InspectionResult`  | `/shop/inspect/[id]`   | `verify-inspection.ts` | Done   |
| FR-2702 | —     | —                                 | `recordResult()`       | `verify-inspection.ts` | Done   |
| FR-2703 | —     | —                                 | `assertResultSound()`  | `carry-out.test.ts`    | Done   |
| FR-2704 | —     | —                                 | `describeCompletion()` | `carry-out.test.ts`    | Done   |
| FR-2705 | —     | `Inspection.status`               | `/inspections`         | `verify-empty.ts`      | Done   |
| FR-2706 | —     | `EstimateLine.inspectionResultId` | `completeInspection()` | `verify-inspection.ts` | Done   |
| FR-2707 | —     | —                                 | `assertCompletable()`  | `verify-inspection.ts` | Done   |
| FR-2708 | —     | `InspectionPhoto`                 | `ticketFor()`          | `verify-storage.ts`    | Done   |
| FR-2709 | —     | —                                 | S3-compatible driver   | `verify-storage.ts`    | Done   |
| FR-2710 | —     | —                                 | `readUrlFor()`         | `verify-storage.ts`    | Done   |

## The customer's own side

| Req     | Story | Schema                                 | Implementation              | Test               | Status |
| ------- | ----- | -------------------------------------- | --------------------------- | ------------------ | ------ |
| FR-2301 | —     | `EstimateShare.tokenHash`              | `/e/[token]`                | `smoke.ts`         | Done   |
| FR-2302 | —     | `EstimateApproval`, `EstimateLine`     | `recordDecision()`          | `decision.test.ts` | Done   |
| FR-2303 | —     | `InspectionResult.severity`            | `confirmationFor()`         | `decision.test.ts` | Done   |
| FR-2304 | —     | `VehicleOwnership`                     | `/portal/vehicles/[id]`     | `smoke.ts`         | Done   |
| FR-2305 | —     | `PassportShare.tokenHash`, `revokedAt` | `shareVehicle()`            | `smoke.ts`         | Done   |
| FR-2306 | —     | `Invoice.amountPaid`                   | `/portal/invoices`          | `smoke.ts`         | Done   |
| FR-2307 | —     | —                                      | `customerProgressFor()`     | `decision.test.ts` | Done   |
| FR-2308 | —     | —                                      | `ownsVehicle()`, `notFound` | `smoke.ts`         | Done   |
| FR-2309 | —     | `EstimateShare.expiresAt`              | `/e/[token]`                | `smoke.ts`         | Done   |

Paying online (FR-1309) is the one thing on this side a customer still cannot
do. It needs a payment provider, and a page collecting card details with
nothing behind it would be worse than not having one.

## Automation and customer relationships

| Req     | Story | Schema                                | Implementation          | Test                   | Status |
| ------- | ----- | ------------------------------------- | ----------------------- | ---------------------- | ------ |
| FR-2201 | —     | `AutomationRule`                      | `assertRuleSound()`     | `automation.test.ts`   | Done   |
| FR-2202 | —     | `automation_runs_respect_cooldown`    | `evaluate()`            | `verify-automation.ts` | Done   |
| FR-2203 | —     | `automation_rules_has_actions`        | `assertRuleSound()`     | `verify-automation.ts` | Done   |
| FR-2204 | —     | `AutomationRun.blockedBy`, `.reason`  | `fireEvent()`           | `verify-automation.ts` | Done   |
| FR-2205 | —     | `Customer.marketing*Consent`          | `mayMarket()`           | `automation.test.ts`   | Done   |
| FR-2206 | —     | `Customer.lastMarketedAt`             | `sendCampaign()`        | `automation.test.ts`   | Done   |
| FR-2207 | —     | `consent_changes_immutable` trigger   | `carnet_record_consent` | `verify-automation.ts` | Done   |
| FR-2208 | —     | `CampaignRecipient.status`, `.reason` | `planCampaign()`        | `verify-automation.ts` | Done   |
| FR-2209 | —     | —                                     | `cohorts()`             | `automation.test.ts`   | Done   |
| FR-2210 | —     | `ServiceSchedule.reminderSentAt`      | `queueServiceReminders` | `automation.test.ts`   | Done   |
| FR-2211 | —     | `InspectionResult`, `EstimateLine`    | `suggestOnArrival()`    | `arrival.test.ts`      | Done   |

The engine drives itself. A service falling due writes a message offering a
booking and fires `service.due`; the worker carries out queued actions on
every poll. Nothing between a reminder and the car arriving needs a person.

## Expenses, banking and period close

| Req     | Story | Schema                                     | Implementation       | Test                | Status |
| ------- | ----- | ------------------------------------------ | -------------------- | ------------------- | ------ |
| FR-2101 | —     | `Expense`, `expenses_tax_within_net`       | `recordExpense()`    | `verify-banking.ts` | Done   |
| FR-2102 | —     | `expenses_no_self_approval` trigger        | `assertApprovable()` | `banking.test.ts`   | Done   |
| FR-2103 | —     | `BankStatement`, `BankStatementLine`       | `suggestMatches()`   | `banking.test.ts`   | Done   |
| FR-2104 | —     | `bank_statement_lines_one_match_per_entry` | `autoApplicable()`   | `verify-banking.ts` | Done   |
| FR-2105 | —     | `FiscalPeriod.isClosed`                    | `closeChecks()`      | `banking.test.ts`   | Done   |
| FR-2106 | —     | `Expense.paidFrom`                         | `postExpense()`      | `banking.test.ts`   | Done   |

Payroll export remains open. It needs a target format, and inventing one
before a workshop names the provider they use would produce a file nobody
accepts.

## Counter sales and business reporting

| Req     | Story | Schema                             | Implementation           | Test                | Status |
| ------- | ----- | ---------------------------------- | ------------------------ | ------------------- | ------ |
| FR-2001 | —     | `CounterSale`, `CounterSaleLine`   | `/counter`               | `verify-counter.ts` | Done   |
| FR-2002 | —     | `StockMovement`, `JournalEntry`    | `completeSale()`         | `verify-counter.ts` | Done   |
| FR-2003 | —     | `CounterSaleTender`, `TillSession` | `countTill()`            | `pos.test.ts`       | Done   |
| FR-2004 | —     | `Estimate.sentAt`                  | `/estimates`             | `smoke.ts`          | Done   |
| FR-2005 | —     | —                                  | `revenueByServiceType()` | `smoke.ts`          | Done   |
| FR-2006 | —     | —                                  | `partsProfitability()`   | `smoke.ts`          | Done   |
| FR-2007 | —     | —                                  | `retention()`            | `smoke.ts`          | Done   |
| FR-2008 | —     | `Booking.source`                   | `bySource()`             | `smoke.ts`          | Done   |
| FR-2009 | —     | —                                  | `toCsv()`, `csvField()`  | `pos.test.ts`       | Done   |
| FR-1406 | —     | —                                  | `/api/reports/[report]`  | `smoke.ts`          | Done   |

Online card payment (FR-1309) remains absent. It needs a payment provider, and
a page that collects card details with nothing behind it would be worse than
not having one.

## Administration and the customer's journey

| Req     | Story | Schema                              | Implementation          | Test             | Status |
| ------- | ----- | ----------------------------------- | ----------------------- | ---------------- | ------ |
| FR-1901 | —     | `Invitation`                        | `inviteColleague()`     | `verify-team.ts` | Done   |
| FR-1902 | —     | `Invitation.tokenHash`, one-open ix | `acceptInvitation()`    | `verify-team.ts` | Done   |
| FR-1903 | —     | `Membership.role`                   | `assertMayChangeRole()` | `team.test.ts`   | Done   |
| FR-1904 | —     | `Booking.source`                    | `availableSlots()`      | `team.test.ts`   | Done   |
| FR-1905 | —     | `ServiceSchedule`                   | `/reminders`            | `smoke.ts`       | Done   |
| FR-1906 | —     | `Membership.isActive`               | `deactivateMember()`    | `verify-team.ts` | Done   |
| FR-1907 | —     | `OutboxEvent`                       | `shouldNotify()`        | `team.test.ts`   | Done   |

## Front door and billing

| Req     | Story | Schema         | Implementation                     | Test               | Status |
| ------- | ----- | -------------- | ---------------------------------- | ------------------ | ------ |
| FR-1801 | —     | —              | `/` marketing home                 | `smoke.ts`         | Done   |
| FR-1802 | —     | —              | `/pricing`, rendered from `PLANS`  | `smoke.ts`         | Done   |
| FR-1803 | —     | `Organization` | `createWorkshop()`                 | `verify-signup.ts` | Done   |
| FR-1804 | —     | `OrgPlan`      | `assertFeature()`, `assertUsage()` | `billing.test.ts`  | Done   |
| FR-1805 | —     | `AuditLog`     | `org.created` on sign-up           | `verify-signup.ts` | Done   |
| FR-1806 | —     | `audit_logs`   | erasure permitted, rewrite refused | `verify-signup.ts` | Done   |

Payment collection is deliberately absent: the trial takes no card, and taking
one is Phase 4.7 alongside point of sale. A billing page that collects card
details without a provider behind it would be worse than not having one.

---

## Coverage summary

| Area                                      | Traced individually | With an automated test |
| ----------------------------------------- | ------------------- | ---------------------- |
| Foundation                                | 10                  | 9                      |
| Customers and vehicles                    | 8                   | 8                      |
| Vehicle passport                          | 12                  | 11                     |
| Booking, job, inspection, estimate        | 11                  | 11                     |
| Invoicing, portal, reporting              | 4                   | 4                      |
| Inventory and procurement (Phase 2)       | 19                  | 18                     |
| Finance and ledger                        | 12                  | 12                     |
| People and multi-site                     | 13                  | 13                     |
| What the record supports saying           | 10                  | 10                     |
| Scheduled work                            | 6                   | 6                      |
| Outbound messaging                        | 9                   | 9                      |
| After a message leaves                    | 8                   | 8                      |
| Getting in, and mail coming back          | 12                  | 12                     |
| What people say afterwards                | 14                  | 14                     |
| The technician's own device               | 9                   | 9                      |
| Proof of everything, and parts that fit   | 8                   | 8                      |
| The workshop plans itself                 | 10                  | 10                     |
| The passport leaves the workshop          | 8                   | 8                      |
| The vehicle's own condition               | 10                  | 10                     |
| Warranty, fleets and the whole story      | 9                   | 9                      |
| The diary and the floor                   | 6                   | 6                      |
| Suppliers and counter bookings            | 6                   | 6                      |
| Carrying out an inspection                | 10                  | 10                     |
| The customer's own side                   | 9                   | 9                      |
| Automation and customer relationships     | 11                  | 11                     |
| Expenses, banking and period close        | 6                   | 6                      |
| Counter sales and business reporting      | 10                  | 10                     |
| Administration and the customer's journey | 7                   | 7                      |
| Front door and billing                    | 6                   | 6                      |
| Customers with accounts, and dead buttons | 14                  | 14                     |
| The money cycle                           | 9                   | 9                      |
| Suppliers, payroll and fleets             | 10                  | 10                     |
| Answers rather than pages                 | 8                   | 8                      |
| The network                               | 9                   | 9                      |
| The workshop configures itself            | 8                   | 8                      |
| The vehicle's paperwork                   | 8                   | 8                      |
| Before general availability               | 6                   | 6                      |
| The assistant inside the workflow         | 7                   | 7                      |
| The passport, designed                    | 6                   | 5                      |
| Points, and the public face               | 7                   | 7                      |
| Referrals, in the product                 | 6                   | 6                      |
| Gift cards                                | 6                   | 6                      |
| The passport, listed                      | 4                   | 3                      |
| Gift cards, deepened                      | 7                   | 7                      |
| Country and currency                      | 6                   | 5                      |
| **Total**                                 | **394**             | **388 (98%)**          |

The requirements document lists 478 requirements. 84 of
them do not have a row of their own above.

That gap is not a claim that they are untested. It is Phase 1 and 2 work that
was traced by section rather than by requirement, before this matrix settled
into one row per requirement, and the earlier phases' acceptance tests cover
it. What it does mean is that this table cannot be read as a coverage figure
for the product, only for the requirements traced individually, and an earlier
version of this page did read it that way: it claimed 149 of 149 traced at
97% automated, against a matrix that held 130 rows. The claim was arithmetic
about a table that no longer existed.

Closing the gap means one row per requirement for the earlier phases, which is
a piece of work in its own right and is named here so it stays visible rather
than being quietly implied by a percentage.
