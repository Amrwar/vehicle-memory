# What CI costs, and the two ways to stop paying it

**Phase 82, 27 September 2026.**

## What happened

`Amrwar/vehicle-memory` is a **private** repository. Private repositories draw
GitHub Actions minutes from a monthly allowance — 2,000 on Free, 3,000 on Pro —
and bill per minute after that. Public repositories pay nothing on standard
runners; private ones do.

Every push ran five jobs, four of them in parallel, and billing counts the sum
of the jobs rather than the wall clock. The expensive one is **Build and smoke
test**: it builds the application and then runs sixty-odd checks through three
browser engines — every route for every role, 130 screens at four sizes, the
paint budget, WebKit and Firefox as well as Chromium. Ten to twenty minutes of
runner time. Per push.

On 25 September the allowance ran out mid-session and GitHub stopped starting
**every** job, including the cheap ones:

> The job was not started because recent account payments have failed or your
> spending limit needs to be increased.

The failure mode is worth naming: running out of minutes does not degrade
gracefully to the important checks. It stops all of them.

## What was changed, from inside the repository

The heavy half no longer runs on every push. It runs where it earns its cost:

| Event                 | Fast gates | Browser suite |
| --------------------- | ---------- | ------------- |
| Push to `main`        | yes        | no            |
| Pull request          | yes        | yes           |
| Nightly, 03:00 UTC    | yes        | yes           |
| Manual (Run workflow) | yes        | yes           |

The fast gates — format, lint, types, unit tests, dependency audit, and the
database invariants, which is the sixty-check suite against a real Postgres —
still run on every push. They are where most faults are caught and they are a
fraction of the cost.

And a push that only rewrites generated documents — a rebuilt PDF, the deck, the
design book — runs nothing at all. It cannot change what the product does.

## The two ways to stop paying

**1. Register a self-hosted runner. This is the one that makes it free, and it
unblocks everything rather than only the expensive job.**

Self-hosted minutes are not billed, at all, on any plan — and this matters more
than it first appears. A spent allowance does not stop the expensive job and
leave the cheap ones running; it stops **every** job. So every job in the
workflow reads a repository variable, not only the heavy one:

```yaml
static     runs-on: ${{ vars.RUNNER || 'ubuntu-latest' }}
unit       runs-on: ${{ vars.RUNNER || 'ubuntu-latest' }}
integrity  runs-on: ${{ vars.RUNNER || 'ubuntu-latest' }}
audit      runs-on: ${{ vars.RUNNER || 'ubuntu-latest' }}
build      runs-on: ${{ vars.HEAVY_RUNNER || vars.RUNNER || 'ubuntu-latest' }}
```

To use it:

1. **Settings → Actions → Runners → New self-hosted runner** on the repository,
   and follow the commands it gives. It is a download, a `config` with a token
   the page supplies, and a `run`. Ten minutes.
2. **Settings → Secrets and variables → Actions → Variables → New variable**,
   named `RUNNER`, value `self-hosted`.

The whole pipeline then runs on your own machine and costs nothing, on any
plan, with the allowance at zero. It is the same work `npm run checks` already
does locally, so the machine is known to be capable of it. Leave the variable
unset and the workflow falls back to hosted runners, unchanged.

`HEAVY_RUNNER` is there if you want the split the other way: the cheap jobs on
GitHub's runners, the twenty-minute browser suite on yours.

**What it needs.** Docker, for the Postgres service container the database jobs
start — the same Docker Desktop the local database already runs under. And the
machine on at 03:00 for the nightly run, or the nightly simply does not happen
and the pull-request run still covers it.

**What to know before doing it.** A self-hosted runner executes whatever the
repository's workflows say, on that machine, with that machine's access. On a
private repository with one author that is a statement about yourself. It is
not advisable on a public repository, where a pull request from a stranger is a
script you have agreed to run.

**2. Raise the spending limit.** github.com/settings/billing → Plans and usage
→ Actions spending limit. The default on many accounts is **$0**, which is why
everything stopped the instant the allowance ran out rather than costing a few
pence. If a card has expired, this is also where that shows.

## What this does not change

`npm run checks` runs the entire suite locally, in the order CI runs it, with
the same reseeds — ninety-five steps, about fifteen minutes. That is what every
phase in this repository is verified against before it is pushed, and it does
not depend on anybody's billing.

What CI adds is the platform. Phase 75 exists because a responsiveness check
passed on Windows and failed on Linux by seven pixels. A green local run is not
the same claim.
