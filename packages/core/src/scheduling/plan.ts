/**
 * Putting a day together: who does what, in which bay, and why.
 *
 * The risk here is not the screen. It is that a schedule which is subtly
 * wrong is worse than a blank one, because somebody works to it. A plan that
 * puts the only air-conditioning job on the only technician who cannot do air
 * conditioning will be discovered at half past eight by a person holding a
 * set of keys.
 *
 * So three properties are enforced rather than hoped for.
 *
 * It never proposes work somebody cannot do. Skill is a hard constraint, not
 * a preference, and a job with nobody qualified comes back unplaced with that
 * said plainly rather than being given to whoever was free.
 *
 * Every line carries its reason. "At ten because he is the only MOT tester in
 * on Tuesday and the part arrives at nine" is a sentence a service manager
 * can disagree with. A schedule that cannot be disagreed with cannot be
 * trusted either.
 *
 * It proposes; a person accepts. Nothing here writes anything. That is the
 * same rule the arrival suggestions and the mileage findings follow, and it
 * is the reason this can be useful before it is perfect.
 */

export type SkillLevel = 'LEARNING' | 'COMPETENT' | 'EXPERT';

/** Ordered, so "at least competent" is a comparison rather than a lookup. */
const RANK: Record<SkillLevel, number> = { LEARNING: 1, COMPETENT: 2, EXPERT: 3 };

export function meets(held: SkillLevel | undefined, required: SkillLevel): boolean {
  return held !== undefined && RANK[held] >= RANK[required];
}

export interface Requirement {
  skillId: string;
  skillName: string;
  minimumLevel: SkillLevel;
}

export interface Technician {
  employeeId: string;
  name: string;
  /** Minutes from midnight they are on site, local to the site. */
  startMinute: number;
  endMinute: number;
  /** What they can do, by skill. Absent means they cannot do it at all. */
  skills: ReadonlyMap<string, SkillLevel>;
  /** Work already fixed to them that the plan must not run over. */
  committed: readonly { startMinute: number; endMinute: number }[];
}

export interface Bay {
  bayId: string;
  name: string;
  /** What the bay can take. Null means it takes anything. */
  capability: string | null;
  committed: readonly { startMinute: number; endMinute: number }[];
}

export interface WorkItem {
  id: string;
  label: string;
  minutes: number;
  requirements: readonly Requirement[];
  /** What the bay must be able to do, where it matters. */
  needsCapability?: string | null;
  /**
   * Ranked ahead of everything with a later one. A job promised for today is
   * not negotiable against one promised for Friday.
   */
  promisedAt?: Date | null;
  /** True when the parts are not on the shelf, which makes it unplaceable. */
  waitingOnParts?: boolean;
}

export interface Assignment {
  itemId: string;
  label: string;
  employeeId: string;
  technicianName: string;
  bayId: string | null;
  bayName: string | null;
  startMinute: number;
  endMinute: number;
  /** The sentence a service manager reads and argues with. */
  why: string;
}

export type UnplacedReason =
  'NOBODY_QUALIFIED' | 'NO_ROOM' | 'NO_BAY' | 'WAITING_ON_PARTS' | 'TOO_LONG';

export interface Unplaced {
  itemId: string;
  label: string;
  reason: UnplacedReason;
  why: string;
}

export interface DayPlan {
  assignments: Assignment[];
  unplaced: Unplaced[];
  /** Minutes placed over minutes offered, for the summary line. */
  placedMinutes: number;
  offeredMinutes: number;
  summary: string;
}

function clashes(
  spans: readonly { startMinute: number; endMinute: number }[],
  start: number,
  end: number,
): boolean {
  return spans.some((span) => start < span.endMinute && end > span.startMinute);
}

/**
 * The earliest point in a window where a span of the given length fits.
 *
 * Walks the committed spans in order rather than probing minute by minute, so
 * this is linear in what is already booked rather than in the length of the
 * day.
 */
