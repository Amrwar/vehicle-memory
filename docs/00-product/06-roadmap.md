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

## Phase 4.5 — The front door

**Runs alongside Phase 4.**

|           |                                                                                                               |
| --------- | ------------------------------------------------------------------------------------------------------------- |
| **Entry** | The product does enough that a stranger arriving cold has something worth reading about.                      |
| **Exit**  | A workshop owner can understand what this is, what it costs, and start a trial, from a phone, without asking. |

**Scope.** A marketing site that says what the system does and who it is for.
The vehicle passport explained in the terms an owner cares about rather than in
the terms it was built in. Pricing, published. Sign-up that creates an
organisation rather than a loose account. Every page usable on a phone.

**Why this is its own phase rather than a page.** Right now the front door is a
holding page and sign-up creates a bare user with no workshop attached, which
is the wrong shape: this product is sold to a business, and the first object
created has to be the business. Getting that wrong is expensive to undo later,
because every record in the system hangs off the organisation.

**The specific decisions.**

- **Signup creates an organisation.** A person signing up is creating a
  workshop and becoming its owner. The alternative, an account that later joins
  something, leaves orphaned users and a tenancy model with a hole in it.
- **Plans are enforced, not decorative.** A published price with no limit
  behind it is a promise the system cannot keep. Whatever a plan says it
  includes is checked where the feature is used.
- **Mobile is not a smaller desktop.** The shop floor already assumes a tablet.
  The marketing site and the portal have to assume a phone, because that is
  what somebody reading about a product on a Saturday is holding.

---

## Phase 4.6 — Administration and the customer's journey

**Weeks 31–36.**

|           |                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------- |
| **Entry** | Sign-up creates a workshop, so there is something to invite a colleague into.                         |
| **Exit**  | A customer books, chooses, confirms and is kept informed without a member of staff touching anything. |

**Scope, administration.** Inviting a colleague by email, accepting an
invitation, changing somebody's role, moving somebody between sites, and
deactivating a leaver without deleting their history. Today all of that takes a
database write, which means in practice a workshop cannot add its second user.

**Scope, the customer's journey.** The booking flow end to end: choose a
service, choose the vehicle, choose a slot the diary genuinely has free, get a
confirmation, then get told when the work moves. Plus a screen showing which
service reminders are due and why, because a reminder engine nobody can inspect
is indistinguishable from one that has quietly stopped.

**Why these two together.** They are the same missing idea from two sides.
Everything built so far assumes somebody is already inside the system and knows
what they are doing. This phase is about the people who are not: the new hire
who needs an account, and the customer who wants a Tuesday.

---

## Phase 4.7 — Counter sales, reporting and the gaps

**Weeks 33–40, overlapping Phase 4.**

|           |                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------ |
| **Entry** | The ledger is posting and stock is accurate, because point of sale writes to both.               |
| **Exit**  | A counter sale takes under thirty seconds, and every report a workshop actually runs is present. |

**Scope.** Point of sale for over-the-counter parts and consumables: no job, no
vehicle, often no customer record. Card and cash, split payment, refunds
against the original sale. A till that reconciles at close of day.

Reporting beyond the operational board that exists: revenue by service type,
parts profitability by category, customer retention and lifetime value,
technician league tables, source of business, and every one of them exportable
as CSV (FR-1406, still open).

**Why point of sale is not trivial.** It looks like a simplified invoice and it
is not. A counter sale has no job to hang costs on, so parts consumption, the
ledger posting and the stock movement all have to work without the anchor the
rest of the system is built around. Getting it wrong shows up as stock that
drifts and a till that does not balance.

---

## Phase 4.8 — Expenses, banking and close

**Weeks 37–40.**

|           |                                                                 |
| --------- | --------------------------------------------------------------- |
| **Entry** | The ledger has been posting real work for a full quarter.       |
| **Exit**  | A quarter can be closed, and the closed figures match the bank. |

**Scope.** Expense capture with receipts and approval. Bank accounts, imported
statements, and reconciliation against posted entries. Fiscal period close, with
the guard that already refuses postings into a closed period. Payroll export in
a format a provider accepts.

**Why this completes Phase 3 rather than extending it.** The ledger balances
today, and it balances against itself. Reconciliation is what makes it balance
against reality: until the bank agrees, a trial balance only proves the
arithmetic was consistent, not that it was right.

---

## Phase 4.9 — Revision

**Weeks 41–44.**

|           |                                                                           |
| --------- | ------------------------------------------------------------------------- |
| **Entry** | Phases 1 to 4.7 shipped.                                                  |
| **Exit**  | Every screen has been walked through as a user, on a phone and on a desk. |

**Scope.** No new features. A pass over everything built so far, in the order a
real workshop would meet it, fixing what does not work rather than adding what
is missing.

**What this phase is for.** Software built phase by phase accumulates seams:
the page written in week three that nobody revisited, the empty state that
never got designed because the demo data always had rows, the form that works
on a desk and is unusable on a phone, the error that says something true and
unhelpful. None of these are bugs anybody files. All of them are what somebody
means when they say a product feels unfinished.

**The checklist.**

- Every page at 375px wide, with a real thumb
- Every empty state, reached by emptying the data rather than by imagining it
- Every error path, triggered deliberately
- Every form submitted with nothing in it, and with too much in it
- Every list at zero, one, and a thousand rows
- Keyboard only, from sign-in to invoice
- A screen reader over the passport, which is the page a stranger will meet
- Every figure on every page traced back to the record behind it

**How it was done.** The parts of that list a machine can check became scripts,
so the pass is repeatable rather than a one-off afternoon:

- `verify:empty` creates a genuinely empty workshop and walks all twenty-five
  pages as its owner, asserting nothing errors, nothing shows a bare NaN or an
  Invalid Date, and every page says what to do next rather than showing a
  blank table.
- `verify:access` checks the mechanical half of accessibility across
  twenty-nine pages: inputs with no label, buttons with no accessible name,
  images with no alternative, decorative graphics not hidden from a screen
  reader, headings that skip a level, and pages missing a landmark, a skip
  link or a language.

Both run in CI. The half a machine cannot check, whether a page actually makes
sense read aloud, still needs a person and a screen reader.

**What it found.** Two real defects, and one lesson about checks.

The group view only showed its empty state at zero sites. A new workshop has
one, so the first thing a customer saw on that page was a comparison table
with a single row and a spread of nothing. It now needs two sites before it
claims to compare anything.

The pricing page had no h1. Its title came from the shared section heading
component, which renders an h2, so the outline started at level two with
nothing above it.

The lesson: the first version of the accessibility check reported every table
on every page as unwrapped, and the first version of the empty-state check
reported every page as broken. Both were reading the React payload Next.js
inlines into the document rather than the document. A check that fails
everywhere is indistinguishable from a check that is wrong, and shipping one
that cannot be trusted is worse than not having it. The table rule was removed
rather than approximated further.

---

## Phase 5 — Customer Lifecycle and Automation

**Weeks 37–44.**

|           |                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------- |
| **Entry** | Phase 1 flows stable under real load. Portal adoption above 40%.                                           |
| **Exit**  | A service reminder can lead to a booking, a job and an invoice with no staff action until the car arrives. |

**Scope.** The workflow automation engine: trigger, condition, action. CRM
proper, which is the part that does not exist in any form today: customer
segments, campaigns with consent held per channel, retention cohorts, and
lifetime value by customer and by vehicle. Reminders driven by both elapsed
time and projected mileage, feeding the booking flow built in Phase 4.6. Native
mobile technician app if the web version has proven insufficient.

Self-service booking and point of sale moved earlier, to Phases 4.6 and 4.7,
because both turned out to be things a workshop needs before it needs
automation.

**Built.** The engine is trigger, conditions and actions, with three
constraints that come from how these things fail rather than from how they
work.

A rule cannot trigger a rule. Chained automation is impossible to reason about
after the third link and impossible to debug at all: somebody sees a message go
out and no rule they can find sent it. Every run here comes from a real event.

Every rule is rate limited per subject, and the limit is a database trigger
rather than a check in the code that happens to call it. The failure mode of
automation is not doing nothing, it is doing something forty times to one
person, and by then the messages have been sent.

A rule that could never fire is refused when it is written. A condition on days
overdue attached to job completion is unknowable at that moment, so the rule
would sit there looking healthy and never act, which is worse than an error.

**Every evaluation is recorded, including the ones that decided not to act.**
This is the part most of these engines leave out. A rule quietly failing a
condition for a fortnight looks identical, from a dashboard, to a rule nobody
has triggered, and the two need completely different responses. The automation
page leads with what is queued, because that is the only moment anything can
still be stopped.

**Consent.** Marketing is gated per channel and rechecked for every recipient
at the moment of sending, never taken from when the audience was built. Lists
go stale between the two, and somebody who withdrew consent on Tuesday must not
receive Wednesday's send. Transactional messages, which are about work on the
customer's own vehicle, are not gated on marketing consent at all: conflating
the two either spams people who opted out or silences the confirmation somebody
is waiting for.

Every change to a permission is written by a database trigger and cannot be
edited or deleted afterwards. A boolean on a customer row proves nothing; it
shows the current state and no history, and the one occasion it matters is the
occasion somebody asks how you came to have permission.

**What the loop actually does now.** A service falling due writes a message
that offers a booking and fires `service.due` at the rules. The worker carries
out queued actions on every poll. Nothing between the reminder going out and
the car arriving needs a person.

**What it found.** The traceability matrix's coverage summary was wrong. It
claimed 149 requirements traced at 97% automated, against a matrix that held
130 rows, and the requirements document had grown to 213. The summary was
arithmetic about a table that had stopped existing. It now counts what is
actually there and names the gap, which is that 84 requirements from the early
phases were traced by section rather than one row each.

The loop this closes:

```
  Vehicle approaching service interval (time or projected mileage)
        -> Reminder sent, carrying a booking link
        -> Customer books online
        -> Booking created, capacity checked
        -> Job created on arrival
        -> ... normal flow ...
        -> Next interval calculated
        -> back to the top
```

---

## Phase 5.1 — The customer's own side

**Done.**

|           |                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------- |
| **Entry** | Phase 5 complete. Automation drives reminders, and reminders point at a booking.                                     |
| **Exit**  | A customer can answer a quote, read a vehicle's history, see what is owed and share it, all without ringing anybody. |

**Why this was a phase rather than a fix.** The coverage map already marked
this column built. It was not. Three of the buttons on the customer's own home
screen led to pages that did not exist: "View history", "Share with a buyer",
and the link to review a quote, which pointed at a share row's id rather than
at a capability token and had therefore never opened anything. The rows had
been written from the data model rather than from the product.

**What is built.**

The quote screen is the important one, because it is the only screen in the
product where the person using it is not a professional, is often standing in
a car park, and is being asked for money.

It is answered line by line rather than whole. An estimate offered as one
take-it-or-leave-it figure gets declined whole, and the workshop loses the
three items the customer would have said yes to. Nothing arrives preselected:
a form that opens with every box ticked is not asking a question, and the
approval it produces is worth nothing the first time somebody disputes it.
Anything left unticked is recorded as declined rather than left pending,
because a pending line means the workshop has to ring to find out, which is the
telephone call the whole screen exists to avoid.

A safety-critical item can be turned down. It is the customer's car. What the
system owes them is a plain statement of what leaving it means, and a permanent
record that the statement was made, which is a different thing from refusing to
let them.

The same screen is reachable two ways: signed in, and through the link the
workshop texted, which needs no account at all. Most people will meet Carnet
there and nowhere else, and asking somebody to register before they can answer
a question their own garage asked them is how a quote goes unanswered for four
days.

