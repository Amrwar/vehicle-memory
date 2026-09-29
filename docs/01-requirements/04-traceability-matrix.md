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

| Req    | Story | Schema              | Implementation                      | Test                | Status     |
| ------ | ----- | ------------------- | ----------------------------------- | ------------------- | ---------- |
| FR-101 | A2    | `Organization`      | `packages/db/src/tenant.ts`         | `roles.test.ts`     | Done       |
| FR-102 | A2    | —                   | `forOrg()` scoped client            | `roles.test.ts`     | Done       |
| FR-103 | A1    | `User`, `Session`   | `apps/web/src/lib/auth/*`           | `hardening.test.ts` | Done       |
| FR-104 | A1    | `User.passwordHash` | `lib/auth/password.ts`              | `hardening.test.ts` | Done       |
| FR-105 | A1    | `Session.expiresAt` | `lib/auth/session.ts`               | `tokens.test.ts`    | Done       |
| FR-106 | A3    | `Membership.role`   | `packages/core/src/access/roles.ts` | `roles.test.ts`     | Done       |
| FR-107 | A3    | —                   | `can()` deny-by-default             | `roles.test.ts`     | Done       |
| FR-109 | A4    | `AuditLog`          | `lib/audit.ts`                      | `life.test.ts`      | Done       |
| FR-110 | A1    | `LoginAttempt`      | `lib/auth/rate-limit.ts`            | `hardening.test.ts` | Done       |
| FR-111 | —     | `Location`          | schema only                         | —                   | Planned P4 |

## Customers and vehicles

| Req    | Story | Schema                    | Implementation                  | Test                   | Status                                      |
| ------ | ----- | ------------------------- | ------------------------------- | ---------------------- | ------------------------------------------- |
| FR-204 | B1    | `VehicleOwnership`        | `core/src/vehicle`              | `handover.test.ts`     | Done                                        |
| FR-205 | B2    | —                         | customer detail page            | e2e `customer.spec.ts` | Done                                        |
| FR-206 | B1    | unique indexes            | `customer.ts` duplicate guard   | `customer.test.ts`     | Done                                        |
| FR-301 | B3    | `Vehicle.vin @unique`     | global uniqueness               | `vehicle.test.ts`      | Done                                        |
| FR-304 | B3    | —                         | `core/src/vehicle/vin.ts`       | `vehicle.test.ts`      | Done                                        |
| FR-305 | B3    | —                         | `lib/vin-decode.ts`             | `vehicle.test.ts`      | Partial — stub decoder, real provider in P2 |
| FR-309 | B3    | `VehicleOwnership`        | `core/src/vehicle/ownership.ts` | `handover.test.ts`     | Done                                        |
| FR-311 | —     | `Recall`, `VehicleRecall` | schema + read model             | `verify-records.ts`    | Partial — no OEM feed yet                   |

## Vehicle passport

| Req    | Story | Schema                           | Implementation               | Test                   | Status     |
| ------ | ----- | -------------------------------- | ---------------------------- | ---------------------- | ---------- |
| FR-401 | C2    | `VehicleEvent`                   | append-only repository       | `accounting.test.ts`   | Done       |
| FR-402 | C1    | `VehicleEvent.*`                 | `core/src/passport/event.ts` | `accounting.test.ts`   | Done       |
| FR-403 | C2    | `VehicleEvent.hash`, `.prevHash` | `core/src/passport/chain.ts` | `chain.test.ts`        | Done       |
| FR-404 | C2    | —                                | `verifyChain()`              | `chain.test.ts`        | Done       |
| FR-405 | C1    | `VehicleEventType`               | enum                         | `accounting.test.ts`   | Done       |
| FR-406 | C2    | `supersedesId`                   | `supersede()`                | `chain.test.ts`        | Done       |
| FR-407 | C1    | `VerificationLevel`              | enum                         | `accounting.test.ts`   | Done       |
| FR-408 | C3    | —                                | job completion writer        | `events.test.ts`       | Done       |
| FR-409 | C4    | `PassportShare`                  | share issue and revoke       | `tokens.test.ts`       | Done       |
| FR-410 | C4    | `PassportShareAccess`            | access logging               | `tokens.test.ts`       | Done       |
| FR-413 | C1    | —                                | timeline view                | e2e `passport.spec.ts` | Done       |
| FR-414 | —     | —                                | —                            | —                      | Planned P5 |

## Booking, job, inspection, estimate

| Req    | Story | Schema                         | Implementation                       | Test                  | Status |
| ------ | ----- | ------------------------------ | ------------------------------------ | --------------------- | ------ |
| FR-506 | D3    | `Booking.jobId`                | convert action                       | `accept.test.ts`      | Done   |
| FR-601 | E1    | `Job` and relations            | job detail                           | e2e `job.spec.ts`     | Done   |
| FR-604 | E2    | `JobStatusEvent`               | transition recorder                  | `lifecycle.test.ts`   | Done   |
| FR-605 | E1    | `Job.*`                        | job form                             | `lifecycle.test.ts`   | Done   |
| FR-610 | E3    | `TimeEntry`                    | clock on/off                         | `people.test.ts`      | Done   |
| FR-611 | E1    | —                              | `core/src/pricing/totals.ts`         | `totals.test.ts`      | Done   |
| FR-612 | E2    | `QualityCheck`                 | gate in lifecycle                    | `lifecycle.test.ts`   | Done   |
| FR-614 | C3    | —                              | completion writer                    | `events.test.ts`      | Done   |
| FR-705 | F3    | —                              | `core/src/inspection/to-estimate.ts` | `to-estimate.test.ts` | Done   |
| FR-709 | F2    | `InspectionResult.measurement` | structured fields                    | `carry-out.test.ts`   | Done   |
| FR-812 | G3    | —                              | threshold check                      | `decision.test.ts`    | Done   |

## Invoicing, portal, reporting

| Req     | Story | Schema             | Implementation     | Test                  | Status |
| ------- | ----- | ------------------ | ------------------ | --------------------- | ------ |
| FR-902  | I1    | `DocumentSequence` | gapless numbering  | `verify-integrity.ts` | Done   |
| FR-907  | I1    | —                  | immutability guard | `invoicing.test.ts`   | Done   |
| FR-1407 | —     | —                  | coverage report    | `verify-passports.ts` | Done   |
| FR-1504 | —     | `ServiceSchedule`  | due calculation    | `arrival.test.ts`     | Done   |

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

