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

| Doc                                                       | Contents                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [Getting started](04-engineering/01-getting-started.md)   | From clone to running app                                                                   |
| [Coding standards](04-engineering/02-coding-standards.md) | Conventions, layering rules, naming                                                         |
| [Git & branching](04-engineering/03-git-and-branching.md) | Trunk-based flow, commit format, review rules                                               |
| [Testing strategy](04-engineering/04-testing-strategy.md) | The pyramid, what we test where, coverage gates                                             |
| [CI/CD](04-engineering/05-ci-cd.md)                       | Pipelines, gates, environments, release process                                             |
| [Observability](04-engineering/06-observability.md)       | Logs, metrics, traces, alerts, SLOs                                                         |
| [Runbook](04-engineering/07-runbook.md)                   | On-call procedures for the things that break                                                |
| [Deployment](04-engineering/08-deployment.md)             | Hosting shape, Neon and Vercel setup, the worker, and what must never be rotated            |
| [Doing it twice](04-engineering/09-repeating-a-write.md)  | What a repeat does to every write that moves money or stock, and what stops it              |
| [What CI costs](04-engineering/10-ci-minutes.md)          | Why the browser suite stopped running on every push, and the two ways to stop paying for it |

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

Sixty-one phases have shipped, the last on 19 September 2026, and the pilot
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
phase, the [feature map](00-product/09-feature-map.md) counts 365 capabilities
built, 1 partial and nothing missing, and the
[traceability matrix](01-requirements/04-traceability-matrix.md) traces 744
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

Phase 60 measures the other half of what a person waits through. Phase 51
measured the server — how long the application took to produce the bytes — and
said nothing about how long after that the screen showed the thing, or whether
it held still once it did. Both are now measured in a browser over a connection
that is named rather than implied: Slow 4G, with the processor slowed four
times, three runs a screen and the middle one counting. Everything came in,
paint between 1.1 and 1.5 seconds against a budget of two, and layout shift of
exactly zero — which is the sort of number worth being suspicious of, so the
measurement is made to prove it can see a shift before its zeroes are believed.

Phase 61 closes the oldest gap in this documentation: eighty-four requirements
from the first two phases traced by section rather than by requirement, named
at the foot of the matrix for months. Closing it meant reading each one against
the source, and that turned up five requirements the product does not meet —
including exporting and erasing a customer's personal data, which the security
model specifies column by column and no code does — thirty-four rows naming
test files renamed years earlier, and three entries in the quality register
that claimed an enforcement which tests something else entirely. Every
requirement now has a row of its own, and `npm run verify:traceability` checks
that the rows are true: every test a row names exists, every function a row
names exists in the source, and the coverage summary is counted from the table
rather than remembered.

Phase 62 builds the one of those five that mattered most. A customer can now be
taken out of the database entirely — name, address, telephone, portal login and
signature — while the workshop keeps its books for the seven years the law asks
and the car keeps its history, which belongs to the car rather than to whoever
owned it. `npm run verify:erasure` does not read the register back to itself:
it searches every text column of every table for the person's own name, email
address and address afterwards and requires nothing back, then totals the books
and verifies the passport chain to prove that taking a person out did not take
the workshop's records with them.

The hard question in it was a conflict between two promises the product had
already made. The passport is append-only and hash-chained, so an event
supersedes rather than replaces and the original survives — which is the point
of it, and which means a name written into that chain can never come out. The
answer was not a cleverer erasure but to stop writing names in: a transfer says
the car changed hands and which keeper this is, and who they were lives in the
ownership row, where it can be anonymised. The security model had implied that
from the first month — passport events describe the vehicle, not the person —
and the code had been doing something else.

Phase 63 closes FR-108, the other requirement Phase 61 found the product did not
meet: a person may work at more than one workshop and must say which one they
are in. The schema always allowed it — an invitation to an address that already
has an account attaches a second workshop — so people on two teams were
possible, supported and unsteerable, with `memberships[0]` deciding where they
landed. The organisation now lives on the session row, written in one place and
verified against the person's own memberships, and a page load is never treated
as a decision.

Building it found two faults that were already there. Taking somebody off one
workshop's team revoked every session they had anywhere, which with two
memberships is one business signing a person out of another. And accepting an
invitation for an address that already had an account required no password at
all, while issuing a session immediately afterwards — so whoever opened the link
was signed in as that person. Neither could have been caught by a test written
before this phase, because with one membership each both look exactly like
working code.

Phase 64 was meant to be five minutes of groundwork for the next one. Reading
the follow-up table showed it carries no organisation, which raised an ordinary
question about how the tenant filter treats such a table — and the answer was
that the filter worked from a list of twenty-six model names somebody had typed,
against a schema with eighty-three models carrying one. Fifty-seven models were
passing through unfiltered, in the mechanism the whole product's isolation rests
on, and one of them was reaching a screen: the owner's own report was rendering
every technician at every workshop on Carnet, by name, with their cost rate.

The tenancy probe could not have found it. It asks for another workshop's record
by id and expects not found, which is the right question about a record somebody
names and the wrong shape for a list that quietly includes rows nobody asked for.
The list is now generated from the schema, every model is scoped or globally
declared with a reason or named as a child of something scoped, and a model added
without that decision fails the build rather than defaulting to unfiltered.

