/**
 * A budget per screen, measured. Phase 51.
 *
 *   npx tsx infra/scripts/verify-performance.ts [baseUrl]
 *
 * Against a production build, and against a database with a real amount in it:
 * `npm run build && npm start`, then `npm run db:scale`. Numbers taken from
 * `next dev` are not the budget and the script says so rather than quietly
 * reporting them — development recompiles on demand and the first hit on a
 * page can be two seconds of that, which would fail every screen here for a
 * reason no customer will ever experience.
 *
 * p95 rather than a mean, because a mean hides the shape: fifty fast requests
 * and five terrible ones average out to something acceptable, and the five are
 * the ones somebody is sitting in front of.
 *
 * Every budget names where it comes from. Four are the non-functional
 * requirements; the rest are judgements made here and said to be judgements,
 * because a number nobody can trace is a number the next person will argue
 * with instead of fixing the screen.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import {
  type Budget,
  describeRun,
  describeTiming,
  medianOf,
  nearTheLine,
  type Overrun,
  overBudget,
  p95Of,
  type Timing,
  worstOf,
  worstOverrunsFirst,
} from '@carnet/core';
import { prisma } from '@carnet/db';

const BASE = process.argv[2] ?? 'http://localhost:3000';

/** Enough to have a 95th percentile that means something, few enough to finish. */
const SAMPLES = 20;

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

async function mint(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: { memberships: true },
  });

  const token = randomBytes(32).toString('base64url');

  await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: user.id,
      orgId: user.memberships[0]?.orgId ?? null,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  return token;
}

/**
 * How a page says it fell over, in each of the three languages it can say it
 * in. A page under a loading boundary has already committed to 200 by the time
 * it throws, so the status is no help.
 */
const BROKEN = [
  'Something went wrong',
  'Application error',
  'Quelque chose a mal tourné',
  'حدث خطأ ما',
] as const;

/** One request, timed to the last byte of the body rather than to the headers. */
async function once(path: string, token: string): Promise<number | null> {
  const started = performance.now();

  const response = await fetch(`${BASE}${path}`, {
    redirect: 'manual',
    headers: { cookie: `carnet_session=${token}` },
  });

  // To the last byte, deliberately. A streamed page can send its shell in
  // twenty milliseconds and take two seconds to finish, and the person is
  // waiting for the figures rather than for the header.
  const body = await response.text();
  const took = Math.round(performance.now() - started);

  if (response.status !== 200) return null;

  // A page that threw is not a slow page, and reporting it as one sends
  // somebody optimising a screen that is not running. This happened during
  // Phase 51 itself: a broken query made the statements page take eleven
  // seconds to render an error, and the first reading of that was "the
  // statements page is slow".
  if (BROKEN.some((marker) => body.includes(marker))) return null;

  return took;
}

async function measure(budget: Budget, token: string): Promise<Timing | null> {
  // Twice, discarded. The first hit on a page warms a connection pool, a
  // prepared statement and — in development — a compiler, and none of that is
  // what a workshop experiences on the fiftieth invoice of the morning.
  for (let i = 0; i < 2; i += 1) {
    const warm = await once(budget.path, token);
    if (warm === null) return null;
  }

  const samples: number[] = [];

  for (let i = 0; i < SAMPLES; i += 1) {
    const took = await once(budget.path, token);
    if (took === null) return null;
    samples.push(took);
  }

  return {
    screen: budget.screen,
    path: budget.path,
    samples,
    budget: budget.p95,
    because: budget.because,
  };
}

/* ---------------------------------------------------------------------------
   What the rows say
   --------------------------------------------------------------------------- */

async function howMuchIsInThere() {
  const [customers, vehicles, jobs, invoices, audits] = await Promise.all([
    prisma.customer.count(),
    prisma.vehicle.count(),
    prisma.job.count(),
    prisma.invoice.count(),
    prisma.auditLog.count(),
  ]);

  return { customers, vehicles, jobs, invoices, audits };
}

/* ---------------------------------------------------------------------------
   The budgets
   --------------------------------------------------------------------------- */

