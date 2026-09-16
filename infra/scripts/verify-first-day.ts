/**
 * The first day, against a real database and a running server. Phase 45.
 *
 *   npx tsx infra/scripts/verify-first-day.ts [baseUrl]
 *
 * A brand-new workshop is created and its setup list is read: what it has is
 * ticked, what it has not is not, the first thing needed is named, and adding
 * the thing ticks it off without anybody pressing "done". The list can be put
 * away and brought back.
 *
 * The help pages are read as a person reads them, in English and in French,
 * one article is found by searching for a word in its middle, and help turns
 * up in the search box beside the records.
 *
 * The demonstration workshop is built, looked at, and removed: a year of work
 * with real job numbers, invoices and vehicle histories, every message it
 * wrote suppressed rather than sent, a warning on every screen, and nothing
 * left behind when it goes.
 *
 * It puts back everything it changes.
 */

import 'dotenv/config';

import { createHash, randomBytes } from 'node:crypto';

import { HELP_ARTICLES, setupSteps } from '@carnet/core';
import { prisma } from '@carnet/db';
import { AREAS } from '../../packages/core/src/i18n/areas/index';

import {
  createDemonstration,
  demonstrationFor,
  removeDemonstration,
  switchWorkshop,
} from '../../apps/web/src/lib/demonstration';
import { createWorkshop, setSetupHidden, setupFor } from '../../apps/web/src/lib/onboarding';
import { saveLabourRate } from '../../apps/web/src/lib/pricing';

const BASE = process.argv[2] ?? 'http://localhost:3000';

let failures = 0;
const tokens: string[] = [];

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function sessionFor(userId: string, orgId: string | null): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  tokens.push(tokenHash);
  await prisma.session.create({
    data: { tokenHash, userId, orgId, expiresAt: new Date(Date.now() + 3_600_000) },
  });
  return `carnet_session=${token}`;
}

async function get(path: string, cookie = '') {
  const response = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  });
  return { status: response.status, body: await response.text() };
}

