/**
 * Why a car came back, and what that says about the job before it.
 *
 * The product has counted comebacks since Phase 26 and linked each one to the
 * job it came back from. That answers "how often", which is the number an
 * owner quotes and the least useful thing about it. **Twelve comebacks tells
 * you nothing you can act on. Four of them being the same part tells you
 * everything.**
 *
 * So a comeback carries a cause, from a closed list, chosen by whoever looked
 * at the car the second time. Seven categories, and the boundaries between
 * them are the whole design — they are the seven different things a workshop
 * would do about it:
 *
 *   - a wrong diagnosis is a training and a process problem;
 *   - a defective part is a supplier problem, and a warranty claim;
 *   - an installation fault is a workmanship problem, and the one nobody wants
 *     to write down, which is exactly why it has to be on the list;
 *   - something missed in an inspection is a checklist problem;
 *   - customer misuse is not the workshop's fault and must be recordable
 *     without implying it was;
 *   - unrelated is the common one — the car came back for something else and
 *     somebody linked it anyway;
 *   - and unknown, because forcing a choice manufactures data.
 *
 * Phase 86.
 */

export const COMEBACK_CAUSES = [
  'INCORRECT_DIAGNOSIS',
  'DEFECTIVE_PART',
  'INSTALLATION',
  'MISSED_IN_INSPECTION',
  'CUSTOMER_MISUSE',
  'UNRELATED',
  'UNKNOWN',
] as const;

export type ComebackCause = (typeof COMEBACK_CAUSES)[number];

/** What each cause is called, and who it is about. */
export const COMEBACK_CAUSE_LABEL: Record<ComebackCause, string> = {
  INCORRECT_DIAGNOSIS: 'The diagnosis was wrong',
  DEFECTIVE_PART: 'The part was faulty',
  INSTALLATION: 'It was not fitted right',
  MISSED_IN_INSPECTION: 'The inspection missed it',
  CUSTOMER_MISUSE: 'Nothing to do with the work',
  UNRELATED: 'A different fault',
  UNKNOWN: 'Not established',
};

/**
 * Whether this cause says the workshop got something wrong.
 *
 * The distinction matters for every figure built on top. A comeback rate that
 * counts a customer driving through a flood as a failure of the workshop is a
 * rate nobody will believe, and a rate that quietly drops the ones that *were*
 * the workshop's fault is worse. Both are counted; they are counted apart.
 */
export function isOurs(cause: ComebackCause): boolean {
  return (
    cause === 'INCORRECT_DIAGNOSIS' ||
    cause === 'DEFECTIVE_PART' ||
    cause === 'INSTALLATION' ||
    cause === 'MISSED_IN_INSPECTION'
  );
}

/**
 * A defective part is ours to the customer and the supplier's to us.
 *
 * It belongs in the workshop's own figure — the customer's car came back and
 * that is the workshop's problem whoever made the part — and it is the one
 * category that should also produce a claim.
 */
export function isClaimable(cause: ComebackCause): boolean {
  return cause === 'DEFECTIVE_PART';
}

export interface ComebackRecord {
  jobId: string;
  cause: ComebackCause | null;
  /** What the original job was for, in the workshop's own words. */
  originalWork: string | null;
  /** Which car, so a pattern across vehicles can be seen. */
  vehicleId: string | null;
  at: Date;
}

export interface CauseTally {
  cause: ComebackCause;
  label: string;
  count: number;
  ours: boolean;
}

/** How many of each, most first, with the ones nobody has classified last. */
export function byCause(records: readonly ComebackRecord[]): CauseTally[] {
  const counts = new Map<ComebackCause, number>();

  for (const record of records) {
    const cause = record.cause ?? 'UNKNOWN';
    counts.set(cause, (counts.get(cause) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([cause, count]) => ({
      cause,
      label: COMEBACK_CAUSE_LABEL[cause],
      count,
      ours: isOurs(cause),
    }))
    .sort(
      (a, b) =>
        Number(a.cause === 'UNKNOWN') - Number(b.cause === 'UNKNOWN') ||
        b.count - a.count ||
        a.label.localeCompare(b.label, 'en'),
    );
}

/** How many came back for something the workshop did, out of how many in all. */
export function oursOf(records: readonly ComebackRecord[]): { ours: number; all: number } {
  return {
    ours: records.filter((one) => one.cause != null && isOurs(one.cause)).length,
    all: records.length,
  };
}

export interface Pattern {
  work: string;
  vehicles: number;
  comebacks: number;
}

/**
 * The same repair coming back on several different cars.
 *
 * The thing worth interrupting somebody for, and the thing a count of twelve
 * hides. One car back twice is a bad job; five cars back after the same
 * repair is a bad *procedure*, a bad batch of parts, or a technician who needs
 * showing something — and the workshop cannot see it from a list.
 *
 * Counted by distinct vehicle on purpose. Three comebacks on one car is one
 * unhappy customer, not a pattern, and treating it as one would send somebody
 * to re-train a technician over a single stubborn fault.
 */
export function patternsIn(records: readonly ComebackRecord[], atLeast = 3): Pattern[] {
  const byWork = new Map<string, { vehicles: Set<string>; comebacks: number }>();

  for (const record of records) {
    const work = record.originalWork?.trim();
    if (!work) continue;

    const at = byWork.get(work) ?? { vehicles: new Set<string>(), comebacks: 0 };
    if (record.vehicleId) at.vehicles.add(record.vehicleId);
    at.comebacks += 1;
    byWork.set(work, at);
  }

  return [...byWork.entries()]
    .map(([work, at]) => ({ work, vehicles: at.vehicles.size, comebacks: at.comebacks }))
    .filter((one) => one.vehicles >= atLeast)
    .sort((a, b) => b.vehicles - a.vehicles || b.comebacks - a.comebacks);
}

/**
 * What a case file needs to have on it before it is worth calling one.
 *
 * Not a validation rule — a comeback is recorded the moment somebody notices,
 * with nothing filled in, because the alternative is that it is not recorded
 * at all. This is what is still missing, so the screen can ask for it rather
 * than the record quietly being half a record.
 */
export function stillMissing(input: {
  cause: ComebackCause | null;
  hasOriginal: boolean;
  hasNewComplaint: boolean;
}): string[] {
  const gaps: string[] = [];
  if (!input.hasOriginal) gaps.push('which job it came back from');
  if (!input.hasNewComplaint) gaps.push('what it came back with');
  if (input.cause == null) gaps.push('what caused it');
  return gaps;
}
