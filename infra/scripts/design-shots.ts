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
  who: 'owner' | 'driver' | 'nobody';
  width?: number;
  height?: number;
  fullPage?: boolean;
  dark?: boolean;
  /** The language cookie for the shot. Phase 37.5. */
  lang?: 'en' | 'fr' | 'ar';
  settle?: number;
};

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
  const driver = await prisma.customer.findFirstOrThrow({
    where: { portalUserId: { not: null } },
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
  return {
    job: job.id,
    inspection: inspection.id,
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
    { file: 'floor', path: '/floor', who: 'owner' },
    { file: 'job', path: `/jobs/${r.job}`, who: 'owner', fullPage: true },
    { file: 'check-in', path: `/jobs/${r.job}/check-in`, who: 'owner', fullPage: true },
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
    const context = await browser.newContext({
      viewport: { width: shot.width ?? 1280, height: shot.height ?? 800 },
      colorScheme: shot.dark ? 'dark' : 'light',
      deviceScaleFactor: 1.5,
    });
    if (shot.who !== 'nobody') {
      await context.addCookies([
        {
          name: 'carnet_session',
          value: shot.who === 'owner' ? owner : driver,
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
