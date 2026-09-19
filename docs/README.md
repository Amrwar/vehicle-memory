# Carnet — Documentation

Carnet is a **portable vehicle history that follows the car**, with a workshop
management and ERP platform built on top of it.

Two surfaces, one data core:

| Surface             | Who uses it                                                  | What it is                                                                                                                            |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Carnet Passport** | Vehicle owners, buyers, sellers                              | The permanent, portable, tamper-evident timeline of a single vehicle, keyed to its VIN. It transfers on sale.                         |
| **Carnet Workshop** | Workshops, technicians, service advisors, owners/accountants | Booking → job → inspection → estimate → approval → parts → work → QC → invoice → payment, with ERP consequences posted automatically. |

The strategic link between the two: **a workshop doing its ordinary daily work
writes verified events into the passport as a side effect.** That is how the
network gets its data without asking anyone to do extra work.

---

## How to read these docs

Read in this order if you are new to the project.

### 0. Product — why this exists

| Doc                                                             | Contents                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Vision](00-product/01-vision.md)                               | The problem, the product thesis, what winning looks like           |
| [Proposal](00-product/02-proposal.md)                           | The commercial proposal: scope, cost, timeline, team, deliverables |
| [Market & competition](00-product/03-market-and-competition.md) | Competitive landscape and the feature matrix vs. MechanicDesk      |
| [Personas](00-product/04-personas.md)                           | The six people this software is for, and what each one needs       |
| [MVP definition](00-product/05-mvp-definition.md)               | Exactly what is in and out of the first shippable release          |
| [Roadmap](00-product/06-roadmap.md)                             | Phases 1 to 20, each with its exit condition and where it stands   |
| [Business model](00-product/07-business-model.md)               | Pricing, unit economics, the data revenue-share                    |
| [Coverage map](00-product/08-coverage-map.md)                   | Every capability, and whether somebody can actually do it          |

### 1. Requirements — what it must do

| Doc                                                                              | Contents                                                            |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [Functional requirements](01-requirements/01-functional-requirements.md)         | Numbered, testable FR-### statements by module                      |
| [Non-functional requirements](01-requirements/02-non-functional-requirements.md) | Performance, availability, security, privacy, accessibility budgets |
| [User stories](01-requirements/03-user-stories.md)                               | Epics and stories with Given/When/Then acceptance criteria          |
| [Traceability matrix](01-requirements/04-traceability-matrix.md)                 | Requirement → story → schema → code → test                          |

### 2. Design — how it is shaped

| Doc                                                                | Contents                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Domain model](02-design/01-domain-model.md)                       | Bounded contexts, aggregates, invariants, the ubiquitous language                                                                                                                                                                                                                                              |
| [Data model & ERD](02-design/02-data-model.md)                     | Every table, key, index and relationship                                                                                                                                                                                                                                                                       |
| [Architecture](02-design/03-architecture.md)                       | C4 context/container/component, runtime, deployment                                                                                                                                                                                                                                                            |
| [State machines](02-design/04-state-machines.md)                   | Job lifecycle, estimate approval, stock reservation, invoice                                                                                                                                                                                                                                                   |
| [Security model](02-design/05-security-model.md)                   | Authn, authz, tenancy isolation, threat model, passport integrity                                                                                                                                                                                                                                              |
| [API contract](02-design/06-api-contract.md)                       | The three live read endpoints and their keys, then the contract for what follows                                                                                                                                                                                                                               |
| [Accounting model](02-design/07-accounting-model.md)               | Chart of accounts and the exact journal postings each event makes                                                                                                                                                                                                                                              |
| [Design system](02-design/08-design-system.md)                     | Colour, type, spacing, elevation, components, dark mode, a11y                                                                                                                                                                                                                                                  |
| [Wireframes](02-design/09-wireframes.md)                           | Every screen, annotated                                                                                                                                                                                                                                                                                        |
| [The passport, designed](02-design/10-passport-design.md)          | Why the passport looks like a passport: every choice and the fact it carries                                                                                                                                                                                                                                   |
| [The design book](Carnet-Design-Book.pdf)                          | Every design photographed from the running app: when, why, meaning, why it works. Word beside it; rebuilt by `npm run docs:design-book`                                                                                                                                                                        |
| [The system architecture document](Carnet-System-Architecture.pdf) | How the system is put together and processes data: request and write paths, every workflow as a data flow, the database domain by domain with ER diagrams read from the schema, security in the data path, wireframes and photographs of the interface. Word beside it; rebuilt by `npm run docs:architecture` |

