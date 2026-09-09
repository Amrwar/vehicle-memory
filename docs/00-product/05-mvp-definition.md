# MVP Definition

## 1. What this document is for

An MVP is not "version one with fewer features". It is **the smallest thing we
can build that tests whether the idea is true.** Everything in this document
exists to answer one of the three questions below. Anything that answers none
of them is out, regardless of how good an idea it is.

## 2. The hypotheses under test

| #      | Hypothesis                                                                       | How the MVP tests it                                                          | Fails if                                                                        |
| ------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **H1** | A workshop will run its entire day in Carnet, in preference to what it uses now. | Two design-partner workshops run live for 4 weeks with no parallel system.    | They keep a paper diary or spreadsheet alongside it.                            |
| **H2** | Technicians will actually record inspection results on a tablet.                 | Measure inspection completion rate per job and median time per inspection.    | Under 60% of jobs get a completed inspection, or median time exceeds 4 minutes. |
| **H3** | Customers will approve estimates on their phone rather than by telephone.        | Measure share of estimates approved via link, and time from send to decision. | Under 40% approved via link, or advisors keep phoning anyway.                   |

H2 is the one that matters most. **If technicians do not record, the passport
is empty, and without the passport this is just another workshop system.**

## 2a. Where the product stands against this document

The MVP defined below was delivered, and four further phases have shipped on
top of it: inventory and procurement, the double-entry ledger and financial
statements, people and multi-site, and the public front door with published
pricing and organisation-creating sign-up.

That means most of this document is now a record of what was decided rather
than a plan for what to build. It is kept because the reasoning is still the
reasoning, and because the hypotheses in section 2 have not yet been answered:
nothing here has been in front of a real workshop for four weeks. Building more
does not settle H1, H2 or H3, and it is worth being honest that shipping five
phases is evidence of effort rather than evidence of fit.

[Coverage map](08-coverage-map.md) lists every capability and its actual state.

---

## 3. In scope for MVP

### 3.1 Foundation

- Multi-tenant organisation with one location
- Email and password authentication, secure session handling
- Roles: Owner, Manager, Service Advisor, Technician, Bookkeeper, Customer
- Every query scoped to the tenant at the data-access layer
- Audit log of every state-changing action

### 3.2 Customers and vehicles

- Customer records, individuals and companies, with the real-world fields:
  mobile, phone, email, postal address, source of business
- A customer owns many vehicles
- Vehicle records keyed on VIN, with registration, make, model, year, engine,
  body type, colour, fleet number, registration due date
- VIN and registration lookup that populates the record
- Vehicle detail with tabs: Overview, Jobs, Passport, Inspections, Invoices,
  Documents

### 3.3 The vehicle passport

This is in the MVP despite generating no revenue. The reasoning is in section 4.

- Append-only, hash-linked event ledger per vehicle
- Event types: ownership, mileage, service, repair, part fitted, inspection,
  tire, accident, recall, modification
- Every event carries its source, its recording organisation, and a
  verification level
- Mileage readings validated for monotonicity, with anomalies flagged rather
  than rejected
- Timeline view, readable by a non-expert
- Owner-controlled share links, scoped and time-limited
- Ownership transfer that carries the history to the new owner

### 3.4 Booking diary

- Day, week and month views
- Resource lanes by bay and by technician
- Drag to reschedule
- Booking converts to a job in one action
- Capacity indication so a day cannot be silently overbooked

### 3.5 Jobs

- The job is the central object: everything else hangs off it
- Explicit lifecycle: Draft, Booked, Received, Inspecting, Diagnosed,
  Estimated, Awaiting Approval, Approved, In Progress, Quality Check, Completed,
  Invoiced, Paid, Cancelled
- Illegal transitions are rejected by the domain layer, not by the UI
- Job detail shows customer, vehicle, technician, bay, progress, diagnosis,
  labour, parts, photos, communication and totals on one screen
- Real-world fields adopted from established practice: job types, tags,
  customer order number, odometer in and out, estimated hours, pick-up time,
  courtesy vehicle, third-party billing

### 3.6 Digital vehicle inspection

- Configurable templates with sections and items
- Per item: Pass, Advisory, Critical, Not checked
- Per item: note, photograph, recommended action, estimated cost
- Findings roll up into a traffic-light summary
- **One action converts findings into estimate lines**

### 3.7 Estimates and approval

- Estimate with labour lines, part lines and fees; tax calculated per line
- Send by email or SMS as a secure, expiring, single-vehicle link
- Customer sees the findings with photographs, then approves, declines, or asks
  a question
- Partial approval: line-by-line accept or decline
- Approval is recorded with timestamp, IP and the exact figure agreed

### 3.8 Technician interface

