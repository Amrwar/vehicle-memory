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
| Decoding a VIN             | Built  | Behind a seam: the maker and year built in, the model from the registry (Phase 43)                |
| Handover by invitation     | Built  | The seller starts it, the buyer accepts, the seller's access ends (Phase 44)                      |
| Labour rates per site      | Built  | A list per workshop, a site's own winning there (Phase 44)                                        |
| Part prices per site       | Built  | A figure a site holds, which does not move with the list                                          |
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

| Item                    | Status | Where                                             |
| ----------------------- | ------ | ------------------------------------------------- |
| Which vehicles it fits  | Built  | On the part, with the source of each claim        |
| Warning on a job        | Built  | Fires on a mismatch, silent on a match            |
| No data recorded        | Built  | Reads as unknown, never as fitting                |
| A fitment feed          | Built  | Behind a seam, with a sample feed (Phase 43)      |
| Where a claim came from | Built  | The feed and the date, or the person who typed it |

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

| Item                   | Status | Where                                                 |
| ---------------------- | ------ | ----------------------------------------------------- |
| Skill matrix           | Built  | `/skills`, at three levels with the date signed off   |
| Skill gaps             | Built  | A skill only one person holds is named                |
| Working hours          | Built  | `/patterns`, one row per person per weekday           |
| Holiday deduction      | Built  | Approved absence comes off capacity automatically     |
| Bonuses and deductions | Built  | On a sheet until its period is handed over (Phase 43) |
| Overtime multiplier    | Built  | The workshop's own, between plain and triple time     |
| Payroll export         | Built  | Three named shapes, the workshop's own by default     |

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

| Item                               | Status | Where                                                                                                                                |
| ---------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Automated campaigns                | Built  | `/automation`, trigger and conditions                                                                                                |
| Customer segments                  | Built  | `/crm`, with the reachable count                                                                                                     |
| Campaigns                          | Built  | Consent rechecked at the moment of sending                                                                                           |
| Loyalty programme                  | Built  | Points as a sum of entries, never a stored total                                                                                     |
| Earning points                     | Built  | A point a pound on a bill paid in full, once (Phase 24)                                                                              |
| Spending points                    | Built  | Off the bill on the invoice page, booked as the programme's cost (Phase 24)                                                          |
| Points in the portal               | Built  | Per workshop, with what they are worth and when they lapse (Phase 24)                                                                |
| Referrals                          | Built  | A code on the customer and in the portal; both sides paid, once, on a visit (Phase 25)                                               |
| A code at the counter              | Built  | On a new customer or an existing one, refused with a sentence (Phase 25)                                                             |
| Referral paid itself               | Built  | Both sides credited the moment the qualifying bill is paid (Phase 25)                                                                |
| Coupons                            | Built  | `/coupons`: a percentage or an amount, with dates, a least bill and limits per code and per customer (Phase 45.5)                    |
| A coupon on a bill                 | Built  | Settled like points: the invoice keeps its total, the discount posts to what the offers cost (Phase 45.5)                            |
| A coupon at the counter            | Built  | A tender of its own kind, so the drawer only expects what was handed over (Phase 45.5)                                               |
| What the offers cost               | Built  | What each code gave away beside what was billed on the visits it was used on (Phase 45.5)                                            |
| Gift cards                         | Built  | `/gift-cards`: sold as a liability, spent on the invoice as its own payment kind (Phase 26)                                          |
| A card on a bill or at the counter | Built  | Amount optional; refused rather than clamped; the bank untouched (Phases 26, 28)                                                     |
| A card explained                   | Built  | Typed movements, status read from the facts, expiry and site, refunds back onto it, changes and cancellation with reasons (Phase 28) |

## 18. Reviews and reputation

| Item                   | Status | Where                                              |
| ---------------------- | ------ | -------------------------------------------------- |
| Asking after a job     | Built  | `/reputation`, a day after the work, once per job  |
| Routing by the answer  | Built  | Five invited publicly, three or less opens a talk  |
| Who was not asked, why | Built  | The list that explains a low review count          |
| Satisfaction           | Built  | Refused below five answers rather than swinging    |
| Trend by site, person  | Built  | Ninety days against the ninety before (Phase 40)   |
| Closing a complaint    | Built  | With a stated outcome, enforced by the database    |
| Posting to Google      | Built  | The listing is named, the five-star answer is sent |
| Warranty at cost       | Built  | Settled claims at parts and hours cost (Phase 44)  |
| What warranty costs    | Built  | By period, by part and by supplier, with a CSV     |
| Who went to say so     | Built  | Counted on `/reputation` (Phase 43)                |

The routing is the feature and it is the thing businesses get backwards.
Asking everybody for a public review collects the one-star ones you could have
fixed. Asking privately first gives the unhappy customer a conversation
instead, which is what they wanted and is worth more than the review.

## 19. AI inside the workflow

| Item                          | Status | Note                                                                                                                         |
| ----------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Customer summary of a job     | Built  | Composed from the job; a model may tidy it, checked against the record (Phase 17)                                            |
| Revenue observations          | Built  | Arithmetic with a sentence around it; silent under five jobs (Phase 17)                                                      |
| A job read back to staff      | Built  | "Where does this job stand?" on the job, what is blocking first (Phase 22)                                                   |
| Drafted messages to customers | Built  | Progress, decision, ready; no figure the job lacks; a person sends, once (Phase 22)                                          |
| Every exchange recorded       | Built  | Who, kind, words, tokens, cost; a monthly budget per workshop (Phase 22)                                                     |
| Fault suggestion              | Built  | The corpus is built from what technicians confirm, and reported as counts; nothing is shown under three (ADR-0016, Phase 81) |

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

