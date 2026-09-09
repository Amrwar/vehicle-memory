# Project Proposal — Carnet

|                 |                                  |
| --------------- | -------------------------------- |
| **Document**    | Commercial and delivery proposal |
| **Version**     | 1.0                              |
| **Date**        | 9 September 2026                 |
| **Prepared by** | Amr Hefny                        |
| **Status**      | For approval                     |

---

## 1. Executive summary

We propose to build **Carnet**, a workshop management and ERP platform whose
distinguishing asset is a **portable vehicle history that follows the car
rather than the owner or the workshop**.

The workshop software market is mature and competently served. We do not
propose to win on feature count. We propose to win on a structural advantage
that incumbents cannot copy without rebuilding their data model: _every job a
Carnet workshop completes contributes verified events to a vehicle history that
outlives the customer relationship._

That produces a compounding asset. Workshop software is a business with modest
switching costs and price competition. A vehicle history network with genuine
coverage is a business with a moat.

**The ask:** approval to deliver Phases 1 to 3 over **28 weeks** at an
estimated **£268,000 – £312,000** of build cost, producing a commercially
sellable product with paying customers by week 20.

---

## 2. The opportunity

### 2.1 Two revenue lines, one build

| Line                | Customer                            | Model                                                           | Timing                                           |
| ------------------- | ----------------------------------- | --------------------------------------------------------------- | ------------------------------------------------ |
| **Carnet Workshop** | Independent workshops, 2 to 30 bays | SaaS subscription, per bay per month                            | Revenue from month 5                             |
| **Carnet Passport** | Vehicle buyers and sellers          | Per verified report, revenue-shared with contributing workshops | Revenue from month 18, once coverage supports it |

The subscription business funds the company. The passport business is what
makes the company valuable. Critically, **the second requires no additional
data-entry effort from anyone** — it is a by-product of the first.

### 2.2 Market sizing, stated honestly

We have not commissioned market research and will not pretend otherwise. What
we can state with confidence:

- Independent workshops are numerous, fragmented, and already paying for
  software of this class at roughly £60–£200 per month.
- No incumbent we have examined offers a customer-facing portal, a structured
  digital vehicle inspection tied to estimate generation, integrated
  double-entry accounting, or any form of portable vehicle history.
- The competitive analysis in [Market and
  competition](03-market-and-competition.md) documents those gaps against a
  named incumbent, verified directly in their product.

Before committing to Phase 4 we will validate willingness-to-pay with 10 design
partners. That gate is in the plan and is a genuine gate.

---

## 3. Scope

### 3.1 What is included

**Phase 1 — Workshop Core (weeks 1–10)**

Multi-tenant foundation, authentication and role-based access. Customers,
vehicles and the vehicle passport timeline. Booking diary with bay and
technician scheduling. The job lifecycle engine. Digital vehicle inspections
with photographs. Estimate generation from inspection findings. Customer
approval by secure link. Invoicing and payment recording. Shop-floor
technician interface. Workshop dashboard.

**Phase 2 — Inventory and Procurement (weeks 11–18)**

Parts catalogue, warehouses, stock levels and movements. Automatic stock
reservation when a part is added to a job. Reorder-point detection. Purchase
requests, approval, purchase orders, goods receiving. Supplier management and
supplier bills.

**Phase 3 — Finance and ERP (weeks 19–28)**

Chart of accounts and general ledger. Automatic journal posting from every
operational event. Accounts receivable and payable. Expenses. Tax handling.
Fiscal periods and closing. Financial statements. Job-level and part-level
profitability reporting.

Each phase ends in a deployable, demonstrable, tested increment. There is no
phase whose output is a document.

### 3.2 What is explicitly excluded from this proposal

These are deliberately deferred, not forgotten. Each is scoped in the
[roadmap](06-roadmap.md).

| Excluded                                          | Phase | Why deferred                                                                                 |
| ------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------- |
| HR, payroll, commissions                          | 4     | High regulatory variance by jurisdiction; buy or integrate before building                   |
| Multi-location stock transfer and consolidation   | 4     | Needs real multi-site customers to design against                                            |
| Native mobile applications                        | 5     | The responsive web technician interface is sufficient to validate; native is an optimisation |
| Online customer self-booking                      | 5     | Requires the diary to be proven under real load first                                        |
| Forecasting and AI-assisted diagnosis             | 6     | Requires a corpus of real job data that does not yet exist                                   |
| OBD telematics ingestion                          | 6     | Hardware partnership, separate commercial track                                              |
| Accounting-package integration (Xero, QuickBooks) | 3.5   | Build the ledger first so there is something coherent to sync                                |

