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

| Capability                      | Status | Where it is                                                                                                                                                                       |
| ------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Book an appointment             | Built  | `/portal/book`. Only times the workshop can genuinely do the work are offered, and the slot is re-checked inside the transaction that takes it.                                   |
| Select a service                | Built  | Chosen on the booking page; the choice sets how long the slot needs to be.                                                                                                        |
| Select a vehicle                | Built  | Chosen on the booking page, from the vehicles that person actually owns.                                                                                                          |
| Receive confirmation            | Built  | Written to `message_logs` by the flow that caused it, then handed to a provider by the worker. Console, SMTP and Twilio transports; `/messages` shows what went and what did not. |
| Receive updates                 | Built  | Messages queued at the four stages that change something for the customer, and `/portal/updates`, where every visit says in plain words what is happening and what is owed.       |
| View invoice and history        | Built  | `/portal/invoices` across every workshop that uses Carnet, `/portal/vehicles/[id]` for one vehicle, and the passport as a public link (FR-1303, FR-1304, FR-1307).                |
| Points, referrals and passports | Built  | `/portal` shows points and a referral code per workshop; `/portal/passports` lists the customer's own passports (Phases 24, 25, 27).                                              |
| Approve or decline work         | Built  | `/e/[token]` with no account at all, or `/portal/estimates/[id]` signed in. Decided line by line, nothing preselected (FR-1302, FR-802).                                          |
| Pay online                      | Phased | FR-1309. Still the one gap on this side, and still waiting on a payment provider rather than on work.                                                                             |
| Sign up and claim a car         | Built  | `/signup/customer`, then a request by plate or VIN that the workshop which last serviced the car approves or refuses with a reason (Phase 15.1).                                  |
| Keep the paperwork              | Built  | `/portal/vehicles/[id]`: registration certificate, MOT, insurance, receipts and photographs, added by the owner or the workshop and seen by both (Phase 20).                      |

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

| Capability            | Status | Where it is                                                                                                                                                                                                               |
| --------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calendar              | Built  | `/diary`, bay lanes with per-day capacity.                                                                                                                                                                                |
| Customers             | Built  | `/customers`, with vehicles, history and balance.                                                                                                                                                                         |
| Vehicles              | Built  | `/vehicles`, with the passport, ownership and odometer history.                                                                                                                                                           |
| Passports, listed     | Built  | `/passports`: every passport the workshop wrote to, with its chain verdict (Phase 27).                                                                                                                                    |
| Loyalty and referrals | Built  | Points earned on a paid bill and spent on the invoice; codes taken at the counter and paid when earned (Phases 24, 25).                                                                                                   |
| Gift cards            | Built  | `/gift-cards`, sold as a liability and spent on the invoice (Phase 26).                                                                                                                                                   |
| Work orders           | Built  | `/jobs`, fourteen statuses with guarded transitions.                                                                                                                                                                      |
| Technicians           | Built  | `/people`, attendance, pay history, productivity.                                                                                                                                                                         |
| Job cards             | Built  | `/shop`, the technician's own tablet surface.                                                                                                                                                                             |
| Parts                 | Built  | `/parts`, weighted average cost, reservations, reorder.                                                                                                                                                                   |
| Inventory             | Built  | Stock levels, movements, stocktakes, transfers between sites.                                                                                                                                                             |
| Suppliers             | Built  | `/suppliers`, with bills and three-way match.                                                                                                                                                                             |
| Quotes                | Built  | `/estimates`, ordered by how long somebody has been waiting rather than by value.                                                                                                                                         |
| Invoices              | Built  | `/invoices`, gapless numbering, credit notes.                                                                                                                                                                             |
| Payments              | Built  | `/payments`, with allocation and aged debt.                                                                                                                                                                               |
| Service reminders     | Built  | `/reminders` shows what is due, what has been sent, and which vehicles have no reachable owner.                                                                                                                           |
| Find a vehicle        | Built  | `/vehicles/find`: a car serviced at another Carnet workshop is found by plate or VIN, taken on, and its history continued with the other workshop's detail withheld (Phase 18).                                           |
| Plan the day          | Built  | `/plan` proposes with every reason shown, and one press writes the placements into the diary (Phase 19).                                                                                                                  |
| Settings              | Built  | `/settings`: the organisation, the site and its bays and hours, tax rates, kinds of work, document prefixes and API keys, every change audited (Phase 19).                                                                |
| Ask                   | Built  | `/ask`: a closed vocabulary of questions answered from the records with the working shown; anything else refused (Phase 17).                                                                                              |
| The control tower     | Built  | `/dashboard`: the building and what blocks each car, today's hours and rota, the customers waiting, the money, the parts in the way, and what will cost something by closing time; re-reads itself while open (Phase 98). |

