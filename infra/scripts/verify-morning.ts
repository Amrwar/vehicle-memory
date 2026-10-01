/**
 * The list you clear before you open anything else. Phase 95.
 *
 *   npx tsx infra/scripts/verify-morning.ts
 *
 * The rules in `packages/core/src/owner/do-not-miss.ts` are unit tested. What
 * cannot be unit tested is whether the eight gatherers in
 * `apps/web/src/lib/do-not-miss.ts` keep the promises the rules make, against
 * a real database, so this checks the four claims that would quietly rot.
 *
 * **Every row goes somewhere that exists.** An item is a sentence, a verb and
 * an `href`, and `isOneAction` only asks that the href starts with a slash. A
 * row that reads "Ring the supplier" and lands on a 404 is worse than no row:
 * it teaches somebody that this screen is not to be trusted, which is the one
 * thing a morning list cannot survive. So every href a gatherer can produce is
 * resolved against the route tree on disk.
 *
 * **Every sentence it can say is answered in French and Arabic.** The library
 * emits its keys from inside functions, where `i18n-scan` cannot see them --
 * it reads the pages. So the keys are read out of the source here and looked
 * up in the merged dictionary. This is how `'{count} things to deal with.'`
 * was found being built by hand out of a number.
 *
 * **Every kind can actually happen.** Ten are declared. A kind no gatherer
 * ever produces is the dead `SAME_PART_NUMBER` rule of Phase 87 all over
 * again: a shape that looks complete and cannot fire.
 *
 * **The screen handles every cost.** The page keys its badge tone off the
 * cost, and a cost added to core without a tone renders `undefined`.
 *
 * Read-only. It writes nothing and puts nothing back, because there is nothing
 * to put back: a morning list is a question asked of data somebody else owns.
 */

import 'dotenv/config';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

import {
  A_MORNING,
  COST_ORDER,
  COST_SENTENCE,
  howTheMorningLooks,
  isOneAction,
  MISS_KINDS,
  theMorning,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { doNotMiss } from '../../apps/web/src/lib/do-not-miss';
import { AR } from '../../packages/core/src/i18n/ar';
import { AREAS } from '../../packages/core/src/i18n/areas/index';
import { FR } from '../../packages/core/src/i18n/fr';

const ROOT = join(import.meta.dirname, '..', '..');
const LIB = join(ROOT, 'apps', 'web', 'src', 'lib', 'do-not-miss.ts');
const PAGE = join(ROOT, 'apps', 'web', 'src', 'app', '(workshop)', 'morning', 'page.tsx');

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

/* --- the route tree, as it is on disk ------------------------------------- */

/** Every page under the workshop shell, as a list of path segments. */
function routeSegments(): string[][] {
  const root = join(ROOT, 'apps', 'web', 'src', 'app');
  const out: string[][] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name === 'page.tsx') {
        const segments = dir
          .slice(root.length + 1)
          .split(sep)
          // Route groups are not in the URL, and neither is the app root.
          .filter((piece) => piece.length > 0 && !piece.startsWith('('));
        out.push(segments);
      }
    }
  };
  walk(root);
  return out;
}

/**
 * Whether an href lands on a page that exists.
 *
 * `[id]` matches one segment, `[...rest]` the rest. Nothing clever: the point
 * is only to catch an href that was renamed, or never existed.
 */
function routeExists(href: string, routes: string[][]): boolean {
  const want = href.split('?')[0].split('#')[0].split('/').filter(Boolean);
  return routes.some((route) => {
    let i = 0;
    for (const piece of route) {
      if (piece.startsWith('[...')) return true;
      if (i >= want.length) return false;
      if (!piece.startsWith('[') && piece !== want[i]) return false;
      i += 1;
    }
    return i === want.length;
  });
}

/* --- the dictionary, merged exactly as the product merges it -------------- */

const FRENCH: Record<string, string> = Object.assign({}, FR, ...AREAS.map((area) => area.fr));
const ARABIC: Record<string, string> = Object.assign({}, AR, ...AREAS.map((area) => area.ar));

/** Every `key: '...'` the library can emit, read out of its source. */
function keysTheLibraryCanSay(): string[] {
  const source = readFileSync(LIB, 'utf8');
  const found = new Set<string>();
  for (const match of source.matchAll(/\bkey: '((?:[^'\\]|\\.)*)'/g)) {
    found.add(match[1].replace(/\\'/g, "'"));
  }
  return [...found].sort();
}

