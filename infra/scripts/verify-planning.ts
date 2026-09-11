/**
 * Capacity, skills and the proposed day, against a real database.
 *
 *   npx tsx infra/scripts/verify-planning.ts
 *
 * The unit tests prove the arithmetic against fixtures. They cannot prove
 * that the right rows reach it, and that is where a planning figure goes
 * wrong: the sums are right, and the query counted the bookkeeper's hours as
 * workshop capacity, or missed the holiday, or read every site at once.
 *
 * A wrong number here does not show up as an error. It shows up as a day that
 * was promised to a customer and cannot be kept, so the checks below are
 * about which rows are counted and which are not.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import {
  capacityOn,
  matrixFor,
  proposeDay,
  setPattern,
  setSkill,
} from '../../apps/web/src/lib/planning';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refuses(label: string, constraint: string, sql: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(sql);
    failures += 1;
    console.error(`  FAIL   ${label}: the database accepted it`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes(constraint)) {
      console.info(`  ok     ${label}: refused by ${constraint}`);
    } else {
      failures += 1;
      console.error(`  FAIL   ${label}: refused, but not by ${constraint}. Got: ${message}`);
    }
  }
}

/** The next Tuesday, so the day under test is never a weekend. */
function nextTuesday(): Date {
  const date = new Date();
  date.setHours(9, 0, 0, 0);
  while (date.getDay() !== 2) date.setDate(date.getDate() + 1);
  return date;
}