Phase 65 closes the other half of a fault Phase 63 began. `infra/scripts` was in
no tsconfig — ninety verification scripts, the things that decide whether a
phase is finished, type-checked by nothing — and neither was the seed. The
compiler's first complaint was a real defect several phases old: a function
whose range argument was made required precisely so that nobody would read every
journal line by accident, called with one argument by twenty-three probes, all
of which were therefore doing exactly that. Rather than fix the same shape a
fourth time, a check now asks whether every TypeScript file in the repository is
inside some tsconfig at all, and fails by name when one is not.

Phase 66 closes FR-617 and with it the last row the traceability matrix admitted
nothing implements. A workshop can now write down what it said it would do after
the car has gone — ring them about the work they turned down, chase the part,
check the noise did not come back — and what is late or due today appears where
the day starts rather than only on a job nobody opens again. A follow-up nobody
does is worse than no follow-up: the workshop believes it is handled and the
customer knows it is not.

Two earlier phases did their work here without being asked. Phase 62's erasure
register meant a new place to store somebody's name had to be accounted for on
the day it was built — a note saying "ring Maria about the discs" is her name
and an instruction to telephone her at once, so it is removed on erasure rather
than anonymised. And Phase 65's type gate caught two mistakes in the new
verification script before it was ever run, in code that until a week ago
nothing type-checked at all.

Phase 67 closes FR-512, and the whole phase is one line of SQL. A workshop can
say which cars it lends and promise one to a customer for a period; promising
the same car to somebody else over the same days is refused by an exclusion
constraint rather than by code remembering to look, because two people booking
at the same moment both read before either writes. The scheduling module treats
a clashing bay as advisory on purpose — a bay can be squeezed — and that
reasoning does not carry to a car, which cannot be conjured. Lending one whose
MOT or insurance is known to expire mid-loan is refused too, naming which and
when; a car whose papers nobody uploaded is not called illegal, because nothing
is known.

It also turned up something larger. The check that every sentence has a French
and Arabic answer passed for this feature before a single translation existed:
the dictionary is one flat map shared by every page, so a courtesy car described
as "Out" found the ledger's "out of balance" and one described as "Back" found
the navigation's "previous". Two hundred and seventy-one keys are translated two
different ways in two different areas, and whichever file merges last wins.

Phase 68 answers the fault Phase 67 stumbled into. The dictionary is one flat
map from an English sentence to its French and Arabic, shared by every page, and
two areas defining the same key meant the merge silently kept whichever file
came last. Two hundred and seventy-two keys were answered two different ways.

They are three problems wearing one shape. Sixteen are the same word agreeing
with two different nouns, which French requires and a flat dictionary cannot
express. Most of the rest are two renderings of one meaning — untidy rather than
wrong. Seven were two meanings: "Left" was "departed" on one page and
"remaining" on another, and one of those pages was simply wrong. Those seven
were fixed by changing the English rather than the French, because a word that
needs two translations was ambiguous to the English reader too — a gift card has
a balance Remaining, a payment has a method, a person Joined.

The other two hundred and fifty-nine are frozen rather than fixed: a new one
fails the build, and the count can only fall. Working the list down is editorial
judgement in two languages and does not belong in an afternoon.

Phase 69 closes FR-303's second half and puts it somewhere the requirement did
not ask for. A company running forty vans paints a number on each door, and the
driver who rings says "van 17 is making a noise" — he has never looked at the
registration. So the feature is the searching, not the column: a number that can
be typed in and not looked up is a column somebody filled in once, and this
repository has already found three of those.

The requirement says a _vehicle record_ must capture the fleet number, and it is
not on the vehicle record. A vehicle is global — one row shared by every workshop
and every owner it will ever have — and "Van 17" is Northgate Leasing's name for
a Transit rather than a fact about it. On the vehicle it would follow the van
when Northgate sold it and show to every workshop that ever touched it. The
passport made the identical mistake with owners' names until Phase 62; the fact
belongs where the relationship is.

Phase 70 is about the checks rather than the product. Three times in one week a
red probe cost an investigation before somebody noticed the database was simply
dirty: `verify-inventory` asserts the seed's exact opening stock and then books
more in, so the second run on one database measures the first and reports seven
failures that each read like a product defect. A check that fails for the wrong
reason is worse than no check, because it is believed.

Those are mended, and `npm run checks` now runs the probes in the order CI runs
them — reseeding where CI reseeds, reading both out of the workflow rather than
a list somebody maintains beside it. Its first run found three things nobody
could have seen before: the seed writes three expenses and no counter for them,
so the first expense anybody recorded in a seeded workshop failed on a unique
constraint; twenty-three audited actions belonged to no capability and so
counted as nothing on the report that tells an operator what a pilot workshop
actually used; and the new tool itself reported twenty-nine failures that were
one failure, because the application was not running.

Phase 71 is the first instalment of the dictionary clean-up Phase 68 froze: 259
clashes become 231. Sixteen were two renderings of one meaning and were unified
on whichever part of the product owns the term. Two were two meanings wearing
one word — "Entries" is écritures on the ledger and entrées on a passport — and
those were mended in English rather than by choosing a translation, because a
word needing two translations is ambiguous to the English reader as well. The
largest group left is French agreement, where one word must take two endings
because it describes two different nouns; a flat dictionary cannot express that,
and choosing between them would make one page wrong.

Phase 72 is one defect, in the one mechanism the whole product rests on. CI had
been red since 15 September — forty-odd runs — failing on the single sentence
that matters: a passport no longer verifies. It was right, and it had been right
for a week, and nobody had looked.

