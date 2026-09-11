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

## FR-3500 — The technician's own device

| Ref     | Requirement                                                                                                                  | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-3501 | A technician MUST be able to record work with no connection, and nothing recorded MUST be lost.                              | 14    |
| FR-3502 | Every queued action MUST carry an id generated on the device, so a retry is recognised rather than applied twice.            | 14    |
| FR-3503 | A queued action MUST be classed as a fact, an addition or a claim, and only a claim MUST be able to conflict.                | 14    |
| FR-3504 | Actions MUST replay in the order they happened, not the order they arrived, and the result MUST NOT depend on batch order.   | 14    |
| FR-3505 | Nothing MUST be applied to a job invoiced while the device was offline.                                                      | 14    |
| FR-3506 | A refused action MUST come back with a sentence saying why, and MUST stay on the device rather than being discarded.         | 14    |
| FR-3507 | The set of actions a device may queue MUST be closed, and anything else MUST be refused.                                     | 14    |
| FR-3508 | The shop floor MUST be installable and MUST open with no signal; what is cached MUST NOT include money or anybody's address. | 14    |
| FR-3509 | An action recorded in the future or older than a fortnight MUST be refused rather than applied silently.                     | 14    |

## FR-3400 — Proof of everything, and parts that fit

| Ref     | Requirement                                                                                                                     | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-3401 | Any audited record MUST be readable as its own history, oldest first, with who, what, when and what changed.                    | 13    |
| FR-3402 | A history MUST show only fields that actually changed, and MUST NEVER display a credential, token or hash at any depth.         | 13    |
| FR-3403 | A history MUST be scoped to the organisation, and MUST be refused outright for a type not on the readable list.                 | 13    |
| FR-3404 | A part MUST be recordable as fitting named vehicles, with the source of the claim.                                              | 13    |
| FR-3405 | Fitment MUST have three states. No data recorded MUST NOT read as fitting.                                                      | 13    |
| FR-3406 | A job MUST warn where a part does not fit the vehicle, and MUST stay silent where it does.                                      | 13    |
| FR-3407 | A fitment MUST name a make, MUST have a year range that runs forwards, and MUST NOT be recorded twice for the same description. | 13    |
| FR-3408 | The audit log MUST remain immutable: no row may be altered or deleted by anybody.                                               | 13    |

## FR-3300 — The workshop plans itself

| Ref     | Requirement                                                                                                              | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------ | ----- |
| FR-3301 | Capacity MUST be computed from working patterns and approved absences, never from a figure typed on a site record.       | 12    |
| FR-3302 | People and bays MUST be reported separately, and the binding constraint MUST be named.                                   | 12    |
| FR-3303 | A workshop MUST be able to record its own skills and sign people off at a stated level, with the date of the assessment. | 12    |
| FR-3304 | The matrix MUST keep a column for a skill nobody holds, and MUST name a skill only one person holds.                     | 12    |
| FR-3305 | The system MUST be able to propose a day, and MUST NOT propose work to somebody not signed off on it.                    | 12    |
| FR-3306 | Every line of a proposal MUST carry the reason it is where it is, and everything left over MUST say why.                 | 12    |
| FR-3307 | A proposal MUST NOT write anything. A person accepts it.                                                                 | 12    |
| FR-3308 | Work whose parts are not on the shelf MUST NOT be scheduled.                                                             | 12    |
| FR-3309 | A working pattern MUST be a real shift: an ISO weekday, an end after its start, and a break shorter than the shift.      | 12    |
| FR-3310 | Withdrawing a sign-off MUST remove the record rather than storing an inability.                                          | 12    |

## FR-3200 — The passport leaves the workshop

| Ref     | Requirement                                                                                                                     | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-3201 | A vehicle MUST be transferable to a new owner, closing one ownership and opening exactly one other.                             | 11    |
| FR-3202 | No owner's name MUST enter the append-only chain, so that a permanent record can still honour an erasure request.               | 11    |
| FR-3203 | A seller MUST be able to produce a report stating what the record says, what it does not cover, and whether it is intact.       | 11    |
| FR-3204 | A buyer with no account MUST be able to check the same figures from a code, seeing nothing about any owner.                     | 11    |
| FR-3205 | Manufacturer recalls MUST be readable against the vehicles a workshop sees, and the page MUST say it is a record, not a source. | 11    |
| FR-3206 | A transfer MUST be refused when it is dated before the seller's purchase, in the future, or to the same owner.                  | 11    |
| FR-3207 | A vehicle that has a recorded history MUST NOT be deletable, while the personal rows attached to it MUST be.                    | 11    |
| FR-3208 | A report MUST distinguish a record that could not be checked from one that has been altered.                                    | 11    |

## FR-3100 — The vehicle's own condition

