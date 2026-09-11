import { checkCapacity, hasBlockingConflict, type Conflict, type ScheduledItem } from './capacity';

/**
 * The diary, cut the six ways a workshop actually looks at it.
 *
 * One set of bookings, six arrangements, and the arrangement is the whole
 * feature: a service manager asking "is Thursday full" and one asking "what is
 * Ahmed doing" are asking about the same rows and cannot answer each other's
 * question from the other's screen.
 *
 * The lane is the unit. A day view has a lane per bay, a technician view a
 * lane per person, a month view a lane per week. Everything below arranges
 * bookings into lanes and leaves the drawing to the page, because the rules
 * about what may sit where are the part worth testing and the pixels are not.
 *
 * Moving a booking runs the same capacity check as making one. That matters
 * more than it sounds: a diary that lets you drag a car into an occupied bay,
 * and only complains when somebody opens the booking later, is a diary that
 * manufactures double-bookings faster than a paper one.
 */

export type DiaryView = 'day' | 'week' | 'month' | 'technician' | 'bay' | 'site';

export interface DiaryBooking extends ScheduledItem {
  title: string;
  subtitle?: string | null;
  registration?: string | null;
  status: string;
  locationId?: string | null;
  jobId?: string | null;
}

export interface Lane {
  id: string;
  label: string;
  /** Something to say when the lane is empty, in the reader's terms. */
  emptyNote: string;
  bookings: DiaryBooking[];
  /** Hours booked into this lane across the range. */
  hours: number;
}

export interface Range {
  start: Date;
  end: Date;
  label: string;
}

const DAY = 86_400_000;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Monday. A workshop week starts when the shutters go up, not on Sunday. */
export function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const weekday = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - weekday);
  return copy;
}

function startOfMonth(date: Date): Date {
  const copy = startOfDay(date);
  copy.setDate(1);
  return copy;
}

/**
 * What span of time a view covers.
 *
 * The technician, bay and site views are cuts of a week rather than spans of
 * their own: "what is Ahmed doing" means this week unless somebody says
 * otherwise, and a person asking it while looking at Thursday means Thursday's
 * week.
 */
export function rangeFor(view: DiaryView, anchor: Date): Range {
  if (view === 'day') {
    const start = startOfDay(anchor);

    return {
      start,
      end: new Date(start.getTime() + DAY),
      label: start.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    };
  }

  if (view === 'month') {
    const start = startOfMonth(anchor);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    return {
      start,
      end,
      label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
    };
  }

  const start = startOfWeek(anchor);
  const end = new Date(start.getTime() + 7 * DAY);

  return {
    start,
    end,
    label: `${start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} to ${new Date(
      end.getTime() - DAY,
    ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
  };
}

/** Where the arrows go. */
export function shift(view: DiaryView, anchor: Date, direction: -1 | 1): Date {
  const moved = new Date(anchor);

  if (view === 'day') moved.setDate(moved.getDate() + direction);
  else if (view === 'month') moved.setMonth(moved.getMonth() + direction);
  else moved.setDate(moved.getDate() + direction * 7);

  return moved;
}

export interface LaneSource {
  bays: { id: string; name: string }[];
  technicians: { id: string; name: string }[];
  locations: { id: string; name: string }[];
}

function hoursOf(bookings: readonly DiaryBooking[]): number {
  return Math.round(bookings.reduce((total, item) => total + item.estimatedHours, 0) * 10) / 10;
}

/**
 * Arranges bookings into the lanes a view is made of.
 *
 * Every lane is returned even when it is empty, and the empty ones are the
 * point. A bay with nothing in it on Thursday is the thing a service manager
 * is looking for, and a view that only draws what exists hides exactly that.
 */
export function lanesFor(
  view: DiaryView,
  bookings: readonly DiaryBooking[],
  source: LaneSource,
  range: Range,
): Lane[] {
  const make = (
    id: string,
    label: string,
    emptyNote: string,
    matches: (booking: DiaryBooking) => boolean,
  ): Lane => {
    const mine = bookings.filter(matches).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    return { id, label, emptyNote, bookings: mine, hours: hoursOf(mine) };
  };

  if (view === 'technician') {
    return [
      ...source.technicians.map((person) =>
        make(person.id, person.name, 'Nothing booked to them', (b) => b.technicianId === person.id),
      ),
      // Never hidden. Work nobody is assigned to is the most important column
      // on this screen, because it is the work that will not get done.
      make('unassigned', 'Nobody yet', 'Everything has a name against it', (b) => !b.technicianId),
    ];
  }

  if (view === 'bay' || view === 'day') {
    return [
      ...source.bays.map((bay) =>
        make(bay.id, bay.name, 'Free all day', (b) => b.bayId === bay.id),
      ),
      make('unassigned', 'No bay yet', 'Every car has somewhere to go', (b) => !b.bayId),
    ];
  }

  if (view === 'site') {
    return source.locations.map((location) =>
      make(location.id, location.name, 'Nothing booked here', (b) => b.locationId === location.id),
    );
  }

  if (view === 'month') {
    const weeks: Lane[] = [];

    for (let cursor = startOfWeek(range.start); cursor < range.end;) {
      const from = new Date(cursor);
      const to = new Date(cursor.getTime() + 7 * DAY);

      weeks.push(
        make(
          from.toISOString(),
          `Week of ${from.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
          'Nothing booked that week',
          (booking) => booking.startAt >= from && booking.startAt < to,
        ),
      );

      cursor = to;
    }

    return weeks;
  }

  // Week: a lane per day, which is how somebody reads a wall planner.
  return Array.from({ length: 7 }, (_, index) => {
    const from = new Date(range.start.getTime() + index * DAY);
    const to = new Date(from.getTime() + DAY);

    return make(
      from.toISOString(),
      from.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }),
      'Nothing booked',
      (booking) => booking.startAt >= from && booking.startAt < to,
    );
  });
}