- My jobs for today, on a tablet
- Clock on and off a job
- Task checklist
- Inspection capture
- Add photo, add note
- Request a part
- Complete job

### 3.9 Invoicing and payment

- Invoice generated from the approved estimate plus anything added during work
- Tax breakdown, totals, PDF
- Record payments, full or partial, with method
- Outstanding balance per customer

### 3.10 Customer portal

- My vehicles and their status
- Approve or decline estimates
- View and download invoices
- Read the vehicle passport
- Request a booking

### 3.11 Dashboard

- Today: jobs, vehicles in shop, awaiting approval, revenue
- Today's schedule with technician and status
- Approvals queue, actionable in place
- Every figure links to the action it implies

## 4. Why the passport is in the MVP

It is the only genuinely contentious inclusion, so the reasoning is recorded
explicitly.

**The argument for cutting it:** it earns nothing in year one. No customer asks
for it. It is the single largest piece of novel schema. Cutting it would remove
roughly two weeks.

**Why we keep it anyway:**

1. **The asset is time-accumulated.** Coverage cannot be backfilled. Work not
   captured in week 1 is gone permanently. Every week of delay is a week of
   moat we never get back.
2. **Retrofitting an append-only ledger onto mutable operational tables is a
   rewrite, not a feature.** The event model has to be right from the first
   migration, or it is never right.
3. **Without it, we are building a competent clone** of a mature product, and
   the entire competitive argument in
   [Market and competition](03-market-and-competition.md) collapses.

The MVP therefore ships the write path and the read path, and accepts that the
read path will be lightly used for a year.

## 5. Explicitly out of MVP

| Excluded                      | Why                                                                                        | Where it lands |
| ----------------------------- | ------------------------------------------------------------------------------------------ | -------------- |
| Inventory and stock control   | Jobs can name parts as free text with a cost. Full stock management is a phase of its own. | Phase 2        |
| Purchase orders and suppliers | No stock, no purchasing                                                                    | Phase 2        |
| General ledger and accounting | Invoices and payments are recorded; posting them to a ledger is Phase 3                    | Phase 3        |
| Payroll, HR, commissions      | Regulatory variance, low differentiation                                                   | Phase 4        |
| Multi-location                | One location proves the model                                                              | Phase 4        |
| Point of sale                 | Counter sales are not the wedge                                                            | Phase 5        |
| Online self-service booking   | Advisor-created bookings first                                                             | Phase 5        |
| Native mobile apps            | Responsive web is enough to test H2                                                        | Phase 5        |
| Forecasting, AI diagnosis     | Requires data we will not have for a year                                                  | Phase 6        |
| OBD telematics                | Hardware partnership                                                                       | Phase 6        |
| Accounting integrations       | Nothing coherent to sync until Phase 3                                                     | Phase 3.5      |

## 6. Definition of MVP done

The MVP is complete when **all** of the following are true. Not most.

- [ ] A workshop can run a complete day without touching another system:
      book, check in, inspect, estimate, get approval, do the work, invoice,
      take payment.
- [ ] A technician can complete a 30-item inspection with photographs on a
      tablet in under 4 minutes, verified by observation, not by assertion.
- [ ] A customer can approve an estimate on a phone in under 60 seconds
      without an account.
- [ ] Every completed job has written its events to the vehicle passport.
- [ ] A passport can be shared by link and read by someone with no account.
- [ ] Ownership can be transferred and the history goes with the vehicle.
- [ ] All acceptance criteria in [user
      stories](../01-requirements/03-user-stories.md) for Phase 1 epics pass.
- [ ] Automated test coverage of the domain layer is at or above 70%, with
      the job lifecycle and passport chain at or above 90%.
- [ ] The application meets the performance and accessibility budgets in
      [non-functional requirements](../01-requirements/02-non-functional-requirements.md).
- [ ] Two design partners have run live for four weeks with no parallel system.

## 7. What we will measure

| Metric                                     | Target        | Tests           |
| ------------------------------------------ | ------------- | --------------- |
| Inspection completion rate                 | > 60% of jobs | H2              |
| Median inspection duration                 | < 4 minutes   | H2              |
| Estimates approved via link                | > 40%         | H3              |
| Median send-to-decision time               | < 4 hours     | H3              |
| Jobs created per workshop per day          | > 8           | H1              |
| Days with zero parallel-system use         | > 90% of days | H1              |
| Passport events written per completed job  | > 3           | Coverage        |
| Time from vehicle arrival to estimate sent | < 90 minutes  | Flow efficiency |

If H2 fails, we stop and redesign the technician interface before building
anything else. It is the load-bearing hypothesis.

---

_Next: [Roadmap](06-roadmap.md)._
