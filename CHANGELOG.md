# Changelog

Notable changes. Generated from Conventional Commits; format per Keep a
Changelog, versioning per Semantic Versioning.

## [Unreleased]

### Added

**Phase 6 (part) - What the record supports saying.**

The roadmap gates this phase on a year of data across many workshops, which
does not exist. So this is the half that can be earned from the data there is,
and the half that would be guesswork is still absent.

- A vehicle's mileage is read as a whole sequence rather than pairwise. A
  rollback followed by two years of normal driving leaves no adjacent pair
  looking wrong, and that is the case that matters: the demo vehicle has
  exactly this shape, and the passport now names it.
- Every finding says how certain it is. A reading lower than an earlier one is
  arithmetic. A drop in annual mileage before a sale also fits retirement, a
  second car or illness, and is put as a question.
- Nothing is scored. A number out of ten would be quoted in an advert and
  cannot carry the reasoning that produced it.
- Gaps are reported as thin history, never as suspicion. An absence of records
  is not evidence.
- Reorder points account for how much demand swings, not just its average. Two
  parts averaging ten a month need different shelves if one sells ten every
  month and the other sixty once a year.
- Lead time is measured from the workshop's own orders rather than read from a
  field nobody fills in.
- Job duration is a median with its spread, refused below five samples. Work
  booked for longer than it takes is surfaced next to work booked for less:
  the first never shows up in the accounts, it shows up as a diary with holes
  in it nobody can explain.
- Every recommendation carries what it rests on, and the page says how many
  parts it could not assess.

**Phase 5.3 - Somewhere for the work to run.**

The worker had no production home. It was a five-second polling process started
by hand by a script that runs in watch mode. Vercel cannot hold a loop open,
Compose had no worker service, and no schedule was configured anywhere, so
configuring a mail provider would still have sent nothing.

- The jobs moved into `@carnet/jobs`. Two drivers over one implementation: a
  loop for development, a scheduled request in production. Two implementations
  would mean one quietly stopping matching the other, and it would be the one
  nobody runs locally.
- `/api/cron/[job]` runs them on a schedule, dispatch every minute and the
  hourly jobs at seven past. The dispatch job runs the outbox, then automation
  actions, then the sender, in that order, so work created in a pass goes out
  in the same pass.
- Overlapping runs are safe, and were already safe: every job claims what it is
  working on before working on it.
- The routes refuse anything without the scheduler's secret, compared in
  constant time. A signed-in workshop owner is refused exactly like a stranger,
  and a missing secret refuses everything rather than opening the routes.
- A failed run answers 500 so the platform records it. A job that fails
  silently is how a queue stops draining for a week.

**Phase 5.2 - Sending.**

Nothing sent. Since Phase 1 the product had been writing rows to
`message_logs` and nothing had ever read that table. Every confirmation,
reminder, quote link, automation action and campaign it had "sent" was sitting
in it unsent. Two environment variables named a mail and an SMS transport and
no code read either of them. Nothing reported a problem, because from the
writing side everything had worked.

- One transport interface, three implementations: console, SMTP for email, and
  Twilio for texts over plain HTTP rather than the SDK. No domain code imports
  a vendor, and changing provider is an environment variable.
- Console is a real transport rather than a no-op. It writes the message where
  it can be read and reports success, so the queue drains and every state after
  sending can be exercised without a provider account. It is also the default,
  and the worker names its transports in its start-up line, because "console"
  in production is otherwise invisible.
- A permanent failure is not retried. An address with no @ in it will not start
  working on the fourth attempt. SMTP signals this with a 5xx and HTTP with a
  4xx, which are opposite conventions, so the classifier is told the protocol.
- Retries are capped and jittered. Without jitter every message queued during
  an outage retries in the same instant when it ends.
- Texts are held between 20:00 and 08:00. An email overnight waits in an inbox;
  a text lights up a phone on a bedside table.
- Addresses are normalised at the moment of sending, because a customer record
  can be edited between queueing and sending.
- Templates refuse an unknown placeholder when written and a missing value when
  built. "Hi {{firstName}}, your Vauxhall is ready" is the message every
  template system sends once.