| Req     | Story | Schema                                                          | Implementation                                                                                                         | Test                                                             | Status |
| ------- | ----- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------ |
| FR-3901 | A1    | —                                                               | `requestReset()`                                                                                                       | `verify-credentials.ts`                                          | Done   |
| FR-3902 | A1    | `AuthToken.usedAt`                                              | `redeemReset()`                                                                                                        | `verify-credentials.ts`                                          | Done   |
| FR-3903 | A1    | `auth_tokens_one_live_per_purpose`                              | `issue()`                                                                                                              | `verify-credentials.ts`                                          | Done   |
| FR-3904 | A1    | `User.emailVerifiedAt`                                          | `unverifiedWarning()`                                                                                                  | `tokens.test.ts`                                                 | Done   |
| FR-3905 | A1    | —                                                               | `redeemVerification()`                                                                                                 | `verify-credentials.ts`                                          | Done   |
| FR-3906 | A1    | —                                                               | `checkPassword()`                                                                                                      | `tokens.test.ts`                                                 | Done   |
| FR-4101 | K1    | —                                                               | `registerCustomer()`                                                                                                   | `verify-claims.ts`                                               | Done   |
| FR-4102 | K1    | `vehicle_claims_one_open_each`                                  | `claimVehicle()`                                                                                                       | `verify-claims.ts`                                               | Done   |
| FR-4103 | K1    | `vehicles_registration_normalised`                              | `identifierKind()`                                                                                                     | `verify-claims.ts`                                               | Done   |
| FR-4104 | A1    | `vehicle_claims_refusal_is_explained`                           | `decideClaim()`                                                                                                        | `verify-claims.ts`                                               | Done   |
| FR-4105 | K1    | —                                                               | `describeClaim()`                                                                                                      | `claims.test.ts`                                                 | Done   |
| FR-4106 | A1    | `User.emailVerifiedAt`                                          | `(workshop)/layout.tsx`                                                                                                | `verify-empty.ts`                                                | Done   |
| FR-4107 | K2    | —                                                               | `sendMessageNow()`                                                                                                     | `verify-records.ts`                                              | Done   |
| FR-4108 | A2    | —                                                               | `createCustomer()`                                                                                                     | `verify-records.ts`                                              | Done   |
| FR-4109 | A2    | `products_orgId_partNumber_key`                                 | `createProduct()`                                                                                                      | `verify-records.ts`                                              | Done   |
| FR-4110 | A2    | —                                                               | `createPurchaseOrder()`                                                                                                | `verify-records.ts`                                              | Done   |
| FR-4111 | A2    | `EstimateShare.tokenHash`                                       | `sendEstimate()`                                                                                                       | `verify-records.ts`                                              | Done   |
| FR-4112 | A1    | —                                                               | `inviteColleague()`                                                                                                    | `verify-team.ts`                                                 | Done   |
| FR-4113 | A1    | —                                                               | `sendCampaign()`                                                                                                       | `verify-automation.ts`                                           | Done   |
| FR-4114 | K3    | —                                                               | `NOT_FOUND_MARKER`                                                                                                     | `verify-controls.ts`                                             | Done   |
| FR-4201 | E2    | `JobStatusEvent`                                                | `moveJob()`                                                                                                            | `verify-money.ts`                                                | Done   |
| FR-4202 | E2    | `StockMovement`, `VehicleEvent`                                 | `moveJob()` on COMPLETED                                                                                               | `verify-money.ts`                                                | Done   |
| FR-4203 | E1    | `JobLabourLine`, `JobPartLine`                                  | `recordDecision()`                                                                                                     | `verify-money.ts`                                                | Done   |
| FR-4204 | G1    | `Invoice`, `invoices_orgId_number_key`                          | `issueInvoice()`                                                                                                       | `verify-money.ts`                                                | Done   |
| FR-4205 | G1    | `Job.invoicedAt`                                                | `issueInvoice()`                                                                                                       | `verify-money.ts`                                                | Done   |
| FR-4206 | G2    | `Payment`                                                       | `recordPayment()`                                                                                                      | `verify-money.ts`                                                | Done   |
| FR-4207 | G3    | `CreditNote`                                                    | `raiseCreditNote()`                                                                                                    | `verify-money.ts`                                                | Done   |
| FR-4208 | G3    | `refunds_amount_is_positive`                                    | `recordRefund()`                                                                                                       | `verify-money.ts`                                                | Done   |
| FR-4209 | L2    | —                                                               | `postEntry()`                                                                                                          | `invoicing.test.ts`, `verify-money.ts`                           | Done   |
| FR-4301 | M1    | `SupplierBill`, `supplier_bills_orgId_reference_key`            | `bookBill()`                                                                                                           | `verify-erp.ts`                                                  | Done   |
| FR-4302 | M1    | `BillStatus`                                                    | `approveBill()`, `disputeBill()`                                                                                       | `verify-erp.ts`                                                  | Done   |
| FR-4303 | M1    | `SupplierPaymentAllocation`                                     | `allocateAcrossBills()`                                                                                                | `payables.test.ts`, `verify-erp.ts`                              | Done   |
| FR-4304 | M1    | `SupplierPayment`                                               | `paySupplier()`, `remittanceAdvice()`                                                                                  | `verify-erp.ts`                                                  | Done   |
| FR-4305 | M2    | `PayrollRun`, `Timesheet.payrollRunId`                          | `runPayroll()`                                                                                                         | `verify-erp.ts`                                                  | Done   |
| FR-4306 | M2    | —                                                               | `PAYROLL_COLUMNS`                                                                                                      | `payroll.test.ts`                                                | Done   |
| FR-4307 | M2    | `payroll_runs_paid_has_a_time`                                  | `markPayrollPaid()`                                                                                                    | `verify-erp.ts`                                                  | Done   |
| FR-4308 | M3    | `FleetAgreement`, `fleet_agreements_discounts_are_percentages`  | `saveFleetAgreement()`                                                                                                 | `fleet.test.ts`, `verify-erp.ts`                                 | Done   |
| FR-4309 | M3    | `InvoiceLine.jobId`                                             | `consolidateMonth()`                                                                                                   | `verify-erp.ts`                                                  | Done   |
| FR-4310 | M3    | —                                                               | `assertConsolidatable()`                                                                                               | `fleet.test.ts`, `verify-erp.ts`                                 | Done   |
| FR-4401 | N1    | —                                                               | `parseQuestion()`, `COVERAGE`                                                                                          | `questions.test.ts`, `verify-answers.ts`                         | Done   |
| FR-4402 | N1    | —                                                               | `answer()`                                                                                                             | `verify-answers.ts`                                              | Done   |
| FR-4403 | N1    | —                                                               | `refusal()`                                                                                                            | `questions.test.ts`, `verify-answers.ts`                         | Done   |
| FR-4404 | N1    | —                                                               | `observeRevenue()`                                                                                                     | `observations.test.ts`                                           | Done   |
| FR-4405 | N2    | —                                                               | `customerSummary()`                                                                                                    | `summary.test.ts`                                                | Done   |
| FR-4406 | N2    | —                                                               | `verifyAgainstFacts()`, `polish()`                                                                                     | `summary.test.ts`, `verify-answers.ts`                           | Done   |
| FR-4407 | N2    | —                                                               | `sendCustomerSummary()` is a person's action                                                                           | `verify-controls.ts`                                             | Done   |
| FR-4408 | N2    | —                                                               | `/ask` page copy                                                                                                       | `verify-empty.ts`                                                | Done   |
| FR-4501 | O1    | `vehicles_registration_normalised`                              | `findOnNetwork()`                                                                                                      | `verify-network.ts`                                              | Done   |
| FR-4502 | O1    | —                                                               | `summariseNetwork()`                                                                                                   | `network.test.ts`, `verify-network.ts`                           | Done   |
| FR-4503 | O1    | `VehicleAccessGrant`                                            | `adoptVehicle()`, `grantServicingAccess()`                                                                             | `verify-network.ts`                                              | Done   |
| FR-4504 | O1    | —                                                               | `redactForNetwork()`, `WITHHELD_KEYS`                                                                                  | `network.test.ts`, `verify-network.ts`                           | Done   |
| FR-4505 | O1    | `VehicleEvent.prevHash`                                         | `writeJobCompletion()`                                                                                                 | `verify-network.ts`                                              | Done   |
| FR-4506 | O1    | `Vehicle.vinValid`                                              | `registerVehicle()`                                                                                                    | `verify-network.ts`                                              | Done   |
| FR-4507 | O2    | `ApiKey`                                                        | `issueApiKey()`, `createApiKey()`                                                                                      | `api-keys.test.ts`, `verify-network.ts`                          | Done   |
| FR-4508 | O2    | —                                                               | `/api/v1/vehicles/[vin]`, `networkHistory()`                                                                           | `verify-network.ts`                                              | Done   |
| FR-4509 | O2    | —                                                               | `sinceFrom()`, `assertKeyUsable()`                                                                                     | `api-keys.test.ts`, `verify-network.ts`                          | Done   |
| FR-4601 | P1    | —                                                               | `updateOrganisation()`                                                                                                 | `settings.test.ts`, `verify-settings.ts`                         | Done   |
| FR-4602 | P1    | —                                                               | `updateSite()`, `normaliseCode()`                                                                                      | `settings.test.ts`, `verify-settings.ts`                         | Done   |
| FR-4603 | P1    | `locations_open_before_close`                                   | `gather()` reads the site's hours                                                                                      | `verify-settings.ts`                                             | Done   |
| FR-4604 | P1    | —                                                               | `saveBay()`, `saveTaxRate()`, `saveJobType()`                                                                          | `verify-settings.ts`                                             | Done   |
| FR-4605 | P1    | —                                                               | `setDefaultTaxRate()`, `setTaxRateActive()`                                                                            | `verify-settings.ts`                                             | Done   |
| FR-4606 | P2    | `Booking.jobId` unique, `BookingSource.PLAN`                    | `acceptPlan()`, `diaryDraftsFor()`                                                                                     | `accept.test.ts`, `verify-settings.ts`                           | Done   |
| FR-4607 | P1    | —                                                               | `setNumberingPrefix()`                                                                                                 | `verify-settings.ts`                                             | Done   |
| FR-4608 | P1    | `AuditLog`                                                      | `audit()` on every settings write                                                                                      | `verify-settings.ts`                                             | Done   |
| FR-4701 | Q1    | `VehicleDocument`, `VehicleDocumentKind`                        | `addDocument()`                                                                                                        | `verify-documents.ts`                                            | Done   |
| FR-4702 | Q1    | —                                                               | `mayHandleDocuments()`                                                                                                 | `verify-documents.ts`                                            | Done   |
| FR-4703 | Q1    | `vehicle_documents_expire_after_issue`                          | `assertDocumentAcceptable()`                                                                                           | `documents.test.ts`, `verify-documents.ts`                       | Done   |
| FR-4704 | Q1    | `vehicle_documents_have_bytes`                                  | `/api/vehicle-documents` ticket then record                                                                            | `verify-documents.ts`                                            | Done   |
| FR-4705 | Q1    | —                                                               | `paperworkSummary()`, `paperworkDue()`                                                                                 | `documents.test.ts`, `verify-documents.ts`                       | Done   |
| FR-4706 | Q2    | `Customer.preferredTechnicianUserId`                            | `setPreferredTechnician()`, `jobFormOptions()`                                                                         | `verify-documents.ts`                                            | Done   |
| FR-4707 | Q1    | `vehicle_documents_removal_is_explained`                        | `assertRemovable()`, `removeDocument()`                                                                                | `documents.test.ts`, `verify-documents.ts`                       | Done   |
| FR-4708 | Q1    | `AuditLog`                                                      | `audit()`, `/api/v1/vehicles/[vin]`                                                                                    | `verify-documents.ts`                                            | Done   |
| FR-4801 | R1    | —                                                               | `proxy.ts`, `contentSecurityPolicy()`                                                                                  | `hardening.test.ts`, `verify-headers.ts`                         | Done   |
| FR-4802 | R2    | —                                                               | `breachedPasswordProblem()`, `passwordRange()`                                                                         | `hardening.test.ts`, `verify-hardening.ts`                       | Done   |
| FR-4803 | R3    | `ApiKey.windowStartedAt`, `ApiKey.windowCount`                  | `decideRate()`, `authenticateApiKey()`                                                                                 | `hardening.test.ts`, `verify-network.ts`                         | Done   |
| FR-4804 | R4    | —                                                               | `verify-backup.ts`                                                                                                     | `verify-backup.ts` in CI                                         | Done   |
| FR-4805 | R5    | —                                                               | `openApiDocument`, `/api/v1/openapi.json`, `build-openapi.ts`                                                          | `docs:openapi:check`, `verify-network.ts`                        | Done   |
| FR-4806 | R1    | —                                                               | `next.config.ts` headers, `REQUIRED_SECURITY_HEADERS`                                                                  | `verify-headers.ts`                                              | Done   |
| FR-4901 | S1    | `AssistantExchange`                                             | `explainJob()`, `explainFor()`                                                                                         | `assistant.test.ts`, `verify-assistant.ts`                       | Done   |
| FR-4902 | S2    | —                                                               | `draftMessage()`, `draftFor()`, `draftAllowances()`                                                                    | `assistant.test.ts`, `verify-assistant.ts`                       | Done   |
| FR-4903 | S2    | `AssistantExchange.sentMessageId`                               | `sendDraft()`                                                                                                          | `verify-assistant.ts`                                            | Done   |
| FR-4904 | S3    | `AssistantExchange`, `assistant_exchanges_have_words`           | `record()` in `lib/assistant.ts`                                                                                       | `verify-assistant.ts`                                            | Done   |
| FR-4905 | S3    | `Organization.assistantTokenBudget`                             | `assistantBudget()`, `budgetFor()`, `setAssistantBudget()`                                                             | `assistant.test.ts`, `verify-assistant.ts`                       | Done   |
| FR-4906 | S2    | —                                                               | `compose()` in `lib/ai.ts`, `verifyAgainstFacts()`                                                                     | `summary.test.ts`, `verify-assistant.ts`                         | Done   |
| FR-4907 | S1    | —                                                               | `askAssistant()`                                                                                                       | `verify-assistant.ts`                                            | Done   |
| FR-5001 | T1    | —                                                               | `VehiclePassport` in `components/vehicle-passport.tsx`                                                                 | `verify-controls.ts`, `verify-access.ts`                         | Done   |
| FR-5002 | T1    | —                                                               | `mrzLines()`, `mrzVerify()`                                                                                            | `mrz.test.ts`                                                    | Done   |
| FR-5003 | T1    | —                                                               | `PassportStamp`, `inkFor()`, `stampTilt()`                                                                             | `verify-access.ts`                                               | Done   |
| FR-5004 | T1    | —                                                               | `detailFor()`, `authorityFor()`                                                                                        | reviewed on the page                                             | Done   |
| FR-5005 | T2    | —                                                               | `BackToOrigin`                                                                                                         | `verify-controls.ts`                                             | Done   |
| FR-5006 | T2    | —                                                               | `PassportBooklet`                                                                                                      | `verify-controls.ts`, `verify-access.ts`                         | Done   |
| FR-5101 | U1    | `LoyaltyEntry`                                                  | `awardForInvoice()`, `recordPayment()`                                                                                 | `verify-loyalty.ts`                                              | Done   |
| FR-5102 | U1    | `PaymentMethod.LOYALTY`, account 6400                           | `redeemAgainstInvoice()`, `accountForMethod()`                                                                         | `accounting.test.ts`, `verify-loyalty.ts`                        | Done   |
| FR-5103 | U1    | —                                                               | `assertRedeemable()`, `assertPaymentRecordable()`                                                                      | `retention.test.ts`, `verify-loyalty.ts`                         | Done   |
| FR-5104 | U1    | `LoyaltyEntry.reason`                                           | `awardByHand()`                                                                                                        | `verify-loyalty.ts`                                              | Done   |
| FR-5105 | U1    | —                                                               | `loyaltyCardFor()`, the Points card on `/customers/[id]`                                                               | `verify-controls.ts`, `verify-empty.ts`                          | Done   |
| FR-5106 | U2    | —                                                               | `pointsForPortalUser()`, the portal home                                                                               | `verify-controls.ts`, `verify-empty.ts`                          | Done   |
| FR-5107 | U1    | `Account`                                                       | `ensureChartOfAccounts()`                                                                                              | `verify-loyalty.ts`                                              | Done   |
| FR-5201 | V2    | `Referral.code`                                                 | `referralFor()`, `referralsForPortalUser()`                                                                            | `verify-referrals.ts`                                            | Done   |
| FR-5202 | V1    | —                                                               | `checkCode()`, `redeemCode()`, `useReferral()`                                                                         | `retention.test.ts`, `verify-referrals.ts`                       | Done   |
| FR-5203 | V1    | `Referral.referredCustomerId`                                   | `redeemCode()`                                                                                                         | `verify-referrals.ts`                                            | Done   |
| FR-5204 | V1    | `Referral.creditedAt`                                           | `creditReferral()`, `assertCreditable()`                                                                               | `retention.test.ts`, `verify-referrals.ts`                       | Done   |
| FR-5205 | V1    | —                                                               | `settleReferralsFor()` from `recordPayment()`                                                                          | `verify-referrals.ts`                                            | Done   |
| FR-5206 | V1    | —                                                               | `referralCardFor()`, the Referrals card on `/customers/[id]`                                                           | `verify-controls.ts`, `verify-empty.ts`                          | Done   |
| FR-5301 | W1    | `GiftCard`, `gift_cards_sold_for_something`                     | `assertCardSellable()`, `sellGiftCard()`                                                                               | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5302 | W1    | `PaymentMethod.GIFT_CARD`, account 2300                         | `postGiftCardSold()`, `accountForMethod()`                                                                             | `accounting.test.ts`, `verify-giftcards.ts`                      | Done   |
| FR-5303 | W1    | `GiftCard.code`                                                 | `giftCardCode()`, `looksLikeGiftCode()`, `findGiftCard()`                                                              | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5304 | W2    | —                                                               | `assertCardRedeemable()`, `redeemGiftCard()`                                                                           | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5305 | W2    | `GiftCardEntry`, `gift_card_entries_move_something`             | `giftCardBalance()`, `giftCardDetail()`                                                                                | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5306 | W1    | —                                                               | `giftCardsFor()`, `/gift-cards`                                                                                        | `verify-controls.ts`, `verify-empty.ts`                          | Done   |
| FR-5401 | X1    | —                                                               | `passportsForOrg()`, `/passports`                                                                                      | `verify-passports.ts`                                            | Done   |
| FR-5402 | X1    | —                                                               | `verifyVehicleChain()` per row in `lib/passports.ts`                                                                   | `verify-passports.ts`                                            | Done   |
| FR-5403 | X2    | `VehicleOwnership.endedAt`                                      | `passportsForOwner()`, `/portal/passports`                                                                             | `verify-passports.ts`                                            | Done   |
| FR-5404 | X1    | —                                                               | `app/icon.svg`, `app/apple-icon.tsx`                                                                                   | reviewed in the browser                                          | Done   |
| FR-5501 | Y1    | `GiftCardEntry.kind`, `gift_card_entries_kind_matches_sign`     | `sellGiftCard()`, `redeemGiftCard()`, `refundOntoCard()`, `adjustGiftCard()`                                           | `verify-giftcards.ts`                                            | Done   |
| FR-5502 | Y2    | —                                                               | `giftCardStatus()`                                                                                                     | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5503 | Y2    | `GiftCard.expiresAt`, `GiftCard.locationId`                     | `assertCardSellable()`, `assertCardRedeemable()`, `giftCardExpiry()`                                                   | `giftcards.test.ts`, `verify-giftcards.ts`                       | Done   |
| FR-5504 | Y1    | `TenderKind.GIFT_CARD`, `GiftCardEntry.counterSaleId`           | `redeemAtCounter()`, `settle()`, `postCounterSale()`                                                                   | `pos.test.ts`, `verify-giftcards.ts`                             | Done   |
| FR-5505 | Y1    | —                                                               | `refundOntoCard()` from `recordRefund()`                                                                               | `verify-giftcards.ts`                                            | Done   |
| FR-5506 | Y2    | —                                                               | `assertCardAdjustable()`, `adjustGiftCard()`, `postGiftCardAdjustment()`                                               | `giftcards.test.ts`, `accounting.test.ts`, `verify-giftcards.ts` | Done   |
| FR-5507 | Y2    | `gift_cards_cancelled_with_a_reason`                            | `disableGiftCard()`                                                                                                    | `verify-giftcards.ts`                                            | Done   |
| FR-5601 | Z1    | `Organization.country`                                          | `COUNTRIES`, `regionOf()`, `updateOrganisation()`                                                                      | `region.test.ts`, `verify-region.ts`                             | Done   |
| FR-5602 | Z1    | —                                                               | `createWorkshop()`, `regionForCountry()`, `countryFor()`                                                               | `verify-region.ts`                                               | Done   |
| FR-5603 | Z1    | —                                                               | `Session.region`, every workshop page                                                                                  | `verify-region.ts`, `verify-controls.ts`                         | Done   |
| FR-5604 | Z2    | —                                                               | `regionForUser()`, `pointsForPortalUser()`                                                                             | `verify-region.ts`                                               | Done   |
| FR-5605 | Z1    | —                                                               | `regionFor()` in `lib/money.ts`, `lib/fleet.ts`, `lib/estimates.ts`                                                    | `verify-region.ts`                                               | Done   |
| FR-5606 | Z1    | —                                                               | the settings page                                                                                                      | reviewed on the page                                             | Done   |
| FR-5701 | AA1   | `Deposit`, `deposits_taken_for_something`                       | `takeDeposit()`, `postDepositTaken()`                                                                                  | `deposits.test.ts`, `accounting.test.ts`, `verify-deposits.ts`   | Done   |
| FR-5702 | AA1   | `DepositMovement`, `deposits_never_overdrawn`                   | `heldOn()`, `depositStatus()`, `heldFor()`                                                                             | `deposits.test.ts`, `verify-deposits.ts`                         | Done   |
| FR-5703 | AA1   | `PaymentMethod.DEPOSIT`                                         | `applyHeld()`, `assertDepositApplicable()`, `accountForMethod()`                                                       | `deposits.test.ts`, `accounting.test.ts`, `verify-deposits.ts`   | Done   |
| FR-5704 | AA2   | `Deposit.kind`, `Deposit.sourceRefundId`                        | `keepAsCredit()` from `recordRefund()`                                                                                 | `verify-deposits.ts`                                             | Done   |
| FR-5705 | AA1   | —                                                               | `returnHeld()`, `assertDepositReturnable()`, `postDepositReturned()`                                                   | `deposits.test.ts`, `verify-deposits.ts`                         | Done   |
| FR-5706 | AA3   | —                                                               | `receiptFor()`, the receipt in `recordPayment()`, `/payments/[id]/receipt`                                             | `verify-deposits.ts`, `verify-controls.ts`                       | Done   |
| FR-5801 | AB1   | —                                                               | `isWritePermission()`, the action scan in `verify-authz.ts`                                                            | `subscription.test.ts`, `verify-authz.ts`                        | Done   |
| FR-5802 | AB1   | —                                                               | `can()`, `requireSession()`, the workshop layout                                                                       | `verify-authz.ts`                                                | Done   |
| FR-5803 | AB1   | `forOrg()` scoping                                              | `notFound()` on every detail page, `authenticateApiKey()`, the cron secret                                             | `verify-authz.ts`                                                | Done   |
| FR-5804 | AB2   | —                                                               | `assertWithinLimit()` in `saveBay()`, `registerVehicle()`, `inviteColleague()`                                         | `prices.test.ts`, `verify-authz.ts`                              | Done   |
| FR-5805 | AB2   | —                                                               | `assertPlanAllows()` in `createApiKey()`, `runPayroll()`, `dispatchTransfer()`, `completeSale()`, `recordExpense()`    | `prices.test.ts`, `verify-authz.ts`                              | Done   |
| FR-5806 | AB3   | `Organization.trialEndsAt/subscribedAt/suspendedAt/cancelledAt` | `subscriptionStateOf()`, `planOf()`                                                                                    | `subscription.test.ts`, `verify-authz.ts`                        | Done   |
| FR-5807 | AB3   | —                                                               | `requireSession()` read-only branch, `/settings/subscription`, `choosePlan()`                                          | `verify-authz.ts`, `verify-controls.ts`                          | Done   |
| FR-5901 | AC1   | `PaymentAttempt`, `Refund.attemptId`                            | `PaymentProvider` in core, `stubProvider`, `stripeProvider`, `paymentProvider()`                                       | `attempts.test.ts`, `verify-payments.ts`                         | Done   |
| FR-5902 | AC1   | `PaymentAttempt.status`                                         | `startCardPayment()`, `assertAttemptCreatable()`, the portal invoices page                                             | `attempts.test.ts`, `verify-payments.ts`                         | Done   |
| FR-5903 | AC1   | `PaymentAttemptStatus`, `PaymentAttempt.failureReason`          | `nextAttemptState()`, `settleAttempt()`                                                                                | `attempts.test.ts`, `verify-payments.ts`                         | Done   |
| FR-5904 | AC1   | `PaymentAttempt.paymentId` unique                               | `settlesMoney()`, the claim in `settleAttempt()`, `recordPayment()`                                                    | `verify-payments.ts`                                             | Done   |
| FR-5905 | AC2   | `Refund.providerRef`                                            | `refundThroughProvider()` from `recordRefund()`, `assertRefundableThroughProvider()`                                   | `attempts.test.ts`, `verify-payments.ts`                         | Done   |
| FR-5906 | AC3   | —                                                               | `reconcileAttempts()`, `reconcileFor()`, `/payments/card`                                                              | `attempts.test.ts`, `verify-payments.ts`, `verify-controls.ts`   | Done   |
| FR-5907 | AC3   | —                                                               | `parseWebhook()` per provider, `/api/payments/webhook`                                                                 | `verify-payments.ts`                                             | Done   |
| FR-6001 | AD1   | `Organization.billingSubscriptionRef`, `trialEndsAt`            | `subscriptionStateOf()` AWAITING_CARD, `startTrialCheckout()`, `TRIAL_DAYS`                                            | `subscription.test.ts`, `billing.test.ts`, `verify-billing.ts`   | Done   |
| FR-6002 | AD1   | `Organization.termsAcceptedAt`, `termsVersion`                  | the sign-up action's `agree` box, `createWorkshop()` options, `/terms`                                                 | `verify-billing.ts`, `verify-signup.ts`                          | Done   |
| FR-6003 | AD1   | `Organization.trialReminderSentAt`                              | `trialReminderDue()`, `remindTrialsEnding()`, the hourly cron                                                          | `subscription.test.ts`, `verify-billing.ts`                      | Done   |
| FR-6004 | AD2   | `Organization.billingStatus`, `subscribedAt`                    | `applyBillingEvent()`, `subscriptionStateOf()` PAST_DUE                                                                | `subscription.test.ts`, `verify-billing.ts`                      | Done   |
| FR-6005 | AD2   | `Organization.billingCardBrand/Last4`, `currentPeriodEnd`       | `billingOverview()`, `monthlyChargeFor()`, `billingPortalLink()`, `/settings/subscription`                             | `verify-billing.ts`, `verify-controls.ts`                        | Done   |
| FR-6006 | AD3   | `Organization.cancelledAt` in the future                        | `cancelSubscription()`, `subscriptionStateOf()` cancel-at-period-end                                                   | `subscription.test.ts`, `verify-billing.ts`                      | Done   |
| FR-6007 | AD3   | —                                                               | `parseWebhook()` subscription and invoice events, `syncBillingFromProvider()`                                          | `verify-billing.ts`                                              | Done   |
| FR-6101 | AE1   | —                                                               | `PRICE_BOOK`, `planPrice()`, `annualSavingPercent()`                                                                   | `prices.test.ts`                                                 | Done   |
| FR-6102 | AE1   | `Organization.baseCurrency`                                     | `monthlyChargeFor()`, `SignupPricing`, the pricing and terms pages, `remindTrialsEnding()`                             | `prices.test.ts`, `verify-billing.ts`                            | Done   |
| FR-6103 | AE2   | `ConsentChange.source = PORTAL`                                 | `updateProfile()`, `changePassword()`, `setConsent()`, `/portal/settings`                                              | `verify-portal-account.ts`                                       | Done   |
| FR-6201 | AF1   | `ImportBatch.headers`, `rows`, `delimiter`                      | `parseCsv()`, `detectDelimiter()`, `uploadImport()`                                                                    | `importing.test.ts`, `verify-import.ts`                          | Done   |
| FR-6202 | AF1   | `ImportBatch.mapping`                                           | `DATASETS`, `suggestMapping()`, `saveMapping()`                                                                        | `importing.test.ts`, `verify-import.ts`                          | Done   |
| FR-6203 | AF1   | —                                                               | `validateRows()`, `/settings/data/[id]` preview                                                                        | `importing.test.ts`, `verify-import.ts`                          | Done   |
| FR-6204 | AF1   | `ImportBatch.status`, `report`                                  | `runImport()` through `createCustomer()`, `registerVehicle()`, `adoptVehicle()`, `createProduct()`, `createSupplier()` | `verify-import.ts`                                               | Done   |
| FR-6205 | AF2   | `JournalEntry.sourceType = ImportBatch`                         | `openingImbalance()`, `importBalances()`, `postEntry()`                                                                | `importing.test.ts`, `verify-import.ts`                          | Done   |
| FR-6206 | AF3   | —                                                               | `exportDataset()`, `/api/exports/[dataset]`                                                                            | `verify-import.ts`, `verify-controls.ts`                         | Done   |

