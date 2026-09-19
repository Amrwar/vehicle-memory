/**
 * The same screens in the three engines a person actually has. NFR-610.
 *
 *   npx tsx infra/scripts/verify-engines.ts [baseUrl]
 *
 * Everything else in this repository is measured in Chromium, because that is
 * what Playwright installs by default and nobody chose otherwise. The
 * requirement has said "the two most recent versions of Chrome, Safari,
 * Firefox and Edge" since the first week, and until Phase 56 the honest
 * account of it was: one of those, and only one.
 *
 * That matters more here than it would for most products. A workshop's
 * customers open a shared passport, a quote and an invoice on their own
 * telephones, and a great many of those telephones are iPhones — which means
 * WebKit, which is a different engine rather than a different skin. Arabic
 * read right to left is where engines disagree most, so it is measured in all
 * three rather than in the one that is easiest.
 *
 * What this checks is deliberately narrower than verify-screens: that the page
 * renders at all, that it is not wider than the window, and that it is the
 * right way round. Fonts and sub-pixel metrics differ between engines by
 * design, and holding three engines to one pixel measurement would produce
 * failures about nothing.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';
import { type Browser, type BrowserContext, chromium, firefox, webkit } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';

/** A phone, because that is where the engines differ and where customers are. */
const VIEWPORT = { width: 390, height: 844 };

const ENGINES = [
  { name: 'Chromium — Chrome and Edge', launch: chromium },
  { name: 'WebKit — Safari, and every iPhone', launch: webkit },
  { name: 'Firefox', launch: firefox },
] as const;

let failures = 0;
const tokens: string[] = [];