- A text's real cost is counted. One curly apostrophe pasted from a word
  processor drops the whole message out of the GSM alphabet and turns one
  segment into three.
- `/messages` separates failed, held and stuck. They look alike and need
  completely different responses: a wrong address, nothing at all, and a worker
  that is not running.
- `verify:messaging` puts a message in and asserts it comes out. It is the
  check that would have caught this.

**Phase 5.1 - The customer's own side.**

The coverage map said this column was built. It was not: three buttons on the
customer's home screen led to pages that did not exist, and the link to review
a quote pointed at a share row's id rather than at a capability token, so it
had never opened anything.

- A quote is answered line by line, not whole. An estimate offered as one
  take-it-or-leave-it figure gets declined whole, and the workshop loses the
  items the customer would have taken.
- Nothing arrives preselected. A form that opens with every box ticked is not
  asking a question, and the approval it produces is worth nothing the first
  time somebody disputes it.
- Anything left unticked is recorded as declined rather than pending. A
  pending line means somebody has to ring to find out.
- A safety item can be declined, with a plain statement of what that means and
  a permanent record that the statement was made. It is the customer's car.
- The same screen works signed in or through the link the workshop texted,
  which needs no account. Most people will meet Carnet there and nowhere else.
- A vehicle's full history from the owner's side, including what each visit
  cost, with share links they create and can take back.
- Every invoice across every workshop that uses Carnet, outstanding first.
- Job progress written in the customer's language. "Quality check" is precise
  to a service manager and meaningless to the person waiting for their car.
- A customer reaching a vehicle that is not theirs meets a page that does not
  exist, rather than one confirming somebody else's does.

**Fixed.**

- The traceability matrix's finance rows were misaligned by one from FR-1202
  down, and traced an FR-1212 that has never existed. The implementations were
  real; they were filed against the wrong requirements.
- A stale note in the same file still described bank reconciliation and expense
  capture as unbuilt remainder of Phase 3. Both shipped in Phase 4.8.
- The smoke test could not express "this page should not exist", so the checks
  that matter most for a customer reaching somebody else's data could not be
  written. It can now.

**Phase 5 - Customer lifecycle and automation.**

The engine that acts without a person in the room, and the CRM it drives.

- Rules are trigger, conditions and actions. A rule cannot trigger a rule,
  because chained automation is impossible to reason about after the third link
  and impossible to debug at all.
- Every rule is rate limited per subject by a database trigger, not only by the
  code that calls it. The failure mode of automation is not doing nothing, it
  is doing something forty times to one person.
- A rule that could never fire is refused when it is written. A condition on
  days overdue attached to job completion is unknowable at that moment, so the
  rule would look healthy and never act.
- Every evaluation is recorded, including the ones that decided not to act,
  with the reason. A rule quietly failing a condition for a fortnight looks
  identical, from a dashboard, to a rule nobody has triggered.
- Segments report the reachable count beside the segment count. A list of 480
  where 90 never agreed and 40 have no address is a send of 350, and the
  difference is normally discovered after somebody decided it was worth doing.
- Consent is per channel and rechecked for every recipient at the moment of
  sending. Transactional messages, about work on the customer's own vehicle,
  are never gated on marketing consent.
- Every change to a marketing permission is written by a database trigger and
  cannot afterwards be edited or deleted. A boolean proves nothing; the one
  occasion it matters is the occasion somebody asks how you got permission.
- Retention is reported by cohort, and a cohort is not shown at a month it has
  not yet reached. An overall retention rate moves with acquisition and says
  nothing about whether the customers you had are staying.
- On arrival, work is suggested from the vehicle's own history, each suggestion
  carrying the reason it appeared. A list of parts with no explanation reads as
  an upsell and gets ignored.
- `verify:automation` proves the database refuses what it should: acting twice
  inside a cooldown, a rule with no actions, an action queue that lies about
  its own state, a suppression with no reason, and any attempt to rewrite
  consent history.

**Fixed.**

- The traceability matrix claimed 149 requirements traced at 97% automated,
  against a matrix holding 130 rows, while the requirements document had grown
  to 213. The summary was arithmetic about a table that had stopped existing.
  It now counts what is there and names the 84 early-phase requirements traced
  by section rather than individually.
