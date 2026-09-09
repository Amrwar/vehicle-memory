# Changelog

Notable changes. Generated from Conventional Commits; format per Keep a
Changelog, versioning per Semantic Versioning.

## [Unreleased]

### Added

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
