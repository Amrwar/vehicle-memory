/**
 * What was scanned. Phase 92.
 *
 *   npx tsx infra/scripts/verify-scanning.ts
 *
 * The failure worth designing against is not a scan that fails. It is a scan
 * that **succeeds at the wrong record** -- because from the outside a right
 * answer and a wrong one look identical, and the wrong one books a part out
 * against a car that is not on the ramp.
 *
 * So the central check here is the deliberately awkward one: a part is given
 * the number of an existing job, and the scanner is pointed at it. A resolver
 * that tried each kind in turn and took the first hit would pass everything
 * else in this file and fail this. It must ask.
 *
 * Runs against the seeded hillside-motors and puts back everything it moves.
 */

import 'dotenv/config';

import { SCAN_KINDS, scanCode, scanDestination } from '@carnet/core';
import { prisma } from '@carnet/db';

import { resolveScan } from '../../apps/web/src/lib/scanning';

let failures = 0;

const TAG = 'VERIFY-SCAN-PROBE';

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

async function main() {
  console.info('\n  What was scanned\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const other = await prisma.organization.findFirst({
    where: { slug: { not: 'hillside-motors' } },
    select: { id: true, slug: true },
  });

  await prisma.product.deleteMany({ where: { orgId: org.id, partNumber: { startsWith: TAG } } });

  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true, number: true },
  });
  const part = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true, partNumber: true, barcode: true },
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({
    where: { jobs: { some: { orgId: org.id } } },
    select: { id: true, vin: true, registration: true },
  });
  const machine = await prisma.equipment.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true, code: true },
  });

  /* --- a code of ours is never ambiguous ---------------------------------- */

  const byCode = await resolveScan(org.id, scanCode('job', job.id));
  check('a Carnet code lands on exactly one record', byCode.found, 'one');
  if (byCode.found === 'one') {
    check('and on the right one', byCode.id, job.id);
    check(
      'taking somebody to its page',
      scanDestination(byCode.kind, byCode.id),
      `/jobs/${job.id}`,
    );
  }

  for (const [kind, id] of [
    ['vehicle', vehicle.id],
    ['part', part.id],
    ['equipment', machine.id],
  ] as const) {
    const found = await resolveScan(org.id, scanCode(kind, id));
    check(`a ${kind} code resolves to a ${kind}`, found.found === 'one' && found.kind, kind);
  }

  /* --- what a workshop actually points it at ------------------------------- */

  console.info('\n  What a workshop points it at');

  const byPlate = await resolveScan(org.id, vehicle.registration ?? '');
  check(
    'a registration off a windscreen finds the car',
    byPlate.found === 'one' && byPlate.kind,
    'vehicle',
  );

  const byVin = await resolveScan(org.id, vehicle.vin);
  check('and so does a VIN', byVin.found === 'one' && byVin.kind, 'vehicle');

  const byPartNumber = await resolveScan(org.id, part.partNumber);
  check(
    'a part number off a box finds the part',
    byPartNumber.found === 'one' && byPartNumber.kind,
    'part',
  );

  const byMachineCode = await resolveScan(org.id, machine.code);
  check(
    "a machine's own code finds the machine",
    byMachineCode.found === 'one' && byMachineCode.kind,
    'equipment',
  );

  const bin = await prisma.stockLevel.findFirst({
    where: { product: { orgId: org.id }, binLocation: { not: null } },
    select: { binLocation: true },
  });

  if (!bin?.binLocation) {
    failures += 1;
    console.error('  FAIL   no stock with a bin written on it, so the shelf edge is untested.');
  } else {
    const byBin = await resolveScan(org.id, bin.binLocation);
    check(
      'a bin written on a shelf edge finds the shelf',
      byBin.found === 'one' && byBin.kind,
      'bin',
    );
    check(
      'and takes somebody to what is on it, not to a record that does not exist',
      scanDestination('bin', bin.binLocation).startsWith('/parts?bin='),
      true,
    );
  }

  /* --- the one that matters ------------------------------------------------ */

  console.info('\n  When two things could be meant');

  // A part numbered like an existing job. Contrived on purpose: it is the
  // shape of the mistake, and a resolver that took the first hit would book a
  // part out against a car that is not on the ramp.
  const collide = await prisma.product.create({
    data: {
      orgId: org.id,
      partNumber: String(job.number),
      name: `${TAG} deliberately ambiguous`,
      sellPrice: 1,
      costPrice: 1,
    },
    select: { id: true },
  });

  const ambiguous = await resolveScan(org.id, String(job.number));
  check('a number that is both a job and a part is a question', ambiguous.found, 'several');
  if (ambiguous.found === 'several') {
    check(
      'and both are offered, so somebody chooses',
      ambiguous.matches.map((one) => one.kind).sort(),
      ['job', 'part'],
    );
  }

  await prisma.product.delete({ where: { id: collide.id } });

  const unambiguous = await resolveScan(org.id, String(job.number));
  check('with the collision gone it is an answer again', unambiguous.found, 'one');

  /* --- one record found twice is not an ambiguity -------------------------- */

  const twoWays = await prisma.product.create({
    data: {
      orgId: org.id,
      partNumber: `${TAG}-BOTH`,
      barcode: `${TAG}-BOTH`,
      name: `${TAG} same string, two columns`,
      sellPrice: 1,
      costPrice: 1,
    },
    select: { id: true },
  });

  const oneRecord = await resolveScan(org.id, `${TAG}-BOTH`);
  check('a part matched by its number and its barcode is one part', oneRecord.found, 'one');

  await prisma.product.delete({ where: { id: twoWays.id } });

  /* --- nothing is another workshop's ---------------------------------------- */

  console.info('\n  And nothing belongs to anybody else');

  if (!other) {
    failures += 1;
    console.error('  FAIL   only one workshop in the database, so the scoping is untested.');
  } else {
    // A part of theirs, made here, because the other seeded workshop has no
    // jobs and the first draft of this check leant on one -- so it reported
    // its own untestedness rather than testing anything.
    const theirs = await prisma.product.create({
      data: {
        orgId: other.id,
        partNumber: `${TAG}-THEIRS`,
        name: `${TAG} another workshop's part`,
        sellPrice: 1,
        costPrice: 1,
      },
      select: { id: true },
    });

    check(
      "another workshop's code finds nothing here",
      (await resolveScan(org.id, scanCode('part', theirs.id))).found,
      'none',
    );
    check(
      'and neither does their part number',
      (await resolveScan(org.id, `${TAG}-THEIRS`)).found,
      'none',
    );
    check(
      'while they can find it themselves',
      (await resolveScan(other.id, scanCode('part', theirs.id))).found,
      'one',
    );

    await prisma.product.delete({ where: { id: theirs.id } });
  }

  /* --- and nonsense is nonsense -------------------------------------------- */

  check('a made-up code finds nothing', (await resolveScan(org.id, 'CNT:job:nope')).found, 'none');
  check('an empty scan finds nothing', (await resolveScan(org.id, '   ')).found, 'none');
  check(
    'a number nothing uses finds nothing',
    (await resolveScan(org.id, '999999123')).found,
    'none',
  );

  /* --- every kind is reachable ---------------------------------------------- */

  check(
    'every kind of code has somewhere to go',
    SCAN_KINDS.every((kind) => scanDestination(kind, 'x').startsWith('/')),
    true,
  );

  await prisma.product.deleteMany({ where: { orgId: org.id, partNumber: { startsWith: TAG } } });
  check(
    'the probe leaves no parts of its own behind',
    await prisma.product.count({ where: { orgId: org.id, partNumber: { startsWith: TAG } } }),
    0,
  );

  console.info(
    failures === 0
      ? '\n  A scan that could mean two things asks, and never picks one.'
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