**Built.** Written per role, in the order that role works in: thirteen sections
for an owner, eight for a service advisor beginning at Today and ending at
Payments, six for a bookkeeper, none for a technician because their shell is
`/shop`. Phase 80.

Two rules are checked rather than trusted. Every page in the workshop is in the
owner's navigation or is recorded with the way it is reached instead — which
found `/patterns`, somebody's contracted hours, built and reachable from
nowhere. And no role is shown an entry their permissions would refuse — which
found ten, four of them the whole of a technician's draft sidebar. Every one of
the sixty words in it is asked of the dictionary directly, because a section
heading is data and no scanner in the product could see it.

## 21.4 On a telephone

| Item                          | Status | Where                                                               |
| ----------------------------- | ------ | ------------------------------------------------------------------- |
| Nothing wider than the screen | Built  | Measured on 47 screens at 390px; tables scroll inside their own box |
| Targets a thumb can hit       | Built  | 40px for a control, 24px for a standalone link, on touch screens    |
| Nothing under eleven pixels   | Built  | Labels raised from ten; measured with the rest                      |
| Right to left on a phone      | Built  | The same screens measured again in Arabic                           |

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

## 21.9 Asked twice, done once

| Item                              | Status | Where                                                                                       |
| --------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| A button that goes quiet          | Built  | Disabled and saying so while its form is in flight (Phase 46)                               |
| A double-click that costs nothing | Built  | A key minted with the form; the same press is absorbed (Phase 46)                           |
| One posting per document          | Built  | `journal_entries_one_per_document`, so a retried post is free (Phase 46)                    |
| A queue two workers share         | Built  | Claimed in one statement, with a lease that expires (Phase 46)                              |
| Points that arrive once           | Built  | Keyed on what they are the one-and-only of (Phase 46)                                       |
| Points that arrive at all         | Built  | What a crash loses between payment and award is swept up hourly (Phase 46)                  |
| A provider asked twice            | Built  | An idempotency key and a timeout on every write to Stripe (Phase 46)                        |
| Every money write declared        | Built  | 59 writes, each saying what a repeat does; the build fails for one that does not (Phase 46) |

## 21.10 Built, and now reachable

A sweep for anything written, tested and impossible to find. These were.

| Item                           | Status | Where                                                                               |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------- |
| Correcting a customer          | Built  | `/customers/[id]/edit`, the same fields as taking them down (Phase 46.5)            |
| Starting a stock transfer      | Built  | One press on a suggestion; nothing leaves a shelf until it is sent (Phase 46.5)     |
| Sending, receiving, cancelling | Built  | `/transfers/[id]`; a short delivery stays open until the rest turns up (Phase 46.5) |
| Recording warranty cover       | Built  | On `/warranty`, against a finished job, with whose warranty backs it (Phase 46.5)   |
| Checking a vehicle, as a buyer | Built  | `/verify` is in the public navigation and the footer (Phase 46.5)                   |
| An account opened is an email  | Built  | Whoever runs Carnet is told, before the address is verified (Phase 46.5)            |

## 21.11 Wired at both ends

The second sweep: things connected at one end only.

| Item                       | Status | Where                                                                       |
| -------------------------- | ------ | --------------------------------------------------------------------------- |
| "Your car is ready"        | Built  | Sent when a job moves, for the stages worth sending (Phase 46.6)            |
| A booking confirmation     | Built  | Queued in the booking's own transaction, and actually sent (Phase 46.6)     |
| Rules that run             | Built  | Eight triggers fired from their moments, three swept hourly (Phase 46.6)    |
| Actions that happen        | Built  | Tasks created, jobs tagged; anything unimplemented fails aloud (Phase 46.6) |
| A purchase order on a job  | Built  | Typed on the job, so a fleet that requires one can be invoiced (Phase 46.6) |
| The right door for a buyer | Built  | Somebody accepting a vehicle signs up as a customer (Phase 46.6)            |
| Cashing up answers         | Built  | Says whether the drawer is over or short (Phase 46.6)                       |

## 21.12 What the customer could not see

| Item                        | Status | Where                                                                            |
| --------------------------- | ------ | -------------------------------------------------------------------------------- |
| Money held, in the portal   | Built  | Grouped by workshop, with what it comes off next (Phase 46.7)                    |
| Credit notes, in the portal | Built  | On the bill they were raised against (Phase 46.7)                                |
| Correcting a passport entry | Built  | A new entry supersedes the old; both stay, the chain still verifies (Phase 46.7) |
| Withdrawing a quote link    | Built  | Shown with where it went and whether it was opened (Phase 46.7)                  |
| A way back from the floor   | Built  | For anybody who is not a technician (Phase 46.7)                                 |

## 21.13 The books agree with themselves

| Item                         | Status | Where                                                                           |
| ---------------------------- | ------ | ------------------------------------------------------------------------------- |
| Every entry balances alone   | Built  | One at a time, so two wrong in opposite directions are both found (Phase 47)    |
| An invoice against its lines | Built  | Recomputed, never read back from the stored total (Phase 47)                    |
| Paid, credited, refunded     | Built  | What is owed is the bill less both, plus what was handed back (Phase 47)        |
| A shelf against its history  | Built  | Held to the balance its last movement recorded (Phase 47)                       |
| The ledger against the bills | Built  | Receivable, gift cards outstanding and money held, all three bridged (Phase 47) |
| A closed period stays closed | Built  | Read from the rows, not from the guard that refuses it (Phase 47)               |
| Named to the penny           | Built  | No tolerance: integer minor units end to end (Phase 47)                         |
| `/books`                     | Built  | The whole audit on a page, worst first, in three languages (Phase 47)           |

## 21.14 One workshop cannot reach another

