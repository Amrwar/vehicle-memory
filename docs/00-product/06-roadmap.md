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
