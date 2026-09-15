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

| Item                       | Status | Where                                          |
| -------------------------- | ------ | ---------------------------------------------- |
| Today's appointments       | Built  | `/dashboard`, `/diary`                         |
| Cars currently in the shop | Built  | `/dashboard`, jobs by status                   |
| Jobs waiting for approval  | Built  | `/dashboard`, and the count on the sidebar     |
| Jobs waiting for parts     | Built  | Approved with nothing on the shelf             |
| Jobs overdue               | Built  | Past the promised date and unfinished          |
| Today's revenue            | Built  | `/dashboard`                                   |
| Outstanding invoices       | Built  | `/payments`, aged debt on `/financials`        |
| Low-stock parts            | Built  | `/parts`, below reorder point                  |
| Technician workload        | Built  | `/people`, utilisation and productivity        |
| Upcoming service reminders | Built  | `/reminders`                                   |
| Customer satisfaction      | Built  | From reviews, refused below five answers       |
| Comeback rate              | Built  | Ninety days, by site and person (Phase 40)     |
| Owed and overdue           | Built  | The business block (Phase 40)                  |
| Profit margin              | Built  | `/reports/business`, by service type           |
| Activity feed              | Built  | Read from the audit log, which already held it |

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

| Item                    | Status | Where                                                              |
| ----------------------- | ------ | ------------------------------------------------------------------ |
| Contact, vehicles, jobs | Built  | `/customers/[id]`                                                  |
| Invoices, payments      | Built  | Same page                                                          |
| Quotes                  | Built  | Same page                                                          |
| Communication history   | Built  | On the customer, matched on the address it was sent to             |
| Notes                   | Built  | On the customer and on jobs                                        |
| Loyalty points          | Built  | On the customer: balance, worth, lapsing, given by hand (Phase 24) |
| Service reminders       | Built  | `/reminders`                                                       |
| Customer lifetime value | Built  | `/crm`, by cohort                                                  |
| Preferred technician    | Built  | On the customer, preselected on a new job                          |
| Customer timeline       | Built  | "The whole story" on `/customers/[id]`, newest first               |

## 4. Vehicle management

| Item                       | Status | Note                                                                                              |
| -------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Its own profile            | Built  | `/vehicles/[id]`, and `/portal/vehicles/[id]`                                                     |
| VIN, plate, make, model    | Built  |                                                                                                   |
| Mileage, engine, fuel      | Built  |                                                                                                   |
| Service and repair history | Built  | Every visit, across workshops                                                                     |
| Parts replaced             | Built  | Through job lines                                                                                 |
| Inspections                | Built  | Carried out on a tablet, sent to the customer                                                     |
| Upcoming maintenance       | Built  | Service schedules                                                                                 |
| Warranty information       | Built  | On the vehicle, and in full at `/warranty`                                                        |
| Ownership transfer         | Built  | History stays, the previous owner does not                                                        |
| Buyer report               | Built  | What it says, what it misses, whether intact                                                      |
| Public verification        | Built  | A code at `/verify`, no account needed                                                            |
| Reads as a passport        | Built  | Cover, identity page with a checking zone, stamps; one document for every reader (Phase 23)       |
| Listed side by side        | Built  | Every passport with its count, its workshops and its chain verdict; a favicon to match (Phase 27) |
| Recalls                    | Built  | `/recalls`, honest about being a record                                                           |
| Insurance information      | Built  | A document with a policy reference and an expiry                                                  |
| Photos                     | Built  | Paperwork of kind photograph, on the vehicle                                                      |
| Documents                  | Built  | Belong to the car; workshop and owner both see them                                               |
| Maintenance timeline       | Built  | Components with ages, on `/vehicles/[id]/condition`                                               |
| Health score               | Built  | With every factor and its evidence shown                                                          |
| Predicted maintenance      | Built  | In distance as well as date, from this vehicle                                                    |
| Component history          | Built  | Battery, brakes, tyres, belt, each with an age                                                    |

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

| Item                           | Status | Note                                         |
| ------------------------------ | ------ | -------------------------------------------- |
| Estimate with parts and labour | Built  | `/estimates`, tax per line                   |
| Built from an inspection       | Built  | Completing an inspection drafts the estimate |
| Customer approves digitally    | Built  | `/e/[token]`, line by line                   |
| Re-approval when work grows    | Built  | Threshold per organisation                   |

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
| Installs on a phone          | Built  | Scoped to `/shop`, nothing else            |
| Works with no signal         | Built  | Jobs, clock, notes, inspection findings    |
| Nothing lost when offline    | Built  | Queued on the device, sent on reconnection |
| Retry writes it once         | Built  | An id generated before anything is sent    |
| Conflicts explained          | Built  | Kept on the device with the reason         |