| Item                           | Status | Where                                                                   |
| ------------------------------ | ------ | ----------------------------------------------------------------------- |
| Every address declared         | Built  | Read off the filesystem; an undeclared one fails the check (Phase 48)   |
| Not found, never forbidden     | Built  | A refusal that confirms nothing exists (Phase 48)                       |
| The customer's side            | Built  | Another customer's vehicle, passport and quote are not there (Phase 48) |
| Writes, not only reads         | Built  | Five write paths called the way their forms call them (Phase 48)        |
| Stock on somebody else's shelf | Built  | Closed in `lockLevel`, where every movement goes through (Phase 48)     |
| Exports and reports            | Built  | Carry only the workshop that asked (Phase 48)                           |
| A token nobody issued          | Built  | Shows nothing, signs nobody in (Phase 48)                               |
| A real link from a made-up one | Built  | Identical, character for character (Phase 48)                           |
| A passport a buyer may read    | Built  | The car, and nothing about who owns it (Phase 48)                       |

## 21.15 Carnet came back

| Item                       | Status | Where                                                                        |
| -------------------------- | ------ | ---------------------------------------------------------------------------- |
| A restore, not a backup    | Built  | Dumped, restored into a fresh database, held against the original (Phase 49) |
| Two measured numbers       | Built  | Work lost and time taken, against NFR-303 and NFR-304 (Phase 49)             |
| Migrations on the copy     | Built  | A restored copy needs none to be usable (Phase 49)                           |
| Passports, triggers, books | Built  | All three checked in the copy, not only the row counts (Phase 49)            |
| Files the rows point at    | Built  | Checked, and proved by taking one away (Phase 49)                            |
| Files nothing points at    | Built  | Reported, and removable with `npm run storage:orphans` (Phase 49)            |
| Work still in the queue    | Built  | Comes back, and none of it is stuck for ever (Phase 49)                      |
| What it did not measure    | Built  | Said in the output rather than assumed (Phase 49)                            |

## 21.16 How Carnet itself is

| Item                         | Status | Where                                                                |
| ---------------------------- | ------ | -------------------------------------------------------------------- |
| One page for the operator    | Built  | `/admin/health`, 22 things across six panels (Phase 50)              |
| Four standings, not two      | Built  | Working, struggling, not working, never used (Phase 50)              |
| As bad as its worst part     | Built  | Never an average, which is what gets a page ignored (Phase 50)       |
| Why a message did not arrive | Built  | One search box, one sentence, and the next move (Phase 50)           |
| A block beats a status       | Built  | And consent beats both, without reading as a failure (Phase 50)      |
| Held, against stuck          | Built  | Told apart though they share one column (Phase 50)                   |
| Not for a workshop           | Built  | Not found for an owner; nobody at all without an operator (Phase 50) |

## 21.17 Quick at the size of a real workshop

| Item                      | Status | Where                                                                     |
| ------------------------- | ------ | ------------------------------------------------------------------------- |
| A workshop three years in | Built  | `npm run db:scale`: 100k customers, 500k jobs, 2M audit rows (Phase 51)   |
| A budget per screen       | Built  | 22 screens, p95 over 20 samples, each budget naming its source (Phase 51) |
| Statements                | Built  | 11,981ms to 136ms: the buckets are summed, not fetched (Phase 51)         |
| Relationships             | Built  | 57s to 3.3s: read once, not once per segment, and summed (Phase 51)       |
| The week's figures        | Built  | 1,653ms to 269ms (Phase 51)                                               |
| The dashboard             | Built  | 1,405ms to 297ms (Phase 51)                                               |
| The job page              | Built  | 505ms to 161ms: it no longer files messages on your time (Phase 51)       |
| Vehicles and passports    | Built  | One indexed path instead of an OR of two subqueries (Phase 51)            |
| Close to the line         | Built  | Named, because those fail first at twice the data (Phase 51)              |

## 21.18 The workshop's own clock

| Item                              | Status | Where                                                                     |
| --------------------------------- | ------ | ------------------------------------------------------------------------- |
| Nine stretches of the work        | Built  | Car in to job open, through to invoiced to paid (Phase 52)                |
| From records already kept         | Built  | Two timestamps each; nothing instrumented to be measured (Phase 52)       |
| The middle, not the average       | Built  | With the slowest tenth beside it (Phase 52)                               |
| Says when it does not know        | Built  | Coverage stated; no figure at all below five jobs (Phase 52)              |
| Targets that argue for themselves | Built  | Each says it is a judgement and why (Phase 52)                            |
| Before a pilot and after          | Built  | `--record` and `--against`, refusing thin comparisons (Phase 52)          |
| A seeded clock that is real       | Built  | The seed settles every job's moments, so the demo is not a lie (Phase 52) |

## 21.19 The awkward cases

| Item                        | Status | Where                                                            |
| --------------------------- | ------ | ---------------------------------------------------------------- |
| Thirteen decisions, written | Built  | `AWKWARD` in core: situation, decision, reason (Phase 53)        |
| Cancelling gives parts back | Built  | Fixed: they were reserved for ever (Phase 53)                    |
| They paid too much          | Built  | Refused, then settled and held in one press (Phase 53)           |
| No VIN, or a duplicate one  | Built  | Allowed, and refused, respectively (Phase 53)                    |
| Negative stock              | Built  | Allowed, and visible, rather than blocking the work (Phase 53)   |
| A stocktake mid-job         | Built  | Counts the shelf, leaves reservations alone (Phase 53)           |
| The price moved after yes   | Built  | The agreed price is the price (Phase 53)                         |
| A refund after the close    | Built  | Posted in the open period, dated today (Phase 53)                |
| Sold off the ramp           | Built  | Asked first; the bill stays with whoever agreed to it (Phase 53) |

## 21.20 What you are using