function fail(what: string, detail: string) {
  failures += 1;
  console.error(`  FAIL   ${what}: ${detail}`);
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

interface Screen {
  path: string;
  who: 'owner' | 'driver' | 'nobody';
  lang?: 'ar';
}

/**
 * The product's own Content-Security-Policy carries
 * `upgrade-insecure-requests`, which is right, and which makes this probe
 * impossible over plain HTTP in two of the three engines.
 *
 * Chromium exempts loopback from the upgrade. WebKit does not, and is within
 * its rights not to: it asks for the stylesheet over https, from a server that
 * speaks no TLS, and renders the page with no stylesheet at all.
 *
 * The first run of this read that as the product — nine screens "wider than
 * the screen" in WebKit and none in the other two, which is exactly what an
 * unstyled page looks like at 390 pixels. Two correct behaviours and one wrong
 * conclusion, which is the shape this project keeps meeting: the probe was at
 * fault, not the thing it was pointed at.
 *
 * So the directive is taken out of the header on the way past, for the test
 * only, and any request that was upgraded anyway is answered from the plain
 * server behind it. Nothing about the product changes. In production every
 * request is already https and the directive does what it is there for.
 */
async function withoutTheUpgrade(context: BrowserContext, base: string) {
  const plainHost = base.replace(/^https?:\/\//, '');

  await context.route('**/*', async (route) => {
    const asked = route.request().url();
    const target = asked.startsWith(`https://${plainHost}`)
      ? asked.replace('https://', 'http://')
      : asked;

    if (!target.startsWith(base)) {
      await route.continue();
      return;
    }

    try {
      const answer = await context.request.fetch(target, {
        method: route.request().method(),
        headers: route.request().headers(),
        data: route.request().postDataBuffer() ?? undefined,
        maxRedirects: 0,
      });

      const headers = Object.fromEntries(
        Object.entries(answer.headers()).map(([name, value]) =>
          name.toLowerCase() === 'content-security-policy'
            ? [name, value.replace(/;\s*upgrade-insecure-requests/gi, '')]
            : [name, value],
        ),
      );

      await route.fulfill({ status: answer.status(), headers, body: await answer.body() });
    } catch {
      await route.abort();
    }
  });
}

async function run(
  browser: Browser,
  engine: string,
  screens: Screen[],
  sessions: Record<string, string>,
) {
  console.info(`\n  ${engine}\n`);

  for (const screen of screens) {
    const context = await browser.newContext({ viewport: VIEWPORT });
    await withoutTheUpgrade(context, BASE);
    const cookies = [];

    if (screen.who !== 'nobody') {
      cookies.push({ name: 'carnet_session', value: sessions[screen.who]!, url: BASE });
    }
    if (screen.lang) cookies.push({ name: 'carnet_lang', value: screen.lang, url: BASE });
    if (cookies.length > 0) await context.addCookies(cookies);

    const page = await context.newPage();
    const name = `${screen.path}${screen.lang ? ` (${screen.lang})` : ''}`;

    try {
      const response = await page.goto(`${BASE}${screen.path}`, {
        waitUntil: 'load',
        timeout: 45_000,
      });

      const status = response?.status() ?? 0;
      if (status >= 400) {
        fail(name, `answered ${status}`);
        continue;
      }

      await page.waitForTimeout(400);

      const seen = await page.evaluate(() => ({
        // A page whose stylesheet did not arrive is not a narrow page; it is
        // an unstyled one, and measuring its width says nothing about the
        // product. Asked before anything else is measured.
        styled: Array.from(document.styleSheets).some((sheet) => {
          try {
            return sheet.cssRules.length > 0;
          } catch {
            return false;
          }
        }),
        words: document.body.innerText.slice(0, 3000),
        over: Math.round(
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        direction: document.documentElement.getAttribute('dir'),
        painted: document.body.innerText.trim().length,
      }));

      const problems: string[] = [];

      if (!seen.styled) {
        fail(name, 'the stylesheet did not arrive, so nothing here is worth measuring');
        continue;
      }

      if (BROKEN.some((marker) => seen.words.includes(marker))) problems.push('an error on it');
      if (seen.painted < 40) problems.push('nothing drawn');

      // Eight pixels rather than one: three engines round a scrolling box
      // three different ways, and a complaint about rounding is a complaint
      // nobody can act on. Anything a person would see is far wider than this.
      if (seen.over > 8) problems.push(`${seen.over}px wider than the screen`);

      if (screen.lang === 'ar' && seen.direction !== 'rtl') {
        problems.push(`in Arabic but dir is ${seen.direction ?? 'unset'}`);
      }

      if (problems.length === 0) console.info(`  ok     ${name}`);
      else problems.forEach((problem) => fail(name, problem));
    } catch (error) {
      fail(name, error instanceof Error ? error.message : String(error));
    } finally {
      await page.close();
      await context.close();
    }
  }
}

async function main() {
  console.info(`\n  The same screens, in the engines people actually have\n  ${BASE}`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });

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

  const sessions = {
    owner: await mint('ahmed@hillsidemotors.test'),
    driver: await mint(driver.portalUser!.email),
  };

  // A shared passport, made for this run and taken away after: it is the page
  // a customer is most likely to open on a telephone that is not theirs.
  const shareToken = randomBytes(24).toString('base64url');
  await prisma.passportShare.create({
    data: {
      vehicleId: access.vehicleId,
      tokenHash: createHash('sha256').update(shareToken).digest('hex'),
      label: 'engines-probe',
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  // The screens a workshop lives in, the ones a customer is sent, and the
  // same read right to left. Not all hundred and twenty-eight: three engines
  // over every address is an hour of wall clock to say what one engine
  // already said about the layout.
  const screens: Screen[] = [
    { path: '/', who: 'nobody' },
    { path: '/pricing', who: 'nobody' },
    { path: '/login', who: 'nobody' },
    { path: `/p/${shareToken}`, who: 'nobody' },
    { path: '/dashboard', who: 'owner' },
    { path: '/diary', who: 'owner' },
    { path: '/jobs', who: 'owner' },
    { path: `/jobs/${job.id}`, who: 'owner' },
    { path: '/invoices', who: 'owner' },
    { path: `/invoices/${invoice.id}`, who: 'owner' },
    { path: '/counter', who: 'owner' },
    { path: '/parts', who: 'owner' },
    { path: '/floor', who: 'owner' },
    { path: '/portal', who: 'driver' },
    { path: '/portal/invoices', who: 'driver' },
    { path: '/dashboard', who: 'owner', lang: 'ar' },
    { path: '/jobs', who: 'owner', lang: 'ar' },
    { path: '/invoices', who: 'owner', lang: 'ar' },
    { path: '/counter', who: 'owner', lang: 'ar' },
    { path: '/portal', who: 'driver', lang: 'ar' },
  ];

  for (const engine of ENGINES) {
    const browser = await engine.launch.launch();
    try {
      await run(browser, engine.name, screens, sessions);
    } finally {
      await browser.close();
    }
  }

  await prisma.passportShare.deleteMany({ where: { label: 'engines-probe' } });
  await prisma.session.deleteMany({ where: { tokenHash: { in: tokens } } });

  console.info(
    failures === 0
      ? `\n  ${screens.length * ENGINES.length} screens in three engines. All good.\n`
      : `\n  ${failures} failed.\n`,
  );

  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