The reconciling is the part worth reading about. Two devices editing one job
cannot be resolved by last-write-wins, because the record a customer is billed
from is a sequence of claims about what happened rather than a document, and
the later claim is not automatically the true one. Every queued action is
therefore a fact, an addition or a claim, and only the third can conflict.

## 9. Parts and inventory

**Built, and deep.** SKU, OEM number, barcode, supplier, cost, sell price,
quantity, minimum stock, bin location, weighted average cost, reservations,
stocktakes, and every movement traceable. Multi-location with transfers and
in-transit stock counted in group value.

| Item                   | Status  | Where                                            |
| ---------------------- | ------- | ------------------------------------------------ |
| Which vehicles it fits | Built   | On the part, with the source of each claim       |
| Warning on a job       | Built   | Fires on a mismatch, silent on a match           |
| No data recorded       | Built   | Reads as unknown, never as fitting               |
| A fitment feed         | Missing | Needs a provider. Rows are typed by a person now |

The three states matter more than the feature. A screen that showed nothing
when it had no data would teach somebody that no warning means the part is
right, and the day it has data for one part and not another, the silence would
mean two different things with no way to tell which.

## 10. Purchasing

| Item                    | Status | Note                                              |
| ----------------------- | ------ | ------------------------------------------------- |
| Low stock to suggestion | Built  | `/purchasing`                                     |
| Purchase orders         | Built  | With approval thresholds                          |
| Goods received          | Built  | Partial receipts handled                          |
| Supplier invoices       | Built  | Three-way match                                   |
| Supplier payments       | Built  | `/payables`, allocated oldest-due first, remitted |
| Price history           | Built  | On each supplier, with the change since last time |
| Supplier comparison     | Built  | Side by side on each part, order in one press     |
| Supplier performance    | Built  | Quarter by quarter, slower said in a sentence     |

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

| Item              | Status | Where                                               |
| ----------------- | ------ | --------------------------------------------------- |
| Skill matrix      | Built  | `/skills`, at three levels with the date signed off |
| Skill gaps        | Built  | A skill only one person holds is named              |
| Working hours     | Built  | `/patterns`, one row per person per weekday         |
| Holiday deduction | Built  | Approved absence comes off capacity automatically   |

Missing: payroll export, which waits on a named target format.

## 12.5 Capacity and scheduling

| Item                   | Status | Where                                             |
| ---------------------- | ------ | ------------------------------------------------- |
| Capacity by day        | Built  | `/capacity`, from people and bays, seven days out |
| Which constraint binds | Built  | People or bays, named rather than averaged        |
| Overbooking            | Built  | By how much, and why                              |
| Automatic scheduling   | Built  | `/plan`, skill-aware, with every reason shown     |
| What cannot be placed  | Built  | Five reasons, each said plainly                   |
| Accepting a proposal   | Built  | One press writes it to the diary; next run fixed  |

The risk here is not the screen. A schedule that is subtly wrong is worse than
a blank one, because somebody works to it. So skill is a hard constraint, every
line carries the sentence that put it there, and nothing is written until a
person says so.

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

| Item                     | Status | Where                                          |
| ------------------------ | ------ | ---------------------------------------------- |
| Company accounts         | Built  | `/fleet`, a company with more than one vehicle |
| Vehicles per account     | Built  | Derived from what the company has brought in   |
| Off the road right now   | Built  | In the workshop at this minute                 |
| Due and overdue services | Built  | The number a fleet manager is measured on      |
| Waiting on a decision    | Built  | Quotes nobody at the company has answered      |
| Spend                    | Built  | Last thirty days, and per vehicle              |
| Fleet pricing agreements | Built  | Per company: labour and parts discounts, terms |
| Consolidated invoicing   | Built  | One invoice per fleet per month, job per line  |

There is no separate fleet record, deliberately. A fleet is a company customer
with several vehicles, and inventing another entity would give a vehicle two
places to belong and an eventual argument about which one is right.

## 16. Communication centre

**Built, except WhatsApp.** Everything outbound is recorded and sends, with
the state of each message visible. Replies now arrive too: `/inbox` receives
them, matches each to a customer and a job with a stated confidence, and orders
them by what has to be dealt with rather than by arrival.