A passport entry's hash covers the id of the workshop that recorded it, because
"who did this work" is half of what the entry claims. The foreign key said
`ON DELETE SET NULL`, and the append-only trigger — which lists every column of
an event that may not change — did not list that one. The one column the hash
covers was the one column nothing defended. Deleting a workshop rewrote every
entry it had ever written to a value the stored hashes were not computed over,
so every car it had ever touched lost its history, permanently and silently.

Both halves are closed: the key restricts deletion, so a workshop that has
written to a passport is retired rather than deleted — which is what the
product has always said happens — and the column joins the list the trigger
refuses to let anything change. `recordedByUserId` deliberately stays nullable
and deliberately stays out of the hash, because a person leaving the trade must
not break the history of every car they ever worked on.

The lesson is not the foreign key. It is that this repository has an invariant
stated in three places — a comment, an ADR, and a hash function — and in none of
them was it something the database could enforce. `npm run verify:survival`
asks the database rather than the code; before the fix it fails five checks.

Phase 73 started as five failing route checks and became one thing the product
had been getting wrong on every public link it has. `loading.tsx` draws a
Suspense boundary over the routes beneath it, and a boundary flushes: the status
line goes out as soon as the page suspends, which an async page does on its
first await. By the time it calls `notFound()` the 200 has gone. Next still
swaps the body for the not-found page — which is why nobody noticed, every
screen looked right — but the only thing a machine reads was already wrong.

A revoked passport share link answered 200. So did a used handover link, a
review link already answered, a quote that was not yours and a car that was not
yours. The one carefully-written page in the product for somebody standing in a
driveway with a dead link rendered under a status that said the record was
there.

There is no way to hold the status open once the shell has gone, so the fix is
structural: a page that has to be able to say "there is nothing here" asks its
cheap question first, outside any boundary, and draws its own fallback around
the slow half. The reader sees the same loading screen. Inside the signed-in
shell the boundary stays, because there the audience for the status is a person
who is looking at the page — ADR-0015 says so, names the three sheltered
segments, and `verify-status.ts` reads that list out of the ADR rather than
holding its own copy. The check reads the route tree, needs no database and no
running application, and immediately found two routes this phase had not gone
looking for.

The four stale sentences were the same lesson in a smaller key. The check asked
the front door for "Start a 30-day trial"; the trial has been fourteen days for
a long time, and the page said so in a typed-out English sentence, twice, next
to the constant that already held the number. Three copies of one fact, and the
two that were not the constant had drifted apart. The page renders the constant
now, and so does the check.

Phase 74 is one line in the workflow. With the passport fixed and the routes
answering properly, CI got further than it had in six weeks and stopped on a
browser that was never installed. Three checks launch Chromium; the only
install line in the file named webkit and firefox, which replaces the default
set rather than adding to it, and ran three steps after the checks that needed
Chromium. The comment beside it said Chromium is what Playwright installs by
default — true of `playwright install` with no arguments and of nothing else.
So the screens check had been failing on a missing executable rather than on a
screen. `verify-throughout` now reads every check's Playwright import and asks
the workflow whether each engine it names was installed before that check runs.

Phase 75 is one class on one primitive. With the browsers installed, CI reached
the responsiveness check and reported the sign-up form seven pixels wider than a
320-pixel screen — while the same check passed locally, on the same commit,
against the same build. Seven pixels is the width of a font difference between
Chromium on Linux and Chromium on Windows.

The seven pixels were the margin, not the defect. Every button in the product
carried `whitespace-nowrap`, and the sign-up form's primary action — "Create the
workshop and add a card" — cannot fit 280 pixels. A grid track is sized by the
widest thing in it, so that one label set the width of every field above it: the
workshop name, the email, the password, each pushed past the edge by a button
four rows below. Measured: the button's min-content was 292.9 pixels inside a
280-pixel form, and every field was exactly 292.9 wide.

A label that cannot fit has to do something, and making the page scroll sideways
is the worst of the options. Buttons wrap now, which happens only when there is
no room — the moment wrapping is the right answer. And the thing worth keeping:
the check that found this had been green locally all along. The gate is the
platform CI runs on.

Phase 76 is one environment variable the workflow never set. With the browsers
installed and their libraries with them, CI reached `verify-payments` and failed
on a page assertion: the stub checkout page did not show a finished attempt. The
attempt was not finished, because what finishes it is a signed webhook, and the
signed webhook had been skipped.

`PAYMENT_WEBHOOK_SECRET` was not set in CI. Both the payments and the billing
check branch on it, and without it each printed one grey line — `skip
PAYMENT_WEBHOOK_SECRET is not set` — and carried on green. So from the day those
sections were written, nothing anywhere had checked that a correctly signed
webhook is applied, or that a replay of it changes nothing. That is money
arriving from the provider, covered by a check that was covering nothing.

The workflow sets it now, and neither probe treats it as optional. A check that
tried to enforce the general rule — no probe may skip for want of a setting the
workflow does not give it — was written and then removed: it passed only because
both such skips had just become failures, and a check that cannot fail is the
thing this repository keeps finding in other people's work. What is left is five
probes that still skip for want of seed data rather than configuration, and
that is the next phase.

Phase 77 did those five. Four are dormant — they guard against a seed that does
not hold what the section needs, and on this seed they never fire — and they now
fail and name the remedy instead of going quiet. The fifth fired every single
time: `verify-books` had never checked the demonstration workshop, which its own
docblock names as the best evidence the product has, because a year of work there
went through the product's own functions rather than through the seed. The only
thing that builds one removes it again and runs seventy steps later, so the
section printed "skipping that one" and passed, every run since Phase 47. It
builds one now: 241 checks, everything agrees, and then it is taken away again —
which gives the Phase 72 teardown its second exercise anywhere.