Alongside it: a vehicle's full history from the owner's side including what
each visit cost, share links the owner creates and can take back, every invoice
across every workshop that uses Carnet with what is outstanding stated first,
and a plain-language view of what is happening to the car right now. Every
status is translated. "Quality check" is precise to a service manager and
meaningless to the person waiting, whose only question is when they can have it
back.

**What it found.** The traceability matrix's finance rows were misaligned by
one from FR-1202 down, and traced an FR-1212 that has never existed in the
requirements document. The implementations were all real; they were filed
against the wrong requirements.

---

## Phase 5.2 — Sending

**Done.**

|           |                                                                                                       |
| --------- | ----------------------------------------------------------------------------------------------------- |
| **Entry** | Phase 5.1 complete. Everything that should write to a customer does.                                  |
| **Exit**  | A message written to the queue reaches a provider, and a workshop can see what went and what did not. |

**The gap this closed.** Nothing sent. Since Phase 1 the product had been
writing rows to `message_logs` and nothing had ever read that table. Every
confirmation, service reminder, quote link, automation action and campaign the
system had "sent" was sitting in it. Two environment variables named a mail
and an SMS transport and no code read either of them.

Nothing reported a problem, because from the writing side everything had
worked. This is the shape of failure the whole product is built to avoid, and
it had been sitting in the middle of it for months, marked built in the
coverage map on the strength of the rows appearing.

**What is built.** One interface, three implementations, and no domain code
anywhere imports a vendor. Console is the default and is a real transport
rather than a no-op: it writes the message where it can be read and reports
success, so the queue drains and every state after sending can be exercised
without a provider account. SMTP covers email, because every provider worth
using speaks it and picking a vendor is not a decision the code gets to make.
Twilio covers texts, over plain HTTP rather than the SDK.

The decisions all live in the domain layer and are tested without a network:

- A permanent failure is not retried. An address with no @ in it will not
  start working on the fourth attempt, and treating it as transient burns six
  attempts, buries the real failures and delays everything queued behind it.
  SMTP says so with a 5xx and HTTP with a 4xx, which are opposite conventions,
  so the classifier is told the protocol rather than guessing from the number.
- Retries are capped and jittered. Without jitter every message queued during
  an outage retries in the same instant when it ends, and the retry storm is
  the second outage.
- Texts are held between 20:00 and 08:00. An email arriving overnight sits in
  an inbox until morning; a text lights up a phone on a bedside table, and a
  garage that does that once does not get a third message read.
- Addresses are normalised at the moment of sending rather than of queueing,
  because a customer record can be edited in between and the address that
  matters is the one that is true now.
- A template refuses an unknown placeholder when it is written and a missing
  value when the message is built. "Hi {{firstName}}, your Vauxhall is ready"
  is the message every template system sends once.
- Addresses are redacted wherever they are logged or shown. Logs get pasted
  into tickets, and a workshop screen is open all day in a room people walk
  through.

**Visibility.** `/messages` separates three states that look alike and need
completely different responses. Failed needs somebody to fix an address. Held
is working exactly as intended and needs nobody. Queued with its time passed
means the worker is not running, which is the one worth interrupting a morning
for, because nothing at all is going out.

---

## Phase 5.3 — Somewhere for the work to run

**Done.**

|           |                                                                                                                       |
| --------- | --------------------------------------------------------------------------------------------------------------------- |
| **Entry** | Phase 5.2 complete. Messages can be sent, given something to send them.                                               |
| **Exit**  | The background work runs in production without a second server, and cannot be triggered by anybody but the scheduler. |

**The gap this closed.** The worker had no production home. It was a process
polling every five seconds, started by hand on a developer's machine by a
script that runs in watch mode. Vercel hosts the application and cannot hold a
loop open; Compose defined postgres, redis, mailpit and web, and no worker;
there was no schedule configured anywhere. So configuring a mail provider
would still have sent nothing, because nothing would have called the drain.

**Why a schedule rather than a server.** A container on another platform keeps
the five-second loop, at the cost of a second deploy target, a second bill and
a second thing to watch. The slowest job here runs hourly and the fastest needs
to be prompt rather than instant: a confirmation email arriving forty seconds
after a booking is invisible to the person who made it.

The concern with a schedule is overlapping runs, and it was already answered.
Every job claims what it is working on before working on it: the message
sweeper marks a row as attempted before handing it to a provider rather than
after, precisely so a crash or an overlap leaves a row that says it was tried,
which is true, rather than one that looks untouched and gets sent twice.

**What changed.** The jobs moved out of the worker into `@carnet/jobs`, and
there are now two drivers over one implementation: a loop for development,
where a five-second poll is what you want while building, and a scheduled
request in production. Two implementations would mean one of them quietly
stopping matching the other, and it would be the one nobody runs locally.

**The routes refuse by default.** They send messages to customers and close
people's timesheets, so an open URL would hand both to anybody. The secret is
compared in constant time, a signed-in workshop owner is refused exactly like
a stranger, and a deployment that forgets to set the secret refuses everything
rather than exposing the routes.

**What this got wrong.** The schedule was written at one minute, which Vercel's
Hobby tier refuses: one cron run a day is the limit there. The refusal happens
at deploy time, so every deployment from that commit onwards failed, and the
live site sat five commits behind for most of a day while the repository looked
perfectly healthy. Nothing in CI catches this, because CI never deploys.

The committed schedule is now daily, which every plan accepts, and the real
driver on Hobby is a scheduled workflow in the repository calling the same
routes every ten minutes for nothing. On Pro the schedule goes back up and the
workflow is deleted. The lesson is the ordinary one: a platform limit is part
of the design, and picking the value that only works on the plan somebody else
is paying for is how a deployment pipeline stops without telling anybody.

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

## Phases 7 to 18 — the remaining feature map

Everything in the [feature map](09-feature-map.md) marked missing, grouped and
ordered by what a workshop loses each day it is absent rather than by how
interesting it is to build.

---

## Phase 7 — Digital vehicle inspection

**The largest single gap, and the one with money attached.**

Six tables already exist: templates, template items, inspections, results with
severity and measurements, photos, and the link from a result to an estimate
line. The passport reads them and the estimate builder uses them. There is no
way for a technician to carry one out, so the data only arrives through the
seed.

**Why first.** An inspection is what turns a booked oil change into approved
brake work. Every day without it, a workshop finds things on cars and writes
them on paper, and roughly half of what they find is never quoted. The
schema is done; this is an interface and a flow.

**Scope.** A tablet interface a technician can work through with oily hands:
sections, items, a green, amber or red per item, measurements where they
matter, notes, photos and video. The customer receives the result with the
photos, and approves item by item using the screen built in Phase 5.1. Then
the approved items become estimate lines automatically, which the mapping in
core already does.

**Exit.** A technician carries out an inspection on a tablet, the customer
approves two of five items from a link, and those two appear on the job
without anybody retyping them.

---

## Phase 8 — The floor and the diary

**Scope.** The calendar in the views a workshop actually uses: day, week,
month, by technician, by bay, by site. Dragging a job from one bay or person
to another, with the capacity check that already exists running on the drop.
A visual bay board showing what is in each bay right now.

Plus the dashboard rows still missing: jobs waiting for parts, jobs overdue,
and an activity feed. The audit log already records everything a feed would
show and nothing reads it that way.

**Exit.** A service manager moves a job between bays by dragging it, and the
diary refuses a drop that would overbook the bay.

---

## Phase 9 — Warranty, fleet and the customer thread

Three things that share one property: each turns a set of records the product
already holds into something a person can act on.

**Warranty.** Parts and labour warranty against the job that fitted them, with
expiry, claims and the supplier's own warranty behind it. A workshop currently
finds out a part was under warranty when the customer says so.

**Fleet.** A company with fifty vehicles is fifty unrelated customer records
today. A fleet is an account with vehicles under it, a dashboard of what is due
and what is overdue, and central approval of repairs. This opens a market
rather than adding a feature.

**Customer thread.** One timeline per customer with every visit, quote,
approval, payment and message on it, and the per-customer communication history
that `/messages` shows only across the whole organisation.

**Exit.** A fleet manager approves work on three of their vehicles in one
sitting, and a warranty claim on a part fitted last March is raised from the
job that fitted it.

---

## Phase 10 — The vehicle's own condition

The first phase that belongs to the vehicle rather than to the workshop, and
the hinge the rest of the roadmap turns on.

**Component history.** A vehicle stops being a list of visits and becomes a
list of parts with ages. The battery went in on 12 March 2025, it is a
particular brand, it carries thirty-six months, and it is eighteen months old.
The brakes: front pads replaced in February, rear pads original. The tyres:
one set, fitted in 2025, 32,400 km ago. Every one of those facts is already
inside a job line somewhere; nothing reads them as the life of a component.

**Health score.** Maintenance compliance, open issues, declined repairs,
upcoming maintenance, component condition, mileage-based recommendations, the
last inspection, and one number over the top of it. The score belongs to the
vehicle, not to the workshop, which is the whole reason it is worth anything
to a buyer later.

The arithmetic has to be defensible or the number is worse than none. Each
input is bounded, weighted and shown; the score is never a black box, and
every component of it links to the record that produced it. A score that
cannot be argued with is a score nobody trusts.

**Predictive maintenance.** Not "service due in two months" but "brake
inspection in about 1,200 km, oil service in about 2,800, tyre rotation in
about 4,000", from this vehicle's own mileage rate and its own service
intervals rather than a manufacturer's table. The rate already exists:
`averageKmPerDay` has been computing it since Phase 1 and only the reminder
screen reads it. Confidence is stated, and a vehicle with too little history
is told so rather than guessed at.

**Warranty intelligence.** The workshop half of the same data. Opening a job
on a vehicle whose battery was replaced seven months ago flags the possible
claim and shows the original invoice, part and supplier. Phase 9 recorded the
cover; this is what makes somebody look at it without being asked.

**Exit.** A vehicle page states its health, names what is likely due and in
how many kilometres, lists its components by age, and a job opened on a
covered part says so before anybody has to remember.

---

## Phase 11 — The passport leaves the workshop

Where the append-only chain stops being technically interesting and starts
being commercially useful.

**Ownership transfer.** Selling a car becomes a first-class workflow. The
history transfers; the previous owner's personal details do not. This already
half exists: `VehicleOwnership` records the chain and nothing drives it from
the product.

**The buyer's report.** Three owners, twenty-seven service events, four
inspections, no unresolved critical items, 82,400 km recorded, last serviced
in June 2026. Generated by the seller, and verifiable by the buyer rather than
taken on trust.

**Public verification.** A QR code or a verification code opens a sanitised
history with no account. The existing passport share is the mechanism; what
this adds is the verification, which is the chain fingerprint stated in terms
a person can check rather than a hash nobody reads.

**Recalls and bulletins.** Manufacturer campaigns, technical service
bulletins, known issues. An external data source rather than a database built
here, because a recall list that is quietly out of date is worse than no
recall list. Until a provider is wired in, the screen says what it does not
know.

**Exit.** A seller produces a report, a buyer with no account verifies it, and
a vehicle changes hands with its history intact and its previous owner's
details gone.

---

## Phase 12 — The workshop plans itself

**Capacity.** Appointments, technicians, bays, parts and jobs are all recorded
already, so tomorrow's capacity is arithmetic nobody is doing: twelve
appointments, nine technician hours available, eleven and a half booked,
overbooked by two and a half. Then the useful half: which job to move, and to
when.

