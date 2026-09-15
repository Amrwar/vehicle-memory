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

## FR-3600 — Opening a job

| Ref     | Requirement                                                                                                       | Phase |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ----- |
| FR-3601 | A job MUST be openable from a page of its own, reachable from the jobs list, a customer and a vehicle.            | 15    |
| FR-3602 | The job number MUST be allocated in the same transaction as the job, so none is taken and abandoned.              | 15    |
| FR-3603 | A mileage reading taken at booking-in MUST reach the vehicle as well as the job.                                  | 15    |
| FR-3604 | A reading below the last recorded one MUST be refused, naming both figures.                                       | 15    |
| FR-3605 | Every link in the product MUST resolve for a signed-in person; a redirect to sign-in MUST count as a broken link. | 15    |

## FR-7200 — Tax, configurable

| Ref     | Requirement                                                                                                                                                                       | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-7201 | A tax rate MUST carry one to three taxes, each with a name and a percentage and optionally charged on the price with the taxes before it, each worked out and rounded on its own. | 41    |
| FR-7202 | A workshop MUST choose whether prices are entered before tax or with tax in; with tax in, a line MUST come to its price exactly.                                                  | 41    |
| FR-7203 | A customer MUST be exemptible only with a certificate reference, their documents charging no tax and carrying the reference.                                                      | 41    |
| FR-7204 | A site MAY have its own tax rate, which every new line at that site MUST take.                                                                                                    | 41    |
| FR-7205 | Every invoice, credit note and counter sale MUST record what each tax came to when issued, and the record MUST NOT be changed.                                                    | 41    |
| FR-7206 | A report per tax MUST give, for a period and per site, what each tax was charged on, what it came to, what was given back and what is owed, from those records alone.             | 41    |
| FR-7207 | A tax rate on an issued invoice MUST NOT have its taxes changed.                                                                                                                  | 41    |

## FR-7100 — Every word translated

| Ref     | Requirement                                                                                                                                                                     | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-7101 | Every piece of text a person reads on any page, component or page title MUST pass through the translator and have a French and an Arabic translation.                           | 40.5  |
| FR-7102 | A sentence the product writes when it refuses something MUST reach the page in the reader's language, with the values in it kept and translated where they are known sentences. | 40.5  |
| FR-7103 | Dates written inside a translated sentence MUST read in the reader's language.                                                                                                  | 40.5  |
| FR-7104 | People's data (names, registrations, addresses, what staff typed) MUST NOT be translated.                                                                                       | 40.5  |
| FR-7105 | Text added outside the translator MUST be named by an automated check that fails the phase.                                                                                     | 40.5  |

## FR-7000 — The owner's day, sharpened

| Ref     | Requirement                                                                                                                                                                                                     | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-7001 | A job MUST be recordable as earlier finished work on the same vehicle coming back, within ninety days, with a stated reason, and the link MUST be removable with the removal kept in the audit log.             | 40    |
| FR-7002 | The comeback rate MUST be measured on work finished in the period, counted against the site and each technician who did the work that came back, and MUST NOT be stated as a percentage below ten jobs.         | 40    |
| FR-7003 | The reputation trend MUST compare the last ninety days with the ninety before for the workshop, each site and each technician on the rated job, naming a direction only when both have five answers.            | 40    |
| FR-7004 | Each part MUST show every active supplier side by side with last cost, times supplied, typical wait, delivery by the promised day and faulty returns, and MUST open a filled order to any of them in one press. | 40    |
| FR-7005 | Each supplier MUST show its performance quarter by quarter over a year, each measure stated only on three orders, with a sentence when it has become slower or less reliable.                                   | 40    |
| FR-7006 | The dashboard MUST give today, the business and the inventory as figures that open their records, with the business block limited to those who can read reports.                                                | 40    |

## FR-6900 — Finding anything

| Ref     | Requirement                                                                                                                                                                                           | Phase |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-6901 | One search box MUST find customers, vehicles, jobs, invoices, parts and suppliers from a plate typed with or without spacing, a VIN, a telephone number by its digits, a job, invoice or part number. | 39    |
| FR-6902 | A single exact identifier match MUST open its record directly; a name MUST never be treated as exact and MUST give a list grouped by kind, exact matches first.                                       | 39    |
| FR-6903 | Search MUST be scoped to the workshop: a vehicle MUST be found only if the workshop has worked on it or holds an unrevoked grant to it.                                                               | 39    |
| FR-6904 | A customer's decision, an inbound message, an online booking, a card payment and a part request MUST notify each member whose role would act on it, and never the person who caused it.               | 39    |
| FR-6905 | Notifications MUST be each person's own: an unread count in the navigation, unread first, mark all read, and each opening its record and marking itself read; notifying MUST never fail the event.    | 39    |

## FR-6800 — Parts back, work out

| Ref     | Requirement                                                                                                                                                                             | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-6801 | A part MUST be returnable from its order as faulty, wrong, not needed or a core, never beyond what was received less what already went back, and never beyond the shelf for a non-core. | 38    |
| FR-6802 | A non-core return MUST take the parts off the shelf with a return movement in the same transaction, and post their average cost from stock to supplier credits due.                     | 38    |
| FR-6803 | A credit note MUST be recorded once with its number, net and tax, set against the supplier's open bills oldest first, with any remainder held and set against the next bill booked.     | 38    |
| FR-6804 | The credit posting MUST clear the credit due against the payable and return the input tax, with a shortfall to stock adjustments and a core's credit to the cost of parts.              | 38    |
| FR-6805 | A refused return MUST be closed with the reason and its held value written off.                                                                                                         | 38    |
| FR-6806 | Sublet work MUST be addable to an open job with a vendor, a description, a cost and a charge, as a line the customer is invoiced on, with its margin shown.                             | 38    |
| FR-6807 | A vendor's bill for sublet work MUST be booked once, as a supplier bill, at the real cost on the line, posted to the cost of sublet work.                                               | 38    |

