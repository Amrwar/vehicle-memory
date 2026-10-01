# ADR-0020 — A close is testimony, not a total

**Status:** Accepted, Phase 96 (1 October 2026).
**Narrows:** [ADR-0011](0011-derived-totals.md), which says totals are derived
and never stored. This is the one exception, and the boundary is stated here so
it stays one.

## Context

Item 37 of the thirty-nine: an end-of-day close, covering unpaid invoices, open
jobs, vehicles still on site, keys, estimates, parts, cash, reconciliation,
clocks and follow-ups.

Every one of those ten is a question the product can already answer. It knows
the till was never counted, that somebody is still clocked on, that two sets of
keys are in a pocket, that four cars are on the forecourt. Nothing in the phase
is a new fact about a workshop.

What the product could not say is **whether anybody looked, and what they saw**.

That is a fact about an act rather than about the workshop, and it is the only
thing the close adds. Which forces a decision the rest of the product has never
had to make, because the rest of the product is about the present and this is
about a moment that has passed.

ADR-0011 is unambiguous and has held for ninety-five phases: balances,
verdicts, totals and statuses are computed from the entries beneath them, so
two screens cannot disagree. A stored total is a total that drifts from the
thing it totals, and the day it drifts is the day nobody can tell which is
right.

Apply that here and the close would hold ten foreign keys and recompute its
figures on every read. It would look identical on the evening it was taken.

It would also be worthless.

## Decision

### 1. A close stores the figures as they stood

An invoice paid at twenty to seven must not change what was true at four
minutes past. A derived close would say something different every time it was
read, and would therefore be evidence of nothing — while still looking exactly
like evidence, which is the dangerous part. A workshop asked in March what
happened on the night of 1 October would be shown a reconstruction of March.

So `day_close_readings` holds a count per reading, copied in at the moment of
the close. Ten rows, one per reading, every time.

The nearest thing to it already in the product is a passport entry: also about
a moment, also append-only, also meaningless if it could be recomputed. This is
the same shape for the same reason.

### 2. Nothing may edit one, including the note

Two triggers refuse `UPDATE` and `DELETE`, exactly as `audit_logs` has done
since Phase 0.9. A record somebody can go back and tidy is a record of what
they wished had been true.

There is deliberately no exception for the free-text note. A close written in
haste with the wrong note is a close with the wrong note, and the honest remedy
is that tomorrow's close says so — not that last night's quietly becomes
something else.

### 3. The judgement is stored alongside the figure

`leftOvernight` is stored per reading rather than derived from the kind,
although today it is a pure function of it. If a later phase decides that a car
left on site overnight is worth waking somebody for, every close ever taken
would silently change its mind about nights nobody can revisit. What the
workshop was told at the time is part of what happened.

### 4. The close changes nothing it reads

It does not invoice a job, write off an invoice, clock anybody out or move a
penny. Every row links to the page where the thing is actually done.

This is the rule that keeps the record honest. A close that could tidy would be
used to tidy, and then the record of what was outstanding would become a record
of what somebody made disappear — which is worse than no record, because it
reads like one. `verify-close` counts all ten readings before and after a close
and fails if any of them moved.

### 5. A close never refuses

A workshop at six with three cars on the forecourt locks up anyway. The close
records what was left rather than arguing about it; a screen that blocked would
be worked around by not opening it, and then there would be no record at all.

The one thing it does refuse is a **second** close for the same site and day,
because two closes make the record ambiguous in the worst way — a reader cannot
tell which was the day's real state. The refusal names who closed it and when.

## Consequences

The exception is now stated, which is most of the point of writing it down.
ADR-0011 applies to everything that describes the present. A record whose
subject is a past moment — a passport entry, an audit log, a close — stores
what it saw, and must then be immutable, because a stored figure that can be
edited has the drift problem of ADR-0011 _and_ the dishonesty problem on top.

That is the test for any future table that wants this exemption: it must be
about a moment rather than a state, and it must be append-only. A table that
wants to store derived figures and still be editable is asking for the worst of
both and should be refused.

The cost is that the close cannot be corrected. This was argued both ways and
settled on the side of the record: a correctable testimony is not testimony,
and the workshop keeps the ability to say anything it likes about last night in
tonight's note — where it will be dated, attributed, and visibly a second
statement rather than a quiet replacement of the first.
