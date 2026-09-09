# Coding Standards

Conventions that are not obvious, and the reasoning for the ones that look
arbitrary. Formatting is Prettier's problem and is not discussed here.

## 1. Layering

The one rule that matters:

```
  packages/core  imports NOTHING from this repository.
                 No Prisma. No React. No Next.
```

That is what makes the domain testable in milliseconds and portable if the
framework changes. 192 tests run in under half a second because none of them
touch a database.

| Layer | May import |
| --- | --- |
| `packages/core` | nothing internal |
| `packages/db` | core |
| `packages/ui` | core, React |
| `apps/*` | everything |

## 2. TypeScript

- Strict mode, `noUncheckedIndexedAccess` on. `array[0]` is `T | undefined`
  and must be handled.
- No `any`. `unknown` plus a narrowing check instead.
- Suppressions carry a comment saying why. A bare `@ts-expect-error` fails
  review.
- Types describe the domain, not the database. `JobStatus` is a union in
  `core`, and the Prisma enum is mapped to it at the boundary.
- Prefer `type` for unions and shapes, `interface` for things that are
  extended.

## 3. Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Files | kebab-case | `to-estimate.ts` |
| Components | PascalCase | `ProgressTrail` |
| Functions | camelCase, verb first | `calculateTotals` |
| Booleans | `is`, `has`, `can` | `isTerminal`, `hasApprovedEstimate` |
| Constants | SCREAMING_SNAKE | `TREAD_CRITICAL_MM` |
| Database tables | snake_case plural | `vehicle_events` |
| Prisma models | PascalCase singular | `VehicleEvent` |

**Names come from the ubiquitous language** ([domain model](../02-design/01-domain-model.md)
section 2). A labour line and a time entry are different concepts with
different names, and calling either one "hours" in code is how they get
conflated.

## 4. Comments

Comment the **why**, never the what. The code says what.

```ts
// Bad — restates the code
// Loop through the findings and filter to critical ones
const critical = findings.filter(f => f.severity === 'CRITICAL');

// Good — explains a decision the reader would otherwise question
// A decreasing odometer is recorded and flagged, never rejected. It is either
// a clerical error or odometer fraud, and the second is exactly what a buyer
// needs to see. Rejecting the reading would destroy the evidence.
```

Every non-obvious constant carries its justification. `TREAD_CRITICAL_MM = 1.6`
has a comment saying it is the legal minimum in most of Europe, so a future
reader does not "tidy" it to a round number.

## 5. Errors

- Domain errors are typed and carry a code: `JobTransitionError`,
  `ForbiddenError`, `MoneyError`.
- An error message says what went wrong **and what is permitted**. "A job
  cannot move from Draft to Invoice. Permitted next steps: Booked, Vehicle
  received, Cancelled."
- Never swallow an error silently. If it is genuinely ignorable, say so in a
  comment.
- Never leak internals to a user. Log the detail, show the explanation.

## 6. Database access

- Always through the scoped client from `requireSession()`. Importing the
  unscoped `prisma` in a page is a review failure unless it is a passport read
  with an explicit access check beside it.
- Every list query paginates. No exceptions (NFR-111).
- `select` the fields you need on hot paths. `include` pulls the world.
- Transactions where invariants span rows. Row locks where two writers can
  collide.

## 7. React and Next

- Server components by default. `'use client'` only for genuine interactivity,
  and as far down the tree as possible.
- Data fetching in server components. No client-side fetch for initial data.
- `export const dynamic = 'force-dynamic'` on anything showing live workshop
  state; a cached diary is worse than a slow one.
- No `dangerouslySetInnerHTML`.

## 8. Styling

- Tailwind utilities through the design system tokens. Never a raw hex in a
  component.
- Semantic tokens only: `bg-(--surface)`, never `bg-(--color-slate-0)`.
- Tailwind v4 syntax: `bg-(--token)` with parentheses. `bg-[--token]` is v3 and
  is silently ignored, which is a bug that looks like a styling preference.
- Shared components in `packages/ui`. A one-off layout lives with its page.

## 9. Commits

Conventional Commits. The body explains **why**, and reviewers read it.

```
feat(passport): flag decreasing odometer readings rather than rejecting them

A backwards odometer is either a clerical error or fraud. Rejecting the
reading destroys the evidence a buyer most needs. Recorded and flagged.

Closes #142
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `perf`, `ci`.

## 10. Review checklist

- [ ] Domain logic in `core`, not in a page
- [ ] Tenant scoping via the scoped client
- [ ] Every list paginated
- [ ] Money never a float
- [ ] Status changes through the state machine
- [ ] No colour-only status indication
- [ ] Touch targets 48px on shop-floor surfaces
- [ ] Tests for the behaviour, not the implementation
- [ ] Comments explain why
- [ ] No contradiction with an accepted ADR

---

*Next: [Git and branching](03-git-and-branching.md).*
