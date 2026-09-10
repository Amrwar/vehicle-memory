# Functional Requirements

Every requirement is numbered, atomic and testable. `MUST` is mandatory for the
stated phase; `SHOULD` is strongly preferred and requires a recorded decision to
drop; `MAY` is optional.

Phase column: **1** = MVP, **2** = Inventory, **3** = Finance, **4** = Business,
**5** = Automation, **6** = Intelligence.

---

## FR-100 — Tenancy, identity and access

| ID     | Requirement                                                                                                                                                               | Phase |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-101 | The system MUST support multiple independent organisations (tenants) with no data visible across tenant boundaries.                                                       | 1     |
| FR-102 | Tenant scoping MUST be enforced in the data-access layer, not by the calling code remembering to filter.                                                                  | 1     |
| FR-103 | A user MUST authenticate with email and password before accessing any organisation data.                                                                                  | 1     |
| FR-104 | Passwords MUST be stored using a memory-hard hash with a per-password salt. Plaintext or reversibly encrypted passwords are prohibited.                                   | 1     |
| FR-105 | Sessions MUST expire after a configurable idle period and MUST be revocable server-side.                                                                                  | 1     |
| FR-106 | The system MUST support these roles: Owner, Manager, Service Advisor, Technician, Bookkeeper, Customer.                                                                   | 1     |
| FR-107 | Every permission check MUST be deny-by-default.                                                                                                                           | 1     |
| FR-108 | A user MAY belong to more than one organisation and MUST switch between them explicitly.                                                                                  | 1     |
| FR-109 | The system MUST write an immutable audit record for every state-changing action, capturing actor, action, subject, before and after values, timestamp and source address. | 1     |
| FR-110 | Failed authentication attempts MUST be rate-limited per account and per source address.                                                                                   | 1     |
| FR-111 | The system MUST support multiple locations within one organisation, with per-location permissions.                                                                        | 4     |
| FR-112 | The system SHOULD support single sign-on via OpenID Connect.                                                                                                              | 4     |

## FR-200 — Customers

| ID     | Requirement                                                                                                                      | Phase |
| ------ | -------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-201 | The system MUST record customers as either an individual or a company.                                                           | 1     |
| FR-202 | A customer record MUST capture display name, mobile, landline, email and postal address including locality, region and postcode. | 1     |
| FR-203 | A customer record MUST capture source of business for marketing attribution.                                                     | 1     |
| FR-204 | A customer MUST be able to own zero or more vehicles.                                                                            | 1     |
| FR-205 | The system MUST show a customer's complete activity: jobs, invoices, payments, vehicles and communications, in one view.         | 1     |
| FR-206 | The system MUST prevent creation of a duplicate customer with the same mobile or email without explicit confirmation.            | 1     |
| FR-207 | The system MUST support a customer being billed to a third party, such as an insurer or fleet operator.                          | 1     |
| FR-208 | The system MUST support marketing-consent flags per channel, and MUST NOT send marketing to a customer without consent.          | 1     |
| FR-209 | The system MUST support exporting and permanently erasing a customer's personal data on request.                                 | 1     |

## FR-300 — Vehicles

| ID     | Requirement                                                                                                                           | Phase |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-301 | A vehicle MUST be identified primarily by VIN, and MUST be unique by VIN across the entire platform, not per tenant.                  | 1     |
| FR-302 | A vehicle record MUST capture registration, make, model, variant, year, engine, fuel, transmission, body type, colour and drive type. | 1     |
| FR-303 | A vehicle record MUST capture fleet number and registration expiry date.                                                              | 1     |
| FR-304 | The system MUST validate VIN format and check digit where the standard applies, and MUST warn rather than block on failure.           | 1     |
| FR-305 | The system SHOULD decode a VIN into make, model, year and engine without manual entry.                                                | 1     |
| FR-306 | The system MUST record every odometer reading with its date, source and the job that produced it.                                     | 1     |
| FR-307 | The system MUST detect a decreasing odometer reading, flag it as an anomaly, and MUST NOT silently discard it.                        | 1     |
| FR-308 | The system MUST project future mileage from historical readings to drive service scheduling.                                          | 1     |
| FR-309 | A vehicle MUST be linkable to a customer through an ownership record with a start date and an optional end date.                      | 1     |
| FR-310 | The system MUST show a vehicle's complete history regardless of which organisation recorded each event, subject to access control.    | 1     |
| FR-311 | The system MUST track open manufacturer recalls against a vehicle and record when each is performed.                                  | 1     |