The guard removed in Phase 76 is back, because the reason for removing it no
longer holds: it can fail now, and both directions are demonstrated. It reads
code rather than the whole file, because the first version tripped on its own
comment quoting the phrases it was meant to let through, and a guard that prose
can trip is one somebody works around by rewording.

Phase 78 is one check that measured shared state it did not create. The suite
failed on `verify-returns` having passed the run before, on unchanged code —
the worst kind of red, because it teaches everybody to run it again. Parts go
back to a supplier at weighted average cost, and a shelf's average is whatever
every delivery before it has made it. On a seeded database two parts hold
£18.10 and the credit fits inside a £60 bill; after `verify-controls` has
pressed its way around the product the same shelf averages nearly £39, the
credit is £93.38, and the bill can only take £60. The product was right both
times — it applies what the bill owes and holds the rest — and the check was
asserting one arithmetic instance instead of the rule. It asserts the rule now,
and gives the same answer on a clean database and a dirty one.

Phase 79 is the defect found while reading the code around it. Two figures live
either side of a supplier return. What the shelf lost is the weighted average —
five bought last month at £8.10 and five today at £10 are ten parts worth £9.05
each, and nobody can say which two are in the box. What the supplier owes is
what the supplier charged: £10 each. The returns screen proposed the first as
the answer to the second, so on a shelf restocked dearer it offered £77.82 for
two parts that cost £20 — and for a core charge, known exactly and agreed in
advance, it offered nothing at all. Wrong in both directions at once.

Nothing was ever posted wrong, because the operator types what the supplier's
credit note says. A proposal that is systematically wrong is still worse than no
proposal, because it invites agreement. `creditDue()` is the rule now, in core
with a test, and the returns check reads what the screen puts in the box.

Phase 80 is the first of the four gaps the user named on 26 September: the
sidebar, which the feature map had called Partial since Phase 45. It was one
list of fifty-two entries in seven groups named after the parts of the system
they came from, filtered by permission — and filtering a list is not organising
one. It is written per role now, in the order that role works in: thirteen
sections for an owner, eight for an advisor from Today to Payments, six for a
bookkeeper, none for a technician because every workshop page sends them to
their own shell.

The judgement is a judgement; the two rules under it are checked. Every page in
the workshop is in the owner's navigation or recorded with the way it is reached
instead, which found `/patterns` — somebody's contracted hours, the page every
capacity figure stands on — built, measured, and reachable from nowhere. And no
role is shown an entry their permissions would refuse, which found ten,
including four of the six in the technician's first draft. The sixty words of it
are asked of the dictionary directly, because a section heading is data and no
scanner in the product can see one: "Calendar" went in with no French and no
Arabic and nothing else would have said so.

Phase 81 closes the second gap and the map's one **Deferred**. ADR-0013 refused
to build fault suggestion and was right to: a service adviser that proposes
where to look needs a corpus of symptoms against confirmed causes, and a
confident wrong suggestion on a braking fault is not a small error. What that
never said is what to do about it, and the line sat on the map for thirty-six
phases.

The missing corpus is something every workshop produces daily and throws away. A
car arrives with a complaint; a technician considers three or four things it
might be, rules each in or out, and fixes it. The complaint, the candidates and
the verdicts are the corpus — and Carnet was recording the fix and discarding
the reasoning. Now it records the reasoning and reports it back as a count, and
the strongest sentence it will say is "in this workshop, 35 jobs that began with
this complaint reached a verdict; these are what they turned out to be."

Five rules keep it from becoming what ADR-0013 refused, and each is checked:
silence under three confirmations; a cause never confirmed is never listed; no
confirmation shown without its refusals; a job is not evidence for itself; and
the candidate list is never ordered by the evidence, because a list sorted by
what usually happens tells somebody what to find.

Phase 83 takes the last two gaps: the frozen dictionary clashes. Phase 68 froze
259 and named three kinds of them; Phase 71 fixed the easiest 28; the feature
map then described the rest as "mostly French agreement", which was both the
reason nothing moved and wrong about the numbers. Of the 231, twenty-seven were
agreement, ten were two spellings of one word, and a hundred and eighty-four
were two meanings wearing one English word.

The agreement kind could not be fixed by any amount of effort, because the
dictionary is one flat map from an English sentence to one French string. _Une
carte_ is Active; _un forfait_ is Actif. Both pages wrote the right word in
their own area file, the merge kept whichever loaded last, and one page was
always wrong — the data structure could not hold the answer. So a key can now
carry a qualifier that English never shows: `t('Active#card')` reads "Active"
and « Active », `t('Active')` reads "Active" and « Actif ». It names the noun
rather than the gender, because the noun is what a translator needs.

And the check stopped reporting its remainder as one number. "221 known clashes"
is not a job anybody can pick up; it now sorts them into the three kinds and
prints how many need a qualifier, how many need one spelling chosen, and how
many need the English mended — derived from the answers, not from a list
somebody keeps.

Phase 84 is item 2 of the plan: the job command centre. The product has had
fourteen job statuses since Phase 1 and they are the right fourteen, but a
status is a noun and what a service manager needs is a position — whose move it
is, how long it has been theirs, the evidence, and the one thing that moves it.
`/now` shows every open job that way, grouped by ours, waiting on somebody else,
and nothing outstanding, with anything past its promised time above all of it.

