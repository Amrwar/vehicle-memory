/**
 * The workshop's own clock. Phase 52.
 *
 *   npx tsx infra/scripts/verify-clock.ts             measure and report
 *   npx tsx infra/scripts/verify-clock.ts --record    and write it down as the baseline
 *   npx tsx infra/scripts/verify-clock.ts --against   compare with the baseline
 *
 * Phase 51 measured the software. This measures the work, and the difference
 * is the whole point of the phase: a screen that answers in a fifth of a
 * second has not helped anybody if the car still sits on the forecourt for an
 * hour before a job is written.
 *
 * The hard part is not the arithmetic, it is not lying. A median over three
 * jobs is an anecdote with a decimal point, so every stretch carries what it
 * could measure out of what it looked at and refuses to report at all below
 * five. And the figures must come from the right two moments, which is what
 * the first half of this script proves: it builds one job with known timings,
 * measures it, and checks each stretch came back as the interval that was put
 * in — because a clock reading the wrong column is worse than no clock, and
 * looks exactly the same.
 */

import 'dotenv/config';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import {
  changed,
  coverage,
  describeClock,
  describeSeconds,
  medianSeconds,
  type Measured,
  record as recordOf,
  type Recorded,
  verdictOf,
  worstStretchesFirst,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { STRETCHES, workshopClock } from '../../apps/web/src/lib/clock';

const BASELINE = join(process.cwd(), 'docs', '05-project', 'clock-baseline.json');
const TAG = 'Clock probe';

let failures = 0;
let checked = 0;

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `  (${String(detail)})`}`);
  }
}

const MINUTE = 60_000;

/* ---------------------------------------------------------------------------
   That the clock reads the right two moments
   --------------------------------------------------------------------------- */

/**
 * One job, with every moment put in by hand at a known interval.
 *
 * Built with raw writes rather than through the application on purpose: the
 * question here is whether `workshopClock` reads the columns it claims to
 * read, and going through the functions that set them would let a stretch
 * pointing at the wrong column still come back with a plausible number.
 */
async function buildAJobWithKnownTimings(orgId: string) {
  const [customer, vehicle, location] = await Promise.all([
    prisma.customer.findFirstOrThrow({ where: { orgId }, select: { id: true } }),
    prisma.vehicleAccessGrant.findFirstOrThrow({ where: { orgId }, select: { vehicleId: true } }),
    prisma.location.findFirstOrThrow({ where: { orgId }, select: { id: true } }),
  ]);

  const base = Date.now() - 3 * 86_400_000;
  const at = (minutes: number) => new Date(base + minutes * MINUTE);

  const sequence = await prisma.documentSequence.upsert({
    where: { orgId_kind: { orgId, kind: 'JOB' } },
    create: { orgId, kind: 'JOB', next: 900_002 },
    update: { next: { increment: 1 } },
  });

  const job = await prisma.job.create({
    data: {
      orgId,
      locationId: location.id,
      number: sequence.next - 1,
      customerId: customer.id,
      vehicleId: vehicle.vehicleId,
      shortDescription: TAG,
      status: 'PAID',
      // The intervals this script asserts on, in minutes:
      receivedAt: at(0), //     arrival  ->  10
      createdAt: at(10), //     ramp     ->  50
      startedAt: at(30), //
      completedAt: at(80), //   billing  ->  20, collection -> 40
      invoicedAt: at(100), //
      collectedAt: at(120), //
    },
    select: { id: true },
  });

  const template = await prisma.inspectionTemplate.findFirstOrThrow({
    where: { orgId },
    select: { id: true },
  });

  const inspection = await prisma.inspection.create({
    data: {
      jobId: job.id,
      templateId: template.id,
      status: 'COMPLETED',
      startedAt: at(30), //     inspection -> 25
      completedAt: at(55), //   quoting    -> 15
    },
    select: { id: true },
  });

  const estimate = await prisma.estimate.create({
    data: {
      orgId,
      jobId: job.id,
      status: 'APPROVED',
      sentAt: at(70), //        approval -> 30
      decidedAt: at(100),
      createdAt: at(60),
    },
    select: { id: true },
  });

  const request = await prisma.purchaseRequest.create({
    data: { orgId, jobId: job.id, notes: TAG, createdAt: at(60) },
    select: { id: true },
  });

  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { orgId },
    select: { id: true },
  });

  await prisma.purchaseOrder.create({
    data: {
      orgId,
      supplierId: supplier.id,
      requestId: request.id,
      number: `${TAG}-PO-${sequence.next}`,
      status: 'SENT',
      createdAt: at(105), //    ordering -> 45
    },
  });

  const invoice = await prisma.invoice.create({
    data: {
      orgId,
      customerId: customer.id,
      jobId: job.id,
      number: `${TAG}-INV-${sequence.next}`,
      status: 'PAID',
      subtotal: 100,
      taxTotal: 20,
      total: 120,
      amountPaid: 120,
      issuedAt: at(100), //     paid -> 80
      createdAt: at(100),
    },
    select: { id: true },
  });

  await prisma.payment.create({
    data: {
      orgId,
      invoiceId: invoice.id,
      customerId: customer.id,
      amount: 120,
      method: 'CARD',
      receivedAt: at(180),
      createdAt: at(180),
    },
  });

  return { jobId: job.id, inspectionId: inspection.id, estimateId: estimate.id, since: at(-60) };
}

async function forget(orgId: string) {
  const jobs = await prisma.job.findMany({
    where: { orgId, shortDescription: TAG },
    select: { id: true },
  });

  const ids = jobs.map((job) => job.id);

  await prisma.payment.deleteMany({ where: { invoice: { jobId: { in: ids } } } });
  await prisma.invoice.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.purchaseOrder.deleteMany({ where: { orgId, number: { startsWith: TAG } } });
  await prisma.purchaseRequest.deleteMany({ where: { orgId, notes: TAG } });
  await prisma.estimate.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.inspection.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.job.deleteMany({ where: { id: { in: ids } } });
}

/* ---------------------------------------------------------------------------
   Writing it down
   --------------------------------------------------------------------------- */

interface Baseline {
  takenAt: string;
  workshop: string;
  windowDays: number;
  stretches: Recorded[];
}

function readBaseline(): Baseline | null {
  if (!existsSync(BASELINE)) return null;
  return JSON.parse(readFileSync(BASELINE, 'utf8')) as Baseline;
}

function writeBaseline(baseline: Baseline) {
  mkdirSync(dirname(BASELINE), { recursive: true });
  writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`);
}