| Item                       | Status | Where                                                                                    |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------- |
| Uptake, per capability     | Built  | `/reports/uptake`: forty-one capabilities over 30, 90 or 365 days (Phase 54)             |
| Counted from what is kept  | Built  | The audit log, read for the first time; nothing instrumented (Phase 54)                  |
| Worth a conversation       | Built  | What nobody used, and what one pair of hands used (Phase 54)                             |
| Expected of every workshop | Built  | Twelve marked so; a fleet page nobody opens is not a failing (Phase 54)                  |
| The register is checked    | Built  | `unmapped()` fails on any audited action with no capability (Phase 54)                   |
| What it does not see       | Built  | Said on the page: writing, not looking, and why (Phase 54)                               |
| The pilot's four sources   | Built  | `verify:pilot`: what broke, what was slow, what was missing, what nobody used (Phase 54) |
| The pilot plan             | Built  | Who, what is measured, what ends it early, what success is (Phase 54)                    |

## 21.21 The four things that are not features

| Item                          | Status | Where                                                                          |
| ----------------------------- | ------ | ------------------------------------------------------------------------------ |
| Every check is run            | Built  | `verify:throughout`: twenty-six scripts that nothing ran, now in CI (Phase 55) |
| Every gate is in the workflow | Built  | Including the translator scan, which was in none of it (Phase 55)              |
| Every screen is measured      | Built  | 128 addresses read off the app directory, not 52 typed by hand (Phase 55)      |
| A broken page is not measured | Built  | An error inside a 200 is refused rather than timed or sized (Phase 55)         |
| Every list has a bound        | Built  | A `take`, an identifier, or a written reason — checked (Phase 55)              |
| Statements summed in the DB   | Built  | `/ledger` and `/financials` no longer read every posting ever made (Phase 55)  |
| Nothing waits on blank        | Built  | Seven loading boundaries, the customer's whole side included (Phase 55)        |
| The referral card opens       | Built  | Fixed: it threw for anybody who had ever referred a friend (Phase 55)          |
| The demonstration prices work | Built  | Fixed: the seeded workshop had no labour rate at all (Phase 55)                |

## 21.22 The other half of the requirements

| Item                           | Status | Where                                                                                  |
| ------------------------------ | ------ | -------------------------------------------------------------------------------------- |
| Every quality budget accounted | Built  | `verify:quality`: 47 checked, 15 read off the repository, 22 not yet (Phase 56)        |
| What it would take, written    | Built  | Each of the twenty-two says what it needs — a person, a month, a deployment (Phase 56) |
| Nothing secret in a log        | Built  | Credentials, tokens and card details taken out by name before writing (Phase 56)       |
| Safari and Firefox             | Built  | `verify:engines`: sixty screens in three engines, Arabic included (Phase 56)           |
| An unstyled page is not narrow | Built  | A page whose stylesheet did not arrive is refused, not measured (Phase 56)             |

## 21.23 Before the workshop rings

| Item                         | Status | Where                                                                               |
| ---------------------------- | ------ | ----------------------------------------------------------------------------------- |
| The operator is told         | Built  | `sweepAlerts()` on the hourly job; one message to the one address (Phase 57)        |
| A runbook per signal         | Built  | 22 entries: what it means, the first thing to do, what fixed looks like (Phase 57)  |
| No action, no alert          | Built  | A signal with no entry is reported as needing one, and the check fails (Phase 57)   |
| Once, not six times          | Built  | Six hours quiet; immediately if it gets worse; cleared once (Phase 57)              |
| Sent means sent              | Built  | A message that did not leave is not written down as sent (Phase 57)                 |
| The first action on the page | Built  | `/admin/health` shows it beside each fault, and whether you were told (Phase 57)    |
| The runbook, translated      | Built  | Checked, because it reaches the translator as a variable no scanner sees (Phase 57) |

## 21.24 Configured to do anything

| Item                        | Status | Where                                                                            |
| --------------------------- | ------ | -------------------------------------------------------------------------------- |
| Every setting accounted for | Built  | 47 settings, each saying what a workshop would feel without it (Phase 58)        |
| Silent before loud          | Built  | A console mail transport is reported before a missing database (Phase 58)        |
| Present and still not set   | Built  | `console`, `stub`, `localhost` are read as pretending, not as set (Phase 58)     |
| Checked against the source  | Built  | Not only the schema: 14 settings bypass it, STORAGE_DRIVER among them (Phase 58) |
| One command before day one  | Built  | `npm run launch:handover` against the deployment itself (Phase 58)               |
| No value ever printed       | Built  | Names and verdicts only, so it can be run against production (Phase 58)          |

## 21.25 One press, followed through

| Item                            | Status | Where                                                                               |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------- |
| One identifier per request      | Built  | Minted in the proxy, returned on the response, readable down a telephone (Phase 59) |
| Carried by everything it causes | Built  | The audit row, the outbox event, the message, the notification (Phase 59)           |
| Inherited by the job            | Built  | The event carries it; the worker puts it back, one context per event (Phase 59)     |
| Never invented                  | Built  | A scheduled sweep has none, and the column stays nullable (Phase 59)                |
| Followed on one screen          | Built  | `/admin/health` takes a trace and shows the chain in order (Phase 59)               |
| The rule is enforced            | Built  | A write that does not stamp it fails a check, by file and line (Phase 59)           |

## 21.26 What the screen does while somebody waits

| Item                    | Status | Where                                                                      |
| ----------------------- | ------ | -------------------------------------------------------------------------- |
| Paint, measured         | Built  | LCP in the browser over Slow 4G, eleven screens, budget 2 s (Phase 60)     |
| Layout shift, measured  | Built  | CLS on the same runs, budget 0.1, zero everywhere (Phase 60)               |
| The connection is named | Built  | 1600 kbps, 150 ms, processor slowed 4× — written down (Phase 60)           |
| The middle run counts   | Built  | Three runs; not the best, not one bad collection (Phase 60)                |
| Zero means something    | Built  | A control shifts a real page and proves the measurement sees it (Phase 60) |
| Broken is not slow      | Built  | A page that fell over is reported as broken, never timed (Phase 60)        |