## The workflow, as one thing

| Req     | Story | Schema                                     | Implementation                                                                     | Test                                     | Status |
| ------- | ----- | ------------------------------------------ | ---------------------------------------------------------------------------------- | ---------------------------------------- | ------ |
| FR-6301 | AG1   | `Booking.jobId`, `status = CONVERTED`      | `startJobFromBooking()`, the booking page's `start` action                         | `verify-workflow.ts`                     | Done   |
| FR-6302 | AG2   | `Estimate.total`, `EstimateLine.lineTotal` | `retotalEstimate()` from `completeInspection()` and `quoteExtraWork()`             | `verify-workflow.ts`                     | Done   |
| FR-6303 | AG2   | `EstimateApproval.note`                    | `approveInPerson()` through `recordDecision()`, the job page's `approve` action    | `verify-workflow.ts`                     | Done   |
| FR-6304 | AG2   | `EstimateLine.productId`, `JobPartLine`    | `recordDecision()` then `reserveForJobLine()` per part, `defaultWarehouseFor()`    | `verify-workflow.ts`                     | Done   |
| FR-6305 | AG3   | `Estimate.supplementary`                   | `quoteExtraWork()`, `sendEstimate()` and `recordDecision()` leaving the job status | `verify-workflow.ts`                     | Done   |
| FR-6306 | AG4   | —                                          | `WORKFLOWS`, `checkWalk()`, `build-workflows-doc.ts`                               | `workflow.test.ts`, `verify-workflow.ts` | Done   |

## Arrival and departure

| Req     | Story | Schema                                                    | Implementation                                                        | Test                                   | Status |
| ------- | ----- | --------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- | ------ |
| FR-6401 | AH1   | `VehicleCheck` IN, `KeyEvent`, `OdometerReading`          | `checkIn()`, `/jobs/[id]/check-in`                                    | `arrival.test.ts`, `verify-arrival.ts` | Done   |
| FR-6402 | AH1   | —                                                         | `assertCheckInAllowed()`, `assertCheckOutAllowed()`                   | `arrival.test.ts`, `verify-arrival.ts` | Done   |
| FR-6403 | AH1   | `JobAttachment.checkId`                                   | `/api/check-photos`, `attachCheckPhoto()`, `CheckPhotos`              | `verify-arrival.ts`                    | Done   |
| FR-6404 | AH2   | `VehicleCheck` OUT, `letGoOwingReason`, `Job.collectedAt` | `checkOut()`, `outstandingOn()`, `/jobs/[id]/check-out`               | `arrival.test.ts`, `verify-arrival.ts` | Done   |
| FR-6405 | AH1   | `Signature`, `EstimateApproval.signatureId`               | `signatureIsUsable()`, `recordSignature()`, `SignaturePad`, `approve` | `arrival.test.ts`, `verify-arrival.ts` | Done   |
| FR-6406 | AH3   | `KeyEvent`                                                | `keyState()`, `moveKeys()`, the job page and `/shop` cards            | `arrival.test.ts`, `verify-arrival.ts` | Done   |
| FR-6407 | AH2   | —                                                         | `vehicleHistory()` checks, `/portal/vehicles/[id]`                    | `verify-arrival.ts`                    | Done   |

## Conversations

| Req     | Story | Schema                                                                       | Implementation                                                                            | Test                                               | Status |
| ------- | ----- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| FR-6501 | AI1   | `Conversation`, `MessageLog.conversationId`, `InboundMessage.conversationId` | `threadFor()`, `fileOutbound()` from `pushNow()`, `fileInbound()` from `receiveInbound()` | `verify-conversations.ts`                          | Done   |
| FR-6502 | AI1   | —                                                                            | `fileUnfiled()`, `handleInbound()` re-filing                                              | `verify-conversations.ts`                          | Done   |
| FR-6503 | AI1   | `Conversation.readAt`, `lastInboundAt`, `status`                             | `mergeThread()`, `orderThreads()`, `isUnread()`, `markRead()`                             | `conversations.test.ts`, `verify-conversations.ts` | Done   |
| FR-6504 | AI2   | `MessageLog.sentByUserId`                                                    | `reachableChannels()`, `preferredChannel()`, `sendReply()`                                | `conversations.test.ts`, `verify-conversations.ts` | Done   |
| FR-6505 | AI2   | `MessageChannel.WHATSAPP`                                                    | `configureTransports()` WHATSAPP, `TwilioTransport` whatsapp, `/api/inbound`              | `verify-conversations.ts`, `verify-messaging.ts`   | Done   |
| FR-6506 | AI3   | `MessageTemplate`                                                            | `DEFAULT_TEMPLATES`, `fillTemplate()`, `templateValues()`, `paymentLinkFor()`             | `conversations.test.ts`, `verify-conversations.ts` | Done   |
| FR-6507 | AI2   | `MessageAttachment`, `Conversation.assignedToUserId`                         | `sendReply()` files, `assignConversation()`, `setConversationStatus()`                    | `verify-conversations.ts`                          | Done   |

## Packages and templates

| Req     | Story | Schema                                                        | Implementation                                                                  | Test                                     | Status |
| ------- | ----- | ------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- | ------ |
| FR-6601 | AJ1   | `ServicePackage`, `ServicePackageLine`, `ServicePackageCheck` | `savePackage()`, `/settings/packages`                                           | `packages.test.ts`, `verify-packages.ts` | Done   |
| FR-6602 | AJ1   | —                                                             | `assertPackageSound()`, the duplicate-code refusal                              | `packages.test.ts`, `verify-packages.ts` | Done   |
| FR-6603 | AJ1   | `Job.packageId`                                               | `applyPackage()` from `createJob()` and the job page                            | `verify-packages.ts`                     | Done   |
| FR-6604 | AJ2   | `Booking.packageId`                                           | `createBooking()`, `startJobFromBooking()`, `servicesFor()`, `requestBooking()` | `verify-packages.ts`                     | Done   |
| FR-6605 | AJ3   | `ServiceSchedule`                                             | `nextServiceFrom()`, `refreshScheduleFor()` from `moveJob()`                    | `packages.test.ts`, `verify-packages.ts` | Done   |

## Languages

| Req     | Story | Schema          | Implementation                                                                 | Test                                  | Status |
| ------- | ----- | --------------- | ------------------------------------------------------------------------------ | ------------------------------------- | ------ |
| FR-6701 | AK1   | `User.language` | `pickLanguage()`, `currentLanguage()`, `setLanguage()`, `applySavedLanguage()` | `i18n.test.ts`, `verify-languages.ts` | Done   |
| FR-6702 | AK1   | —               | `htmlAttributes()` on the root layout, `dirFor()`                              | `i18n.test.ts`, `verify-languages.ts` | Done   |
| FR-6703 | AK2   | —               | `translate()` fallback, `hasTranslation()`, the coverage check                 | `i18n.test.ts`, `verify-languages.ts` | Done   |
| FR-6704 | AK2   | —               | `LanguageSwitch`, `/api/language`                                              | `verify-languages.ts`                 | Done   |
| FR-6705 | AK1   | —               | `FR`, `AR` dictionaries; `t()` on the public, portal and shell pages           | `verify-languages.ts`                 | Done   |

## Parts back, work out

| Req     | Story | Schema                                         | Implementation                                                            | Test                                   | Status |
| ------- | ----- | ---------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------- | ------ |
| FR-6801 | AL1   | `SupplierReturn`, `SupplierReturnLine`         | `assertReturnable()`, `sendReturn()`, the order page                      | `returns.test.ts`, `verify-returns.ts` | Done   |
| FR-6802 | AL1   | `StockMovement` RETURN, account 1150           | `lockLevel()`, `applyIssue()`, `postReturnSent()`                         | `returns.test.ts`, `verify-returns.ts` | Done   |
| FR-6803 | AL1   | `SupplierCreditApplication`, `creditUnapplied` | `applyCredit()`, `creditReturn()`, `applyHeldCredits()` from `bookBill()` | `returns.test.ts`, `verify-returns.ts` | Done   |
| FR-6804 | AL2   | —                                              | `postReturnCredited()`                                                    | `returns.test.ts`, `verify-returns.ts` | Done   |
| FR-6805 | AL1   | `SupplierReturn.refusedReason`                 | `refuseReturn()`, `postReturnRefused()`, `/purchasing/returns`            | `returns.test.ts`, `verify-returns.ts` | Done   |
| FR-6806 | AL3   | `JobSublet`, `JobPartLine`                     | `assertSubletSound()`, `addSublet()`, `subletMargin()`, the job page      | `returns.test.ts`, `verify-returns.ts` | Done   |
| FR-6807 | AL3   | `JobSublet.billId`, account 5020               | `assertSubletBillable()`, `billSublet()`, `postSubletBilled()`            | `returns.test.ts`, `verify-returns.ts` | Done   |

## Finding anything

| Req     | Story | Schema                     | Implementation                                                                                                                      | Test                                 | Status |
| ------- | ----- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------ |
| FR-6901 | AM1   | expression indexes         | `readQuery()`, `searchEverything()`, the navigation box, `/search`                                                                  | `search.test.ts`, `verify-search.ts` | Done   |
| FR-6902 | AM1   | —                          | `rankHits()`, `straightTo()`                                                                                                        | `search.test.ts`, `verify-search.ts` | Done   |
| FR-6903 | AM1   | `VehicleAccessGrant`       | the scoped queries in `searchEverything()`                                                                                          | `verify-search.ts`                   | Done   |
| FR-6904 | AM2   | `StaffNotification`        | `recipients()`, `notifyStaff()` from `recordDecision()`, `receiveInbound()`, `requestBooking()`, `settleAttempt()`, `requestPart()` | `search.test.ts`, `verify-search.ts` | Done   |
| FR-6905 | AM2   | `StaffNotification.readAt` | `notificationsFor()`, `openNotification()`, `markAllRead()`, `/notifications`                                                       | `verify-search.ts`                   | Done   |

## The owner's day, sharpened

| Req     | Story | Schema                           | Implementation                                                                                   | Test                                 | Status |
| ------- | ----- | -------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------ | ------ |
| FR-7001 | AN1   | `Job.comebackOfJobId`            | `assertComebackLink()`, `comebackCandidates()`, `markComeback()`, `clearComeback()`              | `owner.test.ts`, `verify-owner.ts`   | Done   |
| FR-7002 | AN1   | —                                | `comebackRates()`, `rateOf()`, `comebackPicture()`, the business report                          | `owner.test.ts`, `verify-owner.ts`   | Done   |
| FR-7003 | AN2   | `ReviewRequest`                  | `ratingTrend()`, `monthlyRatings()`, `reputationBy()`, `reputationTrend()`                       | `owner.test.ts`, `verify-owner.ts`   | Done   |
| FR-7004 | AN3   | `PurchaseOrderLine`              | `measureSupplier()`, `compareSuppliers()`, `supplierOptionsFor()`, the part page, the order form | `owner.test.ts`, `verify-owner.ts`   | Done   |
| FR-7005 | AN3   | `GoodsReceipt`, `SupplierReturn` | `performanceOverTime()`, `describePerformance()`, `supplierOverTime()`                           | `owner.test.ts`, `verify-owner.ts`   | Done   |
| FR-7006 | AN4   | —                                | `ownerDay()`, the dashboard                                                                      | `verify-owner.ts`, `verify-authz.ts` | Done   |

