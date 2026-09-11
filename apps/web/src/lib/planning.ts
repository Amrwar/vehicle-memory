import {
  type AbsenceSpan,
  type Bay,
  capacityFor,
  type DayCapacity,
  type DayPlan,
  planDay,
  type Requirement,
  type SkillLevel,
  skillMatrix,
  type Technician,
  type Weekday,
  type WorkItem,
  type WorkingPattern,
  weekdayOf,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * What the workshop can take, who can do what, and a day put together from
 * both.
 *
 * All three read from records the product already keeps: working patterns,
 * approved absences, bookings, bays, job types and the skills a workshop has
 * signed people off on. Nothing here is a separate plan that has to be kept
 * in step with reality.
 *
 * The arithmetic itself lives in `@carnet/core` and is tested there against
 * fixtures. This file is the part that can be wrong about which rows to feed
 * it, which is the other half of getting it right and is covered by
 * `verify-planning.ts`.
 */

/** Work that is in the building and not finished. */
const LIVE = ['RECEIVED', 'INSPECTING', 'DIAGNOSED', 'IN_PROGRESS', 'QUALITY_CHECK'] as const;

/** Bookings that still mean somebody is coming. */
const EXPECTED = ['SCHEDULED', 'CONFIRMED', 'ARRIVED'] as const;

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

function minutesFromMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Everything the capacity arithmetic needs, for one site on one day. */
async function gather(orgId: string, locationId: string | null, date: Date) {
  const from = startOfDay(date);
  const to = endOfDay(date);

  const [employees, patterns, absences, bookings, jobs, bays] = await Promise.all([
    prisma.employee.findMany({
      where: {
        orgId,
        isActive: true,
        ...(locationId ? { locationId } : {}),
        // Only people who could take a job. A bookkeeper's hours are not
        // workshop capacity, and counting them produces a day that looks
        // roomy and is not.
        skills: { some: {} },
      },
      select: { id: true, displayName: true, userId: true },
    }),

    prisma.workingPattern.findMany({
      where: { orgId },
      select: {
        employeeId: true,
        weekday: true,
        startMinute: true,
        endMinute: true,
        breakMinutes: true,
      },
    }),

    prisma.absence.findMany({
      where: { orgId, approved: true, startsOn: { lte: to }, endsOn: { gte: from } },
      select: { employeeId: true, startsOn: true, endsOn: true },
    }),

    prisma.booking.findMany({
      where: {
        orgId,
        ...(locationId ? { locationId } : {}),
        status: { in: [...EXPECTED] },
        startAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        description: true,
        startAt: true,
        endAt: true,
        estimatedHours: true,
        technicianId: true,
        bayId: true,
      },
    }),

    prisma.job.findMany({
      where: { orgId, ...(locationId ? { locationId } : {}), status: { in: [...LIVE] } },
      select: {
        id: true,
        number: true,
        shortDescription: true,
        estimatedHours: true,
        promisedAt: true,
        bayId: true,
        technicians: { select: { userId: true } },
        jobTypes: {
          select: {
            jobType: {
              select: {
                name: true,
                skills: {
                  select: { minimumLevel: true, skill: { select: { id: true, name: true } } },
                },
              },
            },
          },
        },
        // A job whose parts are requested but not on the shelf cannot be
        // scheduled honestly, whatever the diary says.
        partLines: { select: { status: true } },
      },
    }),

    prisma.bay.findMany({
      where: { isActive: true, location: { orgId, ...(locationId ? { id: locationId } : {}) } },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, capability: true },
    }),
  ]);

  return { employees, patterns, absences, bookings, jobs, bays };
}

export interface DayView extends DayCapacity {
  locationName: string | null;
  bays: number;
}

/**
 * One day's capacity.
 *
 * The site's open hours are taken as eight to six rather than stored, because
 * the product has nowhere to put them yet and inventing a table for a single
 * pair of numbers would be worse than naming the assumption here. When
 * opening hours arrive, this is the one place that changes.
 */
const OPEN_MINUTE = 8 * 60;
const CLOSE_MINUTE = 18 * 60;

export async function capacityOn(
  orgId: string,
  locationId: string | null,
  date: Date,
): Promise<DayView> {
  const { employees, patterns, absences, bookings, jobs, bays } = await gather(
    orgId,
    locationId,
    date,
  );

  const byUser = new Map(
    employees
      .filter((employee) => employee.userId)
      .map((employee) => [employee.userId!, employee.id]),
  );

  const booked = [
    ...bookings.map((booking) => ({
      employeeId: booking.technicianId ? (byUser.get(booking.technicianId) ?? null) : null,
      minutes: Math.round(Number(booking.estimatedHours) * 60),
    })),
    // Work already in the building counts against the same hours. A day that
    // measured only new bookings would call a workshop empty while six cars
    // sat on the ramps.
    ...jobs.map((job) => ({
      employeeId: job.technicians[0]?.userId
        ? (byUser.get(job.technicians[0].userId) ?? null)
        : null,
      minutes: Math.round(Number(job.estimatedHours ?? 1) * 60),
    })),
  ];

  const location = locationId
    ? await prisma.location.findUnique({ where: { id: locationId }, select: { name: true } })
    : null;

  const capacity = capacityFor({
    date,
    people: employees.map((employee) => ({
      employeeId: employee.id,
      name: employee.displayName,
    })),
    patterns: patterns.map((pattern) => ({
      ...pattern,
      weekday: pattern.weekday as Weekday,
    })) satisfies WorkingPattern[],
    absences: absences satisfies AbsenceSpan[],
    bays: bays.length,
    openMinutes: CLOSE_MINUTE - OPEN_MINUTE,
    booked,
  });

  return { ...capacity, locationName: location?.name ?? null, bays: bays.length };
}

