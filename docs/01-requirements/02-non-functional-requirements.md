# Non-Functional Requirements

Quality attributes with numeric budgets. A requirement without a number is an
opinion, so every one of these has a number and a way to measure it.

---

## NFR-100 — Performance

| ID      | Requirement                                                                        | Budget                                             | Measured by                    |
| ------- | ---------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| NFR-101 | Server response for a read of a single record                                      | p95 < 200 ms, p99 < 500 ms                         | Application metrics            |
| NFR-102 | Server response for a list view of up to 50 rows                                   | p95 < 400 ms                                       | Application metrics            |
| NFR-103 | Diary week view with 200 bookings                                                  | p95 < 600 ms                                       | Application metrics            |
| NFR-104 | Vehicle passport render with 500 events                                            | p95 < 800 ms                                       | Application metrics            |
| NFR-105 | Largest Contentful Paint on the dashboard                                          | < 2.0 s on a 4G connection                         | Lighthouse CI                  |
| NFR-106 | Interaction to Next Paint across the app                                           | < 200 ms                                           | Real user monitoring           |
| NFR-107 | Cumulative Layout Shift                                                            | < 0.1                                              | Lighthouse CI                  |
| NFR-108 | Technician job list on a workshop tablet over Wi-Fi                                | Interactive < 1.5 s                                | Device testing                 |
| NFR-109 | Inspection photo upload, 3 MB image                                                | Visible acknowledgement < 1 s, upload backgrounded | Device testing                 |
| NFR-110 | No database query in a request path may exceed 100 ms without an index-backed plan | Enforced in review                                 | Query logging in staging       |
| NFR-111 | List endpoints MUST paginate. No endpoint may return an unbounded collection.      | Hard rule                                          | Code review, integration tests |

Performance work is not deferred to the end. NFR-111 in particular is enforced
from the first list endpoint, because retrofitting pagination is a rewrite of
every caller.

## NFR-200 — Scalability

| ID      | Requirement                                                                            | Target                   |
| ------- | -------------------------------------------------------------------------------------- | ------------------------ |
| NFR-201 | Tenants supported on a single deployment                                               | 2,000                    |
| NFR-202 | Concurrent active users                                                                | 5,000                    |
| NFR-203 | Jobs per tenant per year                                                               | 25,000                   |
| NFR-204 | Passport events stored                                                                 | 100 million              |
| NFR-205 | Photographs stored                                                                     | 20 million, average 2 MB |
| NFR-206 | The application tier MUST be stateless and horizontally scalable.                      | Hard rule                |
| NFR-207 | Background work MUST run in a separate process from request handling.                  | Hard rule                |
| NFR-208 | Passport event queries MUST remain within budget at 5,000 events for a single vehicle. | Load tested              |

## NFR-300 — Availability and resilience

| ID      | Requirement                                                                        | Target                                                       |
| ------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| NFR-301 | Availability of the workshop application during business hours                     | 99.9% monthly                                                |
| NFR-302 | Availability of the public passport read path                                      | 99.5% monthly                                                |
| NFR-303 | Recovery Time Objective                                                            | 1 hour                                                       |
| NFR-304 | Recovery Point Objective                                                           | 5 minutes                                                    |
| NFR-305 | Database backups                                                                   | Continuous WAL archiving plus nightly full, retained 30 days |
| NFR-306 | Backup restoration MUST be tested                                                  | Quarterly, results recorded                                  |
| NFR-307 | An outage of SMS, email or VIN-decode providers MUST NOT prevent core workflow.    | Degrade, queue, retry                                        |
| NFR-308 | Deployments MUST cause no downtime.                                                | Rolling, backward-compatible migrations                      |
| NFR-309 | Every migration MUST be backward-compatible with the previous application version. | Expand, migrate, contract                                    |

## NFR-400 — Security

