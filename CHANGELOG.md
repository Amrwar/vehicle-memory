# Changelog

Notable changes. Generated from Conventional Commits; format per Keep a
Changelog, versioning per Semantic Versioning.

## [Unreleased]

### Added

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
