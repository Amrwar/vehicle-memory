# Roadmap

Six phases. Each has an entry condition, a scope, an exit condition and a
reason for its position in the sequence. No phase is a document-only phase.

```
 P1 Workshop Core        [==========]                              wk 1-10
 P2 Inventory + Procure            [========]                      wk 11-18
 P3 Finance + ERP                        [==========]              wk 19-28
 P4 Business + Multi-site                          [=======]       wk 29-36
 P5 Customer + Automation                                [======]  wk 37-44
 P6 Intelligence                                            [====] wk 45-52
```

---

## Phase 1 — Workshop Core

**Weeks 1–10. This is the MVP.**

|           |                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------- |
| **Entry** | Proposal approved. Design partners committed.                                                                  |
| **Exit**  | All criteria in [MVP definition](05-mvp-definition.md) section 6 met. Two design partners live for four weeks. |

**Scope.** Tenancy and auth. Customers and vehicles. **The vehicle passport
event ledger.** Booking diary with resource lanes. The job lifecycle engine.
Digital vehicle inspections. Estimates and secure customer approval. Invoicing
and payment recording. Technician tablet interface. Customer portal. Workshop
dashboard.

**Why first.** Every subsequent phase consumes the Job. Nothing can be built
before it exists.

---

## Phase 2 — Inventory and Procurement

**Weeks 11–18. Delivered.**

|           |                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Entry** | Phase 1 accepted. At least one design partner asking for stock control.                                                                                |
| **Exit**  | A part can be added to a job, reserved from stock, ordered from a supplier when short, received, and consumed, with stock value correct at every step. |

**Scope.** Parts catalogue and categories. Warehouses and bins. Stock levels,
movements and valuation. Automatic reservation when a part is added to a job.
Reorder-point detection with usage-rate-based suggested quantities. Purchase
requests and approval. Purchase orders. Goods receiving, including partial
receipt. Suppliers and supplier bills. Stock adjustments and stocktakes.

**The connection that matters:**

```
  Technician adds part to job
            |
            v
     Check availability
       /            \
  In stock        Short
     |               |
  Reserve       Purchase request
     |               |
     |          Approval -> PO -> Supplier
     |               |
     |          Goods received -> stock in
     \              /
      Part consumed on job
            |
      Stock out, cost captured against the job
```

**Why second.** Job costing is fiction until parts cost is real. The ledger in
Phase 3 needs a true cost of goods sold, and that comes from here.

---

## Phase 3 — Finance and ERP

**Weeks 19–28.**

|           |                                                                                                                              |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Entry** | Phase 2 accepted. Stock valuation correct and reconciled.                                                                    |
| **Exit**  | Trial balance balances. An external accountant reviews and signs off the postings. Job profitability agrees with the ledger. |

**Scope.** Chart of accounts. General ledger with enforced double-entry.
Automatic journal posting from every operational event. Accounts receivable and
payable with ageing. Bank accounts and reconciliation. Expenses. Tax
configuration, calculation and reporting. Fiscal periods and period close.
Trial balance, profit and loss, balance sheet. Job-level and part-level
profitability.

The exact postings for every event are specified in
[Accounting model](../02-design/07-accounting-model.md).

**Why third.** You cannot post what has not happened. Phases 1 and 2 create the
transactions; this phase gives them their financial consequence.

**Status.** The ledger is built and posting. Chart of accounts, double-entry
enforced in the database, automatic posting from seven operational events,
fiscal periods with a closed-period guard, trial balance, profit and loss,
balance sheet, aged debtors and creditors, VAT position, and job
profitability. `npm run verify:ledger` proves both statements balance and that
the aged debtors report ties to the receivable account.

Still open in this phase: bank accounts and reconciliation, expense capture,
period close, and the accountant's sign-off named in the exit criteria. The
sign-off is the one that cannot be automated, and it is the one that decides
whether any of this is trusted.

