/**
 * Finds controls that do nothing, and links that go nowhere.
 *
 *   npx tsx infra/scripts/verify-controls.ts [baseUrl]
 *
 * Written because the same defect kept turning up by hand. Four times in one
 * week a button was found with nothing behind it: "Share with a buyer" and
 * "Book a service" on the customer's own page, "Add photo" and "Request part"
 * on the technician's tablet, and a link to an inspection route that had never
 * existed. Each was found by somebody happening to press it.
 *
 * A button that does nothing is worse than a missing feature. A missing
 * feature is understood; a button that responds to nothing makes a person
 * believe they have done something they have not, and the first they learn
 * otherwise is when the customer rings.
 *
 * Two checks. A submit control has to sit inside a form that goes somewhere,
 * and a link has to point at something that answers. Client components with
 * their own handlers are named in ALLOWED below rather than guessed at, so
 * adding one is a deliberate act.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

const BASE = process.argv[2] ?? 'http://localhost:3000';

let failures = 0;
let checked = 0;

function fail(page: string, problem: string, detail = '') {
  console.info(`  FAIL  ${page}  ${problem}${detail ? `: ${detail}` : ''}`);
  failures += 1;
}

/**
 * Buttons whose behaviour lives in a client component rather than a form.
 *
 * Matched on the visible text. Deliberately a short list: anything not here is
 * treated as dead, so the way to add one is to decide to.
 */
const ALLOWED = [
  // The theme toggle's three states, each with its own onClick.
  'Light',
  'Dark',
  'Auto',
  // The sidebar's own open and close control on a narrow screen.
  'Open navigation',
  'Close navigation',
  // The years on the home page's vehicle, which select an entry on its record.
  // Each is a real button with a handler in a client component, and each is
  // also what makes that scene readable without the canvas.
  // The diary's own move menu on each card, which is the keyboard route to
  // the same thing dragging does.
  'Move',
  '2022',
  '2023',
  'Mar 2024',
  'Sep 2024',
];

const PAGES = [
  '/dashboard',
  '/diary',
  '/jobs',
  '/customers',
  '/vehicles',
  '/passports',
  '/vehicles/find',
  '/vehicles/find?q=ZZ99+ZZZ',
  '/vehicles/find?q=MK20+XRT',
  '/estimates',
  '/invoices',
  '/payments',
  '/payments/card',
  '/gift-cards',
  '/reports',
  '/reports/business',
  '/insights',
  '/inspections',
  '/floor',
  '/warranty',
  '/recalls',
  '/capacity',
  '/plan',
  '/skills',
  '/patterns',
  '/audit',
  '/fleet',
  '/reputation',
  '/inbox',
  '/claims',
  '/payables',
  '/payroll',
  '/ask',
  '/ask?q=What+did+we+take+this+month%3F',
  '/bookings/new',
  '/suppliers/new',
  '/counter',
  '/parts',
  '/suppliers',
  '/purchasing',
  '/transfers',
  '/people',
  '/reminders',
  '/crm',
  '/ledger',
  '/financials',
  '/expenses',
  '/banking',
  '/settings',
  '/settings/team',
  '/settings/organisation',
  '/settings/subscription',
  '/settings/data',
  '/settings/site',
  '/settings/catalogue',
  '/settings/packages',
  '/automation',
  '/messages',
  '/audit',
  '/group',
];

const PUBLIC_PAGES = [
  '/',
  '/pricing',
  '/signup',
  '/signup/customer',
  '/login',
  '/forgot',
  '/p/demo-share-token',
];

/**
 * The mark Next.js leaves in a streamed response when `notFound()` was called.
 *
 * Not the visible words on the not-found screen: those are present in every
 * page's payload, because the framework ships the not-found boundary with each
 * layout so a client-side navigation can render it. What distinguishes a page
 * that actually threw is the framework's own error digest for it, which only
 * appears when the segment was replaced. Measured against a real page and a
 * dead one before being relied on: zero occurrences on the first, several on
 * the second.
 */
const NOT_FOUND_MARKER = 'NEXT_HTTP_ERROR_FALLBACK;404';

/**
 * The marks a streamed response carries when the page threw after the shell
 * had already gone out.
 *
 * The shell and the loading skeleton arrive as visible markup with a 200; the
 * page itself then fails inside the stream, and what the reader gets is a
 * spinner that never resolves. Found the day a dev server was still holding a
 * Prisma client from before a migration: every new page rendered its shell,
 * threw on a model the old client did not know, and the crawler read a 200 and
 * called it fine. In production the failure is a bare error digest; in
 * development it is the message itself.
 */
const RENDER_ERROR_MARKERS = ['"digest":"', 'Cannot read properties of undefined', 'TypeError:'];

/** Strips the React payload Next.js inlines, which carries the markup again. */
function withoutScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
}

/**
 * Every button, with whether a form encloses it.
 *
 * Done by walking the tags in order and tracking form depth, because a regex
 * cannot match nesting and pairing every button with its ancestor is exactly
 * the question being asked.
 */