async function budgetsFor(orgId: string): Promise<Budget[]> {
  // Real rows from the loaded database rather than the seed's, so the single
  // record pages are measured on a row surrounded by half a million others
  // rather than on one of six.
  const [customer, job, invoice, vehicle, passport] = await Promise.all([
    prisma.customer.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.job.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.invoice.findFirst({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    }),
    prisma.vehicleAccessGrant.findFirst({ where: { orgId }, select: { vehicleId: true } }),
    // The passport budget is written for five hundred events, so the vehicle
    // with the most of them is the one to measure.
    prisma.vehicle.findFirst({
      orderBy: { eventCount: 'desc' },
      select: { id: true, eventCount: true },
    }),
  ]);

  const single = 'NFR-101: a read of a single record, p95 under 200 ms.';
  const list = 'NFR-102: a list view of up to 50 rows, p95 under 400 ms.';
  const diary = 'NFR-103: the diary week with 200 bookings, p95 under 600 ms.';
  const chain = 'NFR-104: a passport with 500 events, p95 under 800 ms.';
  const judged = 'A judgement made in Phase 51, not a requirement.';

  const budgets: (Budget | null)[] = [
    // One record
    customer
      ? { screen: 'A customer', path: `/customers/${customer.id}`, p95: 200, because: single }
      : null,
    job ? { screen: 'A job', path: `/jobs/${job.id}`, p95: 200, because: single } : null,
    invoice
      ? { screen: 'An invoice', path: `/invoices/${invoice.id}`, p95: 200, because: single }
      : null,
    vehicle
      ? { screen: 'A vehicle', path: `/vehicles/${vehicle.vehicleId}`, p95: 200, because: single }
      : null,

    // Lists
    { screen: 'Customers', path: '/customers', p95: 400, because: list },
    { screen: 'Jobs', path: '/jobs', p95: 400, because: list },
    { screen: 'Invoices', path: '/invoices', p95: 400, because: list },
    { screen: 'Vehicles', path: '/vehicles', p95: 400, because: list },
    { screen: 'Parts', path: '/parts', p95: 400, because: list },
    { screen: 'Payments', path: '/payments', p95: 400, because: list },
    { screen: 'Passports', path: '/passports', p95: 400, because: list },

    // The two with their own figures
    { screen: 'The diary', path: '/diary', p95: 600, because: diary },
    passport
      ? {
          screen: `A passport (${passport.eventCount} events)`,
          path: `/vehicles/${passport.id}/passport`,
          p95: 800,
          because: chain,
        }
      : null,

    // The two ends of the day. `/opening` counts seven things over a one-night
    // window, three of them on columns with no index of their own, so it is
    // measured rather than assumed -- an index bought on a guess is paid for
    // by every write for the life of the product.
    {
      screen: 'Opening up',
      path: '/opening',
      p95: 800,
      because: `${judged} It compares ten readings with last night's close and counts seven kinds of arrival.`,
    },
    {
      screen: 'Closing the day',
      path: '/close',
      p95: 800,
      because: `${judged} Ten readings at once, each a different table.`,
    },

    // Judged here, and said to be
    {
      screen: 'The dashboard',
      path: '/dashboard',
      p95: 800,
      because: `${judged} The first screen of the morning, and it counts several things at once.`,
    },
    {
      screen: 'Search',
      path: '/search?q=Barnes&all=1',
      p95: 600,
      because: `${judged} Somebody is typing and waiting, so it is held tighter than a report.`,
    },
    {
      screen: 'The audit log',
      path: '/audit',
      p95: 600,
      because: `${judged} The largest table in the product, and the one most likely to be read unbounded.`,
    },
    {
      screen: "The week's figures",
      path: '/reports/business?range=quarter',
      p95: 1_500,
      because: `${judged} A report is not a list: an owner will wait for it, but not for ever.`,
    },
    {
      screen: 'Statements',
      path: '/financials',
      p95: 1_500,
      because: `${judged} Reads the whole ledger, and is opened once a month rather than hourly.`,
    },
    {
      screen: 'Relationships',
      path: '/crm',
      p95: 5_000,
      because: `${judged} The one screen that genuinely reads every customer the workshop has ever had: a cohort table is a row per month somebody first arrived, and there is no smaller question to ask. Opened rarely, and held to a figure that says so rather than to one it cannot meet.`,
    },
    {
      screen: 'Tax',
      path: '/reports/tax?range=quarter',
      p95: 1_500,
      because: `${judged} A report, and the one an accountant waits for rather than reads at a glance.`,
    },
    {
      screen: 'Insights',
      path: '/insights',
      p95: 1_500,
      because: `${judged} A report.`,
    },
    {
      screen: 'The inbox',
      path: '/inbox',
      p95: 600,
      because: `${judged} A list somebody works through, so it is held like a list rather than like a report.`,
    },
    {
      screen: 'The counter',
      path: '/counter',
      p95: 400,
      because: `${judged} Somebody is standing there. ${list}`,
    },
  ];

  return budgets.filter((one): one is Budget => one !== null);
}

