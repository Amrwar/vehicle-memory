# Feature map

Every capability asked for, and where it actually stands.

This is written against the code rather than against intention. The coverage
map next door was twice found claiming things that were not built, both times
because a row had been written from the data model instead of from the
product. So the rule here is the same one that caught those: a line is only
**Built** if somebody can open a page and do the thing. A rich schema with no
interface is **Partial**, and a button with nothing behind it is **Missing**.

**Status meanings.** _Built_ is in the product and covered by an automated
check. _Partial_ means some of it works and the rest is named. _Missing_ means
it does not exist. _Deferred_ means it is deliberately not being built yet, and
says why.

---

## 1. Dashboard

| Item                       | Status  | Where                                                        |
| -------------------------- | ------- | ------------------------------------------------------------ |
| Today's appointments       | Built   | `/dashboard`, `/diary`                                       |
| Cars currently in the shop | Built   | `/dashboard`, jobs by status                                 |
| Jobs waiting for approval  | Built   | `/dashboard`, and the count on the sidebar                   |
| Jobs waiting for parts     | Partial | Reservations exist; not surfaced as its own dashboard row    |
| Jobs overdue               | Partial | Promised dates exist; no overdue tile                        |
| Today's revenue            | Built   | `/dashboard`                                                 |
| Outstanding invoices       | Built   | `/payments`, aged debt on `/financials`                      |
| Low-stock parts            | Built   | `/parts`, below reorder point                                |
| Technician workload        | Built   | `/people`, utilisation and productivity                      |
| Upcoming service reminders | Built   | `/reminders`                                                 |
| Customer satisfaction      | Missing | Nothing collects it. See section 18.                         |
| Profit margin              | Built   | `/reports/business`, by service type                         |
| Activity feed              | Missing | The audit log records everything; nothing reads it as a feed |

## 2. Workshop calendar

| Item                | Status  | Note                                               |
| ------------------- | ------- | -------------------------------------------------- |
| Week view           | Built   | `/diary`, bay lanes with capacity                  |
| Day view            | Missing |                                                    |
| Month view          | Missing |                                                    |
| Technician view     | Missing | The data is there; the view is not                 |
| Bay view            | Partial | Week view is laid out by bay                       |
| Location view       | Missing | Multi-site exists; the diary does not filter by it |
| Drag between bays   | Missing | Every move is a form today                         |
| Drag between people | Missing |                                                    |

## 3. Customer CRM

| Item                    | Status  | Where                                                |
| ----------------------- | ------- | ---------------------------------------------------- |
| Contact, vehicles, jobs | Built   | `/customers/[id]`                                    |
| Invoices, payments      | Built   | Same page                                            |
| Quotes                  | Built   | Same page                                            |
| Communication history   | Partial | `/messages` is org-wide, not per customer            |
| Notes                   | Built   | On the customer and on jobs                          |
| Loyalty points          | Missing | See section 17                                       |
| Service reminders       | Built   | `/reminders`                                         |
| Customer lifetime value | Built   | `/crm`, by cohort                                    |
| Preferred technician    | Missing |                                                      |
| Customer timeline       | Missing | The events exist; nothing renders them as one thread |

## 4. Vehicle management

| Item                       | Status  | Note                                          |
| -------------------------- | ------- | --------------------------------------------- |
| Its own profile            | Built   | `/vehicles/[id]`, and `/portal/vehicles/[id]` |
| VIN, plate, make, model    | Built   |                                               |
| Mileage, engine, fuel      | Built   |                                               |
| Service and repair history | Built   | Every visit, across workshops                 |
| Parts replaced             | Built   | Through job lines                             |
| Inspections                | Partial | Recorded; no interface to carry one out       |
| Upcoming maintenance       | Built   | Service schedules                             |
| Warranty information       | Missing | See section 14                                |
| Insurance information      | Missing |                                               |
| Photos                     | Missing |                                               |
| Documents                  | Missing |                                               |
| Maintenance timeline       | Partial | Listed by visit, not drawn as a lifetime      |

## 5. Digital vehicle inspection

**Partial, and the gap is the whole feature.** Six tables exist: templates,
template items, inspections, results with severity and measurements,
photos, and the link from a result to an estimate line. The passport reads
them and the estimate builder uses them.

There is no interface for a technician to carry out an inspection. The data
gets there through the seed. This is the largest single gap in the product and
the one with the clearest revenue attached, since an inspection is what turns
a booked oil change into approved brake work.

## 6. Smart estimates

| Item                           | Status  | Note                                            |
| ------------------------------ | ------- | ----------------------------------------------- |
| Estimate with parts and labour | Built   | `/estimates`, tax per line                      |
| Built from an inspection       | Partial | The mapping exists in core; no screen drives it |
| Customer approves digitally    | Built   | `/e/[token]`, line by line                      |
| Re-approval when work grows    | Built   | Threshold per organisation                      |

## 7. Customer portal

**Built.** Booking, updates in plain language, quotes decided line by line with
or without an account, invoices across every workshop, vehicle history, and
share links the owner controls. Repair tracking is the status timeline on
`/portal/updates`. Messages to the workshop are missing; see section 16.