## FR-6700 — Languages

| Ref     | Requirement                                                                                                                                                                              | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-6701 | The product MUST be readable in English, French and Arabic, the language chosen by the person: a cookie for a year and, when signed in, saved on the account so the next device follows. | 37.5  |
| FR-6702 | The root element MUST carry the language tag and the reading direction, and Arabic MUST read right to left.                                                                              | 37.5  |
| FR-6703 | English MUST be the source of truth: a sentence with no translation MUST be shown in English, never as a key or a blank, and the coverage script MUST name it and fail.                  | 37.5  |
| FR-6704 | The switcher MUST work without a script from any page, send the person back where they were, and never off the site.                                                                     | 37.5  |
| FR-6705 | The public site, sign-in and sign-up, the customer's portal and the workshop's navigation MUST be translated in this phase; the remaining pages MUST be listed by the coverage script.   | 37.5  |

## FR-6600 — Packages and templates

| Ref     | Requirement                                                                                                                                                                                         | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-6601 | A service package MUST carry lines of labour, parts and fees, a checklist, a duration, an optional kind of work, a fixed price or the lines' sum, and an optional interval; it MUST be saved whole. | 37    |
| FR-6602 | An unsound package MUST be refused with a sentence: no name, no code, no lines, a line with no quantity, a negative price, no duration, an interval that is not a whole number, a duplicate code.   | 37    |
| FR-6603 | A job from a package MUST be one press, created with the package's lines, tasks, kind of work and time in one transaction; a package MUST be addable to an open job after what is there.            | 37    |
| FR-6604 | A booking MUST be takeable for a package, taking its time, and MUST become a job from that package when the car arrives; a bookable package MUST be offered online with its price and description.  | 37    |
| FR-6605 | Completing a job made from a recurring package MUST set the vehicle's schedule for that package to the next due date and mileage, one schedule per package per vehicle.                             | 37    |

## FR-6500 — Conversations

| Ref     | Requirement                                                                                                                                                                                              | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-6501 | Every message sent to or received from a customer MUST be filed onto one thread, the job's when it is about a job and the customer's otherwise, whatever carried it; filing MUST be idempotent.          | 36    |
| FR-6502 | Messages sent before threads existed MUST be filed a bounded batch at a time as the page is opened; a message nobody can match MUST stay in the inbox for a person, and filing by hand MUST thread it.   | 36    |
| FR-6503 | A thread MUST read oldest to newest across both directions with what became of each message; the list MUST put unread first; opening a thread MUST mark it read; a reply MUST reopen a closed thread.    | 36    |
| FR-6504 | A reply MUST be offered only on the channels the customer can be reached on, the one they last wrote on first, and MUST be refused on a channel with no address; it MUST be queued and pushed at once.   | 36    |
| FR-6505 | WhatsApp MUST be a channel through the same transport seam as texts, with the console by default and one real adapter, and MUST be accepted inbound.                                                     | 36    |
| FR-6506 | A template MUST be a sentence with facts filled from the job, refused rather than sent with a blank; a payment link MUST be one press giving the amount owed and the link, refused when nothing is owed. | 36    |
| FR-6507 | A file sent with a reply MUST be kept on the message and shown on the thread; a thread MUST be assignable to a team member and closable, with both recorded.                                             | 36    |

## FR-6400 — Arrival and departure

| Ref     | Requirement                                                                                                                                                                                              | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-6401 | A car MUST be checkable in once per job with mileage, fuel, marks already on it, belongings, the keys' hook and a signature, saved in one transaction with the reading on the vehicle and the key event. | 35    |
| FR-6402 | A mileage below the last reading MUST be refused at check-in, and below the arrival reading at check-out; fuel MUST be in eighths.                                                                       | 35    |
| FR-6403 | Photographs at either check MUST go straight to the store on a ticket and be recorded only once the store confirms them, on the check they belong to.                                                    | 35    |
| FR-6404 | A car MUST NOT be handed back before the work is marked completed, and MUST NOT leave owing money unless a reason is written down and kept on the record.                                                | 35    |
| FR-6405 | A signature MUST be a record of its own, kept as strokes with the name, the purpose, who captured it, the address and the device; a dot or an empty pad MUST be refused.                                 | 35    |
| FR-6406 | Where the keys are MUST follow from the events that moved them (hung, taken, returned, handed back), shown on the job and the technician's card, with a one-press take and return.                       | 35    |
| FR-6407 | Both checks MUST be visible to the customer on their vehicle page: when, the mileage, the fuel, how many marks, how many photographs, and who signed.                                                    | 35    |

## FR-6300 — The workflow, as one thing

