/**
 * The things a page has to get right for somebody not using a mouse.
 *
 *   npx tsx infra/scripts/verify-access.ts [baseUrl]
 *
 * Not a substitute for using a screen reader, which is the only way to know
 * whether a page makes sense. What it does catch is the mechanical half:
 * inputs with no label, buttons with no name, images with no alternative,
 * headings that skip a level, and pages missing a landmark or a skip link.
 *
 * These are the failures that accumulate silently, because everything looks
 * fine to whoever is building it.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

const BASE = process.argv[2] ?? 'http://localhost:3000';

let failures = 0;
let checked = 0;

function fail(page: string, problem: string, detail?: string) {
  console.info(`  FAIL  ${page}  ${problem}${detail ? `: ${detail}` : ''}`);
  failures += 1;
}

const PAGES = [
  '/dashboard',
  '/diary',
  '/jobs',
  '/customers',
  '/vehicles',
  '/estimates',
  '/invoices',
  '/payments',
  '/reports',
  '/reports/business',
  '/counter',
  '/parts',
  '/suppliers',
  '/purchasing',
  '/transfers',
  '/people',
  '/reminders',
  '/crm',
  '/automation',
  '/messages',
  '/insights',
  '/inspections',
  '/floor',
  '/warranty',
  '/recalls',
  '/fleet',
  '/bookings/new',
  '/suppliers/new',
  '/ledger',
  '/financials',
  '/expenses',
  '/banking',
  '/settings',
  '/settings/team',
  '/audit',
];

const PUBLIC_PAGES = [
  '/',
  '/pricing',
  '/signup',
  '/login',
  '/p/demo-share-token',
  '/e/demo-estimate-token',
];

/* --- the checks ------------------------------------------------------------ */

/** An input with no label is a box nobody can identify by ear. */
function unlabelledInputs(html: string): string[] {
  const problems: string[] = [];

  const inputs = html.match(/<(input|select|textarea)\b[^>]*>/gi) ?? [];

  for (const tag of inputs) {
    const type = tag.match(/type="([^"]+)"/i)?.[1]?.toLowerCase() ?? 'text';
    if (['hidden', 'submit', 'button'].includes(type)) continue;

    const hasAria = /aria-label(?:ledby)?=/i.test(tag);
    const id = tag.match(/\bid="([^"]+)"/i)?.[1];
    const labelled = id ? new RegExp(`<label[^>]*for="${id}"`, 'i').test(html) : false;

    // A control wrapped in its own <label> is labelled too, and that is the
    // pattern this codebase uses.
    const wrapped = /<label[^>]*>[\s\S]{0,400}?<(input|select|textarea)/i.test(html);

    if (!hasAria && !labelled && !wrapped) {
      problems.push(tag.slice(0, 60));
    }
  }

  return problems;
}

/** A button with no text and no label is unreachable by ear. */
function namelessButtons(html: string): string[] {
  const problems: string[] = [];

  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)) {
    const attributes = match[1] ?? '';
    const inner = match[2] ?? '';

    const hasAria = /aria-label=/i.test(attributes) || /title=/i.test(attributes);
    const hasText = inner.replace(/<[^>]+>/g, '').trim().length > 0;
    const hasScreenReaderText = /class="[^"]*sr-only/i.test(inner);

    if (!hasAria && !hasText && !hasScreenReaderText) {
      problems.push(attributes.slice(0, 60));
    }
  }

  return problems;
}

/** Every image needs an alternative, even if it is empty for decoration. */
function imagesWithoutAlt(html: string): string[] {
  return (html.match(/<img\b[^>]*>/gi) ?? [])
    .filter((tag) => !/\balt=/i.test(tag))
    .map((tag) => tag.slice(0, 60));
}

/**
 * A decorative SVG has to be hidden, or a screen reader reads its title and
 * paths as content in the middle of a sentence.
 */
function exposedDecorativeSvgs(html: string): number {
  const svgs = html.match(/<svg\b[^>]*>/gi) ?? [];
  return svgs.filter((tag) => !/aria-hidden/i.test(tag) && !/role="img"/i.test(tag)).length;
}

/** Exactly one h1, and no level skipped on the way down. */
function headingProblems(html: string): string[] {
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  const problems: string[] = [];

  const h1s = levels.filter((level) => level === 1).length;
  if (h1s === 0) problems.push('no h1');
  if (h1s > 1) problems.push(`${h1s} h1 elements`);

  for (const [index, level] of levels.entries()) {
    const previous = levels[index - 1];
    if (previous !== undefined && level > previous + 1) {
      problems.push(`h${previous} followed by h${level}`);
    }
  }

  return problems;
}

/** The markup a browser renders, without the payload the framework inlines. */
function withoutScripts(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, ' ');
}

/* --- run ------------------------------------------------------------------- */

async function audit(path: string, raw: string) {
  checked += 1;

  // The rendered document, not the raw response. Next.js inlines its React
  // payload as a script, and that payload carries the same markup again in
  // escaped form, so reading the response counts everything twice.
  const html = withoutScripts(raw);

  const unlabelled = unlabelledInputs(html);
  if (unlabelled.length > 0) fail(path, 'input with no label', unlabelled[0]);

  const nameless = namelessButtons(html);
  if (nameless.length > 0) fail(path, 'button with no accessible name', nameless[0]);

  const noAlt = imagesWithoutAlt(html);
  if (noAlt.length > 0) fail(path, 'image with no alt', noAlt[0]);

  const exposed = exposedDecorativeSvgs(html);
  if (exposed > 0) fail(path, 'decorative svg not hidden', `${exposed}`);

  const headings = headingProblems(html);
  if (headings.length > 0) fail(path, 'heading structure', headings.join(', '));

  if (!html.includes('id="main"')) fail(path, 'no main landmark');
  if (!html.includes('Skip to content')) fail(path, 'no skip link');
  if (!/<html[^>]*lang=/i.test(raw)) fail(path, 'no language on the document');
}

async function main() {
  console.info(`\n  Accessibility, the mechanical half\n  ${BASE}\n`);

  const user = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
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

  const cookie = `carnet_session=${token}`;

  for (const path of [...PUBLIC_PAGES, ...PAGES]) {
    const response = await fetch(`${BASE}${path}`, {
      headers: PUBLIC_PAGES.includes(path) ? {} : { cookie },
    });

    if (response.status !== 200) {
      fail(path, `did not render`, `${response.status}`);
      continue;
    }

    await audit(path, await response.text());
  }

  await prisma.session.deleteMany({
    where: { tokenHash: createHash('sha256').update(token).digest('hex') },
  });

  console.info(
    `\n  ${checked} pages checked. ${failures === 0 ? 'Nothing mechanical is wrong.' : `${failures} problem(s).`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