| Ref     | Requirement                                                                                                                        | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-3101 | A vehicle MUST carry a health score, and every figure behind it MUST be shown with the evidence that produced it.                  | 10    |
| FR-3102 | A measure with no evidence MUST be excluded from the score and named, never counted as a pass or a failure.                        | 10    |
| FR-3103 | The score MUST belong to the vehicle: nothing in it may measure what was spent at, or how recently it visited, one workshop.       | 10    |
| FR-3104 | A vehicle MUST be readable as components with ages, derived from what was fitted rather than stored as a second record.            | 10    |
| FR-3105 | A component MUST be aged by time and by distance, and reported by whichever has gone further.                                      | 10    |
| FR-3106 | A part MUST only be claimed as a known component when the record says so plainly; anything else MUST stay an ordinary part.        | 10    |
| FR-3107 | What is likely due MUST be stated in distance as well as date, from this vehicle's own mileage rate and its own service intervals. | 10    |
| FR-3108 | A prediction MUST state what it was built from and how confident it is, and MUST refuse rather than guess without a mileage rate.  | 10    |
| FR-3109 | Opening a job MUST flag cover still running on that vehicle, with the job that created it and who would pay.                       | 10    |
| FR-3110 | A page that cannot render immediately MUST show the product rather than a spinner, and MUST stop for reduced motion.               | 10    |

## FR-3000 — Warranty, fleets and the whole story

| Ref     | Requirement                                                                                                                   | Phase |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-3001 | The system MUST record what the workshop stands behind, on what date and to what mileage, and MUST show what is running out.  | 9     |
| FR-3002 | Cover MUST end on time or on distance, whichever comes first, and distance MUST NOT count without the reading it starts from. | 9     |
| FR-3003 | The supplier's own term MUST be recorded alongside the workshop's, so a claim recoverable from a supplier is never absorbed.  | 9     |
| FR-3004 | A claim outside cover MUST be allowed, MUST be recorded as goodwill, and MUST carry a stated reason.                          | 9     |
| FR-3005 | One warranty MUST carry at most one open claim, and a settled claim MUST carry a time and an outcome.                         | 9     |
| FR-3006 | Cover MUST NOT be voided without a person, a time and a reason.                                                               | 9     |
| FR-3010 | A company with more than one vehicle MUST be readable as a fleet, without a separate record of ownership to maintain.         | 9     |
| FR-3011 | A fleet MUST be ordered by what needs deciding, not by registration.                                                          | 9     |
| FR-3012 | A customer's visits, quotes, decisions, invoices, payments and messages MUST be readable as one thread, newest first.         | 9     |

## FR-2900 — The diary and the floor

| Ref     | Requirement                                                                                                       | Phase |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ----- |
| FR-2901 | The diary MUST be readable by day, week, month, technician, bay and site.                                         | 8     |
| FR-2902 | Every lane MUST be shown even when empty, including work with no bay or nobody assigned.                          | 8     |
| FR-2903 | A booking MUST be movable by dragging, and by a control that needs no pointer.                                    | 8     |
| FR-2904 | A move MUST run the same capacity check as making a booking, and MUST refuse only what is impossible.             | 8     |
| FR-2905 | The floor MUST show what occupies each bay at this moment, and MUST mark anything past its slot.                  | 8     |
| FR-2906 | The dashboard MUST show work blocked on parts, work past its promised date, and what the workshop has done today. | 8     |

## FR-2800 — Suppliers and counter bookings

| Ref     | Requirement                                                                                         | Phase |
| ------- | --------------------------------------------------------------------------------------------------- | ----- |
| FR-2801 | A supplier MUST be readable on its own page, showing measured lead time, lateness and what is owed. | 7     |
| FR-2802 | A supplier MUST be addable with a name alone, and a duplicate name MUST be refused with its reason. | 7     |
| FR-2803 | A booking MUST be readable on its own page, and movable through its states in one press each.       | 7     |
| FR-2804 | A booking MUST be takeable over the counter, with the bay and technician optional.                  | 7     |
| FR-2805 | Purchase price history MUST be visible per supplier, with the change since the previous price.      | 7     |
| FR-2806 | Every control in the product MUST do something, and every link MUST resolve.                        | 7     |

## FR-2700 — Carrying out an inspection

| Ref     | Requirement                                                                                                   | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------- | ----- |
| FR-2701 | A technician MUST be able to carry out an inspection from a tablet, one item at a time.                       | 7     |
| FR-2702 | Each answer MUST be saved as it is given, not held until the end.                                             | 7     |
| FR-2703 | An amber or red item MUST carry a measurement, a note or a recommendation before it can be recorded.          | 7     |
| FR-2704 | An inspection MUST be completable with items unchecked, and the customer MUST be told which were not checked. | 7     |
| FR-2705 | Inspections left open MUST be visible, because each is work done and not charged for.                         | 7     |
| FR-2706 | Completing an inspection MUST create the quote lines in the same transaction, linked to what was found.       | 7     |
| FR-2707 | A completed inspection MUST NOT be editable.                                                                  | 7     |
| FR-2708 | A photograph MUST upload directly to the file store, and MUST be recorded only once the store holds it.       | 7.1   |
| FR-2709 | The file store MUST be reachable by a protocol rather than tied to one vendor.                                | 7.1   |
| FR-2710 | Photographs MUST be served by signed links rather than from a public bucket.                                  | 7.1   |