/** The next several days, for finding somewhere to move something to. */
export async function capacityAhead(
  orgId: string,
  locationId: string | null,
  from: Date,
  days = 7,
): Promise<DayView[]> {
  const dates = Array.from({ length: days }, (_, index) => {
    const date = startOfDay(from);
    date.setDate(date.getDate() + index);
    return date;
  });

  // Sequential rather than parallel. Seven days is seven small queries either
  // way, and firing thirty-five at once at a pooled connection to save a few
  // milliseconds is how a page starts timing out under load.
  const views: DayView[] = [];
  for (const date of dates) views.push(await capacityOn(orgId, locationId, date));

  return views;
}

/**
 * A proposed day.
 *
 * It proposes and a person accepts. Nothing here writes: the same rule the
 * arrival suggestions and the mileage findings follow, and the reason this
 * can be useful before it is perfect.
 */
export async function proposeDay(
  orgId: string,
  locationId: string | null,
  date: Date,
): Promise<DayPlan & { date: Date }> {
  const { employees, patterns, absences, bookings, jobs, bays } = await gather(
    orgId,
    locationId,
    date,
  );

  const weekday = weekdayOf(date);

  const held = await prisma.employeeSkill.findMany({
    where: { employee: { orgId } },
    select: { employeeId: true, skillId: true, level: true },
  });

  const skillsByEmployee = new Map<string, Map<string, SkillLevel>>();
  for (const entry of held) {
    const map = skillsByEmployee.get(entry.employeeId) ?? new Map<string, SkillLevel>();
    map.set(entry.skillId, entry.level as SkillLevel);
    skillsByEmployee.set(entry.employeeId, map);
  }

  const technicians: Technician[] = employees
    .map((employee) => {
      const pattern = patterns.find(
        (entry) => entry.employeeId === employee.id && entry.weekday === weekday,
      );

      if (!pattern) return null;
      if (absences.some((absence) => absence.employeeId === employee.id)) return null;

      return {
        employeeId: employee.id,
        name: employee.displayName,
        startMinute: pattern.startMinute,
        endMinute: pattern.endMinute,
        skills: skillsByEmployee.get(employee.id) ?? new Map<string, SkillLevel>(),
        // Bookings already fixed to this person are immovable as far as the
        // plan is concerned. Somebody has been told a time.
        committed: bookings
          .filter((booking) => booking.technicianId && employee.userId === booking.technicianId)
          .map((booking) => ({
            startMinute: minutesFromMidnight(booking.startAt),
            endMinute: minutesFromMidnight(booking.endAt),
          })),
      };
    })
    .filter((technician) => technician !== null);

  const bayList: Bay[] = bays.map((bay) => ({
    bayId: bay.id,
    name: bay.name,
    capability: bay.capability,
    committed: bookings
      .filter((booking) => booking.bayId === bay.id)
      .map((booking) => ({
        startMinute: minutesFromMidnight(booking.startAt),
        endMinute: minutesFromMidnight(booking.endAt),
      })),
  }));

  const items: WorkItem[] = jobs.map((job) => {
    const requirements: Requirement[] = job.jobTypes.flatMap((entry) =>
      entry.jobType.skills.map((requirement) => ({
        skillId: requirement.skill.id,
        skillName: requirement.skill.name,
        minimumLevel: requirement.minimumLevel as SkillLevel,
      })),
    );

    return {
      id: job.id,
      label: `#${job.number} ${job.shortDescription}`,
      minutes: Math.max(15, Math.round(Number(job.estimatedHours ?? 1) * 60)),
      requirements,
      promisedAt: job.promisedAt,
      waitingOnParts: job.partLines.some((line) => line.status === 'REQUESTED'),
    };
  });

  const plan = planDay({
    items,
    technicians,
    bays: bayList,
    openMinute: OPEN_MINUTE,
    closeMinute: CLOSE_MINUTE,
  });

  return { ...plan, date };
}

/** Every person against every skill, gaps included. */
export async function matrixFor(orgId: string) {
  const [employees, skills, held] = await Promise.all([
    prisma.employee.findMany({
      where: { orgId, isActive: true },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, jobTitle: true },
    }),
    prisma.skill.findMany({
      where: { orgId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, note: true },
    }),
    prisma.employeeSkill.findMany({
      where: { employee: { orgId } },
      select: { employeeId: true, skillId: true, level: true, assessedOn: true },
    }),
  ]);

  const matrix = skillMatrix({
    people: employees.map((employee) => ({
      employeeId: employee.id,
      name: employee.displayName,
    })),
    skills: skills.map((skill) => ({ skillId: skill.id, name: skill.name })),
    held: held.map((entry) => ({ ...entry, level: entry.level as SkillLevel })),
  });

  return {
    ...matrix,
    notes: new Map(skills.map((skill) => [skill.id, skill.note])),
    titles: new Map(employees.map((employee) => [employee.id, employee.jobTitle])),
  };
}