function earliestFit(
  windowStart: number,
  windowEnd: number,
  committed: readonly { startMinute: number; endMinute: number }[],
  minutes: number,
  notBefore: number,
): number | null {
  let cursor = Math.max(windowStart, notBefore);

  const ordered = [...committed].sort((a, b) => a.startMinute - b.startMinute);

  for (const span of ordered) {
    if (span.endMinute <= cursor) continue;
    if (span.startMinute - cursor >= minutes) return cursor;
    cursor = Math.max(cursor, span.endMinute);
  }

  return cursor + minutes <= windowEnd ? cursor : null;
}

function names(requirements: readonly Requirement[]): string {
  return requirements.map((requirement) => requirement.skillName.toLowerCase()).join(' and ');
}

/**
 * The plan.
 *
 * Longest first, within promise order. Packing the long jobs first is what
 * stops a six-hour clutch being the thing left over at four o'clock with
 * nowhere to go, and it is the single decision that most affects how much of
 * the day gets used.
 *
 * The chosen technician is the least loaded of those qualified, and among
 * equals the one whose skill level is lowest while still sufficient. That
 * second rule is deliberate and is how a workshop actually runs: an expert
 * kept free is an expert available for the thing that goes wrong at eleven.
 *
 * Cost is items times technicians times what each already holds. For a day in
 * one workshop that is tens times tens times tens, which is nothing; it is
 * written down because the shape is what would change if this were ever run
 * across a group of sites at once.
 */
export function planDay(input: {
  items: readonly WorkItem[];
  technicians: readonly Technician[];
  bays: readonly Bay[];
  /** Minutes from midnight the workshop opens and closes. */
  openMinute: number;
  closeMinute: number;
}): DayPlan {
  const assignments: Assignment[] = [];
  const unplaced: Unplaced[] = [];

  // Working copies, so the caller's arrays are not mutated as the day fills.
  const technicians = input.technicians.map((technician) => ({
    ...technician,
    committed: [...technician.committed],
  }));
  const bays = input.bays.map((bay) => ({ ...bay, committed: [...bay.committed] }));

  const queue = [...input.items].sort((a, b) => {
    const aPromise = a.promisedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const bPromise = b.promisedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (aPromise !== bPromise) return aPromise - bPromise;
    return b.minutes - a.minutes;
  });

  const offeredMinutes = queue.reduce((total, item) => total + item.minutes, 0);

  for (const item of queue) {
    if (item.waitingOnParts) {
      unplaced.push({
        itemId: item.id,
        label: item.label,
        reason: 'WAITING_ON_PARTS',
        why: 'The parts are not on the shelf. Scheduling it would promise a day nobody can keep.',
      });
      continue;
    }

    if (item.minutes > input.closeMinute - input.openMinute) {
      unplaced.push({
        itemId: item.id,
        label: item.label,
        reason: 'TOO_LONG',
        why: `It needs ${(item.minutes / 60).toFixed(1)} hours and the workshop is not open that long. It has to run across two days.`,
      });
      continue;
    }

    const qualified = technicians.filter((technician) =>
      item.requirements.every((requirement) =>
        meets(technician.skills.get(requirement.skillId), requirement.minimumLevel),
      ),
    );

    if (qualified.length === 0) {
      unplaced.push({
        itemId: item.id,
        label: item.label,
        reason: 'NOBODY_QUALIFIED',
        why: item.requirements.length
          ? `Nobody in today is signed off on ${names(item.requirements)}. It waits, goes out, or somebody gets signed off.`
          : 'Nobody is in today.',
      });
      continue;
    }

    // Least loaded first; among equals, the lowest sufficient skill, so the
    // experts stay free for whatever comes through the door at eleven.
    const ranked = [...qualified].sort((a, b) => {
      const aLoad = a.committed.reduce((sum, span) => sum + (span.endMinute - span.startMinute), 0);
      const bLoad = b.committed.reduce((sum, span) => sum + (span.endMinute - span.startMinute), 0);
      if (aLoad !== bLoad) return aLoad - bLoad;

      const depth = (technician: (typeof technicians)[number]) =>
        item.requirements.reduce(
          (sum, requirement) => sum + RANK[technician.skills.get(requirement.skillId)!],
          0,
        );

      return depth(a) - depth(b);
    });

    let placed = false;

    for (const technician of ranked) {
      const windowStart = Math.max(technician.startMinute, input.openMinute);
      const windowEnd = Math.min(technician.endMinute, input.closeMinute);

      const start = earliestFit(
        windowStart,
        windowEnd,
        technician.committed,
        item.minutes,
        windowStart,
      );

      if (start === null) continue;

      const end = start + item.minutes;

      const bay = bays.find(
        (candidate) =>
          (!item.needsCapability || candidate.capability === item.needsCapability) &&
          !clashes(candidate.committed, start, end),
      );

      if (!bay) continue;

      technician.committed.push({ startMinute: start, endMinute: end });
      bay.committed.push({ startMinute: start, endMinute: end });

      const reason = item.requirements.length
        ? `${technician.name} is signed off on ${names(item.requirements)} and has the longest clear run.`
        : `${technician.name} has the longest clear run.`;

      assignments.push({
        itemId: item.id,
        label: item.label,
        employeeId: technician.employeeId,
        technicianName: technician.name,
        bayId: bay.bayId,
        bayName: bay.name,
        startMinute: start,
        endMinute: end,
        why: `${reason} ${bay.name} is free from ${clock(start)}.`,
      });

      placed = true;
      break;
    }

    if (!placed) {
      const anyBay = bays.some(
        (bay) => !item.needsCapability || bay.capability === item.needsCapability,
      );

      unplaced.push({
        itemId: item.id,
        label: item.label,
        reason: anyBay ? 'NO_ROOM' : 'NO_BAY',
        why: anyBay
          ? `Everybody qualified is full for the day. It needs ${(item.minutes / 60).toFixed(1)} hours in one run and there is no gap that long.`
          : `No bay here can take it: it needs ${item.needsCapability}.`,
      });
    }
  }

  const placedMinutes = assignments.reduce(
    (total, assignment) => total + (assignment.endMinute - assignment.startMinute),
    0,
  );

  return {
    assignments: assignments.sort((a, b) => a.startMinute - b.startMinute),
    unplaced,
    placedMinutes,
    offeredMinutes,
    summary:
      assignments.length === 0
        ? 'Nothing could be placed.'
        : unplaced.length === 0
          ? `All ${assignments.length} placed, ${(placedMinutes / 60).toFixed(1)} hours of work.`
          : `${assignments.length} placed, ${unplaced.length} left over. Each one says why.`,
  };
}