## FR-400 — Vehicle passport (the event ledger)

| ID     | Requirement                                                                                                                                                                                             | Phase |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-401 | The system MUST maintain a per-vehicle event ledger that is append-only. Update and delete of a recorded event are prohibited.                                                                          | 1     |
| FR-402 | Each event MUST record: type, effective date, recording organisation, recording user, verification level, payload, and the odometer at the time where known.                                            | 1     |
| FR-403 | Each event MUST be chained to its predecessor by a cryptographic hash covering the event content and the previous hash.                                                                                 | 1     |
| FR-404 | The system MUST provide a verification operation that recomputes a vehicle's chain and reports the first divergence, if any.                                                                            | 1     |
| FR-405 | Event types MUST include at minimum: ownership transfer, mileage reading, service, repair, part fitted, inspection, tire, accident, recall notice, recall performed, modification, registration change. | 1     |
| FR-406 | A recorded event that is later found to be wrong MUST be corrected by appending a superseding event that references it, never by mutation.                                                              | 1     |
| FR-407 | Verification levels MUST distinguish self-reported, workshop-recorded, workshop-verified with evidence, and authority-sourced.                                                                          | 1     |
| FR-408 | Completing a job MUST automatically write the corresponding events to the vehicle's passport.                                                                                                           | 1     |
| FR-409 | The vehicle owner MUST be able to grant read access to a named person or an anonymous link, scoped to one vehicle, with an expiry, and MUST be able to revoke it.                                       | 1     |
| FR-410 | Every access to a shared passport MUST be logged and visible to the owner.                                                                                                                              | 1     |
| FR-411 | Transferring vehicle ownership MUST retain the complete event history and MUST record the transfer as an event.                                                                                         | 1     |
| FR-412 | The previous owner MUST lose write access on transfer, and MUST retain read access only to the period they owned the vehicle.                                                                           | 1     |
| FR-413 | The system MUST render the timeline in a form comprehensible to a non-expert, grouping by year and showing the source of each entry.                                                                    | 1     |
| FR-414 | The system MUST produce a verified history report containing the chain proof, mileage consistency analysis, service adherence and outstanding recalls.                                                  | 5     |
| FR-415 | The system MUST detect mileage inconsistency across organisations and surface it on the passport.                                                                                                       | 6     |

## FR-500 — Booking and scheduling

| ID     | Requirement                                                                                                                        | Phase |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-501 | The system MUST provide a diary in day, week and month views.                                                                      | 1     |
| FR-502 | The diary MUST show resource lanes by bay and by technician.                                                                       | 1     |
| FR-503 | A booking MUST record customer, vehicle, requested services, start time, estimated duration, assigned technician and assigned bay. | 1     |
| FR-504 | A booking MUST be reschedulable by dragging within the diary.                                                                      | 1     |
| FR-505 | The system MUST warn when a booking exceeds the available capacity of a bay or technician for that period.                         | 1     |
| FR-506 | A booking MUST convert to a job in a single action, carrying all its data forward.                                                 | 1     |
| FR-507 | The system MUST send a booking confirmation and a configurable reminder to the customer.                                           | 1     |
| FR-508 | The system MUST record a booking as no-show or cancelled with a reason.                                                            | 1     |
| FR-509 | The system MUST support a daily workload capacity setting per location.                                                            | 1     |
| FR-510 | Customers MUST be able to request a booking through the portal, subject to workshop confirmation.                                  | 1     |
| FR-511 | Customers MUST be able to self-book into genuinely available capacity without staff confirmation.                                  | 5     |
| FR-512 | The system MUST manage courtesy vehicle allocation against bookings.                                                               | 2     |

