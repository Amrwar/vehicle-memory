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

| Item                       | Status  | Where                                          |
| -------------------------- | ------- | ---------------------------------------------- |
| Today's appointments       | Built   | `/dashboard`, `/diary`                         |
| Cars currently in the shop | Built   | `/dashboard`, jobs by status                   |
| Jobs waiting for approval  | Built   | `/dashboard`, and the count on the sidebar     |
| Jobs waiting for parts     | Built   | Approved with nothing on the shelf             |
| Jobs overdue               | Built   | Past the promised date and unfinished          |
| Today's revenue            | Built   | `/dashboard`                                   |
| Outstanding invoices       | Built   | `/payments`, aged debt on `/financials`        |
| Low-stock parts            | Built   | `/parts`, below reorder point                  |
| Technician workload        | Built   | `/people`, utilisation and productivity        |
| Upcoming service reminders | Built   | `/reminders`                                   |
| Customer satisfaction      | Missing | Nothing collects it. See section 18.           |
| Profit margin              | Built   | `/reports/business`, by service type           |
| Activity feed              | Built   | Read from the audit log, which already held it |

## 2. Workshop calendar

| Item                | Status | Note                                 |
| ------------------- | ------ | ------------------------------------ |
| Week view           | Built  | `/diary`, bay lanes with capacity    |
| Day view            | Built  | Lanes by bay                         |
| Month view          | Built  | Lanes by week                        |
| Technician view     | Built  | Including work nobody is assigned to |
| Bay view            | Built  | Every bay, including the empty ones  |
| Location view       | Built  | A lane per site                      |
| Drag between bays   | Built  | Capacity checked on the drop         |
| Drag between people | Built  | Two places at once is refused        |

## 3. Customer CRM

| Item                    | Status  | Where                                                  |
| ----------------------- | ------- | ------------------------------------------------------ |
| Contact, vehicles, jobs | Built   | `/customers/[id]`                                      |
| Invoices, payments      | Built   | Same page                                              |
| Quotes                  | Built   | Same page                                              |
| Communication history   | Built   | On the customer, matched on the address it was sent to |
| Notes                   | Built   | On the customer and on jobs                            |
| Loyalty points          | Missing | See section 17                                         |
| Service reminders       | Built   | `/reminders`                                           |
| Customer lifetime value | Built   | `/crm`, by cohort                                      |
| Preferred technician    | Missing |                                                        |
| Customer timeline       | Built   | "The whole story" on `/customers/[id]`, newest first   |

## 4. Vehicle management

| Item                       | Status  | Note                                                |
| -------------------------- | ------- | --------------------------------------------------- |
| Its own profile            | Built   | `/vehicles/[id]`, and `/portal/vehicles/[id]`       |
| VIN, plate, make, model    | Built   |                                                     |
| Mileage, engine, fuel      | Built   |                                                     |
| Service and repair history | Built   | Every visit, across workshops                       |
| Parts replaced             | Built   | Through job lines                                   |
| Inspections                | Built   | Carried out on a tablet, sent to the customer       |
| Upcoming maintenance       | Built   | Service schedules                                   |
| Warranty information       | Built   | On the vehicle, and in full at `/warranty`          |
| Ownership transfer         | Built   | History stays, the previous owner does not          |
| Buyer report               | Built   | What it says, what it misses, whether intact        |
| Public verification        | Built   | A code at `/verify`, no account needed              |
| Recalls                    | Built   | `/recalls`, honest about being a record             |
| Insurance information      | Missing |                                                     |
| Photos                     | Missing |                                                     |
| Documents                  | Missing |                                                     |
| Maintenance timeline       | Built   | Components with ages, on `/vehicles/[id]/condition` |
| Health score               | Built   | With every factor and its evidence shown            |
| Predicted maintenance      | Built   | In distance as well as date, from this vehicle      |
| Component history          | Built   | Battery, brakes, tyres, belt, each with an age      |

## 5. Digital vehicle inspection

**Built.** A technician works through the template on a tablet, section by
section, three buttons an item. Each answer saves the moment it is given, so a
tablet that sleeps in a cold workshop loses nothing. Marking something amber or
red requires a measurement, a note or a recommendation, because the customer
sees the colour and a red the workshop cannot explain is worse than no
inspection at all.

Gaps are permitted on purpose and reported to the customer as not checked.
Refusing to finish would make somebody tick boxes to escape the screen.

