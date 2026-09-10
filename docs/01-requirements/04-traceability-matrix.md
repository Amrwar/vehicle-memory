# Traceability Matrix

Every shipped requirement traced from statement to implementation to test. A
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

## Finance and ledger

| Req     | Story | Schema                           | Implementation              | Test                 | Status |
| ------- | ----- | -------------------------------- | --------------------------- | -------------------- | ------ |
| FR-1201 | —     | `Account`                        | `STANDARD_CHART`            | `accounting.test.ts` | Done   |
| FR-1202 | —     | `JournalEntry`, `JournalLine`    | `postEntry()`               | `verify-ledger.ts`   | Done   |
| FR-1203 | —     | `journal_lines_balance`          | deferred constraint trigger | `verify-ledger.ts`   | Done   |
| FR-1204 | —     | `journal_lines_debit_xor_credit` | check constraint            | `verify-ledger.ts`   | Done   |
| FR-1205 | —     | `JournalEntry.sourceType`        | posting rules               | `accounting.test.ts` | Done   |
| FR-1206 | —     | —                                | `trialBalance()`            | `accounting.test.ts` | Done   |
| FR-1207 | —     | —                                | `profitAndLoss()`           | `accounting.test.ts` | Done   |
| FR-1208 | —     | —                                | `balanceSheet()`            | `accounting.test.ts` | Done   |
| FR-1209 | —     | `Invoice`, `SupplierBill`        | `ageAnalysis()`             | `verify-ledger.ts`   | Done   |
| FR-1210 | —     | `TaxRate`                        | `taxReturn()`               | `accounting.test.ts` | Done   |
| FR-1211 | —     | `FiscalPeriod.isClosed`          | `postEntry()` period guard  | `verify-ledger.ts`   | Done   |
| FR-1212 | —     | `JournalEntry.reversesId`        | `reverse()`                 | `accounting.test.ts` | Done   |
| FR-613  | —     | `TimeEntry.costRate`             | `jobProfit()`               | `smoke.ts`           | Done   |

Bank reconciliation, expense capture and period close are the remainder of
Phase 3 and are not yet built. They are absent from this table rather than
listed as planned, because a matrix that lists intentions stops being a record
of what is true.

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
| Finance and ledger                        | 13                  | 13                     |
| People and multi-site                     | 13                  | 13                     |
| Automation and customer relationships     | 11                  | 11                     |
| Expenses, banking and period close        | 6                   | 6                      |
| Counter sales and business reporting      | 10                  | 10                     |
| Administration and the customer's journey | 7                   | 7                      |
| Front door and billing                    | 6                   | 6                      |
| **Total**                                 | **130**             | **127 (98%)**          |

The requirements document lists 213 requirements. 84 of
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
