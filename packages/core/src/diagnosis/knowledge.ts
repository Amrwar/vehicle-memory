/**
 * What the workshop has learned, counted rather than guessed.
 *
 * ADR-0013 point 4 said fault suggestion was not built, and gave the reason:
 * "a service adviser that proposes where to look needs a corpus of symptoms
 * against confirmed causes. That corpus does not exist yet, and a confident
 * wrong suggestion on a braking fault is not a small error."
 *
 * That reason is still right. What changed in Phase 81 is the response to it:
 * build the corpus. Every diagnosis records the symptom it started from, the
 * causes that were considered, and what the technician found each of them to
 * be — confirmed, rejected, or not determined. After a few hundred jobs a
 * workshop can be told what has actually been true in that workshop before,
 * with the count, and shown nothing at all until it can.
 *
 * Nothing here is a model and nothing here is a prediction. Every number this
 * file returns is a count of jobs somebody finished and signed off, in the
 * workshop reading it. The strongest claim it will make is:
 *
 *   "Of 42 jobs that started from this symptom, the rotor runout was
 *    confirmed in 31 and ruled out in 4."
 *
 * which is a sentence about the past, checkable against the jobs it names.
 * ADR-0016.
 */

/** What a technician found a proposed cause to be. */
export type CauseOutcome = 'CONFIRMED' | 'REJECTED' | 'UNDETERMINED';

/** One cause, and what this workshop has found it to be before. */
export interface CauseEvidence {
  causeCode: string;
  label: string;
  confirmed: number;
  rejected: number;
  undetermined: number;
}

export interface RankedCause extends CauseEvidence {
  /** Jobs that reached a verdict either way: the denominator worth quoting. */
  decided: number;
  /** Confirmed as a share of decided, 0-1. Not a probability for this car. */
  share: number;
}

/**
 * How many confirmations before a cause is worth putting in front of anybody.
 *
 * Three is not a statistical threshold and is not presented as one. It is the
 * point below which a count is an anecdote, and an anecdote shown next to a
 * brake fault reads as advice. Under it the product says it does not know yet,
 * which is both true and the only safe thing to say.
 */
export const ENOUGH_TO_SHOW = 3;

/**
 * The causes this workshop has confirmed for a symptom, most confirmed first.
 *
 * Deliberately not "most likely". The order is how often this workshop has
 * found each one, which is a fact about the workshop; likelihood for the car
 * on the ramp is a different claim and this product does not make it.
 *
 * A cause that has only ever been ruled out is dropped: it carries no evidence
 * of being a cause, and listing it under "what this has been before" would say
 * the opposite of what the record holds.
 */
export function rankCauses(evidence: readonly CauseEvidence[]): RankedCause[] {
  return evidence
    .filter((one) => one.confirmed >= ENOUGH_TO_SHOW)
    .map((one) => {
      const decided = one.confirmed + one.rejected;
      return {
        ...one,
        decided,
        share: decided === 0 ? 0 : one.confirmed / decided,
      };
    })
    .sort(
      (a, b) =>
        b.confirmed - a.confirmed || b.share - a.share || a.label.localeCompare(b.label, 'en'),
    );
}

/**
 * Whether there is enough here to show anything at all.
 *
 * A workshop in its first month has a corpus of nothing, and the honest screen
 * for that is one that says so. Showing an empty list under a hopeful heading
 * invites somebody to conclude there is nothing to look at.
 */
export function worthShowing(evidence: readonly CauseEvidence[]): boolean {
  return rankCauses(evidence).length > 0;
}

/** Every job that reached a verdict on any cause for this symptom. */
export function jobsBehind(evidence: readonly CauseEvidence[]): number {
  return evidence.reduce((total, one) => total + one.confirmed + one.rejected, 0);
}

/**
 * The sentence that goes above the list.
 *
 * Written here rather than in a page so that the claim is in one place and can
 * be argued with. It names the count, the symptom and the workshop, and it
 * says "before" rather than "likely": the product is reporting its own history,
 * not forecasting this car.
 */
export function evidenceSentence(input: { symptom: string; jobs: number; causes: number }): {
  key: string;
  vars: Record<string, string | number>;
} {
  if (input.causes === 0) {
    return {
      key: 'Nothing has been confirmed here often enough to be worth showing. It will appear once {enough} jobs have settled on the same cause.',
      vars: { enough: ENOUGH_TO_SHOW },
    };
  }

  return {
    key: 'In this workshop, {jobs} jobs that began with “{symptom}” reached a verdict. These are what they turned out to be.',
    vars: { jobs: input.jobs, symptom: input.symptom },
  };
}

/**
 * The line beside one cause.
 *
 * Both numbers, always. A cause confirmed thirty times and ruled out twice is a
 * different thing from one confirmed thirty times and ruled out forty, and a
 * screen that shows only the confirmations makes them look identical.
 */
export function causeSentence(cause: RankedCause): {
  key: string;
  vars: Record<string, string | number>;
} {
  if (cause.rejected === 0) {
    return {
      key: 'Confirmed {confirmed} times, never ruled out',
      vars: { confirmed: cause.confirmed },
    };
  }

  return {
    key: 'Confirmed {confirmed} times, ruled out {rejected}',
    vars: { confirmed: cause.confirmed, rejected: cause.rejected },
  };
}

/**
 * Whether a diagnosis is finished: every cause considered has a verdict.
 *
 * "Not determined" counts as a verdict. It is the honest end of a diagnosis
 * that ran out of road, and recording it is what keeps the corpus from
 * quietly over-stating how often anything is found — a corpus that only ever
 * hears about successes will suggest the last thing that worked, for ever.
 */
export function isSettled(outcomes: readonly { outcome: CauseOutcome | null }[]): boolean {
  return outcomes.length > 0 && outcomes.every((one) => one.outcome !== null);
}
