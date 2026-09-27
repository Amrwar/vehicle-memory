# ADR-0013: Generated text inside the workflow, never as the product

**Status:** Accepted
**Date:** 2026-09-12

## Context

Phase 17 asks for an owner command centre and for "AI" in the product. Both
invite the same mistake: putting a model between the person and the record, so
that what they read is the model's account of the data rather than the data.

The records this product holds are the ones a workshop is held to. An invoice
total, a part number, a torque figure in an inspection note, a statement that a
brake pad was replaced. A sentence about any of these that is not traceable to
the record is a liability wearing the product's name.

## Decision

1. **Questions are routed, not interpreted.** The command centre recognises a
   closed vocabulary of questions and maps each to a calculation the product
   already trusts. Every answer shows its working and links to the page that
   computes the same figure. A question outside the vocabulary is refused with
   the list of what can be asked. No model is involved.

2. **Observations are arithmetic with a sentence around it.** Revenue against
   the previous period, margin, the share of the largest kind of work. A
   comparison is only stated when both sides are large enough to mean
   something. No model is involved.

3. **A model may restate, never add.** The one place a model is used, the job
   summary written for the customer, starts from a plain summary composed from
   the record. The model is asked to make it read better. Its output is then
   checked: every number and part number must appear in the record, or the
   plain summary is used and the reason is shown to the staff member. With no
   model configured the plain summary is the feature, complete.

4. **Suggestion on faults is not built.** A service adviser that proposes where
   to look needs a corpus of symptoms against confirmed causes. That corpus does
   not exist yet, and a confident wrong suggestion on a braking fault is not a
   small error. The interface says so rather than pretending.

   > **Amended by [ADR-0016](0016-the-corpus-not-the-guess.md), Phase 81.** The
   > reason above still holds and nothing in it is withdrawn. What changed is
   > the answer to it: the corpus is built, out of what technicians record
   > about cars they had in front of them, and the product reports counts from
   > it rather than proposing anything. Point 5 below is unaffected — nothing
   > generated, and nothing counted, decides anything.

5. **Nothing generated decides anything.** No status changes, no posting, no
   message goes out because a model said so.

## Alternatives considered

| Option                                               | Why not                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A model that answers free-text questions from the DB | It answers questions the data cannot support, fluently. The failure is indistinguishable from success until it is costly. |
| A model generating the summary from raw job data     | It adds facts. Every test run did. Restating a plain summary and verifying is the only shape where a slip is caught.      |
| No generated text at all                             | The plain summary is fine. The polished one is better for the customer and costs nothing when the check passes.           |

## Consequences

- `parseQuestion()` is a list of regular expressions, and grows by adding a
  line and a calculation. That is the intended shape: adding a question means
  deciding the product can answer it.
- `verifyAgainstFacts()` is the gate on every model output. It is tested on
  its own, and a model that fails it is refused silently for the customer and
  loudly for the staff member.
- The model is configured as `AI_TRANSPORT=anthropic` with `ANTHROPIC_API_KEY`
  and defaults to `none`. Production runs on `none` until somebody decides
  otherwise.

## Addendum, Phase 22

The assistant built in Phase 22 stays inside this decision. It adds two uses
of generated text, a job read back to staff and a drafted message to a
customer, and both are composed from the record by code, with a model allowed
only to tidy the prose and its version checked against the same facts. It
adds accountability the decision implied but did not spell out: every exchange
is recorded with who asked, what kind it was, the words shown and the tokens
used, and each organisation sets a monthly token budget that, when spent,
returns the assistant to the plain text rather than refusing. Sending a draft
is a person's press. Fault suggestion remains unbuilt.
