/**
 * What was true when the doors shut. Phase 96.
 *
 *   npx tsx infra/scripts/verify-close.ts
 *
 * The arithmetic of a close is unit tested. What cannot be unit tested is
 * whether the thing it writes is worth anything a year later, which is the
 * whole claim of the phase -- so this asks the database rather than the rules.
 *
 * **The record cannot be edited.** A close somebody can go back and tidy is a
 * record of what they wished had been true. Two triggers say so and this
 * tries, in SQL, to edit one.
 *
 * **A day is closed once.** Two closes for one site and day would make the
 * record ambiguous in the worst way: a reader could not tell which was the
 * day's real state.
 *
 * **It changes nothing it reads.** The readings are counted before and after a
 * close and must be identical. A close that quietly invoiced a job or cleared
 * a follow-up would be tidying rather than recording, and the difference is
 * the point of the phase.
 *
 * **Every reading is answered, and every sentence it can say is translated.**
 * The library says its sentences from inside functions where `i18n-scan`
 * cannot see them -- ADR-0019 -- so the keys are read out of its source here.
 *
 * It writes one close against a date in the past and leaves it there, because
 * the record is immutable on purpose and a probe that could delete its own
 * evidence would be disproving the thing it is checking. The date is far
 * enough back that no real close will ever collide with it.
 */

import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  businessDay,
  CLOSE_READINGS,
  howTheCloseLooks,
  regionForCountry,
  SHOULD_NOT_BE_LEFT,
  shouldNotBeLeft,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { closeFor, closeTheDay, theEndOfTheDay } from '../../apps/web/src/lib/close-of-day';
import { AR } from '../../packages/core/src/i18n/ar';
import { AREAS } from '../../packages/core/src/i18n/areas/index';
import { FR } from '../../packages/core/src/i18n/fr';

const ROOT = join(import.meta.dirname, '..', '..');
const LIB = join(ROOT, 'apps', 'web', 'src', 'lib', 'close-of-day.ts');

/** A date no workshop will ever close. The record is immutable, so it stays. */
const PROBE_DAY = '1990-01-01';

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

async function refused(label: string, sql: string, expect: RegExp): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(sql);
    failures += 1;
    console.error(`  FAIL   ${label}: it was allowed`);
  } catch (error) {
    const message = String(error);
    if (expect.test(message)) {
      console.info(`  ok     ${label}`);
    } else {
      // A refusal for the wrong reason is worse than no check: it passes while
      // proving something else entirely. Phase 87 found exactly that.
      failures += 1;
      console.error(`  FAIL   ${label}: refused, but not by ${expect}`);
    }
  }
}

const FRENCH: Record<string, string> = Object.assign({}, FR, ...AREAS.map((area) => area.fr));
const ARABIC: Record<string, string> = Object.assign({}, AR, ...AREAS.map((area) => area.ar));

/** Every `key: '...'` the library can emit, read out of its own source. */
function keysTheLibraryCanSay(): string[] {
  const source = readFileSync(LIB, 'utf8');
  const found = new Set<string>();
  for (const match of source.matchAll(/\bkey: '((?:[^'\\]|\\.)*)'/g)) {
    found.add((match[1] ?? '').replace(/\\'/g, "'"));
  }
  return [...found].sort();
}