async function main() {
  console.info(`\n  The first day\n  ${BASE}\n`);

  /* --- the setup list ---------------------------------------------------- */

  console.info('\n  The setup list\n');

  const email = `first-day-${randomBytes(4).toString('hex')}@example.test`;
  const signup = await createWorkshop(
    {
      workshopName: `First day probe ${randomBytes(2).toString('hex')}`,
      contactName: 'First day probe',
      email,
      password: 'ThePlaceWhereTheCarWas!2026',
      country: 'GB',
      sites: 1,
    },
    { acceptConsumerEmail: true, termsVersion: '2026-09-01' },
  );

  if (!signup.ok || !signup.userId) throw new Error('The probe workshop could not be created.');

  const probeUser = await prisma.user.findUniqueOrThrow({ where: { email } });
  const probeOrg = await prisma.organization.findFirstOrThrow({
    where: { memberships: { some: { userId: probeUser.id } }, isDemonstration: false },
    select: { id: true },
  });

  const fresh = await setupFor(probeOrg.id);
  check(
    'a new workshop has its tax rate and nothing else',
    [
      fresh.steps.find((step) => step.id === 'tax')?.done,
      fresh.steps.find((step) => step.id === 'rate')?.done,
      fresh.next?.id,
      fresh.ready,
      fresh.showOnDashboard,
    ],
    [true, false, 'details', false, true],
  );

  await saveLabourRate({
    orgId: probeOrg.id,
    userId: probeUser.id,
    locationId: null,
    name: 'Standard',
    perHour: 90,
    isDefault: true,
  });

  check(
    'adding the rate ticks it off, with nobody pressing done',
    (await setupFor(probeOrg.id)).steps.find((step) => step.id === 'rate')?.done,
    true,
  );

  await setSetupHidden({ orgId: probeOrg.id, userId: probeUser.id, hidden: true });
  check(
    'and the list can be put away and brought back',
    [
      (await setupFor(probeOrg.id)).showOnDashboard,
      await (async () => {
        await setSetupHidden({ orgId: probeOrg.id, userId: probeUser.id, hidden: false });
        return (await setupFor(probeOrg.id)).showOnDashboard;
      })(),
    ],
    [false, true],
  );

  /* --- help ---------------------------------------------------------------- */

  console.info('\n  Help\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.user.findUniqueOrThrow({
    where: { email: 'ahmed@hillsidemotors.test' },
  });
  const ownerCookie = await sessionFor(owner.id, org.id);

  const help = await get('/help', ownerCookie);
  check(
    'the help page lists every article',
    [help.status, HELP_ARTICLES.every((article) => help.body.includes(article.title))],
    [200, true],
  );

  const article = await get('/help/invoices-and-payments', ownerCookie);
  check(
    'an article reads as two paragraphs and links to its screen',
    [
      article.status,
      article.body.includes('Numbered without gaps'),
      article.body.includes('href="/invoices"'),
    ],
    [200, true, true],
  );

  const asked = await get('/help?q=credit%20note', ownerCookie);
  check(
    'a word from the middle of an article finds it',
    asked.body.includes('Invoices, payments and the till'),
    true,
  );

  const searched = await get('/search?q=invoice&all=1', ownerCookie);
  check(
    'and help turns up in the search box beside the records',
    [searched.body.includes('/help/invoices-and-payments'), searched.body.includes('Help')],
    [true, true],
  );

  const inFrench = await get('/help', `${ownerCookie}; carnet_lang=fr`);
  check(
    'the help is translated',
    [
      inFrench.body.includes('Douze pages courtes'),
      inFrench.body.includes('What this product is for'),
    ],
    [true, false],
  );

  // Every sentence the help and the setup list are made of has both
  // translations. They come from core rather than from a page, so the scan
  // over the pages cannot see them.
  const dictionaries = AREAS.map((area) => ({ fr: area.fr, ar: area.ar }));
  const translated = (text: string, language: 'fr' | 'ar') =>
    dictionaries.some((area) => area[language][text] !== undefined);

  const sentences = [
    ...HELP_ARTICLES.flatMap((entry) => [entry.title, entry.summary, ...entry.body]),
    ...setupSteps({
      hasLetterhead: false,
      labourRates: 0,
      taxRates: 0,
      members: 1,
      products: 0,
      customers: 0,
      jobs: 0,
      invoicesIssued: 0,
      reminders: 0,
    }).flatMap((step) => [step.title, step.why]),
  ];

  check(
    'every help and setup sentence has French and Arabic',
    [
      sentences.filter((sentence) => !translated(sentence, 'fr')).slice(0, 3),
      sentences.filter((sentence) => !translated(sentence, 'ar')).slice(0, 3),
      sentences.length,
    ],
    [[], [], sentences.length],
  );

  /* --- the demonstration workshop ------------------------------------------ */

  console.info('\n  A workshop to look around\n');

  const already = await demonstrationFor(owner.id);
  if (already) await removeDemonstration({ userId: owner.id, orgId: already.id });

  const started = Date.now();
  const { orgId: demoId, created } = await createDemonstration({ userId: owner.id });
  const seconds = Math.round((Date.now() - started) / 1000);

  const [jobs, invoices, payments, events, entries, queued, suppressed] = await Promise.all([
    prisma.job.count({ where: { orgId: demoId } }),
    prisma.invoice.count({ where: { orgId: demoId, status: { not: 'DRAFT' } } }),
    prisma.payment.count({ where: { orgId: demoId } }),
    prisma.vehicleEvent.count({ where: { recordedByOrgId: demoId } }),
    prisma.journalEntry.count({ where: { orgId: demoId } }),
    prisma.messageLog.count({ where: { orgId: demoId, status: 'QUEUED' } }),
    prisma.messageLog.count({ where: { orgId: demoId, status: 'SUPPRESSED' } }),
  ]);

  check(
    'a year of work, put through the product itself',
    [created, jobs > 40, invoices > 40, payments > 30, events > 100, entries > 40],
    [true, true, true, true, true, true],
  );
  console.info(`  ok     built in ${seconds}s`);
  check('and nothing it wrote is waiting to be sent', [queued, suppressed > 40], [0, true]);

  const demoCookie = await sessionFor(owner.id, org.id);
  await switchWorkshop({
    userId: owner.id,
    sessionId: (
      await prisma.session.findFirstOrThrow({
        where: { tokenHash: tokens[tokens.length - 1] },
        select: { id: true },
      })
    ).id,
    orgId: demoId,
  });

  const dashboard = await get('/dashboard', demoCookie);
  check(
    'every screen says it is a demonstration',
    [dashboard.status, dashboard.body.includes('none of this is real work')],
    [200, true],
  );
  const start = await get('/start', demoCookie);
  check(
    'and the way back is on the getting-started page',
    [
      start.body.includes('You are in the demonstration now.'),
      start.body.includes('The setup list'),
    ],
    [true, true],
  );

  const demoVehicles = await prisma.vehicle.count({ where: { isDemonstration: true } });
  await removeDemonstration({ userId: owner.id, orgId: demoId });

  check(
    'removing it takes the workshop and its vehicles with it',
    [
      demoVehicles > 0,
      await prisma.organization.count({ where: { id: demoId } }),
      await prisma.vehicle.count({ where: { isDemonstration: true } }),
      await prisma.job.count({ where: { orgId: demoId } }),
    ],
    [true, 0, 0, 0],
  );

  /* --- put it back --------------------------------------------------------- */

  await prisma.session.deleteMany({ where: { tokenHash: { in: tokens } } });
  await prisma.organization.delete({ where: { id: probeOrg.id } });
  await prisma.user.delete({ where: { id: probeUser.id } });

  console.info(failures === 0 ? '\n  All good.\n' : `\n  ${failures} failed.\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