### 3. Decisions

[Architecture Decision Records](03-adr/) — one file per decision, with context,
options considered, and consequences. Start at [ADR-0001](03-adr/0001-record-architecture-decisions.md).

### 4. Engineering — how we build it

| Doc                                                       | Contents                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Getting started](04-engineering/01-getting-started.md)   | From clone to running app                                                        |
| [Coding standards](04-engineering/02-coding-standards.md) | Conventions, layering rules, naming                                              |
| [Git & branching](04-engineering/03-git-and-branching.md) | Trunk-based flow, commit format, review rules                                    |
| [Testing strategy](04-engineering/04-testing-strategy.md) | The pyramid, what we test where, coverage gates                                  |
| [CI/CD](04-engineering/05-ci-cd.md)                       | Pipelines, gates, environments, release process                                  |
| [Observability](04-engineering/06-observability.md)       | Logs, metrics, traces, alerts, SLOs                                              |
| [Runbook](04-engineering/07-runbook.md)                   | On-call procedures for the things that break                                     |
| [Deployment](04-engineering/08-deployment.md)             | Hosting shape, Neon and Vercel setup, the worker, and what must never be rotated |
| [Doing it twice](04-engineering/09-repeating-a-write.md)  | What a repeat does to every write that moves money or stock, and what stops it   |

### 5. Project management

| Doc                                                       | Contents                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| [Ways of working](05-project/01-ways-of-working.md)       | Cadence, ceremonies, roles                                           |
| [Definition of done](05-project/02-definition-of-done.md) | The checklist a story must pass                                      |
| [Estimation & plan](05-project/03-estimation-and-plan.md) | Sizing, the sprint-by-sprint plan                                    |
| [Risk register](05-project/04-risk-register.md)           | Ranked risks with owners and mitigations                             |
| [Glossary](05-project/05-glossary.md)                     | The ubiquitous language, defined once                                |
| [Pilot plan](05-project/06-pilot-plan.md)                 | Four weeks in one workshop: what is measured, and what would stop it |

---

## Status