## FR-600 — Jobs

| ID     | Requirement                                                                                                                                                                                     | Phase |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-601 | The job MUST be the central entity linking customer, vehicle, inspection, estimate, labour, parts, purchase orders, invoice, payment and passport events.                                       | 1     |
| FR-602 | A job MUST have a defined lifecycle status, and the system MUST reject transitions not permitted by the state machine.                                                                          | 1     |
| FR-603 | Job statuses MUST include: Draft, Booked, Received, Inspecting, Diagnosed, Estimated, Awaiting Approval, Approved, In Progress, Quality Check, Completed, Invoiced, Paid, Cancelled.            | 1     |
| FR-604 | Every status change MUST be recorded with actor, timestamp and optional note, and MUST be visible as a progress trail on the job.                                                               | 1     |
| FR-605 | A job MUST capture: short description, detailed notes, job types, tags, assigned technicians, bay, customer order number, odometer in and out, estimated hours, promised time and pick-up time. | 1     |
| FR-606 | A job MUST support attachments: photographs, documents and inspection reports.                                                                                                                  | 1     |
| FR-607 | A job MUST support a task checklist that technicians complete individually.                                                                                                                     | 1     |
| FR-608 | The system MUST record labour lines with technician, description, hours and rate.                                                                                                               | 1     |
| FR-609 | The system MUST record part lines with description, quantity, unit cost and unit price.                                                                                                         | 1     |
| FR-610 | The system MUST record time entries clocked against a job by a technician, and MUST prevent a technician being clocked onto two jobs simultaneously.                                            | 1     |
| FR-611 | The system MUST calculate job totals: labour, parts, fees, tax and grand total.                                                                                                                 | 1     |
| FR-612 | The system MUST require a quality check to be recorded before a job may be marked complete, where the job type demands one.                                                                     | 1     |
| FR-613 | The system MUST show job profitability: revenue less parts cost less labour cost, with margin.                                                                                                  | 3     |
| FR-614 | Completing a job MUST write passport events for the work performed.                                                                                                                             | 1     |
| FR-615 | The system MUST support job templates that pre-populate tasks, labour and parts for a standard service.                                                                                         | 1     |
| FR-616 | The system MUST support billing a job to a third party while keeping the vehicle owner as the customer.                                                                                         | 1     |
| FR-617 | The system MUST support follow-up flags on a job with a due date and an assignee.                                                                                                               | 1     |

## FR-700 — Inspections

| ID     | Requirement                                                                                                                                         | Phase |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-701 | The system MUST support configurable inspection templates composed of sections and items.                                                           | 1     |
| FR-702 | Each inspection item MUST record one of: Pass, Advisory, Critical, Not checked.                                                                     | 1     |
| FR-703 | Each inspection item MUST support a free-text note, one or more photographs, a measured value with unit, and a recommended action.                  | 1     |
| FR-704 | An inspection MUST produce a summary showing counts by severity.                                                                                    | 1     |
| FR-705 | Items marked Advisory or Critical MUST be convertible into estimate lines in a single action, carrying their notes, photographs and estimated cost. | 1     |
| FR-706 | An inspection MUST be completable on a tablet without a keyboard for anything other than free-text notes.                                           | 1     |
| FR-707 | An inspection MUST retain a permanent record and MUST be written to the vehicle passport on completion.                                             | 1     |
| FR-708 | The customer MUST be able to view a completed inspection, including photographs, through the portal.                                                | 1     |
| FR-709 | The system MUST record tyre tread depth per wheel position, and brake pad and disc measurements, as structured values rather than free text.        | 1     |
| FR-710 | The system SHOULD support voice-to-text on note fields.                                                                                             | 5     |

