/**
 * Customers signing up, and asking for their own cars.
 *
 *   npx tsx infra/scripts/verify-claims.ts
 *
 * Every failure this feature can have is a quiet one, and one of them is
 * serious enough to be worth a script on its own: a claim that grants a vehicle
 * without a person approving it would hand a stranger's service history,
 * declined-work list and annual mileage to anybody who could read a number
 * plate through a windscreen.
 *
 * So the checks are mostly refusals. The interesting output is the things that
 * did not happen.
 *
 * It cleans up after itself.
 */

import 'dotenv/config';

import { ClaimError } from '@carnet/core';
import { prisma } from '@carnet/db';

import {
  claimsFor,
  claimVehicle,
  decideClaim,
  myClaims,
  registerCustomer,
  withdrawClaim,
} from '../../apps/web/src/lib/claims';

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

async function refuses(label: string, expected: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    if (error instanceof ClaimError && error.code === expected) {
      console.info(`  ok     ${label}: ${error.code}`);
    } else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${expected}, got ${String(error)}`);
    }
  }
}

const PROBE = 'vfy-claims@example.test';
const STRANGER = 'vfy-claims-stranger@example.test';
const PASSWORD = 'a probe that is long enough';

async function forget() {
  await prisma.vehicleClaim.deleteMany({
    where: { user: { email: { in: [PROBE, STRANGER] } } },
  });
  await prisma.vehicleOwnership.deleteMany({
    where: { owner: { email: { in: [PROBE, STRANGER] } } },
  });
  await prisma.customer.updateMany({
    where: { portalUser: { email: { in: [PROBE, STRANGER] } } },
    data: { portalUserId: null },
  });
  await prisma.messageLog.deleteMany({ where: { toAddress: { in: [PROBE, STRANGER] } } });
  await prisma.authToken.deleteMany({ where: { user: { email: { in: [PROBE, STRANGER] } } } });
  await prisma.session.deleteMany({ where: { user: { email: { in: [PROBE, STRANGER] } } } });
  await prisma.user.deleteMany({ where: { email: { in: [PROBE, STRANGER] } } });
  await prisma.vehicle.deleteMany({ where: { vin: 'VFYCLAIMSNOWORK01' } });
}

async function main() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: { in: ['OWNER', 'MANAGER'] } } } },
    select: { id: true },
  });

  // A vehicle this workshop has actually worked on, because that is the only
  // kind anybody can claim.
  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, vehicle: { registration: { not: null } } },
    orderBy: { createdAt: 'desc' },
    select: {
      customerId: true,
      vehicle: { select: { id: true, registration: true } },
    },
  });

  const plate = job.vehicle.registration!;

  await forget();

  console.info('\nSomebody signing up as a driver');

  await refuses('a password anybody would guess', 'NO_REASON', () =>
    registerCustomer({ name: 'Probe', email: PROBE, password: 'password123' }),
  );

  await refuses('something that is not an address', 'NO_REASON', () =>
    registerCustomer({ name: 'Probe', email: 'probe', password: PASSWORD }),
  );

  const user = await registerCustomer({ name: 'Probe Driver', email: PROBE, password: PASSWORD });

  const created = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { emailVerifiedAt: true, memberships: { select: { id: true } } },
  });

  // The whole point of a customer account: it belongs to nobody's workshop.
  check('the account joins no organisation', created.memberships.length, 0);
  check('and the address is not yet proven', created.emailVerifiedAt, null);

  const sent = await prisma.messageLog.count({
    where: { toAddress: PROBE, subject: { contains: 'Confirm' } },
  });
  check('a confirmation link was queued', sent >= 1, true);

  await refuses('the same address twice', 'ALREADY_ASKED', () =>
    registerCustomer({ name: 'Probe Again', email: PROBE, password: PASSWORD }),
  );

  console.info('\nAsking for a car');

  await refuses('before confirming the email address', 'UNVERIFIED', () =>
    claimVehicle({ userId: user.id, identifier: plate }),
  );

  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });

  await refuses('something that is neither a plate nor a VIN', 'NO_VEHICLE', () =>
    claimVehicle({ userId: user.id, identifier: 'the blue one on the drive' }),
  );

  await refuses('a plate nobody in the network has seen', 'NO_VEHICLE', () =>
    claimVehicle({ userId: user.id, identifier: 'ZZ99 ZZZ' }),
  );

  // A vehicle that exists and has never been through a workshop. There is
  // nobody to ask, and saying so is more use than a blank refusal.
  const orphan = await prisma.vehicle.create({
    data: { vin: 'VFYCLAIMSNOWORK01', registration: 'VF15 ORP' },
    select: { id: true },
  });

  await refuses('a vehicle no workshop can vouch for', 'NO_WORKSHOP', () =>
    claimVehicle({ userId: user.id, identifier: 'vf15orp' }),
  );

  // Lower case, no space. Somebody typing their own plate from memory should
  // not be refused over punctuation.
  const claimId = await claimVehicle({
    userId: user.id,
    identifier: plate.toLowerCase().replace(/\s/g, ''),
    note: 'Serviced with you in March.',
  });

  const row = await prisma.vehicleClaim.findUniqueOrThrow({
    where: { id: claimId },
    select: { vehicleId: true, orgId: true, status: true, decidedAt: true },
  });

  check('it found the vehicle however the plate was typed', row.vehicleId, job.vehicle.id);
  check('and went to the workshop that last worked on it', row.orgId, org.id);
  check('it grants nothing on its own', row.status, 'PENDING');
  check('and has no decision on it', row.decidedAt, null);

  // Nothing has been handed over. This is the check the whole feature exists
  // to keep true.
  const grantedEarly = await prisma.customer.count({ where: { portalUserId: user.id } });
  const ownedEarly = await prisma.vehicleOwnership.count({ where: { ownerUserId: user.id } });
  check('no customer record was attached', grantedEarly, 0);
  check('and no vehicle appears on the account', ownedEarly, 0);

  await refuses('asking about the same car twice', 'ALREADY_ASKED', () =>
    claimVehicle({ userId: user.id, identifier: plate }),
  );

  console.info('\nWhat the customer is shown while they wait');

  const mine = await myClaims(user.id);
  const waiting = mine.find((entry) => entry.id === claimId)!;

  check('a summary in plain language', waiting.summary.includes('Waiting for the workshop'), true);

  // Naming the garage would tell somebody where a car is serviced before they
  // have shown any connection to it.
  check('and it names no workshop', JSON.stringify(waiting).includes(org.name), false);

  console.info('\nSomebody working through a car park');

  const others = await prisma.vehicle.findMany({
    where: { registration: { not: null }, id: { not: job.vehicle.id }, jobs: { some: {} } },
    take: 3,
    select: { id: true, registration: true },
  });

  // Not a skip. A section that may or may not have run is not a check, and
  // nothing downstream says which it was. Phase 77.
  if (others.length < 2) {
    failures += 1;
    console.error(
      `  FAIL   ${others.length} vehicles found where 2 are needed, so the open-request\n` +
        '         limit itself was not exercised. Reseed: npm run db:seed',
    );
  } else {
    for (const other of others.slice(0, 2)) {
      await claimVehicle({ userId: user.id, identifier: other.registration! });
    }

    await refuses('a fourth request while three are open', 'TOO_MANY', () =>
      claimVehicle({ userId: user.id, identifier: others[2]?.registration ?? 'ZZ99 ZZZ' }),
    );

    // The cap is on open requests, not lifetime ones: an honest person with
    // five cars must not be permanently locked out.
    const spare = await prisma.vehicleClaim.findFirst({
      where: { userId: user.id, status: 'PENDING', vehicleId: { not: job.vehicle.id } },
      select: { id: true },
    });
    await withdrawClaim(user.id, spare!.id);

    const openNow = await prisma.vehicleClaim.count({
      where: { userId: user.id, status: 'PENDING' },
    });
    check('withdrawing one frees the slot', openNow, 2);
  }

  console.info('\nThe queue the workshop answers');

  const queue = await claimsFor(org.id);
  const first = queue[0];

  check('unanswered requests come first', first?.status, 'PENDING');

  const mineInQueue = queue.find((entry) => entry.id === claimId)!;
  check('the person asking is named', mineInQueue.user.email, PROBE);
  check(
    'alongside the customer the workshop already holds',
    mineInQueue.onRecord?.id,
    job.customerId,
  );

  console.info('\nAnswering it');

  await refuses('refusing without saying why', 'NO_REASON', () =>
    decideClaim({ orgId: org.id, userId: staff.id, claimId, approve: false, reason: '  ' }),
  );

  // A workshop cannot answer another workshop's queue.
  const elsewhere = await prisma.organization.findFirst({
    where: { id: { not: org.id } },
    select: { id: true },
  });

  if (elsewhere) {
    let reached = 'answered it';
    try {
      await decideClaim({
        orgId: elsewhere.id,
        userId: staff.id,
        claimId,
        approve: true,
      });
    } catch {
      reached = 'could not see it';
    }
    check('another workshop cannot answer it', reached, 'could not see it');
  }

  await decideClaim({ orgId: org.id, userId: staff.id, claimId, approve: true });

  const approved = await prisma.vehicleClaim.findUniqueOrThrow({
    where: { id: claimId },
    select: { status: true, decidedAt: true, decidedByUserId: true },
  });

  check('it is approved', approved.status, 'APPROVED');
  check('by somebody, at a time', Boolean(approved.decidedAt && approved.decidedByUserId), true);

  const attached = await prisma.customer.findFirst({
    where: { id: job.customerId },
    select: { portalUserId: true },
  });
  check('the customer record is now theirs', attached?.portalUserId, user.id);

  const owns = await prisma.vehicleOwnership.count({
    where: { ownerUserId: user.id, vehicleId: job.vehicle.id, endedAt: null },
  });
  check('and the vehicle appears on the account', owns, 1);

  // Attaching an account is not a change of keeper. Writing a transfer here
  // would put an invented event into a history meant to be evidence.
  const invented = await prisma.vehicleEvent.count({
    where: { vehicleId: job.vehicle.id, type: 'OWNERSHIP_TRANSFER', recordedByUserId: user.id },
  });
  check('no ownership transfer was invented', invented, 0);

  const told = await prisma.messageLog.count({
    where: { toAddress: PROBE, relatedType: 'VehicleClaim', relatedId: claimId },
  });
  check('the customer was told', told, 1);

  await refuses('answering the same request twice', 'NOT_PENDING', () =>
    decideClaim({
      orgId: org.id,
      userId: staff.id,
      claimId,
      approve: false,
      reason: 'Changed my mind.',
    }),
  );

  console.info('\nA second person asking for a car that already has an owner');

  const stranger = await registerCustomer({
    name: 'Probe Stranger',
    email: STRANGER,
    password: PASSWORD,
  });
  await prisma.user.update({ where: { id: stranger.id }, data: { emailVerifiedAt: new Date() } });

  const strangerClaim = await claimVehicle({ userId: stranger.id, identifier: plate });

  await refuses('approving it over the person who already holds it', 'ALREADY_YOURS', () =>
    decideClaim({ orgId: org.id, userId: staff.id, claimId: strangerClaim, approve: true }),
  );

  const stillMine = await prisma.customer.findFirstOrThrow({
    where: { id: job.customerId },
    select: { portalUserId: true },
  });
  check('the original owner keeps the record', stillMine.portalUserId, user.id);

  await decideClaim({
    orgId: org.id,
    userId: staff.id,
    claimId: strangerClaim,
    approve: false,
    reason: 'Rang the owner and it is not them.',
  });

  const strangerOwns = await prisma.vehicleOwnership.count({
    where: { ownerUserId: stranger.id },
  });
  check('and the stranger got nothing', strangerOwns, 0);

  console.info('\nThe database, underneath it');

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "vehicle_claims" ("id","userId","vehicleId","orgId","status","decidedAt")
       VALUES ('vfy-claim-raw-1','${user.id}','${job.vehicle.id}','${org.id}','REJECTED',NOW())`,
    );
    failures += 1;
    console.error('  FAIL   a refusal with no reason was accepted');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(
      'a refusal with nothing written',
      message.includes('vehicle_claims_refusal_is_explained'),
      true,
    );
  }

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "vehicle_claims" ("id","userId","vehicleId","orgId","status","decidedAt")
       VALUES ('vfy-claim-raw-2','${user.id}','${job.vehicle.id}','${org.id}','PENDING',NOW())`,
    );
    failures += 1;
    console.error('  FAIL   a pending request carrying a decision time was accepted');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(
      'a pending request with a decision time on it',
      message.includes('vehicle_claims_decision_has_a_time'),
      true,
    );
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO "vehicle_claims" ("id","userId","vehicleId","orgId","status")
     VALUES ('vfy-claim-raw-3','${stranger.id}','${orphan.id}','${org.id}','PENDING')`,
  );

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "vehicle_claims" ("id","userId","vehicleId","orgId","status")
       VALUES ('vfy-claim-raw-4','${stranger.id}','${orphan.id}','${org.id}','PENDING')`,
    );
    failures += 1;
    console.error('  FAIL   the same person asked about the same car twice');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    check(
      'two open requests for one car from one person',
      message.includes('vehicle_claims_one_open_each'),
      true,
    );
  }

  console.info('\nHow the lookup reaches the vehicle');

  // The one query on this path that could read the whole table. It is the
  // difference between a page that stays instant as the network grows and one
  // that quietly slows for everybody.
  //
  // Sequential scans are turned off for the measurement. On a development
  // database holding a handful of vehicles the planner is right to read them
  // all, and a check that failed on that would be measuring the size of the
  // seed rather than the shape of the query. What is being asserted is that an
  // index exists which matches the expression exactly, so the planner has the
  // choice once there is enough data for it to matter. A single character
  // different between this predicate and the index definition and there would
  // be no choice at all.
  await prisma.$executeRawUnsafe('SET enable_seqscan = off');

  const plan = await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(
    `EXPLAIN SELECT "id" FROM "vehicles"
     WHERE "registration" IS NOT NULL
       AND upper(replace(replace("registration", ' ', ''), '-', '')) = 'AB12CDE'`,
  );

  await prisma.$executeRawUnsafe('SET enable_seqscan = on');

  const text = plan.map((line) => line['QUERY PLAN']).join(' ');
  check(
    'the plate lookup can reach the vehicle by index rather than reading every one',
    text.includes('vehicles_registration_normalised'),
    true,
  );

  console.info('\nClearing up');

  await prisma.$executeRawUnsafe(`DELETE FROM "vehicle_claims" WHERE "id" LIKE 'vfy-claim-raw-%'`);
  await forget();

  const left = await prisma.user.count({ where: { email: { in: [PROBE, STRANGER] } } });
  check('the probe left nothing behind', left, 0);

  console.info(failures === 0 ? '\nClaims behaved correctly.' : `\n${failures} check(s) FAILED.`);

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