export type MoveTarget = { bayId?: string | null; technicianId?: string | null; startAt?: Date };

export interface MoveOutcome {
  allowed: boolean;
  conflicts: Conflict[];
  /** What to tell whoever just dropped it. */
  reason: string;
}

/**
 * Whether a booking may move where somebody just dropped it.
 *
 * The same check that guards making a booking, deliberately. A diary that
 * accepts any drop and complains later is one that manufactures double
 * bookings faster than paper did.
 *
 * A warning is not a refusal. Two cars in one bay is often exactly what a
 * workshop means to do, because one of them is on the lift for ten minutes.
 * A technician in two places at once never is, so that one blocks.
 */
export function assertMove(input: {
  booking: DiaryBooking;
  target: MoveTarget;
  existing: readonly DiaryBooking[];
  dailyCapacityHours?: number;
}): MoveOutcome {
  const startAt = input.target.startAt ?? input.booking.startAt;
  const span = input.booking.endAt.getTime() - input.booking.startAt.getTime();

  const candidate: ScheduledItem = {
    id: input.booking.id,
    startAt,
    endAt: new Date(startAt.getTime() + span),
    estimatedHours: input.booking.estimatedHours,
    bayId: input.target.bayId === undefined ? input.booking.bayId : input.target.bayId,
    technicianId:
      input.target.technicianId === undefined
        ? input.booking.technicianId
        : input.target.technicianId,
  };

  const conflicts = checkCapacity({
    candidate,
    existing: input.existing,
    dailyCapacityHours: input.dailyCapacityHours,
  });

  const blocking = hasBlockingConflict(conflicts);

  return {
    allowed: !blocking,
    conflicts,
    reason: blocking
      ? (conflicts.find((conflict) => conflict.severity === 'blocking')?.message ??
        'That move is not possible.')
      : conflicts.length > 0
        ? (conflicts[0]?.message ?? 'Moved, with something worth knowing.')
        : 'Moved.',
  };
}

export interface BayState {
  bayId: string;
  name: string;
  /** What is in it right now, if anything. */
  occupant: DiaryBooking | null;
  /** Booked later today. */
  upcoming: DiaryBooking[];
}

/**
 * The floor as it stands at one moment.
 *
 * A workshop's own answer to "where is that car" is to walk out and look. This
 * is the screen version, and it is only useful if it says what is in the bay
 * now rather than what is booked into it today.
 */
export function floorAt(
  now: Date,
  bays: readonly { id: string; name: string }[],
  bookings: readonly DiaryBooking[],
): BayState[] {
  return bays.map((bay) => {
    const mine = bookings
      .filter((booking) => booking.bayId === bay.id)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    return {
      bayId: bay.id,
      name: bay.name,
      occupant: mine.find((booking) => booking.startAt <= now && booking.endAt > now) ?? null,
      upcoming: mine.filter((booking) => booking.startAt > now),
    };
  });
}