### 3.3 Assumptions

1. One product owner is available for a minimum of four hours per week for
   decisions and acceptance.
2. Two design-partner workshops give us access to real workflows, real data
   shapes and fortnightly feedback from week 3.
3. Target jurisdiction for tax and compliance in v1 is single-country. Multi-
   jurisdiction tax is a Phase 3 extension, priced separately.
4. Third-party services (SMS, email, payment processing, VIN decoding) are
   procured under separate subscriptions and are not in the build cost.
5. Data migration from an incumbent system is scoped per customer as a
   professional-services engagement, not as product work.

---

## 4. Approach

### 4.1 Delivery method

Two-week sprints. Trunk-based development with short-lived branches. Every
merge to `main` passes lint, type-check, unit tests, integration tests and a
production build. Every sprint ends with a deployed increment on the staging
environment and a demonstration against acceptance criteria.

The [definition of done](../05-project/02-definition-of-done.md) is a contract,
not an aspiration. Work that has not met it is not counted as delivered.

### 4.2 Sequencing rationale

The order is not arbitrary. It follows the dependency chain of the money:

```
  You cannot invoice          You cannot cost a job         You cannot post
  what you did not job.  -->  without parts costs.    -->   a ledger entry
                                                            without both.

  Phase 1: Job                Phase 2: Inventory            Phase 3: Ledger
```

Building the ledger first would mean posting entries for transactions that do
not yet exist. Building inventory first would mean stock movements with no job
to consume them. The sequence is forced by the domain.

### 4.3 Technology

TypeScript throughout, Next.js and React on PostgreSQL via Prisma, deployed in
containers. The rationale and the alternatives considered are recorded in
[ADR-0002](../03-adr/0002-technology-stack.md) and
[ADR-0003](../03-adr/0003-monorepo-structure.md).

The choice is deliberately conservative. This system's difficulty is in its
domain model, not in its infrastructure, and we decline to spend novelty budget
on the parts that are solved.

---

## 5. Team and cost

### 5.1 Shape of the team

| Role                       | Allocation | Weeks | Responsibility                                              |
| -------------------------- | ---------- | ----- | ----------------------------------------------------------- |
| Tech lead / architect      | 1.0 FTE    | 28    | Domain model, architecture, code review, the hard parts     |
| Senior full-stack engineer | 1.0 FTE    | 28    | Feature delivery across the stack                           |
| Full-stack engineer        | 1.0 FTE    | 24    | Feature delivery, from week 5                               |
| Product designer           | 0.5 FTE    | 20    | Design system, screen design, usability testing             |
| QA engineer                | 0.5 FTE    | 22    | Test strategy, automation, exploratory testing, from week 7 |
| Product owner              | 0.2 FTE    | 28    | Prioritisation, acceptance, design-partner relationships    |

Peak team size is 4.2 FTE. Deliberately small: this domain requires shared
understanding of a single intricate model, and that does not survive a large
team.

### 5.2 Indicative cost

Blended rate assumption of £550 per person-day, 5-day weeks.

| Phase                                           | Weeks  | Person-weeks | Estimate     |
| ----------------------------------------------- | ------ | ------------ | ------------ |
| Phase 1 — Workshop Core                         | 10     | 34           | £93,500      |
| Phase 2 — Inventory and Procurement             | 8      | 34           | £93,500      |
| Phase 3 — Finance and ERP                       | 10     | 42           | £115,500     |
| **Build subtotal**                              | **28** | **110**      | **£302,500** |
| Contingency at 15% (held, released on evidence) |        |              | £45,375      |
| **Total with contingency**                      |        |              | **£347,875** |

Range presented in the summary (£268,000–£312,000) reflects the plausible
outcome band excluding held contingency, per the estimation model in
[Estimation and plan](../05-project/03-estimation-and-plan.md).

**Running costs, separate from build:** approximately £400–£900 per month in
years 1 for hosting, database, object storage, error tracking, SMS and email,
scaling with tenant count.