## Every word translated

| Req     | Story | Schema | Implementation                                                         | Test                                      | Status |
| ------- | ----- | ------ | ---------------------------------------------------------------------- | ----------------------------------------- | ------ |
| FR-7101 | AO1   | —      | `tFor()`, `useT()`, `msg()`, `generateMetadata`, the area dictionaries | `i18n-scan.ts`, `verify-languages.ts`     | Done   |
| FR-7102 | AO2   | —      | `translate()` reading finished sentences through keys with slots       | `i18n.test.ts`, `i18n-scan.ts --messages` | Done   |
| FR-7103 | AO1   | —      | calendar words in the translator, `readerLocale()`                     | `verify-languages.ts`                     | Done   |
| FR-7104 | AO1   | —      | `i18n-ignore` on examples; no keys for names                           | `i18n.test.ts`                            | Done   |
| FR-7105 | AO2   | —      | `infra/scripts/i18n-scan.ts`, `i18n-missing.ts`                        | `verify-languages.ts`                     | Done   |

## Tax, configurable

| Req     | Story | Schema                                 | Implementation                                                                                     | Test                           | Status |
| ------- | ----- | -------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------ | ------ |
| FR-7201 | AP1   | `TaxComponent`                         | `assertTaxRateSound()`, `effectiveRatePct()`, `taxOnLine()`, `saveTaxRateWithParts()`              | `tax.test.ts`, `verify-tax.ts` | Done   |
| FR-7202 | AP2   | `Organization.pricesIncludeTax`        | `taxOnLine()` with tax in, `setPricesIncludeTax()`, `linePricing()`                                | `tax.test.ts`, `verify-tax.ts` | Done   |
| FR-7203 | AP3   | `Customer.taxExempt`, check constraint | `assertExemption()`, `setCustomerExemption()`, `taxContextFor()`                                   | `tax.test.ts`, `verify-tax.ts` | Done   |
| FR-7204 | AP4   | `Location.taxRateId`                   | `chooseTaxRate()`, `defaultTaxRateId()` in quotes, inspections, packages, sublets and the counter  | `tax.test.ts`, `verify-tax.ts` | Done   |
| FR-7205 | AP1   | `TaxEntry`, update trigger             | `recordTaxEntries()` from invoices, credit notes (`creditShares()`), counter sales, fleet invoices | `verify-tax.ts`                | Done   |
| FR-7206 | AP4   | `TaxEntry`                             | `taxReport()`, `taxReportFor()`, `/reports/tax`, `/api/reports/tax`                                | `tax.test.ts`, `verify-tax.ts` | Done   |
| FR-7207 | AP1   | —                                      | `saveTaxRateWithParts()`                                                                           | `verify-tax.ts`                | Done   |

## Later phases, newest first

This table grew by prepending, one phase at a time, and holds everything from
Phase 42 onwards. It was headed "Paper" for a while, which was true of its
first six rows and of nothing since.

