/**
 * What the car takes. Phase 88.
 *
 *   npx tsx infra/scripts/verify-specification.ts
 *
 * This feature fails by being helpful. A specification sheet that fills in a
 * plausible oil grade because it half-recognised the model is worse than one
 * that says nothing, because a blank sends somebody to look it up and a wrong
 * number does not — and a wrong oil grade is an engine.
 *
 * So almost everything checked here is a refusal:
 *
 *   - a line nobody has answered stays absent, and is never defaulted;
 *   - a model sheet only reaches cars the fitment rule says it covers;
 *   - a car's own line overrules the model sheet, and the disagreement is
 *     shown rather than settled;
 *   - a figure that is not a figure is refused, not quietly turned into nought,
 *     because nought bar is a real pressure and a real thing to be wrong about;
 *   - and the database refuses a sheet that is neither for a car nor a model,
 *     and one whose years run backwards -- a sheet that looks filled in and
 *     matches nothing is the worst kind of wrong.
 *
 * It also writes every one of the fourteen lines and reads them back, because
 * the one cast in `lib/specification.ts` is only honest if the columns really
 * do hold what the rules coerced them to.
 *
 * Runs against the seeded hillside-motors and puts back everything it moves.
 */

import 'dotenv/config';

import { coerceSpec, SPEC_KEYS, SPEC_LINES, specKindOf } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  modelSheets,
  partsThatFit,
  recordCarSheet,
  recordModelSheet,
  removeSheet,
  SpecificationError,
  whatTheCarTakes,
  whatWentIn,
} from '../../apps/web/src/lib/specification';

let failures = 0;

const TAG = 'VERIFY-SPEC-PROBE';