None of it is stored. A column saying "waiting for parts" would be a second
thing to keep true, and would stop being true the first time somebody booked a
part in without opening the job. The check puts a part on order, watches the job
become the supplier's, marks it fitted, and watches it become ours again with no
edit to the job at all.

What it found: the worst job in the seeded data reads "Waiting for approval, but
the estimate has not been sent" — a job sitting in awaiting-approval that nobody
ever sent, which on any ordinary board reads as the customer being slow and is
in fact the workshop's own omission. That is the whole argument for the feature,
and it was in the demonstration data the entire time.

Phase 85 is item 3, quality control, and it turned out to be a fix before it was
a feature. `assertTransition` has refused to complete a job since Phase 1 when
its job type asks for a quality check and none has passed — FR-612, a good rule,
with a correct and complete message. Nothing in the product has ever written a
quality check. The job page renders them; no code path creates one. And the
default job types a new workshop is given all ask for one.

So a workshop that signed up, booked in a service and finished the work could
not finish the job: told exactly what it needed, and given no way to comply. A
gate with no key, for eighty-four phases, behind a rule that reads as careful.

The key is a sheet the workshop writes — ticks where a tick is the truth, and
figures where it is not, because a road test result and a final mileage are not
ticks and a sheet that made them ticks would be a sheet somebody ticked. The
outcome is computed from the answers and never supplied: nothing sends "pass",
so a required line left blank cannot be passed by anybody, by any route. A
required line answered _no_ and one _not answered_ are recorded as different
failures, because they need different things done about them. And a fail goes
back to the bench rather than into a checking queue nobody owns.

Phase 86 is item 4, comeback management, and it starts from a number that has
been right and useless since Phase 26. A comeback rate is what an owner quotes.
Twelve comebacks tells nobody what to do; four of them being the same part tells
them everything — and the product could not tell the difference, because it
recorded that a car came back and never why.

Marking a comeback was a link and a sentence. Answering the question the link
raises meant opening the original job, its diagnosis, its parts, its inspection
and its sign-off in four places and holding them together in your head, which is
why it was mostly not done. Now it is one screen in the order somebody asks it —
what they came in with, what we decided, what we fitted, who did it, what the
inspection found, whether it was signed off, and what they have come back with.
Not one line of it is re-entered: it is all read off the original job, which is
what makes it worth reading. A case file that could disagree with the job it
describes is a second record of the same repair, and the first anybody hears of
the disagreement is an argument with a customer.

The cause is the one judgement on the screen, from seven: the diagnosis was
wrong, the part was faulty, it was not fitted right, the inspection missed it,
nothing to do with the work, a different fault, not established. The first four
are the workshop's own and the last three are not, and that line is the whole
point — a rate that blames a workshop for a customer driving through a flood is
a rate nobody in the workshop believes, and a number nobody believes changes
nothing. Comebacks nobody has looked at yet are shown beside both, because an
unexamined comeback is not a clean one.

And a pattern is cars, not visits. One car back four times is one unhappy
customer and a job that was not finished. Three different cars back after the
same repair is a procedure fault, and it is the only thing here worth
interrupting an owner's day for.

Phase 87 is item 5, parts intelligence, and it begins from an absence: until
this phase **a `Product` and a `Supplier` were not joined by anything at all.**
A part carried one cost price — whatever it happened to cost the last time
somebody bought one — and knowing where to get it lived in one person's head.
That person goes on holiday, and the workshop quotes a customer a figure from
two years ago.

Both halves of the item have an obvious implementation that is wrong.
Comparison is obviously a list sorted cheapest first, which is what every parts
catalogue ships and what orders a disc four pounds cheaper that arrives the day
after the car was promised. So arrival is ranked before price — and the
recommendation carries the argument against it: the supplier passed over, the
saving to the penny, and what was wrong with it. A screen that picks the dearer
supplier and hides why gets overruled the first time somebody notices, and is
never trusted again.

Prices are dated, and anything older than a quarter is marked rather than
hidden, so most of a workshop's list reads as old most of the time. That is the
point. And Phase 52's measurement of how often each supplier actually delivers
by the day they promised is finally shown beside the day they promise: a
next-day quote from somebody who keeps it two thirds of the time is now shown
as exactly that.

The second half is confidence, and the obvious implementation is a percentage.
It is easy to compute, it looks authoritative, and it is invented — which is
how the wrong pads reach a car whose owner is braking. So there is no score:
six things can be true about a candidate part, every one a record this database
already holds, each stated as a sentence a person can check.

The first version of that rule was wrong, and one look at the built page said
so. It offered a brake _disc_ as an alternative to brake _pads_ — both braking
parts, both fitting the car, both with fitment rows — because the rule could
not tell "suits this vehicle" from "does the same job". So the six divide in
two. Two of them say _these parts are the same thing_: we have made this exact
swap and confirmed it, or a supplier lists both under one number. Only those
put a part on the screen. The other four say only that a part suits a car, and
are shown beside a candidate that already qualifies. The strongest is the
confirmed swap, which is how the list grows — one confirmation teaches the
product something permanent about two parts, exactly as Phase 81's diagnosis
corpus is built out of verdicts technicians were making anyway.

Writing it found a second defect: "same part number, different brand" could
never have fired at all, because a workshop's catalogue is unique on part
number. Read as a _supplier's_ number it turns into one of the better signals
there is.