## 21.27 The rows that were never there

| Item                     | Status | Where                                                                     |
| ------------------------ | ------ | ------------------------------------------------------------------------- |
| Every requirement traced | Built  | 751 rows, each read against the source rather than generated (Phase 61)   |
| Named tests exist        | Built  | 34 rows pointed at files renamed years earlier; now corrected (Phase 61)  |
| Named functions exist    | Built  | Checked against the source, which is how a matrix usually dies (Phase 61) |
| What is missing says so  | Built  | Five requirements the product does not meet, named in bold (Phase 61)     |
| The summary cannot drift | Built  | Counted from the table and compared with it on every build (Phase 61)     |

## 21.28 Being forgotten

| Item                            | Status | Where                                                                                                     |
| ------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| The register of what we hold    | Built  | 14 holdings: table, what of theirs is in it, what happens, and why (Phase 62)                             |
| Take everything                 | Built  | Machine-readable, including the kinds we hold none of, on the customer (Phase 62)                         |
| Be forgotten                    | Built  | Name, address, login and signature gone; checked by searching every text column of every table (Phase 62) |
| The books survive it            | Built  | Totalled before and after and compared; invoices kept seven years (Phase 62)                              |
| The passport survives it        | Built  | Chain valid and exactly as long; it carries a keeper number, never a name (Phase 62)                      |
| The audit log gives up the copy | Built  | One permitted mutation: emptying the copy of the values, nothing else (Phase 62)                          |
| No name in the chain            | Built  | ADR-0014, checked over every name the database holds; the seed was breaking it (Phase 62)                 |
| Every sentence answered         | Built  | `i18n-scan --answers`: 3,877 sentences on the pages, in French and Arabic (Phase 62)                      |

## 21.29 Two workshops, one person

| Item                            | Status | Where                                                                                              |
| ------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| Belonging to two workshops      | Built  | Always possible in the schema; steerable since Phase 63                                            |
| Choosing which one              | Built  | `/choose` at sign-in when there is more than one; one workshop is not a choice (Phase 63)          |
| Switching                       | Built  | The workshop's name in the navigation, when there is somewhere to go (Phase 63)                    |
| Held on the session             | Built  | Nothing the request carries decides which tenant anybody is in (Phase 63)                          |
| The role follows the workshop   | Built  | Manager at one, technician at the other, and the permissions move with them (Phase 63)             |
| Leaving one is leaving one      | Built  | Removal ends sessions in that workshop only — it ended all of them before (Phase 63)               |
| Entering is on the record       | Built  | `session.entered` in the audit log of the workshop entered (Phase 63)                              |
| The invitation needs a password | Built  | For an address that already has an account: the link alone signed you in as them before (Phase 63) |

## 21.30 The list somebody typed

| Item                          | Status | Where                                                                                  |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------- |
| The tenant set, generated     | Built  | From `schema.prisma`; CI fails when the two disagree (Phase 64)                        |
| Every model decided about     | Built  | Scoped, global with a reason, or a child named with its parent — no default (Phase 64) |
| Children name their parent    | Built  | A scan by file and line over every read of a model with no organisation (Phase 64)     |
| The filter proved, not stated | Built  | A row written as one workshop and asked for as another (Phase 64)                      |
| The report that was leaking   | Fixed  | `/reports` showed every technician on Carnet, by name, with cost rates (Phase 64)      |

## 21.31 The scripts nobody type-checked

| Item                         | Status | Where                                                                         |
| ---------------------------- | ------ | ----------------------------------------------------------------------------- |
| Every file inside a tsconfig | Built  | 709 files; a stray one fails a check by name (Phase 65)                       |
| The scripts type-checked     | Built  | `typecheck:scripts`; the compiler found 31 errors on its first run (Phase 65) |
| The seed type-checked        | Built  | `typecheck:prisma`; it sits outside the db package's rootDir (Phase 65)       |
| Unbounded reads named        | Built  | `ALL_TIME`, so a deliberate one can be told from a forgotten one (Phase 65)   |

## 21.32 Chasing something later

| Item                         | Status | Where                                                                                |
| ---------------------------- | ------ | ------------------------------------------------------------------------------------ |
| A follow-up on a job         | Built  | A note, a date, and who it is for if anybody (Phase 66)                              |
| Late says how late           | Built  | "9 days late", in words rather than a colour; worst first (Phase 66)                 |
| Where the day starts         | Built  | On the dashboard beside what else needs doing today (Phase 66)                       |
| And on the technician's own  | Built  | What was given to them, on the shop floor screen (Phase 66)                          |
| Told once, by name           | Built  | `notifyOne`, rather than the broadcast that suits "a part is needed" (Phase 66)      |
| Who did it                   | Built  | The question asked when a customer says nobody rang (Phase 66)                       |
| Gone when they are forgotten | Built  | A note naming somebody is removed, not anonymised (Phase 66, register from Phase 62) |

## 21.33 The courtesy car

| Item                      | Status | Where                                                                                |
| ------------------------- | ------ | ------------------------------------------------------------------------------------ |
| The cars we lend          | Built  | Declared in settings; a vehicle the workshop already works on (Phase 67)             |
| Promised for a period     | Built  | On the job, where the keys change hands (Phase 67)                                   |
| Never to two people       | Built  | An exclusion constraint, not a check the code has to remember (Phase 67)             |
| Which are free            | Built  | Over the same `overlaps()` the diary uses for bays (Phase 67)                        |
| Not if it is not legal    | Built  | MOT or insurance expiring mid-loan, from the certificates already on file (Phase 67) |
| What is out, and how late | Built  | "4 days overdue", in words rather than a colour (Phase 67)                           |
| Back, with the odometer   | Built  | When, who took it, and what was on the clock (Phase 67)                              |

