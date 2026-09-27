# ADR-0016 — The corpus, not the guess

**Status:** Accepted, Phase 81 (27 September 2026).
**Amends:** [ADR-0013](0013-generated-text-inside-the-workflow.md) point 4.

## Context

ADR-0013 point 4 refused to build fault suggestion, and gave the reason:

> A service adviser that proposes where to look needs a corpus of symptoms
> against confirmed causes. That corpus does not exist yet, and a confident
> wrong suggestion on a braking fault is not a small error. The interface says
> so rather than pretending.

Every word of that is still true. What it did not say is what to do about it,
and the answer sat unexamined for thirty-six phases as a single line on the
feature map: **Deferred**.

The missing corpus is not a thing to be bought or licensed. It is a thing a
workshop produces every day and throws away: a car arrives with a complaint, a
technician considers three or four things it might be, rules each in or out,
and fixes it. The complaint, the candidates and the verdicts are the corpus.
Carnet was recording the fix and discarding the reasoning.

## Decision

Record the reasoning, and report it back as a count.

1. **A controlled vocabulary.** A workshop keeps its own list of complaints and,
   under each, the causes that have explained it. "Brake judder", "judder on
   braking" and "vibrates when I stop" are one complaint written three ways,
   and counted separately they teach nothing.

2. **A diagnosis rules on every candidate.** Opening one against a job lists
   every cause under that complaint, undecided. The technician marks each
   **confirmed**, **ruled out** or **not determined**. A diagnosis counts for
   nothing until all of them have an answer.

3. **"Not determined" is an answer.** A corpus that only ever hears about the
   causes somebody found will recommend the last thing that worked, for ever.

4. **The product reports, it does not predict.** The strongest sentence it will
   say is _"In this workshop, 35 jobs that began with 'brake pedal vibration'
   reached a verdict. These are what they turned out to be."_ Every number is a
   count of jobs somebody finished and signed off, in the workshop reading it,
   traceable to those jobs. No likelihood for the car on the ramp is stated,
   because none is known.

5. **Silence below the line.** A cause confirmed fewer than three times is not
   shown, and neither is one never confirmed. Under that, a count is an
   anecdote, and an anecdote beside a brake fault reads as advice. The screen
   says it does not know yet, which is true and is the only safe thing to say.

6. **A confirmation never appears without its refusals.** Confirmed three times
   out of twelve and confirmed three times out of three are different facts.

7. **The candidates are never ordered by the evidence.** The list a technician
   rules on is in the catalogue's order. A list sorted by what the workshop
   usually finds tells somebody what to find, and a corpus built from led
   answers confirms itself for ever. The history sits underneath, plainly about
   other cars.

8. **A job is never evidence for itself.** The verdict entered on this job is
   left out of the counts shown beside it.

9. **The corpus is the workshop's own.** What the garage down the road found is
   not evidence here. This is a tenancy rule and also an honesty one: the claim
   is "in this workshop", and it has to be true.

10. **No model is involved, at any point.**

## Alternatives considered

| Option                                 | Why not                                                                                                                                                                              |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A model over the job history           | It would answer fluently for the symptom seen twice as readily as the one seen two hundred times, and the failure is invisible until it is expensive. The whole of ADR-0013 applies. |
| A bought fault database                | It describes cars in general, not the vehicles this workshop sees, the parts it fits or the climate it works in. And it cannot be checked against anything the workshop holds.       |
| Free-text diagnosis, mined later       | It is what exists today. Three spellings of one complaint aggregate to nothing, and a corpus cannot be recovered from prose after the fact.                                          |
| Showing everything, with counts        | A cause seen once, shown, is advice. The threshold is the difference between a record and a suggestion.                                                                              |
| Ranking the candidate list by evidence | It teaches the corpus to agree with itself. This was the hardest one to give up, because it is what every product of this kind does.                                                 |

## Consequences

- Four tables, and the one that matters is `diagnosis_causes`: one row per cause
  considered on one job, with the verdict, who reached it and when. A verdict
  without a person and a time is refused by the database.
- A symptom or cause somebody has ruled on cannot be deleted, only retired.
  Deleting it would not remove the history; it would remove the word for it,
  leaving counts nobody can read.
- The corpus cannot be larger than the work. A workshop that has done six jobs
  knows what six jobs taught it, and every screen says so. This is the honest
  cost of the decision and it is not a defect.
- `verify-knowledge.ts` checks the five properties above that can be checked —
  the threshold, the never-confirmed, the paired counts, the self-evidence, and
  the workshop boundary — because each is a way this feature could quietly
  become the thing ADR-0013 refused.
- The feature map's one **Deferred** is closed. What replaces it is smaller than
  what was originally asked for, and true.