**Skill matrix.** Not "technician". Brakes, diagnostics, air conditioning,
electric vehicles, each at a stated level per person. Scheduling that does not
know who can do the work is scheduling that produces a rota somebody has to
redo by hand.

**Automatic scheduling.** Skills, availability, bay availability, parts on the
shelf, estimated labour and priority, resolved into a day. It proposes; a
person accepts. The same rule every suggestion in this product follows.

The algorithm is the risk here, not the screen. A schedule that is subtly
wrong is worse than a blank one, because somebody works to it. It must be
explainable line by line: this job is at ten because this person is the only
one who can do it and the part arrives at nine.

**Exit.** A service manager presses one control and gets a day that respects
every constraint, with the reasoning shown, and changes two lines of it.

---

## Phase 13 — Parts that fit, and proof of everything

**Parts compatibility.** Which vehicles a part fits, and a warning when the
part on the job does not fit the car in the bay. This waits on a data source:
guessing fitment puts wrong parts on cars.

**Audit, made exceptional.** The product is positioned on trustworthy vehicle
history, so the audit trail has to be the best thing in it. Who, what, when,
before, after, source, and device where it is appropriate. A quote read as a
life: created, modified, approved, converted, invoiced. A passport record read
the same way, with the job it came from and the hash that fixes it.

Most of this exists and is written on every action already. What is missing is
reading it as a life rather than as a log.

**Exit.** Any record in the product can be opened and read as its own history,
and a passport event names the job, the person and the hash behind it.

---

## Phase 14 — The technician's own device

**A mobile application in everything but name.** Scan a VIN, open the vehicle,
open the job, start the timer, take a photograph, add a note, complete the
task. Almost no typing. A technician should not be using the same interface as
somebody at a desk, and the tablet inspection screen from Phase 7 is the
proof that the difference is worth building.

**Offline.** Workshops have bad wi-fi, and the parts of the building with the
worst signal are the parts with the cars in them. Assigned jobs, vehicle
details, inspection results, photographs, notes and time all have to work with
no connection and reconcile when it returns.

Reconciliation is the whole difficulty. Two people editing one job from two
devices is the case that decides whether this is trustworthy, and the answer
cannot be last-write-wins on a record that a customer is billed from.

**Exit.** A technician completes a full job from a phone in a basement with no
signal, and nothing is lost or silently overwritten when it reconnects.

---

## Phase 15 — Retention, and what people say afterwards

**Reviews.** Asked after a completed job, routed by the answer: a strong
rating is invited to a public review, a poor one opens a private conversation
instead. The other way round is how a business collects one-star reviews it
could have fixed.

**Loyalty and referral.** Points, coupons, gift cards, and a referral that
credits both sides.

**The inbox.** Everything outbound is recorded and sent; nothing inbound
arrives. A customer replying to a text about their car should land against
that job rather than in somebody's phone.

**The automation builder, drawn.** The rules engine from Phase 5 works and is
configured through forms. Drawing it as trigger and actions is what makes a
workshop owner write their own rather than ask for one.

**Exit.** A customer replies to a message and it appears against the job, a
five-star rating produces a review request that a four-star rating does not,
and an owner builds a rule without help.

---

## Phase 15.1 — Customers with accounts, and the buttons that led nowhere

Two pieces of work that arrived together because one exposed the other.

**A driver signs up.** Until now a portal account existed only because a
workshop made one, which is the safest arrangement and also the reason a
customer who changes garages loses the history the product promised would
follow the car. Self-registration fixes that without weakening what it rests
on: a plate is readable from across a car park and a VIN through the
windscreen, so entering one proves nothing and grants nothing. A new account
starts empty. A vehicle appears on it only when the workshop that last
serviced the car looks at the name and approves the request, and a refusal
has to say why. Three open requests at a time, a pending request never names
the garage, and the plate lookup is an index seek so it stays instant as the
network grows.

**The email must be confirmed first.** Everything inside a workshop sends
things in the workshop's name. An address nobody has proven is how a stranger
opens a business under somebody else's and starts emailing from it, so the
workshop is now held at a confirmation page until the link is opened. Invited
colleagues arrive already confirmed; only the person who has just signed up
ever sees it.

**Nothing waits for the sweep.** The queue that sends messages is drained by a
scheduled job that, on the current hosting plan, runs once a day. A service
reminder can wait for that. A password reset, a confirmation link, an
invitation or a quote cannot, and every one of them did: the row was written
and nobody received anything until the next morning. Those paths now queue the
row and push it straight out, with the queue still the record and the retry.

**Four controls with nothing behind them.** "New customer", "New part", "New
order" and "Send estimate" had sat on their pages as links to an error screen
or buttons wired to nothing. The crawler meant to catch this read a 200 and
moved on, because the framework streams the not-found screen inside a payload
the status code never sees. The checker now reads the framework's own
not-found digest, and the four pages exist. Sending a quote is the one that
mattered most: no customer had ever been sent one from the product.

**Two quiet defects.** Inviting a colleague never queued the email the page
said was on its way. A campaign wrote each customer's id into the address
field, so every campaign message failed at the provider while the campaign
reported itself as sent. Both now have a check that would have caught them.

**Exit.** A driver signs up, enters a plate, and sees nothing until the garage
approves. A new workshop cannot see its dashboard until the link is opened,
and the link arrives within the minute. Every link on every page leads to a
page, and the checker fails if one does not.

---

## Phase 16 — Filling in the ERP

The remaining accounting and purchasing gaps, each small on its own.

Supplier payments and remittances. Refunds as a proper flow rather than a
credit note used as one. Card payment, which needs a provider chosen. Payroll
export, which needs a named target format. Fleet pricing agreements and
consolidated fleet invoicing, which Phase 9 named as missing.

**Exit.** A supplier is paid from the product, and a fleet gets one invoice a
month rather than fourteen.

**Status, part one: the money cycle.** Starting this phase exposed that the
gaps were not at the edges. Nothing in the running product moved a job from
approved to started, completed, invoiced or paid; no screen issued an invoice,
took a payment or raised a credit note. The ledger had been posting since
Phase 3 from documents only the seed ever wrote. So the first half of this
phase is the cycle itself: the job page moves the job on with one button that
says what happens next, completion consumes the parts at real cost and writes
the passport, the invoice is issued from the job's lines with revenue split by
kind, payments are taken against it until it settles, a credit note reverses
in proportion, and a refund sends money back against the credit that
justifies it. Approving an estimate now puts the approved lines on the job,
which is what made the rest possible. `npm run verify:money` walks the whole
cycle and checks the ledger after every step.

**Status, part two: the edges.** A supplier's bill is booked against its
order, approved by somebody who has checked it against the delivery, and paid,
usually several at a time: the payment spreads oldest-due first across the
approved bills, every penny lands on one, and the supplier is sent a
remittance advice naming each. Approved timesheets for a period are handed to
payroll as a plain CSV, once, and marking the run paid posts gross wages; the
product never calculates tax, it hands hours to the software that does. A
fleet has agreed terms, a labour and a parts discount applied at invoice time
so the job keeps its list figures, and one invoice a month for everything
completed, each line naming the vehicle and job it came from.
`npm run verify:erp` walks all three and checks the ledger after each.

**Still open in this phase.** Card payment through a provider needs the
provider chosen; card payments taken on the counter terminal are recorded
today. Stock is posted when the bill is booked rather than when the goods
arrive, which the accounting model says is the wrong moment; receipt-time
posting is the next correction.

---

## Phase 17 — Answers rather than pages

The owner command centre, and AI used inside the workflow rather than as the
product.

Every figure the command centre would need is already computed somewhere, so
this is mostly routing a question to the right existing calculation and
refusing the ones it cannot answer.

Three AI uses, in the order they can be trusted. A job summary written for the
customer, which restates work already recorded and is checkable against it. A
revenue observation, which is arithmetic with a sentence around it. A service
adviser suggesting where to look, which comes last because it needs a corpus
of symptoms against confirmed causes that does not exist yet, and a confident
wrong suggestion on a braking fault is not a small error.

Nothing here decides anything.

**Exit.** An owner asks a question in words and gets a figure with the
reasoning behind it, or a plain statement that the data cannot answer it.

**Status.** Built as routing, not intelligence. The Ask page recognises a
closed vocabulary of twelve question shapes, in the words an owner would use,
and maps each to a calculation the product already trusts: revenue and its
split, gross margin from the ledger, money owed and owing, cash taken, cars
in the shop, quotes waiting, stock value, best and lapsing customers,
services due, wages. Every answer shows its working step by step and links to
the page that computes the same figure. A question outside the vocabulary is
refused with the list of what can be asked. No model is involved.

Two of the three planned uses of generated text are in. The dashboard opens
with the month in sentences, arithmetic with words around it, which states a
comparison only when both sides have enough jobs to mean anything. A completed
job carries a summary written for the customer, composed from its own lines
and findings; with a model configured the prose may be tidied, and the result
is checked so that every number and part number in it exists on the job, or
the plain version is used and the reason shown. The third, a service adviser
suggesting where to look on a fault, is deliberately not built, and the page
says so. See [ADR-0013](../03-adr/0013-generated-text-inside-the-workflow.md).
`npm run verify:answers` proves every advertised question is answered, the
figures agree with their pages, nonsense is refused, and the summary says
nothing the job does not.

---

## Phase 18 — The network

**Between workshops.** A customer moves from one garage to another and the
passport goes with the vehicle. The second workshop sees that history exists
and continues the record rather than starting one. This is the thing that is
fundamentally different from workshop software, and everything before it has
been building the conditions for it.

**An API.** Larger workshops and fleets integrate what they already run.
Accounting, payments, communication, vehicle data, recalls, calendars.

**A marketplace, deliberately not yet.** Nearby verified workshops with
availability, price range, ratings and expertise is a consequence of having
the network, not a way to get one. Building it early produces a directory
nobody uses.

**Exit.** A vehicle serviced at one Carnet workshop arrives at another and its
history is there, with the first workshop's commercial detail withheld.

**Status.** The exit condition holds and is proved by `npm run verify:network`.
A workshop that has never seen a car types its plate or VIN into "Find a
vehicle" and is told, before it touches the car, that history exists, how
much, and which workshops kept it. Not the entries: those come once it takes
the car on, which grants read access on the grounds the car is to be
serviced; opening the first job widens that to write. What it then reads is
every service, part, inspection and mileage reading with its verification,
and none of the other workshop's job numbers, internal identifiers or named
staff. What it records continues the vehicle's one chain, and the chain still
verifies end to end. A car new to the network is added by VIN; a VIN already
on the network is refused with the way in, and a check digit that does not
add up is a warning rather than a refusal, because the workshop has the car
and the algorithm does not. The vehicle's page carries one sentence saying
where its history came from.

The API is three read-only endpoints under a per-organisation key: jobs,
invoices and a vehicle's passport, the last with exactly the withholding the
page applies. Keys are minted on Settings, shown once, stored as digests,
revocable in a list that names them. There is no write access yet and the
[contract](../02-design/06-api-contract.md) says why.

The marketplace is not built, as planned. Nothing here decides anything on a
workshop's behalf, and nothing another workshop wrote can be edited by the
one reading it.

---

## Phase 19 — The workshop configures itself

Eighteen phases in, the settings page still said "editing these is not built
yet". A workshop being handed the product has to be able to change its own
trading name, site, bays, tax rates and kinds of work without anybody at
Carnet touching a database, and every one of those changes has to be in the
audit log with what it was before, because "who changed the VAT rate" is the
question that gets asked six months later.