## 8. Technician app

| Item                         | Status  | Note                               |
| ---------------------------- | ------- | ---------------------------------- |
| My jobs, mobile-first        | Built   | `/shop`                            |
| Start and stop the clock     | Built   |                                    |
| View instructions            | Built   |                                    |
| View the inspection          | Missing |                                    |
| Add notes                    | Built   |                                    |
| Add or request parts         | Missing | The button exists and does nothing |
| Upload photos                | Missing | The button exists and does nothing |
| Mark a task complete         | Built   |                                    |
| Report an additional problem | Missing |                                    |

Two buttons on this page do nothing when pressed. They are listed as missing
rather than partial for that reason.

## 9. Parts and inventory

**Built, and deep.** SKU, OEM number, barcode, supplier, cost, sell price,
quantity, minimum stock, bin location, weighted average cost, reservations,
stocktakes, and every movement traceable. Multi-location with transfers and
in-transit stock counted in group value.

Missing: which vehicles a part fits. That needs a fitment source, and guessing
it puts wrong parts on cars.

## 10. Purchasing

| Item                    | Status  | Note                               |
| ----------------------- | ------- | ---------------------------------- |
| Low stock to suggestion | Built   | `/purchasing`                      |
| Purchase orders         | Built   | With approval thresholds           |
| Goods received          | Built   | Partial receipts handled           |
| Supplier invoices       | Built   | Three-way match                    |
| Supplier payments       | Missing |                                    |
| Price history           | Missing | "Supplier B is cheaper this month" |

## 11. Financial ERP

**Built.** Double-entry ledger, revenue, expenses, payables, receivables, tax,
payments, discounts, trial balance, profit and loss, balance sheet, cash
position, general ledger, bank reconciliation, period close, and job
profitability with parts, labour and margin.

Missing: refunds as a first-class flow, and card payment, which waits on a
provider.

## 12. Employee and technician management

**Built.** Employees, roles, permissions, attendance, timesheets with approval,
effective-dated pay rates, commission, certifications, jobs completed, hours,
revenue and the utilisation, efficiency and productivity triple.

Missing: payroll export, which waits on a named target format.

## 13. Service bay management

**Missing as a board.** Bays exist, jobs are assigned to them, and the diary
lays the week out in bay lanes. There is no visual floor plan and nothing can
be dragged.

## 14. Warranty management

**Missing entirely.** No model, no page. Parts warranty, labour warranty,
expiry, claims.

## 15. Fleet management

**Missing entirely.** A company with fifty vehicles is currently fifty
unrelated customer records.

## 16. Communication centre

**Partial.** Everything outbound is recorded and now actually sends, with the
state of each message visible. There is no inbound: no unified inbox, no reply
from a customer landing against a job, no WhatsApp.

## 17. Marketing and retention

| Item                | Status  | Where                                      |
| ------------------- | ------- | ------------------------------------------ |
| Automated campaigns | Built   | `/automation`, trigger and conditions      |
| Customer segments   | Built   | `/crm`, with the reachable count           |
| Campaigns           | Built   | Consent rechecked at the moment of sending |
| Loyalty programme   | Missing |                                            |
| Coupons             | Missing |                                            |
| Referrals           | Missing |                                            |
| Gift cards          | Missing |                                            |

## 18. Reviews and reputation

**Missing entirely.** Nothing asks, nothing records, nothing routes a good
rating to a public review and a poor one to a private conversation.

## 19. AI inside the workflow

**Missing, and deliberately last.** The three uses named are a service adviser
suggesting where to look, a job summary written for the customer, and revenue
observations. All three are sound because none of them decides anything.

The suggestion feature needs a corpus of symptoms against confirmed causes.
That corpus does not exist yet, and a confident wrong suggestion on a braking
fault is not a small error.

## 20. Owner command centre

**Missing.** Asking a question in words and getting an answer from the data.
Every figure it would need is already computed somewhere in the product, which
makes this mostly a question of routing rather than of new arithmetic.

## 21. Sidebar organisation

**Partial.** The sidebar is grouped by what somebody is doing and filtered by
role. The grouping differs from the one proposed, mostly because several
proposed sections do not exist yet.

## 22. The three connected experiences

**This is already the shape of the product**, and it is the reason the phases
ran in the order they did. The workshop side and the business side share one
ledger rather than two databases, and the customer side reads the same records
rather than a copy of them.

---

## What this adds up to

Counting individual capabilities rather than sections, both the table rows and
the sections given a single verdict:

<!-- counts:start -->

_Counted by `infra/scripts/build_deck.py`. Do not edit by hand._

| Status  | Capabilities |
| ------- | ------------ |
| Built   | 42           |
| Partial | 10           |
| Missing | 31           |

<!-- counts:end -->

The missing work is grouped into phases 7 to 12 in the
[roadmap](06-roadmap.md). They are ordered by what a workshop loses by not
having them, which puts the inspection interface first: it is the one gap that
costs a workshop money every day it is absent.

_Next: [roadmap](06-roadmap.md)._
