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

import { everyRoute, visible } from './lib/routes';

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

/**
 * How a page says it fell over, in each language it can say it in.
 *
 * A page under a loading boundary has committed to 200 before it throws, so
 * the status is no help and the words are the only thing left.
 */
const BROKEN = [
  'Something went wrong',
  'Application error',
  'Quelque chose a mal tourné',
  'حدث خطأ ما',
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
  return mintFor(user.id, user.memberships[0]?.orgId ?? null);
}

async function mintFor(userId: string, orgId: string | null): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  tokens.push(tokenHash);
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
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

/* ---------------------------------------------------------------------------
   Every address, and what is done about it
   --------------------------------------------------------------------------- */

/** The seeded workshop's own records, so a bracket can be filled in. */
interface Ids {
  orgId: string;
  booking: string;
  customer: string;
  equipment: string;
  estimate: string;
  fleet: string;
  giftCard: string;
  import: string;
  inspection: string;
  invoice: string;
  job: string;
  payment: string;
  person: string;
  product: string;
  purchaseOrder: string;
  supplier: string;
  transfer: string;
  vehicle: string;
  /**
   * Three that a database may genuinely not have. A page with nothing to draw
   * is not a page that failed; it is a page that says so and is counted among
   * the ones not measured, with the reason printed.
   */
  paymentAttempt: string | null;
  subscribedOrg: string | null;
  driversVehicle: string | null;
  /** The customer whose login the portal pages are measured through. */
  driverEmail: string;
  /** Links whose token is the credential, minted for this run and then gone. */
  passportLink: string;
  estimateLink: string;
  reviewLink: string;
  handoverLink: string;
  inviteLink: string;
}

type Who = 'owner' | 'driver' | 'operator' | 'nobody';

interface Plan {
  who?: Who;
  /** The address to open, with the brackets filled in — or why there is none. */
  path?: (r: Ids) => string | { because: string };
  /** Also measured at every other size: the screens a workshop lives in. */
  everySize?: boolean;
  /** Also measured right to left, on the same telephone. */
  alsoArabic?: boolean;
  /**
   * Why this address is not measured.
   *
   * Written out rather than left off the list. A screen nobody decided about
   * is a screen nobody measured, and for several phases that was most of
   * them: the list was hand-written, so a page built in September was measured
   * only if somebody remembered to add it. The list is now read off the app
   * directory, and a new page fails this check on the day it is created —
   * which is the one moment when deciding what to do about it costs nothing.
   */
  unmeasured?: string;
}