## 21.34 One English sentence, one meaning

| Item                        | Status  | Where                                                                             |
| --------------------------- | ------- | --------------------------------------------------------------------------------- |
| Two pages, one word         | Fixed   | Seven English words that meant two things, mended in English (Phase 68)           |
| A new clash fails the build | Built   | `verify-dictionary.ts`, over the area files rather than the merged map (Phase 68) |
| The rest, counted           | Partial | 221 remain, sorted by kind and frozen so the number can only fall (Phase 83)      |

## 21.35 What the fleet calls it

| Item                      | Status | Where                                                                  |
| ------------------------- | ------ | ---------------------------------------------------------------------- |
| A fleet's own number      | Built  | On the customer's relationship with the van, not on the van (Phase 69) |
| Found from the search box | Built  | Matched whole, so "17" does not drag back 170 and 178 (Phase 69)       |
| One number, one van       | Built  | Refused by the database, case and spacing ignored (Phase 69)           |
| Freed when the van goes   | Built  | Available again for whichever van replaces it (Phase 69)               |

## 21.36 A red that tells you what to do

| Item                            | Status | Where                                                                          |
| ------------------------------- | ------ | ------------------------------------------------------------------------------ |
| The checks, in CI's order       | Built  | `npm run checks`, read out of the workflow rather than a typed list (Phase 70) |
| Preconditions said once         | Built  | A dirty database is one sentence, not seven failures (Phase 70)                |
| Probes measure their own effect | Built  | `verify-money` counts this run's messages, by id (Phase 70)                    |
| The expense counter             | Fixed  | The seed wrote three expenses and no counter for them (Phase 70)               |
| Uptake counts everything        | Fixed  | 23 audited actions belonged to no capability and counted as nothing (Phase 70) |

## 21.37 Working the dictionary down

| Item                  | Status  | Where                                                                             |
| --------------------- | ------- | --------------------------------------------------------------------------------- |
| Near-synonyms unified | Built   | 16 keys, 38 entries; the owning area keeps the word (Phase 71)                    |
| Two meanings split    | Built   | Journal entries, Source of business — mended in English (Phase 71)                |
| The rest              | Partial | 221: 27 need a qualifier, 10 a spelling chosen, 184 the English mended (Phase 83) |

## 21.38 The passport outlives the workshop

| Item                                | Status | Where                                                                                 |
| ----------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| A workshop with entries is retired  | Fixed  | `ON DELETE RESTRICT`; deleting one used to break every car it touched (Phase 72)      |
| Every hashed column is immutable    | Fixed  | `recordedByOrgId` joins the append-only trigger's list (Phase 72)                     |
| Taking the demonstration away       | Built  | Its cars go first; a real car's entry keeps the workshop alive, retired (Phase 72)    |
| A break that says what broke it     | Built  | `verify-integrity` names a deleted workshop rather than implying tampering (Phase 72) |
| Asked of the database, not the code | Built  | `npm run verify:survival` (Phase 72)                                                  |

## 21.39 A page that is not there says so

| Item                           | Status | Where                                                                           |
| ------------------------------ | ------ | ------------------------------------------------------------------------------- |
| Dead links answer 404          | Fixed  | Share, handover and review links; every one answered 200 before (Phase 73)      |
| A car that is not yours        | Fixed  | The portal decides before it streams (Phase 73)                                 |
| The loading screen stays       | Built  | Drawn per route now, and inside the pages that have to decide first (Phase 73)  |
| The rule, enforced             | Built  | `npm run verify:status` reads the route tree and ADR-0015 (Phase 73)            |
| One place for the trial length | Fixed  | The front door renders `TRIAL_DAYS`; three copies had drifted to two (Phase 73) |

## 21.40 The browser nobody installed

| Item                         | Status | Where                                                                                              |
| ---------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| The engines, installed first | Fixed  | Chromium was never installed at all; three checks launch it (Phase 74)                             |
| With their libraries         | Fixed  | `--with-deps`: WebKit and Firefox need thirty-odd shared objects the runner has not got (Phase 74) |
| Asserted, not assumed        | Built  | `verify-throughout` reads each check's Playwright import (Phase 74)                                |

## 21.41 A button that would not wrap

| Item                       | Status | Where                                                                               |
| -------------------------- | ------ | ----------------------------------------------------------------------------------- |
| Labels wrap when they must | Fixed  | Every button carried `whitespace-nowrap`; one label widened a whole form (Phase 75) |
| Nothing wider than 320px   | Held   | Measured on every route, on the platform CI runs (Phase 75)                         |

## 21.42 A check that skipped itself

| Item                          | Status | Where                                                                             |
| ----------------------------- | ------ | --------------------------------------------------------------------------------- |
| The signed webhook, exercised | Fixed  | `PAYMENT_WEBHOOK_SECRET` in the workflow; the path had never run in CI (Phase 76) |
| No quiet skip                 | Fixed  | Both probes fail and name the remedy (Phase 76)                                   |

## 21.43 The section that never ran

| Item                               | Status | Where                                                                        |
| ---------------------------------- | ------ | ---------------------------------------------------------------------------- |
| The demonstration's books, audited | Fixed  | 241 checks on a workshop built by the product; had never run once (Phase 77) |
| The teardown, exercised            | Built  | Cars and made-up history before the workshop (Phase 77)                      |
| No quiet skip anywhere             | Fixed  | Four probes fail and name the remedy (Phase 77)                              |
| And a guard against the next one   | Built  | `verify-throughout` names any probe that prints a skip (Phase 77)            |

