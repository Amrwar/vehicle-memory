/**
 * The courtesy car. Phase 67. FR-512.
 *
 *   npx tsx infra/scripts/verify-courtesy.ts
 *
 * FR-512 has been Partial since the beginning: `Job.courtesyVehicleNote` is a
 * place to type "gave them the Fiesta", nothing has ever read or written it,
 * and nothing knew whether the Fiesta was free.
 *
 * The claim this phase makes is not "a loan can be recorded". It is that the
 * same car cannot be promised to two people over the same days — and that is a
 * claim about a database constraint, which is the one kind of claim a unit
 * test cannot make. The rules in core are tested against fixtures; what is
 * tested here is that Postgres refuses.
 *
 * Including the case the application check cannot cover. Two people booking at
 * the same moment both read before either writes, so the check in `lend()`
 * passes twice and one of the two writes has to be stopped by the table
 * itself. That is simulated below by writing straight past the application.
 */

import 'dotenv/config';

import { randomBytes } from 'node:crypto';

import { describeLoan, freeOver, loanStanding } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  callOff,
  CourtesyError,
  courtesyOverdue,
  fleetFor,
  freeBetween,
  lend,
  loansForJob,
  loansOut,
  takeBack,
} from '../../apps/web/src/lib/courtesy';

let failures = 0;
let checked = 0;

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `\n        ${String(detail)}`}`);
  }
}

const tag = randomBytes(5).toString('hex').toUpperCase();

function days(from: number, to: number): { startAt: Date; dueBackAt: Date } {
  const startAt = new Date();
  startAt.setDate(startAt.getDate() + from);
  startAt.setHours(9, 0, 0, 0);
  const dueBackAt = new Date();
  dueBackAt.setDate(dueBackAt.getDate() + to);
  dueBackAt.setHours(17, 0, 0, 0);
  return { startAt, dueBackAt };
}

async function main() {
  console.info('\n  The courtesy car\n');

  const org = await prisma.organization.create({
    data: {
      slug: `courtesy-${tag.toLowerCase()}`,
      name: `Courtesy ${tag}`,
      country: 'GB',
      baseCurrency: 'GBP',
      locale: 'en-GB',
      timezone: 'Europe/London',
      locations: { create: [{ name: `Site ${tag}`, code: `C${tag.slice(0, 4)}` }] },
    },
    select: { id: true, locations: { select: { id: true } } },
  });

  const advisor = await prisma.user.create({
    data: {
      email: `advisor-${tag.toLowerCase()}@example.com`,
      name: `Advisor ${tag}`,
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true },
  });

  await prisma.membership.create({
    data: { userId: advisor.id, orgId: org.id, role: 'SERVICE_ADVISOR' },
  });

  const [maria, david] = await Promise.all([
    prisma.customer.create({
      data: { orgId: org.id, kind: 'INDIVIDUAL', displayName: `Maria ${tag}` },
      select: { id: true },
    }),
    prisma.customer.create({
      data: { orgId: org.id, kind: 'INDIVIDUAL', displayName: `David ${tag}` },
      select: { id: true },
    }),
  ]);

  const [fiestaVehicle, corsaVehicle, lapsedVehicle] = await Promise.all([
    prisma.vehicle.create({
      data: {
        vin: `CFI${tag}0000000`.slice(0, 17),
        registration: `CF${tag.slice(0, 5)}`,
        make: 'Ford',
        model: 'Fiesta',
        colour: 'Silver',
      },
      select: { id: true },
    }),
    prisma.vehicle.create({
      data: {
        vin: `CCO${tag}0000000`.slice(0, 17),
        registration: `CC${tag.slice(0, 5)}`,
        make: 'Vauxhall',
        model: 'Corsa',
        colour: 'Blue',
      },
      select: { id: true },
    }),
    prisma.vehicle.create({
      data: {
        vin: `CLA${tag}0000000`.slice(0, 17),
        registration: `CL${tag.slice(0, 5)}`,
        make: 'Skoda',
        model: 'Fabia',
        colour: 'Red',
      },
      select: { id: true },
    }),
  ]);

  // One at a time, not in parallel: the fleet is listed oldest first, and
  // three rows written at once have no reliable order to be listed in.
  const fiesta = await prisma.courtesyVehicle.create({
    data: { orgId: org.id, vehicleId: fiestaVehicle.id, name: 'The silver Fiesta' },
    select: { id: true },
  });
  const corsa = await prisma.courtesyVehicle.create({
    data: { orgId: org.id, vehicleId: corsaVehicle.id },
    select: { id: true },
  });
  const lapsed = await prisma.courtesyVehicle.create({
    data: { orgId: org.id, vehicleId: lapsedVehicle.id },
    select: { id: true },
  });

  const fleet = await fleetFor(org.id);

  check(fleet.length === 3, 'a workshop can say which cars it lends', fleet.length);

  check(
    fleet[0]!.name === 'The silver Fiesta' && fleet[1]!.description === 'Blue Vauxhall Corsa',
    'and they are named the way the front desk would name them',
    fleet.map((car) => car.name ?? car.description).join(', '),
  );

  /* --- promising one -------------------------------------------------------- */

  const tuesday = days(3, 5);

  const first = await lend({
    orgId: org.id,
    userId: advisor.id,
    courtesyVehicleId: fiesta.id,
    customerId: maria.id,
    ...tuesday,
    odometerOutKm: 41_200,
  });

  check(Boolean(first.id), 'a car can be promised to somebody for a period');

  /* --- and not to two people ------------------------------------------------ */

  const clash = await lend({
    orgId: org.id,
    userId: advisor.id,
    courtesyVehicleId: fiesta.id,
    customerId: david.id,
    ...days(4, 6),
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof CourtesyError ? error.code : `wrong error: ${error}`),
  );

  check(
    clash === 'ALREADY_PROMISED',
    'the same car cannot be promised to somebody else over the same days',
    clash,
  );

  // The half that matters, and the half a unit test cannot reach: two people
  // booking at the same moment both pass the check above. Written straight at
  // the table, past the application, which is what a race actually looks like.
  const raced = await prisma.courtesyLoan
    .create({
      data: {
        orgId: org.id,
        courtesyVehicleId: fiesta.id,
        vehicleId: fiestaVehicle.id,
        customerId: david.id,
        ...days(4, 6),
      },
      select: { id: true },
    })
    .then(
      () => 'written',
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    );

  check(
    typeof raced === 'string' && raced.includes('courtesy_loans_no_overlap'),
    'and the database refuses it even when the application does not look',
    raced,
  );

  const backToBack = await lend({
    orgId: org.id,
    userId: advisor.id,
    courtesyVehicleId: fiesta.id,
    customerId: david.id,
    startAt: tuesday.dueBackAt,
    dueBackAt: days(7, 7).dueBackAt,
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof CourtesyError ? error.code : `wrong error: ${error}`),
  );

  check(
    backToBack === 'allowed',
    'but the moment one comes back, the next person can have it',
    backToBack,
  );

  /* --- which are free ------------------------------------------------------- */

  const { free, taken } = await freeBetween(org.id, tuesday.startAt, tuesday.dueBackAt);

  check(
    free.length === 2 && taken.length === 1 && taken[0]!.name === 'The silver Fiesta',
    'the workshop can see which cars are free before promising one',
    `free: ${free.length}, taken: ${taken.map((car) => car.name ?? car.description).join(', ')}`,
  );

  /* --- and whether it is legal to lend -------------------------------------- */

  const runsOut = new Date();
  runsOut.setDate(runsOut.getDate() + 4);

  await prisma.vehicleDocument.create({
    data: {
      vehicleId: lapsedVehicle.id,
      kind: 'MOT_CERTIFICATE',
      title: 'MOT',
      expiresAt: runsOut,
      fileKey: `probe/${tag}`,
      filename: 'mot.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1,
    },
  });

  const illegal = await lend({
    orgId: org.id,
    userId: advisor.id,
    courtesyVehicleId: lapsed.id,
    customerId: maria.id,
    ...days(3, 6),
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof CourtesyError ? error.message : `wrong error: ${error}`),
  );

  check(
    typeof illegal === 'string' && illegal.includes('MOT'),
    'a car whose MOT runs out mid-loan is refused, and the refusal says which',
    illegal,
  );

  const shortEnough = await lend({
    orgId: org.id,
    userId: advisor.id,
    courtesyVehicleId: lapsed.id,
    customerId: maria.id,
    ...days(1, 2),
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof CourtesyError ? error.message : `wrong error: ${error}`),
  );

  check(
    shortEnough === 'allowed',
    'and the same car is lendable for a period that ends before it lapses',
    shortEnough,
  );

  const unknown = await lend({
    orgId: org.id,
    userId: advisor.id,
    courtesyVehicleId: corsa.id,
    customerId: david.id,
    ...days(20, 22),
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof CourtesyError ? error.message : `wrong error: ${error}`),
  );

  check(
    unknown === 'allowed',
    'a car whose papers nobody uploaded is not called illegal, because nothing is known',
    unknown,
  );

  /* --- what is out ---------------------------------------------------------- */

  const overdueLoan = await prisma.courtesyLoan.create({
    data: {
      orgId: org.id,
      courtesyVehicleId: corsa.id,
      vehicleId: corsaVehicle.id,
      customerId: maria.id,
      ...days(-9, -4),
    },
    select: { id: true },
  });

  // Something out right now and not yet late, so the order below is a claim
  // about more than one row.
  await lend({
    orgId: org.id,
    userId: advisor.id,
    courtesyVehicleId: fiesta.id,
    customerId: david.id,
    ...days(-1, 1),
  });

  const out = await loansOut(org.id);

  check(
    out.length === 2 && out[0]!.id === overdueLoan.id,
    'what is still out is listed, longest overdue first',
    out.map((one) => `${one.customerName}: ${describeLoan(one)}`).join(' | '),
  );

  check(
    describeLoan(out[0]!) === '4 days overdue',
    'and it says how overdue, rather than showing a colour',
    describeLoan(out[0]!),
  );

  check((await courtesyOverdue(org.id)) === 1, 'the figure on the screen counts the late ones');

  /* --- taking it back ------------------------------------------------------- */

  await takeBack({
    orgId: org.id,
    userId: advisor.id,
    loanId: overdueLoan.id,
    odometerInKm: 62_410,
  });

  const afterwards = await prisma.courtesyLoan.findUniqueOrThrow({
    where: { id: overdueLoan.id },
    select: { returnedAt: true, odometerInKm: true, takenBackByUserId: true },
  });

  check(
    afterwards.returnedAt !== null && afterwards.takenBackByUserId === advisor.id,
    'a car can be taken back, with who took it',
  );

  check(afterwards.odometerInKm === 62_410, 'and what was on the clock when it came in');

  const twice = await takeBack({ orgId: org.id, userId: advisor.id, loanId: overdueLoan.id }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof CourtesyError ? error.code : `wrong error: ${error}`),
  );

  check(twice === 'ALREADY_BACK', 'and taking it back twice is refused', twice);

  // Brought back early, which is the other direction: the loan above came back
  // five days *late*, so its period correctly grew rather than shrank. A car
  // returned before it was due frees the days it would have been out.
  //
  // Its own car, with an empty diary. Threading this around the bookings above
  // would make the check depend on them, and then a change to one of those
  // would look like a failure here.
  const spareVehicle = await prisma.vehicle.create({
    data: {
      vin: `CSP${tag}0000000`.slice(0, 17),
      registration: `CS${tag.slice(0, 5)}`,
      make: 'Kia',
      model: 'Picanto',
      colour: 'White',
    },
    select: { id: true },
  });

  const spare = await prisma.courtesyVehicle.create({
    data: { orgId: org.id, vehicleId: spareVehicle.id },
    select: { id: true },
  });

  // Out since yesterday, promised back in ten days.
  const longLoan = await lend({
    orgId: org.id,
    userId: advisor.id,
    courtesyVehicleId: spare.id,
    customerId: maria.id,
    ...days(-1, 10),
  });

  // Back today, nine days early.
  await takeBack({ orgId: org.id, userId: advisor.id, loanId: longLoan.id });

  const afterReturn = await lend({
    orgId: org.id,
    userId: advisor.id,
    courtesyVehicleId: spare.id,
    customerId: david.id,
    ...days(3, 5),
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof CourtesyError ? error.code : `wrong error: ${error}`),
  );

  check(
    afterReturn === 'allowed',
    'a car brought back early is free for the days it would have been out',
    afterReturn,
  );

  /* --- calling one off ------------------------------------------------------ */

  const called = await prisma.courtesyLoan.findFirstOrThrow({
    where: {
      orgId: org.id,
      customerId: david.id,
      cancelledAt: null,
      returnedAt: null,
      startAt: { gt: new Date() },
    },
    select: { id: true, courtesyVehicleId: true, startAt: true, dueBackAt: true },
  });

  await callOff({
    orgId: org.id,
    userId: advisor.id,
    loanId: called.id,
    reason: 'They decided to wait instead',
  });

  const freedUp = await lend({
    orgId: org.id,
    userId: advisor.id,
    courtesyVehicleId: called.courtesyVehicleId,
    customerId: maria.id,
    startAt: called.startAt,
    dueBackAt: called.dueBackAt,
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof CourtesyError ? error.code : `wrong error: ${error}`),
  );

  check(
    freedUp === 'allowed',
    'a loan called off frees the car: a cancelled promise is not a promise',
    freedUp,
  );

  const noReason = await callOff({
    orgId: org.id,
    userId: advisor.id,
    loanId: first.id,
    reason: ' ',
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof CourtesyError ? error.code : `wrong error: ${error}`),
  );

  check(noReason !== 'allowed', 'and calling one off says why', noReason);

  /* --- the boundary --------------------------------------------------------- */

  const elsewhere = await prisma.organization.create({
    data: {
      slug: `courtesy-other-${tag.toLowerCase()}`,
      name: `Other ${tag}`,
      country: 'GB',
      baseCurrency: 'GBP',
      locale: 'en-GB',
      timezone: 'Europe/London',
    },
    select: { id: true },
  });

  const notOurs = await lend({
    orgId: elsewhere.id,
    userId: advisor.id,
    courtesyVehicleId: fiesta.id,
    customerId: maria.id,
    ...days(40, 41),
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof CourtesyError ? error.code : `wrong error: ${error}`),
  );

  check(notOurs === 'NOT_OURS', 'another workshop cannot lend one of our cars', notOurs);

  check(
    (await fleetFor(elsewhere.id)).length === 0,
    'and does not see them in its own fleet either',
  );

  /* --- it is on the job ----------------------------------------------------- */

  const job = await prisma.job.create({
    data: {
      orgId: org.id,
      locationId: org.locations[0]!.id,
      customerId: maria.id,
      vehicleId: fiestaVehicle.id,
      number: 970_000 + Math.floor(Math.random() * 9_000),
      shortDescription: 'Clutch',
      status: 'IN_PROGRESS',
    },
    select: { id: true },
  });

  await prisma.courtesyLoan.update({ where: { id: first.id }, data: { jobId: job.id } });

  const onJob = await loansForJob(org.id, job.id);

  check(
    onJob.length === 1 && onJob[0]!.customerName.includes('Maria'),
    'a loan shows on the job it belongs to',
    onJob.length,
  );

  /* --- and readable in three languages -------------------------------------- */

  const { hasTranslation, translate } = await import('@carnet/core');

  const sayings = [
    describeLoan({ id: 'x', vehicleId: 'v', ...days(2, 3), returnedAt: null }),
    describeLoan({ id: 'x', vehicleId: 'v', ...days(-1, 1), returnedAt: null }),
    describeLoan({ id: 'x', vehicleId: 'v', ...days(-9, -1), returnedAt: null }),
    describeLoan({ id: 'x', vehicleId: 'v', ...days(-9, -3), returnedAt: null }),
    describeLoan({ id: 'x', vehicleId: 'v', ...days(-9, -4), returnedAt: new Date() }),
  ];

  // `hasTranslation` rather than "something came back different". The weaker
  // test passed before any of these were written, because the dictionary is
  // flat and shared: "Out" already had an answer — the ledger's "out of
  // balance" — and "Back" had the navigation's. A borrowed answer is worse
  // than none, because nothing complains and the page is simply wrong.
  // A sentence with a number in it has a pattern rather than a key of its own
  // — "{v1} days overdue" — so the test is not "is there an entry" but "did
  // any English survive". That catches both the missing answer and the
  // half-filled pattern, which is what "1 day en retard" was.
  const englishLeft = (language: 'fr' | 'ar', sentence: string): boolean => {
    const out = translate(language, sentence);
    if (hasTranslation(language, sentence)) return false;
    const words = sentence.toLowerCase().match(/[a-z]{3,}/g) ?? [];
    return out === sentence || words.some((word) => out.toLowerCase().includes(word));
  };

  const unanswered = [...new Set(sayings)].flatMap((sentence) =>
    (['fr', 'ar'] as const)
      .filter((language) => englishLeft(language, sentence))
      .map((language) => `${language}: ${sentence} -> ${translate(language, sentence)}`),
  );

  check(
    unanswered.length === 0,
    `each of the ${new Set(sayings).size} things a loan can say about itself is answered in French and Arabic`,
    unanswered.join(' | '),
  );

  /* --- the arithmetic the screens do ---------------------------------------- */

  const stillOut = await loansOut(org.id);

  check(
    stillOut.every((one) => ['OUT', 'OVERDUE'].includes(loanStanding(one))),
    'nothing that has come back is on the list of what is out',
  );

  check(
    freeOver(fleet, [], { startAt: days(60, 61).startAt, endAt: days(60, 61).dueBackAt }).length ===
      3,
    'and a period nobody has booked leaves every car free',
  );

  /* --- clearing up ---------------------------------------------------------- */

  await prisma.courtesyLoan.deleteMany({ where: { orgId: { in: [org.id, elsewhere.id] } } });
  await prisma.courtesyVehicle.deleteMany({ where: { orgId: { in: [org.id, elsewhere.id] } } });
  await prisma.vehicleDocument.deleteMany({ where: { vehicleId: lapsedVehicle.id } });
  await prisma.job.deleteMany({ where: { orgId: org.id } });
  await prisma.auditLog.updateMany({
    where: { actorUserId: advisor.id },
    data: { actorUserId: null },
  });
  await prisma.customer.deleteMany({ where: { orgId: org.id } });
  await prisma.location.deleteMany({ where: { orgId: org.id } });
  await prisma.membership.deleteMany({ where: { userId: advisor.id } });
  await prisma.user.delete({ where: { id: advisor.id } });
  await prisma.vehicle.deleteMany({
    where: { id: { in: [fiestaVehicle.id, corsaVehicle.id, lapsedVehicle.id, spareVehicle.id] } },
  });
  await prisma.organization.deleteMany({ where: { id: { in: [org.id, elsewhere.id] } } });

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(
      `\n  ${checked} checks. One car, one customer, and the database keeps it that way.\n`,
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