/* ---------------------------------------------------------------------------
   The run
   --------------------------------------------------------------------------- */

async function main() {
  console.info('\n  A budget per screen, measured\n');

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true },
  });

  const rows = await howMuchIsInThere();

  console.info(
    `  Against ${rows.customers.toLocaleString('en-GB')} customers, ` +
      `${rows.vehicles.toLocaleString('en-GB')} vehicles, ` +
      `${rows.jobs.toLocaleString('en-GB')} jobs, ` +
      `${rows.invoices.toLocaleString('en-GB')} invoices and ` +
      `${rows.audits.toLocaleString('en-GB')} audit rows.`,
  );

  // Said before the figures rather than after them, because a reader who has
  // already seen the numbers has already believed them.
  if (rows.jobs < 10_000) {
    console.info(
      '\n  NOTE  This is a seeded workshop, not a loaded one. The figures below say the\n' +
        '        harness works; they do not say the product is quick. Run npm run db:scale\n' +
        '        for numbers worth quoting.',
    );
  }

  const token = await mint('ahmed@hillsidemotors.test');
  const budgets = await budgetsFor(org.id);

  console.info('');

  const timings: Timing[] = [];
  const unreachable: string[] = [];

  for (const budget of budgets) {
    const timing = await measure(budget, token);

    if (!timing) {
      unreachable.push(`${budget.screen} (${budget.path})`);
      continue;
    }

    timings.push(timing);

    const p95 = p95Of(timing.samples);
    const over = p95 > timing.budget;

    console.info(
      `  ${over ? 'OVER' : '    '}  ${budget.screen.padEnd(26)}` +
        `${String(medianOf(timing.samples)).padStart(6)} ms typical  ` +
        `${String(p95).padStart(6)} ms p95  ` +
        `${String(worstOf(timing.samples)).padStart(6)} ms worst  ` +
        `of ${budget.p95} allowed`,
    );
  }

  /* --- what it came to ----------------------------------------------------- */

  console.info('');

  check(
    unreachable.length === 0,
    'every screen answered',
    unreachable.length > 0 ? unreachable.join(', ') : undefined,
  );

  check(timings.length >= 15, `${timings.length} screens measured`, timings.length);

  const over = timings.map(overBudget).filter((one): one is Overrun => one !== null);

  check(
    over.length === 0,
    describeRun(timings),
    over.length > 0 ? `${over.length} over` : undefined,
  );

  if (over.length > 0) {
    console.info('\n  Over budget, worst against its own budget first\n');

    for (const one of worstOverrunsFirst(over)) {
      console.info(`  ${one.times}x  ${one.sentence}`);
    }
  }

  // Not a failure, and worth a line. A screen at ninety per cent of its budget
  // is the screen that fails on the first workshop with twice the data, and
  // naming it now is cheaper than finding it then.
  const close = nearTheLine(timings);

  if (close.length > 0) {
    console.info('\n  Close to the line, which is where the next problem comes from\n');

    for (const one of close) {
      console.info(`  ${describeTiming(one)}`);
    }
  }

  await prisma.session.deleteMany({
    where: { expiresAt: { lte: new Date(Date.now() + 3_600_001) }, orgId: org.id },
  });

  console.info('');

  if (failures > 0) {
    console.info(`  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`  ${checked} checks. Every screen is inside its budget.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