| Ref     | Requirement                                                                                                                                                                                                | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-6301 | A booking MUST become a job in one press, with the customer, vehicle, description, notes, technician, bay and promised time already on it, and the booking marked converted in the same transaction.       | 34    |
| FR-6302 | An estimate raised from an inspection MUST carry its line totals and totals the moment it is raised, so it can be sent without a second step.                                                              | 34    |
| FR-6303 | A decision given in person MUST be recordable from the job in one press, under the customer's name and the recording staff member's, through the same decision the customer's own page records.            | 34    |
| FR-6304 | An approval MUST put the approved lines on the job and, for each part line naming a stock item, reserve the part or raise a purchase request for the shortfall, with nothing further pressed.              | 34    |
| FR-6305 | Extra work found mid-job MUST be quotable from the job as a supplementary estimate, sent in the same press if wanted; sending it MUST NOT stop the job, and its approval MUST NOT move the job backwards.  | 34    |
| FR-6306 | The five workflows MUST be written down hand-off by hand-off with the presses each costs and the screen it happens on; a test MUST fail if a hand-off ever costs more, and the document MUST be generated. | 34    |

## FR-6200 — Data in, data out

| Ref     | Requirement                                                                                                                                                                                         | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-6201 | A CSV from any system MUST be read as it comes (byte-order mark, either line ending, comma, semicolon or tab, quoted fields) and kept as it came, so the mapping can change and the preview re-run. | 33    |
| FR-6202 | Customers, vehicles, parts, suppliers and opening balances MUST each be importable with a mapping suggested from the headers and edited by a person, and required fields refused when unmapped.     | 33    |
| FR-6203 | Every row MUST be validated before anything is written, and every problem MUST name the spreadsheet row and the field.                                                                              | 33    |
| FR-6204 | Imported rows MUST go in through the same functions the pages use, so a duplicate is refused and not doubled, and a batch MUST never run twice; the report MUST list what did not go in and why.    | 33    |
| FR-6205 | Opening balances MUST post as one balanced entry or not at all, with the difference to retained earnings and the report saying so.                                                                  | 33    |
| FR-6206 | Every dataset a workshop owns MUST export whole, as a CSV in the shape the import reads, and the passports as JSON in the network's form, in every state of the subscription.                       | 33    |

## FR-6100 — One currency, and the customer's account

| Ref     | Requirement                                                                                                                                                                                            | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| FR-6101 | Every plan MUST have a price, paid monthly and paid annually, in every currency the country table can put a workshop in, set by hand in one price book and never by an exchange rate.                  | 32.7  |
| FR-6102 | A workshop MUST see and pay the plan in its own currency everywhere: the pricing page, the sign-up sentence, the terms, the reminder, the billing page and the provider's charge.                      | 32.7  |
| FR-6103 | The customer's portal MUST have an account page with their details, a password change that asks for the current password, and what each workshop may send them, with every change recorded as consent. | 32.7  |

## FR-6000 — The subscription, billed

| Ref     | Requirement                                                                                                                                                                                      | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| FR-6001 | The trial MUST be fourteen days, and MUST start only once a card is on file with the provider; until then the workshop MUST be read-only and the subscription page MUST say why.                 | 32.6  |
| FR-6002 | Sign-up MUST carry a required acceptance of the terms that states, beside the button, the plan, the price, the day the card is charged and how to cancel; the version accepted MUST be recorded. | 32.6  |
| FR-6003 | The card MUST be charged automatically when the trial ends unless the workshop cancelled before, and the owner MUST be reminded by email three days before, once, with the amount and the date.  | 32.6  |
| FR-6004 | A paid charge MUST make the workshop active and tell the owner; a failed charge MUST leave it writing, mark it past due, and tell the owner; nothing is deleted in any state.                    | 32.6  |
| FR-6005 | The billing page MUST show the card on file, the next charge as a date and an amount, the plan's price times the bays, the provider's invoices, and a way to change the card.                    | 32.6  |
| FR-6006 | Cancelling MUST take two presses; on a plan it MUST end at the end of the period paid for and keep the workshop open until then; on a trial it MUST end at once and charge nothing.              | 32.6  |
| FR-6007 | The provider's subscription and invoice events MUST be verified, applied once, and followed by asking the provider for the whole record rather than trusting a partial event.                    | 32.6  |

## FR-5900 — Card payment through a provider

| Ref     | Requirement                                                                                                                                                                                                                 | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-5901 | A payment provider MUST sit behind one seam of four calls (open a checkout, ask what became of it, refund, read a webhook), with a stub that behaves like a real one and a real adapter behind the same seam.               | 32    |
| FR-5902 | An outstanding invoice in the portal MUST offer "Pay now", and MUST refuse a paid, draft or void invoice, nothing, more than is owed, and another customer's invoice, each with a sentence.                                 | 32    |
| FR-5903 | An attempt MUST move once from pending to succeeded, failed with the provider's reason, or cancelled, and never back; a failed payment MUST be a row with its reason, not an absence.                                       | 32    |
| FR-5904 | A succeeded attempt MUST record the payment and its posting exactly once, however many times and by whichever route the provider says so.                                                                                   | 32    |
| FR-5905 | A refund by card MUST go back through the provider that took the money, asked before anything is recorded, and MUST be refused where no card payment through the provider has that much left.                               | 32    |
| FR-5906 | Reconciliation MUST compare the provider's record with ours for every recent attempt and name each difference (paid there not here, here not there, amount, currency, unknown, pending too long) without changing anything. | 32    |
| FR-5907 | The webhook MUST fail closed: unsigned or wrongly signed is refused, an event for a checkout we do not know is acknowledged and ignored, a replay changes nothing.                                                          | 32    |

