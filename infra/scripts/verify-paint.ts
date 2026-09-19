/**
 * What the screen does while somebody waits. Phase 60. NFR-105, NFR-107.
 *
 *   npx tsx infra/scripts/verify-paint.ts [baseUrl]
 *
 * Phase 51 measured the server — how long the application took to produce the
 * bytes, at the size of a real workshop. That is half of what a person
 * experiences, and it was the half going wrong, so it was the right half to do
 * first. It says nothing about the other half: how long after those bytes
 * arrive the screen shows the thing somebody came for, and whether it holds
 * still once it does.
 *
 * Two numbers, both taken from the requirements: Largest Contentful Paint
 * under two seconds on a 4G connection, and Cumulative Layout Shift under 0.1.
 *
 * Measured in the browser rather than inferred from response times, over a
 * throttled connection and a slowed processor, because a page measured on a
 * fast machine over a fast network flatters itself and a workshop's customer
 * is standing in a car park.
 *
 * What this is not:
 *
 *   It is not a field measurement. This is one machine, emulating a
 *   connection, against a local production build. It catches a page that is
 *   slow or that jumps; it cannot tell you what a customer in Stockport
 *   experienced on a Tuesday.
 *
 *   It is not Interaction to Next Paint. NFR-106 asks for that across the
 *   application and it needs real fingers on real devices — the pilot. It
 *   stays written down as enforced by nothing rather than quietly folded in
 *   here, because a number from an emulator wearing a field metric's name is
 *   worse than no number at all.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import {
  describePaint,
  describePaintRun,
  FOUR_G,
  middle,
  PAINT,
  type Painted,
  paintVerdict,
  say,
  worstPaintFirst,
} from '@carnet/core';
import { prisma } from '@carnet/db';
import { type Browser, chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';

/** A telephone, because that is where both of these numbers are felt. */
const VIEWPORT = { width: 390, height: 844 };

/** Three, and the middle one counts. Enough to discard one bad run. */
const RUNS = 3;