| Req      | Story | Schema                                       | Implementation                                                                      | Test                                               | Status |
| -------- | ----- | -------------------------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------- | ------ |
| FR-12201 | CN1   | `Equipment`                                  | name, code, certificate, service interval; retired never deleted                    | `verify-equipment.ts`                              | Done   |
| FR-12202 | CN1   | -                                            | `stateOf()` derives; no column holds a state                                        | `equipment.test.ts`, `verify-equipment.ts`         | Done   |
| FR-12203 | CN2   | `Equipment.certificateExpiresAt`             | compared against the clock, so nobody presses anything                              | `equipment.test.ts`, `verify-equipment.ts`         | Done   |
| FR-12204 | CN1   | -                                            | a null expiry is no certificate, not a lapsed one                                   | `equipment.test.ts`                                | Done   |
| FR-12205 | CN2   | -                                            | `certificateDueSoon()`; thirty days, and the state is unchanged                     | `equipment.test.ts`, `verify-equipment.ts`         | Done   |
| FR-12206 | CN3   | `Equipment.serviceEveryMonths`               | `serviceOverdue()` warns; `blocks()` never includes it                              | `equipment.test.ts`, `verify-equipment.ts`         | Done   |
| FR-12207 | CN3   | `JobTypeEquipment`                           | as `JobTypeSkill` names what a person must be                                       | `verify-equipment.ts`                              | Done   |
| FR-12208 | CN3   | -                                            | `EQUIPMENT_UNAVAILABLE` in `checkTransition`; the message names it                  | `lifecycle.test.ts`, `verify-equipment.ts`         | Done   |
| FR-12209 | CN3   | -                                            | IN_USE is not in `BLOCKING_STATES`; the gate applies only to IN_PROGRESS            | `lifecycle.test.ts`, `verify-equipment.ts`         | Done   |
| FR-12210 | CN4   | `equipment_out_of_service_says_why`          | refused by the product and by the database                                          | `verify-equipment.ts`                              | Done   |
| FR-12211 | CN4   | `job_type_equipment_equipmentId_fkey`        | `ON DELETE RESTRICT`; retire it instead                                             | `verify-equipment.ts`                              | Done   |
| FR-12101 | CM1   | `VehicleSpecification`                       | model sheet keyed by make, model, years, engine                                     | `verify-specification.ts`                          | Done   |
| FR-12102 | CM1   | -                                            | `sheetsFor()` reads through `fitsVehicle()`, the fitment rule                       | `verify-specification.ts`                          | Done   |
| FR-12103 | CM1   | `VehicleSpecification.vehicleId`             | `resolveSpec()`: THIS_CAR outranks MODEL_SHEET                                      | `specification.test.ts`, `verify-specification.ts` | Done   |
| FR-12104 | CM2   | -                                            | an unanswered line is absent; `missingSpec()` names it                              | `specification.test.ts`, `verify-specification.ts` | Done   |
| FR-12105 | CM2   | -                                            | every `ResolvedLine` carries its source and feed name                               | `specification.test.ts`                            | Done   |
| FR-12106 | CM3   | -                                            | `disagreements()`; both values shown on the card                                    | `specification.test.ts`, `verify-specification.ts` | Done   |
| FR-12107 | CM2   | -                                            | `coerceSpec()` refuses; nought is never the fallback                                | `specification.test.ts`, `verify-specification.ts` | Done   |
| FR-12108 | CM4   | `vehicle_specifications_is_a_car_or_a_model` | refused in the database, by the constraint that names it                            | `verify-specification.ts`                          | Done   |
| FR-12109 | CM4   | `vehicle_specifications_years_run_forwards`  | a sheet that matches nothing is the worst kind of wrong                             | `verify-specification.ts`                          | Done   |
| FR-12110 | CM4   | `PartFitment`, `JobPartLine`                 | `partsThatFit()` and `whatWentIn()`; nothing parsed out of a name                   | `verify-specification.ts`                          | Done   |
| FR-12001 | CL1   | `SupplierPart`                               | one row per supplier per part; four figures, three nullable                         | `verify-sourcing.ts`                               | Done   |
| FR-12002 | CL1   | -                                            | `rankOffers()`: arrival, then price; UNKNOWN never counts as in time                | `sourcing.test.ts`, `verify-sourcing.ts`           | Done   |
| FR-12003 | CL2   | -                                            | `theChoice()` returns the cheaper offer, the saving and why                         | `sourcing.test.ts`, `verify-sourcing.ts`           | Done   |
| FR-12004 | CL2   | `SupplierPart.confirmedAt`                   | `isStale()`; saving the row is the confirmation                                     | `sourcing.test.ts`, `verify-sourcing.ts`           | Done   |
| FR-12005 | CL1   | -                                            | `promiseVersusRecord()` over Phase 52's `measureSupplier()`                         | `sourcing.test.ts`, `verify-sourcing.ts`           | Done   |
| FR-12006 | CL3   | `FitEvidence`                                | six kinds, each a record already held; `EVIDENCE_SENTENCE` has no number            | `substitution.test.ts`, `verify-sourcing.ts`       | Done   |
| FR-12007 | CL3   | `FitEvidence`                                | `QUALIFYING`: a confirmed swap or a shared supplier number, and nothing else        | `substitution.test.ts`, `verify-sourcing.ts`       | Done   |
| FR-12011 | CL3   | -                                            | `rankSubstitutes()` drops an unqualified candidate rather than ranking it           | `substitution.test.ts`, `verify-sourcing.ts`       | Done   |
| FR-12012 | CL3   | `JobPartLine.substitutedForProductId`        | read back as `SUBSTITUTED_BEFORE`, the strongest kind                               | `verify-sourcing.ts`                               | Done   |
| FR-12008 | CL3   | -                                            | `confirmSubstitution()` recomputes from `whatElseWouldDo()`                         | `verify-sourcing.ts`                               | Done   |
| FR-12009 | CL4   | `job_part_lines_substitution_is_confirmed`   | all three columns or none, refused in the database                                  | `verify-sourcing.ts`                               | Done   |
| FR-12010 | CL4   | `JobPartLine.substitutedForProductId`        | the job line and the substitution card both say what it replaced                    | `verify-sourcing.ts`                               | Done   |
| FR-11901 | CK1   | `Job.comebackOfJobId`                        | `caseFileFor()` in `web/lib/casefile.ts`; `<JobCaseFile>`                           | `verify-comeback.ts`                               | Done   |
| FR-11902 | CK1   | -                                            | every line read off the original job; the file stores nothing                       | `verify-comeback.ts`                               | Done   |
| FR-11903 | CK2   | `Job.comebackCause`                          | `recordCause()`; seven values in `ComebackCause`                                    | `comeback.test.ts`, `verify-comeback.ts`           | Done   |
| FR-11904 | CK2   | `jobs_comeback_cause_needs_a_comeback`       | refused by `recordCause()` and by the check constraint                              | `verify-comeback.ts`                               | Done   |
| FR-11905 | CK2   | -                                            | `isOurs()`; the business report counts ours apart                                   | `comeback.test.ts`, `verify-comeback.ts`           | Done   |
| FR-11906 | CK2   | -                                            | `comebacksByCause()` reports `unclassified` beside the tally                        | `verify-comeback.ts`                               | Done   |
| FR-11907 | CK3   | -                                            | `patternsIn()` counts distinct vehicles, not visits                                 | `comeback.test.ts`, `verify-comeback.ts`           | Done   |
| FR-11801 | CJ1   | `QualityCheck`                               | `recordQualityCheck()`, the first thing ever to write one                           | `verify-signoff.ts`                                | Done   |
| FR-11802 | CJ1   | `QualityCheckItem`                           | the workshop's own sheet, seeded from `DEFAULT_QUALITY_SHEET`                       | `verify-signoff.ts`                                | Done   |
| FR-11803 | CJ2   | `QualityCheckAnswer`                         | `quality_check_answers_is_one_or_the_other` in the database                         | `verify-signoff.ts`                                | Done   |
| FR-11804 | CJ2   | -                                            | `outcomeOf()` in `core/job/quality.ts`; the caller never states it                  | `quality.test.ts`, `verify-signoff.ts`             | Done   |
| FR-11805 | CJ2   | -                                            | `gapsIn()` reports unanswered and refused separately                                | `quality.test.ts`, `verify-signoff.ts`             | Done   |
| FR-11806 | CJ3   | `JobStatus`                                  | `afterCheck()`: pass completes, fail returns to IN_PROGRESS                         | `quality.test.ts`, `verify-signoff.ts`             | Done   |
| FR-11807 | CJ2   | `quality_check_answers_itemId_fkey`          | `ON DELETE RESTRICT`; a line is retired, never deleted                              | `verify-signoff.ts`                                | Done   |
| FR-11701 | CI1   | -                                            | `standingOfJob()` in `core/job/standing.ts`; `/now`                                 | `standing.test.ts`, `verify-standing.ts`           | Done   |
| FR-11702 | CI3   | -                                            | `whereJobsStand()` reads the records; nothing is written                            | `verify-standing.ts`                               | Done   |
| FR-11703 | CI2   | `Estimate.sentAt`                            | the AWAITING_APPROVAL branch checks `sentAt` before blaming anybody                 | `standing.test.ts`, `verify-standing.ts`           | Done   |
| FR-11704 | CI1   | -                                            | `jobsWorstFirst()`: late, then ours, then longest                                   | `standing.test.ts`                                 | Done   |
| FR-11705 | CI3   | -                                            | the band and the board render one derivation                                        | `verify-standing.ts`                               | Done   |
| FR-11601 | CH1   | -                                            | the qualifier in `core/i18n/index.ts`; `plainKey()`                                 | `qualifier.test.ts`, `verify-dictionary.ts`        | Done   |
| FR-11602 | CH1   | -                                            | qualified key, then bare key, then English                                          | `qualifier.test.ts`                                | Done   |
| FR-11603 | CH2   | -                                            | `kindOf()` sorts the remainder from the answers themselves                          | `verify-dictionary.ts`                             | Done   |
| FR-11501 | CG1   | `SymptomCode`, `CauseCode`                   | a workshop's own catalogue, retired rather than deleted                             | `verify-knowledge.ts`                              | Done   |
| FR-11502 | CG1   | `DiagnosisCause`                             | `openDiagnosis()` lists every cause, in catalogue order                             | `verify-knowledge.ts`                              | Done   |
| FR-11503 | CG3   | `DiagnosisCause.outcome`                     | `recordVerdict()`; the database refuses a verdict with no time                      | `verify-knowledge.ts`                              | Done   |
| FR-11504 | CG3   | `JobDiagnosis.settledAt`                     | `isSettled()` in `core/diagnosis/knowledge.ts`                                      | `knowledge.test.ts`, `verify-knowledge.ts`         | Done   |
| FR-11505 | CG2   | -                                            | `ENOUGH_TO_SHOW` and `rankCauses()`                                                 | `knowledge.test.ts`, `verify-knowledge.ts`         | Done   |
| FR-11506 | CG2   | -                                            | `causeSentence()` states both counts                                                | `knowledge.test.ts`                                | Done   |
| FR-11507 | CG2   | -                                            | `evidenceFor(..., { exceptJobId })`                                                 | `verify-knowledge.ts`                              | Done   |
| FR-11508 | CG1   | `JobDiagnosis.orgId`                         | every query is org-scoped; the tenant registry classifies all four models           | `verify-knowledge.ts`, `verify-scoping.ts`         | Done   |
| FR-11401 | CF1   | -                                            | `navigationFor()` in `apps/web/src/lib/navigation.ts`, one list per role            | `verify-navigation.ts`                             | Done   |
| FR-11402 | CF2   | -                                            | the owner's sections, plus `REACHED_ANOTHER_WAY` with the way in                    | `verify-navigation.ts`                             | Done   |
| FR-11403 | CF2   | -                                            | `can(role, permission)` over every entry of every role                              | `verify-navigation.ts`                             | Done   |
| FR-11404 | CF3   | -                                            | `hasTranslation()` over all 60 words of it                                          | `verify-navigation.ts`                             | Done   |
| FR-11301 | CE1   | `SupplierReturnLine.orderLine`               | `creditDue()` in `core/inventory/returns.ts`, proposed on the returns screen        | `returns.test.ts`, `verify-returns.ts`             | Done   |
| FR-11302 | CE2   | `SupplierReturnLine.unitCost`                | a core is credited at its charge, which the shelf never held                        | `returns.test.ts`                                  | Done   |
| FR-11303 | CE1   | `SupplierReturn.heldCost`                    | still shown beside the return, still what comes off the books                       | `verify-returns.ts`                                | Done   |
| FR-11201 | CD1   | `SupplierReturn`, `SupplierBill`             | `creditReturn()` applies what is owed and holds the rest                            | `verify-returns.ts`                                | Done   |
| FR-11202 | CD2   | -                                            | the assertion is the rule, taken from the bill's own total                          | `verify-returns.ts`                                | Done   |
| FR-11101 | CC2   | -                                            | four probes fail and name the remedy; the guard reads every probe CI runs           | `verify-throughout.ts`                             | Done   |
| FR-11102 | CC1   | `auditBooks()`                               | `verify-books.ts` builds the demonstration, audits it, removes it                   | `verify-books.ts`                                  | Done   |
| FR-11001 | CB1   | `PaymentAttempt`, `Payment`                  | the signed webhook path, with `PAYMENT_WEBHOOK_SECRET` set in the workflow          | `verify-payments.ts`, `verify-billing.ts`          | Done   |
| FR-11002 | CB2   | -                                            | both probes fail and name the remedy instead of skipping                            | `verify-payments.ts`, `verify-billing.ts`          | Done   |
| FR-10901 | CA1   | -                                            | the button base wraps instead of `whitespace-nowrap`                                | `verify-screens.ts`                                | Done   |
| FR-10902 | CA1   | -                                            | every route at 320px, measured in CI                                                | `verify-screens.ts`                                | Done   |
| FR-10801 | BZ1   | -                                            | one install step before the first check that launches a browser                     | `verify-throughout.ts`                             | Done   |
| FR-10802 | BZ1   | -                                            | read from each check's `from 'playwright'` import line                              | `verify-throughout.ts`                             | Done   |
| FR-10701 | BY1   | -                                            | the gates in `p/[token]`, `handover/[token]`, `r/[token]`, and two portal routes    | `smoke.ts`, `verify-status.ts`                     | Done   |
| FR-10702 | BY1   | -                                            | `portal/loading.tsx` became nine per-route boundaries and a route group             | `verify-status.ts`                                 | Done   |
| FR-10703 | BY2   | -                                            | ADR-0015 names the shelters; the check reads the list out of it                     | `verify-status.ts`                                 | Done   |
| FR-10704 | BY3   | `TRIAL_DAYS`                                 | the front door renders `Start a {days}-day trial` from the constant                 | `smoke.ts`                                         | Done   |
| FR-10601 | BX1   | `VehicleEvent.recordedByOrgId`               | the append-only trigger lists every hashed column                                   | `verify-survival.ts`, `verify-integrity.ts`        | Done   |
| FR-10602 | BX1   | `vehicle_events_recordedByOrgId_fkey`        | `ON DELETE RESTRICT`; a workshop with entries is retired, not deleted               | `verify-survival.ts`, `verify-region.ts`           | Done   |
| FR-10603 | BX2   | `Organization.isDemonstration`               | `removeDemonstration()` takes the cars first, and retires if one was real           | `verify-survival.ts`, `verify-first-day.ts`        | Done   |
| FR-10604 | BX3   | -                                            | `verify-integrity.ts` names an entry that was recorded by a workshop and is not now | `verify-integrity.ts`                              | Done   |
| FR-10501 | BW1   | —                                            | the precondition checks in `verify-inventory.ts` and `verify-integrity.ts`          | `run-checks.ts`                                    | Done   |
| FR-10502 | BW1   | —                                            | `verify-money.ts` counts its own messages and reads its own posting, by id          | `run-checks.ts`                                    | Done   |
| FR-10503 | BW2   | —                                            | `npm run checks`                                                                    | `run-checks.ts`                                    | Done   |
| FR-10504 | BW2   | —                                            | the order is parsed out of `.github/workflows/ci.yml`                               | `run-checks.ts`                                    | Done   |
| FR-10401 | BV1   | `FleetNumber`                                | `setFleetNumber()`, on the fleet page                                               | `verify-fleet-numbers.ts`                          | Done   |
| FR-10402 | BV1   | `fleet_numbers_lookup_idx`                   | the fleet-number query in `searchEverything()`, matched whole                       | `verify-fleet-numbers.ts`                          | Done   |
| FR-10403 | BV2   | `fleet_numbers_one_per_number`               | a unique index over the trimmed, upper-cased number                                 | `verify-fleet-numbers.ts`                          | Done   |
| FR-10404 | BV2   | —                                            | the number is keyed by organisation and customer, never by vehicle alone            | `verify-fleet-numbers.ts`                          | Done   |
| FR-10301 | BU1   | —                                            | seven ambiguous English words mended at the call site                               | `verify-dictionary.ts`                             | Done   |
| FR-10302 | BU2   | —                                            | `verify-dictionary.ts`, over the area files rather than the merged map              | `verify-dictionary.ts`                             | Done   |
| FR-10303 | BU1   | —                                            | Remaining, How paid, Joined, Valid until: the English carries the meaning           | `verify-dictionary.ts`                             | Done   |
| FR-10201 | BT3   | `CourtesyVehicle`                            | `addToFleet()`, `retireFromFleet()`, and the page in settings                       | `verify-courtesy.ts`                               | Done   |
| FR-10202 | BT1   | `CourtesyLoan`                               | `lend()`, and the card on the job                                                   | `verify-courtesy.ts`                               | Done   |
| FR-10203 | BT1   | `courtesy_loans_no_overlap`                  | an exclusion constraint over the vehicle and the period                             | `verify-courtesy.ts`                               | Done   |
| FR-10204 | BT1   | —                                            | `freeBetween()`, over `overlaps()` from the capacity module                         | `courtesy.test.ts`, `verify-courtesy.ts`           | Done   |
| FR-10205 | BT2   | `VehicleDocument.expiresAt`                  | `lapsesDuring()`, over the MOT and insurance already on file                        | `courtesy.test.ts`, `verify-courtesy.ts`           | Done   |
| FR-10206 | BT3   | `CourtesyLoan.returnedAt`                    | `takeBack()`, with who and the odometer                                             | `verify-courtesy.ts`                               | Done   |
| FR-10207 | BT3   | —                                            | `describeLoan()`: "4 days overdue", in words rather than a colour                   | `courtesy.test.ts`, `verify-courtesy.ts`           | Done   |
| FR-10101 | BS1   | `JobFollowUp`                                | `setFollowUp()`; the note, the date and who it is for                               | `verify-followups.ts`                              | Done   |
| FR-10102 | BS2   | —                                            | `standingOf()` and `describeFollowUp()`: late says how late                         | `followups.test.ts`, `verify-followups.ts`         | Done   |
| FR-10103 | BS2   | —                                            | the dashboard card and tile, and the shop floor's own list                          | `verify-followups.ts`                              | Done   |
| FR-10104 | BS1   | `JobFollowUp.completedByUserId`              | `completeFollowUp()`, and the constraint that done is whole                         | `verify-followups.ts`                              | Done   |
| FR-10105 | BS3   | —                                            | `notifyOne()` in `lib/search.ts`, to the person it was given to                     | `verify-followups.ts`                              | Done   |
| FR-10001 | BR1   | —                                            | the tsconfig coverage check in `verify-throughout.ts`                               | `verify-throughout.ts`                             | Done   |
| FR-10002 | BR1   | —                                            | `typecheck:scripts` and `typecheck:prisma`, both in CI                              | `verify-throughout.ts`                             | Done   |
| FR-10003 | BR2   | —                                            | `ALL_TIME` in `lib/accounting.ts`, and the required range on `postedLines()`        | `verify-throughout.ts`                             | Done   |
| FR-9901  | BQ1   | every model in `schema.prisma`               | `tenant-models.ts`, generated by `generate-tenant-models.ts`                        | `verify-scoping.ts`                                | Done   |
| FR-9902  | BQ1   | —                                            | `TENANT_SCOPED_MODELS`, `GLOBAL_MODELS` with reasons, `CHILD_OF`                    | `verify-scoping.ts`                                | Done   |
| FR-9903  | BQ2   | —                                            | `generate-tenant-models.ts --check`, in CI                                          | `verify-scoping.ts`                                | Done   |
| FR-9904  | BQ2   | —                                            | the child-read scan in `verify-scoping.ts`                                          | `verify-scoping.ts`                                | Done   |
| FR-9905  | BQ1   | —                                            | a row written as one workshop and asked for as another, through `forOrg`            | `verify-scoping.ts`                                | Done   |
| FR-9801  | BP1   | `Session.orgId`                              | `orgOnSignIn()`, and the chooser at `/choose`                                       | `belonging.test.ts`, `verify-belonging.ts`         | Done   |
| FR-9802  | BP1   | `Session.orgId`                              | `currentUser()` reads the session row; nothing reads the request                    | `verify-belonging.ts`                              | Done   |
| FR-9803  | BP2   | `Membership.isActive`                        | `enterWorkshop()`, and `NOT_YOURS` — one sentence for every reason                  | `belonging.test.ts`, `verify-belonging.ts`         | Done   |
| FR-9804  | BP1   | `Membership.role`                            | `actingAs()`; the role comes from the membership being acted under                  | `belonging.test.ts`, `verify-belonging.ts`         | Done   |
| FR-9805  | BP3   | `Session.orgId`                              | `deactivateMember()` scopes the revocation to its own organisation                  | `belonging.test.ts`, `verify-belonging.ts`         | Done   |
| FR-9806  | BP3   | `Membership.isActive`                        | `actingAs()` over active memberships only, read on every request                    | `verify-belonging.ts`                              | Done   |
| FR-9807  | BP2   | `AuditLog` action `session.entered`          | the audit call in `enterWorkshop()`                                                 | `verify-belonging.ts`                              | Done   |
| FR-9808  | BP1   | `Session`                                    | the organisation is on the session row, not on the user                             | `verify-belonging.ts`                              | Done   |
| FR-9809  | BP4   | `User.passwordHash`                          | the password check in `acceptInvitation()`                                          | `verify-belonging.ts`                              | Done   |
| FR-9701  | BO1   | `ERASURE` in `core/privacy/erasure.ts`       | 14 holdings, each with its treatment and why                                        | `erasure.test.ts`, `verify-erasure.ts`             | Done   |
| FR-9702  | BO1   | —                                            | `exportCustomer()`, including the holdings that are empty                           | `verify-erasure.ts`                                | Done   |
| FR-9703  | BO2   | —                                            | `eraseCustomer()`; `stillMentions()` searches every text column of every table      | `verify-erasure.ts`                                | Done   |
| FR-9704  | BO3   | —                                            | the books totalled by `auditBooks()` before and after, and compared                 | `verify-erasure.ts`                                | Done   |
| FR-9705  | BO3   | `VehicleEvent` payloads carry no name        | `ownershipTransferEvent()` takes a keeper number rather than two names              | `events.test.ts`, `verify-erasure.ts`              | Done   |
| FR-9706  | BO3   | `carnet_audit_logs_immutable()`              | the redaction clause, and `redactAudit()` that uses it                              | `verify-integrity.ts`, `verify-erasure.ts`         | Done   |
| FR-9707  | BO2   | `AuditLog` action `customer.erased`          | the reason field on the page, and the refusal of a second erasure                   | `verify-erasure.ts`                                | Done   |
| FR-9601  | BN1   | —                                            | the requirement list read off the document and compared with the rows               | `verify-traceability.ts`                           | Done   |
| FR-9602  | BN1   | —                                            | the test and function checks in `verify-traceability.ts`                            | `verify-traceability.ts`                           | Done   |
| FR-9603  | BN2   | —                                            | the Missing rows, and the check that none of them claims a test                     | `verify-traceability.ts`                           | Done   |
| FR-9604  | BN2   | —                                            | the kinds: Missing, Partial, Deferred, Superseded, Planned                          | `verify-traceability.ts`                           | Done   |
| FR-9605  | BN3   | —                                            | the summary recounted from the table, and compared with it                          | `verify-traceability.ts`                           | Done   |
| FR-9501  | BM1   | -                                            | `verify-paint.ts`: PerformanceObserver in the page, CDP throttling                  | `paint.test.ts`, `verify-paint.ts`                 | Done   |
| FR-9502  | BM1   | -                                            | `FOUR_G` in core, named and asserted                                                | `paint.test.ts`                                    | Done   |
| FR-9503  | BM1   | -                                            | `middle()`, and `RUNS = 3`                                                          | `paint.test.ts`                                    | Done   |
| FR-9504  | BM3   | -                                            | the `BROKEN` markers and the status check in `once()`                               | `verify-paint.ts`                                  | Done   |
| FR-9505  | BM2   | -                                            | `measuredAShift()`, a deliberate shift on a real page                               | `verify-paint.ts`                                  | Done   |
| FR-9506  | BM3   | -                                            | the check that every screen reported a paint                                        | `verify-paint.ts`                                  | Done   |
| FR-9401  | BL1   | -                                            | `mintTrace()`, and the proxy setting it on every request                            | `verify-trace.ts`                                  | Done   |
| FR-9402  | BL1   | `traceId` on four tables                     | `traceId()` at thirty-one write sites; `audit()` from the header                    | `verify-trace.ts`                                  | Done   |
| FR-9403  | BL2   | `outbox_events.traceId`                      | `withTrace()` around each handler; `currentTrace()` in the jobs package             | `verify-trace.ts`                                  | Done   |
| FR-9404  | BL3   | the nullable column                          | nothing writes a trace outside a request; the schema says why                       | `verify-trace.ts`                                  | Done   |
| FR-9405  | BL1   | the partial indexes on `traceId`             | `follow()`, and the search box on `/admin/health`                                   | `verify-trace.ts`, `verify-health.ts`              | Done   |
| FR-9406  | BL4   | -                                            | `looksLikeTrace()`, applied to the offered header in the proxy                      | `verify-trace.ts`                                  | Done   |
| FR-9407  | BL4   | -                                            | the source scan in `verify-trace.ts`                                                | `verify-trace.ts`                                  | Done   |
| FR-9301  | BK1   | -                                            | `SETTINGS` in core: `felt` and `set` on each of thirty-three                        | `settings.test.ts`, `verify-launch.ts`             | Done   |
| FR-9302  | BK2   | -                                            | `declared()`: the zod schema and every `process.env` read in the source             | `verify-launch.ts`                                 | Done   |
| FR-9303  | BK1   | -                                            | `pretendingIfEqual`, and the `pretending` verdict                                   | `settings.test.ts`, `verify-launch.ts`             | Done   |
| FR-9304  | BK1   | -                                            | `SEVERITY`, with `silent` before `stops`; the sort in `handover()`                  | `settings.test.ts`, `verify-launch.ts`             | Done   |
| FR-9305  | BK3   | -                                            | `npm run launch:handover`                                                           | `verify-launch.ts`                                 | Done   |
| FR-9306  | BK3   | -                                            | the report prints names and verdicts, never values                                  | `verify-launch.ts`                                 | Done   |
| FR-9201  | BJ1   | `operator_alerts`                            | `sweepAlerts()`, called from the hourly cron                                        | `verify-alerts.ts`                                 | Done   |
| FR-9202  | BJ2   | -                                            | `RUNBOOK`, `alertBody()`                                                            | `alerts.test.ts`, `verify-alerts.ts`               | Done   |
| FR-9203  | BJ2   | -                                            | `decideAlerts()`'s `unexplained`; `withoutAnAction()`                               | `alerts.test.ts`, `verify-alerts.ts`               | Done   |
| FR-9204  | BJ3   | `operator_alerts.sentAt`                     | `QUIET_FOR_MS`, and the `worse` and `cleared` branches of `decideAlerts()`          | `alerts.test.ts`, `verify-alerts.ts`               | Done   |
| FR-9205  | BJ1   | `operator_alerts.sentAt`                     | `wentOut` in `sweepAlerts()`, written only for a message that left                  | `verify-alerts.ts`                                 | Done   |
| FR-9206  | BJ4   | -                                            | the runbook lines in the health dictionary                                          | `verify-alerts.ts`                                 | Done   |
| FR-9207  | BJ2   | `operator_alerts`                            | the "What is wrong" card on `/admin/health`                                         | `verify-health.ts`, `verify-screens.ts`            | Done   |
| FR-9101  | BI1   | -                                            | `REGISTER` in `verify-quality.ts`, checked against the requirements document        | `verify-quality.ts`                                | Done   |
| FR-9102  | BI1   | -                                            | the exists check and the workflow check in `verify-quality.ts`                      | `verify-quality.ts`                                | Done   |
| FR-9103  | BI2   | -                                            | `redaction` in `packages/jobs/src/log.ts`                                           | `log.test.ts`, `verify-quality.ts`                 | Done   |
| FR-9104  | BI3   | -                                            | `verify-engines.ts`: sixty screens in Chromium, WebKit and Firefox                  | `verify-engines.ts`                                | Done   |
| FR-9105  | BI3   | -                                            | the `styled` check, before anything is measured                                     | `verify-engines.ts`                                | Done   |
| FR-9001  | BH1   | -                                            | `theChecksRun()` in `verify-throughout.ts`; the twenty-six now in the workflow      | `verify-throughout.ts`                             | Done   |
| FR-9002  | BH1   | -                                            | the gate table in `verify-throughout.ts`; i18n-scan added to the workflow           | `verify-throughout.ts`                             | Done   |
| FR-9003  | BH2   | -                                            | `lib/routes.ts`, `everyRoute()`, the `PLAN` in `verify-screens.ts`                  | `verify-screens.ts`, `verify-throughout.ts`        | Done   |
| FR-9004  | BH2   | -                                            | `Plan.unmeasured`, and the stale-reason check                                       | `verify-screens.ts`, `verify-throughout.ts`        | Done   |
| FR-9005  | BH2   | -                                            | the `BROKEN` markers in `verify-screens.ts` and `verify-performance.ts`             | `verify-screens.ts`                                | Done   |
| FR-9006  | BH3   | -                                            | `listsHaveBounds()`; a `bounded:` line on every list that needs one                 | `verify-throughout.ts`                             | Done   |
| FR-9007  | BH3   | -                                            | `postedTotals()`, `balanceOf()`, `receivableBridge()`, `unreadCount()`              | `verify-books.ts`, `verify-performance.ts`         | Done   |
| FR-9008  | BH4   | -                                            | seven `loading.tsx` boundaries, each drawing `LoadingCar`                           | `verify-throughout.ts`                             | Done   |
| FR-9009  | BH5   | `referrals_one_unused_per_customer`          | the partial unique index; `referralFor()` unchanged                                 | `verify-referrals.ts`                              | Done   |
| FR-8901  | BG1   | `audit_logs`                                 | `uptakeFor()`, `CAPABILITIES`, `/reports/uptake`                                    | `uptake.test.ts`, `verify-pilot.ts`                | Done   |
| FR-8902  | BG1   | `audit_logs.action`, `actorUserId`           | the `groupBy` in `uptakeFor()`; nothing new instrumented                            | `verify-pilot.ts`                                  | Done   |
| FR-8903  | BG1   | -                                            | `Capability.name`, `.area` and `.expected`; the pilot dictionary                    | `verify-pilot.ts`, `verify-languages.ts`           | Done   |
| FR-8904  | BG2   | -                                            | `uptakeVerdictOf()`, `BARELY`, `worthAsking()`                                      | `uptake.test.ts`, `verify-pilot.ts`                | Done   |
| FR-8905  | BG4   | `audit_logs`                                 | `unmapped()`, which fails the check rather than counting towards nothing            | `verify-pilot.ts`                                  | Done   |
| FR-8906  | BG3   | -                                            | the caveat on `/reports/uptake`; no read is audited anywhere                        | `verify-pilot.ts`                                  | Done   |
| FR-8907  | BG4   | -                                            | `canReport()`, the four named sources in `verify-pilot.ts`                          | `uptake.test.ts`, `verify-pilot.ts`                | Done   |
| FR-8801  | BF1   | -                                            | `AWKWARD` in core, thirteen cases with a decision and a reason                      | `cases.test.ts`, `verify-awkward.ts`               | Done   |
| FR-8802  | BF2   | `deposits`                                   | `assertPaymentRecordable()`, and `payAndHold` on the invoice page                   | `verify-awkward.ts`                                | Done   |
| FR-8803  | BF1   | `stock_reservations.releasedAt`              | `releaseForJobLine()` called from `moveJob()` on cancel                             | `verify-awkward.ts`                                | Done   |
| FR-8804  | BF1   | `jobs.comebackOfJobId`                       | `TERMINAL_STATUSES`, `allowedTransitions()`                                         | `lifecycle.test.ts`, `verify-awkward.ts`           | Done   |
| FR-8805  | BF1   | `vehicles.vin` unique                        | `vinLooksReal()`, the unique index                                                  | `cases.test.ts`, `verify-awkward.ts`               | Done   |
| FR-8806  | BF1   | `stock_levels.onHand`                        | `adjustStock()`, `recordStocktake()`                                                | `verify-awkward.ts`                                | Done   |
| FR-8807  | BF3   | `job_part_lines.unitPrice`                   | the price held on the line rather than read from the product                        | `verify-awkward.ts`                                | Done   |
| FR-8808  | BF3   | `fiscal_periods.isClosed`                    | the closed-period guard in `postEntry()`                                            | `verify-awkward.ts`, `verify-books.ts`             | Done   |
| FR-8809  | BF3   | `vehicle_ownerships`                         | `transferOwnership()`, which refuses without `force` and keeps the job              | `verify-awkward.ts`, `verify-ownership.ts`         | Done   |
| FR-8701  | BE1   | -                                            | `workshopClock()`, `/reports/clock`                                                 | `verify-clock.ts`                                  | Done   |
| FR-8702  | BE1   | the timestamps already on each model         | `STRETCHES`, each naming its two columns                                            | `verify-clock.ts`                                  | Done   |
| FR-8703  | BE1   | -                                            | `medianSeconds()`, `slowestTenth()`                                                 | `stretches.test.ts`                                | Done   |
| FR-8704  | BE2   | -                                            | `coverage()`, `ENOUGH`, `verdictOf()`                                               | `stretches.test.ts`, `verify-clock.ts`             | Done   |
| FR-8705  | BE2   | -                                            | the null check in `gap()`                                                           | `verify-clock.ts`                                  | Done   |
| FR-8706  | BE2   | -                                            | `Stretch.because`, shown on the page                                                | `verify-clock.ts`                                  | Done   |
| FR-8707  | BE3   | `docs/05-project/clock-baseline.json`        | `record()`, `changed()`, `--record` and `--against`                                 | `stretches.test.ts`, `verify-clock.ts`             | Done   |
| FR-8601  | BD1   | -                                            | `agedReceivables()`, `retention()` in both modules, bounded lists                   | `verify-performance.ts`                            | Done   |
| FR-8602  | BD1   | -                                            | the aggregates in `accounting.ts`, `owner.ts`, `reports.ts`, `automation.ts`        | `verify-performance.ts`                            | Done   |
| FR-8603  | BD2   | -                                            | `sweepConversations()` hourly; the job page no longer files                         | `verify-performance.ts`, `verify-triggers.ts`      | Done   |
| FR-8604  | BD1   | `vehicle_access_grants`                      | the grant written by `createJob()`; `20260917200000_a_job_grants_access`            | `verify-performance.ts`, `verify-tenancy.ts`       | Done   |
| FR-8605  | BD3   | -                                            | the budget table in `verify-performance.ts`; `p95Of()`, `overBudget()`              | `budget.test.ts`, `verify-performance.ts`          | Done   |
| FR-8606  | BD3   | -                                            | the production-build note and the `BROKEN` guard                                    | `verify-performance.ts`                            | Done   |
| FR-8607  | BD3   | -                                            | `nearTheLine()`                                                                     | `budget.test.ts`, `verify-performance.ts`          | Done   |
| FR-8501  | BC2   | -                                            | `systemHealth()`, `/admin/health`                                                   | `verify-health.ts`                                 | Done   |
| FR-8502  | BC2   | -                                            | `Standing`, including `unknown`; `fromCount()`, `fromAge()`                         | `health.test.ts`, `verify-health.ts`               | Done   |
| FR-8503  | BC2   | -                                            | `worstStanding()`, `needsAttention()`, `worstSignalsFirst()`                        | `health.test.ts`, `verify-health.ts`               | Done   |
| FR-8504  | BC1   | `message_logs`, `delivery_events`            | `whyMessage()`, `traceMessagesTo()`, the search on `/admin/health`                  | `health.test.ts`, `verify-health.ts`               | Done   |
| FR-8505  | BC1   | `suppressed_addresses`                       | the order inside `whyMessage()`: consent, then suppression, then status             | `health.test.ts`, `verify-health.ts`               | Done   |
| FR-8506  | BC3   | -                                            | `isOperator()`, `notFound()` on the page                                            | `verify-health.ts`                                 | Done   |
| FR-8507  | BC1   | `message_logs.availableAt`                   | the two queued branches of `whyMessage()`                                           | `health.test.ts`, `verify-health.ts`               | Done   |
| FR-8401  | BB1   | -                                            | `verify-recovery.ts`, dump and restore into a fresh database                        | `verify-recovery.ts`, `verify-backup.ts`           | Done   |
| FR-8402  | BB1   | -                                            | `workLost()`, `timeTaken()`, `missedTargets()` against NFR-303 and NFR-304          | `restored.test.ts`, `verify-recovery.ts`           | Done   |
| FR-8403  | BB1   | `_prisma_migrations`, the triggers           | `prisma migrate status` on the copy; `verifyChain()`; `auditBooks(org, copy)`       | `verify-recovery.ts`                               | Done   |
| FR-8404  | BB2   | the five columns holding a file key          | `referencedFiles()`, and the file taken away on purpose                             | `verify-recovery.ts`                               | Done   |
| FR-8405  | BB2   | -                                            | `orphanedFiles()`, `forgetOrphans()`, `npm run storage:orphans`                     | `verify-recovery.ts`                               | Done   |
| FR-8406  | BB3   | `outbox_events`, `message_logs`              | the queue counts held against the original                                          | `verify-recovery.ts`                               | Done   |
| FR-8407  | BB3   | -                                            | the closing note on write-ahead archiving                                           | `verify-recovery.ts`                               | Done   |
| FR-8301  | BA1   | -                                            | the route table in `verify-tenancy.ts`, read off the filesystem                     | `verify-tenancy.ts`                                | Done   |
| FR-8302  | BA1   | every `where` carrying `orgId`               | `requireSession()`, the org-scoped lookup on each page                              | `verify-tenancy.ts`, `verify-authz.ts`             | Done   |
| FR-8303  | BA2   | `VehicleOwnership`, `PassportShare`          | the portal's own-vehicle lookup                                                     | `verify-tenancy.ts`                                | Done   |
| FR-8304  | BA1   | `products.orgId`, `warehouses.orgId`         | `lockLevel()`, which every stock movement goes through                              | `verify-tenancy.ts`                                | Done   |
| FR-8305  | BA1   | -                                            | `/api/exports/[dataset]`, `/api/reports/[report]`                                   | `verify-tenancy.ts`                                | Done   |
| FR-8306  | BA3   | `password_reset_tokens.tokenHash`            | `redeemReset()` on submit rather than on load; the identical page                   | `verify-tenancy.ts`                                | Done   |
| FR-8307  | BA2   | `passport_shares`                            | `/p/[token]`, which carries the car and not the keeper                              | `verify-tenancy.ts`                                | Done   |
| FR-8308  | BA1   | -                                            | the control at the top of the probe                                                 | `verify-tenancy.ts`                                | Done   |
| FR-8201  | AZ1   | -                                            | `auditBooks()`, `/books`                                                            | `books.test.ts`, `verify-books.ts`                 | Done   |
| FR-8202  | AZ1   | `journal_lines`                              | `entryBalances()`, checked one entry at a time                                      | `books.test.ts`, `verify-books.ts`                 | Done   |
| FR-8203  | AZ1   | `invoice_lines`, `payments`, `refunds`       | `invoiceAddsUp()`, `amountPaidAgrees()`, `owedAgrees()`                             | `books.test.ts`, `verify-books.ts`                 | Done   |
| FR-8204  | AZ3   | `stock_movements.balanceAfter`               | `stockAddsUp()`, and `adjustStock()` as the only way stock moves                    | `books.test.ts`, `verify-books.ts`                 | Done   |
| FR-8205  | AZ1   | `accounts` 1100, 2200, 2300                  | `receivableBridge()`, `liabilityAgrees()`, `cardBalanceAgrees()`                    | `books.test.ts`, `verify-books.ts`                 | Done   |
| FR-8206  | AZ2   | `fiscal_periods.closedAt`                    | `closedPeriodUntouched()`, read from the rows rather than from the guard            | `books.test.ts`, `verify-books.ts`                 | Done   |
| FR-8207  | AZ1   | -                                            | `mustAgree()`, which offers no tolerance                                            | `books.test.ts`                                    | Done   |
| FR-8208  | AZ1   | -                                            | `/books`, `worstFirst()`, `unaccountedFor()`, the books dictionary                  | `verify-books.ts`, `i18n-scan.ts`                  | Done   |
| FR-8101  | AY2   | `vehicle_events.supersedesId`                | `correctEvent()`, the form on the vehicle page                                      | `verify-wiring.ts`                                 | Done   |
| FR-8102  | -     | `estimate_shares.revokedAt`                  | `revokeEstimateShare()`, the card on the job page                                   | `verify-controls.ts`                               | Done   |
| FR-8103  | AY1   | `deposits`, `credit_notes`                   | `moneyHeldFor()`, `invoicesFor()`, the portal's invoices page                       | `verify-wiring.ts`                                 | Done   |
| FR-8104  | AY2   | `carnet_vehicle_events_append_only`          | the trigger's single permitted mutation, checked by `verifyChain()`                 | `verify-wiring.ts`, `verify-integrity.ts`          | Done   |
| FR-8001  | AX3   | `Job.customerOrderNumber`                    | `setOrderNumber()`, the field on the job page                                       | `verify-wiring.ts`                                 | Done   |
| FR-8002  | AX1   | `message_logs`                               | `notifyCustomer()`, called from `moveJob()`                                         | `verify-triggers.ts`                               | Done   |
| FR-8003  | AX1   | `message_logs`                               | the message queued inside `requestBooking()`'s transaction                          | `verify-messaging.ts`                              | Done   |
| FR-8004  | AX2   | `automation_rules`                           | `lib/triggers.ts`, called from moveJob, issueInvoice, bookings, portal              | `verify-triggers.ts`                               | Done   |
| FR-8005  | AX2   | -                                            | `lib/sweeps.ts`, run by the hourly cron job                                         | `verify-triggers.ts`                               | Done   |
| FR-8006  | AX2   | `automation_actions`                         | `createTask()`, `addTag()`, the explicit failure for anything else                  | `verify-triggers.ts`                               | Done   |
| FR-8007  | AX4   | -                                            | `/signup/customer?next=`, the handover's link                                       | `verify-controls.ts`                               | Done   |
| FR-8008  | AX4   | -                                            | `countTill()` through `closeTill()`, and the markers each page now renders          | `verify-counter.ts`                                | Done   |
| FR-7901  | AW1   | —                                            | `updateCustomer()`, `CustomerFields`, `/customers/[id]/edit`                        | `verify-wiring.ts`                                 | Done   |
| FR-7902  | AW1   | `consent_changes`                            | `showConsent={false}`, the comment in `updateCustomer()`                            | `verify-wiring.ts`                                 | Done   |
| FR-7903  | AW2   | `SequenceKind.TRANSFER`                      | `createTransfer()`, the suggestion form on `/transfers`                             | `verify-wiring.ts`                                 | Done   |
| FR-7904  | AW2   | `stock_transfer_lines.received`              | `receiveTransfer()`, `/transfers/[id]`, PART_RECEIVED                               | `inventory.test.ts`, `verify-wiring.ts`            | Done   |
| FR-7905  | AW3   | `warranties`                                 | `recordCover()`, the form on `/warranty`                                            | `verify-wiring.ts`                                 | Done   |
| FR-7906  | AW3   | `warranties_distance_needs_a_start`          | the reading taken from the vehicle in `recordCover()`                               | `verify-wiring.ts`                                 | Done   |
| FR-7907  | AW4   | —                                            | `/verify` in `marketing.tsx` navigation and footer                                  | `verify-controls.ts`                               | Done   |
| FR-7908  | —     | —                                            | `tellOperatorAboutSignup()`, `OPERATOR_EMAIL`                                       | manual                                             | Done   |
| FR-7801  | AV1   | —                                            | `SubmitOnce`, `useFormStatus`                                                       | `verify-screens.ts`                                | Done   |
| FR-7802  | AV1   | `once_requests`                              | `once()`, `onceToken()`, the money forms                                            | `verify-repeat.ts`                                 | Done   |
| FR-7803  | AV1   | `once_requests_orgId_key_key`                | the claim taken before the work in `once()`                                         | `verify-repeat.ts`                                 | Done   |
| FR-7804  | AV3   | —                                            | `claimOutbox()`, `claimMessages()`, FOR UPDATE SKIP LOCKED                          | `verify-repeat.ts`                                 | Done   |
| FR-7805  | AV3   | —                                            | `LEASE_MINUTES`, the retake in `once()`                                             | `verify-repeat.ts`                                 | Done   |
| FR-7806  | AV2   | `loyalty_entries_once_key`                   | `consequencesOfPayment()`, `catchUpConsequences()`                                  | `verify-repeat.ts`                                 | Done   |
| FR-7807  | AV4   | —                                            | `AbortSignal.timeout`, the `idempotency-key` header on Stripe writes                | `verify-repeat.ts`                                 | Done   |
| FR-7808  | AV4   | —                                            | the `@repeat` markers, `assertDeclared()`, `assertShippable()`                      | `repeat.test.ts`, `verify-writes.ts`               | Done   |
| FR-7701  | AU1   | `Coupon`                                     | `assertCouponSaveable()`, `saveCoupon()`, `/coupons`                                | `coupons.test.ts`, `verify-coupons.ts`             | Done   |
| FR-7702  | AU1   | `coupons_orgId_code_key`                     | `normaliseCouponCode()`, `retireCoupon()`, `coupons_worth_check`                    | `coupons.test.ts`, `verify-coupons.ts`             | Done   |
| FR-7703  | AU3   | `PaymentMethod.COUPON`                       | `redeemAgainstInvoice()`, the invoice page's coupon card                            | `verify-coupons.ts`                                | Done   |
| FR-7704  | AU3   | account `6410`                               | `accountForMethod()`, `postCounterSale()`'s `couponTaken`                           | `accounting.test.ts`, `verify-coupons.ts`          | Done   |
| FR-7705  | AU2   | —                                            | `couponDiscount()`, capped at what is owed                                          | `coupons.test.ts`, `verify-coupons.ts`             | Done   |
| FR-7706  | AU2   | —                                            | `CouponError`, `couponState()`, the coupons dictionary                              | `coupons.test.ts`, `verify-languages.ts`           | Done   |
| FR-7707  | AU3   | `coupon_redemptions_one_per_invoice`         | `recordCounterRedemption()` inside the sale's transaction                           | `verify-coupons.ts`                                | Done   |
| FR-7708  | AU3   | `CouponRedemption`                           | `couponResults()`, `couponResultsFor()`, `couponHistory()`                          | `coupons.test.ts`, `verify-coupons.ts`             | Done   |
| FR-7601  | AT1   | —                                            | `setupSteps()`, `setupFactsFor()`, `/start`                                         | `checklist.test.ts`, `verify-first-day.ts`         | Done   |
| FR-7602  | AT1   | —                                            | `setupProgress()`, `setSetupHidden()`, the dashboard card                           | `checklist.test.ts`, `verify-first-day.ts`         | Done   |
| FR-7603  | AT3   | —                                            | `HELP_ARTICLES`, `searchHelp()`, `/help`, `/search`                                 | `help.test.ts`, `verify-first-day.ts`              | Done   |
| FR-7604  | AT2   | —                                            | `createDemonstration()`, `removeDemonstration()`                                    | `verify-first-day.ts`                              | Done   |
| FR-7605  | AT2   | —                                            | the layout banner, `sendMessageNow()`'s demonstration guard                         | `verify-first-day.ts`                              | Done   |
| FR-7606  | AT2   | —                                            | `switchWorkshop()`, `workshopsFor()`                                                | `verify-first-day.ts`                              | Done   |
| FR-7501  | AS1   | —                                            | `inviteHandover()`, `HandoverInvitation`, `/vehicles/[id]/transfer`                 | `invitation.test.ts`, `verify-ownership.ts`        | Done   |
| FR-7502  | AS2   | —                                            | `describeHandover()`, `/handover/[token]`                                           | `invitation.test.ts`, `verify-ownership.ts`        | Done   |
| FR-7503  | AS1   | —                                            | `acceptHandover()`, `vehicleHistory()`                                              | `verify-ownership.ts`                              | Done   |
| FR-7504  | AS2   | —                                            | `assertHandoverInvitable()`, `handover_invitations_one_pending`                     | `invitation.test.ts`, `verify-ownership.ts`        | Done   |
| FR-7505  | AS2   | —                                            | `handoverState()`, `cancelHandover()`, `declineHandover()`                          | `invitation.test.ts`, `verify-ownership.ts`        | Done   |
| FR-7506  | AS3   | —                                            | `assertSettlement()`, `remedyCost()`, `warranty_claims_recovery_check`              | `cost.test.ts`, `verify-ownership.ts`              | Done   |
| FR-7507  | AS3   | —                                            | `warrantyCost()`, `warrantyBy()`, `/warranty`, `/api/reports/warranty`              | `cost.test.ts`, `verify-ownership.ts`              | Done   |
| FR-7508  | AS4   | —                                            | `chooseLabourRate()`, `chooseSitePrice()`, `LabourRate`, `ProductSitePrice`         | `site.test.ts`, `verify-ownership.ts`              | Done   |
| FR-7401  | AR1   | —                                            | `decodeLocally()`, `vinDecoder()`, `/vehicles/find`                                 | `providers.test.ts`, `verify-providers.ts`         | Done   |
| FR-7402  | AR1   | —                                            | `makeFromWmi()`, `vinEncodesYear()`                                                 | `providers.test.ts`, `verify-providers.ts`         | Done   |
| FR-7403  | AR2   | —                                            | `FitmentFeed`, `fetchFeedFitments()`, `part_fitments.feedName`                      | `verify-providers.ts`                              | Done   |
| FR-7404  | AR2   | —                                            | `planFeedImport()`                                                                  | `providers.test.ts`, `verify-providers.ts`         | Done   |
| FR-7405  | AR3   | —                                            | `assertPayAdjustment()`, `pay_adjustments_lock` trigger                             | `payroll.test.ts`, `verify-providers.ts`           | Done   |
| FR-7406  | AR3   | —                                            | `assertOvertimeMultiplier()`, `draftTimesheet()`                                    | `payroll.test.ts`, `verify-providers.ts`           | Done   |
| FR-7407  | AR3   | —                                            | `PAYROLL_EXPORTS`, `/api/reports/payroll?format=`                                   | `payroll.test.ts`, `verify-providers.ts`           | Done   |
| FR-7408  | AR4   | —                                            | `googleReviewSite`, `/r/[token]/public`, `followReviewInvitation()`                 | `providers.test.ts`, `verify-providers.ts`         | Done   |
| FR-7301  | AQ1   | —                                            | `/print/[kind]/[id]`, `PrintSheet`, `components/print/documents.tsx`                | `verify-paper.ts`                                  | Done   |
| FR-7302  | AQ2   | —                                            | `/api/print/[kind]/[id]`, `renderPdf()`, `pdfFilename()`                            | `print.test.ts`, `verify-paper.ts`                 | Done   |
| FR-7303  | AQ2   | —                                            | `watermarkFor()`                                                                    | `print.test.ts`, `verify-paper.ts`                 | Done   |
| FR-7304  | AQ2   | —                                            | `tFor()`, `readingLocaleFor()`, `<bdi>` around data                                 | `verify-paper.ts`                                  | Done   |
| FR-7305  | AQ1   | —                                            | `readerFor()`, `PRINT_PERMISSION`, `CUSTOMER_PRINT_KINDS`                           | `verify-paper.ts`                                  | Done   |
| FR-7306  | AQ3   | —                                            | `labelSheets()`, `keyTagFor()`, `qrSvg()`                                           | `print.test.ts`, `verify-paper.ts`                 | Done   |
| FR-7307  | AQ3   | —                                            | the print stylesheet in `packages/ui/src/styles.css`                                | `verify-paper.ts`                                  | Done   |
| FR-3907  | A1    | —                                            | `assertNotFlooding()`                                                               | `verify-credentials.ts`                            | Done   |
| FR-3908  | A1    | `auth_tokens.tokenHash`                      | `digest()`                                                                          | `verify-credentials.ts`                            | Done   |
| FR-3801  | —     | —                                            | `/api/inbound/resend`                                                               | `smoke.ts`                                         | Done   |
| FR-3802  | —     | —                                            | `verify()` tolerance                                                                | `smoke.ts`                                         | Done   |
| FR-3803  | —     | `Organization.slug`                          | `organisationFor()`                                                                 | `smoke.ts`                                         | Done   |
| FR-3804  | —     | —                                            | `INBOUND_WEBHOOK_SECRET`                                                            | `smoke.ts`                                         | Done   |

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