- The coverage map still described Phases 4.7 and 4.8 as future work months
  after they shipped.
- A delay of exactly twenty-four hours rendered as "after 1 days" in the
  sentence describing a rule, which is the sort of thing that makes somebody
  distrust every other number on the page.

**Phase 4.9 - Revision.**

No new features. A pass over everything built so far, with the checkable half
turned into scripts so it can be repeated rather than done once.

- `verify:empty` creates a genuinely empty workshop and walks all twenty-five
  pages as its owner. Empty states are the part nobody designs, because the
  demo data always has rows, and the first person to meet them is a real
  workshop on their first morning.
- `verify:access` checks twenty-nine pages for inputs with no label, buttons
  with no accessible name, images with no alternative, decorative graphics not
  hidden from a screen reader, headings that skip a level, and missing
  landmarks, skip links or language. These are the failures that accumulate
  silently, because everything looks fine to whoever is building it.

**Fixed.**

- The group view showed its empty state only at zero sites. A new workshop has
  one, so the first thing anybody saw there was a comparison table with a
  single row and a spread of nothing.
- The pricing page had no h1. Its title came from the shared section heading,
  which renders an h2, so the outline began at level two with nothing above it.
- PageHeader actions wrap instead of overflowing; several pages put six
  controls there, which on a phone is two rows rather than a scrollbar.

Both first attempts at these checks reported every page as broken, because
they were reading the React payload Next.js inlines into the document rather
than the document. A check that fails everywhere is indistinguishable from a
check that is wrong. The table-overflow rule was removed rather than
approximated further, on the grounds that a check nobody can trust is worse
than no check.

**Phase 4.8 - Expenses, banking and the close.**

- `/expenses`: money out that is not a supplier bill. These were hand-written
  journal entries until now, which works exactly as long as the person writing
  them knows double-entry. Everybody else guesses or stops recording them, and
  a profit figure missing its overheads is worse than no profit figure.
- Input tax is posted to its own account so it can be reclaimed. Putting the
  gross into overheads is the commonest mistake in a small set of books and it
  overstates costs by a fifth, every month, invisibly.
- An expense posts on approval, not on entry, because an expense nobody has
  agreed to is not yet a cost. Nobody can approve their own claim, enforced by
  a database trigger as well as in the domain: a control that lives in one code
  path stays a control only until somebody adds a second path.
- An expense somebody paid personally credits a liability rather than the bank,
  because the business owes them until it pays them back.
- `/banking`: reconciliation against a statement. Every suggested match carries
  its reasoning, and only exact ones are offered for one-click acceptance. A
  rule that pairs too eagerly does more damage than one that matches nothing,
  because a wrong match is invisible: both sides tick and the balance agrees.
  One ledger entry can never settle two statement lines.
- Period close, with checks. The blocking ones are where closing would make a
  wrong number permanent: an unbalanced trial balance, completed work still
  unbilled, a till still open. The rest warn, because a workshop that always
  has one stray bank charge should still be able to close its quarter.
- 47 further domain tests and `verify-banking.ts`. 555 tests in total.

The reason this completes Phase 3 rather than extending it: the ledger already
balanced against itself, which proves the arithmetic was consistent. Until the
bank agrees, a set of books is a well-formed opinion.

**Phase 4.7 - Counter sales, reporting and the gaps.**

- `/counter`: a sale with no job behind it. One screen, one submit, because a
  counter queue is not a service desk. Behind that submit the stock leaves the
  shelf, cost is recognised and the ledger is posted, all of which a job would
  normally have anchored.
- Cash and card post to different accounts, since they arrive on different
  days. The till reports its variance rather than absorbing it: a drawer that
  agrees with itself every evening is a formality, not a control.
- Counter sales get their own gapless numbering. Sharing the invoice sequence
  would leave gaps in it, and a gap in an invoice sequence is the first thing
  an auditor asks about.
- `/estimates`: the ones nobody has answered, ordered by how long they have
  waited. An unanswered estimate is a bay that will be empty next week, and it
  is invisible from the job screen because nobody opens a job that is not
  moving.
