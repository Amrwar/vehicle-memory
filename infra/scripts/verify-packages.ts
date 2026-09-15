/**
 * Service packages, against a real database. Phase 37.
 *
 *   npx tsx infra/scripts/verify-packages.ts [baseUrl]
 *
 * A package is saved whole and refused when unsound; a job made from it in
 * one press carries its lines, its checklist, its kind of work and its
 * time; a package added to a job already under way is appended after what
 * is there; a booking taken for a package becomes a job from that package
 * when the car arrives; completing the job sets the vehicle's next one;
 * customers booking online are offered it with its price. With a server on
 * the base URL the settings page and the new-job form are read.
 *
 * Runs against the seeded hillside-motors organisation. Cleans up after
 * itself.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

import { servicesFor } from '../../apps/web/src/lib/booking';
import { createBooking, startJobFromBooking } from '../../apps/web/src/lib/bookings';
import { createJob } from '../../apps/web/src/lib/jobs';
import { moveJob } from '../../apps/web/src/lib/money';
import {
  applyPackage,
  PackageError,
  packageDetail,
  savePackage,
  setPackageActive,
} from '../../apps/web/src/lib/packages';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const TAG = 'Verify packages probe';
const CODE = 'PROBE-FULL';

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

async function refuses(label: string, code: string, run: () => Promise<unknown>) {
  try {
    await run();
    failures += 1;
    console.error(`  FAIL   ${label}: it went ahead`);
  } catch (error) {
    const actual = (error as { code?: string }).code;
    if (error instanceof PackageError && actual === code)
      console.info(`  ok     ${label}: ${code}`);
    else {
      failures += 1;
      console.error(`  FAIL   ${label}: expected ${code}, got ${String(error)}`);
    }
  }
}

async function main() {
  console.info(`\n  Service packages\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const staff = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });
  const maria = await prisma.user.findUniqueOrThrow({ where: { email: 'maria@example.test' } });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, portalUserId: maria.id },
    select: { id: true },
  });
  const seeded = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, customerId: customer.id },
    select: { vehicleId: true, locationId: true },
  });
  const product = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true, partNumber: true, name: true },
  });
  const jobType = await prisma.jobType.findFirst({
    where: { orgId: org.id, isActive: true, requiresQualityCheck: false },
    select: { id: true, name: true },
  });

  await forget(org.id);

  /* ------------------------------------------------------------------
     Saving
     ------------------------------------------------------------------ */

  console.info('\n  Saving\n');

  const base = {
    orgId: org.id,
    userId: staff.id,
    code: CODE,
    name: `${TAG} full service`,
    description: 'Oil, filter, all fluids, a check round the car.',
    jobTypeId: jobType?.id ?? null,
    durationMinutes: 150,
    price: 199,
    intervalMonths: 12,
    intervalKm: 20_000,
    bookable: true,
    lines: [
      { kind: 'LABOUR' as const, description: 'Service labour', quantity: 2.5, unitPrice: 60 },
      {
        kind: 'PART' as const,
        description: product.name,
        quantity: 1,
        unitPrice: 12.5,
        productId: product.id,
      },
      { kind: 'FEE' as const, description: 'Waste oil disposal', quantity: 1, unitPrice: 4 },
    ],
    checks: [{ title: 'Reset the service indicator' }, { title: 'Stamp the book' }],
  };

  await refuses('a package with no lines is refused', 'NO_LINES', () =>
    savePackage({ ...base, lines: [] }),
  );
  await refuses('a negative price is refused', 'BAD_PRICE', () =>
    savePackage({ ...base, price: -5 }),
  );
  await refuses('a zero duration is refused', 'BAD_DURATION', () =>
    savePackage({ ...base, durationMinutes: 0 }),
  );
  await refuses("somebody else's product is refused", 'BAD_LINE', () =>
    savePackage({
      ...base,
      lines: [
        { kind: 'PART', description: 'x', quantity: 1, unitPrice: 1, productId: 'not-a-product' },
      ],
    }),
  );

  const packageId = await savePackage(base);
  const saved = await packageDetail(org.id, packageId);
  check(
    'saved whole',
    {
      lines: saved?.lines.length,
      checks: saved?.checks.length,
      hours: saved?.hours,
      price: saved?.total.price,
      linesTotal: saved?.total.linesTotal,
      saving: saved?.total.saving,
      part: saved?.lines[1]?.partNumber,
    },
    {
      lines: 3,
      checks: 2,
      hours: 2.5,
      price: 199,
      linesTotal: 166.5,
      saving: -32.5,
      part: product.partNumber,
    },
  );

  await refuses('the same code twice is refused', 'NO_CODE', () =>
    savePackage({ ...base, name: 'Another' }),
  );

  const again = await savePackage({
    ...base,
    packageId,
    checks: [{ title: 'Only one check now' }],
  });
  const edited = await packageDetail(org.id, again);
  check(
    'editing replaces the lines and checks rather than adding to them',
    [again === packageId, edited?.checks.length, edited?.lines.length],
    [true, 1, 3],
  );

  /* ------------------------------------------------------------------
     A job from a package, one press
     ------------------------------------------------------------------ */

  console.info('\n  A job from a package\n');

  const job = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId: customer.id,
    vehicleId: seeded.vehicleId,
    shortDescription: TAG,
    packageId,
  });
  const made = await prisma.job.findUniqueOrThrow({
    where: { id: job.id },
    select: {
      packageId: true,
      estimatedHours: true,
      labourLines: { select: { description: true, hours: true, rate: true } },
      partLines: { select: { productId: true, partNumber: true, quantity: true } },
      feeLines: { select: { amount: true } },
      tasks: { select: { title: true } },
      jobTypes: { select: { jobTypeId: true } },
    },
  });
  check(
    'the job starts with the package on it',
    {
      package: made.packageId === packageId,
      hours: Number(made.estimatedHours),
      labour: made.labourLines.map((l) => [l.description, Number(l.hours), Number(l.rate)]),
      part: [made.partLines[0]?.productId === product.id, made.partLines[0]?.partNumber],
      fee: Number(made.feeLines[0]?.amount),
      tasks: made.tasks.map((t) => t.title),
      type: jobType ? made.jobTypes[0]?.jobTypeId === jobType.id : true,
    },
    {
      package: true,
      hours: 2.5,
      labour: [['Service labour', 2.5, 60]],
      part: [true, product.partNumber],
      fee: 4,
      tasks: ['Only one check now'],
      type: true,
    },
  );

  /* --- added to a job already under way --------------------------- */

  const plain = await createJob({
    orgId: org.id,
    userId: staff.id,
    locationId: null,
    customerId: customer.id,
    vehicleId: seeded.vehicleId,
    shortDescription: TAG,
  });
  await prisma.jobLabourLine.create({
    data: { jobId: plain.id, description: 'Diagnosis', hours: 0.5, rate: 60 },
  });
  const applied = await applyPackage({
    orgId: org.id,
    userId: staff.id,
    jobId: plain.id,
    packageId,
  });
  const after = await prisma.job.findUniqueOrThrow({
    where: { id: plain.id },
    select: {
      labourLines: { orderBy: { sortOrder: 'asc' }, select: { description: true } },
      packageId: true,
    },
  });
  check(
    'a package added to a job goes after what is there',
    {
      added: applied,
      labour: after.labourLines.map((l) => l.description),
      package: after.packageId === packageId,
    },
    { added: { lines: 3, tasks: 1 }, labour: ['Diagnosis', 'Service labour'], package: true },
  );

  await moveJob({ orgId: org.id, userId: staff.id, jobId: plain.id, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: staff.id, jobId: plain.id, to: 'COMPLETED' });
  await refuses('a closed job takes no package', 'BAD_LINE', async () => {
    await prisma.job.update({ where: { id: plain.id }, data: { status: 'PAID' } });
    return applyPackage({ orgId: org.id, userId: staff.id, jobId: plain.id, packageId });
  });

  /* ------------------------------------------------------------------
     Booked for a package, then the car arrives
     ------------------------------------------------------------------ */

  console.info('\n  Booked for a package\n');

  const startAt = new Date();
  startAt.setHours(10, 0, 0, 0);
  const bookingId = await createBooking({
    orgId: org.id,
    userId: staff.id,
    locationId: seeded.locationId,
    customerId: customer.id,
    vehicleId: seeded.vehicleId,
    startAt,
    estimatedHours: 0,
    description: TAG,
    packageId,
  });
  const booked = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { estimatedHours: true, packageId: true },
  });
  check(
    'the booking takes its time from the package',
    [Number(booked.estimatedHours), booked.packageId === packageId],
    [2.5, true],
  );

  const { jobId } = await startJobFromBooking({ orgId: org.id, userId: staff.id, bookingId });
  const arrived = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    select: {
      packageId: true,
      _count: { select: { labourLines: true, partLines: true, tasks: true } },
    },
  });
  check(
    'the car arrives onto a job made from the package',
    [
      arrived.packageId === packageId,
      arrived._count.labourLines,
      arrived._count.partLines,
      arrived._count.tasks,
    ],
    [true, 1, 1, 1],
  );

  /* ------------------------------------------------------------------
     The next one
     ------------------------------------------------------------------ */

  console.info('\n  The next one\n');

  await prisma.job.update({ where: { id: jobId }, data: { odometerInKm: 50_000 } });
  await moveJob({ orgId: org.id, userId: staff.id, jobId, to: 'IN_PROGRESS' });
  await moveJob({ orgId: org.id, userId: staff.id, jobId, to: 'COMPLETED' });
  const schedule = await prisma.serviceSchedule.findFirst({
    where: { vehicleId: seeded.vehicleId, orgId: org.id, name: base.name },
    select: { dueKm: true, dueAt: true, lastPerformedKm: true, intervalMonths: true },
  });
  check(
    "completing it sets the vehicle's next one",
    {
      dueKm: schedule?.dueKm,
      months: schedule?.intervalMonths,
      dueInAYear: schedule?.dueAt
        ? Math.abs(Math.round((schedule.dueAt.getTime() - Date.now()) / 86_400_000) - 365) <= 1
        : null,
    },
    { dueKm: 70_000, months: 12, dueInAYear: true },
  );

  /* ------------------------------------------------------------------
     Bookable online, and the screens
     ------------------------------------------------------------------ */

  console.info('\n  Online and on screen\n');

  const offered = (await servicesFor(org.id)).find((s) => s.id === packageId);
  check(
    'customers booking online are offered it with its price',
    [offered?.kind, offered?.price, offered?.hours],
    ['package', 199, 2.5],
  );
  await setPackageActive({ orgId: org.id, userId: staff.id, packageId, isActive: false });
  check(
    'a retired package is not offered',
    (await servicesFor(org.id)).some((s) => s.id === packageId),
    false,
  );
  await setPackageActive({ orgId: org.id, userId: staff.id, packageId, isActive: true });

  const cookie = await sessionFor(staff.id, org.id);
  await screenHas('the settings page lists the package', '/settings/packages', cookie, base.name);
  await screenHas('the new-job form offers it', '/jobs/new', cookie, base.name);
  await screenHas('the booking form offers it', '/bookings/new', cookie, base.name);

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

