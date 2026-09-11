/**
 * Ownership transfer and the buyer's report, against a real database.
 *
 *   npx tsx infra/scripts/verify-handover.ts
 *
 * A transfer touches the two things this product is built on: an append-only
 * chain that must stay verifiable, and a personal record that must remain
 * erasable. Getting either wrong is not a bug that shows up on a screen. It
 * shows up when somebody asks to be forgotten and the answer is that they
 * cannot be, or when a buyer relies on a history that no longer checks out.
 *
 * So the checks here are about what survives a sale and what does not.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import { OwnershipError, reportFor, transferOwnership } from '../../apps/web/src/lib/handover';
import { verifyVehicleChain } from '../../apps/web/src/lib/passport';

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

const VIN = 'VFYHANDOVER000001';
const SELLER = 'Verify probe: Priya Raman';
const BUYER = 'Verify probe: Tom Dunlevy';

async function refused(label: string, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    if (error instanceof OwnershipError) {
      console.info(`  ok     ${label}: ${error.code}`);
    } else {
      failures += 1;
      console.error(`  FAIL   ${label}: refused for the wrong reason: ${String(error)}`);
    }
  }
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const user = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true },
  });

  const bought = new Date(Date.now() - 900 * 86_400_000);

  // Found or created, never deleted and recreated. A vehicle that has any
  // chain event cannot be removed at all: the events are append-only in the
  // database, and that is the property the whole product rests on. So the
  // probe reuses one vehicle and resets what it is allowed to reset, which is
  // the ownership rows.
  const existing = await prisma.vehicle.findUnique({ where: { vin: VIN }, select: { id: true } });

  if (existing) await prisma.vehicleOwnership.deleteMany({ where: { vehicleId: existing.id } });

  const vehicle =
    existing ??
    (await prisma.vehicle.create({
      data: {
        vin: VIN,
        registration: 'VF26 HND',
        make: 'Probe',
        model: 'Handover',
        year: 2018,
        lastOdometerKm: 84_000,
        firstRegisteredAt: new Date(Date.now() - 2_900 * 86_400_000),
      },
      select: { id: true },
    }));

  await prisma.vehicleOwnership.create({
    data: {
      vehicleId: vehicle.id,
      ownerName: SELLER,
      ownerKind: 'PRIVATE',
      startedAt: bought,
    },
  });

  console.info('\nWhat a transfer refuses');

  await refused('a transfer to nobody', () =>
    transferOwnership({
      orgId: org.id,
      userId: user.id,
      vehicleId: vehicle.id,
      toName: '  ',
      toKind: 'PRIVATE',
      on: new Date(),
    }),
  );

  await refused('a transfer to the same owner', () =>
    transferOwnership({
      orgId: org.id,
      userId: user.id,
      vehicleId: vehicle.id,
      toName: SELLER.toUpperCase(),
      toKind: 'PRIVATE',
      on: new Date(),
    }),
  );

  await refused('a sale dated before the seller bought it', () =>
    transferOwnership({
      orgId: org.id,
      userId: user.id,
      vehicleId: vehicle.id,
      toName: BUYER,
      toKind: 'PRIVATE',
      on: new Date(Date.now() - 1_500 * 86_400_000),
    }),
  );

  await refused('a sale dated next year', () =>
    transferOwnership({
      orgId: org.id,
      userId: user.id,
      vehicleId: vehicle.id,
      toName: BUYER,
      toKind: 'PRIVATE',
      on: new Date(Date.now() + 365 * 86_400_000),
    }),
  );

  console.info('\nWhat a transfer does');

  const soldOn = new Date(Date.now() - 3 * 86_400_000);

  // Counted before and after, not in total. The probe vehicle's chain is
  // permanent, so a previous run's transfer is still on it and always will
  // be. What this run is responsible for is the difference.
  const before = await prisma.vehicleEvent.count({
    where: { vehicleId: vehicle.id, type: 'OWNERSHIP_TRANSFER' },
  });

  await transferOwnership({
    orgId: org.id,
    userId: user.id,
    vehicleId: vehicle.id,
    toName: BUYER,
    toKind: 'PRIVATE',
    on: soldOn,
    odometerKm: 84_000,
  });

  const ownerships = await prisma.vehicleOwnership.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: { startedAt: 'asc' },
    select: { ownerName: true, startedAt: true, endedAt: true },
  });

  check('there are two ownerships', ownerships.length, 2);
  check('the first one closed', ownerships[0]!.endedAt !== null, true);
  check('exactly one is open', ownerships.filter((row) => row.endedAt === null).length, 1);
  check('and it is the buyer', ownerships[1]!.ownerName, BUYER);

  const events = await prisma.vehicleEvent.findMany({
    where: { vehicleId: vehicle.id, type: 'OWNERSHIP_TRANSFER' },
    orderBy: { sequence: 'desc' },
    select: { payload: true, odometerKm: true },
  });

  check('exactly one transfer was added to the chain', events.length - before, 1);
  check('with the reading on it', events[0]!.odometerKm, 84_000);

  // The rule the whole design turns on. A hash computed over somebody's name
  // is a hash that cannot survive them asking to be forgotten.
  const payload = JSON.stringify(events[0]!.payload).toLowerCase();
  check('no seller name in the chain', payload.includes('priya'), false);
  check('no buyer name in the chain', payload.includes('dunlevy'), false);

  const verification = await verifyVehicleChain(vehicle.id);
  check('the chain still verifies', verification.valid, true);

  console.info('\nRecording the same sale twice');

  // Two people at the counter, one pressing the button twice. The second
  // press must not produce a second sale.
  await refused('transferring again to the same new owner', () =>
    transferOwnership({
      orgId: org.id,
      userId: user.id,
      vehicleId: vehicle.id,
      toName: BUYER,
      toKind: 'PRIVATE',
      on: soldOn,
    }),
  );

  console.info('\nThe report a buyer reads');

  const report = await reportFor(vehicle.id);

  check('it exists', report !== null, true);
  check('it counts both owners', report!.owners.length, 2);
  check('it names neither', JSON.stringify(report!.owners).includes('Priya'), false);
  check('it says the record is intact', report!.chain, 'INTACT');
  check(
    'it always says what it does not cover',
    report!.gaps.some((gap) => gap.includes('elsewhere')),
    true,
  );
  check(
    'it names the years before the record starts',
    report!.gaps.some((gap) => gap.includes('not covered here at all')),
    true,
  );

  console.info('\nTrying to alter the history');

  // The report knows what to say about a broken chain; that is covered by the
  // unit tests, which can construct one. What cannot be constructed in a unit
  // test is this: the database refuses to let the tamper happen at all, from
  // any connection, including a psql session with full rights.
  //
  // Two defences, deliberately. The trigger stops the write; the hash chain
  // catches anything that reaches the rows another way, such as a restore from
  // a doctored dump.
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "vehicle_events" SET "hash" = 'tampered' WHERE "vehicleId" = '${vehicle.id}' AND "sequence" = 1`,
    );
    failures += 1;
    console.error('  FAIL   the database accepted an edit to a recorded event');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('append-only')) {
      console.info('  ok     an edit to a recorded event is refused by the database itself');
    } else {
      failures += 1;
      console.error(`  FAIL   refused, but not as append-only: ${message}`);
    }
  }

  const after = await verifyVehicleChain(vehicle.id);
  check('and the chain is untouched', after.valid, true);

  console.info('\nWhat cannot be undone');

  // Not a cleanup failure. A vehicle with a history cannot be deleted, and
  // that is the point: a passport somebody can make disappear is a passport
  // nobody should have paid more for a car because of. The personal rows go;
  // the vehicle's own record stays.
  await prisma.vehicleOwnership.deleteMany({ where: { vehicleId: vehicle.id } });

  try {
    await prisma.vehicle.delete({ where: { id: vehicle.id } });
    failures += 1;
    console.error('  FAIL   a vehicle with a recorded history was deleted');
  } catch {
    console.info('  ok     a vehicle with a recorded history cannot be deleted');
  }

  const owners = await prisma.vehicleOwnership.count({ where: { vehicleId: vehicle.id } });
  check('but every personal row it held is gone', owners, 0);

  console.info(
    failures === 0
      ? '\nTransfer and the report behaved correctly.'
      : `\n${failures} check(s) FAILED.`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