## FR-5800 — Permissions at the resource, and the plan enforced

| Ref     | Requirement                                                                                                                                                                                            | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| FR-5801 | Every page and server action MUST ask for a permission, an action that writes MUST ask for a writing one, and a script MUST read every action and fail on one that writes behind a reading permission. | 31    |
| FR-5802 | Every workshop page MUST be tried as every role by a script and the answer MUST match the role table; a technician MUST be turned back to their own surface before any workshop page runs.             | 31    |
| FR-5803 | Another organisation's record asked for by id MUST be not found, never refused, and a machine route with nothing in hand MUST answer 401.                                                              | 31    |
| FR-5804 | A plan's limit MUST be enforced where the thing is made, and the refusal MUST carry the number and the plan that raises it.                                                                            | 31    |
| FR-5805 | A plan's feature MUST be enforced where it is used, and the refusal MUST name the plan that includes it.                                                                                               | 31    |
| FR-5806 | An organisation MUST have a subscription state read from four dates and never stored: on trial, grace, on a plan, read-only, cancelled; nothing is deleted in any state.                               | 31    |
| FR-5807 | A read-only workshop MUST keep reading and exporting and lose writing, the refusal MUST land on the page that says why, and choosing a plan MUST reopen it.                                            | 31    |

## FR-5700 — Money owed ahead

| Ref     | Requirement                                                                                                                                                            | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-5701 | A deposit MUST be takeable before the work, for a customer and optionally a job, paid with money, and MUST post as a liability and never as revenue.                   | 30    |
| FR-5702 | What is held MUST be what came in less what went against bills or back, never a stored figure, and every movement MUST say what it was for.                            | 30    |
| FR-5703 | Money held MUST go against an invoice as a payment of its own kind that releases the liability without touching the bank, oldest first, refused rather than clamped.   | 30    |
| FR-5704 | A refund MUST be keepable as credit on the customer's account, which the next bill can take.                                                                           | 30    |
| FR-5705 | Money held MUST be returnable with a reason, the way money goes, and never more than is held.                                                                          | 30    |
| FR-5706 | Every payment MUST produce a receipt: sent to the customer where there is an address, and printable, naming who paid, how much, how, for what, and what is still owed. | 30    |

## FR-5600 — Country and currency

| Ref     | Requirement                                                                                                                                                        | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| FR-5601 | A workshop MUST have one country, one currency, one language and region, and one timezone, chosen at sign-up from a country and editable in settings by the owner. | 29    |
| FR-5602 | Sign-up MUST derive the currency, locale, timezone and the first tax rate from the country, and the site MUST follow.                                              | 29    |
| FR-5603 | Every figure and date a member of staff sees MUST be formatted from the organisation's region, never from a default.                                               | 29    |
| FR-5604 | A driver in the portal MUST see each amount in the currency of the workshop that raised it, and dates in the region of the workshop they use most.                 | 29    |
| FR-5605 | A message the product writes to a customer MUST format money and dates in the workshop's region.                                                                   | 29    |
| FR-5606 | Changing the currency in settings MUST NOT convert anything already recorded, and the page MUST say so.                                                            | 29    |

## FR-5500 — Gift cards, deepened

| Ref     | Requirement                                                                                                                                                                        | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-5501 | Every movement on a card MUST be typed as an issue, a redemption, a refund or an adjustment, and the database MUST refuse a kind whose sign disagrees with it.                     | 28    |
| FR-5502 | A card's status MUST be read from its facts, never stored: active, spent, lapsed or cancelled, with cancelled winning over all.                                                    | 28    |
| FR-5503 | A card MAY be sold with a term of a year or two years, defaulting to no term, and MAY be tied to one site; a lapsed card or one at the wrong site MUST be refused with a sentence. | 28    |
| FR-5504 | A gift card MUST be a tender at the counter, spent inside the sale's own transaction, posted as the liability released and never as cash taken.                                    | 28    |
| FR-5505 | A refund by method gift card MUST put the money back on the card that paid the bill, and MUST be refused when no card paid it or that card was cancelled.                          | 28    |
| FR-5506 | A person MUST be able to add to or take off a card with a reason, never below nothing, booked as goodwill or sundry income by the same amount.                                     | 28    |
| FR-5507 | A card MUST be cancellable with a reason, writing off what was on it, after which it MUST refuse every use and every change.                                                       | 28    |

## FR-5400 — The passport, listed

| Ref     | Requirement                                                                                                                                                                                                                          | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| FR-5401 | A workshop MUST be able to see every passport it has written to or been granted in one list, with the entry count, the number of contributing workshops, the span of dates and the chain verdict, and no vehicle it has no claim on. | 27    |
| FR-5402 | The chain verdict on the list MUST be computed from the entries on request, never stored.                                                                                                                                            | 27    |
| FR-5403 | A customer signed into the portal MUST see the passports of the vehicles they own now, and not of one they have sold, each opening onto the passport and onto sharing it.                                                            | 27    |
| FR-5404 | The site MUST carry a favicon and a home-screen icon drawn from the passport's own emblem.                                                                                                                                           | 27    |

## FR-5300 — Gift cards