const PLAN: Record<string, Plan> = {
  /* --- the front of the house --------------------------------------------- */
  '/': { who: 'nobody', everySize: true },
  '/pricing': { who: 'nobody', everySize: true },
  '/terms': { who: 'nobody' },
  '/verify': { who: 'nobody' },
  '/shop': { who: 'owner', everySize: true },
  '/shop/inspect/[id]': { who: 'owner', path: (r) => `/shop/inspect/${r.inspection}` },

  /* --- getting in --------------------------------------------------------- */
  '/login': { who: 'nobody', everySize: true },
  '/signup': { who: 'nobody', everySize: true },
  '/signup/customer': { who: 'nobody' },
  '/forgot': { who: 'nobody' },
  '/confirm-email': { who: 'nobody' },
  '/offline': { who: 'nobody' },

  // The chooser asks which workshop somebody is in, and only ever appears for
  // a person on more than one team (Phase 63). This probe's people are on one,
  // so the page correctly enters it and redirects: what would be measured here
  // is the dashboard, wearing another address's name. Held by
  // `verify-belonging.ts` instead, where a person with two memberships exists.
  '/choose': {
    unmeasured:
      'only rendered for somebody on more than one workshop’s team; this probe’s people are on one, so it redirects',
  },

  // The one place an invented token measures the real thing. This page is
  // built to render identically whether the token is live or not, because mail
  // scanners follow every link in a message before a person sees it; so the
  // layout under an invented token is the layout under a real one.
  '/reset/[token]': { who: 'nobody', path: () => '/reset/not-a-real-reset-token' },

  // Opening this with a live token spends it. What is measured is the refusal,
  // which is the screen somebody sees when they follow an old link out of an
  // inbox, and the one they are most likely to see.
  '/verify-email/[token]': { who: 'nobody', path: () => '/verify-email/not-a-real-verification' },

  '/invite/[token]': { who: 'nobody', path: (r) => r.inviteLink },
  '/handover/[token]': { who: 'nobody', path: (r) => r.handoverLink },

  /* --- what a customer opens on a telephone ------------------------------- */
  '/p/[token]': { who: 'nobody', path: (r) => r.passportLink, everySize: true },
  '/e/[token]': { who: 'nobody', path: (r) => r.estimateLink },
  '/r/[token]': { who: 'nobody', path: (r) => r.reviewLink },
  // Not an invoice: the identifier here is an attempt to pay one, which the
  // card provider hands back. The first version of this plan passed an invoice
  // and read the 404 as a fault in the page.
  '/pay/[id]': {
    who: 'nobody',
    path: (r) =>
      r.paymentAttempt
        ? `/pay/${r.paymentAttempt}`
        : {
            because:
              'nobody on this database has tried to pay by card, so there is no attempt to draw',
          },
  },
  '/pay/subscribe/[orgId]': {
    who: 'nobody',
    path: (r) =>
      r.subscribedOrg
        ? `/pay/subscribe/${r.subscribedOrg}`
        : { because: 'no workshop on this database has a subscription with the stub provider' },
  },

  /* --- the customer's own side -------------------------------------------- */
  '/portal/(home)': { who: 'driver', everySize: true, alsoArabic: true },
  '/portal/book': { who: 'driver' },
  '/portal/claim': { who: 'driver' },
  '/portal/invoices': { who: 'driver' },
  '/portal/passports': { who: 'driver' },
  '/portal/rewards': { who: 'driver' },
  '/portal/settings': { who: 'driver' },
  '/portal/updates': { who: 'driver' },
  '/portal/workshops': { who: 'driver' },
  '/portal/estimates/[id]': { who: 'driver', path: (r) => `/portal/estimates/${r.estimate}` },
  // The driver's own car, not one the workshop happens to have seen. A car
  // somebody no longer owns is not theirs to read, which is the promise the
  // passport makes to whoever bought it — and which answered 404 when this
  // plan handed the portal the workshop's vehicle.
  '/portal/vehicles/[id]': {
    who: 'driver',
    path: (r) =>
      r.driversVehicle
        ? `/portal/vehicles/${r.driversVehicle}`
        : { because: 'the seeded customer with a login owns no vehicle' },
  },
  '/portal/vehicles/[id]/passport': {
    who: 'driver',
    path: (r) =>
      r.driversVehicle
        ? `/portal/vehicles/${r.driversVehicle}/passport`
        : { because: 'the seeded customer with a login owns no vehicle' },
  },

  /* --- the day ------------------------------------------------------------ */
  '/(workshop)/dashboard': { who: 'owner', everySize: true, alsoArabic: true },
  '/(workshop)/diary': { who: 'owner', everySize: true },
  '/(workshop)/now': { who: 'owner', everySize: true },
  '/(workshop)/floor': { who: 'owner', everySize: true },
  '/(workshop)/plan': { who: 'owner' },
  '/(workshop)/capacity': { who: 'owner' },
  '/(workshop)/start': { who: 'owner', everySize: true, alsoArabic: true },
  '/(workshop)/help': { who: 'owner', everySize: true, alsoArabic: true },
  '/(workshop)/help/[slug]': { who: 'owner', path: () => '/help/invoices-and-payments' },
  '/(workshop)/search': { who: 'owner', path: () => '/search?q=Pennine&all=1' },
  '/(workshop)/ask': { who: 'owner' },
  '/(workshop)/inbox': { who: 'owner' },
  '/(workshop)/messages': { who: 'owner' },
  '/(workshop)/notifications': { who: 'owner' },
  '/(workshop)/group': { who: 'owner' },

  /* --- jobs --------------------------------------------------------------- */
  '/(workshop)/jobs': { who: 'owner', everySize: true, alsoArabic: true },
  '/(workshop)/jobs/new': { who: 'owner' },
  '/(workshop)/jobs/[id]': { who: 'owner', path: (r) => `/jobs/${r.job}` },
  '/(workshop)/jobs/[id]/check-in': { who: 'owner', path: (r) => `/jobs/${r.job}/check-in` },
  '/(workshop)/jobs/[id]/check-out': { who: 'owner', path: (r) => `/jobs/${r.job}/check-out` },
  '/(workshop)/bookings/new': { who: 'owner' },
  '/(workshop)/bookings/[id]': { who: 'owner', path: (r) => `/bookings/${r.booking}` },
  '/(workshop)/inspections': { who: 'owner' },
  '/(workshop)/estimates': { who: 'owner' },
  '/(workshop)/warranty': { who: 'owner' },
  '/(workshop)/claims': { who: 'owner' },
  '/(workshop)/recalls': { who: 'owner' },
  '/(workshop)/patterns': { who: 'owner' },

  /* --- customers and cars -------------------------------------------------- */
  '/(workshop)/customers': { who: 'owner' },
  '/(workshop)/customers/new': { who: 'owner' },
  '/(workshop)/customers/[id]': { who: 'owner', path: (r) => `/customers/${r.customer}` },
  '/(workshop)/customers/[id]/edit': { who: 'owner', path: (r) => `/customers/${r.customer}/edit` },
  '/(workshop)/vehicles': { who: 'owner' },
  '/(workshop)/vehicles/find': { who: 'owner' },
  '/(workshop)/vehicles/[id]': { who: 'owner', path: (r) => `/vehicles/${r.vehicle}` },
  '/(workshop)/vehicles/[id]/condition': {
    who: 'owner',
    path: (r) => `/vehicles/${r.vehicle}/condition`,
  },
  '/(workshop)/vehicles/[id]/passport': {
    who: 'owner',
    path: (r) => `/vehicles/${r.vehicle}/passport`,
  },
  '/(workshop)/vehicles/[id]/report': {
    who: 'owner',
    path: (r) => `/vehicles/${r.vehicle}/report`,
  },
  '/(workshop)/vehicles/[id]/transfer': {
    who: 'owner',
    path: (r) => `/vehicles/${r.vehicle}/transfer`,
  },
  '/(workshop)/passports': { who: 'owner' },
  '/(workshop)/fleet': { who: 'owner' },
  '/(workshop)/fleet/[id]': { who: 'owner', path: (r) => `/fleet/${r.fleet}` },
  '/(workshop)/crm': { who: 'owner' },
  '/(workshop)/reminders': { who: 'owner' },
  '/(workshop)/reputation': { who: 'owner' },
  '/(workshop)/automation': { who: 'owner' },

  /* --- money -------------------------------------------------------------- */
  '/(workshop)/invoices': { who: 'owner', everySize: true, alsoArabic: true },
  '/(workshop)/invoices/[id]': { who: 'owner', path: (r) => `/invoices/${r.invoice}` },
  '/(workshop)/payments': { who: 'owner' },
  '/(workshop)/payments/card': { who: 'owner' },
  '/(workshop)/payments/[id]/receipt': {
    who: 'owner',
    path: (r) => `/payments/${r.payment}/receipt`,
  },
  '/(workshop)/counter': { who: 'owner', everySize: true, alsoArabic: true },
  '/(workshop)/coupons': { who: 'owner' },
  '/(workshop)/gift-cards': { who: 'owner' },
  '/(workshop)/gift-cards/[id]': { who: 'owner', path: (r) => `/gift-cards/${r.giftCard}` },
  '/(workshop)/books': { who: 'owner' },
  '/(workshop)/ledger': { who: 'owner' },
  '/(workshop)/financials': { who: 'owner' },
  '/(workshop)/banking': { who: 'owner' },
  '/(workshop)/expenses': { who: 'owner' },
  '/(workshop)/payables': { who: 'owner' },
  '/(workshop)/reports': { who: 'owner' },
  '/(workshop)/reports/business': { who: 'owner' },
  '/(workshop)/reports/clock': { who: 'owner' },
  '/(workshop)/reports/tax': { who: 'owner', path: () => '/reports/tax?range=year' },
  '/(workshop)/reports/uptake': { who: 'owner' },
  '/(workshop)/insights': { who: 'owner' },

  /* --- parts -------------------------------------------------------------- */
  '/(workshop)/parts': { who: 'owner', everySize: true },
  '/(workshop)/parts/new': { who: 'owner' },
  '/(workshop)/parts/[id]': { who: 'owner', path: (r) => `/parts/${r.product}` },
  '/(workshop)/purchasing': { who: 'owner' },
  '/(workshop)/purchasing/new': { who: 'owner' },
  '/(workshop)/purchasing/returns': { who: 'owner' },
  '/(workshop)/purchasing/[id]': { who: 'owner', path: (r) => `/purchasing/${r.purchaseOrder}` },
  '/(workshop)/suppliers': { who: 'owner' },
  '/(workshop)/suppliers/new': { who: 'owner' },
  '/(workshop)/suppliers/[id]': { who: 'owner', path: (r) => `/suppliers/${r.supplier}` },
  '/(workshop)/transfers': { who: 'owner' },
  '/(workshop)/transfers/[id]': { who: 'owner', path: (r) => `/transfers/${r.transfer}` },

  /* --- the workshop itself ------------------------------------------------- */
  '/(workshop)/people': { who: 'owner' },
  '/(workshop)/people/[id]': { who: 'owner', path: (r) => `/people/${r.person}` },
  '/(workshop)/skills': { who: 'owner' },
  '/(workshop)/payroll': { who: 'owner' },
  '/(workshop)/audit': { who: 'owner' },
  '/(workshop)/audit/[type]/[id]': { who: 'owner', path: (r) => `/audit/Job/${r.job}` },
  '/(workshop)/settings': { who: 'owner' },
  '/(workshop)/settings/site': { who: 'owner' },
  '/(workshop)/settings/organisation': { who: 'owner' },
  '/(workshop)/settings/catalogue': { who: 'owner' },
  '/(workshop)/settings/specifications': { who: 'owner' },
  '/(workshop)/equipment': { who: 'owner' },
  '/(workshop)/scan': { who: 'owner' },
  '/(workshop)/equipment/[id]': {
    who: 'owner',
    path: (r) => `/equipment/${r.equipment}`,
  },
  '/(workshop)/settings/packages': { who: 'owner' },
  '/(workshop)/settings/courtesy': { who: 'owner' },
  '/(workshop)/settings/team': { who: 'owner' },
  '/(workshop)/settings/subscription': { who: 'owner' },
  '/(workshop)/settings/data': { who: 'owner' },
  '/(workshop)/settings/data/[id]': { who: 'owner', path: (r) => `/settings/data/${r.import}` },

  /* --- and the two that are not a workshop's ------------------------------- */
  '/admin/health': { who: 'operator' },
  '/print/[kind]/[id]': {
    unmeasured:
      'drawn for a sheet of paper at a fixed width rather than for a window, so the rules measured here — nothing wider than the screen, nothing under forty pixels to press — are the wrong rules for it. What matters about a printed document is checked by verify-paper.ts instead: that it prints, that the navigation and the buttons fall away, and that it is drawn light whatever the theme.',
  },
};