Nothing substitutes itself. The evidence is recomputed from the records when
the confirmation is made, never taken from the form, and the line then carries
the part, what it replaced, the evidence and the person together, because the
database will not accept them apart.

Phase 88 is item 6, VIN to a specification sheet: the fourteen numbers a
technician needs before touching a car, every one of them in a handbook
somebody is not holding. The obvious implementation buys a universal
specification database, and three things rule it out — there is no good cheap
one, the good ones meter a screen a workshop opens forty times a day, and a
wrong oil grade is an engine. A database right about ninety-eight per cent of
models is confidently wrong about the other two, and a workshop cannot tell
which is which by looking.

So the sheet is the workshop's own and it is written once per model, keyed by
make, model, a year range and an engine code — which is exactly what Phase 43's
VIN decoder produces when a car is added. Write it once for a model you see
weekly and every car that decodes to it arrives holding it. That inheritance is
what "VIN to a specification sheet" turns out to mean once you refuse to invent
anything. A car can carry its own sheet on top, for the retrofitted engine or
the owner who wants a heavier oil after a track day.

The rule the phase is named for: a line nobody has answered is absent. Not
defaulted, not inferred from a similar model, not a dash that could be read as
"none" — because a blank sends somebody to look it up and a wrong number does
not. How full the sheet is shows as a count, four of fourteen, never a
percentage with a colour that reads as a score a workshop is failing.

And where two sources disagree, both are shown. The seeded X5 says 5W-40
against its model sheet's 0W-30. That is the most useful line the screen can
carry: one of them is wrong about an engine, and somebody should find out which
before the drain plug comes out.

Two blocks sit beside the sheet, both read off records held for years — the
parts a fitment row says belong on the car, and what has actually gone into it
on past jobs — and neither is merged into it. Reading "0W-20" out of a product
called "Engine oil 0W-20, 5L" means a parser against a name a person typed, and
a parser that is wrong once has put the wrong oil in an engine.

Phase 89 is item 7, equipment and tools. Until it, the product knew nothing
about any of them: `Bay.capability` was a free-text hint typed once and read by
nobody, and job-type skills covered only the people.

Available turns out not to be one flag. A workshop asks three questions and a
single `isAvailable` column answers none of them — is it here, is it working,
and _is it allowed to be used_. The third is the one nobody models and the one
that stops the job: a torque wrench out of calibration and a lift whose
statutory inspection has lapsed are present and apparently fine, and using
either is a failed audit, a void insurance claim, or a wheel coming off. So
there are five states, derived and never stored, each answering the first
question that is true about the machine.

The point of the phase is that **nobody has to notice**. The expiry is compared
against the clock, so a machine goes out of service on the right morning even
though everybody who could have flagged it was away. The check proves it on one
record: usable the day before, unusable the day after, nothing edited between.

Late for a service warns; a lapsed certificate blocks. Those are different in
kind and flattening them either grounds a workshop over a missed service or
keeps it working on an uninspected lift, and the second is how somebody gets
hurt. Busy is not blocked either — a workshop puts a car on the ramp knowing
the rig is free in an hour, and a product that refused would be wrong about how
a workshop runs.

The gate was written with Phase 85 in mind: FR-612 gated completion on a
quality check for eighty-four phases while nothing could record one. So this
gate is reached only by a job whose work names a machine, which is no job at
all until a workshop says otherwise, and a car already in pieces on a lift is
never stranded by that lift going out.

Two faults surfaced in the writing. The constraint meant to forbid a machine
out of service with no reason allowed exactly that, because
`length(btrim(NULL)) >= 3` is NULL rather than false and a check constraint
passes on NULL. And one section of the check found nothing to test and quietly
did nothing while the script reported a pass — a check that skips itself is a
check nobody runs, so it now fails loudly.

Phase 90 is item 8, inspection template versioning. Inspection results have
snapshotted their section and item names since Phase 1, so a completed
inspection already kept the words it was written with — but that only preserves
what was asked and answered, and says nothing about what the sheet asked that
day, therefore nothing about what it did not ask.

A workshop adds "brake fluid condition" to its checklist in June. A customer
opens an inspection from March. There is no brake fluid line on it, and every
reading of that silence is wrong in a different way: an omission, a pass,
somebody forgetting. The truth — it was not on the sheet in March — was the one
thing the record could not say. That is the same failure this product refuses
everywhere else: fitment has three states so silence is never approval, a
specification leaves a blank rather than guessing, a substitute is absent
rather than weakly suggested.

A version is cut by what the sheet is, not by somebody pressing Publish. The
ordered questions reduce to one fingerprint; an inspection starting looks for
the version with that fingerprint and cuts one only if none matches. So a
workshop that edits its sheet three times before anybody uses it produces one
version, and a workshop that removes an item and puts it back lands on the
earlier version again — because the sheet is once more the sheet it was. The
fingerprint covers the questions and not the ids, so retyping an item
identically is not a change, and not the order, because reordering changes the
route a technician walks the car in rather than a question asked.

What is not known is said plainly. Inspections from before this phase carry no
version and the report says "not recorded" rather than borrowing today's sheet,
and a version an inspection cites cannot be deleted — a report naming a sheet
nobody can produce is worse than one that admits it does not know.

Writing the fingerprint turned up two faults in it. "Brake" + "s" and "Brakes"

- "" are different sheets that produced the same fingerprint, because the
  fields were concatenated with nothing between them. And the separators that
  fixed it went in as raw control bytes inside the string literals — which works,
  and is invisible in every editor, leaving the one load-bearing detail of the
  file unreadable. They are named escapes now.

