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

| Layer      | Tool                                               | Tests                                                                                               |
| ---------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Domain     | Vitest                                             | Money, job lifecycle, hash chain, VIN, mileage, totals, roles, capacity, inspection conversion      |
| Data       | Vitest + Postgres                                  | Tenant isolation per entity, invariants, ledger append concurrency                                  |
| Routes     | Vitest + fetch                                     | Auth, permissions, redirects, rendered content                                                      |
| Journeys   | Playwright                                         | Book to invoice, inspection to approval, passport share                                             |
| Integrity  | `verify-integrity.ts`                              | Actively tries to violate every database guarantee                                                  |
| Acceptance | `verify-*.ts`                                      | One script per phase, against a seeded database, asserting the phase's promise (below)              |
| Crawls     | `verify-controls`, `verify-empty`, `verify-access` | Every page for every role: every control resolves, every page works empty, mechanical accessibility |
| Languages  | `i18n-scan.ts`, `verify-languages`                 | No text outside the translator; every sentence and refusal in French and Arabic (Phase 40.5)        |
| Usability  | Humans                                             | The four criteria in section 7                                                                      |

### The verification scripts

Each phase ends with a script that states the phase's promise as checks
against a real database, cleans up after itself, and runs in CI. `npm run
verify:<name>`.

| Script         | Proves                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| integrity      | Every database guarantee refuses to be violated                                                                                      |
| inventory      | Reservation, average cost, receipts and the shortfall request                                                                        |
| ledger         | Every posting balances and the statements agree with the journal                                                                     |
| signup         | Sign-up creates a complete workshop                                                                                                  |
| team           | Invite, change a role, remove a leaver, never above your own role                                                                    |
| counter        | Till sessions and counter sales post and reconcile                                                                                   |
| banking        | Reconciliation and period close                                                                                                      |
| automation     | Rules fire once, with consent rechecked at the moment of sending                                                                     |
| messaging      | A queued message actually leaves                                                                                                     |
| inspection     | Results, photographs, and the estimate drafted from findings                                                                         |
| warranty       | Cover is found and a claim is filed against the right party                                                                          |
| condition      | Health score, component ages and predictions from the vehicle's own history                                                          |
| handover       | The technician's device syncs offline actions once, in order                                                                         |
| planning       | Capacity, skills, patterns, absences and the proposed day                                                                            |
| provenance     | Photographs and fitments carry their evidence; the audit log refuses deletion                                                        |
| offline        | Queued actions replay without duplication                                                                                            |
| retention      | Cohorts, lifetime value and lapsing customers                                                                                        |
| credentials    | Reset and verification links are single-use digests                                                                                  |
| deliverability | Bounces suppress, complaints suppress, replies route back                                                                            |
| claims         | A person claims a car by plate and the workshop decides, once                                                                        |
| records        | Every "new" button creates the record it names                                                                                       |
| money          | The money cycle: lifecycle, invoice, payment, credit, refund, balanced throughout                                                    |
| erp            | Supplier bills and payments, payroll runs, fleet consolidation                                                                       |
| answers        | Every advertised question is answered from the records or refused                                                                    |
| network        | A vehicle found across workshops, adopted, continued; the API reads only what it may                                                 |
| settings       | Every setting saves, bad values are refused, nothing is deleted, the plan writes to the diary                                        |
| documents      | Paperwork belongs to the car: who sees it, who removes it, what the cover is                                                         |
| headers        | Every response carries the security headers; the CSP nonce is per request and on the page's own script                               |
| hardening      | A leaked password is refused with its count; the check fails open when the service is down                                           |
| backup         | The database is dumped, restored into a fresh one, and matches row for row and chain for chain                                       |
| assistant      | Routed as the Ask page routes; drafts carry no absent figure; every exchange recorded; spent budget falls back; a draft is sent once |
| storage        | Uploads land where the ticket says                                                                                                   |
| passports      | Passports as a list, for the workshop and for the owner                                                                              |
| loyalty        | Points earned, spent and expired, and never awarded twice                                                                            |
| referrals      | A referral code belongs to one customer and pays out once                                                                            |
| giftcards      | Sold, redeemed, expired, reversed, and never spent past its balance                                                                  |
| region         | Country and currency chosen once, and every page formatting from it                                                                  |
| deposits       | Money taken, applied to a bill, and returned with a reason                                                                           |
| authz          | Authorisation tried rather than trusted, route by route                                                                              |
| payments       | Card payment through a provider, end to end, against the stub                                                                        |
| billing        | Trial, first charge, reminder, past due and cancel at period end                                                                     |
| portal-account | The customer's own account page, exercised                                                                                           |
| import         | Data in and data out, without losing or inventing a row                                                                              |
| workflow       | A job walked from booking to pickup the way a front desk would                                                                       |
| arrival        | Arrival and departure, including the keys and the paperwork                                                                          |
| conversations  | A thread that reaches the customer and routes their reply back                                                                       |
| packages       | Service packages priced and sold as one thing                                                                                        |
| languages      | Every sentence and every refusal in French and Arabic                                                                                |
| returns        | Parts back, cores held, and sublet work out                                                                                          |
| search         | Finding anything, and being told plainly when there is nothing                                                                       |
| owner          | The owner's day: what needs a decision, and what it is costing                                                                       |
| tax            | Rates with up to three taxes, and a report that equals the ledger                                                                    |
| paper          | The vehicle's paperwork: who sees it, who removes it, what lapses                                                                    |
| providers      | Every outside service behind a seam, with a stub that behaves                                                                        |
| ownership      | Ownership, warranty and sites, across a change of keeper                                                                             |
| first-day      | A workshop's first day, from empty to taking a booking                                                                               |
| coupons        | A coupon takes money off a bill without taking money out of the books                                                                |
| repeat         | Doing it twice does not do it twice                                                                                                  |
| writes         | Every write that moves money or stock declares what a repeat does                                                                    |
| wiring         | Everything built has a way in, and works when you get there                                                                          |
| triggers       | A rule a workshop writes actually runs, from its own moment                                                                          |
| awkward        | Thirteen situations tidy software does not expect, each decided and held to it                                                       |
| clock          | The workshop's own elapsed times, read from the right two moments                                                                    |
| performance    | Every screen against a measured budget, at the size of a real workshop                                                               |
| health         | How Carnet itself is, and why one message did not arrive, on a screen                                                                |
| recovery       | The database is lost, restored and measured: what was lost, how long, what broke                                                     |
| tenancy        | One workshop cannot read or change another's records, route by route                                                                 |
| books          | The books still agree with themselves, and say so when they do not                                                                   |
| screens        | Every screen at every size, measured rather than eyeballed                                                                           |
| controls       | Every control on every page does something and every link goes somewhere                                                             |
| empty          | Every page works with nothing in it, with a sentence saying what to do                                                               |
| access         | The mechanical half of accessibility on every page                                                                                   |

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
  format:check -> lint -> typecheck -> unit -> verify:* (seeded database) -> build -> crawl every page
```

The whole pipeline must finish in under ten minutes (NFR-707). A slow pipeline
gets bypassed, and a bypassed pipeline is not a pipeline.

---

_Next: [CI/CD](05-ci-cd.md)._