Payment collection is now present (Phase 32.6): a card at sign-up, charged when the
trial ends. Before that it was deliberately absent: the trial took no card, and taking
one is Phase 4.7 alongside point of sale. A billing page that collects card
details without a provider behind it would be worse than not having one.

---

## The first two phases, traced one by one (Phase 61)

Eighty-four requirements from Phases 1 and 2 were traced by section rather than
by requirement, before this matrix settled into one row each. The gap was named
at the foot of this page for months and never closed, and closing it was not
paperwork: it turned up five things the requirements say the product does and
the product does not do, and three claims elsewhere in this documentation that
were simply wrong.

Every cell below was checked against the source. Where nothing implements a
requirement the row says so in bold, and where nothing tests it the test column
is a dash. Both are more useful than a plausible entry — a matrix whose rows
were written rather than verified is worse than a gap that is admitted.

| Req     | Story | Schema                                         | Implementation                                                                                                                                     | Test                                               | Status     |
| ------- | ----- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------- |
| FR-108  | BP1   | `Membership`, `Session.orgId`                  | `enterWorkshop()` in `lib/belonging.ts`, the chooser at `/choose`, and the workshop's name in the nav                                              | `belonging.test.ts`, `verify-belonging.ts`         | Done       |
| FR-112  | —     | —                                              | single sign-on is not built. A SHOULD, and the decision is to wait for somebody who wants it                                                       | —                                                  | Deferred   |
| FR-201  | B1    | `Customer.kind`                                | `createCustomer()`, `CustomerFields`                                                                                                               | `customer.test.ts`, `verify-wiring.ts`             | Done       |
| FR-202  | B1    | `Customer` address columns                     | `CustomerFields`, `createCustomer()`                                                                                                               | `verify-wiring.ts`, `verify-empty.ts`              | Done       |
| FR-203  | B1    | `Customer.sourceOfBusiness`                    | `CustomerFields`; `bySource()` reports on it                                                                                                       | `verify-owner.ts`                                  | Done       |
| FR-207  | B1    | `Invoice.billToCustomerId`                     | `issueInvoice()`, and the fleet agreement that sets it                                                                                             | `verify-erp.ts`, `verify-money.ts`                 | Done       |
| FR-208  | B1    | `ConsentChange`                                | `setConsent()`, and the consent gate in `sendMessageNow()`                                                                                         | `messaging.test.ts`, `verify-messaging.ts`         | Done       |
| FR-209  | BO1   | `ERASURE`, the register of 14 holdings         | `exportCustomer()` and `eraseCustomer()` in `lib/erasure.ts`, and the card on the customer page                                                    | `erasure.test.ts`, `verify-erasure.ts`             | Done       |
| FR-302  | C1    | `Vehicle` columns                              | the vehicle form and `registerVehicle()`                                                                                                           | `vehicle.test.ts`, `verify-records.ts`             | Done       |
| FR-303  | BV1   | `FleetNumber`, `Vehicle.registrationExpiresAt` | the expiry is on the vehicle; the number is on the customer's relationship with it, and reachable from the search box                              | `verify-fleet-numbers.ts`                          | Done       |
| FR-306  | C2    | `OdometerReading`                              | `checkIn()` in `lib/arrival.ts`, and the same on a job and an import                                                                               | `arrival.test.ts`, `verify-arrival.ts`             | Done       |
| FR-307  | C2    | `OdometerReading`                              | `assessReading()` in `core/vehicle/mileage.ts`, refusing a figure below the last                                                                   | `vehicle.test.ts`, `verify-awkward.ts`             | Done       |
| FR-308  | C2    | `Vehicle.lastOdometerKm`                       | `averageKmPerDay()` and `projectServiceDue()` in `core/vehicle/mileage.ts`                                                                         | `vehicle.test.ts`, `condition.test.ts`             | Done       |
| FR-310  | D1    | `VehicleEvent`, `VehicleAccessGrant`           | `networkHistory()`, `timelineFor()`, subject to the grant                                                                                          | `network.test.ts`, `verify-network.ts`             | Done       |
| FR-411  | D2    | `HandoverInvitation`, `VehicleOwnership`       | `inviteHandover()`, `acceptHandover()`; the chain is untouched                                                                                     | `handover.test.ts`, `verify-handover.ts`           | Done       |
| FR-412  | D2    | `VehicleOwnership.endedAt`                     | `vehicleHistory()` reads the owner's own period only                                                                                               | `handover.test.ts`, `verify-ownership.ts`          | Done       |
| FR-415  | D1    | `VehicleEvent.odometerKm`                      | the odometer written as its own passport event by `eventsForCompletedJob()`, so a reading that contradicts an earlier one is visible in the chain  | `observations.test.ts`, `verify-provenance.ts`     | Done       |
| FR-501  | E1    | `Booking`                                      | `diaryFor()` and the day, week and month views                                                                                                     | `views.test.ts`, `verify-planning.ts`              | Done       |
| FR-502  | E1    | `Bay`, `Employee`                              | the diary's lanes by bay and by technician                                                                                                         | `views.test.ts`, `verify-planning.ts`              | Done       |
| FR-503  | E1    | `Booking`                                      | `createBooking()`                                                                                                                                  | `verify-planning.ts`, `verify-controls.ts`         | Done       |
| FR-504  | E1    | `Booking.startAt`                              | `moveBooking()` from the diary                                                                                                                     | `verify-planning.ts`                               | Done       |
| FR-505  | E2    | `Location.dailyCapacityHours`                  | `capacityFor()`, which refuses a slot the day cannot take                                                                                          | `capacity.test.ts`, `verify-planning.ts`           | Done       |
| FR-507  | E2    | `MessageLog`                                   | the confirmation queued inside `requestBooking()`'s transaction                                                                                    | `verify-messaging.ts`, `verify-triggers.ts`        | Done       |
| FR-508  | E2    | `BookingStatus.NO_SHOW`                        | `setBookingStatus()`, and the sweep that finds the ones nobody turned up for                                                                       | `verify-triggers.ts`                               | Done       |
| FR-509  | E2    | `Location.dailyCapacityHours`                  | set on `/settings/site`, read by `slotsFor()`                                                                                                      | `capacity.test.ts`, `verify-settings.ts`           | Done       |
| FR-510  | —     | `BookingSource.ONLINE`                         | the product **books straight in** rather than holding a request for confirmation — a decision, written in `booking.ts`, and FR-511 is what it does | `verify-workflow.ts`                               | Superseded |
| FR-511  | E3    | `Booking.source`                               | `slotsFor()` offers only genuine capacity; `requestBooking()` schedules it                                                                         | `accept.test.ts`, `verify-workflow.ts`             | Done       |
| FR-512  | BT1   | `CourtesyVehicle`, `CourtesyLoan`              | `lend()` and `takeBack()` in `lib/courtesy.ts`; `courtesy_loans_no_overlap` refuses a second promise                                               | `courtesy.test.ts`, `verify-courtesy.ts`           | Done       |
| FR-602  | F1    | `Job.status`                                   | `allowedTransitions()`, `moveJob()`                                                                                                                | `lifecycle.test.ts`, `verify-workflow.ts`          | Done       |
| FR-603  | F1    | `JobStatus`                                    | the enum, and the board that draws it                                                                                                              | `lifecycle.test.ts`, `verify-workflow.ts`          | Done       |
| FR-606  | F2    | `JobAttachment`                                | attachments from arrival and from the job page                                                                                                     | `verify-storage.ts`, `verify-arrival.ts`           | Done       |
| FR-607  | F2    | `JobTask`                                      | tasks written by `applyPackage()`; a technician ticks them off                                                                                     | `packages.test.ts`, `verify-packages.ts`           | Done       |
| FR-608  | F2    | `JobLabourLine`                                | labour lines on the job page, priced by `labourRateAt()`                                                                                           | `totals.test.ts`, `verify-ownership.ts`            | Done       |
| FR-609  | F2    | `JobPartLine`                                  | part lines, with the price held on the line                                                                                                        | `totals.test.ts`, `verify-awkward.ts`              | Done       |
| FR-615  | F3    | `ServicePackage`                               | `applyPackage()` fills tasks, labour and parts                                                                                                     | `packages.test.ts`, `verify-packages.ts`           | Done       |
| FR-616  | F3    | `Invoice.billToCustomerId`                     | the third party is billed; the vehicle keeps its owner                                                                                             | `verify-erp.ts`                                    | Done       |
| FR-617  | BS1   | `JobFollowUp`                                  | `setFollowUp()` and `completeFollowUp()` in `lib/followups.ts`; the card on the job, the dashboard and the shop floor                              | `followups.test.ts`, `verify-followups.ts`         | Done       |
| FR-701  | G1    | `InspectionTemplate`                           | `templatesFor()`, `startInspection()`                                                                                                              | `carry-out.test.ts`, `verify-inspection.ts`        | Done       |
| FR-702  | G1    | `Severity`                                     | `recordResult()`; four severities and no fifth                                                                                                     | `carry-out.test.ts`, `verify-inspection.ts`        | Done       |
| FR-703  | G1    | `InspectionResult.measurementValue`            | note, photographs, a measured value with its type, and a wheel position                                                                            | `carry-out.test.ts`, `verify-inspection.ts`        | Done       |
| FR-704  | G1    | `Inspection.criticalCount`                     | `refreshCounts()`, kept true after every change                                                                                                    | `verify-inspection.ts`                             | Done       |
| FR-706  | G2    | —                                              | `/shop`, the technician's own device, measured at seven sizes                                                                                      | `verify-screens.ts`, `verify-offline.ts`           | Done       |
| FR-707  | G2    | `VehicleEvent`                                 | `completeInspection()` writes to the passport in the same transaction                                                                              | `events.test.ts`, `verify-inspection.ts`           | Done       |
| FR-708  | G3    | `InspectionPhoto`                              | the inspection report at `/print/inspection`, and the customer's own copy                                                                          | `verify-paper.ts`, `verify-portal-account.ts`      | Done       |
| FR-710  | —     | —                                              | voice-to-text is not built. A SHOULD, and dictation on a telephone is the operating system's job rather than this product's                        | —                                                  | Deferred   |
| FR-801  | H1    | `EstimateLine`                                 | labour, part and fee lines, each with its own discount                                                                                             | `totals.test.ts`, `verify-workflow.ts`             | Done       |
| FR-802  | H1    | —                                              | `calculateTotals()` in `core/pricing/totals.ts`: subtotal, discount, tax and total                                                                 | `totals.test.ts`, `tax.test.ts`                    | Done       |
| FR-803  | H1    | `EstimateShare`                                | `sendEstimate()`, by email or by text, as a link                                                                                                   | `verify-workflow.ts`, `verify-messaging.ts`        | Done       |
| FR-804  | H1    | `estimate_shares.tokenHash`                    | 32 random bytes, stored as a digest, with an expiry                                                                                                | `tokens.test.ts`, `verify-tenancy.ts`              | Done       |
| FR-805  | H2    | `EstimateApproval`                             | `recordDecision()` at `/e/[token]`, with no account                                                                                                | `decision.test.ts`, `verify-workflow.ts`           | Done       |
| FR-806  | H2    | `LineDecision`                                 | a decision per line, and `approvedPortion()` for what that comes to                                                                                | `decision.test.ts`, `verify-awkward.ts`            | Done       |
| FR-807  | H2    | `EstimateApproval`                             | the moment, the address, the total agreed and who agreed it                                                                                        | `decision.test.ts`, `verify-workflow.ts`           | Done       |
| FR-808  | H2    | `OutboxEvent`                                  | `recordDecision()` moves the job and tells whoever is on it                                                                                        | `verify-triggers.ts`, `verify-workflow.ts`         | Done       |
| FR-809  | H3    | `EstimateLine.inspectionResultId`              | `findingsToEstimateLines()` carries the finding and its photographs across                                                                         | `to-estimate.test.ts`, `verify-inspection.ts`      | Done       |
| FR-810  | H3    | `Estimate.supersedesId`                        | a revision is a new version; both remain readable                                                                                                  | `verify-workflow.ts`                               | Done       |
| FR-811  | H3    | `StockReservation`                             | `reserveForJobLine()` on approval; released on cancellation                                                                                        | `inventory.test.ts`, `verify-awkward.ts`           | Done       |
| FR-901  | I1    | `Invoice`                                      | `issueInvoice()`, in one action from a finished job                                                                                                | `invoicing.test.ts`, `verify-money.ts`             | Done       |
| FR-903  | I1    | `TaxEntry`                                     | `bandsFor()`: every line, and the tax by rate                                                                                                      | `tax.test.ts`, `verify-tax.ts`                     | Done       |
| FR-904  | I1    | —                                              | `/print/invoice/[id]`, and the message that carries it                                                                                             | `print.test.ts`, `verify-paper.ts`                 | Done       |
| FR-905  | I2    | `Payment`                                      | `recordPayment()`, including part payments                                                                                                         | `verify-money.ts`, `verify-ledger.ts`              | Done       |
| FR-906  | I2    | `Invoice.amountPaid`                           | `agedReceivables()`, summed in the database                                                                                                        | `accounting.test.ts`, `verify-performance.ts`      | Done       |
| FR-908  | I2    | `Deposit`                                      | `takeDeposit()`, `applyHeld()`, `returnHeld()`                                                                                                     | `deposits.test.ts`, `verify-deposits.ts`           | Done       |
| FR-909  | I3    | `PaymentAttempt`                               | `/portal/invoices`, and the card page behind it                                                                                                    | `attempts.test.ts`, `verify-payments.ts`           | Done       |
| FR-910  | I3    | `JournalEntry`                                 | `postInvoiceIssued()`, outside the transaction that wrote the bill                                                                                 | `accounting.test.ts`, `verify-ledger.ts`           | Done       |
| FR-1301 | J1    | `VehicleOwnership`                             | `/portal`, each vehicle with where its work has got to                                                                                             | `verify-portal-account.ts`, `verify-screens.ts`    | Done       |
| FR-1302 | J1    | `EstimateApproval`                             | `/portal/estimates/[id]`                                                                                                                           | `decision.test.ts`, `verify-portal-account.ts`     | Done       |
| FR-1303 | J1    | `Invoice`                                      | `invoicesFor()`, `/portal/invoices`                                                                                                                | `verify-portal-account.ts`                         | Done       |
| FR-1304 | J2    | `VehicleEvent`                                 | `/portal/vehicles/[id]/passport`                                                                                                                   | `verify-passports.ts`, `verify-tenancy.ts`         | Done       |
| FR-1305 | J2    | `Booking`                                      | `/portal/book`, into genuine capacity                                                                                                              | `accept.test.ts`, `verify-workflow.ts`             | Done       |
| FR-1306 | J2    | `Conversation`                                 | `conversationForJob()`, the thread against one car                                                                                                 | `conversations.test.ts`, `verify-conversations.ts` | Done       |
| FR-1307 | J3    | `PassportShare`                                | `shareVehicle()`, `revokeShare()`                                                                                                                  | `verify-passports.ts`, `verify-tenancy.ts`         | Done       |
| FR-1308 | J3    | —                                              | every portal page measured at 390 by 844, and in three engines                                                                                     | `verify-screens.ts`, `verify-engines.ts`           | Done       |
| FR-1309 | J3    | `PaymentAttempt`                               | `/pay/[id]` through the provider seam                                                                                                              | `attempts.test.ts`, `verify-payments.ts`           | Done       |
| FR-1310 | J3    | `VehicleDocument`                              | `addDocument()`, against the car rather than the job                                                                                               | `documents.test.ts`, `verify-documents.ts`         | Done       |
| FR-1401 | K1    | —                                              | `/dashboard`: today, in the shop, waiting on approval, taken today                                                                                 | `verify-owner.ts`, `verify-empty.ts`               | Done       |
| FR-1402 | K1    | —                                              | every tile a link; `verify-controls` follows all of them                                                                                           | `verify-controls.ts`                               | Done       |
| FR-1403 | K2    | `TimeEntry`                                    | `/people`, hours clocked against hours charged                                                                                                     | `people.test.ts`, `verify-team.ts`                 | Done       |
| FR-1404 | K2    | `JournalEntry`                                 | `/financials`, summed in the database                                                                                                              | `accounting.test.ts`, `verify-owner.ts`            | Done       |
| FR-1405 | K2    | `JobPartLine`                                  | `partsProfitability()`, and what is being sold below cost                                                                                          | `verify-owner.ts`                                  | Done       |
| FR-1501 | L1    | `MessageLog`                                   | `sendMessageNow()` and the queue behind it                                                                                                         | `messaging.test.ts`, `verify-messaging.ts`         | Done       |
| FR-1502 | L1    | `MessageLog`                                   | channel, recipient, body and status on every one                                                                                                   | `verify-messaging.ts`, `verify-health.ts`          | Done       |
| FR-1503 | L1    | `ConsentChange`                                | the consent check before anything leaves                                                                                                           | `messaging.test.ts`, `verify-deliverability.ts`    | Done       |
| FR-1505 | L2    | `AutomationRule`                               | trigger, condition and action, in `lib/triggers.ts`                                                                                                | `automation.test.ts`, `verify-triggers.ts`         | Done       |
| FR-1506 | L2    | `Vehicle.lastServiceAt`                        | `arrivalSuggestions()` from the history and the interval                                                                                           | `arrival.test.ts`, `verify-arrival.ts`             | Done       |