Nothing is acted on automatically. A reply that looks like "yes" goes to the
top for somebody to read, because work worth thousands of pounds does not rest
on a pattern match.

Missing: WhatsApp, and a provider actually delivering inbound messages. The
endpoint that receives them exists and is authenticated.

## 17. Marketing and retention

| Item                               | Status  | Where                                                                                                                                |
| ---------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Automated campaigns                | Built   | `/automation`, trigger and conditions                                                                                                |
| Customer segments                  | Built   | `/crm`, with the reachable count                                                                                                     |
| Campaigns                          | Built   | Consent rechecked at the moment of sending                                                                                           |
| Loyalty programme                  | Built   | Points as a sum of entries, never a stored total                                                                                     |
| Earning points                     | Built   | A point a pound on a bill paid in full, once (Phase 24)                                                                              |
| Spending points                    | Built   | Off the bill on the invoice page, booked as the programme's cost (Phase 24)                                                          |
| Points in the portal               | Built   | Per workshop, with what they are worth and when they lapse (Phase 24)                                                                |
| Referrals                          | Built   | A code on the customer and in the portal; both sides paid, once, on a visit (Phase 25)                                               |
| A code at the counter              | Built   | On a new customer or an existing one, refused with a sentence (Phase 25)                                                             |
| Referral paid itself               | Built   | Both sides credited the moment the qualifying bill is paid (Phase 25)                                                                |
| Coupons                            | Missing |                                                                                                                                      |
| Gift cards                         | Built   | `/gift-cards`: sold as a liability, spent on the invoice as its own payment kind (Phase 26)                                          |
| A card on a bill or at the counter | Built   | Amount optional; refused rather than clamped; the bank untouched (Phases 26, 28)                                                     |
| A card explained                   | Built   | Typed movements, status read from the facts, expiry and site, refunds back onto it, changes and cancellation with reasons (Phase 28) |

## 18. Reviews and reputation

| Item                   | Status  | Where                                             |
| ---------------------- | ------- | ------------------------------------------------- |
| Asking after a job     | Built   | `/reputation`, a day after the work, once per job |
| Routing by the answer  | Built   | Five invited publicly, three or less opens a talk |
| Who was not asked, why | Built   | The list that explains a low review count         |
| Satisfaction           | Built   | Refused below five answers rather than swinging   |
| Trend by site, person  | Built   | Ninety days against the ninety before (Phase 40)  |
| Closing a complaint    | Built   | With a stated outcome, enforced by the database   |
| Posting to Google      | Missing | Needs a place to send them. The invitation exists |

The routing is the feature and it is the thing businesses get backwards.
Asking everybody for a public review collects the one-star ones you could have
fixed. Asking privately first gives the unhappy customer a conversation
instead, which is what they wanted and is worth more than the review.

## 19. AI inside the workflow

| Item                          | Status   | Note                                                                                |
| ----------------------------- | -------- | ----------------------------------------------------------------------------------- |
| Customer summary of a job     | Built    | Composed from the job; a model may tidy it, checked against the record (Phase 17)   |
| Revenue observations          | Built    | Arithmetic with a sentence around it; silent under five jobs (Phase 17)             |
| A job read back to staff      | Built    | "Where does this job stand?" on the job, what is blocking first (Phase 22)          |
| Drafted messages to customers | Built    | Progress, decision, ready; no figure the job lacks; a person sends, once (Phase 22) |
| Every exchange recorded       | Built    | Who, kind, words, tokens, cost; a monthly budget per workshop (Phase 22)            |
| Fault suggestion              | Deferred | Needs a corpus of symptoms against confirmed causes that does not exist (ADR-0013)  |

The rule across the section is the one ADR-0013 states: it composes from the
record and decides nothing. Nothing it writes changes a record until a person
presses the button that does, and where a model is involved its output is
checked against the record before anybody sees it.

## 20. Owner command centre

**Built.** Asking a question in words and getting an answer from the data, at
`/ask`. A closed vocabulary routed to calculations the product already trusts,
with the working shown; anything outside it is refused with the list of what
can be asked. No model is involved.

## 21. Sidebar organisation

**Partial.** The sidebar is grouped by what somebody is doing and filtered by
role. The grouping differs from the one proposed, mostly because several
proposed sections do not exist yet.

## 21.5 The record's own history

