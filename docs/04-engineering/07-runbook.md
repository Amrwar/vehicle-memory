# Runbook

Procedures for the things that actually break. Each entry is written to be
followed at 3am by somebody who did not build the system.

## Two runbooks, and which is which (Phase 57)

This file is the long form: the queries to run, the commands to type, the
order to do things in. It is read on a laptop, by somebody who has decided to
sit down and fix something.

The short form lives in `packages/core/src/health/alerts.ts`, one entry per
signal, and it is what the alert message itself carries — what this means, the
first thing to do, and what it would mean to have fixed it. It is read on a
telephone, in the dark, by somebody deciding whether to get up.

They are deliberately two things rather than one file read twice, because they
are read in two different states of mind. What they must not become is two
accounts that disagree: the short form's "first thing" for a signal is the
first step of the section here that covers it, and where a section exists it is
named in the entry. `npm run verify:alerts` will not let a signal exist with no
short-form entry at all; nothing can check that the two stay in agreement about
the detail, so that is a thing to look at whenever either changes.

| Alert                        | Section here                    |
| ---------------------------- | ------------------------------- |
| Passport chains              | Chain verification failure      |
| Database                     | Database unreachable            |
| Events waiting               | Outbox backing up               |
| Messages due and not gone    | Outbox backing up               |
| Restore drill, Oldest record | Restoring a backup              |
| Sessions, API keys           | Suspected credential compromise |
| Migrations                   | Deployment gone wrong           |

The alerts with no section here — email and text failing, card payments, the
file store, the vehicle lookup, the assistant, the scheduled-work secret — are
one-step problems whose first action is the whole procedure, and the short form
carries it.

## Chain verification failure

**Severity: critical.** This is the one that matters most. It means either a
bug, or somebody has written to `vehicle_events` outside the application.

1. Do not restart anything. Do not deploy.
2. Identify the vehicle and the first divergent sequence:
   ```bash
   npx tsx infra/scripts/verify-integrity.ts
   ```
3. Read the divergent event and the audit log around its `recordedAt`.
4. Check the trigger still exists:
   ```sql
   SELECT tgname, tgenabled FROM pg_trigger
   WHERE tgname = 'vehicle_events_append_only';
   ```
   `tgenabled` must be `O`. If it is `D`, the trigger was disabled — treat as a
   security incident.
5. Check whether `LEDGER_CHAIN_SALT` changed. Rotating it invalidates every
   chain and is the most likely innocent cause. Restore the previous value.
6. If tampering is confirmed: preserve evidence, notify the affected vehicle
   owners, and do not attempt to repair the chain. A silently repaired chain is
   worse than a visibly broken one.

**Never** delete or edit events to make verification pass.

## Database unreachable

1. `docker compose ps` or check the managed instance status.
2. Confirm connection count is not exhausted:
   ```sql
   SELECT count(*), state FROM pg_stat_activity GROUP BY state;
   ```
3. If exhausted, find long-running queries and terminate the worst:
   ```sql
   SELECT pid, now() - query_start AS age, left(query, 80)
   FROM pg_stat_activity WHERE state = 'active' ORDER BY age DESC LIMIT 10;
   ```
4. If the instance is down, fail over to the replica and promote.
5. The application returns 503 throughout. There is deliberately no degraded
   write path: a workshop system that silently drops writes is worse than one
   that is down.

## Outbox backing up

Start at `/admin/health` rather than in a log: the Workers panel says how many
events are waiting and how old the oldest is, and the message search at the
bottom answers why any single one has not gone.

Symptom: queue depth alert, or passport events arriving late.

1. Is the worker running? `docker compose ps worker`
2. Look at the failures:
   ```sql
   SELECT type, count(*), max(attempts), left(max("lastError"), 120)
   FROM outbox_events WHERE "processedAt" IS NULL GROUP BY type;
   ```
3. One poison message blocking the rest: mark it processed with a note and
   raise a defect. Do not delete it.
4. A dependency down: the backoff will drain it once the dependency returns.
   Confirm the queue is falling before standing down.

Jobs still complete while the outbox is backed up. That is the design.

## Slow application

1. Check p95 latency and identify the slow route.
2. Slow queries:
   ```sql
   SELECT mean_exec_time, calls, left(query, 100) FROM pg_stat_statements
   ORDER BY mean_exec_time DESC LIMIT 10;
   ```