## FR-2600 — What the record supports saying

| Ref     | Requirement                                                                                    | Phase |
| ------- | ---------------------------------------------------------------------------------------------- | ----- |
| FR-2601 | A vehicle's mileage record MUST be examined as a whole sequence, not only pairwise.            | 6     |
| FR-2602 | A rollback later masked by higher readings MUST be detected and identified as masked.          | 6     |
| FR-2603 | Every finding MUST carry how certain it is, and arithmetic MUST be distinguished from pattern. | 6     |
| FR-2604 | An absence of records MUST be reported as thin history and MUST NOT be presented as suspicion. | 6     |
| FR-2605 | The system MUST NOT reduce a vehicle's record to a score.                                      | 6     |
| FR-2606 | A reorder recommendation MUST account for demand variability, not only the mean.               | 6     |
| FR-2607 | A recommendation MUST be refused, with its reason, when the history behind it is too thin.     | 6     |
| FR-2608 | Lead time MUST be measured from the workshop's own orders rather than read from a setting.     | 6     |
| FR-2609 | Job duration MUST be reported as a median with its spread, and refused below a sample floor.   | 6     |
| FR-2610 | Work booked for longer than it takes MUST be surfaced alongside work booked for less.          | 6     |

## FR-2500 — Scheduled work

| Ref     | Requirement                                                                                                               | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-2501 | Background jobs MUST run in production without a long-running process being deployed.                                     | 5.3   |
| FR-2502 | The scheduled driver and the development loop MUST call the same implementation of every job.                             | 5.3   |
| FR-2503 | Every job MUST be safe to run concurrently and safe to run twice.                                                         | 5.3   |
| FR-2504 | The scheduled routes MUST refuse any request that does not carry the scheduler's secret, including from a signed-in user. | 5.3   |
| FR-2505 | A missing scheduler secret MUST cause refusal, never open access.                                                         | 5.3   |
| FR-2506 | A failed scheduled run MUST answer with an error status so the platform records it.                                       | 5.3   |

## FR-2400 — Outbound messaging

| Ref     | Requirement                                                                                                               | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-2401 | Every message the system writes MUST be visible, with its state and the reason for that state.                            | 5.2   |
| FR-2402 | A queued message MUST be handed to a provider, and the provider and time MUST be recorded against it.                     | 5.2   |
| FR-2403 | An address that cannot work MUST fail once, not be retried.                                                               | 5.2   |
| FR-2404 | A transient failure MUST be retried with capped, jittered backoff, and MUST be given up on rather than retried forever.   | 5.2   |
| FR-2405 | A text MUST NOT be delivered outside sending hours; it MUST be held rather than dropped or failed.                        | 5.2   |
| FR-2406 | An address MUST be normalised at the moment of sending, not at the moment of queueing.                                    | 5.2   |
| FR-2407 | A message template MUST refuse an unknown placeholder when written and a missing value when built, never at the customer. | 5.2   |
| FR-2408 | Addresses MUST be redacted wherever they are logged or displayed on a workshop screen.                                    | 5.2   |
| FR-2409 | The transport MUST be configurable without a code change, and the configured transport MUST be stated at start-up.        | 5.2   |

## FR-2300 — The customer's own side

| Ref     | Requirement                                                                                                                   | Phase |
| ------- | ----------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-2301 | A customer MUST be able to answer a quote line by line, with nothing preselected, and MUST NOT need an account to do it.      | 5.1   |
| FR-2302 | Work not chosen MUST be recorded as declined, never left pending, and the record MUST name who agreed and from where.         | 5.1   |
| FR-2303 | A safety-critical item MUST be declinable, and the customer MUST be told in plain words what leaving it means.                | 5.1   |
| FR-2304 | A customer MUST be able to read one vehicle's full history, including what each visit cost.                                   | 5.1   |
| FR-2305 | A customer MUST be able to create and withdraw a share link for their own vehicle, and MUST see the token exactly once.       | 5.1   |
| FR-2306 | A customer MUST see every invoice across every workshop that uses Carnet, with what is outstanding stated first.              | 5.1   |
| FR-2307 | Job progress shown to a customer MUST be written in their language, never in workshop status names.                           | 5.1   |
| FR-2308 | A customer MUST NOT reach a vehicle, quote or invoice that is not theirs, and MUST meet a missing page rather than a refusal. | 5.1   |
| FR-2309 | A dead or withdrawn share link MUST say so plainly rather than erroring or returning a missing page.                          | 5.1   |

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