Two things the planner needed from the same page. Opening hours, which it had
assumed as eight to six in code with a comment saying where to change it when
they arrived. And a way to accept what it proposed: it explained a whole day
and then somebody typed the result into the diary by hand.

And the feature map told the truth again. Several rows still said Missing for
things Phases 15 to 18 built.

**Exit.** An owner changes every setting the product reads without help, each
change is audited, and the plan for a day is written into the diary with one
press.

**Status.** Built and proved by `npm run verify:settings`. Settings has three
editing pages: the organisation (details that go on the paperwork, the
re-approval threshold, document prefixes), the site (address, opening hours,
daily capacity, bays) and the catalogue (tax rates, kinds of work). Nothing is
deleted: a bay, a rate or a kind of work that has been used is retired and
keeps reading the same on the work it was used for. A tax rate that has been
invoiced cannot have its percentage changed, because the lines priced at it
would re-price under a document already sent; there is always exactly one
default. Bad values are refused at the form with the reason. Every save is
audited with before and after.

The planner reads the site's own hours. Accepting a day's plan writes each
placement into the diary as a booking against its job, with the technician,
bay and times the plan chose; accepting again moves rather than doubles, and
the next proposal treats what is in the diary as fixed. The audit log records
that too. The feature map was corrected and its counts rebuilt.

---

## Phase 20 — The vehicle's paperwork

A car comes with paper. The registration certificate, the MOT certificate,
the insurance schedule, the receipts, and the photograph somebody took of the
dent before it was repaired. Twenty phases in, none of it had anywhere to
live in the passport, so it lived in a glovebox, and the feature map said so
in three rows marked Missing.

Documents follow the same rule as events: they belong to the car. A workshop
that may read the vehicle may read its paperwork, and so may the owner from
the portal; a stranger gets nothing, not a refusal that confirms the car
exists. What differs from events is that a document can be removed, because a
scan of the wrong car is not history, it is a mistake. A removed document
keeps its row and its reason, so the removal is history.

And one small thing the customer section still lacked: the technician a
customer asks for.

**Exit.** An owner or a workshop puts the vehicle's paperwork on the
passport, the MOT and insurance running out are visible where reminders are
read, and a customer's preferred technician is preselected on their next job.

**Status.** Built and proved by `npm run verify:documents`. A Paperwork card
on the vehicle's page and on the owner's portal page takes a PDF or a picture
of the paper, by kind, with a reference and an expiry for the two kinds that
have one; the file goes straight to the store on a short-lived ticket the way
inspection photographs do, and the row is recorded only once the bytes are
confirmed. The latest live MOT and insurance decide the vehicle's cover and
appear as badges at the top of the card; an old certificate under a newer one
is history, not a lapse. The reminders page lists the paperwork running out
on the vehicles the workshop looks after, next to the services due. The API's
vehicle endpoint returns the documents with links that expire in an hour.
Removal is for the workshop that added a document or the owner, needs a
reason, and is audited. Every addition is audited too.

A customer's preferred technician is set on their page and preselected when a
job is opened for them; the diary has the last word. The feature map's last
three vehicle rows, the satisfaction row and the preferred-technician row now
read Built, and the counts were rebuilt.

---

## Phase 21 — Before general availability

The security model and the deployment guide each ended in a checklist of
things to do before real customers, and twenty phases in, most boxes were
still empty. Not because the work was hard, but because none of it is a
feature anybody asks for until the day it is missing.

**Exit.** Every response carries a Content Security Policy with a per-request
nonce; a password that has already leaked is refused; an integration cannot
call faster than the database should answer; a backup is restored and checked
on every push, not trusted; and the API is described by a document generated
from its handlers.

**Status.** Built and proved by `verify:headers`, `verify:hardening`,
`verify:backup` and additions to `verify:network`. A proxy stamps every page
with a policy that runs scripts only with that request's nonce and forbids
inline scripts; the one inline script the product writes, the theme stamp,
carries the nonce; the probe reads the header and the page and checks they
agree. Sign-up, customer sign-up and password reset refuse a password that
appears in a known breach, by k-anonymity against Have I Been Pwned so the
password never leaves the server, and fail open with a log line when the
service is unreachable. An organisation key is limited to a thousand calls an
hour, answered with 429 and Retry-After beyond that. The database is dumped,
restored into a fresh one and compared row for row and chain for chain on
every push, with the server's own tools so versions cannot disagree. The API
document is generated from a registry beside the handlers, served at
`/api/v1/openapi.json`, committed to docs, and CI fails when a handler has no
entry or the copy is behind.

What remains on the checklist needs a third party: a penetration test, a data
processing agreement with each sub-processor, content scanning of uploaded
files, and error tracking wired to a paid service.

---

## Phase 22 — The assistant inside the workflow

Phase 17 put generated text inside the workflow under one rule: it composes
from the record and decides nothing. This phase gives that rule a face. Three
things a person can ask for, from the pages where the question arises, and a
ledger of what every one of them cost.

**Exit.** A person asks a question, gets a draft message for a customer, or
gets a job read back to them, from the job's page or the Ask page; every
exchange is recorded with who, what kind and what it cost; and nothing the
assistant writes changes a record until a person presses the button that does.

**Status.** Built and proved by `npm run verify:assistant`. On a job, "Where
does this job stand?" reads the job's state back as sentences that say what is
blocking before anything else; "Draft a message" writes a progress update, a
request for a decision, or a ready-for-collection note from the job's own
facts, and a person edits it and sends it, once, to the customer's own number
or address. On the Ask page, every question goes through the assistant so the
exchange is recorded, and the answer is the same one the router gave before.

Where a model is configured (`AI_TRANSPORT=anthropic`), it may tidy a draft,
and its version is used only if every number and code in it is on the job;
otherwise the plain version is, with the reason shown. The model's usage is
recorded on the exchange, the organisation has a monthly token budget set on
Settings (zero switches the model off), and when the budget is spent the
assistant keeps working on the plain text. The Settings card shows exchanges
by kind, tokens used against the budget, and a rough cost at list prices. No
model is configured in production today, and the plain path is a complete
feature, not a degraded one.

The service adviser that suggests where to look on a fault is still not
built, for the reason ADR-0013 gives.

---

## Phase 23 — The passport, designed

Twenty-two phases built a record that belongs to the car and rendered it as a
list in a card, which is what a history looks like when it belongs to a
database. This phase makes it look like what it is.

**Exit.** The passport reads as a passport to somebody who has never used
Carnet: a cover, an identity page, stamps. The home page opens with one. The
way back from a shared passport works. Every part of the design carries a
fact, and the [design rationale](../02-design/10-passport-design.md) says why
each choice was made.

**Status.** Built. The home page's hero is a passport that tilts toward the
pointer and opens on a press, with the demonstration vehicle turning in its
photograph window, the chosen entry pressed on the page as a stamp, and a
machine-readable zone that checks the way a travel document's does. The
shared passport, the owner's copy in the portal and the workshop's "as the
next owner will see it" view are one component: cover, particulars with the
seal and the zone, observations, mileage, and a page of stamps per year, each
stamp inked by how well evidenced the entry is and tilted by a value derived
from its id. A transfer stamp names nobody, which the previous page did not
manage. The paper, ink and foil are defined once and do not follow the theme,
because a document does not. The controls crawl learned that a button which
declares its state is live, the machine-readable zone has unit tests, and
every crawl and probe still passes.

---

## Phase 24 — Points, and the public face

The loyalty programme has existed since Phase 5 as arithmetic and rows: a
balance that is the sum of its entries, a redemption that refuses rather than
clamps, a referral paid on a visit rather than a sign-up. Nothing in the
product awarded a point and nothing let anybody spend one. The feature map
said so. This phase puts the programme in front of the two people it is for:
the person at the counter, and the customer.

**Exit.** A bill paid in full earns a point a pound, once, on the money the
customer actually paid. Points come off a bill from the invoice page as a
payment of their own kind, which the ledger books as the cost of the
programme rather than as money in. Staff can give points by hand with a
reason. The customer's page shows the balance, what it is worth and what is
about to lapse; the portal shows the same to the customer, per workshop. Every
refusal refuses with a sentence and spends nothing.

**Status.** Built. `LOYALTY` is a payment method, posting to a new expense
account, Loyalty rewards, that the chart of accounts now fills in for every
organisation the first time it is missing. A payment that settles a bill
awards points on the total less what the programme itself paid, keyed on the
invoice so a retried request, a refund and repayment, or a second look earns
nothing more. The invoice page offers "Use their points" only when there is a
bill to put them against and something to put, defaulting to the most that
can be used; the customer's page has a Points card with the recent entries
and a form for the points a rule cannot see coming; the portal lists points
per workshop with what they are worth and when they lapse. The timeline and
the payment lists say "paid with points" rather than "loyalty". The
verification script opens a job, invoices it, gives points, spends them,
pays the rest, and checks the ledger, the balance, the once-only award and
every refusal against a real database.

---

## Phase 25 — Referrals, in the product

The referral rules have existed since Phase 5: a code a person can say over
a counter, both sides paid once, and only after the person brought in has
actually had work done. The feature map called that built. No page showed a
code, nothing took one, and the credit was a function nobody called, which
by the map's own rule is not built. This phase finishes it.

**Exit.** Every customer has a code, made once, on their page and in the
portal with the rule beside it. A code is taken at the counter, on a new
customer or an existing one, and refused with a sentence when it is unknown,
already used, the customer's own, or the customer has already been
introduced. Both sides are paid the moment the bill that takes the newcomer
over the minimum is paid, without anybody pressing anything, and never on a
sign-up.

**Status.** Built. The customer's page has a Referrals card: their code in
large letters, who introduced them and whether that has been paid, whom they
brought in with the same, and a form for a code somebody arrived with. The
new-customer form takes a code too, checked before the record exists so a
mistyped code does not leave a customer half taken down. The portal shows
"Bring a friend" with the code per workshop and the rule in plain words.
Settling is wired into the payment that marks a bill paid, next to the points
it earns, so a referral remembered on the second visit is paid on the spot
and one recorded on the first is paid when the line is crossed. The
verification script brings a newcomer in with a code, pays a bill too small
to count, then one that crosses the line, and checks both sides were paid
once, at that moment, and that every refusal refused.

---

## Phase 26 — Gift cards

Money taken in advance for work not yet chosen. Two things go wrong with
gift cards and both are accounting: the sale is booked as revenue, which
flatters December and starves the month the work is done, or the redemption
is booked as money in, and the bank shows the same fifty pounds twice. The
feature map had the row as missing.

**Exit.** A card is sold at the counter for whole pounds, paid for with
money and never with points or another card, and booked as a liability. It
is redeemed on the invoice as a payment of its own kind that releases the
liability rather than touching the bank. The balance is the sum of the
entries. Every refusal refuses with a sentence and spends nothing. The page
leads with what the workshop owes.

**Status.** Built. `GIFT_CARD` is a payment method posting against a new
liability account, Gift cards outstanding, which the chart of accounts fills
in for every organisation the first time it is missing. Cards have a
twelve-character number from the alphabet the referral codes use, read in
groups of four. `/gift-cards` sells a card and lists every card with what is
left on it; each card has a page with every movement on it. The invoice page
has "Redeem a gift card", with the amount optional: left blank, the card pays
as much of the bill as it can. A bill settled with a card still earns points,
because the card was paid for with real money. Cards do not expire. The
verification script sells a card, settles a small bill with part of it and a
larger bill with the rest, checks both postings, the balances on card and
bill, the points earned, and every refusal against a real database.

---

## Phases 27 onward — what the pilot needs

