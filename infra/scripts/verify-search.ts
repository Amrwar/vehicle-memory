/**
 * Finding anything, and being told, against a real database. Phase 39.
 *
 *   npx tsx infra/scripts/verify-search.ts [baseUrl]
 *
 * A plate typed with and without its space, a VIN, a telephone number
 * typed with and without its spaces, a job number with and without its
 * hash, an invoice number and a part number each find the one record they
 * name, exactly; a name finds a list; another workshop's customers and cars
 * are never found. A customer's decision, a technician's part request and
 * an online booking notify the people who would act on them and not the
 * person who caused it; opening one marks it read and goes to its record.
 * With a server on the base URL an exact search is read going straight to
 * its record, and the notifications page is read.
 *
 * Runs against the seeded organisations. Cleans up after itself.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

import { createJob } from '../../apps/web/src/lib/jobs';
import { recordDecision } from '../../apps/web/src/lib/portal';
import {
  markAllRead,
  notificationsFor,
  openNotification,
  searchEverything,
  unreadNotifications,
} from '../../apps/web/src/lib/search';
import { requestPart } from '../../apps/web/src/lib/shopfloor';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const TAG = 'Verify search probe';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function exactly(orgId: string, typed: string) {
  const hits = await searchEverything(orgId, typed);
  return hits.filter((hit) => hit.exact).map((hit) => `${hit.kind}:${hit.id}`);
}

async function main() {
  console.info(`\n  Finding anything\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const other = await prisma.organization.findFirstOrThrow({
    where: { slug: 'kirkstall-autocentre' },
  });

  await forget(org.id);

  /* --- identifiers ---------------------------------------------------- */

  console.info('\n  Identifiers\n');

  const job = await prisma.job.findFirstOrThrow({
    where: {
      orgId: org.id,
      vehicle: { registration: { not: null } },
      customer: { mobile: { not: null } },
    },
    orderBy: { number: 'asc' },
    select: {
      id: true,
      number: true,
      vehicle: { select: { id: true, registration: true, vin: true } },
      customer: { select: { id: true, displayName: true, mobile: true } },
    },
  });
  const plate = job.vehicle.registration!;
  const compact = plate.replace(/[^A-Za-z0-9]/g, '');

  check(`the plate "${plate}" finds the car`, await exactly(org.id, plate), [
    `vehicle:${job.vehicle.id}`,
  ]);
  check(`typed "${compact.toLowerCase()}"`, await exactly(org.id, compact.toLowerCase()), [
    `vehicle:${job.vehicle.id}`,
  ]);
  check('the VIN finds the car', await exactly(org.id, job.vehicle.vin), [
    `vehicle:${job.vehicle.id}`,
  ]);

  const mobile = job.customer.mobile!;
  const digits = mobile.replace(/\D/g, '');
  const spaced = digits.replace(/(\d{4})(\d{3})(\d+)/, '$1 $2 $3');
  const phoneHits = await exactly(org.id, spaced);
  check(
    `the number "${spaced}" finds the customer`,
    phoneHits.includes(`customer:${job.customer.id}`),
    true,
  );

  check(
    `job #${job.number}`,
    (await exactly(org.id, `#${job.number}`)).includes(`job:${job.id}`),
    true,
  );
  check(
    `job ${job.number}`,
    (await exactly(org.id, String(job.number))).includes(`job:${job.id}`),
    true,
  );

  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true, number: true },
  });
  check(`invoice ${invoice.number}`, await exactly(org.id, invoice.number.toLowerCase()), [
    `invoice:${invoice.id}`,
  ]);

  const part = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true, partNumber: true },
  });
  check(
    `part ${part.partNumber}`,
    (await exactly(org.id, part.partNumber)).includes(`part:${part.id}`),
    true,
  );

  const firstName = job.customer.displayName.split(' ')[0]!;
  const byName = await searchEverything(org.id, firstName);
  check(
    `a name "${firstName}" finds a list, never exact`,
    [
      byName.some((hit) => hit.id === job.customer.id),
      byName.some((hit) => hit.kind === 'customer' && hit.exact),
    ],
    [true, false],
  );
  check('one character finds nothing', (await searchEverything(org.id, 'a')).length, 0);

  /* --- another workshop ----------------------------------------------- */

  const theirs = await prisma.customer.findFirst({
    where: { orgId: other.id },
    select: { id: true, displayName: true },
  });
  if (theirs) {
    const found = await searchEverything(org.id, theirs.displayName);
    check(
      "another workshop's customer is never found",
      found.some((hit) => hit.id === theirs.id),
      false,
    );
  }
  const theirCar = await prisma.vehicle.findFirst({
    where: {
      registration: { not: null },
      jobs: { some: { orgId: other.id }, none: { orgId: org.id } },
      accessGrants: { none: { orgId: org.id } },
    },
    select: { id: true, registration: true },
  });
  if (theirCar) {
    const found = await searchEverything(org.id, theirCar.registration!);
    check(
      'a car only another workshop has worked on is never found',
      found.some((hit) => hit.id === theirCar.id),
      false,
    );
  }

  /* --- notifications -------------------------------------------------- */

  console.info('\n  Notifications\n');

  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
    select: { id: true },
  });
  const technician = await prisma.user.findUniqueOrThrow({
    where: { email: 'john@hillsidemotors.test' },
    select: { id: true },
  });
  await markAllRead(org.id, owner.id);
  await markAllRead(org.id, technician.id);

  const probe = await createJob({
    orgId: org.id,
    userId: owner.id,
    locationId: null,
    customerId: job.customer.id,
    vehicleId: job.vehicle.id,
    shortDescription: TAG,
  });
  const estimate = await prisma.estimate.create({
    data: {
      orgId: org.id,
      jobId: probe.id,
      version: 1,
      status: 'SENT',
      currency: 'GBP',
      subtotal: 100,
      total: 120,
      taxTotal: 20,
      lines: {
        create: [
          { kind: 'LABOUR', description: 'Probe', quantity: 1, unitPrice: 100, lineTotal: 100 },
        ],
      },
    },
    select: { id: true, lines: { select: { id: true } } },
  });
  await recordDecision({
    estimateId: estimate.id,
    approvedLineIds: estimate.lines.map((l) => l.id),
    approvedByName: job.customer.displayName,
  });
  const ownerRows = await notificationsFor(org.id, owner.id);
  const decided = ownerRows.find(
    (row) => row.kind === 'ESTIMATE_DECIDED' && row.href === `/jobs/${probe.id}`,
  );
  check(
    'the owner is told the quote was approved',
    Boolean(decided && decided.title.includes('approved')),
    true,
  );

  await requestPart({
    orgId: org.id,
    userId: technician.id,
    jobId: probe.id,
    notes: `${TAG} wiper blades`,
  });
  const partForOwner = (await notificationsFor(org.id, owner.id)).find(
    (row) => row.kind === 'PART_REQUESTED' && row.body?.includes(TAG),
  );
  const partForTech = (await notificationsFor(org.id, technician.id)).find(
    (row) => row.kind === 'PART_REQUESTED' && row.body?.includes(TAG),
  );
  check('whoever approves spending is told of a part request', Boolean(partForOwner), true);
  check('and the technician who asked is not', Boolean(partForTech), false);

  const theirUsers = await prisma.membership.findMany({
    where: { orgId: other.id },
    select: { userId: true },
  });
  const leaked = await prisma.staffNotification.count({
    where: { userId: { in: theirUsers.map((m) => m.userId) }, entityId: estimate.id },
  });
  check("another workshop's staff are told nothing", leaked, 0);

  const before = await unreadNotifications(org.id, owner.id);
  const href = await openNotification(org.id, owner.id, decided!.id);
  check('opening one goes to its record', href, `/jobs/${probe.id}`);
  check('and marks it read', before - (await unreadNotifications(org.id, owner.id)), 1);
  check(
    "nobody can open another person's",
    await openNotification(org.id, technician.id, decided!.id),
    null,
  );

  /* --- the screens ---------------------------------------------------- */

  const cookie = await sessionFor(owner.id, org.id);
  try {
    const response = await fetch(`${BASE}/search?q=${encodeURIComponent(compact.toLowerCase())}`, {
      headers: { cookie },
      redirect: 'manual',
    });
    const body = await response.text();
    const location = response.headers.get('location') ?? '';
    const redirected =
      location.includes(`/vehicles/${job.vehicle.id}`) ||
      body.includes(`/vehicles/${job.vehicle.id}`);
    check('an exact search goes straight to the car', redirected, true);
    const page = await fetch(`${BASE}/notifications`, { headers: { cookie }, redirect: 'manual' });
    check(
      'the notifications page lists them',
      (await page.text()).includes('A part is needed'),
      true,
    );
    const list = await fetch(`${BASE}/search?q=${encodeURIComponent(firstName)}`, {
      headers: { cookie },
      redirect: 'manual',
    });
    check(
      'a name search lists results',
      (await list.text()).includes(job.customer.displayName),
      true,
    );
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   the screens: no server at ${BASE} (${String(error)})`);
  }

  await forget(org.id);
  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

async function sessionFor(userId: string, orgId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const estimates = await prisma.estimate.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });
  const requests = await prisma.purchaseRequest.findMany({
    where: { orgId, jobId: { in: jobIds } },
    select: { id: true },
  });
  await prisma.staffNotification.deleteMany({
    where: {
      orgId,
      entityId: { in: [...estimates.map((e) => e.id), ...requests.map((r) => r.id)] },
    },
  });
  await prisma.purchaseRequest.deleteMany({ where: { id: { in: requests.map((r) => r.id) } } });
  await prisma.conversation.deleteMany({ where: { orgId, jobId: { in: jobIds } } });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