async function main() {
  console.info('\n  What was true when the doors shut\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const location = await prisma.location.findFirstOrThrow({ where: { orgId: org.id } });
  const user = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id, role: 'OWNER' } } },
    select: { id: true },
  });
  // The currency follows the country, as it does everywhere else in the
  // product: an organisation has no currency column of its own.
  const currency = regionForCountry(org.country).currency;

  /* --- all ten, every time ------------------------------------------------ */

  console.info('  All ten, every time');

  const close = await theEndOfTheDay(org.id, location.id, currency);

  check('every reading is answered', close.readings.length, CLOSE_READINGS.length);
  check(
    'and in the order the rules declare',
    close.readings.map((one) => one.kind),
    [...CLOSE_READINGS],
  );

  check(
    'what should not be left is separated from what merely is',
    close.leftOvernight.every((one) => shouldNotBeLeft(one.kind)) &&
      close.outstanding.every((one) => !shouldNotBeLeft(one.kind)),
    true,
  );
  check('and the three are the three', [...SHOULD_NOT_BE_LEFT].sort(), [
    'clocked-on',
    'keys',
    'till',
  ]);
  check(
    'the line at the top is a key, not a built sentence',
    'key' in howTheCloseLooks(close),
    true,
  );

  /* --- in three languages ------------------------------------------------- */

  console.info('\n  In three languages');

  const keys = keysTheLibraryCanSay();
  check('the library says something at all', keys.length > 20, true);
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

  /* --- the record cannot be edited ---------------------------------------- */

  console.info('\n  A record of a moment');

  const existing = await closeFor(org.id, location.id, PROBE_DAY);

  if (!existing) {
    // Through `closeTheDay`, not around it. A probe that wrote its own row
    // would need a second copy of the kind-to-enum mapping and would leave the
    // real write path unchecked -- so `closeTheDay` could be broken and this
    // would still pass. It takes a `now`, which is all the probe needs.
    await closeTheDay({
      orgId: org.id,
      locationId: location.id,
      userId: user.id,
      timezone: 'Europe/London',
      currency,
      note: 'Written by verify-close. It cannot be removed, by design.',
      now: new Date(`${PROBE_DAY}T18:04:00Z`),
    });
    console.info('  --     wrote the probe close; it stays, because the record is immutable');
  }

  const probe = await closeFor(org.id, location.id, PROBE_DAY);
  if (!probe) {
    failures += 1;
    console.error('  FAIL   the probe close was not written; nothing below proves anything');
    console.info(`
  ${failures} failed.`);
    process.exitCode = 1;
    return;
  }
  const probeId = probe.id;

  check(
    'the close it wrote carries all ten readings',
    probe.readings.length,
    CLOSE_READINGS.length,
  );

  await refused(
    'a close cannot be edited afterwards',
    `UPDATE "day_closes" SET "note" = 'tidied' WHERE "id" = '${probeId}'`,
    /record of a moment/,
  );
  await refused(
    'nor deleted',
    `DELETE FROM "day_closes" WHERE "id" = '${probeId}'`,
    /record of a moment/,
  );
  await refused(
    'nor can a reading be changed under it',
    `UPDATE "day_close_readings" SET "count" = 0 WHERE "closeId" = '${probeId}'`,
    /record of a moment/,
  );

  /* --- a day is closed once ------------------------------------------------ */

  console.info('\n  Once');

  await refused(
    'a second close for the same site and day is refused by the database',
    `INSERT INTO "day_closes" ("id","orgId","locationId","on","closedAt","closedByUserId")
     VALUES ('${probeId}-again','${org.id}','${location.id}',DATE '${PROBE_DAY}',now(),'${user.id}')`,
    /day_closes_orgId_locationId_on_key/,
  );

  const twice = await closeFor(org.id, location.id, PROBE_DAY);
  check('and the one that stands names who closed it', Boolean(twice?.closedBy.name), true);
  check('and carries all ten readings', twice?.readings.length, CLOSE_READINGS.length);

  /* --- a close changes nothing it reads ------------------------------------ */

  console.info('\n  And it changes nothing');

  const after = await theEndOfTheDay(org.id, location.id, currency);
  check(
    'the readings are the same after a close as before it',
    after.readings.map((one) => `${one.kind}:${one.count}`),
    close.readings.map((one) => `${one.kind}:${one.count}`),
  );

  /* --- which day it belongs to --------------------------------------------- */

  console.info('\n  Whose day');

  check(
    'a close at six in the evening belongs to that evening',
    businessDay(new Date('2026-10-01T18:00:00Z'), 'Europe/London'),
    '2026-10-01',
  );
  check(
    'and one at one in the morning to the day that ended',
    businessDay(new Date('2026-10-02T01:00:00Z'), 'Europe/London'),
    '2026-10-01',
  );
  check(
    'and the workshop’s zone decides, not the server’s',
    businessDay(new Date('2026-10-01T22:00:00Z'), 'Australia/Sydney'),
    '2026-10-02',
  );

  console.info(
    failures === 0
      ? '\n  Somebody looked, what they saw is written down, and nothing can quietly change it.'
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