Twenty-six phases in, the risk is no longer too few features. It is a
ninety-four page application where every feature works and the workshop's
day is still slower than the old software plus a spreadsheet plus WhatsApp.
So the phases from here are ordered by what a real workshop would trip over
in its first month, and the pilot itself is a phase, not a reward for
finishing the list.

The list below was written against the code on 14 September 2026, not
against intention. _Built_ means somebody can open a page and do it.
_Partial_ names what works and what does not. _Missing_ means it does not
exist.

| Area                                  | Status  | What is there, and what is not                                                                                                                   | Phase |
| ------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| Passports as a list                   | Partial | A passport per vehicle in three places; no page listing them for staff, none for the customer, and no favicon on the tab                         | 27    |
| Gift cards                            | Partial | Sold, redeemed on invoices, balance from entries; no expiry, no status, no reversal or adjustment, invoices only, not by location                | 28    |
| Country and currency per workshop     | Missing | Pounds and British formatting hard-wired in 239 places; the money type already carries a currency                                                | 29    |
| Deposits and customer credit          | Partial | A deposits account and a flag in the ledger; no deposit taken from a screen, no unapplied payment, no credit applied to a later bill             | 30    |
| Receipts                              | Missing | A payment is a row and a ledger line; nothing the customer can hold                                                                              | 30    |
| Card payment through a provider       | Built   | A provider seam with a stub and Stripe; \"Pay now\" in the portal; failed payments with a reason; reconciliation names differences (Phase 32)    | 32    |
| Payment links                         | Partial | \"Pay now\" in the portal is built; a link sent in a message is not (Phase 36, with conversations)                                               | 36    |
| Permissions at the resource           | Built   | Every page tried as every role, every action read for its permission, another workshop's records not found (Phase 31)                            | 31    |
| Plan limits, server side              | Built   | Refused where the thing is made, naming the plan; trial, grace, read-only and cancelled on the organisation (Phase 31)                           | 31    |
| Data import                           | Built   | CSV in, mapped from its own headers, every problem named by row, imported through the pages' rules (Phase 33)                                    | 33    |
| Data export and exit                  | Partial | CSV for five reports; nothing that gives a workshop its data back whole                                                                          | 33    |
| Estimate to job to invoice, as one    | Partial | Each step exists; nothing converts an approved estimate into a job, nothing approves extra work mid-job, parts are not reserved on approval      | 34    |
| Check-in and check-out                | Missing | Mileage and photos exist on the job; no arrival or departure workflow, no fuel, belongings or keys                                               | 35    |
| Signatures                            | Missing | An approval records a name, address and browser; nothing is signed                                                                               | 35    |
| Key tags                              | Missing | Nowhere to say where the keys are                                                                                                                | 35    |
| Conversations, channel-independent    | Partial | Outbound email and SMS with delivery tracking; inbound with matching; no thread, no attachments, no assignment, no WhatsApp sender               | 36    |
| Service packages and job templates    | Partial | Job types with default hours and a service catalogue; no bundle of labour, parts, checklist and duration that becomes a job in one press         | 37    |
| Parts returns, cores, credits         | Built   | From the order to the credit note, oldest bill first, held credit, cores to the cost of parts (Phase 38)                                         | 38    |
| Sublet work                           | Built   | A line on the job with a vendor, a cost and a margin, the vendor's bill at the real cost (Phase 38)                                              | 38    |
| Global search                         | Missing | Scoped lookups only                                                                                                                              | 39    |
| Notifications for staff               | Missing | Audit and delivery logs, nothing that says "the customer approved" where you are standing                                                        | 39    |
| The owner's day                       | Built   | Dashboard, business report and insights answer most of the list; no comeback rate, no reputation trend by site or person, no supplier comparison | 40    |
| Tax, configurable                     | Partial | One rate per line per organisation; no exempt customers, no stacked taxes, no tax by site, no inclusive pricing                                  | 41    |
| Printing and labels                   | Partial | Three pages print; no print styles, no work order, no labels, no QR, no PDF                                                                      | 42    |
| VIN decoding and a fitment feed       | Partial | Fitment rows typed by a person, VIN checked and searched; no provider seam                                                                       | 43    |
| Payroll, the rest                     | Partial | Periods, approval, CSV and a wages posting; no overtime, deductions or bonuses, no named export format                                           | 43    |
| Reviews to Google                     | Missing | The invitation exists; nowhere to send it                                                                                                        | 43    |
| Ownership transfer with an invitation | Partial | The transfer is done by the workshop; no buyer invitation or acceptance, no explicit revocation of the seller's access                           | 44    |
| Warranty, deeper                      | Built   | Policies with months and mileage, parts and labour, supplier cover, eligibility on a new job; no warranty cost or profitability figure           | 44    |
| Pricing and tax by location           | Partial | Inventory and jobs are per site; prices and tax are per organisation                                                                             | 44    |
| Onboarding checklist                  | Missing | Sign-up creates the workshop; nothing walks the owner through the rest                                                                           | 45    |
| Demo with sample data                 | Missing | A development seed only                                                                                                                          | 45    |
| Help inside the product               | Missing | Page copy explains; nothing searchable                                                                                                           | 45    |
| Offline, tested hard                  | Built   | Queue, replay order, conflicts kept on the device with a reason, idempotent sync; tested by script, not yet by a technician in a cold workshop   | Pilot |
| Backup and restore                    | Built   | Dumped, restored into a fresh database, every row and every chain checked, in CI                                                                 | —     |
| Passport privacy                      | Built   | A shared passport names no owner, no price, no note; every view recorded                                                                         | —     |
| Passport trust, explained             | Built   | The seal, the chain, who recorded each entry                                                                                                     | —     |
| Credit notes and voids                | Built   | Invoices immutable; partial credits, refunds, reversals, refusals                                                                                | —     |
| Multi-location                        | Built   | Sites, warehouses per site, transfers, a group roll-up                                                                                           | —     |
| Technician performance                | Built   | Utilisation, efficiency, productivity per person and per site                                                                                    | —     |

A note on money. Everything is in pounds and British spelling. The tax list
above mentions GST, QST and HST, which are Canadian. The tax phase is written
so the engine is configured per organisation and either market works; which
one the product is for is a decision, not a phase.

---

## Phase 27 — The passport, listed, and the mark on the tab

**Scope.** A Passports page for the workshop listing every vehicle it has
written to, with the count of entries, the workshops that contributed, when
it was last verified and whether the chain is intact, opening onto the
passport already designed. A page in the portal listing the customer's own
passports the same way. A favicon and app icon drawn from the passport's own
emblem, so the tab is recognisable among twenty others.

**Exit.** An owner sees every passport in one place and opens any of them.
A customer sees theirs. The tab has a mark.

**Status.** Built. `/passports` lists every vehicle the workshop has written
to or been granted, with entries, the number of workshops that contributed
and how many entries came from elsewhere, the span of dates, and whether
the chain verifies, leading with how many are sound rather than how many
there are. `/portal/passports` lists the customer's own with the same facts
in plainer words and a button to open each or show it to a buyer. The chain
is verified per vehicle on request rather than cached, because a stored
verdict about a chain would be the one stored fact the design forbids. The
favicon and the home-screen icon are the passport booklet with the foil
wheel and laurel from the cover, and the shop-floor icons match. The
verification script checks the list against the ledger: every vehicle the
workshop wrote to is on it and no other, the counts are the ledger's, the
verdict is the chain's, and an owner sees the cars they own now and not the
one they sold. The controls crawl found that a workshop could list a
passport it had written to and then be refused the page, because reading
was granted by a job or a grant and not by having written; a workshop that
recorded an entry can now read it back.

---

## Phase 28 — Gift cards, deepened

**Scope.** Every movement typed: issue, redeem, refund, adjustment, with a
reason on the ones a person makes. A status read from the entries and the
dates: active, depleted, disabled, expired. An optional expiry set when the
card is sold. A card tied to a site or good everywhere. A card taken at the
counter as a tender, and against a deposit. A redemption reversed when the
invoice it paid is credited, so a credit note does not strand money on a
bill it can no longer be spent on.

**Exit.** A card can be sold, spent at the counter or on a bill, reversed,
adjusted with a reason and disabled, and every one of those is a row that
says why.

**Status.** Built. Every movement on a card is typed, issue, redeem, refund
or adjustment, and the database refuses a kind whose sign disagrees with
it. A card's status is read from its facts, never stored: active, spent,
lapsed or cancelled, cancelled winning over everything. A card may be sold
for a year or two years or for good, the default, and may be good at one
site or everywhere. At the counter a gift card is a tender that pays what it
can with the rest in cash, spent inside the sale's own transaction so the
sale and the spend stand or fall together, and posted as the liability
released rather than cash in the drawer. A refund by method gift card puts
the money back on the card that paid the bill. A person can add to or take
off a card with a reason, booked as goodwill or sundry income, and can
cancel one, which writes off what was on it with the reason and leaves the
number unusable. The deposits half waits for Phase 30, where deposits are
built. The verification script sells, spends on a bill and at the counter,
refunds onto the card, adjusts, cancels, and tries every refusal including
the wrong site and a lapsed card, against a real database.

---

## Phase 29 — Country and currency

**Scope.** A country and a currency on the organisation, chosen at sign-up
from a country picker and editable in settings by the owner; one currency
per workshop, because a workshop keeps one set of books. Every place that
says pounds or formats as British English reads the organisation instead:
invoices, estimates, payments, counter sales, gift cards, the ledger, the
pricing page. The portal shows each workshop's amounts in that workshop's
currency. The country feeds the tax phase, so a Canadian workshop starts
with GST and a provincial tax and a British one with VAT. The passport
stays free of money, so a car serviced in two countries has one history.
Not multi-currency inside one workshop.

**Exit.** A workshop signed up in Canada sees dollars everywhere and its
ledger balances in dollars; one in Britain is unchanged.

**Status.** Built. A country table in core carries, for each country the
product is sold in, its currency, language and region, timezone, and the
sensible first tax rate; adding a country is adding a row. The organisation
gained a country column beside the base currency, locale and timezone it
already had, and sign-up asks for the country first and writes all four
from it, with the first tax rate named and rated for the country and the
site following. The organisation settings page lets the owner change any of
the four, with the currency carrying a warning that nothing already recorded
is converted. The session carries the region, so every page in the workshop
formats money and dates from it rather than from a British default: two
hundred and thirty-nine hard-wired sites were replaced, the three shared
components take a locale, the libraries that write to customers look the
region up, and the portal formats by the workshop the driver uses most
while showing each amount in its own workshop's currency. The public
passport formats by the region of whoever last wrote to it. Plan prices on
the pricing page stay in pounds until a billing provider exists. The
verification script signs a workshop up in Canada and checks the region,
the tax rate, the session, a bill and the message that told the customer are
all in dollars, then moves it to France and checks euros; Britain is checked
to be exactly as it was.

---

## Phase 30 — Money owed ahead

**Scope.** A deposit taken before the work, as a screen rather than a flag:
a liability until it is applied to the invoice. An unapplied payment, and a
customer credit that a refund or an overpayment can become, applied to a
later bill. A receipt for every payment, printable and sent.

**Exit.** A customer pays two hundred pounds before the work, the books show
it as owed, the invoice takes it, and the customer holds a receipt for each.

