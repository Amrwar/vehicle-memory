/**
 * What happened while we were shut. Phase 97.
 *
 *   npx tsx infra/scripts/verify-opening.ts
 *
 * The arithmetic is unit tested. What cannot be is whether the comparison is
 * against the right night, of the right readings, at the right site -- all
 * three of which are facts about a database rather than about a function.
 *
 * **It compares against a real close, by name.** The whole screen rests on
 * Phase 96 having stored its figures, and if the anchor were ever wrong the
 * screen would be confidently comparing this morning with nothing in
 * particular.
 *
 * **It compares only the readings that survive a night.** Two of the ten do
 * not: who is clocked on inverts between evening and morning, and a till
 * belongs to one day. Both were in the first draft, and the first run against
 * real data reported an ordinary morning's arrivals as something that happened
 * in the dark. A screen that cries wolf daily is not read by Friday.
 *
 * **It is per site.** A close belongs to one workshop and so does its morning.
 * Comparing Bradford Lane's morning with Hillside Road's close would be
 * arithmetic nobody could act on.
 *
 * **Every sentence it can say is answered in French and Arabic** -- read out
 * of the library's own source, because `i18n-scan` reads pages and this
 * library says its sentences from inside functions (ADR-0019).
 *
 * Read-only from end to end: this phase writes nothing at all, which is itself
 * one of the things checked.
 */

import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  COMPARABLE_OVERNIGHT,
  howItMoved,
  howTheNightWent,
  regionForCountry,
  survivesTheNight,
  whoIsIn,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { theNight, whatArrived, whoIsInToday } from '../../apps/web/src/lib/start-of-day';
import { AR } from '../../packages/core/src/i18n/ar';
import { AREAS } from '../../packages/core/src/i18n/areas/index';
import { FR } from '../../packages/core/src/i18n/fr';

const ROOT = join(import.meta.dirname, '..', '..');
const LIB = join(ROOT, 'apps', 'web', 'src', 'lib', 'start-of-day.ts');

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) === JSON.stringify(expected)) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

const FRENCH: Record<string, string> = Object.assign({}, FR, ...AREAS.map((area) => area.fr));
const ARABIC: Record<string, string> = Object.assign({}, AR, ...AREAS.map((area) => area.ar));

function keysTheLibraryCanSay(): string[] {
  const source = readFileSync(LIB, 'utf8');
  const found = new Set<string>();
  for (const match of source.matchAll(/\bkey: '((?:[^'\\]|\\.)*)'/g)) {
    found.add((match[1] ?? '').replace(/\\'/g, "'"));
  }
  return [...found].sort();
}

