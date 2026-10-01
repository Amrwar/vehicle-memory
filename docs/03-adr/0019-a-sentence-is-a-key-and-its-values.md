# ADR-0019 — A sentence is a key and its values

**Status:** Accepted, Phase 95 (30 September 2026).
**Generalises:** the `JobStanding.reason` shape introduced in Phase 84, from
one model to every library that produces prose a screen will show.

## Context

This product shows every sentence in English, French and Arabic, and the rule
that makes that possible is that English is the source of truth: the sentence
is written where it is used, and a dictionary per language answers it. Two
scripts enforce it. `i18n-scan` reads the pages for text that never passed
through `t()`, and `verify-dictionary` refuses one English sentence answered two
different ways.

Both of them read the **pages**. Neither can see a sentence that a library
builds, because a library's output does not exist until it runs.

Phase 95 put a list in front of an owner that is assembled almost entirely by a
library — eight gatherers, ten kinds of row, every row a sentence about
something that happened. Three faults turned up in it, and all three were
invisible to every check the product had, on every screen, in English.

**A sentence built out of a number.** `howTheMorningLooks` returned
`` `${total} things to deal with.` ``. The page wrapped it in `t()`, which looks
right and cannot work: no dictionary holds a key with 7 baked into it, so a
French workshop would have read one English sentence in the middle of a French
screen. The function sat three paragraphs below a comment stating the rule it
was breaking.

**A sentence inside another sentence's slot.** A job's row was
`'#{number} {vehicle}: {why}'` with `JobStanding.reason.key` passed as `{why}`.
`translate()` fills slots verbatim when it is given values, so the reason stayed
in English — and the reason carries values of its own (`{amount}`, `{count}`,
`{date}`), which were dropped on the floor. The day a reason with a slot became
the workshop's move, a reader would have been looking at the word `{amount}`.

**A date written where nobody knows who is reading.** A gatherer put
`one.on.toISOString().slice(0, 10)` into a sentence. `2026-10-14` is not how
anybody writes a date to be read, and more to the point a date formatted
anywhere but the screen is a date in one language — while the screen is the
only place that holds the reader's region.

## Decision

### 1. A library never produces a sentence. It produces a key and its values

```ts
export interface Say {
  key: string;
  vars?: Record<string, string | number>;
}
```

The key is the English sentence exactly as the dictionary holds it, with named
slots. The values are data. The **screen** translates, because the screen is
where the reader is known. Nothing between the database and the screen may
concatenate, interpolate, pluralise or format prose.

A count that changes the sentence is two keys, not one built string:
`'1 thing to deal with.'` and `'{count} things to deal with.'`.

### 2. No slot holds prose

A slot is for data: a name, a plate, a part number, a machine, a quantity, a
job type a workshop typed in itself. Never a sentence that was meant to be
translated somewhere else.

Where a row needs both an identity and a sentence, they are separate fields —
`subject` and `what` — and the screen places them. A job number and a
registration are data; no language changes them.

### 3. No date, time, money or number is formatted below the screen

They travel as `Date` and as values. The screen has the region and the reader's
language; a library has a guess. Where core must put a date inside a sentence
it cannot avoid, it writes it in English long form so that the translator's
calendar-word substitution can localise the month — and that is the exception,
documented where it happens, not the habit.

### 4. Every library that says anything carries a check that reads its own source

`i18n-scan` cannot see these keys, so the phase check does: it reads the
`key: '...'` literals out of the library's source and looks each one up in the
dictionary as the product merges it, and it asserts that no value in any row
contains an unfilled slot or ends in a full stop — the two marks that separate
prose from data.

That check found two actions with no French or Arabic at all, on a screen where
every page-level scan reported zero missing.

## Consequences

A library's prose is now as checkable as a page's, and the check is specific to
the library rather than global — which is the right shape, because what counts
as data differs by library.

The cost is a little ceremony: a row that wants to say two things says them in
two fields. Phase 84 paid that cost first for `JobStanding.reason` and it has
not been regretted; this records it as the rule rather than one model's habit.

What this does not fix is a sentence a library says that no row ever produces.
`verify-morning` asks the inverse question — every declared kind must be one
some gatherer reaches — because a sentence nothing can say is the dead rule of
[ADR-0017](0017-the-confidence-is-the-evidence.md) in another costume.