Phase 91 is item 9, the equipment module tied into scheduling, and it is mostly
a dividend from Phase 89. That phase refused to store whether a machine may be
used and worked it out from its certificate against the clock every time. So
asking "will the rig be usable next Tuesday?" is the same function with a
different date — a stored flag could only ever have answered _now_, and a diary
needs to answer _then_. A booking taken today for the twentieth is told today
that the certificate lapses on the eighteenth, while moving it is still a phone
call rather than an apology.

Two kinds of clash, kept apart. A machine that will not be usable on the day is
a promise the workshop cannot keep at all. A machine already promised to
another car at the same hour is a different problem: one alignment rig cannot
do two cars at once. Quantity is deliberately not modelled — a workshop with
two rigs records two machines, because that is what it has.

Nothing here moves a booking. The product names the clash and the workshop
decides, as the supplier recommendation carries the argument against itself. A
diary that quietly shuffled a customer's appointment to suit a rig would be one
nobody could explain to the customer on the telephone.

And no new column. A booking's kind of work is already recorded by its job or
its package; putting a `jobTypeId` on `Booking` would have been a third place
for the same fact to be wrong. A booking with neither says nothing about
machines and is never reported, because a clash nobody can act on is one people
learn to scroll past.

Three things it turned up. The plan page's horizon was a fortnight while the
equipment screen warns at thirty days, so a certificate expiring in eighteen
warned on one screen and not the other — the page disagreeing with its own
argument that booking an engineer takes a fortnight. A second `overlaps` had
been written when the capacity rules have answered that since Phase 12. And the
seed had no service package at all, so the feature Phase 37 built had never
been demonstrable.

Phase 92 is item 10, barcode and QR everywhere. The obvious reading is: put a
QR on each document, and some of that existed already — an invoice, an estimate
and a vehicle report have carried one since Phase 42. What did not exist was
the half that makes them worth having: somewhere for a scan to go.

The failure worth designing against is not a scan that fails. It is a scan that
succeeds at the wrong record. `10482` is a plausible job number, a plausible
part number and a plausible bin, and a resolver that tries each in turn and
takes the first hit will one day book a part out against a car that is not on
the ramp — silently, because from the outside a right answer and a wrong one
look identical.

So everything Carnet prints for itself carries a namespaced code, which is
unambiguous by construction; anything else is looked up against every kind it
could be, and two survivors is a question rather than a guess. The lookups run
together rather than in turn, which is not only faster: a loop that stopped at
the first hit is precisely the thing that would open the wrong record.

A customer's QR is a URL and a workshop's is a code. An invoice keeps its link,
because a customer points a phone at it; a key tag carries a code, so what is
in somebody's pocket means nothing to whoever finds it in a car park. The
passport is not in the scheme at all — a share stores only the hash of its
token, so the product could not look one up even if it wanted to, and being
unable to enumerate them is half of what makes a shared link safe to hand out.

Four faults found by running the check and looking at the page. A registration
is `BV19 FLM` and a machine code is `ALIGN-1`, and the first draft's shapes
allowed neither a space nor a hyphen — so the two things a workshop would most
obviously point a scanner at resolved to nothing. The scoping check leant on a
job belonging to a workshop that has none, so it reported its own untestedness
rather than testing anything. `redirect()` from the page render could not move
anybody, because the route sits under a loading boundary and the shell has
streamed by the time the answer is known — the same constraint Phase 73 found
with `notFound()`. And a message with one long word pushed the job page 172
pixels wider than a phone.

Phase 93 is item 11, barcode receiving. `validateReceipt` has refused a bad
receipt since Phase 2, and that is the right place for the last word — but the
wrong place for the first. By the time a form is submitted the pallet is
unloaded, the boxes are on the floor, and "3 received but only 2 outstanding"
is a puzzle about something that happened twenty minutes ago.

The scan identifies; it never counts. A tempting design adds one per scan, and
it is how a workshop receives eleven of ten: the scanner double-fires, nobody
is watching, and the count is wrong in a way discovered months later when the
stocktake disagrees. So a scan selects a line and a person types the number on
the box — one more keystroke, and the one that makes the figure somebody's
rather than the scanner's.

What is not on the order is said loudly. A box that scans to a part nobody
ordered means the supplier sent something unasked, or this is the wrong order
for this pallet, or the box belongs to another delivery — all three worth
stopping for, and a system that shrugged would have the receiver shrug too.

Three smaller decisions with the same shape as the rest of the product. A line
already fully received says "you have had all ten of those" rather than being
skipped silently. Two open lines for one part is a question, because choosing
would book the goods against whichever was created first. And the bin defaults
to where the part already lives, because a delivery that made somebody retype
the shelf every time is one where a part ends up on two shelves.

The counting lands in the database as it happens, one line at a time. A pallet
takes twenty minutes, a browser tab does not reliably survive twenty minutes of
a workshop, and the only thing worse than counting a pallet is counting it
twice.

Phase 94 is not a roadmap item. Six faults were reported from the running
product in one sitting, five of them on the pages a prospective customer sees
first, and every one was invisible to the checks. The suite proves a page
answers 200, that its lists are bounded, that its words are translated and
that it fits a phone. None of that notices a button that is not a button —
and "Where everything stands" carried one on every row, a brand-coloured span
that looked exactly like a control. Underneath it, `JobStanding.next.href` had
been in the type since Phase 84 with nothing setting it and nothing reading
it. The lesson recorded is the one that is not writable as a check: somebody
has to open the product.

