import type { JobStatus } from './lifecycle';

/**
 * Where a job stands, why, and the one thing to do about it.
 *
 * The product has had fourteen job statuses since Phase 1 and they are the
 * right fourteen. What it has never had is the sentence a service manager
 * actually says when they look at the board:
 *
 *   Waiting for customer — 2h 14m. Estimate £843.20, sent at 11:42, not
 *   opened. [Send a reminder]
 *
 * A status is a noun. That is a position: whose move it is, how long it has
 * been their move, the evidence for saying so, and the single next action.
 * Everything in it is derived from records the product already keeps, because
 * a second field saying what a job is waiting for would be a second thing to
 * keep true, and it would be wrong within a week.
 *
 * **Whose move it is** is the question that matters. A workshop cannot make a
 * customer approve an estimate or a supplier deliver a part, and a board that
 * shows those jobs in the same colour as the ones nobody has started teaches
 * the manager to read none of them. Phase 84, and the foundation of the
 * control tower.
 */

/** Who the job is waiting on. */
export type Move = 'us' | 'customer' | 'supplier' | 'nobody';

export interface JobFacts {
  status: JobStatus;
  /** When it entered this status. */
  since: Date;
  now: Date;
  /** When it was promised back, if it was. */
  promisedAt?: Date | null;

  /** The estimate in front of the customer, if there is one. */
  estimate?: {
    total: number;
    sentAt?: Date | null;
    /** Whether they have opened the link. Null when we cannot tell. */
    openedAt?: Date | null;
  } | null;

  /** Parts ordered and not yet on the shelf. */
  partsOutstanding?: number;
  /** When the supplier said the earliest of them would arrive. */
  partsDueAt?: Date | null;

  /** Whether this job needs a quality check, and whether it has had one. */
  qualityCheckRequired?: boolean;
  qualityCheckDone?: boolean;

  /** What is still owed on it. */
  owed?: number;
  /** Whether the customer has taken the car. */
  collectedAt?: Date | null;
  /** Whether anybody is clocked on to it now. */
  somebodyOn?: boolean;
}

export interface JobStanding {
  move: Move;
  /** Minutes it has been in this position. */
  minutes: number;
  /** Past the promised time, and nobody has finished it. */
  late: boolean;
  /** What to say: a translation key and its values. */
  reason: { key: string; vars: Record<string, string | number> };
  /** The one thing to do, or nothing when the move is not ours. */
  next: { key: string; href?: string } | null;
}

const MINUTE = 60_000;

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / MINUTE));
}

/**
 * The position, from the records.
 *
 * Read top to bottom: the first thing that is true is the position. The order
 * is the order a manager would ask the questions in, and it matters — a job
 * waiting for a part *and* waiting for a quality check is waiting for the
 * part, because that is the one that cannot be started on.
 */