| Ref     | Requirement                                                                                                                                                                    | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| FR-5301 | A gift card MUST be sold for whole pounds between a floor and a ceiling, paid for with money, and MUST NOT be bought with points or with another card.                         | 26    |
| FR-5302 | A card sold MUST be posted as money in and a liability, never as revenue; a card redeemed MUST release that liability against what the customer owed, never touching the bank. | 26    |
| FR-5303 | A card MUST carry a number a person can read out, from an alphabet with nothing that is misheard, and MUST be found however it is typed.                                       | 26    |
| FR-5304 | A card MUST be redeemable on an invoice for a stated amount or, left blank, for as much as the bill needs; more than is on the card or more than is owed MUST be refused.      | 26    |
| FR-5305 | The balance MUST be the sum of the card's entries, each naming what it was for, and MUST be readable per card with every movement on it.                                       | 26    |
| FR-5306 | The gift cards page MUST lead with what the workshop owes as work, and MUST show every card with what is left on it.                                                           | 26    |

## FR-5200 — Referrals, in the product

| Ref     | Requirement                                                                                                                                                                           | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-5201 | Every customer MUST have a referral code, made once and kept until used, shown on their page and in the portal beside the rule for what it pays and when.                             | 25    |
| FR-5202 | A code MUST be taken at the counter on a new customer or an existing one, however it is typed, and MUST be refused with a sentence when unknown, already used, or the customer's own. | 25    |
| FR-5203 | A customer MUST be introduced at most once; a second code for the same person MUST be refused.                                                                                        | 25    |
| FR-5204 | Both sides MUST be credited once, in one transaction, only once the newcomer's bills reach the minimum, and MUST NOT be credited on a sign-up.                                        | 25    |
| FR-5205 | Crediting MUST happen at the moment the bill that reaches the minimum is paid, without anybody pressing anything, and a code remembered after that point MUST pay at once.            | 25    |
| FR-5206 | The customer's page MUST show who introduced them and whom they introduced, each with whether it has been paid or what it waits on.                                                   | 25    |

## FR-5100 — Points, and the public face

| Ref     | Requirement                                                                                                                                                                                                           | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-5101 | A bill paid in full MUST earn a point a pound, floored, on the money the customer actually paid, once, however many payments settle it and whichever of them settles it.                                              | 24    |
| FR-5102 | Points MUST come off a bill as a payment of their own kind, and the ledger MUST book that payment as the cost of the programme against what the customer owed, never as money into the bank.                          | 24    |
| FR-5103 | A redemption MUST be refused with a sentence when the customer holds fewer points than asked, when the points are worth more than is owed, or when the bill could not take any payment; a refusal MUST spend nothing. | 24    |
| FR-5104 | Staff MUST be able to give points by hand, as a whole number with a reason, and the reason MUST be what the customer reads.                                                                                           | 24    |
| FR-5105 | The customer's page MUST show the balance as the sum of the entries, what it is worth, what is about to lapse and when, and the recent entries.                                                                       | 24    |
| FR-5106 | A customer signed into the portal MUST see their points at each workshop that holds any, with what they are worth there and when they lapse, and nothing where they hold none.                                        | 24    |
| FR-5107 | An organisation whose chart of accounts predates an account the standard chart later gained MUST receive that account the first time it is needed, without touching the accounts it has.                              | 24    |

## FR-5000 — The passport, designed

| Ref     | Requirement                                                                                                                                                                                   | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-5001 | The shared passport, the owner's copy and the workshop's preview MUST be rendered by one component, so every reader sees the same document.                                                   | 23    |
| FR-5002 | The identity page MUST carry a machine-readable zone of two forty-four character lines with ICAO 9303 check digits that verify.                                                               | 23    |
| FR-5003 | Every entry MUST be shown as a stamp naming who recorded it, its kind, date and mileage, inked by verification level, with its kind also in words; a superseded entry MUST read as cancelled. | 23    |
| FR-5004 | No owner MUST be named anywhere on the document, including on a transfer stamp whose underlying entry names the parties.                                                                      | 23    |
| FR-5005 | A shared passport MUST offer a way back: the browser's history when the reader came from this site, the front door otherwise.                                                                 | 23    |
| FR-5006 | The home page MUST open with an openable passport whose contents are also present as text and real buttons, and which respects a request for reduced motion.                                  | 23    |

## FR-4900 — The assistant inside the workflow

| Ref     | Requirement                                                                                                                                                                                           | Phase |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-4901 | From a job's page a person MUST be able to have the job's state read back in sentences that name what is blocking first, composed from the job's own records.                                         | 22    |
| FR-4902 | From a job's page a person MUST be able to draft a progress update, a request for a decision or a ready-for-collection message from the job's facts, and no figure in it MUST be absent from the job. | 22    |
| FR-4903 | A drafted message MUST be sent only by a person's press, as edited on the screen, to the customer's own number or address, and MUST NOT be sent twice.                                                | 22    |
| FR-4904 | Every exchange with the assistant MUST be recorded with who asked, its kind, the words shown, whether a model touched them, and the tokens used, and MUST be audited.                                 | 22    |
| FR-4905 | Each organisation MUST have a monthly token budget the owner sets, zero MUST switch the model off, and a spent budget MUST fall back to the plain text rather than refuse.                            | 22    |
| FR-4906 | A model's version of any text MUST be used only if every number and code in it is on the record; otherwise the plain version MUST be used and the reason shown.                                       | 22    |
| FR-4907 | A question asked through the assistant MUST be routed exactly as the Ask page routes it and MUST reach the same figure.                                                                               | 22    |

## FR-4800 — Before general availability

