import { describe, expect, it } from 'vitest';

import {
  assertMove,
  type DiaryBooking,
  floorAt,
  type LaneSource,
  lanesFor,
  rangeFor,
  shift,
  startOfWeek,
} from './views';

const MONDAY = new Date('2026-09-07T09:00:00');

function booking(overrides: Partial<DiaryBooking> = {}): DiaryBooking {
  const startAt = overrides.startAt ?? MONDAY;

  return {
    id: 'b1',
    title: 'Full service',
    status: 'SCHEDULED',
    startAt,
    endAt: new Date(startAt.getTime() + 2 * 3_600_000),
    estimatedHours: 2,
    bayId: 'bay-1',
    technicianId: 'tech-1',
    locationId: 'site-1',
    ...overrides,
  };
}

const SOURCE: LaneSource = {
  bays: [
    { id: 'bay-1', name: 'Bay 1' },
    { id: 'bay-2', name: 'Bay 2' },
  ],
  technicians: [
    { id: 'tech-1', name: 'Ahmed' },
    { id: 'tech-2', name: 'Mike' },
  ],
  locations: [
    { id: 'site-1', name: 'Hillside' },
    { id: 'site-2', name: 'Bradford' },
  ],
};

describe('the span a view covers', () => {
  it('gives a day a day', () => {
    const range = rangeFor('day', MONDAY);

    expect(range.end.getTime() - range.start.getTime()).toBe(86_400_000);
    expect(range.label).toMatch(/Monday/);
  });

  it('starts a week on Monday, not Sunday', () => {
    // A workshop week starts when the shutters go up.
    expect(startOfWeek(new Date('2026-09-13T12:00:00')).getDay()).toBe(1);
    expect(rangeFor('week', MONDAY).end.getTime() - rangeFor('week', MONDAY).start.getTime()).toBe(
      7 * 86_400_000,
    );
  });

  it('gives a month its own length rather than four weeks', () => {
    const range = rangeFor('month', new Date('2026-02-14T12:00:00'));

    expect(range.start.getDate()).toBe(1);
    expect(range.end.getMonth()).toBe(2);
  });

  it('treats the person and bay views as cuts of a week', () => {
    // "What is Ahmed doing" means this week unless somebody says otherwise.
    const person = rangeFor('technician', MONDAY);
    expect(person.end.getTime() - person.start.getTime()).toBe(7 * 86_400_000);
  });
});

describe('moving between periods', () => {
  it('steps a day by a day and a month by a month', () => {
    expect(shift('day', MONDAY, 1).getDate()).toBe(8);
    expect(shift('month', MONDAY, 1).getMonth()).toBe(9);
    expect(shift('week', MONDAY, -1).getDate()).toBe(31);
  });
});

describe('arranging bookings into lanes', () => {
  const range = rangeFor('week', MONDAY);

  it('gives a bay view a lane for every bay, including empty ones', () => {
    // A bay with nothing in it is the thing somebody is looking for.
    const lanes = lanesFor('bay', [booking()], SOURCE, range);

    expect(lanes.map((lane) => lane.label)).toEqual(['Bay 1', 'Bay 2', 'No bay yet']);
    expect(lanes[1]?.bookings).toEqual([]);
    expect(lanes[1]?.emptyNote).toBe('Free all day');
  });

  it('always shows work nobody is assigned to', () => {
    // It is the work that will not get done, so it cannot be hidden.
    const lanes = lanesFor('technician', [booking({ technicianId: null })], SOURCE, range);
    const nobody = lanes.find((lane) => lane.id === 'unassigned');

    expect(nobody?.label).toBe('Nobody yet');
    expect(nobody?.bookings).toHaveLength(1);
  });

  it('totals the hours in each lane', () => {
    const lanes = lanesFor(
      'bay',
      [booking(), booking({ id: 'b2', estimatedHours: 1.5 })],
      SOURCE,
      range,
    );

    expect(lanes[0]?.hours).toBe(3.5);
  });

  it('splits a week into days, in order', () => {
    const lanes = lanesFor('week', [booking()], SOURCE, range);

    expect(lanes).toHaveLength(7);
    expect(lanes[0]?.bookings).toHaveLength(1);
    expect(lanes[3]?.bookings).toHaveLength(0);
  });

  it('splits a month into weeks', () => {
    const monthly = rangeFor('month', MONDAY);
    const lanes = lanesFor('month', [booking()], SOURCE, monthly);

    expect(lanes.length).toBeGreaterThanOrEqual(4);
    expect(lanes.every((lane) => lane.label.startsWith('Week of'))).toBe(true);
  });

  it('gives a site view a lane per site', () => {
    const lanes = lanesFor('site', [booking()], SOURCE, range);

    expect(lanes.map((lane) => lane.label)).toEqual(['Hillside', 'Bradford']);
  });

  it('sorts each lane by time', () => {
    const later = booking({ id: 'b2', startAt: new Date('2026-09-07T14:00:00') });
    const lanes = lanesFor('bay', [later, booking()], SOURCE, range);

    expect(lanes[0]?.bookings.map((entry) => entry.id)).toEqual(['b1', 'b2']);
  });
});