export function standingOfJob(facts: JobFacts): JobStanding {
  const minutes = minutesBetween(facts.since, facts.now);
  const late =
    facts.promisedAt != null &&
    facts.promisedAt < facts.now &&
    !['COMPLETED', 'INVOICED', 'PAID', 'CANCELLED'].includes(facts.status);

  const position = (
    move: Move,
    key: string,
    vars: Record<string, string | number> = {},
    next: JobStanding['next'] = null,
  ): JobStanding => ({ move, minutes, late, reason: { key, vars }, next });

  switch (facts.status) {
    case 'CANCELLED':
      return position('nobody', 'Cancelled. Nothing further is owed or expected.');

    case 'DRAFT':
      return position('us', 'Not booked in yet.', {}, { key: 'Book it in' });

    case 'BOOKED':
      return position('customer', 'Booked. The car has not arrived.', {}, null);

    case 'RECEIVED':
      return position('us', 'Checked in, nothing started.', {}, { key: 'Start the inspection' });

    case 'INSPECTING':
      return position('us', 'Being inspected.', {}, { key: 'Finish the inspection' });

    case 'DIAGNOSED':
      return position('us', 'Diagnosed, no estimate written.', {}, { key: 'Write the estimate' });

    case 'ESTIMATED':
      return position('us', 'Estimate written, not sent.', {}, { key: 'Send the estimate' });

    case 'AWAITING_APPROVAL': {
      // The one the example in the plan is about, and the one a workshop
      // loses the most hours to. Both facts are stated: what it is worth, and
      // whether they have even looked at it.
      const estimate = facts.estimate;

      if (!estimate?.sentAt) {
        return position(
          'us',
          'Waiting for approval, but the estimate has not been sent.',
          {},
          { key: 'Send the estimate' },
        );
      }

      if (estimate.openedAt == null) {
        return position(
          'customer',
          'Waiting for the customer. {amount} sent, not opened.',
          { amount: estimate.total },
          { key: 'Send a reminder' },
        );
      }

      return position(
        'customer',
        'Waiting for the customer. {amount} sent, opened, no answer.',
        { amount: estimate.total },
        { key: 'Ring them' },
      );
    }

    case 'APPROVED': {
      if ((facts.partsOutstanding ?? 0) > 0) {
        return facts.partsDueAt
          ? position(
              'supplier',
              'Approved. {count} parts still to arrive, the first due {date}.',
              { count: facts.partsOutstanding!, date: facts.partsDueAt.toISOString() },
              { key: 'Chase the supplier' },
            )
          : position(
              'supplier',
              'Approved. {count} parts on order with no date.',
              { count: facts.partsOutstanding! },
              { key: 'Chase the supplier' },
            );
      }

      return position('us', 'Approved and ready to start.', {}, { key: 'Start the work' });
    }

    case 'IN_PROGRESS': {
      if ((facts.partsOutstanding ?? 0) > 0) {
        return position(
          'supplier',
          'Started, then stopped: {count} parts still to arrive.',
          { count: facts.partsOutstanding! },
          { key: 'Chase the supplier' },
        );
      }

      return facts.somebodyOn
        ? position('us', 'Being worked on now.')
        : position('us', 'Started, nobody on it.', {}, { key: 'Put somebody on it' });
    }

    case 'QUALITY_CHECK':
      return position('us', 'Work done, waiting to be checked.', {}, { key: 'Do the check' });

    case 'COMPLETED': {
      if (facts.qualityCheckRequired && !facts.qualityCheckDone) {
        return position(
          'us',
          'Finished, but the quality check has not been done.',
          {},
          { key: 'Do the check' },
        );
      }

      return position('us', 'Ready, not invoiced.', {}, { key: 'Raise the invoice' });
    }

    case 'INVOICED': {
      const owed = facts.owed ?? 0;
      if (owed > 0) {
        return position(
          'customer',
          'Invoiced, {amount} unpaid.',
          { amount: owed },
          { key: 'Ask for payment' },
        );
      }

      return facts.collectedAt
        ? position('us', 'Paid and collected, not closed.', {}, { key: 'Close the job' })
        : position(
            'customer',
            'Paid. The car is still here.',
            {},
            { key: 'Tell them it is ready' },
          );
    }

    case 'PAID':
      return facts.collectedAt
        ? position('nobody', 'Paid and collected. Nothing outstanding.')
        : position(
            'customer',
            'Paid. The car is still here.',
            {},
            { key: 'Tell them it is ready' },
          );

    default:
      return position('us', 'No position recorded for this state.');
  }
}

/**
 * The jobs a manager should look at, worst first.
 *
 * Ours before theirs, because the ones we are holding up are the ones we can
 * do something about this morning; late before early within that; longest
 * before shortest. A board sorted by when the job arrived tells you nothing
 * you did not already know.
 */
export function jobsWorstFirst<T extends { standing: JobStanding }>(jobs: readonly T[]): T[] {
  const weight: Record<Move, number> = { us: 0, supplier: 1, customer: 2, nobody: 3 };

  return [...jobs].sort(
    (a, b) =>
      Number(b.standing.late) - Number(a.standing.late) ||
      weight[a.standing.move] - weight[b.standing.move] ||
      b.standing.minutes - a.standing.minutes,
  );
}

/** Whether anybody needs to do anything about this job at all. */
export function needsSomebody(standing: JobStanding): boolean {
  return standing.move !== 'nobody';
}