| ID      | Requirement                                                                                                                        |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| NFR-401 | All traffic MUST use TLS 1.2 or higher. Plain HTTP MUST redirect.                                                                  |
| NFR-402 | Passwords MUST be hashed with Argon2id, or bcrypt at cost 12 or higher.                                                            |
| NFR-403 | Session tokens MUST be httpOnly, Secure, SameSite=Lax, and MUST rotate on privilege change.                                        |
| NFR-404 | Every state-changing request MUST be protected against cross-site request forgery.                                                 |
| NFR-405 | All input MUST be validated against a schema at the boundary. Trusting client-side validation is prohibited.                       |
| NFR-406 | Database access MUST use parameterised queries exclusively.                                                                        |
| NFR-407 | A response MUST NOT include data from another tenant under any code path. This is verified by automated test, not by inspection.   |
| NFR-408 | Secrets MUST come from the environment. A secret in source control is a build failure.                                             |
| NFR-409 | Dependencies MUST be scanned for known vulnerabilities on every build; critical findings block the merge.                          |
| NFR-410 | Public share links MUST use at least 128 bits of entropy and MUST expire.                                                          |
| NFR-411 | Rate limits MUST apply to authentication, public approval links and passport share links.                                          |
| NFR-412 | Uploaded files MUST be validated by content type and size, stored outside the web root, and served through an authorising handler. |
| NFR-413 | A penetration test MUST be completed before general availability, and findings rated high or above MUST be resolved.               |
| NFR-414 | Security headers MUST include Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options and Referrer-Policy.      |

## NFR-500 — Privacy and data protection

| ID      | Requirement                                                                                                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-501 | Personal data MUST be collected only where a stated purpose requires it.                                                                                                                              |
| NFR-502 | A customer's personal data MUST be exportable in a machine-readable form on request, within 30 days.                                                                                                  |
| NFR-503 | A customer MUST be able to request erasure. Erasure MUST remove personal identifiers while preserving vehicle events in a de-identified form, because the vehicle's history is not the person's data. |
| NFR-504 | The lawful basis and retention period for each data category MUST be documented.                                                                                                                      |
| NFR-505 | Passport access by a third party MUST require an explicit, scoped, revocable grant from the owner.                                                                                                    |
| NFR-506 | Every third-party passport access MUST be logged and visible to the owner.                                                                                                                            |
| NFR-507 | Data MUST be stored in the jurisdiction agreed with the customer.                                                                                                                                     |
| NFR-508 | Sub-processors MUST be listed publicly and customers notified before changes.                                                                                                                         |

NFR-503 is the subtle one. When Maria sells her car and asks to be forgotten,
her name must go, but the fact that the brake discs were replaced at 82,430 km
must remain, because it belongs to the vehicle. The
[security model](../02-design/05-security-model.md) specifies the split.

## NFR-600 — Usability and accessibility

| ID      | Requirement                                                                                   | Budget                           |
| ------- | --------------------------------------------------------------------------------------------- | -------------------------------- |
| NFR-601 | WCAG 2.2 Level AA conformance across all interfaces                                           | Audited                          |
| NFR-602 | Colour contrast: normal text 4.5:1, large text 3:1, UI boundaries 3:1                         | Automated check                  |
| NFR-603 | Status MUST NOT be conveyed by colour alone; every status carries an icon or text label       | Design review                    |
| NFR-604 | Every interactive element reachable and operable by keyboard, with a visible focus indicator  | Automated and manual             |
| NFR-605 | Touch targets on the technician interface                                                     | Minimum 48 x 48 px, 8 px spacing |
| NFR-606 | The technician interface MUST be usable while wearing nitrile gloves                          | Observed testing                 |
| NFR-607 | A new service advisor MUST create a booking unaided within 5 minutes of first use             | Usability testing                |
| NFR-608 | A customer MUST approve an estimate on a phone within 60 seconds                              | Usability testing                |
| NFR-609 | The application MUST support light and dark themes and respect the system preference          | Implemented                      |
| NFR-610 | The application MUST work on the two most recent versions of Chrome, Safari, Firefox and Edge | Browser testing                  |
| NFR-611 | No workflow may depend on hover, since the technician interface is touch-only                 | Design review                    |
| NFR-612 | The interface MUST support right-to-left layout and MUST NOT hard-code text direction         | Implemented in the design system |

## NFR-700 — Maintainability

