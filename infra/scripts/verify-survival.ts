/**
 * The passport outlives the workshop. Phase 72.
 *
 *   npx tsx infra/scripts/verify-survival.ts
 *
 * A passport entry's hash covers the id of the workshop that recorded it.
 * That is deliberate: "who did this work" is half of what the entry claims.
 * It also means that if anything anywhere is able to change that column after
 * the fact, every entry the workshop ever wrote stops verifying — on every
 * car it ever touched, permanently, and silently.
 *
 * Something was. The foreign key said ON DELETE SET NULL, and the append-only
 * trigger, which lists every column of an event that may not change, did not
 * list this one. Deleting a workshop rewrote its entries to a value their
 * hashes were not computed over. CI had been saying so for a week, in the one
 * sentence that matters — a passport no longer verifies — and it was right.
 *
 * So this file asks the database, rather than the code, whether the past can
 * be rewritten by deleting something that points at it.
 *
 * The workshop and the car it creates are removed at the end.
 */

import 'dotenv/config';

import { verifyChain } from '@carnet/core';
import { prisma } from '@carnet/db';

import { createJob } from '../../apps/web/src/lib/jobs';
import { moveJob } from '../../apps/web/src/lib/money';
import { createWorkshop } from '../../apps/web/src/lib/onboarding';

const SALT = process.env.LEDGER_CHAIN_SALT ?? '';
const EMAIL = 'verify-survival@closingtime.test';
const NAME = 'Verify Survival Motors';
const VIN = 'VSUR00000000001';

let failures = 0;

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

/** Recomputes the probe car's whole chain and says whether it holds. */
async function chainHolds(vehicleId: string): Promise<boolean> {
  const events = await prisma.vehicleEvent.findMany({
    where: { vehicleId },
    orderBy: { sequence: 'asc' },
  });
  return verifyChain(events as never, SALT).valid;
}

async function main() {
  await forget();

  console.info('\nA workshop, a car, and one entry in its passport');

  const outcome = await createWorkshop(
    {
      workshopName: NAME,
      contactName: 'Nadia Belhadj',
      email: EMAIL,
      password: 'a-long-enough-password-9',
      sites: 1,
      country: 'gb',
    },
    { plan: 'CORE', acceptConsumerEmail: true },
  );
  if (!outcome.ok) throw new Error(JSON.stringify(outcome.problems));

  const org = await prisma.organization.findFirstOrThrow({
    where: { name: NAME },
    select: { id: true },
  });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: EMAIL },
    select: { id: true },
  });
  const customer = await prisma.customer.create({
    data: { orgId: org.id, kind: 'INDIVIDUAL', displayName: 'Probe Customer' },
    select: { id: true },
  });
  // Demonstration data, so the run can take its own car away again at the
  // end. Nothing else about the probe depends on the flag.
  const vehicle = await prisma.vehicle.create({
    data: {
      vin: VIN,
      make: 'Peugeot',
      model: '208',
      year: 2020,
      registration: 'SURV 001',
      isDemonstration: true,
    },
    select: { id: true },
  });

  const job = await createJob({
    orgId: org.id,
    userId: owner.id,
    locationId: null,
    customerId: customer.id,
    vehicleId: vehicle.id,
    shortDescription: 'Cambelt and water pump',
  });
  await prisma.jobLabourLine.create({
    data: { jobId: job.id, description: 'Cambelt', hours: 4, rate: 90 },
  });
  await moveJob({ orgId: org.id, userId: owner.id, jobId: job.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: owner.id, jobId: job.id, to: 'COMPLETED' });

  const entry = await prisma.vehicleEvent.findFirstOrThrow({
    where: { vehicleId: vehicle.id },
    orderBy: { sequence: 'asc' },
    select: { id: true, recordedByOrgId: true, payload: true },
  });
  check('the entry names the workshop that wrote it', entry.recordedByOrgId, org.id);
  check('and so does what it says', (entry.payload as { workshop?: string }).workshop, NAME);
  check('the passport verifies', await chainHolds(vehicle.id), true);

  console.info('\nThe workshop closes');

  let deleted = false;
  try {
    await prisma.organization.delete({ where: { id: org.id } });
    deleted = true;
  } catch {
    // The foreign key refuses, which is the point.
  }
  check('deleting it outright is refused', deleted, false);
  check('so the entry still names it', await orgOn(entry.id), org.id);
  check('and the passport still verifies', await chainHolds(vehicle.id), true);

  console.info('\nNor by hand');

  let rewritten = false;
  try {
    await prisma.$executeRaw`UPDATE vehicle_events SET "recordedByOrgId" = NULL WHERE id = ${entry.id}`;
    rewritten = true;
  } catch {
    // The append-only trigger refuses.
  }
  check('nulling the column by hand is refused', rewritten, false);
  check('the passport verifies after that too', await chainHolds(vehicle.id), true);

  console.info('\nIt is retired instead');

  await prisma.organization.update({
    where: { id: org.id },
    data: { name: `${NAME} (closed)`, isActive: false },
  });
  check('the workshop is closed', await activeOf(org.id), false);
  check('the passport is not', await chainHolds(vehicle.id), true);
  check(
    'and the entry still says who did the work',
    (entry.payload as { workshop?: string }).workshop,
    NAME,
  );

  console.info('\nAnd made-up history can still be taken away');

  await prisma.vehicleEvent.deleteMany({ where: { vehicleId: vehicle.id } });
  await prisma.vehicle.delete({ where: { id: vehicle.id } });
  await prisma.journalEntry.deleteMany({ where: { orgId: org.id } });
  let gone = false;
  try {
    await prisma.organization.delete({ where: { id: org.id } });
    gone = true;
  } catch (error) {
    console.error(`  (the probe workshop would not go: ${String(error).slice(0, 160)})`);
  }
  check('with nothing left pointing at it, the workshop goes', gone, true);

  await forget();
  console.info(failures === 0 ? '\nAll good.' : `\n${failures} failed.`);
  if (failures > 0) process.exitCode = 1;
}