| Item                           | Status | Where                                          |
| ------------------------------ | ------ | ---------------------------------------------- |
| Any record read as a life      | Built  | `/audit/[type]/[id]`, oldest first             |
| Who, what, when, before, after | Built  | Recorded since Phase 1, now readable           |
| What actually changed          | Built  | Field by field, unchanged fields left out      |
| Where it came from             | Built  | Device and address, no guessed location        |
| Credentials on screen          | Built  | Redacted at any depth, by the shape of the key |
| The chain behind a vehicle     | Built  | Shown apart, because it is a stronger claim    |
| Immutability                   | Built  | The database refuses to alter or delete a row  |

## 21.8 Getting in, and mail coming back

| Item                     | Status | Where                                              |
| ------------------------ | ------ | -------------------------------------------------- |
| Password reset           | Built  | `/forgot`, one hour, single use, ends all sessions |
| No account enumeration   | Built  | The same answer whether the address exists or not  |
| Email verification       | Built  | `/verify-email`, three days, opening twice is fine |
| Unverified banner        | Built  | Says what is lost, never locks anybody out         |
| Rate limiting            | Built  | Five an hour, and the limit reveals nothing        |
| Inbound mail from Resend | Built  | Signature verified over the exact request body     |
| Delivery confirmed       | Built  | Sent means accepted; delivered means it arrived    |
| Bounces and complaints   | Built  | Permanent bounces suppress, temporary ones do not  |
| Suppressed addresses     | Built  | On `/messages`, lifted by a person with a reason   |
| Replies per workshop     | Built  | Reply-To carries the workshop, not the sender      |
| Customer sign-up         | Built  | `/signup/customer`, then claim a vehicle by plate  |

A reset link and a verification link are the same mechanism with different
windows, so they are one table and one set of rules. The windows differ
because a reset is a key to an account and a verification is only proof of an
address.

## 22. The three connected experiences

**This is already the shape of the product**, and it is the reason the phases
ran in the order they did. The workshop side and the business side share one
ledger rather than two databases, and the customer side reads the same records
rather than a copy of them.

---

## 23. What the pilot needs

Written against the code on 14 September 2026, after an audit of forty
items a real workshop would ask for. Each is assigned a phase in the
[roadmap](06-roadmap.md); the rows here keep the counts honest.