async function screenHas(label: string, path: string, cookie: string, text: string) {
  try {
    const response = await fetch(`${BASE}${path}`, { headers: { cookie }, redirect: 'manual' });
    const body = await response.text();
    if (response.status !== 200) {
      failures += 1;
      console.error(`  FAIL   ${label}: ${path} answered ${response.status}`);
      return;
    }
    check(label, body.includes(text), true);
  } catch (error) {
    failures += 1;
    console.error(`  FAIL   ${label}: no server at ${BASE} (${String(error)})`);
  }
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true, vehicleId: true },
  });
  const jobIds = jobs.map((j) => j.id);
  const invoices = await prisma.invoice.findMany({
    where: { jobId: { in: jobIds } },
    select: { id: true },
  });
  for (const source of [
    ...jobIds.map((id) => ({ sourceType: 'Job', sourceId: id })),
    ...invoices.map((i) => ({ sourceType: 'Invoice', sourceId: i.id })),
  ])
    await prisma.journalEntry.deleteMany({ where: { orgId, ...source } });
  // Stock the probe's part lines drew at completion, put back.
  const movements = await prisma.stockMovement.findMany({
    where: { orgId, referenceType: 'Job', referenceId: { in: jobIds } },
    select: { id: true, productId: true, warehouseId: true, quantity: true },
  });
  for (const m of movements) {
    await prisma.stockLevel.update({
      where: { productId_warehouseId: { productId: m.productId, warehouseId: m.warehouseId } },
      data: { onHand: { increment: Math.abs(Number(m.quantity)) } },
    });
  }
  await prisma.stockMovement.deleteMany({ where: { id: { in: movements.map((m) => m.id) } } });
  await prisma.invoice.deleteMany({ where: { id: { in: invoices.map((i) => i.id) } } });
  await prisma.messageLog.deleteMany({ where: { orgId, relatedId: { in: jobIds } } });
  await prisma.outboxEvent.deleteMany({
    where: { orgId, type: { in: ['job.completed'] }, processedAt: null },
  });
  await prisma.booking.deleteMany({ where: { orgId, description: TAG } });
  await prisma.conversation.deleteMany({ where: { orgId, jobId: { in: jobIds } } });
  await prisma.job.deleteMany({ where: { id: { in: jobIds } } });
  await prisma.serviceSchedule.deleteMany({ where: { orgId, name: { startsWith: TAG } } });
  await prisma.servicePackage.deleteMany({ where: { orgId, code: CODE } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
