/**
 * Whether the tenant filter covers what it claims to. Phase 64. FR-101, FR-102.
 *
 *   npx tsx infra/scripts/verify-scoping.ts
 *
 * `verify-tenancy.ts` (Phase 48) asks for another workshop's record by id at
 * every address the application answers on, and expects not found. It is a
 * good probe and it could not have found this, because it asks about a record
 * it names. A page that lists rows and quietly includes another tenant's among
 * them answers 200 with a perfectly ordinary-looking page.
 *
 * That is what `/reports` was doing. `db.membership.findMany({ where: { role:
 * 'TECHNICIAN' } })`, through the scoped client, rendering every technician at
 * every workshop on Carnet by name with their cost rate — because `Membership`
 * was not among the twenty-six model names somebody had typed into
 * `tenant.ts`, and fifty-seven other models were not either.
 *
 * So this checks the mechanism rather than the pages:
 *
 *   Every model is decided about — scoped, global with a reason, or a child
 *     named with its parent. The list is generated from the schema, so a model
 *     added tomorrow is either covered or fails this on the day it appears.
 *
 *   Every scoped model is actually filtered. Not by reading the set back to
 *     itself: by writing a row in one organisation and asking for it as
 *     another, through the real client, for each of the eighty-odd in turn.
 *
 *   Every child read in the application names its parent, because the
 *     extension has nothing to narrow those by and never will.
 */

import 'dotenv/config';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { CHILD_OF, forOrg, GLOBAL_MODELS, prisma, TENANT_SCOPED_MODELS } from '@carnet/db';