/** Minutes from midnight as a time somebody would read. */
export function clock(minute: number): string {
  const hour = Math.floor(minute / 60);
  const rest = minute % 60;
  return `${String(hour).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

/**
 * The matrix itself: every person against every skill.
 *
 * Built here rather than in the page, because the thing that makes it useful
 * is the gaps, and a gap is only visible once every skill is a column even
 * when nobody has it.
 */
export function skillMatrix(input: {
  people: readonly { employeeId: string; name: string }[];
  skills: readonly { skillId: string; name: string }[];
  held: readonly { employeeId: string; skillId: string; level: SkillLevel }[];
}): {
  skills: { skillId: string; name: string; cover: number; only: string | null }[];
  rows: { employeeId: string; name: string; levels: (SkillLevel | null)[] }[];
} {
  const index = new Map(
    input.held.map((entry) => [`${entry.employeeId}:${entry.skillId}`, entry.level]),
  );

  const rows = input.people.map((person) => ({
    employeeId: person.employeeId,
    name: person.name,
    levels: input.skills.map((skill) => index.get(`${person.employeeId}:${skill.skillId}`) ?? null),
  }));

  const skills = input.skills.map((skill, column) => {
    const able = rows.filter((row) => row.levels[column] !== null);

    return {
      skillId: skill.skillId,
      name: skill.name,
      cover: able.length,
      // The number that matters on this screen is one. A skill only one
      // person has is a skill the workshop loses the day they are ill.
      only: able.length === 1 ? able[0]!.name : null,
    };
  });

  return { skills, rows };
}
