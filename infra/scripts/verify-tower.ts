/**
 * The control tower. Phase 98.
 *
 *   npx tsx infra/scripts/verify-tower.ts
 *
 * The rules are unit tested. What cannot be is whether the figures the rules
 * are given are the right figures: that a car on the ramps with a part on
 * order is found, matched to the order it is on, and called late when that
 * order is; that a finished car nobody has collected is counted as ready and
 * as unbilled; that a message nobody answered is counted and aged; that a
 * booking whose time has passed with no car is "not arrived"; and that none of
 * it leaks from one workshop to another. Every one of those is a fact about a
 * database rather than about a function.
 *
 * **The building is the board.** The tower's in-building figures are read off
 * `whereJobsStand`, which is what `/now` and every job's own band read. That
 * is asserted rather than assumed: a tower that counted the building its own
 * way would be a second opinion, and would be wrong the first time the two
 * drifted.
 *
 * **It records nothing.** Rows are counted before and after reading the
 * tower, and a screen left open all day that wrote anything would write it
 * all day.
 *
 * **Every sentence it can say is answered in French and Arabic** -- read out
 * of core's own source, because `i18n-scan` reads pages and this library says
 * its sentences from inside functions (ADR-0019).
 *
 * The fixtures are written raw and removed afterwards, tagged so that a run
 * that dies halfway leaves something a person can find and delete.
 */

import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isInShop, needsSomebody, regionForCountry, startOfDayIn, businessDay } from '@carnet/core';
import { prisma } from '@carnet/db';

import { theTower } from '../../apps/web/src/lib/control-tower';
import { whereJobsStand } from '../../apps/web/src/lib/standing';
import { AR } from '../../packages/core/src/i18n/ar';
import { AREAS } from '../../packages/core/src/i18n/areas/index';
import { FR } from '../../packages/core/src/i18n/fr';

const ROOT = join(import.meta.dirname, '..', '..');
const RULES = join(ROOT, 'packages', 'core', 'src', 'owner', 'control-tower.ts');
const PAGE = join(ROOT, 'apps', 'web', 'src', 'app', '(workshop)', 'dashboard', 'page.tsx');

const TAG = 'VERIFY-TOWER';
const HOUR = 3_600_000;

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

const FRENCH: Record<string, string> = Object.assign({}, FR, ...AREAS.map((area) => area.fr));
const ARABIC: Record<string, string> = Object.assign({}, AR, ...AREAS.map((area) => area.ar));

function keysTheRulesCanSay(): string[] {
  const source = readFileSync(RULES, 'utf8');
  const found = new Set<string>();
  for (const match of source.matchAll(/\bkey: '((?:[^'\\]|\\.)*)'/g)) {
    found.add((match[1] ?? '').replace(/\\'/g, "'"));
  }
  return [...found].sort();
}

/* ---------------------------------------------------------------------------
   Fixtures
   --------------------------------------------------------------------------- */

interface Fixtures {
  jobIds: string[];
  onTheRamps: string;
  finished: string;
  pastThePromise: string;
  bookingId: string | null;
  orderId: string;
  supplierName: string;
}

