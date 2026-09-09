# Ways of Working

## Cadence

Two-week sprints. Deliberately boring.

| Ceremony              | When        | Length | Purpose                             |
| --------------------- | ----------- | ------ | ----------------------------------- |
| Planning              | Day 1       | 90 min | Agree the sprint goal and pull work |
| Standup               | Daily       | 10 min | Blockers only, not status theatre   |
| Design-partner review | Fortnightly | 60 min | Real workshops, real feedback       |
| Demo                  | Last day    | 45 min | Against written acceptance criteria |
| Retrospective         | Last day    | 45 min | One change, owned by a person       |

A retrospective that produces five actions produces none. One change, one
owner, checked at the next retrospective.

## Roles

| Role          | Accountable for                                    |
| ------------- | -------------------------------------------------- |
| Product owner | Priority, acceptance, design-partner relationships |
| Tech lead     | Architecture, the domain model, review quality     |
| Engineers     | Delivery, tests, documentation of their work       |
| Designer      | Design system, screen design, usability testing    |
| QA            | Test strategy, automation, exploratory testing     |

## Work flow

```
  Backlog -> Ready -> In progress -> In review -> In test -> Done
```

**Ready** means: acceptance criteria written, dependencies known, estimated,
and small enough to finish inside a sprint. Work that is not Ready is not
pulled, however urgent it feels.

Work in progress is limited to one item per engineer plus one. Two things
half-done is worse than one thing finished.

## Design partners

Two workshops from week 3. They are not a focus group; they run their business
on the software.

- Fortnightly on-site visit, watching real work rather than asking about it.
- Direct line to the product owner between visits.
- Their feedback goes into the backlog with the same weight as internal ideas,
  and is labelled so its origin is visible.

Watching a technician use the tablet with gloves on has changed more decisions
than any planning meeting.

## Decisions

| Kind             | How                                                 |
| ---------------- | --------------------------------------------------- |
| Architectural    | ADR, written before implementation                  |
| Product          | Product owner decides, records why                  |
| Technical, local | Whoever is doing the work                           |
| Contested        | Tech lead and product owner, within one working day |

Nothing waits more than a day for a decision. A blocked engineer is more
expensive than an imperfect choice.

## Communication

- Asynchronous by default, written.
- A decision made in a call is written down afterwards, or it did not happen.
- Documentation lives in this repository, next to the code, and changes in the
  same pull request as the behaviour it describes.

---

_Next: [Definition of done](02-definition-of-done.md)._