## FR-800 — Estimates and approval

| ID     | Requirement                                                                                                             | Phase |
| ------ | ----------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-801 | An estimate MUST support labour lines, part lines and fee lines, each with quantity, unit price, discount and tax rate. | 1     |
| FR-802 | An estimate MUST show subtotal, discount, tax and total.                                                                | 1     |
| FR-803 | An estimate MUST be sendable to the customer by email and by SMS as a secure link.                                      | 1     |
| FR-804 | The approval link MUST be unguessable, single-vehicle in scope, and expire after a configurable period.                 | 1     |
| FR-805 | The customer MUST be able to approve, decline, or ask a question, without creating an account.                          | 1     |
| FR-806 | The customer MUST be able to approve or decline individual lines, not only the whole estimate.                          | 1     |
| FR-807 | Approval MUST record timestamp, source address, the exact total agreed, and the identity of the approver where known.   | 1     |
| FR-808 | Approval MUST advance the job status and notify the assigned technician.                                                | 1     |
| FR-809 | The estimate presented to the customer MUST include the relevant inspection findings and photographs.                   | 1     |
| FR-810 | A revised estimate MUST create a new version rather than editing the sent one, and both MUST remain visible.            | 1     |
| FR-811 | Approval MUST reserve the required parts from stock.                                                                    | 2     |
| FR-812 | Work exceeding the approved total by more than a configurable threshold MUST require a further approval.                | 1     |

## FR-900 — Invoicing and payment

| ID     | Requirement                                                                                  | Phase |
| ------ | -------------------------------------------------------------------------------------------- | ----- |
| FR-901 | An invoice MUST be generatable from a completed job in one action.                           | 1     |
| FR-902 | An invoice MUST have a unique, gapless, per-organisation sequential number.                  | 1     |
| FR-903 | An invoice MUST show line detail, tax breakdown by rate, and total.                          | 1     |
| FR-904 | An invoice MUST be renderable as a PDF and sendable by email.                                | 1     |
| FR-905 | The system MUST record payments including partial payments, with method, date and reference. | 1     |
| FR-906 | The system MUST show outstanding balance per invoice and per customer, with ageing.          | 1     |
| FR-907 | An issued invoice MUST NOT be editable. Corrections MUST be made by credit note.             | 1     |
| FR-908 | The system MUST support customer deposits held against a job.                                | 1     |
| FR-909 | The customer MUST be able to view and pay an invoice through the portal.                     | 1     |
| FR-910 | Issuing an invoice MUST post the corresponding journal entries.                              | 3     |

## FR-1000 — Inventory

| ID      | Requirement                                                                                                    | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------- | ----- |
| FR-1001 | The system MUST maintain a parts catalogue with part number, description, category, unit, cost and sell price. | 2     |
| FR-1002 | The system MUST track stock on hand per part per warehouse.                                                    | 2     |
| FR-1003 | Adding a part to a job MUST reserve it from available stock.                                                   | 2     |
| FR-1004 | The system MUST record every stock movement with type, quantity, reference and resulting balance.              | 2     |
| FR-1005 | The system MUST value stock using weighted average cost.                                                       | 2     |
| FR-1006 | The system MUST detect stock below reorder point and raise an alert.                                           | 2     |
| FR-1007 | The system MUST suggest reorder quantity from historical usage rate and outstanding purchase orders.           | 2     |
| FR-1008 | The system MUST support stock adjustments with a mandatory reason.                                             | 2     |
| FR-1009 | The system MUST support stocktakes with variance reporting.                                                    | 2     |
| FR-1010 | The system MUST support stock transfer between locations.                                                      | 4     |
| FR-1011 | Consuming a part on a job MUST record the cost against that job.                                               | 2     |

## FR-1100 — Procurement

