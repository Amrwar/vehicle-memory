# ADR-0017 — The confidence is the evidence

**Status:** Accepted, Phase 87 (29 September 2026).
**Extends:** [ADR-0016](0016-the-corpus-not-the-guess.md) to parts.

## Context

Item 5 of the thirty-nine asks for two things: supplier comparison on price,
stock, delivery and warranty, and "substitution with fitment confidence and an
explicit confirmation".

Both have an obvious implementation that is wrong.

**Comparison** is obviously a sorted list, cheapest first. That is the version
every parts catalogue ships and it is the version that orders a brake disc four
pounds cheaper which arrives the day after the car was promised — costing a
courtesy car, an apology and an afternoon. The four pounds were never the
number.

**Confidence** is obviously a percentage. "87% match" is easy to compute from
string similarity and category overlap, it looks authoritative, and it is
invented. A workshop cannot check it, cannot argue with it, and cannot tell
87% from 62% in any way that changes what they do. ADR-0016 refused exactly
this shape of answer for diagnosis, in the user's words: _"That is much safer
than pretending an LLM can diagnose cars."_ Parts are the same argument with a
sharper edge — a wrong suggestion here does not mislead a technician, it goes
onto the car.

## Decision

### 1. The comparison is four columns and a named trade-off

Price, stock, delivery and warranty, because those are the four questions a
buyer asks. The ranking puts arrival first — in time, then unknown, then too
late — and price second, so a cheaper offer that cannot make the date is never
the recommendation.

**And the recommendation carries the argument against it.** Where a cheaper
offer was passed over, the screen names the supplier, the saving to the penny,
and what was wrong with it. A screen that picks the dearer supplier and hides
why gets overruled the first time somebody notices, and then is never trusted
again.

Arrival is the only three-state field: in time, too late, or nobody has said.
An unknown lead time is never treated as "in time" — silence read as approval
is how the wrong thing gets ordered, and the same rule already governs fitment.

### 2. A price is dated, and an old one is marked

Ninety days. Trade prices move about that often, so most of a workshop's list
will be marked old most of the time, which is the point: the alternative is a
two-year-old price shown with the confidence of today's, and a customer quoted
a figure the workshop cannot buy at.

Saving the row _is_ the confirmation. Nothing else moves `confirmedAt`, so
tidying a note cannot quietly make an old price look current.

### 3. What they say, beside what they have done

Phase 52 has measured every supplier's deliveries against the day they
promised. Phase 87 puts that number next to the promise, and says so when they
disagree: a next-day quote from a supplier who keeps it two thirds of the time
is not a next-day quote. Below the minimum number of orders there is no
verdict at all — three late deliveries out of four is a bad month, not a
pattern.

### 4. The confidence is the evidence, and there is no score

Six things can be true about a candidate part, every one of them a record this
database already holds — and they divide into two kinds, which is the whole of
this decision:

| Evidence               | What it means                                  | Kind          |
| ---------------------- | ---------------------------------------------- | ------------- |
| `SUBSTITUTED_BEFORE`   | we have made this exact swap, and confirmed it | qualifying    |
| `SAME_PART_NUMBER`     | a supplier lists both under one number         | qualifying    |
| `FITTED_TO_THIS_CAR`   | we put this part on this exact car             | corroboration |
| `FITTED_TO_THIS_MODEL` | we put it on another car of the same model     | corroboration |
| `RECORDED_HERE`        | somebody here typed a fitment, car on the ramp | corroboration |
| `CATALOGUE`            | a feed says it fits                            | corroboration |

**Only a qualifying kind may put a part on the screen.** The first draft of
this decision did not make the distinction, and the screen built from it
offered a brake _disc_ as an alternative to brake _pads_: both in the braking
category, both fitting the car, both carrying fitment rows. It took one look
at a real page to see it, and it is exactly the failure this ADR exists to
prevent, shipped by the ADR.

The reason is one sentence. **Fitting the same car is not a claim that two
parts interchange.** Only two records make that claim: somebody here already
fitted this one in place of that one and confirmed it, or a supplier lists
both under one number. Everything else is worth showing beside a candidate
that already qualifies — never a reason to list one.

`SUBSTITUTED_BEFORE` is deliberately the strongest, and it is how the list
grows. A workshop that confirms one substitution has taught the product
something permanent about those two parts, the same way ADR-0016's diagnosis
corpus is built out of verdicts technicians were making anyway.

**A candidate with no qualifying evidence is not shown.** Not shown last, not
greyed out: not shown. "No evidence" is not a weak recommendation, it is the
absence of one, and a list that includes it teaches people to scroll past the
reasoning to the names.

`SAME_PART_NUMBER` means a _supplier's_ number, and the distinction is load-
bearing: `products` is unique on (org, partNumber), so two of a workshop's own
products can never share one and the obvious reading of that rule could never
have fired at all. Read the useful way it is one of the better signals there
is — a factor listing the OE disc and the aftermarket disc on one line is a
factor saying they interchange, with their own money behind it.

### 5. Nothing substitutes itself, and the database agrees

A different part may go on a customer's car; that is ordinary. What is not
ordinary is it happening silently, or by the system's decision.

So a substitution exists only together with the evidence it was made on and
the moment somebody confirmed it. `job_part_lines_substitution_is_confirmed`
refuses any two of the three without the third, so no code path — and no
script — can leave it half-written. The evidence is recomputed from the records
when the confirmation is made, never taken from the form: a hidden field saying
"we fitted this to this car before" is a claim whoever posts the form can make
about any part at all.

The person is deliberately outside the constraint. A user row can be erased
under the retention rules, and a confirmation that vanished with somebody
leaving the company would take the substitution record with it.

## Consequences

- Two suppliers on one part is the minimum useful state, and a workshop with
  one supplier priced sees a list of one and a prompt. That is honest.
- The list is typed by the workshop. No feed is assumed, and none is required.
- A substitution changes the part, the number, the cost and the price on the
  line, so the invoice shows what actually went on the car — with "fitted in
  place of …" beside it wherever the line is read.
- `verify-sourcing.ts` checks the properties that decide whether either
  feature is worth having, including that the constraint refusing a
  half-written substitution is the one actually doing the refusing. On the
  first run it was not: a different constraint tripped first and the check
  passed without exercising the one it named.