Completing it turns what was found into quote lines in one transaction, each
linked to the measurement behind it, and moves the job to waiting on the
customer. `verify:inspection` walks the whole path.

Photographs work. The file goes straight from the camera to the store with a
short-lived signed URL and never passes through the server, because a workshop
picture is commonly three or four megabytes and a serverless request body caps
well below that. The row is written only once the store confirms it holds the
bytes.

The store speaks S3, which R2, Amazon, Backblaze and MinIO all understand, so
the vendor is a URL and two keys. R2 is the recommendation: inspection
photographs are read far more often than written, and it charges nothing for
egress.

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

| Item                         | Status | Note                                       |
| ---------------------------- | ------ | ------------------------------------------ |
| My jobs, mobile-first        | Built  | `/shop`                                    |
| Start and stop the clock     | Built  | Was a button with no action until Phase 7  |
| View instructions            | Built  |                                            |
| View the inspection          | Built  | From the technician's own job list         |
| Add notes                    | Built  |                                            |
| Add or request parts         | Built  | Raises a purchase request against the job  |
| Upload photos                | Built  | Straight from the camera to the file store |
| Mark a task complete         | Built  |                                            |
| Report an additional problem | Built  | Any item can be marked and quoted          |

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

| Item                    | Status  | Note                                              |
| ----------------------- | ------- | ------------------------------------------------- |
| Low stock to suggestion | Built   | `/purchasing`                                     |
| Purchase orders         | Built   | With approval thresholds                          |
| Goods received          | Built   | Partial receipts handled                          |
| Supplier invoices       | Built   | Three-way match                                   |
| Supplier payments       | Missing |                                                   |
| Price history           | Built   | On each supplier, with the change since last time |

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

**Built.** `/floor` shows what is in each bay at this minute, not what is
booked into it today, because a workshop's own answer to "where is that car"
is to walk out and look and the screen version is only worth having if it says
the same thing. A bay past its slot is marked, which is the one thing walking
out does not tell you.

Cards are dragged between bays and people in the diary. The drop runs the same
capacity check that guards making a booking: a shared bay warns and goes
through, a technician in two places at once is refused. Everything the drag
does, a menu on the card also does, for a keyboard or a phone.

## 14. Warranty management

| Item                      | Status | Where                                             |
| ------------------------- | ------ | ------------------------------------------------- |
| Parts and labour warranty | Built  | `/warranty`, cover recorded as a job closes       |
| Expiry by time            | Built  | Month arithmetic that survives month-ends         |
| Expiry by distance        | Built  | Refused without the reading it counts from        |
| What is running out       | Built  | Inside thirty days, at the top of the page        |
| Claims                    | Built  | One open at a time, settled with a stated outcome |
| Goodwill outside cover    | Built  | Allowed, recorded as goodwill, reason required    |
| Supplier's own cover      | Built  | Held beside the workshop's, so it can be claimed  |
| What the workshop carries | Built  | The part of open claims nobody else will cover    |

The screen exists for one quiet, expensive mistake: replacing a part under the
workshop's own warranty while the supplier's warranty on the same part is
still running, absorbing the cost, and never claiming it back. No ordinary
system points that out, because nothing holds both dates in one place.

## 15. Fleet management

| Item                     | Status  | Where                                          |
| ------------------------ | ------- | ---------------------------------------------- |
| Company accounts         | Built   | `/fleet`, a company with more than one vehicle |
| Vehicles per account     | Built   | Derived from what the company has brought in   |
| Off the road right now   | Built   | In the workshop at this minute                 |
| Due and overdue services | Built   | The number a fleet manager is measured on      |
| Waiting on a decision    | Built   | Quotes nobody at the company has answered      |
| Spend                    | Built   | Last thirty days, and per vehicle              |
| Fleet pricing agreements | Missing | Rates are per organisation, not per account    |
| Consolidated invoicing   | Missing | One invoice per job, not one per fleet a month |

There is no separate fleet record, deliberately. A fleet is a company customer
with several vehicles, and inventing another entity would give a vehicle two
places to belong and an eventual argument about which one is right.

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
| Built   | 85           |
| Partial | 3            |
| Missing | 16           |

<!-- counts:end -->

The missing work is grouped into phases 7 to 12 in the
[roadmap](06-roadmap.md). They are ordered by what a workshop loses by not
having them, which puts the inspection interface first: it is the one gap that
costs a workshop money every day it is absent.

_Next: [roadmap](06-roadmap.md)._