async function main() {
  console.info('\n  What happened while we were shut\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const owner = await prisma.membership.findFirstOrThrow({
    where: { orgId: org.id, role: 'OWNER' },
    select: { locationId: true },
  });
  const region = regionForCountry(org.country);

  if (!owner.locationId) {
    failures += 1;
    console.error('  FAIL   the seeded owner is at no site, so nothing below means anything');
    console.info(`\n  ${failures} failed.`);
    process.exitCode = 1;
    return;
  }
  const locationId = owner.locationId;

  /* --- the night it measures against --------------------------------------- */

  console.info('  The night it measures against');

  const night = await theNight(org.id, locationId, region.currency);

  check('it found a close to compare against', night.since.kind, 'close');
  if (night.since.kind !== 'close') {
    // Everything below is about the comparison, and there is none. Said loudly
    // rather than passing vacuously -- Phase 89's lesson.
    console.error('  FAIL   no close at this site in the last week; reseed');
    failures += 1;
    console.info(`\n  ${failures} failed.`);
    process.exitCode = 1;
    return;
  }

  check('and it names who took it', night.since.by.length > 0, true);
  check(
    'and the close it chose is this site’s most recent',
    night.since.at.toISOString(),
    (
      await prisma.dayClose.findFirstOrThrow({
        where: { orgId: org.id, locationId },
        orderBy: { on: 'desc' },
        select: { closedAt: true },
      })
    ).closedAt.toISOString(),
  );

  const otherSite = await prisma.location.findFirst({
    where: { orgId: org.id, id: { not: locationId } },
    select: { id: true },
  });
  if (otherSite) {
    const theirs = await theNight(org.id, otherSite.id, region.currency);
    check(
      'and another site’s morning is not measured against this one’s close',
      theirs.since.kind === 'close' && night.since.kind === 'close'
        ? theirs.since.at.toISOString() !== night.since.at.toISOString()
        : true,
      true,
    );
  } else {
    failures += 1;
    console.error('  FAIL   the seed has one site, so per-site scoping is untested');
  }

  /* --- only what survives a night ------------------------------------------ */

  console.info('\n  Only what survives a night');

  check('eight of the ten readings are compared', night.lines.length, COMPARABLE_OVERNIGHT.length);
  check(
    'and every line is one of them',
    night.lines.every((one) => survivesTheNight(one.kind)),
    true,
  );
  check(
    'who is clocked on is never compared, because it inverts overnight',
    night.lines.some((one) => one.kind === 'clocked-on'),
    false,
  );
  check(
    'nor the till, because a till belongs to one day',
    night.lines.some((one) => one.kind === 'till'),
    false,
  );
  check(
    'what nobody chose is new or worse, never anything else',
    night.happenedInTheDark.every((one) => one.move === 'NEW' || one.move === 'WORSE'),
    true,
  );
  check(
    'and every line’s move follows from its own two numbers',
    night.lines.every((one) => one.move === howItMoved(one.was, one.is)),
    true,
  );
  check(
    'the line at the top is a key, not a built sentence',
    'key' in howTheNightWent(night),
    true,
  );

  /* --- what arrived --------------------------------------------------------- */

  console.info('\n  What arrived while nobody was here');

  const arrived = await whatArrived(org.id, night.since.at);

  // Named first, because the two checks under it pass over an empty list
  // without proving anything -- which is what they did until the seed was
  // given a night with something in it.
  check('the seeded night has something in it to check', arrived.length > 0, true);

  check(
    'nothing with a count of nought is shown',
    arrived.every((one) => one.count > 0),
    true,
  );
  check(
    'and nothing is counted twice',
    new Set(arrived.map((one) => one.kind)).size,
    arrived.length,
  );

  // A window that ends before it starts must produce nothing, which is the
  // cheapest proof that the window is applied at all rather than ignored.
  const impossible = await whatArrived(org.id, new Date(), new Date(Date.now() - 60_000));
  check('the window is really applied', impossible.length, 0);

  /* --- the rota against the clock ------------------------------------------- */

  console.info('\n  The rota against the clock');

  const who = await whoIsInToday(org.id, locationId, region.timezone);
  check(
    'nobody is both expected-and-missing and here',
    who.notYet.some((one) => who.here.some((other) => other.employeeId === one.employeeId)),
    false,
  );
  check(
    'and nobody unexpected is also on the rota',
    who.unexpected.some((one) => who.expected.some((other) => other.employeeId === one.employeeId)),
    false,
  );
  check(
    'the arithmetic agrees with the rule in core',
    whoIsIn(who.expected, who.here).notYet.length,
    who.notYet.length,
  );

  // Only this site's people. A morning board listing the other branch's
  // technicians as missing would be worse than listing nobody.
  const elsewhere = await prisma.employee.count({
    where: { orgId: org.id, isActive: true, locationId: { not: locationId } },
  });
  check('the seed has people at another site to get wrong', elsewhere > 0, true);
  const theirIds = new Set(
    (
      await prisma.employee.findMany({
        where: { orgId: org.id, locationId: { not: locationId } },
        select: { id: true },
      })
    ).map((one) => one.id),
  );
  check(
    'and none of them is on this site’s morning board',
    [...who.expected, ...who.here].some((one) => theirIds.has(one.employeeId)),
    false,
  );

  /* --- in three languages ---------------------------------------------------- */

  console.info('\n  In three languages');

  const keys = keysTheLibraryCanSay();
  check('the library says something at all', keys.length > 10, true);
  check(
    'every sentence it can say has a French answer',
    keys.filter((key) => !(key in FRENCH)),
    [],
  );
  check(
    'and an Arabic one',
    keys.filter((key) => !(key in ARABIC)),
    [],
  );

  /* --- and it writes nothing -------------------------------------------------- */

  console.info('\n  And it writes nothing');

  const before = await Promise.all([
    prisma.dayClose.count({ where: { orgId: org.id } }),
    prisma.attendanceRecord.count({ where: { employee: { orgId: org.id } } }),
    prisma.auditLog.count({ where: { orgId: org.id } }),
  ]);

  await theNight(org.id, locationId, region.currency);
  await whatArrived(org.id, night.since.at);
  await whoIsInToday(org.id, locationId, region.timezone);

  const after = await Promise.all([
    prisma.dayClose.count({ where: { orgId: org.id } }),
    prisma.attendanceRecord.count({ where: { employee: { orgId: org.id } } }),
    prisma.auditLog.count({ where: { orgId: org.id } }),
  ]);

  check('reading the morning changes nothing at all', after, before);

  console.info(
    failures === 0
      ? '\n  The night is measured against a real close, of the readings that survive one, at this site.'
      : `\n  ${failures} failed.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