Fifty-nine phases have shipped, the last on 19 September 2026, and the pilot
itself — Phase 54 — is ready to run: the workshop core,
inventory and procurement, the ledger, people and multi-site, automation and
CRM, the customer's own side, the money cycle, payables and payroll, answers in
words, the network between workshops with a read-only API, the workshop
configuring itself, the vehicle's paperwork, and the loyalty programme and its
referrals in front of the counter and the customer, gift cards, the
passports listed side by side, a country and currency per workshop, and money
held ahead of a bill with a receipt for every payment, and the permissions
tried as every role with the plan enforced where things are made, and card
payment through a provider from the customer's portal, redesigned around a
navigation that is always there and a directory of every workshop, and the
subscription billed: a card before a fourteen-day trial, charged when it ends
unless cancelled, with every sentence of that on the form, priced in the
workshop's own currency, the customer's account page, and data in and out: a
CSV from any system mapped, previewed and imported, and everything exported,
and the workflow as one thing: a booking that becomes a job in one press, an
approval that puts the work on the job and reserves the parts, extra work
quoted without stopping the job, and the five workflows counted in presses
([02-design/11-workflows.md](02-design/11-workflows.md)), and arrival and
departure: the car checked in and handed back against a signed record of
what it was like, and the keys found, and conversations: one thread per
customer and per job over email, text and WhatsApp, answered from the job, and
service packages: work priced as one thing, a job from it in one press, and
languages: English, French and Arabic, the person's choice, on the public
site, the portal and the workshop's shells, and parts back and work out:
returns and cores credited against what a supplier is owed, and sublet
work on the job at its real cost, and finding anything: one box for a plate,
a VIN, a phone number, a job, an invoice or a part, and notifications for
staff, and the owner's day: the comeback rate, the reputation trend by site and
person, suppliers side by side on every part and over the year, and a
dashboard in three blocks, and every word translated: every page, component,
page title and refusal in French and Arabic, with a scan that fails on any
text left outside the translator, and tax made configurable: several taxes on
a rate, prices with tax in, exempt customers, a rate per site, and a report
per tax read from what each document declared, and paper: seven documents
that print and download as a PDF in the reader's language, with QR codes,
key tags and part labels, and providers: a VIN decoder and a fitment feed
behind seams, payroll with bonuses, deductions, the workshop's own overtime
rate and three named files, and a five-star answer taken straight to Google, and
ownership, warranty and sites: a sale the buyer accepts rather than one a
workshop asserts, warranty costed at what it actually cost, and labour rates
and part prices that can belong to one site, and the first day: a setup list
read from the workshop's own data, a demonstration workshop with a year of
work in it, and help that is searched from the same box as everything else,
and coupons: a code a customer arrives holding, refused with the promise it
did not meet, and booked as what the offer cost rather than as money in.
The
[roadmap](00-product/06-roadmap.md) carries a status paragraph under each
phase, the [feature map](00-product/09-feature-map.md) counts 354 capabilities
built, 1 partial and nothing missing, and the
[traceability matrix](01-requirements/04-traceability-matrix.md) traces 665
requirements to code and tests. Every phase ends with the same checks, listed
in the [testing strategy](04-engineering/04-testing-strategy.md).

What has still not happened is the thing the [MVP definition](00-product/05-mvp-definition.md)
asks for: four weeks in front of a real workshop. Everything above is evidence
of effort, not of fit — and Phase 54 is about making sure that when those four
weeks do happen, what comes out of them is evidence rather than recollection. The [roadmap](00-product/06-roadmap.md) now
carries an audited plan for Phases 27 onward, ordered by what that pilot
would trip over first, with the pilot itself placed after Phase 34; Phases 34
to 45 are now built, Phase 45.5 closed the last missing capability, and Phases
46 to 46.7 asked what happens when a write is asked for twice and then swept
three times for anything built that could not be reached. Phase 47 turns the
question round: not whether an operation did the right thing, but whether the
figures still agree with each other afterwards — an invariant suite over the
whole ledger, and a page at `/books` that says so. Phase 48 asks the question
a workshop asks before any of the rest of it matters — can the garage down the
road see my customers — by creating a second workshop and trying, at every
address the application answers on. Phase 49 loses the database on purpose and
measures what it costs: one second of work and five seconds of downtime on the
seeded workshop, with a written record of everything that came back missing,
orphaned or broken. Phase 50 gives whoever runs Carnet a page of their own at
`/admin/health`, and answers on a screen the question a workshop actually
rings about: why did this customer not get their message? Phase 51 fills a
workshop to the size of a real one — a hundred thousand customers, half a
million jobs — and holds every screen to a measured budget; the slowest was
twelve seconds and is now a tenth of one. Phase 52 turns the question round
once more and measures the workshop rather than the software: nine stretches
of the work, from the car arriving to the money arriving, taken from records
the product already keeps and honest about how much it could see. Phase 53
takes the thirteen things real workshops do that tidy software does not expect
— two customers sharing a car, a job cancelled after the parts arrived, a
customer who pays too much — and gives each one a decided behaviour with a
reason, held to it by a check.

