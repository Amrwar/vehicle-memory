## What and why

<!-- The diff shows what changed. Explain why. -->

## Satisfies

<!-- FR-###, NFR-###, or the story number. -->

## How it was tested

<!-- Not "it works". What did you actually run or observe? -->

## Look closely at

<!-- Anything you are unsure about, or that a reviewer would otherwise skim. -->

---

- [ ] Domain logic in `packages/core`, not in a page
- [ ] Tenant scoping via the scoped client
- [ ] Every list query paginated
- [ ] Money never a float
- [ ] Status changes go through the state machine
- [ ] Status never conveyed by colour alone
- [ ] 48px touch targets on shop-floor surfaces
- [ ] Migration backward compatible with the previous release
- [ ] Tests cover the behaviour, not the implementation
- [ ] No contradiction with an accepted ADR
- [ ] [Definition of done](../docs/05-project/02-definition-of-done.md) met
