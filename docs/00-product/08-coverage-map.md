# Coverage map

Every capability the product is expected to have, and where it actually
stands. Three columns of a workshop system: what the customer touches, what
the workshop runs on, and what the business is managed by.

**How to read the status.** _Built_ means it is in the product now and covered
by an automated check. _Partial_ means some of it exists and the rest is named
below. _Phased_ means it is scheduled and not started. A row is never marked
built because the data model supports it; the question is whether somebody can
do the thing.

This file is the answer to "is everything covered?", and it is kept honest by
being specific about the gaps rather than generous about the ticks.

---

## Customer-facing side

| Capability               | Status | Where it is                                                                                                                                                                       |
| ------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Book an appointment      | Built  | `/portal/book`. Only times the workshop can genuinely do the work are offered, and the slot is re-checked inside the transaction that takes it.                                   |
| Select a service         | Built  | Chosen on the booking page; the choice sets how long the slot needs to be.                                                                                                        |
| Select a vehicle         | Built  | Chosen on the booking page, from the vehicles that person actually owns.                                                                                                          |
| Receive confirmation     | Built  | Written to `message_logs` by the flow that caused it, then handed to a provider by the worker. Console, SMTP and Twilio transports; `/messages` shows what went and what did not. |
| Receive updates          | Built  | Messages queued at the four stages that change something for the customer, and `/portal/updates`, where every visit says in plain words what is happening and what is owed.       |
| View invoice and history | Built  | `/portal/invoices` across every workshop that uses Carnet, `/portal/vehicles/[id]` for one vehicle, and the passport as a public link (FR-1303, FR-1304, FR-1307).                |
| Approve or decline work  | Built  | `/e/[token]` with no account at all, or `/portal/estimates/[id]` signed in. Decided line by line, nothing preselected (FR-1302, FR-802).                                          |
| Pay online               | Phased | FR-1309. Still the one gap on this side, and still waiting on a payment provider rather than on work.                                                                             |

**A second correction, found later.** "Receive confirmation" and "Receive
updates" were both marked built on the strength of rows appearing in
`message_logs`. Nothing ever read that table. Every confirmation, reminder,
quote link and automation action the product had "sent" since Phase 1 was
sitting in it unsent, and nothing anywhere reported a problem, because from
the writing side everything had worked. Sending is now real, and
`verify:messaging` puts a message in and asserts it comes out.

**A correction.** Three rows in this table were marked built before they were.
"View invoice and history" cited portal invoices, and there was no such page.
"Approve or decline work" cited a link decided line by line, and the route it
named returned a 404. "Receive updates" counted queued messages as a surface,
which they are not.

The rows had been written from the data model rather than from the product,
which is exactly what the note at the top of this file says never to do. All
three are now genuinely built and covered by the smoke test, but the lesson is
the part worth keeping: a row is built when somebody can do the thing, and the
way to find that out is to press the button rather than to read the schema.

## Workshop side

| Capability        | Status | Where it is                                                                                     |
| ----------------- | ------ | ----------------------------------------------------------------------------------------------- |
| Calendar          | Built  | `/diary`, bay lanes with per-day capacity.                                                      |
| Customers         | Built  | `/customers`, with vehicles, history and balance.                                               |
| Vehicles          | Built  | `/vehicles`, with the passport, ownership and odometer history.                                 |
| Work orders       | Built  | `/jobs`, fourteen statuses with guarded transitions.                                            |
| Technicians       | Built  | `/people`, attendance, pay history, productivity.                                               |
| Job cards         | Built  | `/shop`, the technician's own tablet surface.                                                   |
| Parts             | Built  | `/parts`, weighted average cost, reservations, reorder.                                         |
| Inventory         | Built  | Stock levels, movements, stocktakes, transfers between sites.                                   |
| Suppliers         | Built  | `/suppliers`, with bills and three-way match.                                                   |
| Quotes            | Built  | `/estimates`, ordered by how long somebody has been waiting rather than by value.               |
| Invoices          | Built  | `/invoices`, gapless numbering, credit notes.                                                   |
| Payments          | Built  | `/payments`, with allocation and aged debt.                                                     |
| Service reminders | Built  | `/reminders` shows what is due, what has been sent, and which vehicles have no reachable owner. |

## ERP and business side

| Capability                 | Status  | Where it is                                                                                                                                                                                                                                      |
| -------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Accounting                 | Built   | Double-entry ledger, trial balance, profit and loss, balance sheet, VAT, ageing, all posting from the work itself. Bank accounts, reconciliation and period close landed in Phase 4.8.                                                           |
| Purchasing                 | Built   | Requests, approval thresholds, orders, receipt, three-way match.                                                                                                                                                                                 |
| Expenses                   | Built   | Capture with a category and a receipt, approval by somebody other than the claimant, input tax separated for reclaim, and money paid personally recorded as owed back rather than as leaving the bank.                                           |
| Payroll and employees      | Partial | Employees, dated pay rates, attendance, timesheets with approval, commission. Export to a payroll provider still needs a named target format, and inventing one produces a file nobody accepts.                                                  |
| Inventory                  | Built   | As above, including in-transit stock between sites.                                                                                                                                                                                              |
| Supplier management        | Built   | As above.                                                                                                                                                                                                                                        |
| CRM                        | Built   | Segments with the reachable count beside the segment count, campaigns that recheck consent per recipient at the moment of sending, a permanent consent trail written by the database, retention by cohort and lifetime value.                    |
| Reports and analytics      | Built   | Operational reporting, financial statements, revenue by service type with cost, parts profitability including anything sold below cost, retention against each customer's own rhythm, source of business by conversion, and hardened CSV export. |
| Multi-branch management    | Built   | Sites, per-site permissions, transfers, consolidated reporting with spread.                                                                                                                                                                      |
| Users and role permissions | Built   | `/settings/team`. Invite, change a role, move somebody between sites, remove a leaver. Nobody can grant a role above their own or change their own.                                                                                              |

---

## What this leaves

Two rows above are not fully built, and both are waiting on a third party
rather than on work:

Phase 4.6 is done: inviting a colleague, changing a role, the reminders
screen, and the booking flow a customer actually walks.

Phase 4.7 is done apart from taking a card payment, which is waiting on a
provider: point of sale, the estimates list, business reporting and CSV export.

Phase 4.8 is done apart from the payroll export, which is waiting on a named
provider format: expense capture, bank reconciliation and period close.

Phase 5 is done: the automation engine, CRM with per-channel consent and a
permanent consent trail, retention by cohort, and suggestions drawn from a
vehicle's own history when it arrives.

**Phase 5 — Customer lifecycle. Done.** CRM proper: segments, campaigns with
consent, retention and lifetime value, and the automation engine that connects a
reminder to a booking without anybody touching it.

---

## The rule this file exists to enforce

A capability is not covered because the database could support it. Sending a
service reminder has worked since Phase 1, and it is still marked partial here,
because until somebody can open a screen and see what is due, nobody can tell
whether it is working. That distinction is the difference between a system that
is finished and one that merely contains the right tables.