3. Missing index is the usual cause after a schema change. `EXPLAIN ANALYZE`
   the query and add one.
4. If a single tenant is responsible, check for an unbounded list — a page that
   escaped the pagination rule (NFR-111).

## Restoring a backup

Tested on every push, not quarterly (NFR-306). Two scripts, and the difference
between them is the difference between a backup and a recovery.

`npm run verify:backup` dumps the seeded database, restores it into a fresh
one and checks every row and every chain came back. Untested backups are not
backups, and this one is tested more often than anybody would remember to.

`npm run verify:recovery` asks what the disaster would cost. It writes a row,
takes the backup, writes a second row — the work that happens between a backup
and a disaster — restores, runs the migrations against the copy, and then holds
the copy against the original: every table, every file the rows point at, every
file the store holds, every passport chain, the books, the queues and the
tenant boundary. It ends with two measured numbers and a written record of
everything that came back missing, orphaned or broken.

Last measured on the seeded workshop: **one second of work lost, back in five
seconds**, against promises of five minutes and an hour. The figures are small
because the database is; what matters is that they are measured and that the
script will say so when they stop being small.

**What the drill does not measure, and nobody should read it as having
measured.** The five-minute recovery point in NFR-304 is bought by continuous
archiving of the write-ahead log, not by the dump the drill takes. Archiving is
a property of the managed database and is checked in the Neon console, not
here. What the drill proves is that a dump restores completely and correctly,
and how long that takes.

### Files, which are not in the database

The store is restored separately from the database and can drift from it in
both directions, which are different problems:

- A row pointing at a file that is not there is a customer opening a report
  with a hole in it. The drill fails on this.
- A file nothing points at is a bill that grows and a photograph of somebody's
  car that nothing will ever delete. The drill records it rather than failing,
  because the restore neither caused it nor can fix it. Clear it with
  `npm run storage:orphans`, which lists by default and removes only when asked
  and only for files older than a day — a file reaches the store before its row
  is written, so a sweep with no patience deletes exactly what somebody is in
  the middle of uploading.

In production the database is Neon, which keeps a point-in-time history.

1. In the Neon console, create a branch from the production branch at the
   target time (Restore → point in time). This is the restored copy; the
   original is untouched.
2. Against the branch's connection string, run
   `npx tsx infra/scripts/verify-integrity.ts`. **Chains must verify.**
3. Compare row counts on the largest tables (`jobs`, `vehicle_events`,
   `journal_lines`, `message_logs`) against the original.
4. Run `npx tsx infra/scripts/verify-recovery.ts` against the branch to get the
   two numbers and the list of what came back wrong. Write both in the incident
   record: an RPO nobody wrote down is an RPO nobody can improve.
5. Repoint `DATABASE_URL` in Vercel at the branch, redeploy, announce. Keep
   the original branch until the incident is closed.
6. Restore the object store to the same moment, then run
   `npm run storage:orphans` to see what the two now disagree about.

RTO 1 hour, RPO 5 minutes. `LEDGER_CHAIN_SALT` is not in the database and is
not restored with it; it must be the same value or step 2 fails everywhere.

## A customer asks to be erased

Do not run a delete. Follow
[security model](../02-design/05-security-model.md) section 9.

1. Confirm the request is genuine and from the data subject.
2. Run the erasure procedure, which anonymises personal identifiers and
   supersedes passport events carrying them with redacted versions.
3. **Vehicle events are retained.** The service history belongs to the vehicle,
   not the person, and the chain is append-only.
4. Photographs of components are retained. Photographs incidentally containing
   a person are reviewed and removed.
5. Record completion. Confirm within 30 days.

## Suspected credential compromise

1. Revoke the sessions:
   ```sql
   UPDATE sessions SET "revokedAt" = now()
   WHERE "userId" = $1 AND "revokedAt" IS NULL;
   ```
2. Force a password reset.
3. Read the audit log for that actor since the suspected compromise.
4. If another tenant's data may have been reached, treat as a breach and follow
   the notification procedure.

## Deployment gone wrong

1. Redeploy the previous image. Rollback is a deploy, not a migration.
2. Migrations are forward-only. If the new schema is the problem, roll forward
   with a corrective migration.
3. This is why every migration must be backward compatible with the previous
   release (NFR-309). If that rule was followed, the old image runs against the
   new schema without issue.

---

_Next: [Ways of working](../05-project/01-ways-of-working.md)._
