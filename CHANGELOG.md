# Changelog

Notable changes. Generated from Conventional Commits; format per Keep a
Changelog, versioning per Semantic Versioning.

## [Unreleased]

### Added

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