| ID      | Requirement                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-701 | Domain logic MUST live in a layer with no dependency on the web framework or the ORM.                                                      |
| NFR-702 | Test coverage of the domain layer MUST be at or above 70% overall and 90% for the job lifecycle and the passport chain.                    |
| NFR-703 | TypeScript MUST run in strict mode. Suppressions require a comment justifying them.                                                        |
| NFR-704 | Every architectural decision of consequence MUST be recorded as an ADR before implementation.                                              |
| NFR-705 | The public API MUST be described by an OpenAPI document kept in step with the implementation.                                              |
| NFR-706 | A new engineer MUST be able to go from clone to a running seeded application in under 15 minutes, following only the written instructions. |
| NFR-707 | The build, lint, type-check and test pipeline MUST complete in under 10 minutes.                                                           |
| NFR-708 | Every merge to the main branch MUST pass the full pipeline. Bypassing it requires a recorded exception.                                    |

NFR-706 is measured literally, by handing the instructions to someone who has
not seen the project and timing them.

## NFR-800 — Observability

| ID      | Requirement                                                                                                               |
| ------- | ------------------------------------------------------------------------------------------------------------------------- |
| NFR-801 | Logs MUST be structured JSON with a correlation identifier spanning a request.                                            |
| NFR-802 | Logs MUST NOT contain passwords, session tokens, full payment details or complete personal records.                       |
| NFR-803 | Every request MUST carry a trace identifier through to background jobs it enqueues.                                       |
| NFR-804 | Business metrics MUST be emitted for jobs created, inspections completed, estimates approved and passport events written. |
| NFR-805 | Unhandled exceptions MUST be captured with context and alerted.                                                           |
| NFR-806 | Alerts MUST exist for error-rate, latency and queue-depth thresholds, each with a runbook entry.                          |
| NFR-807 | Every alert MUST be actionable. An alert with no action is deleted.                                                       |

## NFR-900 — Compliance and localisation

| ID      | Requirement                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------- |
| NFR-901 | Invoices MUST meet the tax-document requirements of the operating jurisdiction.                     |
| NFR-902 | Invoice numbering MUST be sequential and gapless per organisation.                                  |
| NFR-903 | Financial records MUST be retained for the statutory period, minimum 7 years.                       |
| NFR-904 | The system MUST support multiple currencies with per-organisation base currency.                    |
| NFR-905 | All user-facing text MUST be externalised for translation. Hard-coded display strings are a defect. |
| NFR-906 | Dates, numbers and currency MUST render according to the user's locale.                             |
| NFR-907 | The system MUST store all timestamps in UTC and render in the location's timezone.                  |

## Where each of these is enforced

Every one of the eighty-four above is accounted for in
`infra/scripts/verify-quality.ts`, which runs on every build and checks its own
register against this document: a requirement here with no account there fails,
and an account there naming a requirement that is not here fails too.

Each is one of three things.

| Kind        | Count | What it means                                                                                             |
| ----------- | ----- | --------------------------------------------------------------------------------------------------------- |
| **checked** | 47    | Something runs and would fail. The thing that runs is named, has to exist, and has to be in the workflow. |
| **read**    | 15    | True of the repository as it stands, and asserted there and then rather than by a script somewhere else.  |
| **not yet** | 22    | Enforced by nothing. What it would take is written down, because "not yet" without that is a wish.        |

The twenty-two are not an oversight and are not going to become checks by being
looked at harder. They need a person, a production deployment, or a month of
real traffic: a penetration test, a new service advisor taking a booking
unaided, a month of uptime, two thousand tenants, a technician in nitrile
gloves. `npm run verify:quality` lists all twenty-two with the reason each time
it runs, so the number is visible rather than implied.

Until Phase 56 exactly one of these eighty-four appeared in the
[traceability matrix](04-traceability-matrix.md). Several were in fact enforced
thoroughly — the recovery targets since Phase 49, the performance budgets since
Phase 51, the translation rule since Phase 40.5 — but anonymously, which is the
problem this closes: a requirement whose enforcement nobody can name is a
requirement nobody can check has stopped being enforced.

---

_Next: [User stories](03-user-stories.md)._