async function build(orgId: string, locationId: string, now: Date, from: Date, to: Date) {
  const [customer, vehicle, supplier, ordered, unordered] = await Promise.all([
    prisma.customer.findFirstOrThrow({ where: { orgId }, select: { id: true } }),
    prisma.vehicleAccessGrant.findFirstOrThrow({ where: { orgId }, select: { vehicleId: true } }),
    prisma.supplier.findFirstOrThrow({ where: { orgId }, select: { id: true, name: true } }),
    prisma.product.findFirstOrThrow({
      where: { orgId, isActive: true },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    }),
    // A product no open order carries, so "marked on order, and no open order
    // has it" is about this product and not about whatever the seed ordered.
    prisma.product.findFirstOrThrow({
      where: {
        orgId,
        isActive: true,
        poLines: { none: { order: { status: { in: ['SENT', 'PART_RECEIVED'] } } } },
      },
      select: { id: true, name: true },
    }),
  ]);

  const number = async () => {
    const sequence = await prisma.documentSequence.upsert({
      where: { orgId_kind: { orgId, kind: 'JOB' } },
      create: { orgId, kind: 'JOB', next: 950_002 },
      update: { next: { increment: 1 } },
    });
    return sequence.next - 1;
  };

  // Promised back later today -- or, late in the evening, as late today as
  // the day allows. Either way before the end of the business day.
  const promisedAt = new Date(Math.min(now.getTime() + 2 * HOUR, to.getTime() - 60_000));

  // One car on the ramps, waiting on two parts: one on an order the supplier
  // is late with, one marked on order that no open order carries.
  const onTheRamps = await prisma.job.create({
    data: {
      orgId,
      locationId,
      number: await number(),
      customerId: customer.id,
      vehicleId: vehicle.vehicleId,
      shortDescription: `${TAG} on the ramps`,
      status: 'IN_PROGRESS',
      promisedAt,
      receivedAt: new Date(now.getTime() - 3 * HOUR),
      partLines: {
        create: [
          { productId: ordered.id, description: `${TAG} ${ordered.name}`, status: 'ON_ORDER' },
          {
            productId: unordered.id,
            description: `${TAG} ${unordered.name}`,
            status: 'ON_ORDER',
          },
        ],
      },
    },
    select: { id: true },
  });

  if (ordered.id === unordered.id) throw new Error('the seed needs two distinct products');

  const order = await prisma.purchaseOrder.create({
    data: {
      orgId,
      supplierId: supplier.id,
      number: `${TAG}-PO`,
      status: 'SENT',
      expectedAt: new Date(now.getTime() - 24 * HOUR),
      lines: {
        create: [{ productId: ordered.id, description: ordered.name, quantity: 2, unitCost: 10 }],
      },
    },
    select: { id: true },
  });

  // One car finished, not collected, and nobody has raised the bill.
  const finished = await prisma.job.create({
    data: {
      orgId,
      locationId,
      number: await number(),
      customerId: customer.id,
      vehicleId: vehicle.vehicleId,
      shortDescription: `${TAG} finished`,
      status: 'COMPLETED',
      completedAt: new Date(now.getTime() - HOUR),
      collectedAt: null,
    },
    select: { id: true },
  });

  // One car past the time it was promised back.
  const pastThePromise = await prisma.job.create({
    data: {
      orgId,
      locationId,
      number: await number(),
      customerId: customer.id,
      vehicleId: vehicle.vehicleId,
      shortDescription: `${TAG} past the promise`,
      status: 'RECEIVED',
      promisedAt: new Date(now.getTime() - 26 * HOUR),
      receivedAt: new Date(now.getTime() - 30 * HOUR),
    },
    select: { id: true },
  });

  // A message that came in three hours ago and nobody has answered.
  await prisma.inboundMessage.create({
    data: {
      orgId,
      customerId: customer.id,
      fromAddress: `${TAG}@example.test`,
      subject: TAG,
      body: TAG,
      channel: 'EMAIL',
      receivedAt: new Date(now.getTime() - 3 * HOUR),
    },
  });

  // A booking for two hours ago that nobody has received. Only when two hours
  // ago is still today: in the first half-hour after midnight there is no such
  // moment, and the check below says so rather than inventing one.
  const startAt = new Date(now.getTime() - 2 * HOUR);
  const booking =
    startAt > from
      ? await prisma.booking.create({
          data: {
            orgId,
            locationId,
            customerId: customer.id,
            vehicleId: vehicle.vehicleId,
            status: 'SCHEDULED',
            startAt,
            endAt: new Date(startAt.getTime() + HOUR),
            estimatedHours: 1,
            description: TAG,
            notes: TAG,
          },
          select: { id: true },
        })
      : null;

  return {
    jobIds: [onTheRamps.id, finished.id, pastThePromise.id],
    onTheRamps: onTheRamps.id,
    finished: finished.id,
    pastThePromise: pastThePromise.id,
    bookingId: booking?.id ?? null,
    orderId: order.id,
    supplierName: supplier.name,
  } satisfies Fixtures;
}

async function tearDown(orgId: string) {
  await prisma.booking.deleteMany({ where: { orgId, description: TAG } });
  await prisma.inboundMessage.deleteMany({ where: { orgId, body: TAG } });
  await prisma.purchaseOrder.deleteMany({ where: { orgId, number: `${TAG}-PO` } });
  await prisma.job.deleteMany({ where: { orgId, shortDescription: { startsWith: TAG } } });
}

/* ---------------------------------------------------------------------------
   The checks
   --------------------------------------------------------------------------- */

async function rowCounts(orgId: string) {
  const [jobs, bookings, audit, told, closes, messages] = await Promise.all([
    prisma.job.count({ where: { orgId } }),
    prisma.booking.count({ where: { orgId } }),
    prisma.auditLog.count({ where: { orgId } }),
    prisma.staffNotification.count({ where: { orgId } }),
    prisma.dayClose.count({ where: { orgId } }),
    prisma.inboundMessage.count({ where: { orgId } }),
  ]);
  return { jobs, bookings, audit, told, closes, messages };
}