| Ref     | Requirement                                                                                                                                                                                                                                     | Phase |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-4801 | Every page response MUST carry a Content Security Policy that runs scripts only with a per-request nonce, forbids inline scripts without it, and sets object-src, base-uri and frame-ancestors.                                                 | 21    |
| FR-4802 | A password that appears in a known breach MUST be refused at sign-up, customer sign-up and reset, checked by k-anonymity so the password never leaves the server, and the check MUST fail open with a log line when the service is unreachable. | 21    |
| FR-4803 | An organisation API key MUST be limited to a fixed number of calls per hour, and a call beyond it MUST be answered 429 with Retry-After and a reason.                                                                                           | 21    |
| FR-4804 | A backup MUST be restored into a fresh database and compared with the original row for row and chain for chain by an automated drill that runs in CI, using the server's own tools.                                                             | 21    |
| FR-4805 | The API MUST be described by a document generated from a registry beside its handlers, served by the API itself, committed to docs, and CI MUST fail when a handler has no entry or the copy is behind.                                         | 21    |
| FR-4806 | The security headers the security model lists MUST be present on every response and checked by a probe against the running application.                                                                                                         | 21    |

## FR-4700 — The vehicle's paperwork

| Ref     | Requirement                                                                                                                                                                                             | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-4701 | A vehicle MUST carry documents by kind (photograph, registration certificate, MOT certificate, insurance, service record, purchase invoice, other), each titled, with an optional reference and expiry. | 20    |
| FR-4702 | A document MUST be readable and addable by any workshop entitled to read the vehicle and by its current owner, and MUST be invisible to anybody else rather than refused.                               | 20    |
| FR-4703 | A document MUST be a PDF or a picture of the paper, a photograph MUST be a picture, an untitled or oversized file MUST be refused with the reason, and an expiry before the issue MUST be refused.      | 20    |
| FR-4704 | The file MUST be stored before the row is recorded, and the row MUST name what was stored, its size and who added it.                                                                                   | 20    |
| FR-4705 | The latest live MOT and insurance MUST decide the vehicle's cover, an older certificate MUST NOT count as a lapse, and paperwork running out MUST be listed with the service reminders.                 | 20    |
| FR-4706 | A customer MAY name a preferred technician, who MUST be a technician of the workshop, and the preference MUST be preselected when a job is opened for that customer.                                    | 20    |
| FR-4707 | A document MUST be removable only by the workshop that added it or the vehicle's owner, MUST require a reason, and MUST keep its row with the reason.                                                   | 20    |
| FR-4708 | Every addition and removal of a document MUST be audited, and the API's vehicle endpoint MUST return the documents with links that expire.                                                              | 20    |

## FR-4600 — The workshop configures itself

| Ref     | Requirement                                                                                                                                                                                                                 | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-4601 | An owner MUST be able to change the organisation's trading and legal names, tax number, contact details and re-approval threshold, and a threshold outside 0 to 100 MUST be refused.                                        | 19    |
| FR-4602 | An owner MUST be able to change the site's name, code, address, telephone and daily capacity, and a code MUST be normalised to letters and digits the diary can show.                                                       | 19    |
| FR-4603 | A site MUST carry opening hours that open before they close, and planning MUST place work inside them rather than inside hours assumed in code.                                                                             | 19    |
| FR-4604 | Bays, tax rates and kinds of work MUST be added, edited and retired but never deleted, a retired one MUST take no new work and keep reading the same on old work, and a duplicate MUST be refused.                          | 19    |
| FR-4605 | There MUST be exactly one default tax rate at any time, the default MUST NOT be retired, and a rate that has been invoiced MUST NOT have its percentage changed.                                                            | 19    |
| FR-4606 | Accepting the day's plan MUST write one booking per placed job with the plan's technician, bay and times, MUST move rather than duplicate on a second acceptance, and the next proposal MUST treat those bookings as fixed. | 19    |
| FR-4607 | A document prefix MUST be changeable and MUST apply only from the next number; the counter MUST NOT be changeable.                                                                                                          | 19    |
| FR-4608 | Every settings change and every plan acceptance MUST be audited with who, when, what it was and what it became.                                                                                                             | 19    |

## FR-4500 — The network

| Ref     | Requirement                                                                                                                                                                                                  | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| FR-4501 | A vehicle MUST be findable across the network by registration or VIN, and a registration that has been on more than one vehicle MUST be refused with the VIN named as the way in.                            | 18    |
| FR-4502 | Before a workshop takes a vehicle on it MUST be told that history exists, how many entries there are and which workshops kept them, and MUST NOT be shown the entries.                                       | 18    |
| FR-4503 | Taking a vehicle on MUST grant read access on the grounds it is to be serviced, opening a job MUST widen that to write, and both MUST be audited.                                                            | 18    |
| FR-4504 | Another workshop's entries MUST be shown with its commercial detail withheld: job identifiers, internal job numbers and named staff. Nothing about the vehicle itself MUST be withheld.                      | 18    |
| FR-4505 | What a second workshop records MUST continue the vehicle's one chain, verifiable end to end, and MUST NOT start a second history for the same VIN.                                                           | 18    |
| FR-4506 | A vehicle new to the network MUST be added by VIN; a VIN already on the network MUST be refused with the way in; a VIN whose check digit does not add up MUST be recorded as typed and flagged, not refused. | 18    |
| FR-4507 | An API key MUST belong to one organisation, MUST be shown exactly once, MUST be stored only as a digest, and MUST be revocable in a list that names it and shows when it was last used.                      | 18    |
| FR-4508 | The API MUST read only what the organisation is entitled to see, with the same withholding as the page, and a vehicle outside that entitlement MUST be not found rather than forbidden.                      | 18    |
| FR-4509 | Every collection endpoint MUST be bounded by a time window and a row cap, and a revoked or unknown key MUST read nothing.                                                                                    | 18    |