Phase 54 is the pilot, and it is the one phase that is **ready rather than
run**. Four weeks in a real garage cannot be done by a machine, and calling it
built would be the only dishonest line in this documentation. What was built
is everything that has to exist before the first morning, tested against the
question the pilot ends on: can the product produce a list of what broke, what
was slow, what was missing and what nobody used? Three of the four already had
a source. The fourth did not, so uptake is now counted at `/reports/uptake`
from the audit log the product has kept since the first phase — forty-one
capabilities, named the way a garage would name them, honest on the page about
the fact that it counts what people did and not what they looked at, because
recording what people looked at would make it a surveillance log. The rest —
who the workshop is, what is in place on day one, what would end it early and
what success means — is in the [pilot plan](05-project/06-pilot-plan.md),
written before it starts, because a success criterion agreed afterwards is not
a criterion.

Phase 55 is the last one, and it is about the roadmap's own footnotes: four
promises made about every phase rather than about any one of them, which
nothing had ever checked. A promise about everything is a promise about
nothing — there is no single place it can fail, so it never does. Asking
properly found twenty-six of the seventy-four verification scripts never run by
anything (one of them failing since Phase 50), three quarters of the screens
never measured, fifty lists with neither a bound nor a stated reason, a trial
balance that read every posting a workshop had ever made, the customer's entire
side with no loading state at all, and two real bugs behind checks that had
been asleep — a referral card that threw for anybody who had ever brought a
friend in, and a demonstration workshop with no labour rate. All of it is
fixed, and `npm run verify:throughout` is the ten checks that would say so
again.

Phase 56 turns the same question on the other half of the requirements. There
are eighty-four non-functional ones — how fast, how safe, how private, how
legible, how available — and exactly one of them appeared in the traceability
matrix. Several were in fact enforced thoroughly, but anonymously, which is the
problem: a requirement whose enforcement nobody can name is a requirement
nobody can check has stopped being enforced. All eighty-four are now accounted
for by `npm run verify:quality` as checked, read off the repository, or not
yet — and the twenty that are enforced by nothing say what each would take,
because a penetration test needs somebody whose job it is and a month of uptime
needs a month. Two were closed rather than described: the logger now takes
credentials out by name before writing a line, and the screens a workshop lives
in are verified in Safari and Firefox as well as Chrome, which matters when a
customer opens their quote on an iPhone.

Phase 57 closes three more of them, and the three that mattered most for a
pilot. Nothing had ever sent an alert about anything: every signal was on a
page, which is the right thing to look at once you know something is wrong and
no use at all at four in the morning. Something going wrong now reaches the
operator as one message — not none and not six — carrying what it means, the
one thing to do first, and what it would mean to have fixed it. A signal
nobody has written an action for cannot become a message at all; it is
reported as needing one and the check fails, which is the strongest available
reading of "an alert with no action is deleted".

Phase 58 asks the question none of the fifty-seven before it did: not whether
the product works, but whether the copy of it in front of you has been
configured to do anything. The worst setting is not the one that stops the
product — a missing database stops the boot and somebody fixes it in a minute.
A mail transport left on `console` stops nothing at all: every page works,
every button responds, every message is written down as queued, and not one
customer hears a word. All forty-seven settings the application reads now say
what a workshop would feel without them, ranked so the silent failures come
first, and `npm run launch:handover` refuses while any of them is missing or
only pretending. Writing it found fourteen settings that bypass the
environment schema entirely — including the one whose absence writes every
inspection photograph to a disk a serverless host throws away.

Phase 59 answers the question a workshop asks more often than any other, and
which nothing could answer: _I pressed the button and nothing happened._ Every
request now carries one identifier, and every record it causes carries the same
one — the audit row, the queued event, the message, the note on somebody's
screen — including the background work, which inherits it from the event that
woke it. `/admin/health` takes that identifier and shows the chain in the order
it happened, because where it stops is what went wrong. Nothing invents one: a
reminder queued at four in the morning was nobody's press, and the column stays
nullable so that "nobody pressed anything" and "we lost it" remain different
answers.