async function main() {
  console.info('\n  The control tower\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.membership.findFirstOrThrow({
    where: { orgId: org.id, role: 'OWNER' },
    select: { locationId: true },
  });
  const region = regionForCountry(org.country);

  if (!owner.locationId) {
    failures += 1;
    console.error('  FAIL   the seeded owner is at no site, so nothing below means anything');
    console.info(`\n  ${failures} failed.`);
    process.exitCode = 1;
    return;
  }
  const locationId = owner.locationId;

  const now = new Date();
  const from = startOfDayIn(businessDay(now, region.timezone, 0), region.timezone);
  const to = new Date(from.getTime() + 24 * HOUR);

  await tearDown(org.id);
  const fixtures = await build(org.id, locationId, now, from, to);

  try {
    /* --- the building is the board ------------------------------------------ */

    console.info('  The building is the board');

    const before = await rowCounts(org.id);
    const tower = await theTower(org.id, locationId, region.timezone, now);
    const after = await rowCounts(org.id);

    const board = (await whereJobsStand(org.id, { now })).filter((job) => isInShop(job.status));
    check(
      'the tower counts the building the way the board does',
      tower.building.inShop,
      board.length,
    );
    check(
      'and the building is every in-shop job of this workshop, no more',
      tower.building.inShop,
      await prisma.job.count({
        where: {
          orgId: org.id,
          status: {
            in: [
              'RECEIVED',
              'INSPECTING',
              'DIAGNOSED',
              'ESTIMATED',
              'AWAITING_APPROVAL',
              'APPROVED',
              'IN_PROGRESS',
              'QUALITY_CHECK',
            ],
          },
        },
      }),
    );
    check(
      'and the four moves add up to it',
      tower.building.ours +
        tower.building.customer +
        tower.building.supplier +
        tower.building.nobody,
      tower.building.inShop,
    );
    check(
      'and every car listed as blocked is one somebody is waiting on',
      tower.building.blocked.every((job) => needsSomebody(job.standing)),
      true,
    );
    check(
      'and what is listed plus what is not is every blocked car',
      tower.building.blocked.length + tower.building.more,
      board.filter((job) => needsSomebody(job.standing)).length,
    );
    check(
      'and the car past its promise is counted late',
      tower.building.late >= 1 &&
        board.some((job) => job.id === fixtures.pastThePromise && job.standing.late),
      true,
    );
    check(
      'and the finished car is not in the building',
      board.some((job) => job.id === fixtures.finished),
      false,
    );

    /* --- parts in the way ---------------------------------------------------- */

    console.info('\n  Parts holding up cars in the building');

    const mine = tower.parts.filter((part) => part.jobId === fixtures.onTheRamps);
    check('both parts on order for the car on the ramps are found', mine.length, 2);
    const late = mine.find((part) => part.standing === 'LATE');
    const unordered = mine.find((part) => part.standing === 'NOT_ORDERED');
    check('the one on an order the supplier is late with is called late', Boolean(late), true);
    check('and is matched to that order', late?.orderId ?? null, fixtures.orderId);
    check('and names the supplier', late?.supplier ?? null, fixtures.supplierName);
    check('the one marked on order that no open order carries says so', Boolean(unordered), true);
    check(
      'and late comes before it, which comes before anything merely due',
      tower.parts.findIndex((part) => part === late) <
        tower.parts.findIndex((part) => part === unordered) &&
        tower.parts.every(
          (part, index) =>
            index === 0 || order(tower.parts[index - 1]!.standing) <= order(part.standing),
        ),
      true,
    );

    /* --- who is waiting on us ------------------------------------------------ */

    console.info('\n  Who is waiting on us');

    check('the unanswered message is counted', tower.customers.unanswered >= 1, true);
    check(
      'and its age is at least the three hours it has waited',
      (tower.customers.unansweredLongestMinutes ?? 0) >= 180,
      true,
    );
    check('the finished car is ready to collect', tower.customers.readyToCollect >= 1, true);
    check('and counted as not paid for', tower.customers.readyAndUnpaid >= 1, true);
    check(
      'the number deciding on an estimate is the number awaiting approval',
      tower.customers.deciding,
      await prisma.job.count({ where: { orgId: org.id, status: 'AWAITING_APPROVAL' } }),
    );

    /* --- today --------------------------------------------------------------- */

    console.info('\n  What today can hold');

    if (fixtures.bookingId) {
      check(
        'the booking whose time has passed with no car is "not arrived"',
        tower.day.notArrived.some((one) => one.id === fixtures.bookingId),
        true,
      );
      check('and is counted among today’s bookings', tower.day.booked >= 1, true);
    } else {
      // Only in the half hour after midnight. Said, so the skip is visible.
      failures += 1;
      console.error('  FAIL   too soon after midnight to book a car for two hours ago; rerun');
    }
    check('the building has hours in it', tower.day.effectiveMinutes > 0, true);
    check('and work is promised against them', tower.day.bookedMinutes > 0, true);
    check(
      'and nobody is "not yet in" who was not expected',
      tower.day.notIn.length <= tower.day.expected,
      true,
    );

    /* --- the money ----------------------------------------------------------- */

    console.info('\n  The money');

    check(
      'the finished car with no bill is counted as to invoice',
      tower.money.toInvoiceCount >= 1,
      true,
    );
    const takenToday = await prisma.payment.aggregate({
      where: { orgId: org.id, receivedAt: { gte: from, lt: to } },
      _sum: { amount: true },
    });
    check(
      'and taken today is summed over the workshop’s own day, not the server’s',
      tower.money.takenToday,
      Number(takenToday._sum.amount ?? 0),
    );

    /* --- the risk ------------------------------------------------------------ */

    console.info('\n  Before the doors shut');

    const kinds = tower.risk.map((one) => one.kind);
    check('a car past its promise is a risk', kinds.includes('late'), true);
    check('a part late for a car on the ramps is a risk', kinds.includes('parts-late'), true);
    check('a car promised back today is a risk', kinds.includes('promised-today'), true);
    check('a message three hours unanswered is a risk', kinds.includes('unanswered'), true);
    check('a finished car still here and unpaid is a risk', kinds.includes('ready-unpaid'), true);
    check(
      'and what is already costing comes before what merely will',
      tower.risk.every(
        (one, index) =>
          index === 0 || tower.risk[index - 1]!.tone !== 'warning' || one.tone === 'warning',
      ),
      true,
    );
    check(
      'the headline says something is costing',
      tower.headline.key.includes('costing you'),
      true,
    );

    /* --- it records nothing -------------------------------------------------- */

    console.info('\n  It records nothing');

    check('reading the tower wrote no row anywhere it could have', after, before);

    /* --- not another workshop’s ---------------------------------------------- */

    console.info('\n  Not another workshop’s');

    const other = await prisma.organization.findFirst({
      where: { slug: { not: org.slug } },
      select: { id: true, country: true },
    });
    if (other) {
      const theirs = await theTower(other.id, null, regionForCountry(other.country).timezone, now);
      check(
        'another workshop’s tower has none of this one’s parts in the way',
        theirs.parts.some((part) => fixtures.jobIds.includes(part.jobId)),
        false,
      );
      check(
        'nor any of its cars on the board',
        theirs.building.blocked.some((job) => fixtures.jobIds.includes(job.id)),
        false,
      );
    } else {
      failures += 1;
      console.error('  FAIL   the seed has one workshop, so tenancy is untested');
    }

    /* --- every sentence answered --------------------------------------------- */

    console.info('\n  Every sentence it can say');

    const keys = keysTheRulesCanSay();
    check('the rules can say something', keys.length > 0, true);
    check(
      'and every sentence has a French answer',
      keys.filter((key) => !FRENCH[key]),
      [],
    );
    check(
      'and an Arabic one',
      keys.filter((key) => !ARABIC[key]),
      [],
    );

    const page = readFileSync(PAGE, 'utf8');
    check(
      'and the page says the headline and every risk through the translator',
      page.includes('t(tower.headline.key, tower.headline.vars)') &&
        page.includes('t(one.what.key, one.what.vars)'),
      true,
    );
    check('and the page reads itself again while it is open', page.includes('<KeepsCurrent'), true);
  } finally {
    await tearDown(org.id);
  }

  if (failures > 0) {
    console.info(`\n  ${failures} failed.`);
    process.exitCode = 1;
  } else {
    console.info('\n  All checks passed. The tower reads the building the board reads.');
  }
}

function order(standing: 'LATE' | 'NOT_ORDERED' | 'TODAY' | 'LATER'): number {
  return { LATE: 0, NOT_ORDERED: 1, TODAY: 2, LATER: 3 }[standing];
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