| ID      | Requirement                                                                                       | Phase |
| ------- | ------------------------------------------------------------------------------------------------- | ----- |
| FR-1101 | The system MUST support suppliers with contact details, payment terms and account reference.      | 2     |
| FR-1102 | A shortage on a job MUST be able to raise a purchase request.                                     | 2     |
| FR-1103 | A purchase request above a configurable threshold MUST require approval before becoming an order. | 2     |
| FR-1104 | A purchase order MUST record supplier, lines, expected date and delivery location.                | 2     |
| FR-1105 | The system MUST support partial goods receipt against a purchase order.                           | 2     |
| FR-1106 | Goods receipt MUST increase stock and record the actual unit cost.                                | 2     |
| FR-1107 | The system MUST match supplier bills to purchase orders and receipts, and flag discrepancies.     | 2     |
| FR-1108 | Purchase orders MUST be linkable to the job that caused them.                                     | 2     |

## FR-1200 — Accounting

| ID      | Requirement                                                                                    | Phase |
| ------- | ---------------------------------------------------------------------------------------------- | ----- |
| FR-1201 | The system MUST maintain a chart of accounts per organisation.                                 | 3     |
| FR-1202 | Every journal entry MUST balance. An unbalanced entry MUST be rejected.                        | 3     |
| FR-1203 | Journal entries MUST be posted automatically from operational events per the accounting model. | 3     |
| FR-1204 | A posted journal entry MUST NOT be editable. Corrections MUST be by reversing entry.           | 3     |
| FR-1205 | Every posted entry MUST reference the operational document that caused it.                     | 3     |
| FR-1206 | The system MUST produce trial balance, profit and loss, and balance sheet for any period.      | 3     |
| FR-1207 | The system MUST support fiscal periods and MUST prevent posting into a closed period.          | 3     |
| FR-1208 | The system MUST maintain accounts receivable and payable with ageing.                          | 3     |
| FR-1209 | The system MUST support bank accounts and reconciliation.                                      | 3     |
| FR-1210 | The system MUST support configurable tax rates and produce a tax report for a period.          | 3     |
| FR-1211 | The system MUST record expenses with category, supplier and tax treatment.                     | 3     |

## FR-1300 — Customer portal

| ID      | Requirement                                                                       | Phase |
| ------- | --------------------------------------------------------------------------------- | ----- |
| FR-1301 | A customer MUST be able to see their vehicles and each vehicle's current status.  | 1     |
| FR-1302 | A customer MUST be able to approve or decline estimates.                          | 1     |
| FR-1303 | A customer MUST be able to view and download invoices.                            | 1     |
| FR-1304 | A customer MUST be able to read their vehicle's passport.                         | 1     |
| FR-1305 | A customer MUST be able to request a booking.                                     | 1     |
| FR-1306 | A customer MUST be able to message the workshop about a specific job.             | 1     |
| FR-1307 | A customer MUST be able to share a vehicle passport by link and revoke that link. | 1     |
| FR-1308 | The portal MUST be fully usable on a phone.                                       | 1     |
| FR-1309 | A customer MUST be able to pay an invoice online.                                 | 3     |
| FR-1310 | A customer MUST be able to upload documents against a vehicle.                    | 1     |

## FR-1400 — Reporting

| ID      | Requirement                                                                                                         | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-1401 | The dashboard MUST show today's jobs, vehicles in shop, jobs awaiting approval and revenue today.                   | 1     |
| FR-1402 | Every dashboard figure MUST link to the underlying records.                                                         | 1     |
| FR-1403 | The system MUST report technician hours, jobs completed, revenue generated and efficiency against estimate.         | 1     |
| FR-1404 | The system MUST report revenue, gross profit, receivables and average job value for a period.                       | 3     |
| FR-1405 | The system MUST report parts profitability by part and by category.                                                 | 3     |
| FR-1406 | Every report MUST be exportable as CSV.                                                                             | 1     |
| FR-1407 | The system MUST report passport coverage: vehicles with events, events per vehicle, share of jobs producing events. | 1     |

## FR-1600 — People and payroll