## FR-4400 — Answers rather than pages

| Ref     | Requirement                                                                                                                                              | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-4401 | A question in words MUST be routed to an existing calculation, never interpreted by a model, and the vocabulary MUST be published on the page.           | 17    |
| FR-4402 | Every answer MUST show its working as steps and link to the page that computes the same figure.                                                          | 17    |
| FR-4403 | A question outside the vocabulary MUST be refused with a plain statement and the list of what can be asked, never guessed at.                            | 17    |
| FR-4404 | Revenue observations MUST be arithmetic with a sentence around it, and MUST NOT state a comparison when either side has fewer than five jobs.            | 17    |
| FR-4405 | A customer summary MUST be composed from the job's own lines, parts, findings and declined items, and MUST contain no reassurance that is not a finding. | 17    |
| FR-4406 | Where a model tidies the summary, its output MUST be checked so every number and part number appears on the job, or the plain text MUST be used.         | 17    |
| FR-4407 | Generated text MUST decide nothing: no status, posting or message MUST result from it without a person's action.                                         | 17    |
| FR-4408 | Fault suggestion MUST NOT be offered until a corpus of symptoms against confirmed causes exists, and the interface MUST say so.                          | 17    |

## FR-4300 — Suppliers, payroll and fleets

| Ref     | Requirement                                                                                                                                                               | Phase |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-4301 | A supplier's bill MUST be booked against a purchase order with the supplier's own reference, once, and MUST enter payables in the ledger.                                 | 16    |
| FR-4302 | A bill MUST be approved by a person before it can be paid, and a disputed bill MUST NOT be paid until it is approved again.                                               | 16    |
| FR-4303 | A supplier payment MUST allocate across that supplier's approved bills oldest-due first, MUST NOT exceed any bill, and every penny MUST land on a bill.                   | 16    |
| FR-4304 | Paying a supplier MUST post payable down and bank or cash down, and MUST send the supplier a remittance advice naming each bill and amount.                               | 16    |
| FR-4305 | A period's approved timesheets MUST be handed to payroll as one run producing a CSV with one row per person, and the same sheet MUST NOT be run twice.                    | 16    |
| FR-4306 | The payroll file MUST carry reference, name, period, ordinary and overtime hours and gross pay, and MUST keep a leading zero on the reference.                            | 16    |
| FR-4307 | Marking a run paid MUST mark every sheet on it paid, MUST post gross wages against the bank, and MUST require the run to have been exported first.                        | 16    |
| FR-4308 | A fleet agreement MUST be for a company customer, with percentage discounts on labour and parts, payment terms, and whether a PO number is required.                      | 16    |
| FR-4309 | A consolidated invoice MUST cover a calendar month's completed, uninvoiced jobs for one fleet, apply the agreed discount at invoice time, and name the job on every line. | 16    |
| FR-4310 | Consolidation MUST refuse a job with no purchase order number when the agreement requires one, naming the job.                                                            | 16    |

## FR-4200 — The money cycle

| Ref     | Requirement                                                                                                                                        | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-4201 | A job MUST be movable through its lifecycle from the job page, with the lifecycle's own refusals shown verbatim.                                   | 16    |
| FR-4202 | Completing a job MUST consume its parts at weighted average cost, write that cost back to the lines, post the consumption, and write the passport. | 16    |
| FR-4203 | Approving an estimate MUST place the approved lines on the job, once, and never overwrite lines already there.                                     | 16    |
| FR-4204 | An invoice MUST be issued only from a completed, priced, uninvoiced job, numbered from the sequence, with revenue posted by line kind.             | 16    |
| FR-4205 | Issuing an invoice MUST move the job to invoiced in the same transaction and tell the customer, naming the invoice.                                | 16    |
| FR-4206 | A payment MUST never exceed what is outstanding, MUST post to the account for its method, and MUST settle the job when it settles the invoice.     | 16    |
| FR-4207 | A credit note MUST carry a reason, MUST NOT exceed the invoice total less earlier credits, and MUST reverse revenue and tax in proportion.         | 16    |
| FR-4208 | A refund MUST be for the lesser of what was paid and what was credited, less earlier refunds, and MUST clear receivable rather than revenue.       | 16    |
| FR-4209 | The trial balance MUST balance after every step of the cycle.                                                                                      | 16    |

## FR-4100 — Customers with accounts, and the buttons that led nowhere

