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

| Capability               | Status | Where it is                                                                                                                                     |
| ------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Book an appointment      | Built  | `/portal/book`. Only times the workshop can genuinely do the work are offered, and the slot is re-checked inside the transaction that takes it. |
| Select a service         | Built  | Chosen on the booking page; the choice sets how long the slot needs to be.                                                                      |
| Select a vehicle         | Built  | Chosen on the booking page, from the vehicles that person actually owns.                                                                        |
| Receive confirmation     | Built  | Transactional email and SMS through the outbox, every message logged with delivery status (FR-1501, FR-1502).                                   |
| Receive updates          | Built  | Queued at the four stages that change something for the customer. The others are deliberately silent.                                           |
| View invoice and history | Built  | Portal invoices, and the vehicle passport as a public link (FR-1303, FR-1304, FR-1307).                                                         |
| Approve or decline work  | Built  | Estimates sent as a link, decided line by line (FR-1302, FR-802).                                                                               |
| Pay online               | Phased | FR-1309. Needs a payment provider, which is Phase 4.7 alongside point of sale.                                                                  |

## Workshop side

| Capability        | Status  | Where it is                                                                                                                                               |
| ----------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar          | Built   | `/diary`, bay lanes with per-day capacity.                                                                                                                |
| Customers         | Built   | `/customers`, with vehicles, history and balance.                                                                                                         |
| Vehicles          | Built   | `/vehicles`, with the passport, ownership and odometer history.                                                                                           |
| Work orders       | Built   | `/jobs`, fourteen statuses with guarded transitions.                                                                                                      |
| Technicians       | Built   | `/people`, attendance, pay history, productivity.                                                                                                         |
| Job cards         | Built   | `/shop`, the technician's own tablet surface.                                                                                                             |
| Parts             | Built   | `/parts`, weighted average cost, reservations, reorder.                                                                                                   |
| Inventory         | Built   | Stock levels, movements, stocktakes, transfers between sites.                                                                                             |
| Suppliers         | Built   | `/suppliers`, with bills and three-way match.                                                                                                             |
| Quotes            | Partial | Estimates are built and approved on the job. There is no standalone estimates list, which is where a workshop chases the ones nobody answered. Phase 4.7. |
| Invoices          | Built   | `/invoices`, gapless numbering, credit notes.                                                                                                             |
| Payments          | Built   | `/payments`, with allocation and aged debt.                                                                                                               |
| Service reminders | Built   | `/reminders` shows what is due, what has been sent, and which vehicles have no reachable owner.                                                           |

## ERP and business side

| Capability                 | Status  | Where it is                                                                                                                                                                                    |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounting                 | Partial | Double-entry ledger, trial balance, profit and loss, balance sheet, VAT, ageing, all posting from the work itself. Bank accounts, reconciliation and period close are Phase 4.8.               |
| Purchasing                 | Built   | Requests, approval thresholds, orders, receipt, three-way match.                                                                                                                               |
| Expenses                   | Phased  | Nothing yet. Rent and wages are posted as journal entries by hand. Capture, approval and receipts are Phase 4.8.                                                                               |
| Payroll and employees      | Partial | Employees, dated pay rates, attendance, timesheets with approval, commission. Export to a payroll provider is Phase 4.8.                                                                       |
| Inventory                  | Built   | As above, including in-transit stock between sites.                                                                                                                                            |
| Supplier management        | Built   | As above.                                                                                                                                                                                      |
| CRM                        | Phased  | Customer records, vehicles and history exist. Segments, campaigns, retention and lifetime value do not. Phase 5.                                                                               |
| Reports and analytics      | Partial | Operational reporting and financial statements are built. Revenue by service type, parts profitability by category, technician league tables, source of business and CSV export are Phase 4.7. |
| Multi-branch management    | Built   | Sites, per-site permissions, transfers, consolidated reporting with spread.                                                                                                                    |
| Users and role permissions | Built   | `/settings/team`. Invite, change a role, move somebody between sites, remove a leaver. Nobody can grant a role above their own or change their own.                                            |

---

## What this leaves

Five rows above are not fully built. They fall into three groups, and each
group is a phase rather than a backlog:

Phase 4.6 is done: inviting a colleague, changing a role, the reminders
screen, and the booking flow a customer actually walks.

**Phase 4.7 — Counter sales, reporting and the gaps.** Point of sale, the
estimates list, the reports a workshop runs on a Monday, CSV export, and taking
a card payment.

**Phase 4.8 — Expenses, banking and close.** The rest of Phase 3: expense
capture, bank accounts and reconciliation, fiscal period close, and a payroll
export.

**Phase 5 — Customer lifecycle.** CRM proper: segments, campaigns with consent,
retention and lifetime value, and the automation engine that connects a
reminder to a booking without anybody touching it.

---

## The rule this file exists to enforce

A capability is not covered because the database could support it. Sending a
service reminder has worked since Phase 1, and it is still marked partial here,
because until somebody can open a screen and see what is due, nobody can tell
whether it is working. That distinction is the difference between a system that
is finished and one that merely contains the right tables.
