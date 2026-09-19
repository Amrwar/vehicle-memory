# Observability

## 1. Logs

Structured JSON, one line per event, with a correlation id threaded through the
request and into any background job it enqueues.

```json
{
  "level": "info",
  "time": "2026-09-09T15:30:00.000Z",
  "correlationId": "req_01J...",
  "orgId": "org_ck7...",
  "userId": "usr_ck7...",
  "event": "job.status.changed",
  "jobId": "job_ck7...",
  "from": "ESTIMATED",
  "to": "AWAITING_APPROVAL",
  "durationMs": 42
}
```

**Never logged** (NFR-802): passwords, session tokens, share tokens, payment
details, or whole personal records. Identifiers, not contents.

## 2. Metrics

Technical:

| Metric                                    | Alert                     |
| ----------------------------------------- | ------------------------- |
| Request rate, error rate, p95/p99 latency | Error rate > 1% for 5 min |
| Database connection pool usage            | > 80% for 5 min           |
| Query duration p95                        | > 100ms sustained         |
| Outbox queue depth                        | > 100 for 10 min          |
| Outbox oldest unprocessed age             | > 5 min                   |

Business — these are the ones that tell you whether the product is working:

| Metric                                    | Why it matters                                        |
| ----------------------------------------- | ----------------------------------------------------- |
| Jobs created per workshop per day         | Hypothesis H1. A drop means adoption is failing.      |
| Inspections completed per job             | **Hypothesis H2, the load-bearing one.**              |
| Median inspection duration                | H2. Rising means the interface is getting in the way. |
| Estimates approved via link               | Hypothesis H3.                                        |
| Median send-to-decision time              | H3.                                                   |
| Passport events written per completed job | Coverage, the long-term asset.                        |
| Chain verification failures               | Should be zero. Anything else is an incident.         |

The business metrics are alerted on trend, not threshold. A gradual decline in
inspection completion is the early signal that H2 is failing, and it will not
trip a fixed threshold until it is too late to respond cheaply.

## 3. Tracing

Every request carries a trace id, propagated into background jobs so a passport
event can be traced back to the job completion that caused it. Spans cover the
request, each database query, each external call, and each outbox dispatch.

## 4. Alerting

Every alert has a runbook entry. **An alert with no action is deleted**
(NFR-807) — alert fatigue is caused by alerts nobody can act on, and the fix is
removal, not tuning.

That was the intention from the first week. Until Phase 57 nothing sent an
alert at all, so the rule had nothing to bite on, and Phase 56 had to write it
down as a requirement enforced by nothing.

It now bites in the strongest available way: a signal with no entry in
`packages/core/src/health/alerts.ts` **cannot** become a message. It is
reported as needing one and `npm run verify:alerts` fails until somebody writes
it. Deletion was never the useful half of NFR-807 — the useful half is that the
thing cannot exist unsent-and-unexplained in the first place.

**How it behaves.** `sweepAlerts()` runs on the hourly job rather than on a
schedule of its own, because a second schedule is a second thing that can stop
without being noticed. A raised alert repeats no more than every six hours; a
signal that gets worse sends immediately, because degraded and failed are
different news; a recovery is announced once, and only where the alarm was.
An alert is recorded as sent only when a message actually left, so a mailbox
that was unreachable does not start the quiet period on silence.

**What the message carries.** What it means, the first thing to do, and what it
would mean to have fixed it — in that order, so somebody reading on a telephone
can act on the first three lines. The same three lines appear beside the signal
on `/admin/health`, which is what keeps the page and the mailbox from telling
two different stories.

| Severity       | Response         | Examples                                                           |
| -------------- | ---------------- | ------------------------------------------------------------------ |
| Critical, page | Immediate        | Application down, database unreachable, chain verification failure |
| High, notify   | Within 1 hour    | Error rate elevated, queue backing up, backup failed               |
| Medium, ticket | Next working day | Latency drift, dependency vulnerability                            |

## 5. SLOs

| Service level                         | Objective | Window  |
| ------------------------------------- | --------- | ------- |
| Workshop availability, business hours | 99.9%     | 30 days |
| Public passport availability          | 99.5%     | 30 days |
| Read latency p95                      | < 200ms   | 30 days |
| Job completion to passport event      | < 60s p95 | 30 days |

Error budget: at 50% consumed, feature work pauses for reliability work. Stated
in advance so it is a policy rather than an argument during an incident.

## 6. The page (Phase 50)

Everything above is for a machine to read. `/admin/health` is for a person, and
it is deliberately a different thing rather than a rendering of the same
metrics: a dashboard answers "what are the numbers", and an incident starts
with "what is wrong and what do I do".

Twenty-two things across six panels — the system, the background work, the
services outside this building, whether the records still mean anything, who
can get in, and whether it could come back. Worst first, with what needs acting
on separated from what is only worth reading.

### Four standings, not two

| Standing        | Means                                           | Response                |
| --------------- | ----------------------------------------------- | ----------------------- |
| **Working**     | Exercised recently and did what it should       | Nothing                 |
| **Struggling**  | Working, with failures or a backlog beside it   | Watch, then investigate |
| **Not working** | Failing now                                     | An incident             |
| **Never used**  | Configured or not, but never actually exercised | Nobody is woken         |

"Up or down" is the distinction that makes a status page useless, because
almost nothing is down. **Never used** is the one people leave out and the one
that lies least: a mail transport set to `console` is not broken and is not
working, and a green tick beside it is how a product ends up confidently
broken. On its first run this page reported seven things as never used, all of
them correctly.

The overall standing is as bad as its worst part, never an average. Nine
healthy things and one failed one is a failure; a page reporting ninety per
cent is a page that gets ignored on the day it matters.

### Why a message did not arrive

The one question a workshop actually rings about, and the reason this page
exists. The answer had always existed and was spread across five places — a
status, an attempt count, a provider's error, a suppression list, a consent
flag — none of which mean anything alone to the person asking. It is now one
search box and one sentence, and the sentence names the next move: "FAILED" is
not an answer.

The order of the reasoning matters and is not the order the columns are in:

1. **Consent** — somebody who asked not to be written to has not got a delivery
   problem. They have exactly what they asked for, and the one thing nobody
   should do about it is retry.
2. **Suppression** — a blocked address beats the status, because a suppressed
   message was never attempted and its status has nothing to say about why.
3. **Status**, and within the queue: **held** against **stuck**. `availableAt`
   carries the retry backoff and the quiet-hours hold in one value,
   deliberately, because from the sender's side they are the same instruction.
   A message waiting until nine in the morning is the product working; a
   message due ten minutes ago and still there means the sender is not running,
   and the page says which.

### Who it is for

The operator, and nobody else. Every figure on it spans every workshop at once
— the one view the rest of this product spends its time making impossible — so
it is gated on being the person whose address is `OPERATOR_EMAIL` rather than
on a permission, which a workshop owner has plenty of. It answers not found
rather than forbidden: an owner who finds it should not learn that it exists.

With no `OPERATOR_EMAIL` set, nobody can open it. That is correct and it is
also a trap for anybody testing it: `next dev` reads `apps/web/.env` while the
scripts read the root `.env`, so setting it in one place leaves the other
refusing everybody.

---

_Next: [Runbook](07-runbook.md)._
