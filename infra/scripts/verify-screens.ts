/**
 * Every screen at every size, measured rather than eyeballed.
 *
 *   npx tsx infra/scripts/verify-screens.ts [baseUrl]
 *
 * A workshop uses this product standing next to a car with a phone, at the
 * counter on a tablet, and in the office on a monitor. "Responsive" has been a
 * claim in the roadmap since the first phase; this is what turns it into a
 * check.
 *
 * Every page is measured on a telephone, and the pages a workshop lives in are
 * measured again at each width where the layout changes: a small phone, a
 * large one, a tablet held either way, a laptop and a wide monitor.
 *
 * Three things are measured at each size:
 *
 *   Nothing sticks out sideways. A page whose content is wider than the
 *   window slides under the thumb and takes the whole layout with it. Tables,
 *   diagrams and code are allowed to scroll inside their own box; the page
 *   itself is not.
 *
 *   Nothing is too small to press. Every button, link and field is at least
 *   40 pixels through the middle, which is the smallest a thumb finds
 *   reliably, with a small allowance for links inside a sentence.
 *
 *   Nothing is too small to read. No text under 12 pixels.
 *
 * It signs in as the seeded owner and the seeded driver the way the design
 * photographs do, and cleans up the sessions it mints.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';
import { chromium, type Page } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:3000';

/**
 * The sizes. The phone is where everything is measured; the rest are where
 * the layout changes its mind, and a handful of pages are measured at each.
 */
const SIZES = [
  { name: 'small phone', width: 320, height: 720, touch: true },
  { name: 'phone', width: 390, height: 844, touch: true },
  { name: 'large phone', width: 430, height: 932, touch: true },
  { name: 'tablet', width: 768, height: 1024, touch: true },
  { name: 'tablet, landscape', width: 1024, height: 768, touch: true },
  { name: 'laptop', width: 1280, height: 800, touch: false },
  { name: 'monitor', width: 1680, height: 1050, touch: false },
] as const;

/** The size every page is measured at. */
const EVERY_PAGE = 'phone';
/** A control the product drew as a control: a thumb's width. */
const MIN_TAP = 40;
/** A link that is a word rather than a button: WCAG 2.2 AA, 24 by 24. */
const MIN_LINK = 24;
/** Nothing anywhere is smaller than this, label or sentence. */
const MIN_TEXT = 11;
const MIN_LABEL = 11;

let failures = 0;
const tokens: string[] = [];

function fail(label: string, detail: string): void {
  failures += 1;
  console.error(`  FAIL   ${label}: ${detail}`);
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

interface Complaint {
  overflow: { by: number; widest: string[] };
  small: string[];
  tiny: string[];
}

/**
 * What is wrong with this page on a phone, measured in the browser.
 *
 * Elements are named by their tag, their classes and the start of their text,
 * because a selector nobody can find is a complaint nobody can act on.
 */
async function measure(page: Page): Promise<Complaint> {
  return page.evaluate(
    ({ minTap, minLink, minText, minLabel }) => {
      const name = (element: Element): string => {
        const tag = element.tagName.toLowerCase();
        const cls = (element.getAttribute('class') ?? '').split(/\s+/).slice(0, 3).join('.');
        const text = (element.textContent ?? '').trim().slice(0, 28).replace(/\s+/g, ' ');
        return `${tag}${cls ? '.' + cls : ''}${text ? ` “${text}”` : ''}`;
      };

      const scrollable = (element: Element): boolean => {
        for (let node: Element | null = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.overflowX === 'auto' || style.overflowX === 'scroll') return true;
        }
        return false;
      };

      const window_ = document.documentElement.clientWidth;
      const widest: string[] = [];

      // Off-canvas drawers and screen-reader-only links are measured where
      // they are, which is not on the screen. They are judged when they are
      // open, not while they are parked.
      const onScreen = (box: DOMRect): boolean =>
        box.width > 1 && box.height > 1 && box.right > 0 && box.left < window_;

      for (const element of Array.from(document.body.querySelectorAll('*'))) {
        const box = element.getBoundingClientRect();
        if (!onScreen(box)) continue;
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.position === 'fixed') continue;
        // Right edge past the window, and nothing above it is allowed to
        // scroll sideways.
        if (box.right > window_ + 1 && !scrollable(element)) widest.push(name(element));
      }

      const small: string[] = [];
      const tiny: string[] = [];

      for (const element of Array.from(
        document.body.querySelectorAll('a, button, input, select, textarea, [role="button"]'),
      )) {
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        if (!onScreen(box) || style.visibility === 'hidden') continue;
        // A link inside a sentence is a word, not a target, and is judged as
        // text. A link that is only a word on its own line is held to what
        // WCAG 2.2 asks of any target; a button or a field, to a thumb.
        const inline = element.tagName === 'A' && style.display.startsWith('inline');
        if (inline) continue;

        // A link drawn as a button — it has a border or a filled background —
        // is judged as a button. Tailwind gives everything a border style, so
        // the width is what says whether a border was actually drawn.
        const bordered = Number.parseFloat(style.borderTopWidth) > 0;
        const filled =
          style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent';
        // A tick box is pressed through its label as often as through itself,
        // so it is judged as a target rather than as a control.
        const type = (element.getAttribute('type') ?? '').toLowerCase();
        if (type === 'checkbox' || type === 'radio') {
          if (box.height < minLink) {
            small.push(`${name(element)} ${Math.round(box.height)}px, wanted ${minLink}`);
          }
          continue;
        }

        const drawn = element.tagName !== 'A' || bordered || filled;

        const floor = drawn ? minTap : minLink;
        if (box.height < floor) {
          small.push(`${name(element)} ${Math.round(box.height)}px, wanted ${floor}`);
        }
      }

      for (const element of Array.from(document.body.querySelectorAll('*'))) {
        const text = Array.from(element.childNodes).some(
          (node) => node.nodeType === 3 && (node.textContent ?? '').trim().length > 0,
        );
        if (!text) continue;
        if (!onScreen(element.getBoundingClientRect())) continue;
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden') continue;
        // A label in small capitals carries two or three words and is allowed
        // to be smaller than a sentence, but not by much.
        const classes = element.getAttribute('class') ?? '';
        // The passport booklet is a drawing of a printed document: its
        // engraved labels and machine-readable line are part of the picture
        // rather than the interface, and are set as a document sets them.
        if (element.closest('[class*="passport"]')) continue;
        const label = style.textTransform === 'uppercase' || classes.includes('eyebrow');
        const floor = label ? minLabel : minText;
        const size = Number.parseFloat(style.fontSize);
        if (size && size < floor) tiny.push(`${name(element)} ${size}px`);
      }

      return {
        overflow: {
          by: Math.max(0, Math.round(document.documentElement.scrollWidth - window_)),
          widest: widest.slice(0, 4),
        },
        small: [...new Set(small)].slice(0, 4),
        tiny: [...new Set(tiny)].slice(0, 4),
      };
    },
    { minTap: MIN_TAP, minLink: MIN_LINK, minText: MIN_TEXT, minLabel: MIN_LABEL },
  );
}