describe('dropping a booking somewhere else', () => {
  const existing = [booking({ id: 'other', bayId: 'bay-2', technicianId: 'tech-2' })];

  it('allows a move into a free bay', () => {
    const outcome = assertMove({
      booking: booking(),
      target: { bayId: 'bay-1' },
      existing,
    });

    expect(outcome.allowed).toBe(true);
    expect(outcome.reason).toBe('Moved.');
  });

  it('refuses to put a technician in two places at once', () => {
    // Physically impossible, so this one blocks rather than warns.
    const outcome = assertMove({
      booking: booking(),
      target: { technicianId: 'tech-2' },
      existing,
    });

    expect(outcome.allowed).toBe(false);
    expect(outcome.reason).toMatch(/already assigned/);
  });

  it('warns about a shared bay without refusing it', () => {
    // Often exactly what a workshop means: one of them is on the lift for ten
    // minutes.
    const outcome = assertMove({
      booking: booking({ technicianId: null }),
      target: { bayId: 'bay-2' },
      existing,
    });

    expect(outcome.allowed).toBe(true);
    expect(outcome.conflicts.some((conflict) => conflict.kind === 'BAY_DOUBLE_BOOKED')).toBe(true);
    expect(outcome.reason).toMatch(/already has/);
  });

  it('keeps the booking its own length when the time changes', () => {
    const outcome = assertMove({
      booking: booking(),
      target: { startAt: new Date('2026-09-08T09:00:00') },
      existing: [],
    });

    expect(outcome.allowed).toBe(true);
  });

  it('warns when the day would go over capacity', () => {
    const outcome = assertMove({
      booking: booking({ estimatedHours: 6 }),
      target: { bayId: 'bay-1' },
      existing: [booking({ id: 'other', technicianId: null, estimatedHours: 6 })],
      dailyCapacityHours: 8,
    });

    expect(outcome.allowed).toBe(true);
    expect(outcome.conflicts.some((conflict) => conflict.kind === 'OVER_CAPACITY')).toBe(true);
  });
});

describe('the floor as it stands', () => {
  const now = new Date('2026-09-07T10:00:00');

  it('says what is in the bay now, not what is booked today', () => {
    const inThere = booking({ startAt: new Date('2026-09-07T09:00:00') });
    const later = booking({ id: 'b2', startAt: new Date('2026-09-07T15:00:00') });

    const floor = floorAt(now, SOURCE.bays, [inThere, later]);

    expect(floor[0]?.occupant?.id).toBe('b1');
    expect(floor[0]?.upcoming.map((entry) => entry.id)).toEqual(['b2']);
  });

  it('reports an empty bay as empty', () => {
    const floor = floorAt(now, SOURCE.bays, [booking()]);

    expect(floor[1]?.occupant).toBeNull();
    expect(floor[1]?.upcoming).toEqual([]);
  });

  it('does not count something that has already left', () => {
    const gone = booking({ startAt: new Date('2026-09-07T06:00:00') });

    expect(floorAt(now, SOURCE.bays, [gone])[0]?.occupant).toBeNull();
  });
});
