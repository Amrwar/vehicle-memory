# Testing Strategy

## 1. Shape

```
        /\          Exploratory + usability      humans, per sprint
       /  \
      /----\        End-to-end          ~15      critical journeys only
     /      \
    /--------\      Integration         ~60      route + database
   /          \
  /------------\    Unit               192+      domain logic
```

Weighted to the bottom deliberately. The domain layer holds the rules that are
expensive to get wrong, and it is testable in milliseconds because it imports
nothing ([ADR-0003](../03-adr/0003-monorepo-structure.md)).

## 2. What is tested where

| Layer     | Tool                  | Tests                                                                                          |
| --------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| Domain    | Vitest                | Money, job lifecycle, hash chain, VIN, mileage, totals, roles, capacity, inspection conversion |
| Data      | Vitest + Postgres     | Tenant isolation per entity, invariants, ledger append concurrency                             |
| Routes    | Vitest + fetch        | Auth, permissions, redirects, rendered content                                                 |
| Journeys  | Playwright            | Book to invoice, inspection to approval, passport share                                        |
| Integrity | `verify-integrity.ts` | Actively tries to violate every database guarantee                                             |
| Usability | Humans                | The four criteria in section 7                                                                 |

## 3. Coverage

| Area           | Floor | Actual                               |
| -------------- | ----- | ------------------------------------ |
| Domain overall | 70%   | **92.7%** statements, 85.1% branches |
| Job lifecycle  | 90%   | 97.8%                                |
| Passport chain | 90%   | 94%                                  |

Thresholds are enforced in `vitest.config.mts` and fail the build. They are a
floor, not a target: coverage measures what was executed, not what was
verified, and a 100% line-covered module with no assertions is worthless.

## 4. What a good test looks like

Tests name the behaviour and the reason, so a failure tells you what broke
commercially rather than which function returned the wrong number.

```ts
// Good — names the rule and why it exists
it('records and flags a decreasing reading rather than rejecting it', ...)
it('proves that a blended rate on the subtotal would be wrong', ...)
it('detects a payload that has been edited in place', ...)

// Bad — describes the code
it('returns DECREASE', ...)
it('calls calculateTotals', ...)
```

The chain test carries a comment saying that if it ever fails, the product's
central claim to a used-car buyer is false. That is the level of stakes a test
name should convey.

## 5. Tests that earn their place

Some are worth calling out because they encode a decision rather than checking
a calculation:

| Test                                                        | Guards                           |
| ----------------------------------------------------------- | -------------------------------- |
| `detects a payload that has been edited in place`           | The passport's entire value      |
| `records and flags a decreasing reading`                    | Odometer fraud evidence survives |
| `splits without losing a penny`                             | Allocation preserves totals      |
| `proves that a blended rate on the subtotal would be wrong` | Per-line tax                     |
| `makes the printed lines add up to the printed total`       | Customer arithmetic              |
| `keeps a technician out of financial reporting`             | Role segregation                 |
| `allows a job to go backwards when a second fault is found` | Workshops are not assembly lines |
| `costs labour from clocked time, not from charged hours`    | Profitability is real            |

## 6. Data

- Domain tests use literals. No fixtures, no factories, no shared mutable
  state.
- Integration tests run against a real Postgres in a transaction that rolls
  back. Never a mocked database: the invariants under test are enforced _by_
  the database.
- The seed is demo data, not test data. Tests that depend on the seed break
  when the demo changes.

## 7. What is deliberately not automated

Named here so the gap is visible rather than accidental. These are the five
requirements in the [traceability matrix](../01-requirements/04-traceability-matrix.md)
without automated coverage:

| Criterion                                                    | Verified by                                          |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| A 30-item inspection in under four minutes with gloves on    | Observed testing on a real tablet in a real workshop |
| A customer approving on a phone in under sixty seconds       | Moderated usability testing                          |
| A new advisor creating a booking unaided within five minutes | Observed onboarding                                  |
| The passport being comprehensible to someone with no account | Interview with actual used-car buyers                |
| Colour-independence of status                                | Manual review plus greyscale printing                |

Every one of these is a judgement a human has to make. Asserting them in code
would be asserting a proxy, and the proxy would pass while the real thing
failed.

## 8. In CI

```
  format:check -> lint -> typecheck -> unit -> integration -> build -> e2e
```

The whole pipeline must finish in under ten minutes (NFR-707). A slow pipeline
gets bypassed, and a bypassed pipeline is not a pipeline.

---

_Next: [CI/CD](05-ci-cd.md)._
