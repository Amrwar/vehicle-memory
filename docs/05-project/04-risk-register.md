# Risk Register

Scored as impact multiplied by likelihood, both 1 to 5. Reviewed every sprint.
Every risk has one named owner; a risk owned by "the team" is owned by nobody.

## Live risks

| # | Risk | I | L | Score | Owner | Mitigation | Trigger |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **R1** | **Technicians do not adopt the shop-floor interface.** Data quality collapses and the passport is empty. | 5 | 3 | **15** | Designer | Design partners from week 3. Timed observation on a real tablet, with gloves, before Phase 1 acceptance. | Inspection completion below 60%, or median duration above 4 minutes |
| **R2** | **Accounting defects.** A ledger that does not balance destroys trust irrecoverably. | 5 | 3 | **15** | Tech lead | Invariants enforced in the database. Property tests. External accountant review before Phase 3 acceptance. | Any trial balance that does not balance |
| **R3** | **Cold start.** Passports stay empty and the differentiator never materialises. | 4 | 4 | **16** | Product owner | Events written from Phase 1. Coverage measured from day one. Revenue share designed in, not retrofitted. | Fewer than 3 events per completed job at month 6 |
| **R4** | **Scope expansion into general ERP.** | 4 | 4 | **16** | Product owner | Written exclusions. Change requests carry cost and schedule impact. | Two consecutive sprints where unplanned work exceeds 20% |
| **R5** | **Data protection exposure.** Personal data plus a vehicle's whole history. | 5 | 2 | 10 | Tech lead | Isolation at the data layer. Documented security model. Penetration test before general availability. | Any cross-tenant access in testing |
| **R6** | **VIN mistyping merges two vehicles' histories.** The worst failure this system can have. | 5 | 2 | 10 | Tech lead | Format and check-digit validation, duplicate warning on entry, VIN decode. Merge is not reversible; an unmerge procedure is needed before general availability. | Any reported merge |
| **R7** | **Churn is worse than the assumed 12%,** invalidating the unit economics. | 4 | 3 | 12 | Product owner | Cohort retention tracked from month 12. CAC budget adjusts to measured churn, not assumed. | Month-12 cohort below 85% retained |
| **R8** | **Workshops object to data portability on principle.** | 4 | 2 | 8 | Product owner | Interview design partners in week 6. Revenue share published. Portability framed as a customer-retention asset. | Two of two design partners raise it unprompted |
| **R9** | **Ledger salt rotated in error,** invalidating every chain. | 5 | 1 | 5 | Tech lead | Documented in `.env.example` and ADR-0005. Should be in a secret store that resists rotation. | Any verification failure across many vehicles at once |
| **R10** | **Key-person dependency on the domain model.** | 3 | 3 | 9 | Tech lead | ADRs, documented domain model, pairing on the chain and the ledger. | Any module only one person has touched |
| **R11** | **Third-party VIN decode is unavailable or expensive.** | 2 | 3 | 6 | Tech lead | Manual entry always available; the field never blocks. Multiple providers evaluated. | Provider outage over 24 hours |
| **R12** | **Design-partner workshops withdraw.** | 4 | 2 | 8 | Product owner | Recruit three, expect two. Keep the relationship valuable to them. | Either partner missing two consecutive reviews |

## Top four, and what actually protects against them

**R3, cold start** is the highest score and the least controllable. The
mitigation is structural rather than procedural: passport events are written
from Phase 1, before anyone asks for them, because coverage cannot be
backfilled. Every week of delay is a week of moat we never get back.

**R4, scope expansion** scores high because it is nearly certain to be
attempted. The word "ERP" invites unbounded requirements. The defence is that
the exclusions are written down in the proposal, so a change is visibly a
change.

**R1 and R2** are the two that would be fatal rather than merely damaging. Both
are mitigated by putting the check outside the code that could be wrong: real
technicians with gloves on for R1, database-enforced invariants and an external
accountant for R2.

## Closed

| # | Risk | Outcome |
| --- | --- | --- |
| R0 | Framework choice unable to serve four surfaces from one schema | Closed. Four surfaces built and verified. |

---

*Next: [Glossary](05-glossary.md).*