- `/reports/business`: revenue by service type with cost, so busy-and-
  unprofitable work shows; parts profitability with loss-making lines first;
  retention measured against each customer's own rhythm rather than a fixed
  interval; and source of business by conversion rather than volume.
- CSV export on every report, which FR-1406 has promised since Phase 1. The
  rules that matter are about what spreadsheets do to CSV: a leading zero on a
  part number is deleted, a value starting with = or + or - or @ is executed as
  a formula, and a date is reinterpreted by the reader's locale. The second is
  a real attack on the workshop exporting its own customer list.
- 40 further domain tests and `verify-counter.ts`, which sells a real part and
  then checks the shelf, the accounts and the drawer.

**Phase 4.6 - Administration and the customer's journey.**

- `/settings/team`: invite a colleague, change a role, move somebody between
  sites, remove a leaver. Until now this took a database write, which meant in
  practice a workshop could not add its second user.
- An invitation is a capability. The token is random, only its digest is
  stored, and it works once. One open invitation per address per workshop,
  enforced by a partial unique index: two live invitations each carry their own
  role, so accepting the older one grants access nobody intended.
- Nobody can hand out a role above their own, and nobody can change their own.
  A manager promoting themselves is the exact thing roles exist to prevent, and
  the form for it looks identical to changing anybody else.
- An organisation always keeps one active owner. Locking everybody out of their
  own workshop is recoverable only by a support call and a database write.
- A leaver is deactivated, never deleted, and their sessions end immediately.
  Their work is what last year's job costs are built on.
- `/portal/book`: a customer picks the work, the vehicle and a time. Only times
  the workshop can genuinely do are offered, and the slot is re-checked inside
  the transaction that takes it, because the one that was free when the page
  rendered may have gone to the counter since.
- Customers are told at four stages and no more. Sending every status change
  trains people to ignore all of them, which costs the one message that
  mattered: the car needs a decision.
- `/reminders`: what the reminder worker is about to do. It has been running
  since Phase 1 with no screen, and a machine that sends messages on a schedule
  with nothing showing what it is about to send is indistinguishable from one
  that stopped three weeks ago.
- 38 further domain tests, and `verify-team.ts`, which invites, accepts,
  promotes, demotes and removes against a real database and asserts every
  refusal.

**Phase 4.5 - The front door.**

- A marketing home page written for somebody who runs a workshop and has ten
  minutes: what breaks today, what the passport does about it, what the system
  covers, what it costs, how to start
- Published pricing, priced per bay rather than per user. Charging per seat
  bills a workshop for giving its own staff access, which pushes people into
  sharing a login and makes every record say the wrong person did the work.
  Staff accounts are unlimited on every tier.
- Plan definitions live in `packages/core/src/billing/plans.ts` and are what
  the pricing page renders and what the application enforces. A price list kept
  separately from the limits it describes drifts within a month, and the first
  person to notice is a customer promised something the system refuses to do.
- Sign-up creates an organisation, not an account. The workshop, a location
  with bays, VAT rates, job types, document sequences, a parts store, the owner
  membership and an employee record are created in one transaction. A
  half-created workshop is unrecoverable for the person it happens to: they can
  sign in, see a broken shell, and cannot retry because their email is taken.
- 41 further domain tests, and `verify-signup.ts` which creates a workshop
  against a real database, asserts every piece of it, and removes it again

**Fixed.**

- Sign out has been returning 404 since Phase 1. The route file sat at
  `src/app/apps/web/src/app/api/sign-out/`, created by a mkdir with a full path,
  so it served a URL nothing posted to. Every sign-out form pointed at
  `/api/sign-out`, which did not exist.
- The audit log's immutability trigger made erasure impossible. Both of its
  foreign keys are declared ON DELETE SET NULL, and a SET NULL cascade is an
  UPDATE, which the trigger refused. Since every organisation is audited on
  creation, no organisation and no user could ever be deleted. The trigger now
  permits exactly the update a cascade performs, clearing a reference to a
  deleted party, and still refuses everything else including DELETE. What
  happened is still unrewritable; who it happened to can now be erased.
- The inventory check assumed a single warehouse. Once the demo had two sites
  it was measuring a store it had never written to.

**Phase 3 - Finance and ERP.**