function deadButtons(html: string): string[] {
  const dead: string[] = [];

  let depth = 0;
  const pattern = /<(\/?)(form|button)\b([^>]*)>/gi;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const closing = match[1] === '/';
    const tag = (match[2] ?? '').toLowerCase();
    const attributes = match[3] ?? '';

    if (tag === 'form') {
      depth += closing ? -1 : 1;
      continue;
    }

    if (closing) continue;

    // A disabled control is inert on purpose and says so to a screen reader.
    if (/\bdisabled\b/i.test(attributes)) continue;

    // A button that declares its own state (pressed, expanded) is a client
    // control by definition: nothing but a handler could change that state.
    // The passport booklet's open control and its stamps are these.
    if (/\baria-(pressed|expanded)=/i.test(attributes)) continue;

    const end = html.indexOf('</button>', pattern.lastIndex);
    const label = html
      .slice(pattern.lastIndex, end === -1 ? pattern.lastIndex : end)
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (depth > 0) continue;
    if (ALLOWED.some((allowed) => label === allowed)) continue;

    // A button that is the whole content of a link is a link wearing a
    // button's clothes, and the link is what carries the behaviour.
    const before = html.slice(Math.max(0, match.index - 400), match.index);
    if (/<a\b[^>]*href=[^>]*>\s*$/i.test(before)) continue;

    dead.push(label || '(no label)');
  }

  return dead;
}

/** Every internal link on the page, deduplicated. */
function linksIn(html: string): string[] {
  const found = new Set<string>();

  for (const match of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)) {
    const href = match[1] ?? '';

    if (!href.startsWith('/')) continue;
    if (href.startsWith('/api/')) continue;

    found.add(href.split('#')[0] ?? href);
  }

  return [...found];
}

async function main() {
  console.info(`\n  Controls and links\n  ${BASE}\n`);

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
    include: { memberships: true },
  });

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');

  await prisma.session.create({
    data: {
      tokenHash,
      userId: user.id,
      orgId: user.memberships[0]?.orgId ?? null,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  const cookie = `carnet_session=${token}`;
  const linkTargets = new Map<string, string>();

  for (const path of [...PUBLIC_PAGES, ...PAGES]) {
    const response = await fetch(`${BASE}${path}`, {
      headers: PUBLIC_PAGES.includes(path) ? {} : { cookie },
    });

    if (response.status !== 200) {
      fail(path, 'did not render', String(response.status));
      continue;
    }

    checked += 1;

    const raw = await response.text();

    const errored = RENDER_ERROR_MARKERS.find((marker) => raw.includes(marker));
    if (errored) {
      fail(path, 'rendered its shell and then threw inside the stream', errored);
      continue;
    }

    const html = withoutScripts(raw);

    const dead = deadButtons(html);

    if (dead.length > 0) {
      fail(path, `${dead.length} control(s) with nothing behind them`, dead.join(', '));
    }

    for (const link of linksIn(html)) {
      if (!linkTargets.has(link)) linkTargets.set(link, path);
    }
  }

  console.info(`\n  ${checked} pages read. ${linkTargets.size} distinct links to follow.\n`);

  for (const [link, from] of linkTargets) {
    const response = await fetch(`${BASE}${link}`, {
      headers: { cookie },
      redirect: 'manual',
    });

    // A redirect is a real answer: it is how a role without permission is sent
    // somewhere it can use. A redirect to the sign-in page is not, because the
    // session above is a real one, and anything sending it to /login is a
    // route that does not exist behind a guard.
    if (response.status >= 300 && response.status < 400) {
      const to = response.headers.get('location') ?? '';
      if (to.includes('/login')) {
        fail(from, 'links somewhere that sends a signed-in person to sign in again', link);
      }
      continue;
    }

    if (response.status !== 200) {
      fail(from, 'links somewhere that does not exist', `${link} -> ${response.status}`);
      continue;
    }

    // A 200 is not proof the page exists.
    //
    // `notFound()` inside a server component renders the not-found screen, and
    // by the time it is called the response has usually already been committed
    // as 200. So a link to a route that does not exist answers 200 and this
    // check passed. That is exactly how `/jobs/new` and `/customers/new` both
    // reached production as buttons that led to an error page: the crawler
    // followed them, got a 200, and said everything was fine.
    //
    // The body is what tells the truth, so the body is what is read. The raw
    // body, not the stripped one: the shell arrives first as visible markup,
    // and the not-found screen arrives afterwards inside the streamed payload
    // that lives in script tags. Stripping those would strip the evidence.
    const body = await response.text();

    if (body.includes(NOT_FOUND_MARKER)) {
      fail(from, 'links to a page that does not exist', `${link} -> not found`);
      continue;
    }
  }

  await prisma.session.deleteMany({ where: { tokenHash } });

  console.info(
    `\n  ${failures === 0 ? 'Every control does something and every link goes somewhere.' : `${failures} problem(s).`}\n`,
  );

  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