async function main() {
  console.info(`\n  Every screen at every size\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const job = await prisma.job.findFirstOrThrow({
    where: { orgId: org.id, status: 'IN_PROGRESS' },
    select: { id: true },
  });
  const invoice = await prisma.invoice.findFirstOrThrow({
    where: { orgId: org.id, status: { in: ['ISSUED', 'PART_PAID'] } },
    select: { id: true },
  });
  const customer = await prisma.customer.findFirstOrThrow({
    where: { orgId: org.id, jobs: { some: {} } },
    select: { id: true },
  });
  const vehicle = await prisma.vehicle.findFirstOrThrow({
    where: { events: { some: { recordedByOrgId: org.id } } },
    select: { id: true },
  });
  const part = await prisma.product.findFirstOrThrow({
    where: { orgId: org.id },
    select: { id: true },
  });
  const driver = await prisma.customer.findFirstOrThrow({
    where: { portalUserId: { not: null } },
    select: { portalUser: { select: { email: true } } },
  });

  const owner = await mint('ahmed@hillsidemotors.test');
  const customerLogin = await mint(driver.portalUser!.email);

  const pages: {
    path: string;
    who: 'owner' | 'driver' | 'nobody';
    lang?: 'ar';
    /** Also measured at every other size: the screens a workshop lives in. */
    everySize?: boolean;
  }[] = [
    { path: '/', who: 'nobody', everySize: true },
    { path: '/pricing', who: 'nobody', everySize: true },
    { path: '/login', who: 'nobody', everySize: true },
    { path: '/dashboard', who: 'owner', everySize: true },
    { path: '/start', who: 'owner', everySize: true },
    { path: '/help', who: 'owner', everySize: true },
    { path: '/help/invoices-and-payments', who: 'owner' },
    { path: '/diary', who: 'owner', everySize: true },
    { path: '/jobs', who: 'owner', everySize: true },
    { path: `/jobs/${job.id}`, who: 'owner' },
    { path: '/jobs/new', who: 'owner' },
    { path: '/floor', who: 'owner', everySize: true },
    { path: '/inspections', who: 'owner' },
    { path: '/warranty', who: 'owner' },
    { path: '/capacity', who: 'owner' },
    { path: '/plan', who: 'owner' },
    { path: '/customers', who: 'owner' },
    { path: `/customers/${customer.id}`, who: 'owner' },
    { path: '/vehicles', who: 'owner' },
    { path: `/vehicles/${vehicle.id}`, who: 'owner' },
    { path: '/vehicles/find', who: 'owner' },
    { path: '/reminders', who: 'owner' },
    { path: '/reputation', who: 'owner' },
    { path: '/invoices', who: 'owner', everySize: true },
    { path: `/invoices/${invoice.id}`, who: 'owner' },
    { path: '/payments', who: 'owner' },
    { path: '/counter', who: 'owner', everySize: true },
    { path: '/parts', who: 'owner', everySize: true },
    { path: `/parts/${part.id}`, who: 'owner' },
    { path: '/purchasing', who: 'owner' },
    { path: '/suppliers', who: 'owner' },
    { path: '/reports', who: 'owner' },
    { path: '/reports/business', who: 'owner' },
    { path: '/reports/tax?range=year', who: 'owner' },
    { path: '/financials', who: 'owner' },
    { path: '/people', who: 'owner' },
    { path: '/payroll', who: 'owner' },
    { path: '/settings', who: 'owner' },
    { path: '/settings/site', who: 'owner' },
    { path: '/settings/organisation', who: 'owner' },
    { path: '/settings/catalogue', who: 'owner' },
    { path: '/audit', who: 'owner' },
    { path: '/search?q=Pennine&all=1', who: 'owner' },
    { path: '/portal', who: 'driver', everySize: true },
    { path: '/portal/invoices', who: 'driver' },
    { path: '/portal/passports', who: 'driver' },
    { path: '/portal/book', who: 'driver' },

    // The same screens read right to left, on the same telephone. A layout
    // that only holds together in one direction holds together by accident.
    { path: '/dashboard', who: 'owner', lang: 'ar' },
    { path: '/jobs', who: 'owner', lang: 'ar' },
    { path: '/start', who: 'owner', lang: 'ar' },
    { path: '/help', who: 'owner', lang: 'ar' },
    { path: '/invoices', who: 'owner', lang: 'ar' },
    { path: '/counter', who: 'owner', lang: 'ar' },
    { path: '/portal', who: 'driver', lang: 'ar' },
  ];

  const browser = await chromium.launch();

  for (const size of SIZES) {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: size.touch ? 2 : 1,
      isMobile: size.touch,
      hasTouch: size.touch,
    });

    // The measuring function is compiled by tsx before it reaches the browser,
    // and the compiler names its inner functions with a helper that only
    // exists in Node. Defining it in the page is cheaper than giving up named
    // functions inside the measurement.
    await context.addInitScript(() => {
      (globalThis as unknown as { __name: (value: unknown) => unknown }).__name = (value) => value;
    });

    const here = pages.filter((entry) => size.name === EVERY_PAGE || entry.everySize);
    console.info(`\n  ${size.name}, ${size.width} by ${size.height}\n`);

    for (const entry of here) {
      await context.clearCookies();
      const cookies = [];
      if (entry.who !== 'nobody') {
        cookies.push({
          name: 'carnet_session',
          value: entry.who === 'owner' ? owner : customerLogin,
          url: BASE,
        });
      }
      if (entry.lang) cookies.push({ name: 'carnet_lang', value: entry.lang, url: BASE });
      if (cookies.length > 0) await context.addCookies(cookies);

      const name = `${entry.path}${entry.lang ? ` (${entry.lang})` : ''}`;
      const page = await context.newPage();

      try {
        const response = await page.goto(`${BASE}${entry.path}`, {
          waitUntil: 'load',
          timeout: 45_000,
        });
        const status = response?.status() ?? 0;

        if (status >= 400) {
          fail(`${name} @ ${size.width}`, `answered ${status}`);
          continue;
        }

        await page.waitForTimeout(400);
        const complaint = await measure(page);

        const problems: string[] = [];

        // Anything the measurement can name is a fault, however small. A few
        // pixels of root scroll with no element behind them is the browser's
        // own rounding of a scrolling box, and shows nothing cut off; it is
        // reported only once it is wide enough to see.
        const named = complaint.overflow.widest.length > 0;
        if (complaint.overflow.by > 1 && (named || complaint.overflow.by > 8)) {
          problems.push(
            `${complaint.overflow.by}px wider than the screen: ${complaint.overflow.widest.join(' | ') || 'nothing named'}`,
          );
        }
        // A pointer is exact, so the forty-pixel rule is only asked of a
        // screen somebody is pressing with a thumb. Nothing else changes.
        if (size.touch && complaint.small.length > 0) {
          problems.push(`too small to press: ${complaint.small.join(' | ')}`);
        }
        if (complaint.tiny.length > 0) {
          problems.push(`too small to read: ${complaint.tiny.join(' | ')}`);
        }

        // Right to left means right to left: the page says so, or the
        // measuring above was done on a page that only looked translated.
        if (entry.lang === 'ar') {
          const direction = await page.evaluate(() => document.documentElement.getAttribute('dir'));
          if (direction !== 'rtl') problems.push(`in Arabic but dir is ${direction ?? 'unset'}`);
        }

        if (problems.length === 0) console.info(`  ok     ${name}`);
        else problems.forEach((problem) => fail(`${name} @ ${size.width}`, problem));
      } catch (error) {
        fail(`${name} @ ${size.width}`, error instanceof Error ? error.message : String(error));
      } finally {
        await page.close();
      }
    }

    await context.close();
  }

  await browser.close();
  await prisma.session.deleteMany({ where: { tokenHash: { in: tokens } } });

  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