| Item                                    | Status  | Where                                                                                                                                   |
| --------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Passports as a list                     | Built   | `/passports` for the workshop, `/portal/passports` for the owner (Phase 27)                                                             |
| Gift card expiry, status, reversal      | Built   | Phase 28                                                                                                                                |
| Country and currency per workshop       | Built   | Chosen at sign-up, changed in settings; every page formats from it (Phase 29)                                                           |
| Deposits and customer credit            | Built   | Taken on the customer, spent on the invoice, returned with a reason; a refund kept as credit (Phase 30)                                 |
| Receipts                                | Built   | Sent on every payment; printable at `/payments/[id]/receipt` (Phase 30)                                                                 |
| Card payment through a provider         | Built   | A seam with a stub and Stripe; "Pay now" in the portal; failed with a reason; reconciliation names differences (Phase 32)               |
| Payment links                           | Built   | "Pay now" in the portal, and a one-press sentence with the amount and the link from any conversation (Phase 36)                         |
| Workshop directory and booking anywhere | Built   | Every workshop on Carnet, findable; booking at a new one makes the customer its customer (Phase 32.5)                                   |
| Subscription lifecycle, billed          | Built   | Card before a 14-day trial, charged when it ends unless cancelled, reminded, past due, cancel at period end (Phase 32.6)                |
| Plan priced in the workshop's currency  | Built   | One price book, eleven currencies, read by the pricing page, sign-up, terms, reminder, billing page and the charge (Phase 32.7)         |
| Customer account page                   | Built   | Details, password, consent per workshop, sign out at /portal/settings (Phase 32.7)                                                      |
| Authorisation tried per role            | Built   | Every page as every role, every action read, another workshop's records not found: `verify-authz.ts` (Phase 31)                         |
| Plan limits enforced server side        | Built   | Refused where the thing is made, naming the plan; trial, grace, read-only and cancelled states (Phase 31)                               |
| Data import                             | Built   | CSV in, mapped from the headers, every problem by row and field, imported through the pages' own rules (Phase 33)                       |
| Whole-data export                       | Built   | Every dataset whole as CSV, the passports as JSON, or everything in one file (Phase 33)                                                 |
| Booking to job in one press             | Built   | "Car is here, start the job" opens the job with everything the booking knew; the booking converted in the same write (Phase 34)         |
| Estimate priced as it is raised         | Built   | Lines and totals written when the inspection raises the quote, so it can be sent (Phase 34)                                             |
| Approval recorded at the counter        | Built   | One press, under the customer's name and the staff member's, through the same decision the portal records (Phase 34)                    |
| Approval reserves the parts             | Built   | Approved part lines that name a stock item are reserved or put on the purchase list as the approval lands (Phase 34)                    |
| Extra work quoted mid-job               | Built   | A form on the job raises a supplementary quote and sends it; the work already approved carries on (Phase 34)                            |
| Press counts per hand-off               | Built   | The five workflows as a table in core, tested never to grow, generated into `02-design/11-workflows.md` (Phase 34)                      |
| Check-in                                | Built   | Mileage, fuel, a walk round the car, belongings, the hook, a signature and photographs, one press, once (Phase 35)                      |
| Check-out                               | Built   | What was done, what is owed, final mileage, what goes back, a signature; refused unfinished or unpaid without a reason (Phase 35)       |
| Signatures                              | Built   | A record of its own, strokes not pictures, with who, when, where; on check-in, check-out and counter approvals (Phase 35)               |
| Key tags                                | Built   | Hung, taken, returned, handed back as events; where they are now on the job and the technician's card (Phase 35)                        |
| Conversations                           | Built   | One thread per customer and per job over email, text, WhatsApp; unread first; reply from the job (Phase 36)                             |
| WhatsApp                                | Built   | A channel through the transport seam: console by default, Twilio's WhatsApp sender as the adapter; inbound accepted (Phase 36)          |
| Message templates                       | Built   | Sentences filled from the job, refused with a blank; five built in, any number a workshop's own (Phase 36)                              |
| Attachments, assignment, read state     | Built   | Files kept on the message; a thread assigned, read, closed, reopened by the next reply (Phase 36)                                       |
| Service packages                        | Built   | Labour, parts, fees, a checklist, a duration, a kind of work, a fixed price and an interval, saved whole (Phase 37)                     |
| A job from a package                    | Built   | One press on the new-job form, on a job already open, from a booking, or from the customer booking online (Phase 37)                    |
| The next service from a package         | Built   | Completing a job made from a recurring package sets the vehicle's schedule: due date and due mileage (Phase 37)                         |
| Languages                               | Built   | English, French and Arabic, the person's choice, kept on the account; Arabic right to left; public site, portal and shells (Phase 37.5) |
| Translation coverage                    | Built   | Every sentence passed to the translator has both translations or the script fails and names it (Phase 37.5)                             |
| Supplier returns                        | Built   | Faulty, wrong or not needed: off the shelf at cost, a credit due, the credit note off the bills oldest first (Phase 38)                 |
| Cores                                   | Built   | The old unit back without touching the shelf; its credit reduces the cost of parts (Phase 38)                                           |
| Credit held on a supplier account       | Built   | Credit that cannot be set against a bill is held, shown, and taken by the next bill booked (Phase 38)                                   |
| Sublet work                             | Built   | A vendor, a line on the job with its margin, the vendor's bill at the real cost, invoiced to the customer (Phase 38)                    |
| Global search                           | Built   | Plates however typed, VINs, phone digits, job, invoice and part numbers; an exact match goes straight to the record (Phase 39)          |
| Staff notifications                     | Built   | Approvals, messages, online bookings, card payments, part requests, to whoever would act; each opens its record (Phase 39)              |
| Tax by customer, site, or stacked       | Missing | One rate per line; Phase 41                                                                                                             |
| Printing, PDF, labels                   | Partial | Three pages print; Phase 42                                                                                                             |
| Onboarding checklist                    | Missing | Phase 45                                                                                                                                |
| Demonstration data                      | Missing | Phase 45                                                                                                                                |
| Help inside the product                 | Missing | Phase 45                                                                                                                                |

## What this adds up to

Counting individual capabilities rather than sections, both the table rows and
the sections given a single verdict:

<!-- counts:start -->

_Counted by `infra/scripts/build_deck.py`. Do not edit by hand._

| Status   | Capabilities |
| -------- | ------------ |
| Built    | 200          |
| Partial  | 2            |
| Missing  | 7            |
| Deferred | 1            |

<!-- counts:end -->

The missing work is grouped into phases 7 to 12 in the
[roadmap](06-roadmap.md). They are ordered by what a workshop loses by not
having them, which puts the inspection interface first: it is the one gap that
costs a workshop money every day it is absent.

_Next: [roadmap](06-roadmap.md)._