- Chart of accounts, eighteen accounts transcribed from the accounting model
  document so the specification and the code stay identical
- General ledger with double-entry enforced in the database, not merely in
  the application: a line that is both a debit and a credit is refused by a
  check constraint, and an entry whose lines do not balance is refused by a
  deferred constraint trigger at commit
- Automatic posting from operational events: invoice issued, parts consumed,
  payment received, goods received, supplier bill paid, stock adjustment,
  credit note. Revenue splits by kind, tax posts separately, and a deposit is
  a liability until the work is invoiced rather than revenue on receipt.
- Posting is idempotent on the source document. The outbox is at-least-once,
  so a redelivered event must not double-count revenue.
- Stock is debited on goods receipt rather than on the supplier's invoice.
  Those two dates are often weeks apart and the shelf is the truth.
- Fiscal periods, with a closed period refusing new postings
- Trial balance, profit and loss, balance sheet, aged debtors and creditors,
  and a VAT position, all derived from posted lines at request time rather
  than stored, so a statement cannot drift from the entries behind it
- Job profitability from clocked time at each technician's own cost rate and
  parts at weighted average cost, visible to the roles that carry financial
  permission and to nobody else
- 50 further domain tests, and a ledger check that proves both statements
  balance, that every entry balances individually, that the aged debtors
  report ties to the receivable account, and that the database still refuses
  the two violations it is supposed to refuse

**Both themes, and speed.**

- A light/dark/system theme control on every surface, with the choice replayed
  before first paint so there is no flash
- A contrast audit that resolves the design tokens through their var() chains
  and measures thirty-three real pairs in both themes. It found seven failures
  that looked fine on screen, including the primary button's hover state at
  3.37:1 in dark and the warning colour at 4.03:1 in light. All pairs now
  clear WCAG AA.
- Route-level loading states, so a click changes the screen on the next frame
  instead of after the server responds
- Fonts self-hosted through next/font, removing a render-blocking third-party
  stylesheet from every page load
- Median warm server response across the workshop pages fell from 276ms to
  192ms

**Phase 2 - Inventory and Procurement.**

- Parts catalogue with categories, warehouses, bins and stock levels
- Weighted average cost, recalculated on every receipt. Receiving into a
  negative balance takes the receipt cost rather than averaging against a
  quantity that cannot meaningfully be averaged.
- Reservation separates on-hand from available, so the same set of brake pads
  cannot be promised to two jobs. Partial reservation is supported, because
  taking the three you have and ordering the fourth is what a workshop does.
- A shortfall raises a purchase request automatically, linked to the job
- Reorder suggestions derived from observed usage, lead time and outstanding
  orders, each reported with an explicit confidence level
- Purchase requests with an approval threshold, keeping request and approve as
  separate permissions
- Purchase orders, partial goods receipt, over-receipt refused
- Three-way match of supplier bills against order and receipt, distinguishing a
  price variance from being billed for goods that never arrived
- Stock adjustments with a mandatory reason, and stocktakes with variance
- 67 further domain tests, and an inventory flow check asserting the arithmetic
  against a real database

**Phase 1 - Workshop Core.**

- Multi-tenant foundation with six roles, deny-by-default permissions, and an
  immutable audit log
- Customers and vehicles, with ISO 3779 VIN validation that warns rather than
  blocks on a check-digit mismatch
- **Vehicle passport**: append-only hash-linked event ledger with verification,
  owner-controlled sharing, and ownership transfer
- Booking diary with per-day capacity and bay lanes
- Job lifecycle engine: fourteen statuses, guards, and a stated reason on every
  refusal
- Digital vehicle inspections with structured measurements and photographs
- Estimates with secure customer approval and line-by-line decisions
- Invoicing and payments with gapless per-organisation numbering
- Four interface surfaces: workshop, shop floor, customer portal, public
  passport
- Background worker: outbox dispatch, rolling chain audit, abandoned
  time-entry closure, service reminders
- 192 domain tests at 92.7% statement coverage
- Database-enforced invariants, with a script that actively tries to break each
  one rather than merely checking it is configured
- 46 documents covering product, requirements, design, decisions, engineering
  and project management

[Unreleased]: https://github.com/Amrwar/vehicle-memory/commits/main