Phase 95 is item 36, the "do not miss" list. Nothing on it is new and nothing
is stored: `/now` already says whose move every job is, the plan already names
a booking that cannot be kept, the equipment screen already names a lapsing
certificate. All of it true, and none of it a morning — because reading eight
screens is not a morning, and the one thing a workshop does not have at eight
o'clock is time to go looking. The phase adds one question asked at the right
time, of data eight other screens already own.

Every row is one action, as a verb, with a page where it is done. "Three
invoices are overdue" is not an item: it is a number, and a number leaves the
reader to work out what to do, which they do tomorrow instead. A row that
cannot name an action is dropped rather than shown badly, because one row that
says something is wrong and gives nobody anything to press is how a list stops
being read. The order is an argument: somebody could be hurt, then a promise
to a customer, then money, then an incomplete history — and within a cost,
the thing that has been true longest, because the promise sitting since
Tuesday is the one somebody has already walked past.

And it must be possible to reach the end, so it is capped at twelve and what
is behind the cap is counted out loud. A workshop with sixty things to not
miss has a problem this screen cannot solve, and showing eight would be the
screen lying to look calm.

The checks found the function that argues against untranslatable sentences
building one by hand: `${total} things to deal with.`, which no dictionary can
hold a key for, wrapped in `t()` where it looked right and could not work.
`i18n-scan` reads the pages and this literal lived in a library, so
`verify-morning` now reads the library's own keys out of its source — which
immediately turned up two actions with no French or Arabic at all. The rule behind
all three is recorded as ADR-0019: a library produces a key and its values,
never a sentence; no slot holds prose; nothing below the screen formats a date.

Running the neighbouring checks turned up two addresses nobody had decided
about. `verify-tenancy` refuses to pass until every address with an identifier
in it is declared, and `/equipment/[id]` and `/receiving/[id]` had been built
in Phases 89 and 93 without being added. Both scope their queries; what was
missing was the proof.

Phase 96 is item 37, the end-of-day close. Every one of its ten readings is a
question the product could already answer — the till was never counted,
somebody is still clocked on, two sets of keys are in a pocket, four cars are
on the forecourt. Nothing in the phase is a new fact about a workshop. What the
product could not say is whether anybody looked, and what they saw.

That is a fact about an act rather than a state, and it is the one place the
product stores a figure it could derive. ADR-0020 is the argument: an invoice
paid at twenty to seven must not change what was true at four minutes past, and
a close that recomputed itself would say something different every time it was
read while still looking exactly like evidence. So the figures are copied in,
and then two triggers refuse UPDATE and DELETE — the free-text note included,
because a close written in haste with the wrong note is a close with the wrong
note, and the honest remedy is that tonight's close says so.

The close changes nothing it reads and never refuses. A workshop at six with
three cars on the forecourt locks up anyway; a screen that blocked would be
worked around by not opening it. The only refusal is a second close for one day,
because two closes make the record ambiguous in the worst way.

This is also the phase where CI came back after ten days of billing failures,
and the first run that executed found four things shipped blind: eight models
never declared to the tenant filter, four of them carrying a workshop's id; a
critical remote-code-execution advisory against `next/og`, which this product
uses for its app icon; a verify script that did not compile under the stricter
`infra` config, hiding a probe that would have measured nothing on a tidy
morning; and a duplicate key in a Prisma `where` from Phase 88.

Phase 97 is item 38, which the plan gives six words: "Start-of-day, the mirror
of it." The lazy reading would be ten more readings and a second record table,
and it would give the product two morning screens, because `/morning` already
says what to do today. What this screen owns is a different question: what
arrived while nobody was here, and is what we left last night still true?

The second half is askable only because Phase 96 stored its figures rather than
deriving them. A close that recomputed itself could never be compared with
anything; one that wrote down "two sets of keys were not on a hook" can be
asked at eight the next morning whether they are now. It is the strongest
argument ADR-0020 has, and it is why this is item 38 and the close is item 37.

It records nothing. The mirror is in the ritual, not the mechanism: the close
stores because its subject is a moment that passes, and this screen's subject
is now.

The first run against real data found the design's one serious fault. The draft
compared all ten of the close's readings, and reported "clocked on, was 0, is
1" as something that had happened in the dark — which is somebody arriving for
work. At the close that reading means a person is still here who should have
gone home; in the morning it means people have arrived. Same column, opposite
meanings, and a screen that cries wolf every morning is not read by Friday.
Eight readings survive a night; the other two are the clock and the till.

Phase 98 is item 39, the last of the operations layer and the plan's stated
destination: the control tower, "the screen an owner leaves open all day."
The product already had three morning screens — what to do, what arrived,
whose move — and none of them owned the question an owner asks at eleven and
again at three: what is the state of the building right now, and what will
have cost us something by the time the doors shut?

Nothing in it is computed twice. The building is read off the board's own
function, the capacity is the planner's, the rota is opening-up's, the
morning's list is `/morning`'s — and the verify script asserts the building
equals the board car for car rather than assuming it. The risk band is the
handful of things that will have cost something by closing time, in a fixed
order: what is already costing before what merely will. Parts on order for
cars on the ramps are matched to the order they are on, by product, and a part
marked on order that no open order carries is called out as a part that will
be late and does not know it yet.

It refreshes itself every five minutes while it is looked at, says when it
last did, and writes nothing. "Today" is now the workshop's own day, from
midnight in the site's zone, which the earlier dashboard took from the server.
