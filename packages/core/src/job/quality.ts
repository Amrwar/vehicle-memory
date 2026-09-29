/**
 * The last thing anybody does before a car goes back.
 *
 * `assertTransition` has refused to complete a job since Phase 1 when its job
 * type asks for a quality check and none has passed — FR-612, and a good rule.
 * Nothing in the product has ever written one. The default job types a new
 * workshop is given all ask for a check, so a workshop signing up and booking
 * in a service could never finish it: the message was correct and complete,
 * and there was no way to comply with it. Phase 85 is the key to that gate.
 *
 * What the sheet asks is the workshop's own, because every workshop's is
 * different and every one is short. What this file decides is narrower and
 * does not vary: **when a sheet counts as passed**.
 *
 * The rule is the strict one on purpose. A required line that was not answered
 * is a fail, not a pass-with-a-gap — because the alternative is a sheet that
 * can be signed without being read, and the whole value of the sheet is that
 * somebody had to look at each line to get past it.
 */

export type QualityItemKind = 'CONFIRM' | 'VALUE';

export interface QualityItem {
  id: string;
  label: string;
  kind: QualityItemKind;
  required: boolean;
}

export interface QualityAnswer {
  itemId: string;
  /** For a CONFIRM line. */
  confirmed?: boolean | null;
  /** For a VALUE line: a road test result, a final mileage. */
  value?: string | null;
}

export type QualityOutcome = 'PASS' | 'FAIL';

/** Why a sheet did not pass, line by line. */
export interface QualityGap {
  itemId: string;
  label: string;
  why: 'unanswered' | 'refused';
}

/** Whether a single line has been answered at all. */
export function isAnswered(item: QualityItem, answer: QualityAnswer | undefined): boolean {
  if (!answer) return false;
  return item.kind === 'CONFIRM'
    ? answer.confirmed === true || answer.confirmed === false
    : typeof answer.value === 'string' && answer.value.trim() !== '';
}

/**
 * Every required line that is not answered, or is answered no.
 *
 * Both are gaps and they are different gaps, which is why the reason is
 * carried: "you have not said whether the fluids were checked" and "you have
 * said the fluids were not checked" need different things done about them.
 */
export function gapsIn(
  items: readonly QualityItem[],
  answers: readonly QualityAnswer[],
): QualityGap[] {
  const byItem = new Map(answers.map((answer) => [answer.itemId, answer]));

  return items
    .filter((item) => item.required)
    .flatMap<QualityGap>((item) => {
      const answer = byItem.get(item.id);

      if (!isAnswered(item, answer)) {
        return [{ itemId: item.id, label: item.label, why: 'unanswered' }];
      }

      if (item.kind === 'CONFIRM' && answer!.confirmed === false) {
        return [{ itemId: item.id, label: item.label, why: 'refused' }];
      }

      return [];
    });
}

/**
 * Pass only when every required line is answered and none is answered no.
 *
 * An optional line answered no does not fail the sheet: the workshop marked it
 * optional, which is the workshop saying it is not a reason to hold the car.
 */
export function outcomeOf(
  items: readonly QualityItem[],
  answers: readonly QualityAnswer[],
): QualityOutcome {
  return gapsIn(items, answers).length === 0 ? 'PASS' : 'FAIL';
}

/**
 * Where the job goes next.
 *
 * A pass finishes it. A fail sends it back to the bench rather than leaving it
 * in the checking state, because a job nobody is working on and nobody has
 * finished is a job that falls between two people. The technician gets it
 * back, which is the only place work happens.
 */
export function afterCheck(outcome: QualityOutcome): 'COMPLETED' | 'IN_PROGRESS' {
  return outcome === 'PASS' ? 'COMPLETED' : 'IN_PROGRESS';
}

/**
 * The sheet a workshop starts with.
 *
 * Twelve lines, from the plan of 26 September. They are a starting point and
 * every one can be renamed, reordered, made optional or retired — but a new
 * workshop that has never thought about this gets something a technician would
 * recognise rather than an empty page.
 */
export const DEFAULT_QUALITY_SHEET: readonly {
  label: string;
  kind: QualityItemKind;
  required: boolean;
}[] = [
  { label: 'Every task on the job is done', kind: 'CONFIRM', required: true },
  { label: 'The parts on the job are the parts fitted', kind: 'CONFIRM', required: true },
  { label: 'Torque-critical fasteners checked', kind: 'CONFIRM', required: true },
  { label: 'Fluid levels checked', kind: 'CONFIRM', required: true },
  { label: 'No warning lights on', kind: 'CONFIRM', required: true },
  { label: 'Road test done', kind: 'CONFIRM', required: true },
  { label: 'What the road test showed', kind: 'VALUE', required: true },
  { label: 'Photographs attached', kind: 'CONFIRM', required: false },
  { label: 'Inspection completed', kind: 'CONFIRM', required: false },
  { label: 'What the customer asked about is answered', kind: 'CONFIRM', required: true },
  { label: 'Mileage on handing back', kind: 'VALUE', required: true },
  { label: 'Signed off by', kind: 'VALUE', required: true },
];
