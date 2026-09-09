# ADR-0007: Transactional outbox for cross-context events

**Status:** Accepted
**Date:** 2026-09-09

## Context

Completing a job must write passport events, consume stock reservations, post
ledger entries and notify the customer. Those touch four bounded contexts.

The naive implementation does all of it in one transaction. The failure mode is
severe: the passport write fails, and a job the technician has physically
finished cannot be marked complete. The workshop's day stops because a
downstream concern failed.

The opposite naive implementation fires the side effects after commit. Then a
crash between commit and dispatch loses the event silently, and a vehicle's
history is permanently missing a service that happened.

## Decision

A transactional outbox. The domain event is written to `outbox_events` in the
**same transaction** as the state change. A background worker polls, dispatches
and marks processed, with exponential backoff on failure.

This gives at-least-once delivery, so **every handler must be idempotent**. The
passport writer achieves this with an idempotency key derived from the cause
(`job:<id>:part:<lineId>`), which is unique per fact rather than per attempt.

The one exception is the ledger append itself, which is synchronous within the
job-completion transaction where it can be, because a passport event arriving
ninety seconds late is fine but arriving twice is not — and the idempotency key
makes the retry safe either way.

## Alternatives considered

| Option                                      | Why not                                                                                                                                                                                                                                                     |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Everything in one transaction**           | Couples the workshop's ability to close a job to the availability of every downstream concern.                                                                                                                                                              |
| **Fire-and-forget after commit**            | Silently loses events on crash. For a ledger that claims completeness, this is disqualifying.                                                                                                                                                               |
| **A message broker (Kafka, RabbitMQ, SQS)** | Correct at scale, and where this goes if volume demands it. Rejected now because it introduces a second durable store that can disagree with the database, plus operational burden, for a system handling thousands of events per day rather than millions. |
| **Database LISTEN/NOTIFY**                  | Not durable. A disconnected listener misses events.                                                                                                                                                                                                         |

## Consequences

- No event is lost, and no downstream failure blocks the shop floor.
- Every handler must be idempotent, which is a real constraint on how handlers
  are written and is tested explicitly.
- Delivery is eventually consistent, so the interface must not promise
  otherwise: "recording to history" rather than "recorded".
- Polling adds latency measured in seconds and a small constant database load.
  Acceptable at this scale; revisit at ten times the volume.
