# Definition of Done

A contract, not an aspiration. Work that has not met it is not counted as
delivered, is not demoed, and does not move the burndown.

## A story is done when

**Function**
- [ ] Every acceptance criterion passes, demonstrated rather than asserted
- [ ] Edge cases handled: empty, single, many, error
- [ ] Errors say what went wrong and what to do about it

**Code**
- [ ] Domain logic in `packages/core`, not in a page
- [ ] Tenant scoping via the scoped client
- [ ] Reviewed and approved by someone who did not write it
- [ ] No contradiction with an accepted ADR
- [ ] TypeScript strict, no unexplained suppressions

**Tests**
- [ ] Unit tests for the domain logic
- [ ] Integration test for the route
- [ ] Cross-tenant isolation test if a new tenant-scoped entity
- [ ] Coverage thresholds still met
- [ ] Whole suite green

**Interface**
- [ ] Matches the design system; no raw colours
- [ ] Keyboard operable, focus visible
- [ ] Contrast meets AA
- [ ] Status never conveyed by colour alone
- [ ] Touch targets 48px on shop-floor surfaces
- [ ] Works at 360px width
- [ ] Both themes checked
- [ ] Loading, empty and error states all designed

**Data**
- [ ] Migration is backward compatible with the previous release
- [ ] Indexes for the queries the feature introduces
- [ ] Seed updated if the feature needs demo data

**Operations**
- [ ] Structured logs at the right level
- [ ] Metrics emitted for anything worth alerting on
- [ ] Runbook entry if a new failure mode exists

**Documentation**
- [ ] Requirement traced in the matrix
- [ ] ADR written if an architectural decision was made
- [ ] README or getting-started updated if setup changed

## A sprint is done when

- [ ] Every story meets the above
- [ ] Deployed to staging
- [ ] Demonstrated against criteria agreed *before* the work started
- [ ] No new critical or high defects open
- [ ] Design partners have seen it

## A phase is done when

- [ ] Every story done
- [ ] Non-functional budgets met and measured
- [ ] Security review complete
- [ ] Accessibility audit passed
- [ ] Runbook updated and exercised
- [ ] Acceptance criteria in the [proposal](../00-product/02-proposal.md) demonstrated
- [ ] Client sign-off

## What "done" excludes

Not done: works on my machine, works but is untested, works but is
undocumented, works but only for the happy path, works but is inaccessible.

Each of those is a debt that will be paid at a worse time, by someone with less
context.

---

*Next: [Estimation and plan](03-estimation-and-plan.md).*
