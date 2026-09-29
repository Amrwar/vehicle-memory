# ADR-0018 — A blank is a blank

**Status:** Accepted, Phase 88 (29 September 2026).
**Extends:** [ADR-0017](0017-the-confidence-is-the-evidence.md) from parts to
the car itself.

## Context

Item 6 of the thirty-nine: "VIN to a specification sheet. Engine, oil grade and
capacity, coolant, brakes, tyre sizes and pressures, battery, filters,
intervals."

Fourteen numbers a technician needs before touching a car, every one of them in
a handbook somebody is not holding. The cost of getting one wrong runs from a
warning light to a seized engine.

The obvious implementation buys a universal specification database. Three
things rule it out. There is no good cheap one. The good ones are licensed per
lookup, which puts a meter on a screen a workshop opens forty times a day. And
the one that decides it: **a wrong oil grade is an engine.** A bought database
that is right about ninety-eight per cent of models is a database that is
confidently wrong about the other two, and the workshop cannot tell which is
which by looking.

## Decision

### 1. The sheet is the workshop's own, and it is written once per model

Not once per car. A sheet is keyed by make, model, a year range and an engine
code — which is exactly what Phase 43's VIN decoder produces when a car is
added. So a workshop writes fourteen numbers once for a model it sees weekly,
and every car that decodes to it arrives holding them.

**That inheritance is what "VIN to a specification sheet" turns out to mean**
once you refuse to invent anything. Nobody types a spec per car and nobody buys
a database.

A car may also carry its own sheet, which overrides the model's. That exists
for the retrofitted engine, the non-standard tyres, the owner who wants a
heavier oil after a track day — facts about one vehicle that must not leak onto
every other car of the model.

### 2. A blank is a blank

A line nobody has answered is **absent**. It is not defaulted, not inferred
from a similar model, and not shown as a dash that could be read as "none".

The reasoning is one sentence, and it is the name of this decision: **a blank
sends somebody to look it up, and a wrong number does not.** A technician who
sees an empty oil-grade line opens the handbook. A technician who sees 5W-30
fills the engine.

So the screen shows how much of the sheet is filled in as a count — "four of
fourteen" — and never as a percentage with a colour, because a percentage reads
as a score a workshop is failing rather than as a fact about what is known.

### 3. Every line says where it came from, and a disagreement is shown

Three sources, most specific first: this car, the model sheet, a feed. Where
two of them say different things, **both are shown and the screen says plainly
that they disagree**.

This is the single most useful thing the sheet can carry. Two sources
disagreeing about an oil grade means one of them is wrong about an engine, and
somebody should find out which before the drain plug comes out. A sheet that
silently picked the more specific one would be hiding exactly the fact worth
surfacing.

### 4. A figure that is not a figure is refused, never defaulted to nought

`coerceSpec` takes what a form sent and turns it into what the column holds:
`6,5` and `6.5` are the same answer, `12.4` months is rounded, and `about 5`
is **refused**.

Nought is deliberately never the fallback, because nought bar is a real tyre
pressure and a real thing to be wrong about. A typo that becomes a zero is a
wrong number wearing the clothes of an answer.

### 5. Nothing is parsed out of a product name

Two blocks sit beside the sheet, both read off records the database has held
for years: the parts a `PartFitment` row says belong on the car, and what has
actually gone into it on past jobs.

Neither is merged into the sheet. Reading "0W-20" out of a product called
"Engine oil 0W-20, 5L" means writing a parser against a name a person typed,
and a parser that is wrong once has put the wrong oil in an engine. Shown
verbatim with its job and date, the line claims nothing — and still lets a
technician see for themselves that the sheet and the last service disagree.

### 6. The database refuses the sheets that would be silently useless

- `vehicle_specifications_is_a_car_or_a_model` — a sheet is for one car or for
  a model, never both and never neither. A model sheet with no make would match
  every car ever built.
- `vehicle_specifications_years_run_forwards` — years the wrong way round match
  nothing. A sheet that exists, looks filled in and never applies is the worst
  kind of wrong, because nobody goes looking for it.
- `vehicle_specifications_figures_are_possible` — no engine takes nought litres
  of oil, and no service interval is seven kilometres.

## Consequences

- A new workshop sees an empty sheet and a prompt, which is honest. The feature
  earns its keep on the second car of a model, not the first.
- `feedName` and `fetchedAt` exist from the first migration so a specification
  provider can be wired in later without one, exactly as the fitment feed was.
  Nothing writes them today.
- The intervals feed `ServiceSchedule`, which has carried `intervalMonths` and
  `intervalKm` per car since Phase 1 and until now was typed per car, from
  memory, for every car of a model a workshop services weekly.
- `verify-specification.ts` writes all fourteen lines and reads them back,
  because the single cast in `lib/specification.ts` is only honest if the
  columns really hold what the rules coerced them to. Two faults surfaced
  writing it: a probe that wrote 7 into every numeric line and tripped the
  interval constraint — the check was wrong, not the constraint — and an
  assertion that a car with nothing fitted should show something.
