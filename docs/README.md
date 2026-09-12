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

| Doc                                                       | Contents                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Domain model](02-design/01-domain-model.md)              | Bounded contexts, aggregates, invariants, the ubiquitous language                |
| [Data model & ERD](02-design/02-data-model.md)            | Every table, key, index and relationship                                         |
| [Architecture](02-design/03-architecture.md)              | C4 context/container/component, runtime, deployment                              |
| [State machines](02-design/04-state-machines.md)          | Job lifecycle, estimate approval, stock reservation, invoice                     |
| [Security model](02-design/05-security-model.md)          | Authn, authz, tenancy isolation, threat model, passport integrity                |
| [API contract](02-design/06-api-contract.md)              | The three live read endpoints and their keys, then the contract for what follows |
| [Accounting model](02-design/07-accounting-model.md)      | Chart of accounts and the exact journal postings each event makes                |
| [Design system](02-design/08-design-system.md)            | Colour, type, spacing, elevation, components, dark mode, a11y                    |
| [Wireframes](02-design/09-wireframes.md)                  | Every screen, annotated                                                          |
| [The passport, designed](02-design/10-passport-design.md) | Why the passport looks like a passport: every choice and the fact it carries     |

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

### 5. Project management

| Doc                                                       | Contents                                 |
| --------------------------------------------------------- | ---------------------------------------- |
| [Ways of working](05-project/01-ways-of-working.md)       | Cadence, ceremonies, roles               |
| [Definition of done](05-project/02-definition-of-done.md) | The checklist a story must pass          |
| [Estimation & plan](05-project/03-estimation-and-plan.md) | Sizing, the sprint-by-sprint plan        |
| [Risk register](05-project/04-risk-register.md)           | Ranked risks with owners and mitigations |
| [Glossary](05-project/05-glossary.md)                     | The ubiquitous language, defined once    |

---

## Status

Twenty phases have shipped, the last on 13 September 2026: the workshop core,
inventory and procurement, the ledger, people and multi-site, automation and
CRM, the customer's own side, the money cycle, payables and payroll, answers in
words, the network between workshops with a read-only API, the workshop
configuring itself, and the vehicle's paperwork. The
[roadmap](00-product/06-roadmap.md) carries a status paragraph under each
phase, the [feature map](00-product/09-feature-map.md) counts 139 capabilities
built, 1 partial and 6 missing, and the
[traceability matrix](01-requirements/04-traceability-matrix.md) traces 339
requirements to code and tests. Every phase ends with the same checks, listed
in the [testing strategy](04-engineering/04-testing-strategy.md).

What has not happened is the thing the [MVP definition](00-product/05-mvp-definition.md)
still asks for: four weeks in front of a real workshop. Everything above is
evidence of effort, not of fit.