| Ref     | Requirement                                                                                                                                    | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-4101 | A driver MUST be able to create an account with no workshop involved, and that account MUST start with no vehicles on it.                      | 15.1  |
| FR-4102 | A vehicle MUST reach a self-registered account only through a request a person at the workshop that last serviced it approves.                 | 15.1  |
| FR-4103 | A request MUST accept a plate or a VIN however typed, MUST refuse when the plate has been on more than one vehicle, and MUST be an index seek. | 15.1  |
| FR-4104 | A refusal MUST say why, MUST be recorded by whom and when, and a request MUST NOT be answered twice.                                           | 15.1  |
| FR-4105 | A pending request MUST NOT reveal which workshop is considering it, and a person MUST NOT hold more than three open requests.                  | 15.1  |
| FR-4106 | A workshop owner whose address is unproven MUST be held at a confirmation page and MUST NOT reach any workshop screen.                         | 15.1  |
| FR-4107 | A message a person is waiting on MUST be pushed to the provider immediately after it is queued, with the queue remaining the record.           | 15.1  |
| FR-4108 | A customer MUST be creatable from the product with a name and one way to reach them, and a likely duplicate MUST be shown before saving.       | 15.1  |
| FR-4109 | A part MUST be creatable from the product, its number normalised, a duplicate number refused, and a stocked part given a stock row.            | 15.1  |
| FR-4110 | A purchase order MUST be creatable by hand as a draft, numbered from the sequence, with blank lines dropped and a nothing-order refused.       | 15.1  |
| FR-4111 | A quote MUST be sendable to the customer by a single-use link whose digest alone is stored, MUST NOT be sent twice, and MUST move the job.     | 15.1  |
| FR-4112 | Inviting a colleague MUST queue the invitation email the page says is on its way.                                                              | 15.1  |
| FR-4113 | A campaign message MUST be addressed to the customer's mailbox or number, and a consenting customer with neither MUST be recorded as held.     | 15.1  |
| FR-4114 | The link checker MUST detect a page that does not exist by the framework's not-found signal, not by the status code.                           | 15.1  |

## FR-4000 — After a message leaves

| Ref     | Requirement                                                                                                | Phase |
| ------- | ---------------------------------------------------------------------------------------------------------- | ----- |
| FR-4001 | Delivery, bounce and complaint events MUST be recorded against the message they concern.                   | 17    |
| FR-4002 | A permanent bounce MUST suppress the address; a temporary one MUST NOT.                                    | 17    |
| FR-4003 | A spam complaint MUST suppress the address and withdraw marketing consent on every channel.                | 17    |
| FR-4004 | A suppression MUST only be lifted by a person, with a stated reason.                                       | 17    |
| FR-4005 | The send path MUST consult suppressions at the moment of sending, not when the message was queued.         | 17    |
| FR-4006 | A webhook delivered twice MUST produce one event and suppress once.                                        | 17    |
| FR-4007 | An event MUST NOT downgrade a message that has already been delivered.                                     | 17    |
| FR-4008 | Each message MUST carry a reply address routing to the workshop that sent it, not to the sending identity. | 17    |

## FR-3900 — Getting in, and proving the address

| Ref     | Requirement                                                                                                                                                          | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-3901 | A password reset MUST answer identically whether or not the address has an account.                                                                                  | 16    |
| FR-3902 | A reset link MUST be single use, MUST expire within an hour, and MUST end every session when redeemed.                                                               | 16    |
| FR-3903 | Issuing a link MUST retire any previous live one for the same person and purpose.                                                                                    | 16    |
| FR-3904 | An unverified address MUST be surfaced with what is actually lost. A driver's account MUST stay usable; a workshop owner's is held at a confirmation page (FR-4106). | 16    |
| FR-3905 | A verification link MUST last three days, and opening it twice MUST NOT read as an error.                                                                            | 16    |
| FR-3906 | A new password MUST meet a stated length and MUST NOT contain the address it protects or an obvious word.                                                            | 16    |
| FR-3907 | Requests MUST be rate limited per person per hour, and the limit MUST NOT reveal that the address exists.                                                            | 16    |
| FR-3908 | Only the digest of a link MUST be stored.                                                                                                                            | 16    |

## FR-3800 — Mail coming back

| Ref     | Requirement                                                                                                    | Phase |
| ------- | -------------------------------------------------------------------------------------------------------------- | ----- |
| FR-3801 | Inbound mail MUST be accepted from a provider webhook whose signature is verified over the exact request body. | 16    |
| FR-3802 | A replayed webhook MUST be refused on its timestamp even with a valid signature.                               | 16    |
| FR-3803 | The workshop a message belongs to MUST be read from the recipient address, never from the body.                | 16    |
| FR-3804 | With no webhook secret configured, inbound mail MUST be refused rather than accepted.                          | 16    |

## FR-3700 — What people say afterwards

| Ref     | Requirement                                                                                                           | Phase |
| ------- | --------------------------------------------------------------------------------------------------------------------- | ----- |
| FR-3701 | The system MUST ask how a job went, and MUST NOT ask twice about one job or twice in a quiet period.                  | 15    |
| FR-3702 | A rating MUST be routed: a top rating invited to say so publicly, anything lower opening a private conversation.      | 15    |
| FR-3703 | Every customer not asked MUST be listed with the reason, so a low count is explained rather than mysterious.          | 15    |
| FR-3704 | Satisfaction MUST NOT be averaged below a stated minimum number of answers.                                           | 15    |
| FR-3705 | A reply from a customer MUST be received, matched with a stated confidence, and never filed silently against a guess. | 15    |
| FR-3706 | The inbox MUST be ordered by what has to be acted on, not by arrival, and MUST NOT act on anything automatically.     | 15    |
| FR-3707 | A message delivered twice by a provider MUST be one row.                                                              | 15    |
| FR-3708 | Loyalty points MUST be the sum of their entries, MUST be whole, and MUST be floored on both earning and redemption.   | 15    |
| FR-3709 | A referral MUST credit both sides exactly once, MUST refuse a self-referral, and MUST pay only after real spending.   | 15    |

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