/**
 * Signs somebody off, or takes it back.
 *
 * A level of nothing deletes the row rather than storing an absence, because
 * a row saying "cannot" and no row at all are two ways of writing the same
 * fact and they would eventually disagree.
 */
export async function setSkill(input: {
  orgId: string;
  userId: string;
  employeeId: string;
  skillId: string;
  level: SkillLevel | null;
  note?: string | null;
}) {
  // Both rows checked against the organisation before anything is written: an
  // id in a form field is a value the browser chose.
  const [employee, skill] = await Promise.all([
    prisma.employee.findFirst({ where: { id: input.employeeId, orgId: input.orgId } }),
    prisma.skill.findFirst({ where: { id: input.skillId, orgId: input.orgId } }),
  ]);

  if (!employee || !skill) throw new Error('That person or skill is not in this workshop.');

  if (input.level === null) {
    await prisma.employeeSkill.deleteMany({
      where: { employeeId: input.employeeId, skillId: input.skillId },
    });
  } else {
    await prisma.employeeSkill.upsert({
      where: {
        employeeId_skillId: { employeeId: input.employeeId, skillId: input.skillId },
      },
      create: {
        employeeId: input.employeeId,
        skillId: input.skillId,
        level: input.level,
        assessedByUserId: input.userId,
        note: input.note?.trim() || null,
      },
      update: {
        level: input.level,
        assessedOn: new Date(),
        assessedByUserId: input.userId,
        note: input.note?.trim() || null,
      },
    });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: input.level ? 'skill.signed-off' : 'skill.withdrawn',
    entityType: 'Employee',
    entityId: input.employeeId,
    after: { skill: skill.name, level: input.level },
  });
}

/** Adds a skill to the workshop's own vocabulary. */
export async function addSkill(input: {
  orgId: string;
  userId: string;
  name: string;
  note?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error('A skill needs a name.');

  const existing = await prisma.skill.findFirst({
    where: { orgId: input.orgId, name: { equals: name, mode: 'insensitive' } },
    select: { id: true, isActive: true },
  });

  if (existing) {
    // Reactivate rather than refuse. Somebody adding a skill that was
    // retired last year means to have it back, and a duplicate-name error
    // would leave them with no way to get it.
    if (!existing.isActive) {
      await prisma.skill.update({ where: { id: existing.id }, data: { isActive: true } });
    }
    return existing.id;
  }

  const skill = await prisma.skill.create({
    data: { orgId: input.orgId, name, note: input.note?.trim() || null },
    select: { id: true },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'skill.added',
    entityType: 'Skill',
    entityId: skill.id,
    after: { name },
  });

  return skill.id;
}

/** Records when somebody is contracted to be here. */
export async function setPattern(input: {
  orgId: string;
  userId: string;
  employeeId: string;
  weekday: Weekday;
  startMinute: number | null;
  endMinute: number | null;
  breakMinutes?: number;
}) {
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, orgId: input.orgId },
  });

  if (!employee) throw new Error('That person is not in this workshop.');

  // A day with no hours is a day they are not in, so the row goes rather than
  // being stored as zero to zero. The database would refuse that anyway.
  if (input.startMinute === null || input.endMinute === null) {
    await prisma.workingPattern.deleteMany({
      where: { employeeId: input.employeeId, weekday: input.weekday },
    });
  } else {
    const data = {
      orgId: input.orgId,
      employeeId: input.employeeId,
      weekday: input.weekday,
      startMinute: input.startMinute,
      endMinute: input.endMinute,
      breakMinutes: input.breakMinutes ?? 0,
    };

    await prisma.workingPattern.upsert({
      where: { employeeId_weekday: { employeeId: input.employeeId, weekday: input.weekday } },
      create: data,
      update: data,
    });
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'working-pattern.set',
    entityType: 'Employee',
    entityId: input.employeeId,
    after: { weekday: input.weekday, start: input.startMinute, end: input.endMinute },
  });
}

/** The patterns as a week, for the screen that edits them. */
export async function patternsFor(orgId: string) {
  const [employees, patterns] = await Promise.all([
    prisma.employee.findMany({
      where: { orgId, isActive: true },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true, jobTitle: true },
    }),
    prisma.workingPattern.findMany({
      where: { orgId },
      select: {
        employeeId: true,
        weekday: true,
        startMinute: true,
        endMinute: true,
        breakMinutes: true,
      },
    }),
  ]);

  return employees.map((employee) => ({
    employeeId: employee.id,
    name: employee.displayName,
    jobTitle: employee.jobTitle,
    week: ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map(
      (weekday) =>
        patterns.find(
          (pattern) => pattern.employeeId === employee.id && pattern.weekday === weekday,
        ) ?? null,
    ),
  }));
}