let failures = 0;
let checked = 0;
const tokens: string[] = [];

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `\n        ${String(detail)}`}`);
  }
}

async function mint(email: string): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    include: { memberships: true },
  });
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  tokens.push(tokenHash);
  await prisma.session.create({
    data: {
      tokenHash,
      userId: user.id,
      orgId: user.memberships[0]?.orgId ?? null,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });
  return token;
}

/** How a page says it fell over, in each language it can say it in. */
const BROKEN = [
  'Something went wrong',
  'Application error',
  'Quelque chose a mal tourné',
  'حدث خطأ ما',
] as const;

interface Reading {
  lcp: number | null;
  cls: number | null;
}

/**
 * One load, measured in the page itself.
 *
 * The observers are installed before anything navigates, because both metrics
 * describe things that happen during the load and an observer added afterwards
 * has missed them. `buffered: true` would catch some of it; installing first
 * catches all of it and is one less thing to be wrong about.
 *
 * Layout shift is summed only where the reader did not cause it. A page that
 * moves because somebody pressed something is a page responding, and counting
 * that would make every menu a fault.
 */
async function once(
  browser: Browser,
  path: string,
  session: string | null,
): Promise<Reading | 'broken'> {
  const context = await browser.newContext({ viewport: VIEWPORT, isMobile: true, hasTouch: true });

  if (session) {
    await context.addCookies([{ name: 'carnet_session', value: session, url: BASE }]);
  }

  const page = await context.newPage();

  // Throttled at the protocol level rather than by a proxy: this is the same
  // mechanism the browser's own tooling uses, and it is applied before the
  // navigation so the very first byte is subject to it.
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: (FOUR_G.downloadKbps * 1_024) / 8,
    uploadThroughput: (FOUR_G.uploadKbps * 1_024) / 8,
    latency: FOUR_G.latencyMs,
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: FOUR_G.processorSlowdown });

  await page.addInitScript(() => {
    const window_ = window as unknown as { __paint: { lcp: number; cls: number } };
    window_.__paint = { lcp: 0, cls: 0 };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window_.__paint.lcp = entry.startTime;
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        // A page that moves because somebody pressed something is a page
        // responding. Only the shifts nobody asked for count.
        if (!entry.hadRecentInput) window_.__paint.cls += entry.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  try {
    const response = await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 90_000 });
    if ((response?.status() ?? 0) >= 400) return 'broken';

    // Long enough for the last paint and any late shift to land. A page that
    // is still moving a second and a half after load is a page this is meant
    // to catch rather than wait politely for.
    await page.waitForTimeout(1_500);

    const words = await page.evaluate(() => document.body.innerText.slice(0, 3_000));
    if (BROKEN.some((marker) => words.includes(marker))) return 'broken';

    const seen = await page.evaluate(
      () => (window as unknown as { __paint: { lcp: number; cls: number } }).__paint,
    );

    return { lcp: seen.lcp > 0 ? seen.lcp : null, cls: seen.cls };
  } finally {
    await page.close();
    await context.close();
  }
}

interface Screen {
  name: string;
  path: string;
  who: 'owner' | 'driver' | 'nobody';
}

/**
 * A page made to jump on purpose, to prove the measurement can see one.
 *
 * Every real screen reported a shift of exactly zero, and there are two ways
 * that happens: the product holds still, or nothing is watching. They are
 * indistinguishable in a report. This is the difference.
 *
 * Deliberately on a real page of the product rather than a fabricated one, so
 * what is proved is that the observer works where it is actually used.
 */
async function measuredAShift(): Promise<number | null> {
  const browser = await chromium.launch();

  try {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    await page.addInitScript(() => {
      const window_ = window as unknown as { __shift: number };
      window_.__shift = 0;

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        })[]) {
          if (!entry.hadRecentInput) window_.__shift += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    });

    await page.goto(`${BASE}/login`, { waitUntil: 'load' });
    await page.waitForTimeout(600);

    // Something arriving late and pushing everything below it down: the banner
    // that loads after the page, which is the shape of this fault wherever it
    // happens.
    await page.evaluate(() => {
      const late = document.createElement('div');
      late.style.height = '220px';
      late.style.background = '#eee';
      document.body.prepend(late);
    });

    await page.waitForTimeout(1_200);

    const seen = await page.evaluate(() => (window as unknown as { __shift: number }).__shift);

    await context.close();
    return seen;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.info(`\n  What the screen does while somebody waits\n  ${BASE}`);
  console.info(`  ${FOUR_G.name}: ${FOUR_G.downloadKbps} kbps down, ${FOUR_G.latencyMs} ms away,`);
  console.info(
    `  processor slowed ${FOUR_G.processorSlowdown}×. ${RUNS} runs, the middle one counts.\n`,
  );

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true },
  });

  const [job, invoice, access] = await Promise.all([
    prisma.job.findFirstOrThrow({ where: { orgId: org.id }, select: { id: true } }),
    prisma.invoice.findFirstOrThrow({ where: { orgId: org.id }, select: { id: true } }),
    prisma.vehicleAccessGrant.findFirstOrThrow({
      where: { orgId: org.id },
      select: { vehicleId: true },
    }),
  ]);

  const driver = await prisma.customer.findFirstOrThrow({
    where: { portalUserId: { not: null } },
    select: { portalUser: { select: { email: true } } },
  });

  const sessions: Record<Screen['who'], string | null> = {
    nobody: null,
    owner: await mint('ahmed@hillsidemotors.test'),
    driver: await mint(driver.portalUser!.email),
  };

  // A shared passport, made for this run and taken away after: the page a
  // customer is most likely to open on a telephone that is not on the
  // workshop's wifi.
  const shareToken = randomBytes(24).toString('base64url');
  await prisma.passportShare.create({
    data: {
      vehicleId: access.vehicleId,
      tokenHash: createHash('sha256').update(shareToken).digest('hex'),
      label: 'paint-probe',
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  // Not all hundred and twenty-eight. Three runs each over a throttled
  // connection is minutes per screen, and what these two numbers are about is
  // the screens somebody waits on: the first thing a workshop opens in the
  // morning, the ones they live in, and the links a customer is sent.
  const screens: Screen[] = [
    { name: 'The front page', path: '/', who: 'nobody' },
    { name: 'Signing in', path: '/login', who: 'nobody' },
    { name: 'A shared passport', path: `/p/${shareToken}`, who: 'nobody' },
    { name: 'The dashboard', path: '/dashboard', who: 'owner' },
    { name: 'The diary', path: '/diary', who: 'owner' },
    { name: 'Jobs', path: '/jobs', who: 'owner' },
    { name: 'A job', path: `/jobs/${job.id}`, who: 'owner' },
    { name: 'Invoices', path: '/invoices', who: 'owner' },
    { name: 'An invoice', path: `/invoices/${invoice.id}`, who: 'owner' },
    { name: 'The counter', path: '/counter', who: 'owner' },
    { name: 'The customer’s own side', path: '/portal', who: 'driver' },
  ];

  const browser = await chromium.launch();
  const painted: Painted[] = [];

  try {
    for (const screen of screens) {
      const lcp: number[] = [];
      const cls: number[] = [];
      let broken = false;

      for (let run = 0; run < RUNS; run += 1) {
        const reading = await once(browser, screen.path, sessions[screen.who]);

        if (reading === 'broken') {
          broken = true;
          break;
        }

        if (reading.lcp !== null) lcp.push(reading.lcp);
        if (reading.cls !== null) cls.push(reading.cls);
      }

      if (broken) {
        // A page that fell over is not a slow page, and reporting it as one
        // sends somebody optimising a screen that is not running. The Phase
        // 51 lesson, and the Phase 55 one.
        check(false, `${screen.name} rendered at all`, `${screen.path} answered with an error`);
        continue;
      }

      painted.push({ screen: screen.name, path: screen.path, metric: 'lcp', samples: lcp });
      painted.push({ screen: screen.name, path: screen.path, metric: 'cls', samples: cls });

      const line = `${screen.name.padEnd(26)} LCP ${say('lcp', middle(lcp)).padStart(8)}   CLS ${say('cls', middle(cls)).padStart(6)}`;
      console.info(`  ${line}`);
    }
  } finally {
    await browser.close();
  }

  // The control, and the reason for it: every screen reported a layout shift
  // of exactly zero, which is either a product that holds perfectly still or
  // an observer that never fired. Those two look identical in a report, and a
  // probe has now gone green against something that could not have gone red in
  // four separate phases. So the measurement is asked to prove it can.
  const shifted = await measuredAShift();

  check(
    shifted !== null && shifted > 0.01,
    'the layout-shift measurement can see a shift, so the zeroes above mean something',
    shifted === null ? 'nothing came back' : `a deliberate shift read ${say('cls', shifted)}`,
  );

  console.info(`\n  ${describePaintRun(painted)}\n`);

  for (const one of worstPaintFirst(painted)) {
    const verdict = paintVerdict(one);
    if (verdict === 'within' || verdict === 'nothing to say') continue;

    console.info(`  ${verdict === 'over' ? 'OVER' : 'NEAR'}  ${describePaint(one)}`);
    console.info(`        ${PAINT[one.metric].because}`);
  }

  const over = painted.filter((one) => paintVerdict(one) === 'over');

  check(
    over.length === 0,
    `every screen paints and holds still within its budget`,
    over.map((one) => `${one.screen} (${one.metric.toUpperCase()})`).join(', '),
  );

  check(
    painted.every((one) => one.metric !== 'lcp' || one.samples.length > 0),
    'and every screen reported a paint, so nothing passed by not being measured',
    painted
      .filter((one) => one.metric === 'lcp' && one.samples.length === 0)
      .map((one) => one.screen)
      .join(', '),
  );

  // Said out loud. A number from an emulator is not a number from a workshop,
  // and the difference is the whole of NFR-106.
  console.info(
    '\n  What this does not say:\n' +
      '    One machine, emulating a connection, against a local build. It catches\n' +
      '    a screen that is slow or that jumps. It cannot say what a customer in\n' +
      '    a car park experienced on a Tuesday, and it is not Interaction to Next\n' +
      '    Paint — NFR-106 needs real fingers, which means the pilot.\n',
  );

  await prisma.passportShare.deleteMany({ where: { label: 'paint-probe' } });
  await prisma.session.deleteMany({ where: { tokenHash: { in: tokens } } });

  if (failures > 0) {
    console.info(`  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`  ${checked} checks. The screens paint, and hold still.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