| Ref     | Requirement                                                                                                                                 | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-1601 | The system MUST hold an employment record separate from the login account, so a leaver's history survives their account being disabled.     | 4     |
| FR-1602 | Pay rates MUST be effective-dated. Changing a rate MUST NOT alter the cost of work already recorded.                                        | 4     |
| FR-1603 | The system MUST record attendance separately from time booked to jobs.                                                                      | 4     |
| FR-1604 | The system MUST report utilisation, efficiency and productivity together, and MUST NOT present any one of them alone.                       | 4     |
| FR-1605 | Timesheets MUST require approval, and a paid timesheet MUST be immutable.                                                                   | 4     |
| FR-1606 | The system MUST record absence by type against an entitlement.                                                                              | 4     |
| FR-1607 | The system MUST hold qualifications with expiry dates and MUST surface those that have lapsed or are close to lapsing.                      | 4     |
| FR-1608 | Commission schemes MUST support a basis, a threshold, a guarantee and marginal bands, and MUST be able to withhold until the customer pays. | 4     |

## FR-1700 — Multi-site

| Ref     | Requirement                                                                                                                               | Phase |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-1701 | A membership MAY be scoped to one site; a membership without a site MUST see the whole group.                                             | 4     |
| FR-1702 | Stock transfers MUST track sent, received and in-transit separately, and in-transit stock MUST be counted in the group's inventory value. | 4     |
| FR-1703 | Consolidated reporting MUST be computed from underlying quantities, never by averaging site percentages.                                  | 4     |
| FR-1704 | Group reporting MUST report the spread between sites, not only the aggregate.                                                             | 4     |
| FR-1705 | Movements between sites in the same group MUST be identifiable so they can be excluded from group figures.                                | 4     |

## FR-2200 — Automation and customer relationships

| Ref     | Requirement                                                                                                                      | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-2201 | A rule MUST be a trigger, conditions and actions, and MUST NOT be able to trigger another rule.                                  | 5     |
| FR-2202 | A rule MUST NOT act on the same subject twice inside its cooldown, and the cooldown MUST be enforced by the database.            | 5     |
| FR-2203 | A rule that could never fire MUST be refused when it is written, not when it runs.                                               | 5     |
| FR-2204 | Every evaluation MUST be recorded, including the ones that decided not to act, with the reason.                                  | 5     |
| FR-2205 | Marketing MUST be gated on per-channel consent; transactional messages about a customer's own work MUST NOT be.                  | 5     |
| FR-2206 | Consent MUST be rechecked at the moment of sending, never taken from when the audience was built.                                | 5     |
| FR-2207 | Every change to a marketing permission MUST be recorded permanently, and the record MUST NOT be editable or deletable.           | 5     |
| FR-2208 | A campaign MUST report who was held back and why, not only who was reached.                                                      | 5     |
| FR-2209 | Retention MUST be reported by the cohort a customer joined in, and a cohort MUST NOT be shown at a month it has not yet reached. | 5     |
| FR-2210 | A service falling due MUST produce a message that offers a booking, without staff action.                                        | 5     |
| FR-2211 | On arrival, the system MUST suggest work from the vehicle's own history, and every suggestion MUST carry the reason it appeared. | 5     |

## FR-2100 — Expenses, banking and period close

| Ref     | Requirement                                                                                                                 | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-2101 | The system MUST record expenses with a category, a receipt and an approver, and MUST separate reclaimable input tax.        | 4.8   |
| FR-2102 | Nobody MUST be able to approve their own expense claim, and an expense MUST NOT post until it is approved.                  | 4.8   |
| FR-2103 | The system MUST reconcile a bank statement against the ledger, and every suggested match MUST carry its reasoning.          | 4.8   |
| FR-2104 | Only exact matches MUST be offered for acceptance without review, and one ledger entry MUST NOT settle two statement lines. | 4.8   |
| FR-2105 | A fiscal period MUST refuse to close while anything that would change its figures is outstanding.                           | 4.8   |
| FR-2106 | An expense paid personally MUST be recorded as owed back rather than as money leaving the bank.                             | 4.8   |