## 21.44 A figure that happened to fit

| Item                          | Status | Where                                                                          |
| ----------------------------- | ------ | ------------------------------------------------------------------------------ |
| A credit bigger than the bill | Held   | Applied as far as the bill owes, the rest held against the supplier (Phase 78) |
| The check asserts the rule    | Fixed  | Not one instance of it that depended on a shelf it did not own (Phase 78)      |

## 21.45 What the shelf lost, and what the supplier owes

| Item                                | Status | Where                                                                     |
| ----------------------------------- | ------ | ------------------------------------------------------------------------- |
| The credit offered is what was paid | Fixed  | It offered the shelf's average: £77.82 for parts that cost £20 (Phase 79) |
| A core is offered at its charge     | Fixed  | It offered nothing, because a core holds no stock value (Phase 79)        |
| The stock value still shown         | Built  | Beside the return, and still what comes off the books (Phase 79)          |

## 21.46 Whose move it is

| Item                          | Status | Where                                                                       |
| ----------------------------- | ------ | --------------------------------------------------------------------------- |
| Every job's position          | Built  | Whose move, how long, why, and one action — `/now` (Phase 84)               |
| Ranked by what can be changed | Built  | Late first, then ours, then longest waiting (Phase 84)                      |
| The estimate nobody sent      | Built  | Reported as the workshop's own, not the customer's (Phase 84)               |
| Derived, never stored         | Built  | A part on order moves it; fitting it moves it back, with no edit (Phase 84) |

## 21.47 The gate gets a key

| Item                            | Status | Where                                                                                       |
| ------------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| Recording a quality check       | Fixed  | FR-612 gated completion since Phase 1 and nothing could record one (Phase 85)               |
| The workshop's own sheet        | Built  | Twelve lines to start, each renameable, optional or retired (Phase 85)                      |
| Ticks and figures               | Built  | A road test result is not a tick; the database refuses an answer that is neither (Phase 85) |
| The outcome follows the answers | Built  | Nothing sends "pass"; an unanswered required line cannot pass (Phase 85)                    |
| A fail goes back to the bench   | Built  | Naming the lines, rather than into a queue nobody owns (Phase 85)                           |

## 21.48 Why it came back

| Item                        | Status | Where                                                                               |
| --------------------------- | ------ | ----------------------------------------------------------------------------------- |
| The case file               | Built  | The whole original job on one screen, in the order somebody asks it (Phase 86)      |
| Assembled, never re-entered | Built  | Every line read off the original job, so it cannot disagree with it (Phase 86)      |
| Seven named causes          | Built  | Four the workshop's own, three not, and the line is the point (Phase 86)            |
| Ours counted apart          | Built  | A rate that blames a workshop for a flood is a rate nobody believes (Phase 86)      |
| A pattern is cars           | Built  | Three different cars after the same repair, not one car back three times (Phase 86) |
| A cause needs a comeback    | Built  | Refused by the code and by a database check constraint (Phase 86)                   |

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