function check(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function refuses(label: string, code: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it was allowed`);
  } catch (error) {
    check(
      label,
      error instanceof SpecificationError ? error.code : String(error).slice(0, 70),
      code,
    );
  }
}

async function main() {
  console.info('\n  What the car takes\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });

  // Anything a run that threw before its clean-up left behind.
  await prisma.vehicleSpecification.deleteMany({ where: { orgId: org.id, engineCode: TAG } });

  const x5 = await prisma.vehicle.findFirstOrThrow({
    where: { make: 'BMW', model: 'X5', jobs: { some: { orgId: org.id } } },
    select: { id: true, make: true, model: true, year: true },
  });

  /* --- the sheet a car inherits ------------------------------------------- */

  const sheet = await whatTheCarTakes(org.id, x5.id);

  check('the car inherits the sheet written for its model', sheet.inheritedFrom.length >= 1, true);
  check(
    'the coolant comes off the model sheet, not off this car',
    sheet.lines.find((line) => line.key === 'coolantType')?.source,
    'MODEL_SHEET',
  );
  check(
    'and the oil comes off the car, because somebody wrote one there',
    sheet.lines.find((line) => line.key === 'oilGrade')?.source,
    'THIS_CAR',
  );

  /* --- the disagreement is shown, not settled ------------------------------ */

  console.info('\n  When two sources disagree');

  const oil = sheet.disagreements.find((line) => line.key === 'oilGrade');
  check('the sheet says plainly that the two do not agree', Boolean(oil), true);
  check('it shows the car’s answer first', oil?.value, '5W-40');
  check(
    'and still shows the model sheet’s, rather than hiding it',
    oil?.disagrees.map((other) => other.source),
    ['MODEL_SHEET'],
  );

  /* --- a blank is a blank -------------------------------------------------- */

  console.info('\n  A blank is a blank');

  const corolla = await prisma.vehicleSpecification.findFirstOrThrow({
    where: { orgId: org.id, make: 'Toyota', vehicleId: null },
    select: { id: true, coolantType: true, batteryAh: true },
  });

  check('a half-written model sheet stays half-written', corolla.coolantType, null);
  check('with no invented battery either', corolla.batteryAh, null);
  check(
    'and the car’s sheet names what is missing rather than showing dashes',
    sheet.missing.length + sheet.lines.length,
    SPEC_LINES.length,
  );
  check('the count is of fourteen, never a percentage', sheet.howFull.of, 14);

  /* --- a sheet reaches only the cars it covers ----------------------------- */

  console.info('\n  A sheet reaches only what it covers');

  const other = await prisma.vehicle.findFirst({
    where: { jobs: { some: { orgId: org.id } }, NOT: { make: 'BMW' } },
    select: { id: true, make: true },
  });

  if (other) {
    const theirs = await whatTheCarTakes(org.id, other.id);
    check(
      `a ${other.make} does not inherit the BMW sheet`,
      theirs.inheritedFrom.some((from) => from.make === 'BMW'),
      false,
    );
  }

  // A sheet whose years do not cover this car must not reach it either.
  const tooOld = await recordModelSheet({
    orgId: org.id,
    userId: owner.id,
    make: 'BMW',
    model: 'X5',
    yearFrom: 1990,
    yearTo: 1995,
    engineCode: TAG,
    values: { brakeFluid: 'DOT 3' },
  });

  const withOld = await whatTheCarTakes(org.id, x5.id);
  check(
    'a sheet for the wrong years does not reach the car',
    withOld.inheritedFrom.some((from) => from.engineCode === TAG),
    false,
  );

  await removeSheet({ orgId: org.id, userId: owner.id, sheetId: tooOld });

  /* --- every line survives the round trip ---------------------------------- */

  console.info('\n  Every line, written and read back');

  // The one cast in lib/specification.ts is only honest if each column really
  // holds what the rules coerced it to. So: write all fourteen, read them
  // back, compare.
  // A plausible figure per line, because the database refuses implausible
  // ones and it is right to: seven kilometres is not a service interval. An
  // earlier draft wrote 7 into every numeric line and the constraint threw --
  // the check was wrong, not the constraint.
  //
  // Listed rather than generated, and then checked against the line list, so
  // that a fifteenth line added to the sheet breaks this loudly instead of
  // being quietly skipped.
  const PROBE: Record<string, string> = {
    oilGrade: '0W-40',
    oilCapacityL: '5.5',
    coolantType: 'G12 evo',
    coolantCapacityL: '7.5',
    brakeFluid: 'DOT 5.1',
    tyreFront: '225/45 R18',
    tyreRear: '245/40 R18',
    tyrePressureFrontBar: '2.3',
    tyrePressureRearBar: '2.6',
    batteryType: '70Ah EFB',
    batteryAh: '70',
    batteryCca: '720',
    serviceIntervalMonths: '18',
    serviceIntervalKm: '25000',
  };

  const unlisted = SPEC_KEYS.filter((key) => !(key in PROBE));
  check('the round trip covers every line on the sheet', unlisted, []);

  const written: Record<string, string> = {};
  for (const line of SPEC_LINES) written[line.key] = PROBE[line.key]!;

  const before = await prisma.vehicleSpecification.findFirst({
    where: { orgId: org.id, vehicleId: x5.id },
    select: { oilGrade: true, note: true },
  });

  await recordCarSheet({ orgId: org.id, userId: owner.id, vehicleId: x5.id, values: written });

  const roundTrip = await whatTheCarTakes(org.id, x5.id);
  const back = new Map(roundTrip.lines.map((line) => [line.key, line.value]));

  const wrong = SPEC_KEYS.filter((key) => {
    const expected = specKindOf(key) === 'text' ? PROBE[key]! : Number(PROBE[key]!);
    return String(back.get(key)) !== String(expected);
  });

  check('all fourteen come back as they went in', wrong, []);
  check('and all fourteen are on the sheet', roundTrip.lines.length, 14);
  check('with nothing left missing', roundTrip.missing, []);

  /* --- a figure that is not a figure --------------------------------------- */

  console.info('\n  A typo is not a pressure');

  await refuses('a pressure that is not a number is refused', 'NOT_A_NUMBER', () =>
    recordCarSheet({
      orgId: org.id,
      userId: owner.id,
      vehicleId: x5.id,
      values: { tyrePressureFrontBar: 'about two' },
    }),
  );

  check(
    'and it never becomes nought, which is a real pressure',
    coerceSpec({ tyrePressureFrontBar: 'about two' }).values.tyrePressureFrontBar,
    undefined,
  );

  /* --- put the car's sheet back -------------------------------------------- */

  const cleared = Object.fromEntries(SPEC_KEYS.map((key) => [key, '']));
  await recordCarSheet({
    orgId: org.id,
    userId: owner.id,
    vehicleId: x5.id,
    values: { ...cleared, oilGrade: before?.oilGrade ?? '', note: before?.note ?? '' },
  });

  const restored = await whatTheCarTakes(org.id, x5.id);
  check(
    'the probe leaves the car with the one line it arrived with',
    restored.lines.filter((line) => line.source === 'THIS_CAR').map((line) => line.key),
    ['oilGrade'],
  );

  /* --- what the database refuses ------------------------------------------- */

  console.info('\n  What the database refuses');

  let neither = false;
  try {
    await prisma.$executeRaw`
      INSERT INTO vehicle_specifications ("id", "orgId", "oilGrade", "updatedAt")
      VALUES (${`${TAG}-neither`}, ${org.id}, '0W-20', NOW())`;
    neither = true;
  } catch (error) {
    check(
      'a sheet for neither a car nor a model is refused by the right constraint',
      String(error).includes('vehicle_specifications_is_a_car_or_a_model'),
      true,
    );
  }
  check('a sheet for neither a car nor a model is refused', neither, false);

  let both = false;
  try {
    await prisma.$executeRaw`
      INSERT INTO vehicle_specifications ("id", "orgId", "vehicleId", "make", "updatedAt")
      VALUES (${`${TAG}-both`}, ${org.id}, ${x5.id}, 'BMW', NOW())`;
    both = true;
  } catch {
    // vehicle_specifications_is_a_car_or_a_model refuses it.
  }
  check('and so is one that claims to be both', both, false);

  let backwards = false;
  try {
    await prisma.$executeRaw`
      INSERT INTO vehicle_specifications ("id", "orgId", "make", "yearFrom", "yearTo", "updatedAt")
      VALUES (${`${TAG}-years`}, ${org.id}, 'BMW', 2020, 2015, NOW())`;
    backwards = true;
  } catch (error) {
    check(
      'and years that run backwards, by the constraint that names them',
      String(error).includes('vehicle_specifications_years_run_forwards'),
      true,
    );
  }
  check('years that run backwards are refused', backwards, false);

  let impossible = false;
  try {
    await prisma.$executeRaw`
      INSERT INTO vehicle_specifications ("id", "orgId", "make", "oilCapacityL", "updatedAt")
      VALUES (${`${TAG}-zero`}, ${org.id}, 'BMW', 0, NOW())`;
    impossible = true;
  } catch {
    // No engine takes nought litres of oil.
  }
  check('and an engine that takes nought litres of oil', impossible, false);

  /* --- what is read off records already held ------------------------------- */

  console.info('\n  Read off what was already there');

  const fits = await partsThatFit(org.id, x5.id);
  check('the parts that fit come from the fitment rows, not a new table', fits.length >= 1, true);

  // Both states, because the empty one is the claim worth making. The X5's
  // only job is still on the ramp with its parts reserved rather than fitted,
  // so nothing has gone in yet -- and the sheet says nothing rather than
  // reaching for the reserved lines to have something to show. An earlier
  // draft of this check asserted the opposite and failed for the right
  // reason.
  check('a car with nothing fitted yet shows nothing', await whatWentIn(org.id, x5.id), []);

  const fitted = await prisma.jobPartLine.findFirst({
    where: {
      status: 'FITTED',
      job: { orgId: org.id },
    },
    select: { description: true, job: { select: { vehicleId: true } } },
  });

  if (!fitted) {
    failures += 1;
    console.error('  FAIL   no fitted part anywhere in the seed to read back. Reseed.');
  } else {
    const went = await whatWentIn(org.id, fitted.job.vehicleId);
    check('and a car that has had parts fitted shows them', went.length >= 1, true);
    check(
      'verbatim, with no grade parsed out of a product name',
      went.some((line) => line.description === fitted.description),
      true,
    );
  }

  /* --- the settings screen's own list -------------------------------------- */

  console.info('\n  The sheets a workshop has written');

  const sheets = await modelSheets(org.id);
  check('the model sheets are listed', sheets.length >= 2, true);
  check(
    'each with a count of how much of it is filled in',
    sheets.every((one) => one.answered >= 0 && one.answered <= SPEC_LINES.length),
    true,
  );
  check(
    'and the half-written one is reported as half-written, not rounded up',
    sheets.find((one) => one.make === 'Toyota')?.answered,
    4,
  );
  check(
    'a car sheet is not in the model list',
    sheets.some((one) => one.make === null),
    false,
  );

  /* --- clean up ------------------------------------------------------------ */

  await prisma.vehicleSpecification.deleteMany({ where: { orgId: org.id, engineCode: TAG } });
  check(
    'the probe leaves no sheets of its own behind',
    await prisma.vehicleSpecification.count({ where: { orgId: org.id, engineCode: TAG } }),
    0,
  );

  console.info(
    failures === 0
      ? '\n  Written once for the model, and a blank stays a blank.'
      : `\n  ${failures} failed.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