async function main() {
  console.info('\n  The list you clear before you open anything else\n');

  const org = await prisma.organization.findFirstOrThrow({ where: { slug: 'hillside-motors' } });
  const list = await doNotMiss(org.id);
  const total = list.items.length + list.more;

  /* --- it says something about a real workshop ---------------------------- */

  console.info('  A real workshop');

  // Not an assertion that the seed is untidy for its own sake: a check that
  // passes on an empty list is a check that proves nothing, and every one
  // below it would pass vacuously. Phase 89 had exactly that and it passed in
  // silence for a day.
  check('the seeded workshop has something worth not missing', total > 0, true);
  if (total === 0) {
    console.error('  FAIL   nothing to check against. Reseed.');
    console.info(`\n  ${failures} failed.`);
    process.exitCode = 1;
    return;
  }

  check('and it is short enough to be a morning', list.items.length <= A_MORNING, true);
  check(
    'and it is not pretending to be shorter than it is',
    list.more,
    Math.max(0, total - A_MORNING),
  );
  check(
    'and the line at the top is a key, not a built sentence',
    'key' in howTheMorningLooks(list),
    true,
  );

  /* --- every row is one action, and it goes somewhere --------------------- */

  console.info('\n  Every row is one action');

  check('every row the screen shows is one action', list.items.every(isOneAction), true);
  check(
    'and no two rows are the same thing',
    new Set(list.items.map((one) => one.id)).size,
    list.items.length,
  );
  check(
    'and every row names a verb rather than a count',
    list.items.every((one) => !/\d$/.test(one.action.key.trim())),
    true,
  );

  const routes = routeSegments();
  check('the route tree was found at all', routes.length > 50, true);

  const nowhere = list.items.filter((one) => !routeExists(one.href, routes));
  check(
    'and every row goes to a page that exists',
    nowhere.map((one) => `${one.kind} -> ${one.href}`),
    [],
  );

  /* --- every kind can happen --------------------------------------------- */

  console.info('\n  Every kind can happen');

  const source = readFileSync(LIB, 'utf8');
  // Two shapes, because three of the kinds are chosen by a ternary:
  // `kind: 'part-late' as const` and `('estimate-never-sent' as const)`. The
  // first pattern alone reported those three as dead, which is the check being
  // wrong about the code rather than the code being wrong -- and a check that
  // fails for the wrong reason is worse than no check.
  const produced = new Set(
    [...source.matchAll(/'([a-z-]+)' as const/g)]
      .map((match) => match[1])
      .filter((kind) => (MISS_KINDS as readonly string[]).includes(kind)),
  );
  const dead = MISS_KINDS.filter((kind) => !produced.has(kind));
  check('no declared kind is one nothing can produce', dead, []);

  // And the other direction: a kind the library casts that core has never
  // heard of would not type-check, so what is worth checking is that the two
  // lists are the same length -- nothing declared and unused, nothing used
  // and undeclared.
  check(
    'and every kind core declares is one the library reaches',
    produced.size,
    MISS_KINDS.length,
  );

  /* --- every sentence is answered in French and Arabic -------------------- */

  console.info('\n  In three languages');

  const keys = keysTheLibraryCanSay();
  check('the library says something at all', keys.length > 10, true);
  check(
    'every sentence the library can say has a French answer',
    keys.filter((key) => !(key in FRENCH)),
    [],
  );
  check(
    'and an Arabic one',
    keys.filter((key) => !(key in ARABIC)),
    [],
  );

  /*
   * No slot holds prose. `translate()` fills slots verbatim when it is given
   * vars, so a sentence passed as a var value stays in English on a French
   * page -- and its own slots are dropped, which is how a reader ends up
   * looking at the word "{amount}". Found in the job row, where
   * `JobStanding.reason.key` was being interpolated into a sentence of this
   * library's own.
   *
   * Prose is told from data by two marks, not by asking the dictionary: a
   * workshop's own job types and suppliers have dictionary entries so the
   * seeded demo reads in French, and those are data a slot is exactly for. An
   * unfilled slot inside a value, or a value that ends in a full stop, is a
   * sentence that was meant to be translated somewhere else.
   */
  const smuggled = list.items.flatMap((one) =>
    Object.entries(one.what.vars ?? {})
      .filter(
        ([, value]) => typeof value === 'string' && (/\{\w+\}/.test(value) || value.endsWith('.')),
      )
      .map(([name, value]) => `${one.kind}.${name} = ${String(value)}`),
  );
  check('no sentence is hidden inside another sentence’s slot', smuggled, []);

  const costs = Object.values(COST_SENTENCE);
  check(
    'and so does every name for what it costs to miss something',
    costs.filter((sentence) => !(sentence in FRENCH) || !(sentence in ARABIC)),
    [],
  );

  /* --- the screen handles every cost ------------------------------------- */

  console.info('\n  And the screen can render all of it');

  const page = readFileSync(PAGE, 'utf8');
  const toned = new Set(
    [...page.matchAll(/^\s{2}([A-Z_]+): '(?:danger|warning|neutral|success|info)',$/gm)].map(
      (match) => match[1],
    ),
  );
  check(
    'every cost has a badge tone on the screen',
    COST_ORDER.filter((cost) => !toned.has(cost)),
    [],
  );

  /* --- and only what today can change ------------------------------------ */

  console.info('\n  Only what today can change');

  const ninetyDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000);
  const ancient = list.items.filter(
    (one) => one.kind === 'invoice-overdue' && one.when && one.when < ninetyDaysAgo,
  );
  // An invoice that far gone is a fact, not a thing to miss this morning, and
  // a list that carried every one of them would never be finished.
  check('nothing older than the ninety-day window is on the list', ancient.length, 0);

  const order = list.items.map((one) => COST_ORDER.indexOf(one.cost));
  check(
    'and it is ordered by what it costs to miss',
    order.every((rank, index) => index === 0 || rank >= order[index - 1]),
    true,
  );

  /* --- the cap, on the rules' own terms ---------------------------------- */

  const many = Array.from({ length: A_MORNING + 7 }, (_, index) => ({
    ...list.items[0],
    id: `probe-${index}`,
  }));
  check('a long morning is capped and the rest admitted', theMorning(many).more, 7);

  console.info(
    failures === 0
      ? '\n  Every row is one action, it goes somewhere that exists, and it can be read in three languages.'
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
