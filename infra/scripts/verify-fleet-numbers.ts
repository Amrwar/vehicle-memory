/**
 * What the fleet calls it. Phase 69. FR-303.
 *
 *   npx tsx infra/scripts/verify-fleet-numbers.ts
 *
 * FR-303 has been Partial since the first phase: the registration expiry is on
 * the vehicle and the fleet number is not a column anywhere.
 *
 * The number is not the feature. A company running forty vans paints a number
 * on each door, and when the driver rings he says "van 17 is making a noise" —
 * he has never looked at the registration. **Finding the van from that** is
 * the feature, so most of what is checked below goes through the search box
 * rather than the table.
 *
 * This repository has found three columns nobody ever read: a follow-up table,
 * a courtesy note, a quality register naming the wrong check. A fourth would
 * be careless.
 */

import 'dotenv/config';

import { randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

import {
  clearFleetNumber,
  FleetNumberError,
  fleetNumberFor,
  fleetNumbersFor,
  setFleetNumber,
} from '../../apps/web/src/lib/fleet-numbers';
import { searchEverything } from '../../apps/web/src/lib/search';

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

const tag = randomBytes(4).toString('hex').toUpperCase();

async function main() {
  console.info('\n  What the fleet calls it\n');

  const org = await prisma.organization.create({
    data: {
      slug: `fleetno-${tag.toLowerCase()}`,
      name: `Fleet ${tag}`,
      country: 'GB',
      baseCurrency: 'GBP',
      locale: 'en-GB',
      timezone: 'Europe/London',
      locations: { create: [{ name: `Site ${tag}`, code: `F${tag.slice(0, 4)}` }] },
    },
    select: { id: true, locations: { select: { id: true } } },
  });

  const elsewhere = await prisma.organization.create({
    data: {
      slug: `fleetno-other-${tag.toLowerCase()}`,
      name: `Other ${tag}`,
      country: 'GB',
      baseCurrency: 'GBP',
      locale: 'en-GB',
      timezone: 'Europe/London',
    },
    select: { id: true },
  });

  const staff = await prisma.user.create({
    data: {
      email: `fleet-${tag.toLowerCase()}@example.com`,
      name: `Advisor ${tag}`,
      passwordHash: 'not-a-real-hash',
    },
    select: { id: true },
  });

  const [northgate, other] = await Promise.all([
    prisma.customer.create({
      data: { orgId: org.id, kind: 'COMPANY', displayName: `Northgate ${tag}` },
      select: { id: true },
    }),
    prisma.customer.create({
      data: { orgId: org.id, kind: 'COMPANY', displayName: `Riverside ${tag}` },
      select: { id: true },
    }),
  ]);

  const vans = await Promise.all(
    [1, 2, 3].map((n) =>
      prisma.vehicle.create({
        data: {
          vin: `FN${n}${tag}0000000`.slice(0, 17),
          registration: `FN${tag.slice(0, 3)}${n}`,
          make: 'Ford',
          model: 'Transit',
        },
        select: { id: true },
      }),
    ),
  );

  // A van has to have been in before the workshop can say what it is called.
  for (const [index, van] of vans.entries()) {
    await prisma.job.create({
      data: {
        orgId: org.id,
        locationId: org.locations[0]!.id,
        customerId: index === 2 ? other.id : northgate.id,
        vehicleId: van.id,
        number: 960_000 + Math.floor(Math.random() * 9_000),
        shortDescription: 'Service',
        status: 'COMPLETED',
      },
    });
  }

  const unseen = await prisma.vehicle.create({
    data: { vin: `FNX${tag}0000000`.slice(0, 17), registration: `FX${tag.slice(0, 4)}` },
    select: { id: true },
  });

  /* --- giving one a number -------------------------------------------------- */

  await setFleetNumber({
    orgId: org.id,
    userId: staff.id,
    customerId: northgate.id,
    vehicleId: vans[0]!.id,
    number: 'Van 17',
  });

  check(
    (await fleetNumberFor(org.id, northgate.id, vans[0]!.id)) === 'Van 17',
    'a fleet can say what it calls one of its vans',
  );

  await setFleetNumber({
    orgId: org.id,
    userId: staff.id,
    customerId: northgate.id,
    vehicleId: vans[1]!.id,
    number: 'Van 18',
  });

  check(
    (await fleetNumbersFor(org.id, northgate.id)).size === 2,
    'and each of its vans has its own',
  );

  /* --- and the counter can find it ------------------------------------------ */

  const found = await searchEverything(org.id, 'Van 17');

  check(
    found.length > 0 && found[0]!.id === vans[0]!.id,
    'the van is found by the only name the driver on the telephone knows',
    found.map((hit) => hit.title).join(' | '),
  );

  check(
    found[0]!.title.includes('Van 17') && (found[0]!.subtitle ?? '').includes('Northgate'),
    'and the answer says which number and whose fleet',
    `${found[0]!.title} — ${found[0]!.subtitle ?? ''}`,
  );

  const lower = await searchEverything(org.id, 'van 17');

  check(lower.length > 0 && lower[0]!.id === vans[0]!.id, 'however it is typed');

  const padded = await searchEverything(org.id, '  Van 17 ');

  check(padded.length > 0 && padded[0]!.id === vans[0]!.id, 'and with whatever spacing');

  // The registration still works, and the van is not listed twice for somebody
  // who searched the plate.
  const byPlate = await searchEverything(org.id, `FN${tag.slice(0, 3)}1`);
  const timesListed = byPlate.filter((hit) => hit.id === vans[0]!.id).length;

  check(
    timesListed === 1,
    'searching the plate still finds it, once rather than twice',
    timesListed,
  );

  /* --- what the number may not be ------------------------------------------- */

  const twice = await setFleetNumber({
    orgId: org.id,
    userId: staff.id,
    customerId: northgate.id,
    vehicleId: vans[1]!.id,
    number: 'van 17',
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FleetNumberError ? error.code : `wrong error: ${error}`),
  );

  check(
    twice === 'TAKEN',
    'one fleet cannot call two vans the same thing, whatever the case',
    twice,
  );

  const blank = await setFleetNumber({
    orgId: org.id,
    userId: staff.id,
    customerId: northgate.id,
    vehicleId: vans[1]!.id,
    number: '   ',
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FleetNumberError ? error.code : `wrong error: ${error}`),
  );

  check(blank === 'BLANK', 'and a number that says nothing is refused', blank);

  const strange = await setFleetNumber({
    orgId: org.id,
    userId: staff.id,
    customerId: northgate.id,
    vehicleId: unseen.id,
    number: 'Van 99',
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FleetNumberError ? error.code : `wrong error: ${error}`),
  );

  check(strange === 'NOT_YOURS', 'a van that has never been in cannot be numbered', strange);

  /* --- two fleets, one number ----------------------------------------------- */

  await setFleetNumber({
    orgId: org.id,
    userId: staff.id,
    customerId: other.id,
    vehicleId: vans[2]!.id,
    number: 'Van 17',
  });

  check(
    (await fleetNumberFor(org.id, other.id, vans[2]!.id)) === 'Van 17',
    'a different fleet may call one of its own vans the same thing',
  );

  const both = await searchEverything(org.id, 'Van 17');

  check(
    both.filter((hit) => hit.kind === 'vehicle').length === 2,
    'and searching it offers both, named by fleet, rather than guessing',
    both.map((hit) => hit.subtitle ?? '').join(' | '),
  );

  /* --- and it stays in this workshop ---------------------------------------- */

  const theirs = await searchEverything(elsewhere.id, 'Van 17');

  check(theirs.length === 0, 'another workshop searching the same number finds nothing');

  const notMine = await setFleetNumber({
    orgId: elsewhere.id,
    userId: staff.id,
    customerId: northgate.id,
    vehicleId: vans[0]!.id,
    number: 'Van 17',
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FleetNumberError ? error.code : `wrong error: ${error}`),
  );

  check(notMine === 'NOT_YOURS', 'and cannot number somebody else’s customer’s van', notMine);

  /* --- taking it off -------------------------------------------------------- */

  await clearFleetNumber({
    orgId: org.id,
    userId: staff.id,
    customerId: northgate.id,
    vehicleId: vans[0]!.id,
  });

  check(
    (await fleetNumberFor(org.id, northgate.id, vans[0]!.id)) === null,
    'a van leaving the fleet loses the name it was called',
  );

  const afterwards = await searchEverything(org.id, 'Van 17');

  check(
    afterwards.filter((hit) => hit.kind === 'vehicle').length === 1,
    'and the search stops offering it, leaving the other fleet’s',
    afterwards.map((hit) => hit.subtitle ?? '').join(' | '),
  );

  // Freed, so the fleet can give the number to the van that replaced it.
  const reused = await setFleetNumber({
    orgId: org.id,
    userId: staff.id,
    customerId: northgate.id,
    vehicleId: vans[1]!.id,
    number: 'Van 17',
  }).then(
    () => 'allowed',
    (error: unknown) => (error instanceof FleetNumberError ? error.code : `wrong error: ${error}`),
  );

  check(reused === 'allowed', 'and the number is free for whichever van replaces it', reused);

  /* --- clearing up ---------------------------------------------------------- */

  await prisma.fleetNumber.deleteMany({ where: { orgId: { in: [org.id, elsewhere.id] } } });
  await prisma.job.deleteMany({ where: { orgId: org.id } });
  await prisma.auditLog.updateMany({
    where: { actorUserId: staff.id },
    data: { actorUserId: null },
  });
  await prisma.customer.deleteMany({ where: { orgId: org.id } });
  await prisma.location.deleteMany({ where: { orgId: org.id } });
  await prisma.user.delete({ where: { id: staff.id } });
  await prisma.vehicle.deleteMany({
    where: { id: { in: [...vans.map((van) => van.id), unseen.id] } },
  });
  await prisma.organization.deleteMany({ where: { id: { in: [org.id, elsewhere.id] } } });

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`\n  ${checked} checks. The driver says "van 17" and the counter finds it.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
