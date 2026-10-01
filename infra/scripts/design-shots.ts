/**
 * Photographs every design in the product, for the design book.
 *
 *   npx tsx infra/scripts/design-shots.ts [baseUrl]
 *
 * Needs the app running (next start) against the seeded database, and the
 * Playwright Chromium (npx playwright install chromium). Signs in as the
 * seeded owner for the workshop pages and as the seeded driver for the
 * portal, by minting sessions the way mint-session.ts does, and writes one
 * PNG per design to docs/assets/design/. The book is built from those by
 * build_design_book.py, so re-running this after a screen changes is how
 * the book stays true.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { prisma } from '@carnet/db';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = join(process.cwd(), 'docs', 'assets', 'design');

type Shot = {
  file: string;
  path: string;
  who: 'owner' | 'driver' | 'operator' | 'nobody';
  width?: number;
  height?: number;
  fullPage?: boolean;
  dark?: boolean;
  /** The language cookie for the shot. Phase 37.5. */
  lang?: 'en' | 'fr' | 'ar';
  settle?: number;
};

/**
 * A session for the operator, whose account may not exist on this machine.
 *
 * Unlike every other shot, this one is of a page that belongs to whoever runs
 * Carnet rather than to anybody in the seeded workshop, so there may be no
 * such user to sign in as. One is made if needed and left behind: it has a
 * random password nobody knows, and deleting it would take a real operator's
 * account with it on a machine where one exists.
 */
async function mintOperator(email: string): Promise<string> {
  const user =
    (await prisma.user.findUnique({ where: { email }, select: { id: true } })) ??
    (await prisma.user.create({
      data: {
        email,
        name: 'Carnet',
        passwordHash: randomBytes(32).toString('hex'),
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    }));

  const token = randomBytes(32).toString('base64url');

  await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: user.id,
      orgId: null,
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });

  return token;
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
      expiresAt: new Date(Date.now() + 3600_000),
    },
  });
  return token;
}