## ERP and business side

| Capability                 | Status  | Where it is                                                                                                                                                                                                                                                                                                |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounting                 | Built   | Double-entry ledger, trial balance, profit and loss, balance sheet, VAT, ageing, all posting from the work itself. Bank accounts, reconciliation and period close landed in Phase 4.8.                                                                                                                     |
| Purchasing                 | Built   | Requests, approval thresholds, orders, receipt, three-way match.                                                                                                                                                                                                                                           |
| Expenses                   | Built   | Capture with a category and a receipt, approval by somebody other than the claimant, input tax separated for reclaim, and money paid personally recorded as owed back rather than as leaving the bank.                                                                                                     |
| Payroll and employees      | Partial | Employees, dated pay rates, attendance, timesheets with approval, commission, and since Phase 16 a payroll run that produces one CSV row per person and posts gross wages when marked paid. Still partial because the file is Carnet's own layout; a named provider format is waiting on a named provider. |
| Inventory                  | Built   | As above, including in-transit stock between sites.                                                                                                                                                                                                                                                        |
| Supplier management        | Built   | As above.                                                                                                                                                                                                                                                                                                  |
| CRM                        | Built   | Segments with the reachable count beside the segment count, campaigns that recheck consent per recipient at the moment of sending, a permanent consent trail written by the database, retention by cohort and lifetime value.                                                                              |
| Reports and analytics      | Built   | Operational reporting, financial statements, revenue by service type with cost, parts profitability including anything sold below cost, retention against each customer's own rhythm, source of business by conversion, and hardened CSV export.                                                           |
| Multi-branch management    | Built   | Sites, per-site permissions, transfers, consolidated reporting with spread.                                                                                                                                                                                                                                |
| Users and role permissions | Built   | `/settings/team`. Invite, change a role, move somebody between sites, remove a leaver. Nobody can grant a role above their own or change their own.                                                                                                                                                        |
| Suppliers owed             | Built   | `/payables`: bills approved, disputed, paid oldest-due first with a remittance advice (Phase 16).                                                                                                                                                                                                          |
| Fleets                     | Built   | Agreements per company with discounts and terms, and one consolidated invoice per fleet per month (Phase 16).                                                                                                                                                                                              |
| API                        | Built   | `/api/v1/jobs`, `/api/v1/invoices`, `/api/v1/vehicles/{vin}` under organisation keys minted on Settings, read-only by design (Phase 18).                                                                                                                                                                   |
| Coupons                    | Built   | `/coupons`: a code worth a percentage or an amount, with a start, an end, a least bill and limits per code and per customer; taken on a bill or at the counter, refused with the promise it did not meet, and booked as what the offer cost (Phase 45.5).                                                  |
| Asked twice                | Built   | Every write that moves money or stock says what a repeat does to it, and the build fails for one that does not. A double-click, a refresh, a retried webhook or two overlapping workers cost nothing (Phase 46).                                                                                           |
| Rules that run             | Built   | Eight automation triggers fire from the moments they name, and the three that are conditions rather than events are looked for hourly. An action does what it says or fails with a reason; it is never recorded as done without having happened (Phase 46.6).                                              |
| A record put right         | Built   | An entry a workshop recorded can be corrected by a new entry that supersedes it. Both stay on the chain, the chain still verifies, and only the workshop that recorded it may correct it (Phase 46.7).                                                                                                     |

---

## What this leaves

Two rows above are not fully built: a payment link sent in a message, which
comes with conversations, and the payroll file in a provider's own layout,
which needs a named provider. Card payment itself runs against a stub
provider and Stripe behind the same seam. Everything else in these three tables is built and covered by a
verification script or a crawl, and the [feature map](09-feature-map.md)
counts the finer-grained capabilities the same way: 169 built, 3 partial, 19
missing, each named and assigned a phase.

The phases these tables were last reconciled against are 1 to 33, the last
shipped on 14 September 2026. The [roadmap](06-roadmap.md) carries a status
paragraph under each.

---

## The rule this file exists to enforce

A capability is not covered because the database could support it. Sending a
service reminder has worked since Phase 1, and it is still marked partial here,
because until somebody can open a screen and see what is due, nobody can tell
whether it is working. That distinction is the difference between a system that
is finished and one that merely contains the right tables.