### Phase 3.5 — Accounting integrations

**Weeks 27–30, overlapping.** Xero and QuickBooks synchronisation, once there
is a coherent internal ledger to synchronise from.

---

## Phase 4 — Business and Multi-site

**Weeks 29–36.**

|           |                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| **Entry** | Phase 3 accepted. At least two customers operating more than one location.                                 |
| **Exit**  | A group can see consolidated financials, move stock between sites, and pay technicians from recorded time. |

**Scope.** Employees and HR records. Attendance and timesheets feeding real
labour cost. Payroll or payroll integration. Technician commission schemes.
Productivity and efficiency reporting. Multi-location: shared customers,
vehicles and stock; inter-site stock transfer; consolidated reporting; per-site
permissions.

```
                    COMPANY
                       |
      +----------------+----------------+
      |                |                |
   Garage A         Garage B         Garage C
   Stock            Stock            Stock
   Employees        Employees        Employees
   Jobs             Jobs             Jobs
      |                |                |
      +----------------+----------------+
                       |
                 CENTRAL LEDGER
                       |
      +----------------+----------------+
      |                |                |
   Finance         Reporting        Purchasing
```

**Why fourth.** Multi-site is a real customer need but it multiplies the
complexity of everything it touches. Doing it before the single-site model is
proven would double the cost of every earlier mistake.

---

## Phase 5 — Customer Lifecycle and Automation

**Weeks 37–44.**

|           |                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| **Entry** | Phase 1 flows stable under real load. Portal adoption above 40%.                                           |
| **Exit**  | A service reminder can lead to a booking, a job and an invoice with no staff action until the car arrives. |

**Scope.** Online self-service booking with real capacity checking. Automated
service reminders driven by both elapsed time and projected mileage. The
workflow automation engine: trigger, condition, action. SMS and email campaign
handling with consent management. Point of sale for counter sales. Native
mobile technician app if the web version has proven insufficient.

The loop this closes:

```
  Vehicle approaching service interval (time or projected mileage)
        -> Reminder sent
        -> Customer books online
        -> Booking created, capacity checked
        -> Job created on arrival
        -> ... normal flow ...
        -> Next interval calculated
        -> back to the top
```

---

## Phase 6 — Intelligence

**Weeks 45–52 and continuing.**

|           |                                                                                          |
| --------- | ---------------------------------------------------------------------------------------- |
| **Entry** | A year of real job data across a meaningful number of workshops.                         |
| **Exit**  | Recommendations measurably outperform the workshop's own judgement on a held-out sample. |

**Scope.** Demand forecasting for stock. Optimal reorder quantities from actual
usage. Job duration prediction from historical time entries. Estimate
suggestion from symptoms and vehicle history. Anomaly detection on the passport,
including odometer rollback detection across workshops. Cohort analysis of
customer retention and lifetime value.

**Why last, and why the entry condition is strict.** Every one of these
requires data that does not exist until the earlier phases have been running
for a long time. Building them earlier means building them on assumptions
rather than evidence, and shipping confident-looking predictions that are
wrong is worse than shipping nothing.

---

## Passport network milestones

These run across all phases, because coverage is the long game.

| Milestone                      | Condition                                              | Target           |
| ------------------------------ | ------------------------------------------------------ | ---------------- |
| First verified event           | A completed job writes to a passport                   | Phase 1, week 8  |
| First transfer                 | A vehicle changes owner and the history goes with it   | Phase 1, week 10 |
| First external read            | Someone with no account reads a shared passport        | Phase 1, week 10 |
| 10,000 vehicles with 3+ events | Coverage becomes locally useful                        | Month 9          |
| First paid report              | A buyer pays for a verified history                    | Month 18         |
| First revenue share paid       | A workshop is paid for data it contributed             | Month 19         |
| Passport requested by name     | A buyer asks a seller for a Carnet passport unprompted | Month 24         |

---

_Next: [Business model](07-business-model.md)._
