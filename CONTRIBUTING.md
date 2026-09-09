# Contributing

## Before you start

Read [getting started](docs/04-engineering/01-getting-started.md) and
[coding standards](docs/04-engineering/02-coding-standards.md). If you are
changing anything in `packages/core/src/passport` or `packages/db/prisma`, read
[ADR-0004](docs/03-adr/0004-vehicle-is-global.md) and
[ADR-0005](docs/03-adr/0005-append-only-vehicle-event-ledger.md) first. Those
two decisions are load-bearing, and undoing one by accident is the most
expensive mistake available here.

## The loop

```bash
git switch -c feat/short-outcome-name
# work
npm run verify        # format, lint, typecheck, test
git commit            # Conventional Commits; the body explains why
```

Open a pull request using the template. Keep it under 400 changed lines where
you can. A 2,000-line pull request gets approved rather than read.

## What gets a change rejected

- Domain logic in a page instead of `packages/core`
- A database query that bypasses the tenant-scoped client
- An unpaginated list endpoint
- Money as a floating-point number
- A status change that bypasses the state machine
- Status conveyed by colour alone
- A migration that is not backward compatible with the previous release
- Contradicting an accepted ADR without superseding it

## Architecture decisions

A decision of consequence gets an ADR **before** the implementation. The test:
would reversing this require changing more than one module, or migrating data?

Copy the shape of an existing record: context, decision, alternatives
considered with reasons, consequences. The alternatives section is the part
people actually need later, and the part usually left out.

An accepted ADR is never edited. A change supersedes it with a new one.

## Tests

Name the behaviour and the reason, not the function.

```ts
// Good
it('records and flags a decreasing reading rather than rejecting it', ...)

// Bad
it('returns DECREASE', ...)
```

If you add a tenant-scoped model, add its cross-tenant isolation test in the
same pull request. A model without one is a review failure.

## Reporting a security issue

Do not open a public issue. See [SECURITY.md](SECURITY.md).