| Item                                    | Status | Where                                                                                                                                   |
| --------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Passports as a list                     | Built  | `/passports` for the workshop, `/portal/passports` for the owner (Phase 27)                                                             |
| Gift card expiry, status, reversal      | Built  | Phase 28                                                                                                                                |
| Country and currency per workshop       | Built  | Chosen at sign-up, changed in settings; every page formats from it (Phase 29)                                                           |
| Deposits and customer credit            | Built  | Taken on the customer, spent on the invoice, returned with a reason; a refund kept as credit (Phase 30)                                 |
| Receipts                                | Built  | Sent on every payment; printable at `/payments/[id]/receipt` (Phase 30)                                                                 |
| Card payment through a provider         | Built  | A seam with a stub and Stripe; "Pay now" in the portal; failed with a reason; reconciliation names differences (Phase 32)               |
| Payment links                           | Built  | "Pay now" in the portal, and a one-press sentence with the amount and the link from any conversation (Phase 36)                         |
| Workshop directory and booking anywhere | Built  | Every workshop on Carnet, findable; booking at a new one makes the customer its customer (Phase 32.5)                                   |
| Subscription lifecycle, billed          | Built  | Card before a 14-day trial, charged when it ends unless cancelled, reminded, past due, cancel at period end (Phase 32.6)                |
| Plan priced in the workshop's currency  | Built  | One price book, eleven currencies, read by the pricing page, sign-up, terms, reminder, billing page and the charge (Phase 32.7)         |
| Customer account page                   | Built  | Details, password, consent per workshop, sign out at /portal/settings (Phase 32.7)                                                      |
| Authorisation tried per role            | Built  | Every page as every role, every action read, another workshop's records not found: `verify-authz.ts` (Phase 31)                         |
| Plan limits enforced server side        | Built  | Refused where the thing is made, naming the plan; trial, grace, read-only and cancelled states (Phase 31)                               |
| Data import                             | Built  | CSV in, mapped from the headers, every problem by row and field, imported through the pages' own rules (Phase 33)                       |
| Whole-data export                       | Built  | Every dataset whole as CSV, the passports as JSON, or everything in one file (Phase 33)                                                 |
| Booking to job in one press             | Built  | "Car is here, start the job" opens the job with everything the booking knew; the booking converted in the same write (Phase 34)         |
| Estimate priced as it is raised         | Built  | Lines and totals written when the inspection raises the quote, so it can be sent (Phase 34)                                             |
| Approval recorded at the counter        | Built  | One press, under the customer's name and the staff member's, through the same decision the portal records (Phase 34)                    |
| Approval reserves the parts             | Built  | Approved part lines that name a stock item are reserved or put on the purchase list as the approval lands (Phase 34)                    |
| Extra work quoted mid-job               | Built  | A form on the job raises a supplementary quote and sends it; the work already approved carries on (Phase 34)                            |
| Press counts per hand-off               | Built  | The five workflows as a table in core, tested never to grow, generated into `02-design/11-workflows.md` (Phase 34)                      |
| Check-in                                | Built  | Mileage, fuel, a walk round the car, belongings, the hook, a signature and photographs, one press, once (Phase 35)                      |
| Check-out                               | Built  | What was done, what is owed, final mileage, what goes back, a signature; refused unfinished or unpaid without a reason (Phase 35)       |
| Signatures                              | Built  | A record of its own, strokes not pictures, with who, when, where; on check-in, check-out and counter approvals (Phase 35)               |
| Key tags                                | Built  | Hung, taken, returned, handed back as events; where they are now on the job and the technician's card (Phase 35)                        |
| Conversations                           | Built  | One thread per customer and per job over email, text, WhatsApp; unread first; reply from the job (Phase 36)                             |
| WhatsApp                                | Built  | A channel through the transport seam: console by default, Twilio's WhatsApp sender as the adapter; inbound accepted (Phase 36)          |
| Message templates                       | Built  | Sentences filled from the job, refused with a blank; five built in, any number a workshop's own (Phase 36)                              |
| Attachments, assignment, read state     | Built  | Files kept on the message; a thread assigned, read, closed, reopened by the next reply (Phase 36)                                       |
| Service packages                        | Built  | Labour, parts, fees, a checklist, a duration, a kind of work, a fixed price and an interval, saved whole (Phase 37)                     |
| A job from a package                    | Built  | One press on the new-job form, on a job already open, from a booking, or from the customer booking online (Phase 37)                    |
| The next service from a package         | Built  | Completing a job made from a recurring package sets the vehicle's schedule: due date and due mileage (Phase 37)                         |
| Languages                               | Built  | English, French and Arabic, the person's choice, kept on the account; Arabic right to left; public site, portal and shells (Phase 37.5) |
| Translation coverage                    | Built  | Every sentence passed to the translator has both translations or the script fails and names it (Phase 37.5)                             |
| Every word translated                   | Built  | Every page, component, page title and refusal through the translator; 5,511 sentences in each language (Phase 40.5)                     |
| Untranslated text refused               | Built  | A parser-based scan names any text outside the translator and fails the languages check (Phase 40.5)                                    |
| Supplier returns                        | Built  | Faulty, wrong or not needed: off the shelf at cost, a credit due, the credit note off the bills oldest first (Phase 38)                 |
| Cores                                   | Built  | The old unit back without touching the shelf; its credit reduces the cost of parts (Phase 38)                                           |
| Credit held on a supplier account       | Built  | Credit that cannot be set against a bill is held, shown, and taken by the next bill booked (Phase 38)                                   |
| Sublet work                             | Built  | A vendor, a line on the job with its margin, the vendor's bill at the real cost, invoiced to the customer (Phase 38)                    |
| Global search                           | Built  | Plates however typed, VINs, phone digits, job, invoice and part numbers; an exact match goes straight to the record (Phase 39)          |
| Staff notifications                     | Built  | Approvals, messages, online bookings, card payments, part requests, to whoever would act; each opens its record (Phase 39)              |
| Tax by customer, site, or stacked       | Built  | Up to three taxes on a rate, compound or not; exempt customers with a certificate; a rate per site; prices with tax in (Phase 41)       |
| Report per tax                          | Built  | Each tax and rate for a period, as declared on each document, less credit notes, per site; CSV (Phase 41)                               |
| Printing, PDF, labels                   | Built  | Invoice, quote, inspection report, work order, key tag, part labels and counter receipt; each as a PDF; QR codes (Phase 42)             |
| Every page prints                       | Built  | Navigation, buttons and forms fall away; drawn light whatever the theme (Phase 42)                                                      |
| Onboarding checklist                    | Built  | `/start`: nine steps read from the workshop's own data, each saying why it matters, with the next one on the dashboard (Phase 45)       |
| Demonstration data                      | Built  | A second workshop with a year of work, built through the product itself, marked on every screen, removable whole (Phase 45)             |
| Help inside the product                 | Built  | Twelve short pages at `/help`, each linked to its screen, found from the search box beside the records (Phase 45)                       |

## What this adds up to

Counting individual capabilities rather than sections, both the table rows and
the sections given a single verdict:

<!-- counts:start -->

_Counted by `infra/scripts/build_deck.py`. Do not edit by hand._

| Status  | Capabilities |
| ------- | ------------ |
| Built   | 438          |
| Partial | 2            |

<!-- counts:end -->

Nothing on this map is missing any more. Coupons, the last of it, were built
in Phase 45.5. The sidebar was the third **Partial** until Phase 80 and is now
written per role and checked both ways. What is left is the two dictionary
counts, which are partial by construction — they are frozen numbers that can
only fall. The **Deferred** is closed: Phase 81 built the corpus ADR-0013 said
did not exist, out of what technicians confirm and rule out on their own jobs,
and reports it as counts with silence below three confirmations (ADR-0016).
What replaced the deferral is smaller than what was originally asked for, and
true.

A map with nothing missing on it is not the same as a product that is ready.
It says the screens exist. The phases after Phase 45.5 in the
[roadmap](06-roadmap.md) are about whether a workshop can actually run on
them: reliability, financial integrity, tenancy, recovery, observability,
performance, the workshop's own clock, the awkward cases — and then four weeks
in a real workshop, which is the one phase none of this substitutes for. Every
instrument that pilot needs is built and listed above; the pilot itself has
not been run.

_Next: [roadmap](06-roadmap.md)._