/* ---------------------------------------------------------------------------
   The records a bracket is filled in with
   --------------------------------------------------------------------------- */

/** So everything this run creates can be found again and taken away. */
const TAG = 'screens-probe';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * A link whose token is the credential, made for this run.
 *
 * Measured with a live token rather than an invented one wherever the live one
 * shows something: a shared passport, an estimate to approve, a car being
 * handed over. These are screens a customer opens on a telephone in a car
 * park, and a refusal page is not what they see.
 */
async function link(
  made: (token: string) => Promise<void>,
  at: (token: string) => string,
): Promise<string> {
  const token = randomBytes(24).toString('base64url');
  await made(token);
  return at(token);
}

async function identifiersOf(orgId: string): Promise<Ids> {
  // A seeded workshop has most kinds of record but not all, and a page with
  // nothing to show is a page this probe would quietly not measure. The
  // missing ones are made here and taken away at the end.
  const anyCustomer = await prisma.customer.findFirstOrThrow({
    where: { orgId },
    select: { id: true },
  });

  if (!(await prisma.fleetAgreement.findFirst({ where: { orgId } }))) {
    const spare = await prisma.customer.findFirst({
      where: { orgId, fleetAgreement: null },
      select: { id: true },
    });
    if (spare)
      await prisma.fleetAgreement.create({ data: { orgId, customerId: spare.id, notes: TAG } });
  }

  if (!(await prisma.giftCard.findFirst({ where: { orgId } }))) {
    await prisma.giftCard.create({
      data: {
        orgId,
        code: `SCREENS-${randomBytes(3).toString('hex').toUpperCase()}`,
        amount: 25,
        note: TAG,
      },
    });
  }

  if (!(await prisma.importBatch.findFirst({ where: { orgId } }))) {
    await prisma.importBatch.create({
      data: {
        orgId,
        dataset: 'customers',
        fileName: `${TAG}.csv`,
        headers: ['name'],
        rows: [],
        rowCount: 0,
      },
    });
  }

  const need = async <T>(value: Promise<T | null>, what: string): Promise<T> => {
    const row = await value;
    if (!row) throw new Error(`nothing to measure: the seeded workshop has no ${what}`);
    return row;
  };

  const [
    booking,
    equipment,
    estimate,
    fleet,
    giftCard,
    imported,
    inspection,
    invoice,
    job,
    payment,
    person,
    product,
    purchaseOrder,
    supplier,
    transfer,
    access,
  ] = await Promise.all([
    need(prisma.booking.findFirst({ where: { orgId }, select: { id: true } }), 'booking'),
    need(prisma.equipment.findFirst({ where: { orgId }, select: { id: true } }), 'machine'),
    need(prisma.estimate.findFirst({ where: { orgId }, select: { id: true } }), 'estimate'),
    need(prisma.fleetAgreement.findFirst({ where: { orgId }, select: { id: true } }), 'fleet'),
    need(prisma.giftCard.findFirst({ where: { orgId }, select: { id: true } }), 'gift card'),
    need(prisma.importBatch.findFirst({ where: { orgId }, select: { id: true } }), 'import'),
    need(
      prisma.inspection.findFirst({ where: { job: { orgId } }, select: { id: true } }),
      'inspection',
    ),
    need(prisma.invoice.findFirst({ where: { orgId }, select: { id: true } }), 'invoice'),
    need(
      prisma.job.findFirst({ where: { orgId, status: 'IN_PROGRESS' }, select: { id: true } }),
      'job in progress',
    ),
    need(prisma.payment.findFirst({ where: { orgId }, select: { id: true } }), 'payment'),
    need(prisma.employee.findFirst({ where: { orgId }, select: { id: true } }), 'employee'),
    need(prisma.product.findFirst({ where: { orgId }, select: { id: true } }), 'part'),
    need(
      prisma.purchaseOrder.findFirst({ where: { orgId }, select: { id: true } }),
      'purchase order',
    ),
    need(prisma.supplier.findFirst({ where: { orgId }, select: { id: true } }), 'supplier'),
    need(prisma.stockTransfer.findFirst({ where: { orgId }, select: { id: true } }), 'transfer'),
    need(
      prisma.vehicleAccessGrant.findFirst({ where: { orgId }, select: { vehicleId: true } }),
      'vehicle it has seen',
    ),
  ]);

  const vehicle = access.vehicleId;
  const week = new Date(Date.now() + 7 * 86_400_000);

  const passportLink = await link(
    async (token) => {
      await prisma.passportShare.create({
        data: { vehicleId: vehicle, tokenHash: digest(token), label: TAG, expiresAt: week },
      });
    },
    (token) => `/p/${token}`,
  );

  const estimateLink = await link(
    async (token) => {
      await prisma.estimateShare.create({
        data: {
          estimateId: estimate.id,
          tokenHash: digest(token),
          channel: 'EMAIL',
          sentTo: `${TAG}@carnet.test`,
          expiresAt: week,
        },
      });
    },
    (token) => `/e/${token}`,
  );

  const unreviewed = await prisma.job.findFirst({
    where: { orgId, reviewRequest: { is: null } },
    select: { id: true, customerId: true },
  });

  const reviewLink = await link(
    async (token) => {
      if (!unreviewed) return;
      await prisma.reviewRequest.create({
        data: {
          orgId,
          jobId: unreviewed.id,
          customerId: unreviewed.customerId,
          tokenHash: digest(token),
          expiresAt: week,
          comment: TAG,
        },
      });
    },
    (token) => (unreviewed ? `/r/${token}` : '/r/no-job-left-to-ask-about'),
  );

  // A car cannot be promised to two people at once, so the one used here is a
  // car with an owner and nobody waiting for it. Choosing rather than assuming:
  // the first run of this probe took the first car it found and the second run
  // fell over on the constraint, which is the database being right.
  const handing = await prisma.vehicleOwnership.findFirst({
    where: {
      endedAt: null,
      vehicle: {
        accessGrants: { some: { orgId } },
        handovers: { none: { status: 'PENDING' } },
      },
    },
    select: { id: true, vehicleId: true },
  });

  const handoverLink = await link(
    async (token) => {
      if (!handing) return;
      await prisma.handoverInvitation.create({
        data: {
          vehicleId: handing.vehicleId,
          orgId,
          fromOwnershipId: handing.id,
          toName: TAG,
          tokenHash: digest(token),
          soldOn: new Date(),
          expiresAt: week,
        },
      });
    },
    (token) => (handing ? `/handover/${token}` : '/handover/nobody-to-hand-it-to'),
  );

  const inviteLink = await link(
    async (token) => {
      await prisma.invitation.create({
        data: {
          orgId,
          email: `${TAG}@carnet.test`,
          role: 'TECHNICIAN',
          tokenHash: digest(token),
          expiresAt: week,
        },
      });
    },
    (token) => `/invite/${token}`,
  );

  // The customer whose login the portal is measured through, and the car they
  // own. The two have to be the same person: a car somebody no longer owns is
  // not theirs to read, so handing the portal a vehicle the workshop happened
  // to have seen answers 404 and reads as a fault in the page.
  const driversCar = await prisma.vehicleOwnership.findFirst({
    where: { endedAt: null, owner: { isNot: null } },
    select: { vehicleId: true, owner: { select: { email: true } } },
  });

  const anyDriver = driversCar
    ? { email: driversCar.owner!.email }
    : await prisma.customer
        .findFirstOrThrow({
          where: { portalUserId: { not: null } },
          select: { portalUser: { select: { email: true } } },
        })
        .then((row) => ({ email: row.portalUser!.email }));

  const [attempt, subscribed] = await Promise.all([
    prisma.paymentAttempt.findFirst({ where: { orgId }, select: { id: true } }),
    prisma.organization.findFirst({
      where: { billingSubscriptionRef: { not: null } },
      select: { id: true },
    }),
  ]);

  return {
    paymentAttempt: attempt?.id ?? null,
    subscribedOrg: subscribed?.id ?? null,
    driversVehicle: driversCar?.vehicleId ?? null,
    driverEmail: anyDriver.email,
    orgId,
    booking: booking.id,
    customer: anyCustomer.id,
    equipment: equipment.id,
    estimate: estimate.id,
    fleet: fleet.id,
    giftCard: giftCard.id,
    import: imported.id,
    inspection: inspection.id,
    invoice: invoice.id,
    job: job.id,
    payment: payment.id,
    person: person.id,
    product: product.id,
    purchaseOrder: purchaseOrder.id,
    supplier: supplier.id,
    transfer: transfer.id,
    vehicle,
    passportLink,
    estimateLink,
    reviewLink,
    handoverLink,
    inviteLink,
  };
}