const PROBE = 'Verify planning probe';

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const user = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true },
  });
  const location = await prisma.location.findFirstOrThrow({
    where: { orgId: org.id, isDefault: true },
    select: { id: true },
  });

  await prisma.skill.deleteMany({ where: { orgId: org.id, name: { startsWith: PROBE } } });

  const tuesday = nextTuesday();

  console.info('\nThe matrix, and the gaps in it');

  const matrix = await matrixFor(org.id);

  check('every skill keeps a column', matrix.skills.length > 0, true);
  check(
    'a row exists for every person, signed off or not',
    matrix.rows.every((row) => row.levels.length === matrix.skills.length),
    true,
  );

  const alone = matrix.skills.filter((skill) => skill.only !== null);
  const nobody = matrix.skills.filter((skill) => skill.cover === 0);

  check('a skill resting on one person is named', alone.length > 0, true);
  check('and a skill nobody holds is still a column', nobody.length > 0, true);

  console.info('\nWhat counts as capacity');

  const before = await capacityOn(org.id, location.id, tuesday);
  check('somebody is working on a Tuesday', before.peopleMinutes > 0, true);

  // The bookkeeper is not workshop capacity. Counting her hours makes the day
  // look roomy and produces a promise nobody can keep.
  const bookkeeper = await prisma.employee.findFirst({
    where: { orgId: org.id, reference: 'EMP-005' },
    select: { id: true, displayName: true },
  });

  if (bookkeeper) {
    check(
      'somebody with no skills is not counted as a technician',
      before.people.some((person) => person.employeeId === bookkeeper.id),
      false,
    );
  }

  console.info('\nHoliday comes off');

  const technician = await prisma.employee.findFirstOrThrow({
    where: { orgId: org.id, reference: 'EMP-001' },
    select: { id: true, displayName: true },
  });

  const absence = await prisma.absence.create({
    data: {
      orgId: org.id,
      employeeId: technician.id,
      type: 'HOLIDAY',
      startsOn: tuesday,
      endsOn: tuesday,
      days: 1,
      approved: true,
      note: PROBE,
    },
  });

  const onHoliday = await capacityOn(org.id, location.id, tuesday);

  check('the day lost their hours', onHoliday.peopleMinutes < before.peopleMinutes, true);
  check('and they are counted as away', onHoliday.absent >= 1, true);
  check(
    'with no utilisation rather than nought per cent',
    onHoliday.people.find((person) => person.employeeId === technician.id)?.utilisation,
    null,
  );

  console.info('\nAn unapproved holiday does not');

  await prisma.absence.update({ where: { id: absence.id }, data: { approved: false } });

  const unapproved = await capacityOn(org.id, location.id, tuesday);
  check('their hours come back', unapproved.peopleMinutes, before.peopleMinutes);

  await prisma.absence.delete({ where: { id: absence.id } });

  console.info('\nThe proposed day');

  const plan = await proposeDay(org.id, location.id, tuesday);

  check('it produced something', plan.assignments.length + plan.unplaced.length > 0, true);
  check(
    'every placement names a person and a bay',
    plan.assignments.every((assignment) => assignment.technicianName && assignment.bayName),
    true,
  );
  check(
    'every placement carries its reason',
    plan.assignments.every((assignment) => assignment.why.length > 20),
    true,
  );
  check(
    'so does everything left over',
    plan.unplaced.every((entry) => entry.why.length > 20),
    true,
  );
  check(
    'nothing runs past the end of the day',
    plan.assignments.every((assignment) => assignment.endMinute <= 18 * 60),
    true,
  );

  // The failure this whole module exists to prevent, checked against real
  // rows rather than fixtures: nobody is given work they are not signed off
  // on.
  const held = await prisma.employeeSkill.findMany({
    where: { employee: { orgId: org.id } },
    select: { employeeId: true, skillId: true, level: true },
  });

  const rank = { LEARNING: 1, COMPETENT: 2, EXPERT: 3 } as const;

  let unqualified = 0;

  for (const assignment of plan.assignments) {
    const job = await prisma.job.findUnique({
      where: { id: assignment.itemId },
      select: {
        jobTypes: {
          select: {
            jobType: { select: { skills: { select: { skillId: true, minimumLevel: true } } } },
          },
        },
      },
    });

    for (const entry of job?.jobTypes ?? []) {
      for (const requirement of entry.jobType.skills) {
        const level = held.find(
          (row) => row.employeeId === assignment.employeeId && row.skillId === requirement.skillId,
        )?.level;

        if (!level || rank[level] < rank[requirement.minimumLevel]) unqualified += 1;
      }
    }
  }

  check('nobody was given work they are not signed off on', unqualified, 0);

  // Two bays cannot hold the same car at the same time.
  const byBay = new Map<string, { startMinute: number; endMinute: number }[]>();
  let clashes = 0;

  for (const assignment of plan.assignments) {
    const held = byBay.get(assignment.bayId!) ?? [];
    if (
      held.some(
        (span) =>
          assignment.startMinute < span.endMinute && assignment.endMinute > span.startMinute,
      )
    ) {
      clashes += 1;
    }
    held.push(assignment);
    byBay.set(assignment.bayId!, held);
  }

  check('no bay is double-booked', clashes, 0);

  console.info('\nSigning somebody off, and taking it back');

  const skill = await prisma.skill.create({
    data: { orgId: org.id, name: `${PROBE} skill`, sortOrder: 99 },
    select: { id: true },
  });

  await setSkill({
    orgId: org.id,
    userId: user.id,
    employeeId: technician.id,
    skillId: skill.id,
    level: 'EXPERT',
  });

  const signed = await prisma.employeeSkill.count({
    where: { employeeId: technician.id, skillId: skill.id },
  });
  check('the sign-off is recorded', signed, 1);

  // Withdrawing deletes the row rather than storing a "cannot", because a row
  // asserting an absence and no row at all would eventually disagree.
  await setSkill({
    orgId: org.id,
    userId: user.id,
    employeeId: technician.id,
    skillId: skill.id,
    level: null,
  });

  const withdrawn = await prisma.employeeSkill.count({
    where: { employeeId: technician.id, skillId: skill.id },
  });
  check('withdrawing removes the row rather than storing a cannot', withdrawn, 0);

  console.info('\nA day with no hours');

  await setPattern({
    orgId: org.id,
    userId: user.id,
    employeeId: technician.id,
    weekday: 6,
    startMinute: 9 * 60,
    endMinute: 13 * 60,
  });

  const saturday = await prisma.workingPattern.count({
    where: { employeeId: technician.id, weekday: 6 },
  });
  check('a Saturday morning is recorded', saturday, 1);

  await setPattern({
    orgId: org.id,
    userId: user.id,
    employeeId: technician.id,
    weekday: 6,
    startMinute: null,
    endMinute: null,
  });

  const cleared = await prisma.workingPattern.count({
    where: { employeeId: technician.id, weekday: 6 },
  });
  check('clearing it removes the row rather than storing nought to nought', cleared, 0);

  console.info('\nThe database, underneath it');

  const columns = '("id","orgId","employeeId","weekday","startMinute","endMinute","updatedAt")';

  await refuses(
    'a weekday of nought',
    'working_patterns_weekday_is_iso',
    `INSERT INTO "working_patterns" ${columns} VALUES ('vfy-plan-1','${org.id}','${technician.id}',0,480,1020,NOW())`,
  );

  await refuses(
    'a shift that ends before it starts',
    'working_patterns_is_a_real_shift',
    `INSERT INTO "working_patterns" ${columns} VALUES ('vfy-plan-2','${org.id}','${technician.id}',6,1020,480,NOW())`,
  );

  await refuses(
    'a break longer than the shift',
    'working_patterns_is_a_real_shift',
    `INSERT INTO "working_patterns" ("id","orgId","employeeId","weekday","startMinute","endMinute","breakMinutes","updatedAt")
     VALUES ('vfy-plan-3','${org.id}','${technician.id}',6,480,540,120,NOW())`,
  );

  await refuses(
    'a skill with no name',
    'skills_have_a_name',
    `INSERT INTO "skills" ("id","orgId","name","updatedAt") VALUES ('vfy-plan-4','${org.id}','   ',NOW())`,
  );

  await refuses(
    'a sign-off dated next year',
    'employee_skills_assessed_in_the_past',
    `INSERT INTO "employee_skills" ("id","employeeId","skillId","level","assessedOn","updatedAt")
     VALUES ('vfy-plan-5','${technician.id}','${skill.id}','EXPERT',NOW() + interval '60 days',NOW())`,
  );

  await prisma.skill.deleteMany({ where: { orgId: org.id, name: { startsWith: PROBE } } });
  await prisma.absence.deleteMany({ where: { note: PROBE } });

  const left = await prisma.skill.count({ where: { orgId: org.id, name: { startsWith: PROBE } } });
  check('the probe left nothing behind', left, 0);

  console.info(failures === 0 ? '\nPlanning behaved correctly.' : `\n${failures} check(s) FAILED.`);

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
