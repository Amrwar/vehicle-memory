# Architecture Decision Records

One file per decision of consequence, recorded before implementation. A record
is immutable once accepted: a later change supersedes it with a new ADR rather
than editing the old one, so the reasoning at the time stays legible.

The test for whether something belongs here: would reversing it require
changing more than one module, or migrating data?

| #                                                  | Decision                                             | Status   |
| -------------------------------------------------- | ---------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)      | Record architecture decisions                        | Accepted |
| [0002](0002-technology-stack.md)                   | TypeScript, Next.js and PostgreSQL                   | Accepted |
| [0003](0003-monorepo-structure.md)                 | One repository, four workspaces                      | Accepted |
| [0004](0004-vehicle-is-global.md)                  | **The vehicle is global, not tenant-scoped**         | Accepted |
| [0005](0005-append-only-vehicle-event-ledger.md)   | **Append-only hash-linked ledger, not a blockchain** | Accepted |
| [0006](0006-first-party-session-auth.md)           | First-party session authentication                   | Accepted |
| [0007](0007-transactional-outbox.md)               | Transactional outbox for cross-context events        | Accepted |
| [0008](0008-money-as-integer-minor-units.md)       | Money as integer minor units                         | Accepted |
| [0009](0009-role-segregated-interfaces.md)         | Four interfaces, one data model                      | Accepted |
| [0010](0010-tenant-isolation-in-data-layer.md)     | Tenant isolation enforced in the data-access layer   | Accepted |
| [0011](0011-derived-totals.md)                     | Totals are derived, never stored                     | Accepted |
| [0012](0012-photographs-as-the-trust-mechanism.md) | Photographs are the trust mechanism                  | Accepted |
| [0013](0013-generated-text-inside-the-workflow.md) | Generated text inside the workflow, never deciding   | Accepted |
| [0014](0014-the-passport-carries-no-name.md)       | **The passport carries no personal name**            | Accepted |
| [0015](0015-the-status-and-the-loading-screen.md)  | **The status line and the loading screen**           | Accepted |
| [0016](0016-the-corpus-not-the-guess.md)           | **The corpus, not the guess**                        | Accepted |

The three in bold are the ones the product could not survive losing.
ADR-0004 makes portable history possible at all; ADR-0005 is what makes anyone
believe it; ADR-0014 is what keeps the second from making the product unlawful,
by settling that a hash chain nobody can edit must never be given a name to
hold.
