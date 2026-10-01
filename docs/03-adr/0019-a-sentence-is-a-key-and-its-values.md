# ADR-0019 — A sentence is a key and its values

**Status:** Accepted, Phase 95 (30 September 2026). Amended in Phase 96 (1 October 2026) — see Consequences.
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
`` `${total} things to deal with.` `` and the page wrapped it in `t()`. A French
workshop read one English sentence in the middle of a French screen.

The reason is narrower than it first looks, and the first draft of this ADR got
it wrong, so it is worth stating precisely. The translator has a second route:
`translateFinished` reads a finished English sentence back into the slots of a
key that has them, so `translate('fr', '3 statement lines still unmatched.')`
really does return « 3 lignes de relevé encore non rapprochées. » A built
sentence is therefore **not** untranslatable. It is translatable **only if
somebody remembered to put the slotted key in a dictionary** — and nothing can
make them remember, because `i18n-scan` reads the pages and a library's
sentence does not exist until the library runs. There is no gate. The sentence
falls back to English and the fallback is silent.

So the rule below is about what can be checked, not about what is possible.
`banking/reconcile.ts#closeChecks` builds its `detail` strings this way, has
done since Phase 29, has its slotted keys in the money dictionary, and is
correct. It is not to be rewritten on the strength of this ADR.

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
where the reader is known.

The point is not that the finished-sentence route fails — it works. The point
is that a key is a thing a check can hold in its hand. A `Say` can be read out
of a library's source, looked up in the merged dictionary, and reported missing
before anybody ships it; a sentence assembled at run time cannot be, and the
cost of forgetting one is a reader quietly seeing the wrong language.

Where a library already builds finished sentences and its keys are answered,
that is not a defect to go and fix. New prose uses `Say`.

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

This decision was amended the day after it was accepted. As first written it
said a built sentence "cannot work", which is not true and would have had
somebody rewrite `closeChecks` to satisfy it. The amendment is recorded here
rather than silently edited, because an ADR that quietly changes its reasoning
is worth less than one that shows where it was wrong.

The cost is a little ceremony: a row that wants to say two things says them in
two fields. Phase 84 paid that cost first for `JobStanding.reason` and it has
not been regretted; this records it as the rule rather than one model's habit.

What this does not fix is a sentence a library says that no row ever produces.
`verify-morning` asks the inverse question — every declared kind must be one
some gatherer reaches — because a sentence nothing can say is the dead rule of
[ADR-0017](0017-the-confidence-is-the-evidence.md) in another costume.