/**
 * Everything this run made, taken away again.
 *
 * The Phase 53 lesson, which cost two days of confusion the first time: a
 * probe that leaves its own records behind is a probe whose second run
 * measures something different from its first.
 */
async function forget(orgId: string) {
  await prisma.passportShare.deleteMany({ where: { label: TAG } });
  await prisma.estimateShare.deleteMany({ where: { sentTo: `${TAG}@carnet.test` } });
  await prisma.reviewRequest.deleteMany({ where: { orgId, comment: TAG } });
  await prisma.handoverInvitation.deleteMany({ where: { orgId, toName: TAG } });
  await prisma.invitation.deleteMany({ where: { orgId, email: `${TAG}@carnet.test` } });
  await prisma.fleetAgreement.deleteMany({ where: { orgId, notes: TAG } });
  await prisma.giftCard.deleteMany({ where: { orgId, note: TAG } });
  await prisma.importBatch.deleteMany({ where: { orgId, fileName: `${TAG}.csv` } });
  await prisma.session.deleteMany({ where: { tokenHash: { in: tokens } } });
}

/**
 * The operator's own page needs an operator, and an operator is a person.
 *
 * An account that is already there belongs to somebody, and this probe does
 * not sign in as anybody real in order to measure a layout. Where none exists
 * it makes one, uses it and deletes it — so the page is measured on a
 * continuous-integration database and declared unmeasured on a real one.
 */