## Coverage summary

Counted from the table above rather than maintained by hand, and checked by
`npm run verify:traceability`, which also asks whether the rows are true: that
every requirement has one, that every test a row names exists, and that every
function a row names exists in the source. A matrix is the easiest document in
a project to write falsely, because a row naming a function renamed two years
ago reads exactly like a row naming one that is there.

| Area                                               | Traced individually | With an automated test |
| -------------------------------------------------- | ------------------- | ---------------------- |
| Foundation                                         | 10                  | 9                      |
| Customers and vehicles                             | 8                   | 6                      |
| Vehicle passport                                   | 12                  | 11                     |
| Booking, job, inspection, estimate                 | 11                  | 11                     |
| Invoicing, portal, reporting                       | 4                   | 4                      |
| Inventory and procurement (Phase 2)                | 19                  | 18                     |
| Finance and ledger                                 | 12                  | 12                     |
| People and multi-site                              | 13                  | 13                     |
| What the record supports saying                    | 10                  | 10                     |
| Scheduled work                                     | 6                   | 6                      |
| Outbound messaging                                 | 9                   | 9                      |
| After a message leaves                             | 8                   | 8                      |
| Getting in, and mail coming back                   | 163                 | 163                    |
| The workflow, as one thing                         | 6                   | 6                      |
| Arrival and departure                              | 7                   | 7                      |
| Conversations                                      | 7                   | 7                      |
| Packages and templates                             | 5                   | 5                      |
| Languages                                          | 5                   | 5                      |
| Parts back, work out                               | 7                   | 7                      |
| Finding anything                                   | 5                   | 5                      |
| The owner's day, sharpened                         | 6                   | 6                      |
| Every word translated                              | 5                   | 5                      |
| Tax, configurable                                  | 7                   | 7                      |
| Later phases, newest first                         | 311                 | 310                    |
| What people say afterwards                         | 14                  | 14                     |
| The technician's own device                        | 9                   | 9                      |
| Proof of everything, and parts that fit            | 8                   | 8                      |
| The workshop plans itself                          | 10                  | 10                     |
| The passport leaves the workshop                   | 8                   | 8                      |
| The vehicle's own condition                        | 10                  | 10                     |
| Warranty, fleets and the whole story               | 9                   | 9                      |
| The diary and the floor                            | 6                   | 6                      |
| Suppliers and counter bookings                     | 6                   | 6                      |
| Carrying out an inspection                         | 10                  | 10                     |
| The customer's own side                            | 9                   | 9                      |
| Automation and customer relationships              | 11                  | 11                     |
| Expenses, banking and period close                 | 6                   | 6                      |
| Counter sales and business reporting               | 10                  | 10                     |
| Administration and the customer's journey          | 7                   | 7                      |
| Front door and billing                             | 6                   | 6                      |
| The first two phases, traced one by one (Phase 61) | 84                  | 80                     |
| **Total**                                          | **879**             | **871 (99%)**          |

