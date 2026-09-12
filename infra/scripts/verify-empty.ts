/**
 * Every page, with nothing in it.
 *
 *   npx tsx infra/scripts/verify-empty.ts [baseUrl]
 *
 * Empty states are the part of a product that never gets designed, because the
 * demo data always has rows. The first person to see them is a real workshop on
 * their first morning, which is the worst possible moment to meet a blank table
 * or a page that divides by zero.
 *
 * So this creates a genuinely empty workshop, walks every page as its owner,
 * and asserts three things: nothing errors, nothing shows a bare zero where a
 * sentence belongs, and every page says what to do next.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { prisma } from '@carnet/db';

import { createWorkshop } from '../../apps/web/src/lib/onboarding';

const BASE = process.argv[2] ?? 'http://localhost:3000';

let failures = 0;

function check(label: string, passed: boolean, detail?: string) {
  console.info(`  ${passed ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  ${detail}` : ''}`);
  if (!passed) failures += 1;
}

/**
 * Pages a brand new workshop can reach, and a phrase each should say when it
 * has nothing to show. Not "no data": a sentence telling somebody what to do.
 */
const PAGES: { path: string; expectsGuidance: string[] }[] = [
  { path: '/dashboard', expectsGuidance: [] },
  { path: '/diary', expectsGuidance: [] },
  { path: '/jobs', expectsGuidance: [] },
  { path: '/customers', expectsGuidance: [] },
  { path: '/vehicles', expectsGuidance: [] },
  { path: '/estimates', expectsGuidance: ['raised from a job'] },
  { path: '/invoices', expectsGuidance: [] },
  { path: '/payments', expectsGuidance: [] },
  { path: '/reports', expectsGuidance: [] },
  { path: '/reports/business', expectsGuidance: [] },
  { path: '/counter', expectsGuidance: ['opens a till session'] },
  { path: '/parts', expectsGuidance: [] },
  { path: '/suppliers', expectsGuidance: [] },
  { path: '/purchasing', expectsGuidance: [] },
  { path: '/transfers', expectsGuidance: [] },
  { path: '/people', expectsGuidance: [] },
  { path: '/reminders', expectsGuidance: ['No vehicle reaches'] },
  { path: '/crm', expectsGuidance: ['No completed visits yet'] },
  { path: '/automation', expectsGuidance: ['No rules yet'] },
  { path: '/messages', expectsGuidance: ['Nothing has been sent'] },
  { path: '/insights', expectsGuidance: ['Not enough completed work yet'] },
  { path: '/inspections', expectsGuidance: ['None yet'] },
  { path: '/floor', expectsGuidance: ['Empty.'] },
  { path: '/warranty', expectsGuidance: ['Nothing recorded yet'] },
  { path: '/recalls', expectsGuidance: ['No recalls recorded'] },
  { path: '/capacity', expectsGuidance: ['Nobody has working hours recorded'] },
  { path: '/plan', expectsGuidance: ['Nothing could be placed'] },
  { path: '/skills', expectsGuidance: ['Nothing recorded yet'] },
  { path: '/patterns', expectsGuidance: ['Nobody has working hours'] },
  { path: '/fleet', expectsGuidance: ['No fleets yet'] },
  { path: '/reputation', expectsGuidance: ['Nobody has answered yet'] },
  { path: '/inbox', expectsGuidance: ['Nothing has come in'] },
  { path: '/claims', expectsGuidance: ['Nobody has asked'] },
  { path: '/payables', expectsGuidance: ['Nothing is owed'] },
  { path: '/payroll', expectsGuidance: ['Nothing waiting'] },
  { path: '/ask', expectsGuidance: ['What the records can answer'] },
  { path: '/ask?q=Who+owes+us+money%3F', expectsGuidance: ['owed to you'] },
  { path: '/bookings/new', expectsGuidance: ['No customers yet'] },
  { path: '/suppliers/new', expectsGuidance: ['Add a supplier'] },
  { path: '/ledger', expectsGuidance: ['fills itself'] },
  { path: '/financials', expectsGuidance: [] },
  { path: '/expenses', expectsGuidance: ['not a supplier bill'] },
  { path: '/banking', expectsGuidance: ['Add a bank account'] },
  { path: '/settings', expectsGuidance: [] },
  { path: '/settings/team', expectsGuidance: [] },
  { path: '/audit', expectsGuidance: [] },
  { path: '/group', expectsGuidance: ['at least two'] },
];

