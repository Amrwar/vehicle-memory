import { describe, expect, it } from 'vitest';

import { assertPlanAcceptable, describeAcceptance, diaryDraftsFor, type PlanError } from './accept';
import type { Assignment } from './plan';

const placement: Assignment = {
  itemId: 'job_1',
  label: '#1042 Grinding under braking',
  employeeId: 'emp_1',
  technicianName: 'Dani',
  bayId: 'bay_1',
  bayName: 'Bay 1',
  startMinute: 9 * 60,
  endMinute: 10 * 60 + 30,
  why: 'Least loaded person who holds brakes at competent.',
} as Assignment;

const monday = new Date(2026, 8, 14, 9, 0, 0);

describe('assertPlanAcceptable', () => {
  it('refuses a day that has gone', () => {
    try {
      assertPlanAcceptable({ date: new Date(2026, 8, 13), now: monday, assignments: [placement] });
      expect.unreachable();
    } catch (error) {
      expect((error as PlanError).code).toBe('IN_THE_PAST');
    }
  });

  it('allows today, whatever the hour', () => {
    expect(() =>
      assertPlanAcceptable({
        date: new Date(2026, 8, 14, 7),
        now: new Date(2026, 8, 14, 17),
        assignments: [placement],
      }),
    ).not.toThrow();
  });

  it('refuses an empty plan', () => {
    try {
      assertPlanAcceptable({ date: monday, now: monday, assignments: [] });
      expect.unreachable();
    } catch (error) {
      expect((error as PlanError).code).toBe('NOTHING_PLACED');
    }
  });
});

describe('diaryDraftsFor', () => {
  it('turns minutes into times on the day and resolves the person to a login', () => {
    const [draft] = diaryDraftsFor([placement], monday, new Map([['emp_1', 'user_1']]));

    expect(draft?.jobId).toBe('job_1');
    expect(draft?.technicianUserId).toBe('user_1');
    expect(draft?.bayId).toBe('bay_1');
    expect(draft?.startAt).toEqual(new Date(2026, 8, 14, 9, 0));
    expect(draft?.endAt).toEqual(new Date(2026, 8, 14, 10, 30));
    expect(draft?.estimatedHours).toBe(1.5);
    expect(draft?.description).toBe('#1042 Grinding under braking');
  });

  it('places a person with no login without inventing one', () => {
    const [draft] = diaryDraftsFor([placement], monday, new Map());
    expect(draft?.technicianUserId).toBeNull();
  });

  it('never writes a booking shorter than a quarter hour', () => {
    const [draft] = diaryDraftsFor(
      [{ ...placement, startMinute: 600, endMinute: 605 }],
      monday,
      new Map(),
    );
    expect(draft?.estimatedHours).toBe(0.25);
  });
});

describe('describeAcceptance', () => {
  it('says what was written, and who has no login', () => {
    expect(describeAcceptance(3, 0, monday)).toBe(
      '3 placements written into the diary for Monday 14 September.',
    );
    expect(describeAcceptance(1, 1, monday)).toMatch(
      /1 placement written .* 1 of them has no technician, because that person/,
    );
    expect(describeAcceptance(3, 2, monday)).toMatch(
      /2 of them have no technician, because those people/,
    );
  });
});