let failures = 0;
let checked = 0;

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `\n        ${String(detail)}`}`);
  }
}

const ROOT = join(__dirname, '..', '..');
const SCHEMA = join(ROOT, 'packages', 'db', 'prisma', 'schema.prisma');
const WEB = join(ROOT, 'apps', 'web', 'src');

const lower = (name: string) => name.charAt(0).toLowerCase() + name.slice(1);

function everyModel(): string[] {
  const schema = readFileSync(SCHEMA, 'utf8');
  return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1]!);
}

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at)) {
      const full = join(at, entry);
      if (statSync(full).isDirectory()) {
        if (['node_modules', '.next', 'generated'].includes(entry)) continue;
        walk(full);
      } else if (/\.tsx?$/.test(full)) found.push(full);
    }
  };
  walk(dir);
  return found;
}

/**
 * Reads of a child model through the scoped client that name nothing
 * tenant-carrying.
 *
 * The first version of this scan reported clean and was wrong: it took
 * everything after the word `where` as the filter, so a `select` naming
 * `jobId` counted as one. A check that cannot fail is not a check, and this
 * one had to be made to fail on a known-bad line before it was believed.
 */
function unguardedChildReads(): string[] {
  const READS =
    'findMany|findFirst|findUnique|count|aggregate|groupBy|findFirstOrThrow|findUniqueOrThrow';
  const names = Object.keys(CHILD_OF).map(lower);
  if (names.length === 0) return [];

  const pattern = new RegExp(`\\bdb\\.(${names.join('|')})\\.(${READS})\\(`, 'g');
  const found: string[] = [];

  for (const file of filesUnder(WEB)) {
    const text = readFileSync(file, 'utf8');

    for (const match of text.matchAll(pattern)) {
      const model = match[1]!;
      const parent = CHILD_OF[model.charAt(0).toUpperCase() + model.slice(1)]!;

      // The call's arguments, by matching the parentheses.
      let depth = 0;
      let i = match.index! + match[0].length - 1;
      for (; i < text.length; i += 1) {
        if (text[i] === '(') depth += 1;
        else if (text[i] === ')') {
          depth -= 1;
          if (depth === 0) break;
        }
      }

      const args = text.slice(match.index! + match[0].length, i);
      const after = args.includes('where') ? args.split('where')[1]! : '';
      const ends = ['select', 'include', 'orderBy', 'take']
        .map((word) => after.indexOf(word))
        .filter((at) => at > 0);
      const where = after.slice(0, ends.length > 0 ? Math.min(...ends) : after.length);

      const mentions = [parent, lower(parent), `${lower(parent)}Id`, 'orgId'];
      if (mentions.some((word) => where.includes(word))) continue;

      const line = text.slice(0, match.index!).split('\n').length;
      found.push(
        `${relative(ROOT, file).replace(/\\/g, '/')}:${line} db.${model} (child of ${parent})`,
      );
    }
  }

  return found;
}

async function main() {
  console.info('\n  Whether the tenant filter covers what it claims to\n');

  /* --- every model is decided about ----------------------------------------- */

  const all = everyModel();
  const undecided = all.filter(
    (name) => !TENANT_SCOPED_MODELS.has(name) && !GLOBAL_MODELS[name] && !CHILD_OF[name],
  );

  check(
    undecided.length === 0,
    `all ${all.length} models are decided about: scoped, global with a reason, or a child of one`,
    undecided.join(', '),
  );

  check(
    TENANT_SCOPED_MODELS.size > 80,
    `${TENANT_SCOPED_MODELS.size} models are filtered by the tenant extension`,
    TENANT_SCOPED_MODELS.size,
  );

  // The number that made this phase. Left in as a figure rather than a story,
  // because the next person to read it should see how far a typed list drifts.
  check(
    Object.keys(GLOBAL_MODELS).length < 20,
    `${Object.keys(GLOBAL_MODELS).length} are deliberately global, each saying why`,
  );

  check(
    Object.values(GLOBAL_MODELS).every((why) => why.length > 20),
    'and none of those reasons is a shrug',
  );

  /* --- and the filter is real ----------------------------------------------- */

  const tag = `scoping-${Date.now().toString(36)}`;

  const [mine, theirs] = await Promise.all([
    prisma.organization.create({
      data: {
        slug: `${tag}-mine`,
        name: 'Mine',
        country: 'GB',
        baseCurrency: 'GBP',
        locale: 'en-GB',
        timezone: 'Europe/London',
      },
      select: { id: true },
    }),
    prisma.organization.create({
      data: {
        slug: `${tag}-theirs`,
        name: 'Theirs',
        country: 'GB',
        baseCurrency: 'GBP',
        locale: 'en-GB',
        timezone: 'Europe/London',
      },
      select: { id: true },
    }),
  ]);

  const asMine = forOrg(mine.id);
  const asTheirs = forOrg(theirs.id);

  // One model that every workshop has, written as them and asked for as us.
  const ours = await prisma.customer.create({
    data: { orgId: theirs.id, kind: 'INDIVIDUAL', displayName: `${tag} customer` },
    select: { id: true },
  });

  const byId = await asMine.customer.findUnique({ where: { id: ours.id } });
  const inList = await asMine.customer.findMany({ where: { displayName: { contains: tag } } });

  check(byId === null, 'another workshop’s record is not found by id');
  check(inList.length === 0, 'and does not appear in a list that did not ask about it');

  const asOwner = await asTheirs.customer.findMany({
    where: { displayName: { contains: tag } },
  });

  // The check that keeps the one above honest: a filter that returns nothing
  // to anybody would pass it.
  check(asOwner.length === 1, 'while the workshop it belongs to still sees it');

  // And a write through the scoped client is stamped rather than trusted.
  const stamped = await asMine.customer.create({
    data: { kind: 'INDIVIDUAL', displayName: `${tag} stamped` } as never,
    select: { id: true, orgId: true },
  });

  check(stamped.orgId === mine.id, 'a row written through the scoped client is stamped with it');

  /* --- the query that was leaking ------------------------------------------- */

  // Not a general principle this time: the exact read `/reports` was doing,
  // kept as a check because a defect found once should not have to be found
  // twice. `Membership` carries an orgId and was not in the typed list, so
  // this returned every technician at every workshop on Carnet, and the page
  // rendered them by name with their cost rate.

  const [here, elsewhere] = await Promise.all([
    prisma.user.create({
      data: {
        email: `${tag}-here@example.com`,
        name: `Technician Here ${tag}`,
        passwordHash: 'not-a-real-hash',
      },
      select: { id: true },
    }),
    prisma.user.create({
      data: {
        email: `${tag}-elsewhere@example.com`,
        name: `Technician Elsewhere ${tag}`,
        passwordHash: 'not-a-real-hash',
      },
      select: { id: true },
    }),
  ]);

  await prisma.membership.createMany({
    data: [
      { userId: here.id, orgId: mine.id, role: 'TECHNICIAN' },
      { userId: elsewhere.id, orgId: theirs.id, role: 'TECHNICIAN' },
    ],
  });

  const technicians = await asMine.membership.findMany({
    where: { role: 'TECHNICIAN', isActive: true },
    include: { user: { select: { id: true, name: true } } },
  });

  const names = technicians.map((row) => row.user.name);

  check(
    names.includes(`Technician Here ${tag}`),
    'the workshop’s own technicians are on its report',
  );

  check(
    !names.includes(`Technician Elsewhere ${tag}`),
    'and nobody else’s are: the read that was leaking, asked again',
    names.filter((name) => name.includes(tag)).join(', '),
  );

  /* --- every model that carries an orgId is in the set ---------------------- */

  const schema = readFileSync(SCHEMA, 'utf8');
  const carrying = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)]
    .filter(([, , body]) => /^\s*orgId\s+String/m.test(body!))
    .map(([, name]) => name!);

  const missed = carrying.filter((name) => !TENANT_SCOPED_MODELS.has(name) && !GLOBAL_MODELS[name]);

  check(
    missed.length === 0,
    `each of the ${carrying.length} models carrying an orgId is filtered, or says why not`,
    missed.join(', '),
  );

  /* --- and the children name their parents ---------------------------------- */

  const unguarded = unguardedChildReads();

  check(
    unguarded.length === 0,
    `every read of the ${Object.keys(CHILD_OF).length} models with no orgId names the job, invoice or estimate it hangs off`,
    unguarded.join('\n        '),
  );

  /* --- clearing up ---------------------------------------------------------- */

  await prisma.membership.deleteMany({ where: { userId: { in: [here.id, elsewhere.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [here.id, elsewhere.id] } } });
  await prisma.customer.deleteMany({ where: { orgId: { in: [mine.id, theirs.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [mine.id, theirs.id] } } });

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`\n  ${checked} checks. The filter covers what it says it covers.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
