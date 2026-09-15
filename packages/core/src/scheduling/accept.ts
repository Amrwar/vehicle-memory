import type { Assignment } from './plan';

/**
 * Accepting the day's plan.
 *
 * The planner proposes and explains; until Phase 19 nothing wrote its
 * proposal anywhere, so the morning meeting read the page and typed the
 * result into the diary by hand. Accepting turns each placement into a
 * booking against the job, with the technician, the bay and the times the
 * plan chose. The diary then shows what the plan decided, and the plan, on
 * its next run, treats those bookings as fixed rather than placing the same
 * job twice.
 *
 * Nothing here decides anything a person did not press a button for.
 */

export class PlanError extends Error {
  constructor(
    readonly code: 'IN_THE_PAST' | 'NOTHING_PLACED' | 'NO_PERSON',
    message: string,
  ) {
    super(message);
    this.name = 'PlanError';
  }
}

export interface DiaryDraft {
  jobId: string;
  /** The user behind the technician, if the employee has a login. */
  technicianUserId: string | null;
  bayId: string | null;
  startAt: Date;
  endAt: Date;
  estimatedHours: number;
  description: string;
}

/** Midnight of the given calendar day, local time. */
function midnightOf(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function assertPlanAcceptable(input: {
  date: Date;
  now: Date;
  assignments: readonly Assignment[];
}): void {
  if (midnightOf(input.date) < midnightOf(input.now)) {
    throw new PlanError(
      'IN_THE_PAST',
      'That day has gone. A plan is written into the diary for today or a day to come.',
    );
  }

  if (input.assignments.length === 0) {
    throw new PlanError('NOTHING_PLACED', 'Nothing was placed, so there is nothing to write.');
  }
}

/**
 * Bookings from placements.
 *
 * Minutes from midnight become times on the day. The technician is resolved
 * through the employee record to a user, because bookings are assigned to
 * users; an employee with no login is still placed, and the booking simply
 * names no technician, which the diary shows plainly.
 */
export function diaryDraftsFor(
  assignments: readonly Assignment[],
  date: Date,
  userIdByEmployee: ReadonlyMap<string, string | null>,
): DiaryDraft[] {
  const midnight = midnightOf(date);

  return assignments.map((assignment) => {
    const startAt = new Date(midnight.getTime() + assignment.startMinute * 60_000);
    const endAt = new Date(midnight.getTime() + assignment.endMinute * 60_000);
    const minutes = Math.max(15, assignment.endMinute - assignment.startMinute);

    return {
      jobId: assignment.itemId,
      technicianUserId: userIdByEmployee.get(assignment.employeeId) ?? null,
      bayId: assignment.bayId,
      startAt,
      endAt,
      estimatedHours: Math.round((minutes / 60) * 100) / 100,
      description: assignment.label,
    };
  });
}

/** One sentence for the banner after accepting. */
export function describeAcceptance(written: number, unnamed: number, date: Date): string {
  const day = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const base = `${written} placement${written === 1 ? '' : 's'} written into the diary for ${day}.`;
  if (unnamed === 0) return base;
  return unnamed === 1
    ? `${base} 1 of them has no technician, because that person has no login yet.`
    : `${base} ${unnamed} of them have no technician, because those people have no login yet.`;
}
