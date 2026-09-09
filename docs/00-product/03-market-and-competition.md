# Market and Competition

## 1. Who we are competing with

| Category | Examples | What they do well | Where they leave room |
| --- | --- | --- | --- |
| **Workshop management SaaS** | MechanicDesk, Garage Hive, Tekmetric, Shopmonkey | Booking, job cards, invoicing, stock. Mature, well supported. | Data ends at the tenant boundary. Accounting is an export, not a ledger. Customer is a phone number, not a participant. |
| **Vehicle history reports** | Carfax, HPI, CarVertical | Trusted brand at the point of sale. Institutional data sources. | Blind to independent-workshop maintenance, which is most maintenance. Read-only. No relationship with the workshops generating the facts. |
| **Accounting packages** | Xero, QuickBooks | Real double-entry, accountant-approved. | Know nothing about a job, a part or a vehicle. Job profitability is manual. |
| **DMS for franchised dealers** | Keyloop, CDK | Deep OEM integration. | Priced and shaped for franchised dealer groups. Independents cannot buy or use them. |

The structural observation: **nobody sits in both the workshop's operational
system and the vehicle's lifetime record.** Those are treated as separate
industries. They are the same data.

## 2. Feature comparison against a verified incumbent

The following was verified directly inside MechanicDesk's product on
9 September 2026, not taken from marketing material. Their complete navigation
is: Diary, Jobs, Customers and Vehicles, then under More: Invoices and Bills,
Inventory and Suppliers, Service Schedules, Reports, Timesheets, POS, Settings,
Help.

| Capability | MechanicDesk | Carnet | Notes |
| --- | --- | --- | --- |
| Booking diary | Yes. Day, week, extended week, month. Status filter chips. | Yes, plus bay-and-technician resource lanes and drag-to-reschedule | Their diary is a good design; we match it and add capacity awareness |
| Job management | Yes | Yes, as an explicit lifecycle state machine | See [state machines](../02-design/04-state-machines.md) |
| Job types, tags, follow-ups | Yes | Yes | Adopted from their model |
| Customers and vehicles | Yes | Yes | |
| Registration and VIN lookup | Yes | Yes | |
| Invoicing and quoting | Yes | Yes | |
| Stock control, alerts, reordering | Yes | Yes, with automatic reservation against jobs | Phase 2 |
| Supplier management and bills | Yes | Yes, with purchase-request approval workflow | Phase 2 |
| Service scheduling and reminders | Yes | Yes, driven by both time and mileage projection | |
| Point of sale | Yes | Phase 5 | Not a differentiator, but table stakes eventually |
| Reporting | Yes | Yes, plus job-level and part-level profitability | |
| Timesheets | Yes | Yes, clocked against jobs so labour cost is real | |
| Multi-site management | Yes | Phase 4 | |
| **Structured digital vehicle inspection** | **No** | **Yes** | Pass / advisory / critical per item, with photos and notes |
| **Inspection findings auto-generate the estimate** | **No** | **Yes** | Removes the re-typing step that loses detail |
| **Customer portal** | **No** | **Yes** | View, approve, decline, ask a question, pay, see history |
| **Estimate approval by secure link with audit trail** | **No** | **Yes** | Who approved what, when, at what figure |
| **Double-entry general ledger** | **No** | **Yes** | Phase 3. Operational events post journals automatically |
| **Job-level profitability** | **No** | **Yes** | Revenue less parts cost less labour cost, per job |
| **Purchase approval workflow** | **No** | **Yes** | Request, approve, order, receive, bill |
| **Portable vehicle history across workshops** | **No** | **Yes** | The core differentiator |
| **Tamper-evident event ledger** | **No** | **Yes** | Hash-linked, append-only |
| **Ownership transfer of history** | **No** | **Yes** | The history follows the car |
| **Owner-controlled disclosure** | **No** | **Yes** | Scoped, time-boxed, revocable access grants |

Eleven rows where the incumbent has nothing. Nine of them are not features that
could be added in a sprint; they require a data model built around the vehicle
rather than around the tenant.

## 3. Where we deliberately do not compete

- **On price.** We will not be the cheapest. A system that posts your ledger
  correctly is worth more than one that does not, and racing to the bottom
  funds neither support nor correctness.
- **On breadth of ERP.** Payroll across jurisdictions, fixed-asset depreciation
  schedules and manufacturing resource planning are not our problem.
- **On franchised dealer groups.** Different buyer, different sales motion,
  different compliance surface. Not now.

## 4. The defensibility question

Any single feature here is copyable. The honest question is what is not.

| Asset | Copyable? | Why |
| --- | --- | --- |
| Inspection module | Yes, in a quarter | It is a well-understood feature |
| Customer portal | Yes, in a quarter | Same |
| General ledger | Yes, in two quarters | Harder, but bounded |
| **Vehicle history coverage** | **No** | It is an accumulated record of work actually performed. A competitor starting today starts at zero, and cannot backfill what was never captured. |
| **Workshop contribution incentive** | **Partially** | The revenue-share mechanism is copyable; the installed base already contributing is not |

The moat is time-based and coverage-based. That argues for one thing above all:
**start writing passport events in Phase 1, from the very first job**, even
while the passport has almost no readers. Every month of delay is a month of
coverage a competitor could match.

This is why the vehicle event ledger is in the MVP and not deferred to a later
phase, despite generating no immediate revenue. See
[MVP definition](05-mvp-definition.md) section 4.

---

*Next: [Personas](04-personas.md).*