Every one of the 879 requirements now has a row of its own. Until Phase 61,
84 did not — Phase 1 and 2 work traced by section rather than by requirement,
named at the foot of this page for months as a gap somebody would close one
day. Closing it was not paperwork. It found five requirements the product does
not meet, and thirty-four rows naming test files that had been renamed or
consolidated years earlier and never corrected here.

Eight rows are something other than Done, and they say which kind:

| Kind           | What it means                                                                |
| -------------- | ---------------------------------------------------------------------------- |
| **Missing**    | Nothing implements it. None, since Phase 66.                                 |
| **Partial**    | Some of it is there. FR-305, FR-311 — both waiting on an outside feed.       |
| **Deferred**   | A SHOULD, decided against for now, with the reason. FR-112, FR-710.          |
| **Superseded** | The product deliberately does something else, and the row says what. FR-510. |
| **Planned**    | Named for a later phase. FR-111, FR-414, FR-1010.                            |

Phase 62 closed FR-209, which had been the clearest Missing on this page: the
security model specified erasure column by column from the first month and no
code did any of it. Adding the row also found a quieter fault. The check that
recounts this summary compared the total and not the figure beside it, so the
half anybody actually reads was the half free to drift — and had, by two:
_Customers and vehicles_ claimed eight done over a section holding two Partials.
Both figures are now counted from the table.

A row that says Missing is this table working. What would not be working is a
requirement nothing implements beside a row that says Done, and that is the one
thing `verify-traceability` cannot check for you — which is why the rows were
read against the source one at a time rather than generated.

## The eighty-four quality requirements

They are accounted for in `infra/scripts/verify-quality.ts` rather than here:
fifty-two checked by something that runs, fifteen read off the repository,
seventeen enforced by nothing with what each would take written down. They are
not duplicated into this table on purpose — two registers of the same thing
drift, and the first anybody learns of the drift is when they disagree. See
[the non-functional requirements](02-non-functional-requirements.md).