**Status.** Built. Money held for a customer is one row type with a kind:
a deposit taken before the work, tied to a job when there is one, or a
credit kept on account when a refund is answered with "keep it as credit"
rather than sent back. Both post as a liability and never as revenue. What
is held is never stored; it is what came in less what went against bills or
back, and every movement says what it was for. On the invoice page, "Use
money held" puts it against the bill as a payment of kind DEPOSIT, oldest
first, as much as the bill needs unless an amount is typed, refused rather
than clamped; the posting releases the liability and never touches the
bank. The customer's page shows what is held with a way to give it back,
with a reason, the way money goes. Every payment now sends the customer a
receipt and has a printable one at /payments/[id]/receipt, built for
paper, with the chrome hidden when it prints. The verification script takes
a deposit, has the invoice take it, sends and reads the receipt, keeps a
refund as credit and spends it on the next bill, returns money held, and
checks every posting and every refusal against a real database.

---

## Phase 31 — Permissions at the resource, and the plan enforced

**Scope.** A script that calls every server action and API route as every
role, with the ids of another organisation and with a role it does not hold,
and fails on anything that answers. Fix what it finds. Plan limits enforced
where the feature is used, with the refusal naming the plan. Trial end,
grace, suspension and cancellation as states on the organisation, with data
retained.

**Exit.** The script passes. A workshop over its plan is told so where it
tries, not on the pricing page.

**Status.** Built, and taken ahead of the card provider because it needs no
keys. The probe, `verify-authz.ts`, reads every workshop page from disk with
the permission its page function asks for, mints a session for every role
(the seed has no manager, so it makes one and removes it), and knocks on
every door as every role: four hundred and fifty-two checks. A refusal
after the page has started streaming is a 200 with the redirect in the
stream, so the probe reads what a browser would. A technician is turned
back to the shop floor before any workshop page runs, and that is the check
for them. Another workshop's customer, supplier and receipt, asked for by
id as an owner, are not found rather than refused. The machine routes
answer 401 with nothing in hand, and a technician cannot pull a report
file. Then it reads every server action on every page, eighty-five of
them, and fails any that writes behind a reading permission: that found
six, on expenses, the team page, campaigns and automation, each now asking
for the writing permission. The plan is enforced where a thing is made: a
seventh bay on Core is refused with the number, and an API key on Core with
the plan that has one. The organisation carries four dates and a state
read from them: trial, grace, on a plan, read-only, cancelled. A read-only
workshop keeps reading and exporting and loses writing, with the refusal
landing on a subscription page that says why; choosing a plan reopens it,
and nothing is deleted in any state.

---

## Phase 32 — Card payment through a provider

**Scope.** A provider seam: create a payment, hand the customer a link, hear
the result, refund. A stub provider that behaves like a real one for the
tests, and one real adapter behind the same seam. Failed payments as a state
with a reason. Reconciliation: the provider's record and the ledger's record
compared, and the difference named rather than assumed away.

**Exit.** An invoice in the portal has a "Pay now" that works against the
stub end to end, and the real adapter passes the same script with keys.

