# Git and Branching

## Trunk-based, short-lived branches

```
  main  ----o----o----o----o----o----o---->  always deployable
             \        /      \      /
              o------o        o----o
              feature          fix
              < 2 days         hours
```

`main` is always deployable. Branches live under two days; a branch older than
that is a merge conflict waiting to happen and usually means the work should
have been split.

| Prefix | For |
| --- | --- |
| `feat/` | New capability |
| `fix/` | Defect |
| `docs/` | Documentation only |
| `refactor/` | Behaviour unchanged |
| `chore/` | Tooling, dependencies |

Name the branch after the outcome: `feat/inspection-to-estimate`, not
`feat/sprint-3-work`.

## Commits

Conventional Commits. The subject is imperative and under 72 characters. The
body explains why, because a diff already shows what.

```
fix(diary): stop a dropped booking landing on an unavailable technician

A technician clash is physically impossible, unlike a bay clash which
workshops genuinely do squeeze. Bay clashes stay a warning; technician
clashes now block.
```

## Pull requests

Small. Under 400 changed lines where possible; a reviewer's attention is finite
and a 2,000-line PR gets approved rather than read.

Every PR states:

1. What changed and why
2. Which requirement or story it satisfies
3. How it was tested
4. Anything reviewers should look at closely

Required to merge:

- [ ] Pipeline green: format, lint, typecheck, test, build
- [ ] One approval
- [ ] No contradiction with an accepted ADR
- [ ] Migrations backward compatible with the previous release
- [ ] Definition of done met

## Merging

Squash merge. `main` reads as one commit per change, which makes `git bisect`
and the release notes both usable.

## Releases

Semantic versioning, tagged on `main`. A tag triggers a production deployment.
`CHANGELOG.md` is generated from Conventional Commits, which is the practical
reason the format is enforced rather than merely encouraged.

## Hotfixes

Branch from the tag, fix, tag a patch, deploy, then merge back to `main`. A
hotfix that only ever reaches production is a regression scheduled for the next
release.

---

*Next: [Testing strategy](04-testing-strategy.md).*