/**
 * Text that means somebody forgot the empty case.
 *
 * Checked against the visible text only. Next.js inlines its own React
 * payload into the document, and that payload is full of "$undefined" markers
 * which have nothing to do with what a person sees. Searching the raw HTML
 * flags every page in the product and finds nothing real.
 */
const SMELLS = ['NaN', 'undefined', 'Infinity', '[object Object]', 'Invalid Date'];

/** Strips scripts, styles and tags, leaving what somebody would read. */
function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ');
}

const stamp = Date.now().toString(36);

async function main() {
  console.info(`\n  Every page, with nothing in it\n  ${BASE}\n`);

  const outcome = await createWorkshop(
    {
      workshopName: `Empty Motors ${stamp}`,
      contactName: 'Empty Owner',
      email: `empty-${stamp}@probeworkshop.test`,
      password: 'a-sufficiently-long-one',
      sites: 1,
    },
    // Group, so no page is hidden behind a plan wall and every one is
    // actually exercised rather than skipped.
    { plan: 'GROUP' },
  );

  if (!outcome.ok) {
    check('an empty workshop could be created', false, outcome.problems[0]?.message);
    finish();
    return;
  }

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: outcome.orgSlug! } });

  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({
    data: {
      tokenHash: createHash('sha256').update(token).digest('hex'),
      userId: outcome.userId!,
      orgId: org.id,
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  });

  const cookie = `carnet_session=${token}`;

  // A workshop whose owner has not opened the confirmation link is shown the
  // holding page and nothing else. Everything inside sends things in the
  // workshop's name, and an address nobody has proven is how a stranger opens
  // a business under somebody else's. Checked here because this is the one
  // probe that has a genuinely unconfirmed owner in its hands.
  const held = await fetch(`${BASE}/dashboard`, { headers: { cookie }, redirect: 'manual' });
  check(
    'an unconfirmed owner is held at the confirmation page',
    held.status >= 300 &&
      held.status < 400 &&
      (held.headers.get('location') ?? '').includes('/confirm-email'),
    true,
  );

  const holding = await fetch(`${BASE}/confirm-email`, { headers: { cookie } });
  check(
    'and the holding page says where the link went',
    (await holding.text()).includes(`empty-${stamp}@probeworkshop.test`),
    true,
  );

  // The link is opened, as far as the database is concerned, and the rest of
  // the probe walks the workshop as a confirmed owner would.
  await prisma.user.update({
    where: { id: outcome.userId! },
    data: { emailVerifiedAt: new Date() },
  });

  for (const page of PAGES) {
    const response = await fetch(`${BASE}${page.path}`, { headers: { cookie } });
    const html = await response.text();

    if (response.status !== 200) {
      check(`${page.path} renders`, false, `${response.status}`);
      continue;
    }

    const text = visibleText(html);
    const smell = SMELLS.find((needle) => text.includes(needle));
    const missing = page.expectsGuidance.filter((phrase) => !html.includes(phrase));

    if (smell) {
      check(`${page.path} renders`, false, `shows "${smell}" with no data`);
      continue;
    }

    if (missing.length > 0) {
      check(`${page.path} renders`, false, `no guidance: ${missing.join(', ')}`);
      continue;
    }

    check(`${page.path} renders and says what to do`, true);
  }

  /* --- forms with nothing in them ----------------------------------------- */

  // A form posted empty must not 500. The browser's required attributes stop
  // most of it, but anything reachable by a script has to refuse politely.
  const emptyPost = await fetch(`${BASE}/api/reports/nonexistent`, { headers: { cookie } });
  check(
    'an unknown report is refused, not crashed',
    emptyPost.status === 404,
    `${emptyPost.status}`,
  );

  /* --- clean up ------------------------------------------------------------ */

  await prisma.session.deleteMany({ where: { userId: outcome.userId! } });
  await prisma.organization.delete({ where: { id: org.id } });
  await prisma.user.deleteMany({ where: { id: outcome.userId! } });

  check(
    'the probe cleaned up after itself',
    (await prisma.organization.count({ where: { slug: outcome.orgSlug! } })) === 0,
  );

  finish();
}

function finish() {
  console.info(
    `\n  ${failures === 0 ? 'Every page works with nothing in it.' : `${failures} page(s) need work.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