async function ids() {
  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, status: 'IN_PROGRESS' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const inspection = await prisma.inspection.findFirstOrThrow({
    where: { job: { orgId: org.id } },
    orderBy: { startedAt: 'desc' },
    select: { id: true },
  });
  // The story is only worth photographing on a job that has one: the most
  // status moves in the seed, rather than the newest car on the ramps.
  const storied = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id },
    orderBy: { statusEvents: { _count: 'desc' } },
    select: { id: true },
  });
  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { orgId: org.id, status: { in: ['ISSUED', 'PART_PAID'] } },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, jobs: { some: {} } },
    orderBy: { jobs: { _count: 'desc' } },
    select: { id: true },
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({
    where: { events: { some: { recordedByOrgId: org.id } } },
    orderBy: { events: { _count: 'desc' } },
    select: { id: true },
  });
  // The customer has to be one of this workshop's, and one who actually holds
  // a car: "the first customer anywhere with a portal login" picked up a probe
  // leftover the moment the database held more than the seed, and failed on
  // the ownership lookup rather than on the thing that was wrong.
  const driver = await prisma.customer.findFirstOrThrow({
    where: {
      orgId: org.id,
      portalUserId: { not: null },
      portalUser: { is: { ownedVehicles: { some: { endedAt: null } } } },
    },
    select: { portalUserId: true, portalUser: { select: { email: true } } },
  });
  const owned = await prisma.vehicleOwnership.findFirstOrThrow({
    where: { ownerUserId: driver.portalUserId!, endedAt: null },
    select: { vehicleId: true },
  });
  const payment = await prisma.payment.findFirst({
    where: { orgId: org.id, invoiceId: { not: null } },
    orderBy: { receivedAt: 'desc' },
    select: { id: true },
  });
  const estimate = await prisma.estimate.findFirst({
    where: { job: { orgId: org.id }, status: 'SENT' },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  // A handover to photograph, on a car of its own so no real invitation is
  // disturbed. Taken down again at the end of the run. Phase 44.
  const handoverToken = randomBytes(18).toString('base64url');
  const shown = await prisma.vehicle.upsert({
    where: { vin: 'SHOTHANDOVER00001' },
    create: {
      vin: 'SHOTHANDOVER00001',
      registration: 'YD19 KPX',
      make: 'Toyota',
      model: 'Corolla',
      year: 2019,
      lastOdometerKm: 71_400,
      eventCount: 14,
    },
    update: {},
    select: { id: true },
  });
  await prisma.handoverInvitation.deleteMany({ where: { vehicleId: shown.id } });
  await prisma.vehicleOwnership.deleteMany({ where: { vehicleId: shown.id } });
  const sellerOwnership = await prisma.vehicleOwnership.create({
    data: {
      vehicleId: shown.id,
      ownerName: 'The seller',
      ownerKind: 'PRIVATE',
      startedAt: new Date(Date.now() - 900 * 86_400_000),
    },
    select: { id: true },
  });
  await prisma.handoverInvitation.create({
    data: {
      vehicleId: shown.id,
      orgId: org.id,
      fromOwnershipId: sellerOwnership.id,
      toName: 'Tom Hargreaves',
      tokenHash: createHash('sha256').update(handoverToken).digest('hex'),
      soldOn: new Date(Date.now() - 2 * 86_400_000),
      odometerKm: 71_400,
      expiresAt: new Date(Date.now() + 21 * 86_400_000),
    },
  });

  return {
    job: job.id,
    story: storied.id,
    inspection: inspection.id,
    handover: handoverToken,
    handoverVehicle: shown.id,
    invoice: invoice.id,
    customer: customer.id,
    vehicle: vehicle.id,
    driverEmail: driver.portalUser!.email,
    owned: owned.vehicleId,
    estimate: estimate?.id ?? null,
    payment: payment?.id ?? null,
  };
}

async function main() {
  const r = await ids();
  const owner = await mint('ahmed@hillsidemotors.test');
  const driver = await mint(r.driverEmail);

  // The operator is whoever OPERATOR_EMAIL says, and on a machine where it is
  // unset nobody is: the shot is skipped rather than faked, because a picture
  // of a page taken as somebody who could not really open it is a picture of
  // something that does not exist.
  const operatorEmail = process.env.OPERATOR_EMAIL?.trim().toLowerCase();
  const operator = operatorEmail ? await mintOperator(operatorEmail) : null;

  const shots: Shot[] = [
    { file: 'home', path: '/', who: 'nobody', height: 900 },
    { file: 'login', path: '/login', who: 'nobody' },
    { file: 'signup', path: '/signup', who: 'nobody', fullPage: true },
    { file: 'settings-organisation', path: '/settings/organisation', who: 'owner', fullPage: true },
    { file: 'subscription', path: '/settings/subscription', who: 'owner', fullPage: true },
    { file: 'data', path: '/settings/data', who: 'owner', fullPage: true },
    { file: 'terms', path: '/terms', who: 'nobody', fullPage: true },
    { file: 'dashboard', path: '/dashboard', who: 'owner', fullPage: true },
    { file: 'dashboard-dark', path: '/dashboard', who: 'owner', dark: true },
    { file: 'diary', path: '/diary', who: 'owner' },
    { file: 'now', path: '/now', who: 'owner', fullPage: true },
    { file: 'morning', path: '/morning', who: 'owner', fullPage: true },
    { file: 'close', path: '/close', who: 'owner', fullPage: true },
    { file: 'opening', path: '/opening', who: 'owner', fullPage: true },
    { file: 'floor', path: '/floor', who: 'owner' },
    { file: 'job', path: `/jobs/${r.job}`, who: 'owner', fullPage: true },
    { file: 'check-in', path: `/jobs/${r.job}/check-in`, who: 'owner', fullPage: true },
    { file: 'story', path: `/jobs/${r.story}/story`, who: 'owner', fullPage: true },
    { file: 'conversations', path: '/inbox', who: 'owner', fullPage: true },
    { file: 'packages', path: '/settings/packages', who: 'owner', fullPage: true },
    { file: 'returns', path: '/purchasing/returns', who: 'owner', fullPage: true },
    { file: 'search', path: '/search?q=Pennine&all=1', who: 'owner', fullPage: true },
    { file: 'notifications', path: '/notifications', who: 'owner', fullPage: true },
    {
      file: 'comebacks',
      path: '/reports/business?range=quarter#comebacks',
      who: 'owner',
      fullPage: true,
    },
    { file: 'reputation-trend', path: '/reputation', who: 'owner', fullPage: true },
    { file: 'tax-report', path: '/reports/tax?range=year', who: 'owner', fullPage: true },
    { file: 'portal-ar', path: '/portal', who: 'driver', lang: 'ar' },
    { file: 'home-fr', path: '/', who: 'nobody', lang: 'fr', height: 900 },
    { file: 'dashboard-ar', path: '/dashboard', who: 'owner', lang: 'ar' },
    { file: 'job-fr', path: '/jobs', who: 'owner', lang: 'fr', fullPage: true },
    { file: 'shop', path: '/shop', who: 'owner', width: 1024, height: 768 },
    {
      file: 'inspection',
      path: `/shop/inspect/${r.inspection}`,
      who: 'owner',
      width: 1024,
      height: 768,
    },
    { file: 'invoice', path: `/invoices/${r.invoice}`, who: 'owner', fullPage: true },
    { file: 'counter', path: '/counter', who: 'owner' },
    ...(r.payment
      ? [
          {
            file: 'receipt',
            path: `/payments/${r.payment}/receipt`,
            who: 'owner' as const,
            fullPage: true,
          },
        ]
      : []),
    { file: 'gift-cards', path: '/gift-cards', who: 'owner' },
    { file: 'customer', path: `/customers/${r.customer}`, who: 'owner', fullPage: true },
    { file: 'passports', path: '/passports', who: 'owner' },
    { file: 'passport', path: `/vehicles/${r.vehicle}/passport`, who: 'owner', fullPage: true },
    { file: 'vehicle', path: `/vehicles/${r.vehicle}`, who: 'owner' },
    { file: 'reputation', path: '/reputation', who: 'owner' },
    { file: 'payroll', path: '/payroll', who: 'owner', fullPage: true },
    { file: 'warranty-cost', path: '/warranty?range=year#cost', who: 'owner', fullPage: true },
    { file: 'start', path: '/start', who: 'owner', fullPage: true },
    { file: 'coupons', path: '/coupons', who: 'owner', fullPage: true },
    { file: 'books', path: '/books', who: 'owner', fullPage: true },
    { file: 'clock', path: '/reports/clock', who: 'owner', fullPage: true },
    { file: 'health', path: '/admin/health', who: 'operator', fullPage: true },
    { file: 'uptake', path: '/reports/uptake?days=365', who: 'owner', fullPage: true },
    { file: 'phone-books', path: '/books', who: 'owner', width: 390, height: 844, fullPage: true },
    { file: 'phone-dashboard', path: '/dashboard', who: 'owner', width: 390, height: 844 },
    { file: 'phone-job', path: `/jobs/${r.job}`, who: 'owner', width: 390, height: 844 },
    {
      file: 'phone-dashboard-ar',
      path: '/dashboard',
      who: 'owner',
      width: 390,
      height: 844,
      lang: 'ar',
    },
    { file: 'help', path: '/help', who: 'owner', fullPage: true },
    ...(r.handover
      ? [{ file: 'handover', path: `/handover/${r.handover}`, who: 'nobody' as const, height: 900 }]
      : []),
    {
      file: 'vin-decode',
      path: '/vehicles/find?q=WVWZZZ1JZ3W386752&vin=WVWZZZ1JZ3W386752&decode=1',
      who: 'owner',
      fullPage: true,
    },
    { file: 'ask', path: '/ask?q=Who+owes+us+money%3F', who: 'owner' },
    { file: 'people', path: '/people', who: 'owner' },
    { file: 'business', path: '/reports/business', who: 'owner' },
    { file: 'plan', path: '/plan', who: 'owner' },
    { file: 'portal', path: '/portal', who: 'driver', width: 390, height: 844, fullPage: true },
    { file: 'portal-desktop', path: '/portal', who: 'driver', width: 1280, height: 800 },
    { file: 'portal-phone', path: '/portal', who: 'driver', width: 390, height: 844 },
    {
      file: 'portal-rewards',
      path: '/portal/rewards',
      who: 'driver',
      width: 390,
      height: 844,
      fullPage: true,
    },
    {
      file: 'portal-workshops',
      path: '/portal/workshops',
      who: 'driver',
      width: 390,
      height: 844,
      fullPage: true,
    },
    {
      file: 'portal-settings',
      path: '/portal/settings',
      who: 'driver',
      width: 390,
      height: 844,
      fullPage: true,
    },
    { file: 'pricing', path: '/pricing?country=CA', who: 'nobody', fullPage: true },
    {
      file: 'portal-invoices',
      path: '/portal/invoices',
      who: 'driver',
      width: 390,
      height: 844,
      fullPage: true,
    },
    { file: 'card-payments', path: '/payments/card', who: 'owner' },
    { file: 'portal-passports', path: '/portal/passports', who: 'driver', width: 390, height: 844 },
    {
      file: 'portal-passport',
      path: `/portal/vehicles/${r.owned}/passport`,
      who: 'driver',
      width: 390,
      height: 844,
      fullPage: true,
    },
    ...(r.estimate
      ? [
          {
            file: 'estimate-approval',
            path: `/portal/estimates/${r.estimate}`,
            who: 'driver' as const,
            width: 390,
            height: 844,
            fullPage: true,
          },
        ]
      : []),
    // Paper. Phase 42.
    { file: 'print-invoice', path: `/print/invoice/${r.invoice}`, who: 'owner', fullPage: true },
    { file: 'print-work-order', path: `/print/work-order/${r.job}`, who: 'owner', fullPage: true },
    {
      file: 'print-inspection-ar',
      path: `/print/inspection/${r.inspection}`,
      who: 'owner',
      lang: 'ar',
      fullPage: true,
    },
    { file: 'print-key-tag', path: `/print/key-tag/${r.job}`, who: 'owner', height: 500 },
    { file: 'not-found', path: '/nothing-here', who: 'owner' },
  ];

  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const shot of shots) {
    if (shot.who === 'operator' && !operator) {
      console.info(`  skipped ${shot.file}.png  no OPERATOR_EMAIL, so nobody can open it`);
      continue;
    }

    const context = await browser.newContext({
      viewport: { width: shot.width ?? 1280, height: shot.height ?? 800 },
      colorScheme: shot.dark ? 'dark' : 'light',
      deviceScaleFactor: 1.5,
    });
    if (shot.who !== 'nobody') {
      await context.addCookies([
        {
          name: 'carnet_session',
          value: shot.who === 'owner' ? owner : shot.who === 'operator' ? (operator ?? '') : driver,
          url: BASE,
        },

        ...(shot.lang ? [{ name: 'carnet_lang', value: shot.lang, url: BASE }] : []),
      ]);
    }
    const page = await context.newPage();
    // Load, then a beat for fonts and the first paint. Not network idle: a
    // page that keeps a connection open, as the assistant does, never gets there.
    await page.goto(`${BASE}${shot.path}`, { waitUntil: 'load', timeout: 60_000 });
    if (shot.fullPage) {
      await page.addStyleTag({ content: 'nav.fixed{display:none !important}' });
    }
    await page.waitForTimeout(shot.settle ?? 1_200);
    // The keyboard skip link sits off-canvas until focused; a full-page
    // capture pulls it into frame, so the camera hides it.
    const file = join(OUT, `${shot.file}.png`);
    await page.screenshot({ path: file, fullPage: shot.fullPage ?? false });
    console.info(`  ${shot.file}.png  ${shot.path}`);
    await context.close();
  }

  // The car put up for the handover photograph goes away again.
  await prisma.handoverInvitation.deleteMany({ where: { vehicleId: r.handoverVehicle } });
  await prisma.vehicleOwnership.deleteMany({ where: { vehicleId: r.handoverVehicle } });

  // The mark, as the home screen sees it.
  const icon = await fetch(`${BASE}/apple-icon`);
  writeFileSync(join(OUT, 'mark.png'), Buffer.from(await icon.arrayBuffer()));
  console.info('  mark.png  /apple-icon');

  await browser.close();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