### 5.3 Payment schedule

| Milestone          | Trigger                                                | Share |
| ------------------ | ------------------------------------------------------ | ----- |
| Mobilisation       | Contract signature                                     | 15%   |
| Phase 1 acceptance | Workshop Core demonstrated against acceptance criteria | 30%   |
| Phase 2 acceptance | Inventory and Procurement accepted                     | 25%   |
| Phase 3 acceptance | Finance and ERP accepted                               | 25%   |
| Warranty release   | 30 days after Phase 3 acceptance                       | 5%    |

---

## 6. Timeline

```
 Week  1    4    7   10   13   16   19   22   25   28
       |    |    |    |    |    |    |    |    |    |
 P1    [=========================]                        Workshop Core
 P2                   [====================]              Inventory + Procurement
 P3                             [=======================] Finance + ERP
       |    |    |    |    |    |    |    |    |    |
 Gates  ^         ^         ^         ^              ^
        |         |         |         |              |
        |         |         |         |              +-- Phase 3 acceptance
        |         |         |         +-- Design-partner pricing validation
        |         |         +-- Phase 1 acceptance / first paying customer
        |         +-- Architecture and domain model signed off
        +-- Design system and first screens approved
```

Phases overlap by design. Phase 2 begins while Phase 1 is hardening, because
inventory schema work does not contend with Phase 1 UI work.

### Key dates

| Week | Milestone                                                           |
| ---- | ------------------------------------------------------------------- |
| 2    | Design system approved. Domain model reviewed with design partners. |
| 4    | Architecture and data model signed off. Walking skeleton deployed.  |
| 10   | **Phase 1 accepted.** MVP live with design partners.                |
| 20   | **First paying customer.** Pricing validated.                       |
| 18   | Phase 2 accepted.                                                   |
| 28   | **Phase 3 accepted.** Commercially complete platform.               |

---

## 7. Risks

The five that could actually derail this. The full register with owners and
triggers is in [Risk register](../05-project/04-risk-register.md).

| #   | Risk                                                                                                            | Impact   | Likelihood | Mitigation                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------- | -------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Technicians do not adopt the shop-floor interface.** Data quality collapses and the passport is worthless.    | Critical | Medium     | Design partners from week 3. Usability testing on real tablets in a real workshop, with gloves on, before Phase 1 acceptance.                                   |
| R2  | **Accounting correctness defects.** A ledger that does not balance destroys trust irrecoverably.                | Critical | Medium     | Double-entry invariants enforced in the domain layer and property-tested. No journal may post unbalanced. External accountant review before Phase 3 acceptance. |
| R3  | **Cold-start.** Passports stay empty long enough that the differentiator never materialises.                    | High     | High       | Phase 1 already writes passport events. Coverage is measured from day one. Revenue share designed in from the start, not retrofitted.                           |
| R4  | **Scope expansion into general ERP.** The word "ERP" attracts unbounded requirements.                           | High     | High       | Explicit exclusions in 3.2. Anything not on the roadmap requires a change request with cost and schedule impact.                                                |
| R5  | **Data protection exposure.** We hold personal data plus a vehicle's complete history. A breach is existential. | Critical | Low        | Tenant isolation enforced at the data-access layer, not by convention. Security model documented and reviewed. Penetration test before general availability.    |

---

## 8. What you receive

At the end of each phase:

1. Running software deployed to staging and production, with source code in
   this repository under an MIT licence.
2. Passing test suites with coverage reporting, and the CI pipeline that
   enforces them.
3. Complete documentation: requirements, domain model, data model,
   architecture, API contract, design system, operational runbook.
4. Architecture decision records explaining not just what was built but why,
   and what was rejected.
5. A demonstration against written acceptance criteria, with the criteria
   agreed before the work started rather than after.

---

## 9. Approval

Approval of this proposal authorises mobilisation and Phase 1. Phases 2 and 3
are re-confirmed at their respective gates, at which point either party may
stop with no further obligation beyond work completed.

|              | Name | Signature | Date |
| ------------ | ---- | --------- | ---- |
| **Client**   |      |           |      |
| **Supplier** |      |           |      |

---

_Next: [Market and competition](03-market-and-competition.md)._