async function orgOn(eventId: string): Promise<string | null> {
  const row = await prisma.vehicleEvent.findUnique({
    where: { id: eventId },
    select: { recordedByOrgId: true },
  });
  return row?.recordedByOrgId ?? null;
}

async function activeOf(orgId: string): Promise<boolean | null> {
  const row = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { isActive: true },
  });
  return row?.isActive ?? null;
}

/**
 * Everything this probe has ever left behind. A run that fails half way
 * through leaves a workshop that cannot be deleted, so the next run has to be
 * able to take the car away first — which it can, because the car is marked
 * as demonstration data.
 */
async function forget() {
  const vehicles = await prisma.vehicle.findMany({ where: { vin: VIN }, select: { id: true } });
  for (const vehicle of vehicles) {
    await prisma.vehicleEvent.deleteMany({ where: { vehicleId: vehicle.id } });
    await prisma.vehicle.delete({ where: { id: vehicle.id } });
  }

  const orgs = await prisma.organization.findMany({
    where: { name: { startsWith: NAME } },
    select: { id: true },
  });
  for (const org of orgs) {
    await prisma.journalEntry.deleteMany({ where: { orgId: org.id } });
    try {
      await prisma.organization.delete({ where: { id: org.id } });
    } catch {
      await prisma.organization.update({
        where: { id: org.id },
        data: {
          name: `${NAME} (retired ${org.id.slice(-6)})`,
          slug: `verify-survival-retired-${org.id.slice(-8)}`,
          isActive: false,
        },
      });
    }
  }

  const users = await prisma.user.findMany({ where: { email: EMAIL }, select: { id: true } });
  for (const user of users) {
    try {
      await prisma.user.delete({ where: { id: user.id } });
    } catch {
      await prisma.user.update({
        where: { id: user.id },
        data: { email: `retired-${user.id.slice(-8)}-${EMAIL}`, isActive: false },
      });
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