## FR-2000 — Counter sales and business reporting

| Ref     | Requirement                                                                                                                | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-2001 | The system MUST support a sale with no job, no vehicle and no customer record.                                             | 4.7   |
| FR-2002 | A counter sale MUST move stock, recognise cost and post to the ledger as one operation.                                    | 4.7   |
| FR-2003 | Cash and card MUST be recorded separately, and the till MUST report its variance rather than absorbing it.                 | 4.7   |
| FR-2004 | The system MUST list estimates awaiting a customer's answer, ordered by how long they have waited.                         | 4.7   |
| FR-2005 | The system MUST report revenue by service type, with cost, so busy-and-unprofitable work is visible.                       | 4.7   |
| FR-2006 | The system MUST report parts profitability and MUST surface parts being sold below cost.                                   | 4.7   |
| FR-2007 | The system MUST report customer retention against each customer's own visit rhythm, not a fixed interval.                  | 4.7   |
| FR-2008 | The system MUST report source of business by conversion, not only by volume.                                               | 4.7   |
| FR-2009 | Every export MUST defuse spreadsheet formula injection, preserve leading zeros, and write dates no locale can reinterpret. | 4.7   |

## FR-1900 — Administration and the customer's journey

| Ref     | Requirement                                                                                                                  | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-1901 | An owner or manager MUST be able to invite a colleague by email, and MUST NOT be able to grant a role above their own.       | 4.6   |
| FR-1902 | An invitation MUST be a single-use capability with an expiry, and only its digest MUST be stored.                            | 4.6   |
| FR-1903 | A role MUST be changeable, nobody MUST be able to change their own, and an organisation MUST always retain one active owner. | 4.6   |
| FR-1904 | A customer MUST be able to book online, and MUST only be offered times the workshop can genuinely do the work.               | 4.6   |
| FR-1905 | The system MUST show which service reminders are due, which have been sent, and which have no reachable owner.               | 4.6   |
| FR-1906 | A leaver MUST be deactivated rather than deleted, and their sessions MUST end immediately.                                   | 4.6   |
| FR-1907 | The system MUST notify a customer only at the stages that change something for them.                                         | 4.6   |

## FR-1800 — Front door and billing

| Ref     | Requirement                                                                                                                           | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-1801 | The system MUST present a public page explaining what it does, indexable and usable on a phone.                                       | 4.5   |
| FR-1802 | Pricing MUST be published, and the published figures MUST be the same definitions the application enforces.                           | 4.5   |
| FR-1803 | Signing up MUST create an organisation with its owner, in one transaction, with enough configuration to take a booking immediately.   | 4.5   |
| FR-1804 | Plan limits and features MUST be enforced where the feature is used, and a refusal MUST name the plan that would allow it.            | 4.5   |
| FR-1805 | Creating an organisation MUST be recorded in the audit log.                                                                           | 4.5   |
| FR-1806 | An organisation or user that has been audited MUST still be deletable, and the audit record MUST survive detached rather than edited. | 4.5   |

## FR-1500 — Notifications and automation

| ID      | Requirement                                                                                                            | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-1501 | The system MUST send transactional email and SMS for booking confirmations, estimate requests, approvals and invoices. | 1     |
| FR-1502 | Every outbound message MUST be logged with channel, recipient, content and delivery status.                            | 1     |
| FR-1503 | The system MUST not send to a customer who has withdrawn consent for that channel.                                     | 1     |
| FR-1504 | The system MUST calculate the next service due by date and by projected mileage, and MUST send a reminder.             | 1     |
| FR-1505 | The system MUST support user-defined automation rules of the form trigger, condition, action.                          | 5     |
| FR-1506 | The system MUST suggest service items on arrival based on the vehicle's history and elapsed interval.                  | 5     |

---

_Next: [Non-functional requirements](02-non-functional-requirements.md)._
