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

---

_Next: [Runbook](07-runbook.md)._
