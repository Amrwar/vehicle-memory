# Runbook

Procedures for the things that actually break. Each entry is written to be
followed at 3am by somebody who did not build the system.

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

Tested on every push, not quarterly (NFR-306): `npm run verify:backup` dumps
the seeded database, restores it into a fresh one and checks every row and
every chain came back. Untested backups are not backups, and this one is
tested more often than anybody would remember to.

In production the database is Neon, which keeps a point-in-time history.

1. In the Neon console, create a branch from the production branch at the
   target time (Restore → point in time). This is the restored copy; the
   original is untouched.
2. Against the branch's connection string, run
   `npx tsx infra/scripts/verify-integrity.ts`. **Chains must verify.**
3. Compare row counts on the largest tables (`jobs`, `vehicle_events`,
   `journal_lines`, `message_logs`) against the original.
4. Repoint `DATABASE_URL` in Vercel at the branch, redeploy, announce. Keep
   the original branch until the incident is closed.

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