/* ---------------------------------------------------------------------------
   The run
   --------------------------------------------------------------------------- */

const WINDOW_DAYS = 400;

async function main() {
  console.info("\n  The workshop's own clock\n");

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true, name: true },
  });

  /* --- the clock reads the right two moments ------------------------------- */

  console.info('  That it is reading the right two moments');

  await forget(org.id);
  const made = await buildAJobWithKnownTimings(org.id);

  const only = await workshopClock(org.id, made.since);
  const byName = new Map(only.map((one) => [one.stretch.name, one]));

  const expected: [string, number][] = [
    [STRETCHES.arrival!.name, 10],
    [STRETCHES.inspection!.name, 25],
    [STRETCHES.quoting!.name, 15],
    [STRETCHES.approval!.name, 30],
    [STRETCHES.ordering!.name, 45],
    [STRETCHES.onTheRamp!.name, 50],
    [STRETCHES.collection!.name, 40],
    [STRETCHES.billing!.name, 20],
    [STRETCHES.paid!.name, 80],
  ];

  for (const [name, minutes] of expected) {
    const measured = byName.get(name);
    const seen = measured?.samples ?? [];

    // The job just made is the only one in the window with these moments, but
    // the seeded workshop has others, so the assertion is that the interval
    // put in is among what came back rather than that it is the only thing.
    check(
      seen.includes(minutes * 60),
      `${name} is ${minutes} minutes`,
      seen.length === 0 ? 'nothing measured' : seen.map((s) => s / 60).join(', '),
    );
  }

  // A moment that never happened must not become a zero. A job that was never
  // collected is not a job collected instantly, and the difference is the
  // difference between a figure and a lie.
  const notCollected = await prisma.job.create({
    data: {
      orgId: org.id,
      locationId: (await prisma.location.findFirstOrThrow({ where: { orgId: org.id } })).id,
      number: 999_001,
      customerId: (await prisma.customer.findFirstOrThrow({ where: { orgId: org.id } })).id,
      vehicleId: (await prisma.vehicleAccessGrant.findFirstOrThrow({ where: { orgId: org.id } }))
        .vehicleId,
      shortDescription: TAG,
      status: 'COMPLETED',
      receivedAt: new Date(Date.now() - 86_400_000),
      completedAt: new Date(Date.now() - 3_600_000),
    },
    select: { id: true },
  });

  const withGap = await workshopClock(org.id, made.since);
  const collection = withGap.find((one) => one.stretch.name === STRETCHES.collection!.name)!;

  check(
    !collection.samples.includes(0) && collection.candidates > collection.samples.length,
    'a car that was never collected is left out rather than counted as nought',
    `${collection.samples.length} of ${collection.candidates}`,
  );

  await prisma.job.delete({ where: { id: notCollected.id } });
  await forget(org.id);

  /* --- and then what the workshop actually took ---------------------------- */

  console.info("\n  What this workshop's work actually took\n");

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const clock = await workshopClock(org.id, since);

  for (const measured of worstStretchesFirst(clock)) {
    const verdict = verdictOf(measured);
    const median = medianSeconds(measured.samples);

    console.info(
      `  ${verdict === 'slow' ? 'SLOW' : verdict === 'unknown' ? '    ' : '  ok'}  ` +
        `${measured.stretch.name.padEnd(30)}` +
        `${(median === null ? '—' : describeSeconds(median)).padStart(12)}  ` +
        `of ${describeSeconds(measured.stretch.target).padEnd(10)} ` +
        `seen on ${measured.samples.length} of ${measured.candidates} (${coverage(measured)}%)`,
    );
  }

  console.info(`\n  ${describeClock(clock)}`);

  // Not a failure. A seeded workshop has a handful of jobs and most of these
  // will be unknown, which is the honest answer rather than a bad one — the
  // figures are for a real workshop's records, and the check that matters is
  // the one above, that the clock reads the right moments.
  check(
    clock.length === Object.keys(STRETCHES).length,
    `all ${Object.keys(STRETCHES).length} stretches were looked for`,
    clock.length,
  );

  /* --- before and after ---------------------------------------------------- */

  const recorded = clock.map(recordOf);

  if (process.argv.includes('--record')) {
    writeBaseline({
      takenAt: new Date().toISOString(),
      workshop: org.name,
      windowDays: WINDOW_DAYS,
      stretches: recorded,
    });

    console.info(`\n  Written down as the baseline: ${BASELINE}`);
  }

  if (process.argv.includes('--against')) {
    const baseline = readBaseline();

    if (!baseline) {
      check(false, 'there is a baseline to compare against', 'run with --record first');
    } else {
      console.info(`\n  Against the baseline taken on ${baseline.takenAt.slice(0, 10)}\n`);

      for (const after of recorded) {
        const before = baseline.stretches.find((one) => one.name === after.name);
        if (!before) continue;

        console.info(`  ${changed(before, after).sentence}`);
      }
    }
  }

  finish(clock);
}

function finish(clock: Measured[]) {
  console.info('');

  const unknown = clock.filter((one) => verdictOf(one) === 'unknown').length;

  if (unknown > 0) {
    console.info(
      `  ${unknown} of ${clock.length} could not be measured on enough work to say anything.\n` +
        '  That is the honest answer for a seeded workshop, and the figure to watch in a pilot.',
    );
  }

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`\n  ${checked} checks. The clock reads the moments it says it reads.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
