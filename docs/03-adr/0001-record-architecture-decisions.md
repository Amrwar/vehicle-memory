# ADR-0001: Record architecture decisions

**Status:** Accepted
**Date:** 2026-09-09

## Context

This system has a small number of decisions that are expensive to reverse: how
tenancy is enforced, whether the vehicle is global, how the passport resists
tampering, and how operational events reach the ledger. Six months from now
somebody will look at one of them and ask why it is like that.

Without a record, that question gets answered by guessing, and the usual
outcome is that a load-bearing decision gets undone by somebody who did not
know it was load-bearing.

## Decision

Every architectural decision of consequence is recorded here as a numbered
Architecture Decision Record, before it is implemented.

Each ADR states the context, the decision, the options that were rejected and
why, and the consequences we are accepting. A record is immutable once
accepted: a later change supersedes it with a new ADR rather than editing the
old one, so the reasoning at the time remains legible.

Format: title, status, date, context, decision, alternatives considered,
consequences. Statuses are Proposed, Accepted, Superseded by ADR-nnnn, or
Deprecated.

## What this excludes

Not everything is an ADR. Library choices, naming conventions and code layout
belong in [coding standards](../04-engineering/02-coding-standards.md). The
test for an ADR is: would reversing this require changing more than one module,
or migrating data?

## Consequences

- A decision costs fifteen minutes of writing before it costs a week of
  rework.
- The record explains rejected options, which is the part people actually need
  and the part usually lost.
- ADRs go stale if not superseded honestly. The review checklist includes
  asking whether a change contradicts an accepted ADR.