**Status.** Built. The seam is four calls and a signature check: open a
checkout, ask what became of it, send some back, read a webhook. Behind it
sit a stub that takes pretend money at a checkout page of ours, and Stripe,
written against its HTTP API with no SDK; PAYMENT_PROVIDER chooses, stub by
default. An attempt is one try at paying some of an invoice: pending, then
succeeded, failed with the provider's reason, or cancelled, once and never
back. A succeeded attempt records the Payment (method online, reference the
provider's) and posts it exactly like a card at the counter, exactly once
however many times the provider says so, because the move is claimed
before the money is recorded. The portal's outstanding invoices have "Pay
now"; the customer comes back to the same page with the outcome, whichever
way it went, and if the provider has not said yet the page asks it. A
refund by card goes back through the provider that took it, asked before
anything is recorded here. The workshop's /payments/card lists every
attempt with its reason and can ask the provider about any; "Reconcile"
asks about the last ninety days and names each difference (paid there and
not here, here and not there, amount, currency, unknown, pending too long)
rather than fixing anything. The webhook fails closed: unsigned is 401, a
stranger's checkout is acknowledged and ignored, a replay changes nothing.
The verification script pays, declines, retries, refunds, breaks the two
records apart and watches reconciliation name it, and drives the webhook
over HTTP with the stub's signature; the same script against Stripe is the
same script with keys. Payment links sent in a message are still to come.

---

## Phase 32.5 — The customer's side, redesigned

**Scope.** The portal as a product rather than a list of pages: navigation
that is always there, a home that leads with what needs the customer,
rewards on their own page, a directory of every workshop on Carnet, and
booking at any of them.

**Exit.** A customer opens the portal on a phone and reaches invoices,
passports, updates and booking in one tap from anywhere; a customer with no
workshop finds one and books.

**Status.** Built, on 14 September 2026, from what the owner saw on their
own phone. The home page used to carry its own header with no navigation
at all, so invoices and passports were only reachable through a vehicle;
the tabs now sit at the bottom of the screen on a phone and under the
header on a desktop, on every page. The home answers "does anything need
me?" first, with a button on each answer: an estimate to decide, invoices
to pay by card, a recall to book. Then the cars as cards with one way in,
then recent work. Points and referral codes moved to a Rewards page,
because a referral code between somebody's cars and their service history
read as an advertisement. Every button reads as a button (Phase 32's
primitive change), and the Pay button is the filled primary with the amount
in it. A directory at /portal/workshops lists every active workshop with
somewhere to bring a car, findable by name or place; booking at one the
customer has never used makes them its customer on the spot, and the claim
page no longer says "ask the garage" as if there were one. The design book
carries the new home, the rewards page and the directory.

---

## Phase 32.6 — The subscription, billed

**Scope.** A card before the trial, through the provider; a 14-day trial;
the card charged automatically when the trial ends unless the workshop
cancels first, said in plain words on the sign-up form, in the terms, in a
reminder three days before, and on the billing page; a billing page with
the card, the next charge as a date and an amount, and the invoices;
cancelling in two presses, ending at the end of what was paid for.

**Exit.** A workshop opens, adds a card, sees its trial end date and the
amount it will pay, is reminded, is charged, sees the invoice, and can
cancel; nothing about any of it surprises them.

**Status.** Built, from the owner's own words: "it should be clear about
anything, we don't need to fraud our clients". The trial is fourteen days,
not thirty. Sign-up carries a required box that says, beside the button,
the price per bay, the plan, the day the card is charged and that
cancelling is two presses from Settings; the version of the terms accepted
is recorded on the organisation. The provider seam grew five calls (open a
subscription checkout that takes a card and starts a trial, ask what the
subscription is, cancel at the period's end, the provider's billing portal,
its invoices), behind which the stub takes a pretend card at a page of
ours and Stripe opens a subscription Checkout with `trial_period_days` and
`payment_method_collection=always`. Until the card is on file the
workshop is read-only and the subscription page says why; workshops that
started a trial before this phase are treated as on a plan. The state now
reads the provider's status too: past due keeps writing and asks for a new
card; cancelled on a plan stays open to the period's end; cancelled on a
trial closes now and is never charged. Three days before the trial ends
the hourly job sends the owner one email naming the card, the plan, the
amount and the date. A paid invoice and a failed one each tell the owner.
The billing page shows the card, the next charge as a date and an amount,
the plan's price times the bays, and the provider's invoices, with the
provider's portal for changing the card. The verification script opens a
workshop, adds a card, is reminded once, is charged through the signed
webhook, fails a charge and recovers, cancels on a plan and on a trial,
and reads the terms and the sign-up form for the sentences that matter.
Payment for the plan is still in pounds until prices are localised.

---

## Phase 32.7 — One currency, and the customer's account

**Scope.** A workshop sees and pays the plan in its own currency, the one
its books are kept in, and in no other: the pricing page, the sign-up box,
the terms, the reminder, the billing page and the provider's charge all
read one price book. And the customer's portal gets the account page it
lacked: details, password, what each workshop may send them, sign out.

**Exit.** A workshop in Canada never reads a price in pounds; a customer
finds their settings without asking.

**Status.** Built. The price book in core prices every plan, paid monthly
and paid annually, in each of the eleven currencies the country table can
put a workshop in, as round figures set by hand rather than an exchange
rate on the day; a currency it has never heard of falls back to pounds and
says so nowhere, because the country table cannot produce one. The pricing
page takes a country and shows that currency, with the tax named as that
country names it. On the sign-up form the country, the plan's price and
the sentence beside the terms box are one component, so changing the
country changes the price and the sentence in the same breath. The terms
carry the whole table. The charge itself, the reminder email, the billing
page and the provider's checkout all use the workshop's currency, and a
catalogue price on the provider is asked for in that currency. Two things
raised from the owner's own browsing were fixed on the way: the sign-up
page now says "Already have an account? Sign in" at the top of the form,
and the billing page's card button says what it does, "Payment methods and
invoices", with a line saying cards are added, changed or removed on the
provider's secure page. The customer's portal has an Account page with
their details (the name and phone the workshops know them by), a password
change that asks for the current one, what each workshop may send them by
email and text with every change recorded as consent with its source, and
sign out; it is a tab on the desktop and an icon in the header on a phone.

---

## Phase 33 — Data in, data out

**Scope.** Import from CSV for customers, vehicles, parts, suppliers and
opening balances: upload, map the columns, validate every row, preview,
import, with a report of what did not go in and why. Export of every dataset
a workshop owns, whole, in the same shapes. The passport records exported in
the form the network already exchanges.

**Exit.** A workshop with five thousand customers in another system is
running on Carnet by the afternoon, and could leave again with everything.

**Status.** Built. A CSV from any system is read as it comes (a byte-order
mark, either line ending, commas, semicolons or tabs, quoted fields with
newlines) and kept as it came, headers and rows, on an import batch. The
five datasets, customers, vehicles, parts, suppliers and opening balances,
each name their fields, the headers other systems use for them and how a
cell is read; a mapping is suggested from the headers and edited on the
page; a preview runs every row through the rules and names each problem by
spreadsheet row and field, so the report says "row 412, Email: not an
email address" and never "12 failed". The import writes what passed one
row at a time through the same functions the pages use, so a duplicate
customer is refused rather than doubled, a part gets its opening stock at
the main store, a VIN already on the network is adopted rather than
registered twice, and an opening balance goes in as one balanced entry or
not at all, with the difference to retained earnings and the report
saying so. A batch never runs twice. Every dataset a workshop owns exports
whole, as a CSV in the shape the import reads, and the passports as JSON
in the form the network exchanges; "Everything" is one file with all of
it, and exports work in every state of the subscription, read-only and
cancelled included. The verification script uploads five files in three
delimiters, watches the preview name the problems, imports, and reads
every export back.

---

## Phase 34 — The workflow, as one thing

**Scope.** An approved estimate becomes a job in one press, with the
approved lines on it and the parts reserved. Extra work found mid-job is
quoted and approved without leaving the job. Every hand-off in the five
workflows is counted in presses and the count is written down, then
reduced. A script walks a job from booking to pickup the way a front desk
would, and fails on any step that needs a second screen it should not.

**Exit.** The five workflows run end to end with no retyping, and the press
counts are in the document.

**Status.** Built. The five workflows are written down as a table in core,
hand-off by hand-off, with the presses each cost at the end of Phase 33 and
the presses it costs now, and the one screen it happens on; a unit test
fails if any hand-off ever costs more than it did, and the document
`docs/02-design/11-workflows.md` is generated from the table so the two
cannot drift. Across the five workflows the count fell from 37 presses to 20. What changed: a booking becomes a job in one press, with the customer,
the vehicle, the description, the notes, the technician, the bay and the
promised time already on it, and the booking marked converted in the same
transaction. An estimate raised from an inspection is priced as it is
raised (before, it carried a zero total and "Send the quote" refused it).
A customer who says yes at the counter is recorded in one press, under
their name and the name of the member of staff who took it, through the
same decision the customer's own page records. The approval itself puts the
approved lines on the job and, for every part line that names a stock item,
reserves the part or raises the purchase request for the shortfall; nothing
is pressed. Extra work found with the car on the ramp is quoted from a form
on the job: what, how many, at what price, which part; "Quote it now"
raises a supplementary estimate as the job's next version and sends it in
the same press, and the work already approved carries on, because a
supplementary quote never moves the job to awaiting approval and its
approval never moves the job backwards; the approved extra lines join the
job after the lines already there. The walkthrough script takes a job from
a booking to a paid bill through the same functions the pages call, records
every hand-off with its presses and its screen, reads the three screens the
desk uses and fails if the one button each needs is not on it, and fails on
any step over budget or on a second screen.

---

## Pilot — four weeks in a real workshop

Not a phase with code in it. What the front desk clicks and what they still
write on paper; whether a technician can inspect on the tablet with the
connection gone; whether the owner understands the reports; whether the
customer understands the passport; and what everybody does outside Carnet to
finish a job. The findings reorder everything below.

---

## Phase 35 — Arrival and departure

**Scope.** Check-in with mileage, fuel, visible condition, photos,
belongings, keys and a signature; check-out with the work done, final
mileage, payment, documents, keys and a signature. Key tags on the job:
which hook, who took them, when. Signatures as a record of their own,
reused for estimate approval, pickup, terms and warranty.

**Exit.** A car is handed over and handed back with a signed record of what
it was like each time, and the keys can be found.

**Status.** Built. "Car is here, start the job" on a booking now lands on
the check-in: mileage off the dash (refused if it goes backwards), fuel in
eighths off the gauge, a walk round the car ticking twelve places with a
note against each, what was left inside, which hook the keys go on, and a
signature pad; one press saves it in one transaction with the signature,
the key event, the mileage reading on the vehicle and the job's received
time, and the photographs are taken on the record it made, straight to the
store on a ticket like inspection photographs. A car is checked in once.
Check-out lists what was done, what is owed and whether it was paid, the
final mileage (refused below the arrival reading), the fuel, what goes back
with the car, a new mark since arrival, and a signature; a car cannot leave
before the work is marked completed, and cannot leave owing money unless
somebody writes down why, which is kept on the record. Both records, and
what they were like, show on the job and on the customer's own vehicle
page. Keys are events: hung on a hook, taken by somebody, put back, handed
to the customer; where they are now is the latest event, on the job page
and on each technician's job card with a one-press take and return. A
signature is a record of its own, kept as the strokes that made it rather
than a picture, with who signed, who captured it, the address and the
device; the check-in, the check-out and an approval given across the
counter all point at one, and the purposes for terms and warranty exist
for the phases that need them. The verification script checks a car in
with every refusal tried, moves the keys, approves a quote with a
signature, refuses to let the car leave unfinished or unpaid, hands it back
signed for, lets a fleet car leave owing with the reason written down, and
reads the two screens for the one button each needs.

## Phase 36 — Conversations

**Scope.** One Communication model with a channel, a direction, a thread,
attachments, assignment and read status; the existing email and SMS moved
onto it; inbound routed onto threads on the job and the customer; a
WhatsApp seam with a stub and one real adapter; templates that are messages
rather than placeholders.

**Exit.** A customer's whole exchange with the workshop reads as one
thread, on the job it is about, and the desk replies from there.

**Status.** Built. A conversation is a thread: one per customer, and one
per job when a message is about a job. Everything the product sends and
everything that comes back is filed onto it, whichever table it lives in
and whatever carried it; what was sent before threads existed is filed a
batch at a time as the page is opened, so nothing is migrated in the dark
and nothing is lost. A reply nobody can match to a customer stays in the
inbox for a person to file, as before, and filing it by hand moves it onto
the job's thread. The Inbox page became Conversations: the list unread
first with the last line as a preview, the thread oldest to newest with
what became of each message, and a composer that offers only the channels
the customer can be reached on, WhatsApp first if that is what they wrote
on. Templates are a workshop's own sentences with the few facts that
change filled from the job, refused if a fact is missing rather than sent
with a blank; five are built in and any number can be added on the page. A
payment link is one press: the amount owed and the portal link as a
sentence, refused when nothing is owed. Files travel with the record: kept
on the message and shown on the thread; the email and text providers do
not carry them yet and the message says what was attached. A thread is
assigned to a team member, read when opened, closed, and reopened by the
next reply. WhatsApp is a channel through the same transport seam as
texts: the console by default, Twilio's WhatsApp sender as the one real
adapter, and the inbound endpoint accepts it. The job page carries the
conversation, last three messages and a reply box, so nobody leaves the
job to answer the customer. The verification script files a quote, takes
a WhatsApp reply onto the same thread, answers it with a file through the
seam, fills and refuses templates, makes a payment link, assigns, closes
and reopens, leaves a stranger's message for a person, and reads the two
screens.

## Phase 37 — Packages and templates

**Scope.** A service package with labour, parts, checklist, duration,
skills, price and interval; a job template from it; a job from a package
in one press.

**Exit.** "Full service" is one press at the counter, online, and on a job
already open, and the job it makes is one a technician can pick up without
asking.

**Status.** Built. A service package is a piece of work priced and
described as one thing: lines of labour (hours and a rate), parts (units, a
price and optionally a part number that reserves stock on approval) and
fees, a checklist that becomes the job's tasks, a duration that becomes
the time to allow, a kind of work that brings the skills the planner
needs, a fixed price or the lines' sum, and an interval in months or
kilometres. Packages are saved whole on a settings page, so a job is never
made from a half-edited one; a package is retired rather than deleted. A
job from a package is one press: the new-job form takes a package and the
job is created with everything on it in the same transaction; a package
can be added to a job already open, after what is there, from the job's
own labour and parts card; a booking taken for a package sets its time
and, when the car arrives, becomes a job from that package; a customer
booking online is offered every bookable package with its price and its
description. Completing a job made from a recurring package sets the
vehicle's next one: one schedule per package per vehicle, refreshed rather
than duplicated, with the due date and the due mileage the reminders run
on. The job template the scope asked for is the package itself, applied to
an existing job. The verification script saves a package with every
refusal tried, makes a job from it in one press, adds it to a job under
way, books it and arrives it, completes it and reads the next one, checks
the online offer, and reads the three screens.

**Also this phase.** The user asked (15 September 2026) for the website in
Arabic and French as well as English, with a user-chosen language. That is
planned as Phase 37.5, before Phase 38.

## Phase 37.5 — Languages

**Scope.** The website in English, French and Arabic, with the language
the person's own choice: on the public site, at sign-in and sign-up, on
the customer's portal and on the workshop's navigation, with Arabic read
right to left. Asked for by the user on 15 September 2026.

**Exit.** A customer in Cairo and a workshop in Lyon each read Carnet in
their own language, chosen once and kept.

**Status.** Built. English is the source of truth: every sentence is
written in English where it is used and passed through one translator;
a dictionary per language maps the English sentence to its translation,
and a sentence with no translation is shown in English and named by the
coverage script, never shown as a key or a blank. The language is the
person's choice, on a cookie for a year and, once signed in, on their
account so the next device follows; else the browser's preference, else
English. The switcher is three buttons that post a plain form, on the
public header, the portal header and the workshop navigation, and send
the person back where they were. The root element carries the language
tag and the reading direction, so Arabic pages read right to left. This
phase translates the public site (home, pricing, sign-in, sign-up for a
workshop and for a driver, forgotten password, the terms), the customer's
whole portal (home, cars, passports, invoices, updates, rewards,
workshops, booking, account) and the workshop's navigation and shells:
around three hundred sentences in each language. The workshop's own pages
remain in English for now; the coverage script lists every sentence
without a translation and fails on any, so the remaining pages are
finished screen by screen as later phases touch them. The verification
script checks every sentence passed to the translator has both
translations, reads eight pages in each language for the root element's
language and direction and a known sentence translated, and checks the
switcher sets the cookie, saves the choice on a signed-in account and
never sends anybody off the site. Also this phase: the home page's claim
that the trial needed no card, untrue since Phase 32.6, replaced with
what is true; the call to action reads "Start your trial".

## Phase 38 — Parts back, work out

**Scope.** Returns, defective returns and cores with supplier credits, from
receipt to credit note. Sublet work: a vendor, a line on the job, a cost, a
charge to the customer, a payable.

**Exit.** A faulty part goes back and the credit comes off what the supplier
is owed; an alignment bought from the tyre place down the road is on the
customer's invoice and its cost is on the books.

**Status.** Built. A part goes back to the supplier from the order it came
on, for one of four reasons: faulty, wrong, not needed, or a core. Nothing
goes back that was not received, less what already went back, and a part
that is no longer on the shelf cannot go back as stock. The first three take
the parts off the shelf in the same transaction as the return, as a return
movement at the shelf's average cost, and post that cost from stock to a new
account, supplier credits due. A core never touches the shelf: it is the old
unit off the car, and its charge is entered with it. Open returns wait on a
returns page; the credit note goes in with its number, net and tax, is
claimed once, and comes off the supplier's open bills oldest first; what
cannot be set against a bill is held on their account, shown on the payables
page, and set against the next bill booked for them. The posting clears the
credit due against the payable and gives the input tax back; a credit short
of the cost held goes to stock adjustments, and a core's credit reduces the
cost of parts. A supplier who refuses is recorded with the reason and the
value held is written off. Sublet work is added to a job with a vendor, a
description, a cost and a charge: it becomes a line the customer is invoiced
on, shown as sublet, with its margin beside it; "The work is back" marks it
done; the vendor's bill is booked from the job once, as a supplier bill
owed like any other, at the real cost, which replaces the estimate on the
line so the job's margin is what it made, and posts to a new account, the
cost of sublet work. The verification script delivers and bills an order,
sends faulty parts back and credits them, has a return refused, sends a
core back and holds the leftover credit until the next bill, refuses a
return beyond what was received, adds sublet work to a job, bills it,
invoices it, checks the trial balance balances, and reads the three screens.

## Phase 39 — Finding anything

**Scope.** One search box for customers, registrations, VINs, telephone
numbers, job numbers, invoice numbers and part numbers. A notifications list
for staff, each entry opening the record it is about.

**Exit.** Whatever is on the piece of paper, the caller's screen or the
windscreen, one box finds it; and nobody learns about an approval by
walking over to ask.

**Status.** Built. One box at the top of the workshop navigation reads what
is typed the way somebody at the counter would: a plate is compared with
its spacing and punctuation removed, so "bj21oyd" finds BJ21 OYD; a VIN is
seventeen letters and digits however it was spaced; a telephone number is
its digits, with or without the spaces and brackets; a job number with or
without its hash or the word job; an invoice number and a part number as
written. A single exact identifier goes straight to its record, because
somebody who typed a plate wants the car and not a list with one car in
it; a name is never exact and gives a list grouped by kind, exact matches
first. Everything is scoped to the workshop: a vehicle is found only if
this workshop has worked on it or holds a grant to it, so the box is never
a way to read the network; the plate and telephone comparisons have
indexes of their own. Notifications are one row per person: a customer's
answer to a quote, a message from a customer, a booking taken online, a
card payment, and a technician's part request each go to the members whose
role would act on them and never to whoever caused them; the bell in the
navigation carries the unread count; the list puts unread first, marks all
read in one press, and each entry opens its record and marks itself read.
Telling somebody never decides whether the thing happened. The verification
script finds a car by its plate typed two ways and by its VIN, a customer
by their number, a job by its number two ways, an invoice and a part, a
list by a name, nothing from one character, and sends a decision and a part
request, checks who was told and who was not, opens one, and reads the
exact search going straight to the car and the notifications page.

## Phase 40 — The owner's day, sharpened

**Scope.** Comeback rate; reputation trend by site and by person; supplier
comparison when a part is short, and supplier performance over time; the
dashboard's today, business and inventory blocks reviewed against what the
pilot's owner actually asked.

**Exit.** The owner can say how much work comes back and whose it was,
whether customers are happier than last quarter and where, who to ring for a
part that has run out, and which supplier has quietly got slower, without
opening a spreadsheet.

**Status.** Built. A job can be recorded as earlier work on the same car
coming back: the job page offers finished work on that car from the thirty
days before, allows anything up to ninety, and refuses a comeback without a
sentence saying what came back, on another car, from work finished after
this job was opened, or pointing both ways; the database refuses one with no
reason too, and taking it off is kept in the audit log. The comeback rate is
measured on work finished in the period and counted against the site and
every technician who did the work that came back, never against whoever put
it right; below ten finished jobs it gives the count and not a percentage.
It sits on the business report beside the comebacks themselves. The
reputation page now shows the last six months and the last ninety days
against the ninety before, for the workshop, each site and each technician
on the rated job, with a direction only when both windows have five answers.
Every part's page lays every active supplier side by side: what they last
charged for it, how often, their typical wait, how often they arrived by the
day promised and how much was sent back as faulty or wrong, with cheapest,
quickest and most reliable marked only where two can be compared, and one
press opens an order to that supplier with the part, the quantity and their
last cost filled in; the reorder suggestion now uses the quickest measured
wait. Each supplier's page shows the year quarter by quarter and says in a
sentence whether they are getting slower or less reliable. The pilot has not
started, so there was no owner's list to review the dashboard against; it
was reviewed instead against the order the product's own brief gives for
running the business (today, the jobs, the people, the stock, the money).
Two tiles that showed a word rather than a figure were replaced; today now
counts bookings and who is clocked on; a business block shows what is owed
and overdue, the comeback rate and the satisfaction trend, gated to people
who can read reports; an inventory block shows what is short with nothing on
order, orders past the day promised, jobs waiting for parts and the value on
the shelf, and lists the short parts, each opening its supplier comparison.
The dashboard is now translated into French and Arabic. The authorisation
script now names the one action that writes only the person's own rows,
marking their notifications read, rather than failing on it. The
verification script records and refuses comebacks, reads the rate move for
the workshop and the technician and move back when the link is taken off,
moves the reputation trend with one answer, compares two probe suppliers of
one part, reads one of them getting slower over the year, and reads the job,
part, supplier, report, reputation and dashboard pages, the dashboard in
French, and an order opened from a part arriving filled in.

## Phase 40.5 — Every word translated

**Scope.** Every piece of text a person reads, in French and in Arabic: every
workshop page, the technician's surface, the shared components, the UI
package's own words, page titles, and the sentences the product writes when
it refuses something. Asked for by the user on 15 September 2026, during
Phase 41: a page that is half English is useless to somebody who reads only
French or only Arabic. Phase 41 was paused, its tested core kept aside, and
resumed after.

**Exit.** Somebody who reads no English can run the workshop from end to end
in French or Arabic, and a sentence added later in English only is refused
before it ships.

**Status.** Built. A scanner reads the source with the TypeScript parser and
names any text that reaches a page without passing through the translator:
text between tags, text attributes, strings shown in braces on either side of
a condition, text properties in objects on a page, the sentence handed to a
?problem= redirect, and page titles. It found 4,322 pieces in 147 files, and
now finds none. A second mode reads every sentence thrown by the web libraries
and core, and every refusal returned as a message, including both sides of a
condition and pieces joined with a plus; each is a key with numbered slots,
and all 504 have French and Arabic. The translator matches a finished English
sentence against keys with slots, fills the slots with the values it read,
translates those values when they are known sentences, and puts English month
and weekday names beside a number into the reader's language; a key whose
fixed words are too small a share of the sentence is not trusted, so it cannot
half-translate an unrelated sentence. The dictionaries are split by area of
the product so each could be written without touching another's, and hold
5,511 sentences in each language, from 417. Components that run in the browser
read the language from the root layout; the UI package's components take the
page's translator. Mileage findings and the buyer's report write their dates
in the reader's locale. Changed on the way: the stock pages say "Still to
arrive", "Arrived so far" and "Old unit (core)" where one English word had
two meanings; the diary's placement sentence no longer reads "1 names no
technician"; the inspection screen names the workshop's currency instead of
pounds; names and example addresses are never translated. Left in English on
purpose: what staff type, template bodies and drafted replies sent to the
customer word for word, and the audit log's raw action codes on its own page.
Emails and text messages to customers are not part of this phase: they
depend on the recipient's language, not the reader's. The languages
verification script now fails when the scanner finds any text or any refusal
without both translations, reads five workshop pages in each language and
checks a known sentence is translated and its English is not left on the
page.

## Phase 41 — Tax, configurable

**Scope.** Several taxes on a line, exempt customers, tax by site, inclusive
or exclusive pricing, a report per tax. The currency decision made and
applied.

**Exit.** A workshop in Quebec charges GST and QST on the price with GST in,
a workshop in Dubai prices with VAT in, a fleet with an exemption
certificate pays none, and each files its return from one page.

**Status.** Built. A tax rate is now one or more taxes, up to three, each
with its name, its percentage and whether it is charged on the price with
the taxes before it in; every existing rate became a rate of one tax, and
sign-up creates rates that way. Each tax on a line is worked out and rounded
on its own, and the document's breakdown has one band per tax, each counting
the net it was charged on. A workshop chooses whether prices are entered
before tax or with tax in; with tax in, the taxes are taken out of the price
and the rounding penny goes to the largest tax, so the line still comes to
the price. A customer can be exempt only with the certificate or registration
number that makes them so, refused without it by the product and by the
database; their invoices charge no tax, carry the certificate, and are
declared as exempt sales. A site can have its own rate, which every new line
there takes: quotes raised from an inspection (which before this phase
carried no rate at all), extra work, packages, sublet work and the counter.
Every document writes what each tax came to when it is issued, as an
append-only tax entry: an invoice, a credit note (each tax given back in
proportion, to the penny), a counter sale and the fleet's monthly invoice;
the database refuses to change one. Invoices already issued were written as
entries by the migration. The report per tax, at `/reports/tax` and as CSV,
gives each tax and rate for the last or current quarter or month or the year:
what it was charged on, what it came to, what credit notes gave back, what is
owed, and the same per site; it reads only the entries, so a rate retired
later cannot change a return already filed. A rate already on an invoice
cannot have its taxes changed; a new rate is added and the old retired. The
ledger keeps one tax payable account, which the report reconciles to. The
currency decision, made in Phase 29, stands and is now applied to tax: one
currency per workshop, every document and every tax entry carries the
currency it was issued in, and the report reads in the workshop's own. The
verification script saves a rate of two taxes and refuses three bad ones,
sets it as a site's rate, issues an invoice that declares each tax,
refuses to rewrite the declaration, credits half and reads half of each
given back, refuses an exemption without a certificate by both the product
and the database, invoices an exempt customer with no tax and the
certificate, invoices at a price with tax in and reads it come to the price,
takes a counter sale that declares its taxes, reads the report move by
exactly what was declared, refuses to change the taxes of a rate on an
invoice, and reads the report (in French too), the invoice, the settings and
the customer's page. Also this phase: `verify-counter` measures the drawer by
what its own sale added, so an earlier run's till no longer fails it.

## Phase 42 — Paper

**Scope.** Print styles for every document; a printable work order; invoice,
estimate and inspection report as PDF; labels, key tags and QR codes;
receipts.

**Exit.** The technician works from a printed work order, the keys hang on a
tag that says whose they are, the shelf is labelled, and a customer can be
handed or emailed any invoice, quote or inspection report as paper or a PDF,
in their language.

**Status.** Built. Seven documents print from their own pages at `/print`,
outside the workshop's layout: the invoice, the quote, the inspection report,
the work order, the key tag, a sheet of part labels and the counter receipt.
Each has the workshop's letterhead (name, legal name, address, telephone,
email and tax number), stamps what is not final (a draft, a void invoice, a
quote declined or superseded, a cancelled job), and is translated and laid
out right to left in Arabic, with names, plates, addresses and figures kept
in their own direction. The invoice lists each tax as declared, the
exemption certificate and whether prices include tax. The work order carries
the checklist, labour, parts and their state, what the inspection found, the
condition at arrival, the keys' hook and lines for the technician and the
quality check. The key tag gives the plate, the job, the surname only and the
hook. Labels fill A4 sheets of 21 with a QR code, part number, name, bin and
price, capped at a hundred of a part and five hundred in a run. The receipt
is 80 mm wide. QR codes are drawn on the server as SVG: the invoice opens the
customer's invoices, the quote its approval page, the report the car's
record, the work order, key tag and labels their records in the workshop.
Every document is also a PDF, rendered from the same page by a headless
browser (Playwright's own locally, `@sparticuz/chromium` on the server), so
the file and the paper cannot disagree and Arabic is shaped as the browser
shapes it; when no browser can start, the PDF link falls back to the print
page and opens the print dialog. Who may read a document is decided once:
a member of the workshop with the permission for that kind, a technician the
work order and key tag of a job they are on, a customer their own invoices,
quotes and inspection reports; anything else is not found. Every workshop
page now prints cleanly too: the navigation, buttons and forms fall away and
the page is drawn light whatever the theme. The documents are reached from
the invoice, job, part, counter and shop-floor pages and the customer's
invoices in the portal. The verification script reads all seven as the owner
with their own words, no navigation and QR codes, in French and Arabic;
fetches the invoice as a real PDF named for the workshop and the number, as
the owner and as the customer; checks a technician prints their job's work
order and not another's nor an invoice, a customer their own invoice and not
another's nor a work order, another workshop nothing, and nobody signed out
anything; refuses six hundred labels; and finds the links on the pages.

## Phase 43 — Providers

A VIN decoding seam and a fitment feed seam, each with a stub; payroll with
overtime, deductions, bonuses and a named export; reviews posted to Google
behind a seam.

## Phase 44 — Ownership, warranty and sites

Transfer by invitation: the seller starts it, the buyer accepts, the seller's
access ends and the history stays. Warranty cost and profitability. Prices
and tax per site.

## Phase 45 — The first day

A setup checklist a new workshop works through; a demonstration workshop
with a year of sample data; help that can be searched from inside the
product.

---

## Running throughout — the four things that are not features

**Every phase ends with the checks.** Format, lint, types, unit tests, the
build, every route rendered for every role, every page with nothing in it,
accessibility, every control doing something, and the phase's own verification
script run against a database. A phase is not finished when it works once.

**Responsive, not merely narrow.** Every screen built in these phases is used
on a phone by somebody holding a part in the other hand.

**Complexity that stays honest.** Every list gets a bound and every derived
figure gets a cost. `timelineFor` merges five queries in memory deliberately,
because a customer has hundreds of events rather than millions, and that
reasoning is written down where it applies. Where a figure does grow with the
organisation, it gets an index or a cached column, not a comment hoping it
will be fine.

**Nothing waits on a blank screen.** Where a page cannot render immediately,
it shows the vehicle rather than a spinner: a car being worked on, drawn in
the product's own terms, that makes a slow moment feel like part of the
product rather than a fault in it.

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