async function operatorSession(): Promise<{ token: string; made: string } | string> {
  const address = process.env.OPERATOR_EMAIL?.trim().toLowerCase();
  if (!address) return 'OPERATOR_EMAIL is not set, so nobody is the operator';

  if (await prisma.user.findUnique({ where: { email: address } })) {
    return 'the operator account on this database belongs to a person, and this probe does not sign in as anybody real';
  }

  const operator = await prisma.user.create({
    data: {
      email: address,
      name: 'Operator',
      passwordHash: `not-a-usable-hash-${randomBytes(8).toString('hex')}`,
    },
  });

  return { token: await mintFor(operator.id, null), made: operator.id };
}

async function main() {
  console.info(`\n  Every screen at every size\n  ${BASE}\n`);

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });

  // Anything an interrupted run left behind, before anything else. A probe
  // that only tidies up on the way out is a probe that cannot be stopped.
  await forget(org.id);

  const ids = await identifiersOf(org.id);

  const asOperator = await operatorSession();
  const operatorMade = typeof asOperator === 'string' ? null : asOperator.made;

  const sessions: Record<Who, string | null> = {
    nobody: null,
    owner: await mint('ahmed@hillsidemotors.test'),
    driver: await mint(ids.driverEmail),
    operator: typeof asOperator === 'string' ? null : asOperator.token,
  };

  /* --- every address is decided about ------------------------------------- */

  const routes = everyRoute();
  const undeclared = routes.filter((route) => !PLAN[route]);
  const stale = Object.keys(PLAN).filter((route) => !routes.includes(route));

  if (undeclared.length > 0) {
    fail(
      'every screen is decided about',
      `${undeclared.join(', ')} — measure it, or say in verify-screens.ts why it is not`,
    );
  }

  if (stale.length > 0) {
    fail('the plan names no screen that no longer exists', stale.join(', '));
  }

  const pages: { path: string; who: Who; lang?: 'ar'; everySize?: boolean }[] = [];
  const skipped: [string, string][] = [];

  for (const route of routes) {
    const plan = PLAN[route];
    if (!plan) continue;

    if (plan.unmeasured) {
      skipped.push([visible(route), plan.unmeasured]);
      continue;
    }

    const who = plan.who ?? 'nobody';

    if (who === 'operator' && sessions.operator === null) {
      skipped.push([visible(route), typeof asOperator === 'string' ? asOperator : 'no operator']);
      continue;
    }

    const where = plan.path ? plan.path(ids) : visible(route);

    if (typeof where !== 'string') {
      skipped.push([visible(route), where.because]);
      continue;
    }

    pages.push({ path: where, who, everySize: plan.everySize });

    // Right to left means right to left. A layout that only holds together in
    // one direction holds together by accident.
    if (plan.alsoArabic) pages.push({ path: where, who, lang: 'ar' });
  }

  console.info(`  ${routes.length} addresses: ${pages.length} measured, ${skipped.length} not\n`);

  for (const [path, why] of skipped) {
    console.info(`  --     ${path}`);
    console.info(`         ${why}`);
  }

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
      const session = sessions[entry.who];
      if (session) cookies.push({ name: 'carnet_session', value: session, url: BASE });
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

        // A page that fell over is not a page that fits. Under a loading
        // boundary the shell is already sent by the time the page throws, so
        // the status says 200 and the error arrives inside it — and an error
        // screen is short, tidy and passes every measurement here.
        //
        // This is the Phase 51 lesson arriving a second time. There, a broken
        // query made a page take eleven seconds to render an error and the
        // first reading was "that page is slow". Here, a broken ledger query
        // made /ledger render an error and the first reading was "ok".
        const wording = await page.evaluate(() => document.body.innerText.slice(0, 4000));

        if (BROKEN.some((marker) => wording.includes(marker))) {
          fail(
            `${name} @ ${size.width}`,
            'answered 200 with an error on it, so nothing was measured',
          );
          continue;
        }
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
  await forget(org.id);
  if (operatorMade) await prisma.user.delete({ where: { id: operatorMade } });

  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
