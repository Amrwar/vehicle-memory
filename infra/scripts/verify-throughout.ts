/**
 * The four things that are not features. Phase 55.
 *
 *   npx tsx infra/scripts/verify-throughout.ts
 *
 * The roadmap ends with a section that makes four promises about every phase
 * rather than about any one of them: that every phase ends with the checks,
 * that every screen is measured on a telephone rather than merely looked at,
 * that every list has a bound and every derived figure a cost, and that
 * nothing waits on a blank screen.
 *
 * Fifty-four phases went by and not one of the four was ever checked. They
 * read as description, which is how a promise about everything comes to be a
 * promise about nothing: there is no single place it can fail, so it never
 * does. What this found the first time it ran was a third of the product's
 * own verification scripts never executed by anything, three quarters of its
 * screens never measured, the customer's entire side with no loading state at
 * all, and a page that read every line a workshop had ever posted.
 *
 * Nothing here needs a browser or a running application. It reads the
 * repository, which is where all four promises are either kept or not.
 */

import 'dotenv/config';

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import { APP, everyRoute, visible } from './lib/routes';

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

const read = (path: string) => readFileSync(path, 'utf8');

/* ---------------------------------------------------------------------------
   One. Every phase ends with the checks
   --------------------------------------------------------------------------- */

/**
 * A check that nothing runs is a check that is green because it is asleep.
 *
 * `verify:languages` had been failing since Phase 50 and nobody knew, because
 * the only thing that ever ran it was somebody typing its name. Twenty-six of
 * the seventy-four were in that state when this was written.
 */
function theChecksRun() {
  console.info('\n  Every phase ends with the checks\n');

  const scripts: Record<string, string> = JSON.parse(read('package.json')).scripts;
  const ci = read('.github/workflows/ci.yml');

  const verifications = Object.keys(scripts).filter((name) => name.startsWith('verify:'));
  const asleep = verifications.filter((name) => {
    const file = /verify-[a-z-]+\.ts/.exec(scripts[name] ?? '')?.[0];
    return file ? !ci.includes(file) : false;
  });

  check(
    asleep.length === 0,
    `all ${verifications.length} verification scripts are run by something`,
    asleep.length > 0 ? `never run: ${asleep.join(', ')}` : undefined,
  );

  // And the gates the roadmap names, each by the command that would fail.
  const gates: [string, string][] = [
    ['format', 'format:check'],
    ['lint', 'npm run lint'],
    ['types', 'typecheck'],
    ['unit tests', 'test:coverage'],
    ['the build', 'npm run build'],
    ['no text outside the translator', 'i18n-scan.ts'],
    ['every refusal translated', 'i18n-scan.ts --messages'],
    ['every route for every role', 'smoke.ts'],
    ['every page with nothing in it', 'verify-empty.ts'],
    ['accessibility', 'verify-access.ts'],
    ['every control does something', 'verify-controls.ts'],
  ];

  const missing = gates.filter(([, command]) => !ci.includes(command)).map(([what]) => what);

  check(
    missing.length === 0,
    'and so is every gate the roadmap names',
    missing.length > 0 ? `not in the workflow: ${missing.join(', ')}` : undefined,
  );

  // And a script on disk with no npm name is a script nobody will find. The
  // list is read off the directory rather than trusted, for the same reason
  // the screens are.
  const onDisk = readdirSync(join('infra', 'scripts'))
    .filter((file) => /^verify-[a-z-]+\.ts$/.test(file))
    .filter((file) => !ci.includes(file));

  const unnamed = onDisk.filter(
    (file) => !Object.values(scripts).some((command) => command.includes(file)),
  );

  check(
    unnamed.length === 0,
    'and every verification on disk has a name somebody can type',
    unnamed.join(', '),
  );
}

/* ---------------------------------------------------------------------------
   Two. Responsive, not merely narrow
   --------------------------------------------------------------------------- */

/**
 * Whether the screens probe still reads its list off the filesystem.
 *
 * verify-screens.ts is what actually measures; this only asks that it cannot
 * go back to a hand-written list, which is how three quarters of the product
 * came to be unmeasured while the roadmap said "every screen".
 */
function everyScreenMeasured() {
  console.info('\n  Responsive, not merely narrow\n');

  const probe = read('infra/scripts/verify-screens.ts');

  check(
    probe.includes("from './lib/routes'") && probe.includes('everyRoute()'),
    'the screens probe reads its list off the app directory rather than a list somebody types',
  );

  check(
    probe.includes('every screen is decided about'),
    'and fails on any address that is neither measured nor given a reason',
  );

  const declared = [...probe.matchAll(/^ {2}'([^']+)': \{/gm)].map((m) => m[1]!);
  const routes = everyRoute();
  const undeclared = routes.filter((route) => !declared.includes(route));

  check(
    undeclared.length === 0,
    `all ${routes.length} addresses appear in its plan`,
    undeclared.length > 0 ? undeclared.map(visible).join(', ') : undefined,
  );
}

/* ---------------------------------------------------------------------------
   Three. Complexity that stays honest
   --------------------------------------------------------------------------- */

/**
 * Every list has a bound, or a written reason why it does not need one.
 *
 * A list is taken to be bounded when it says `take`, or when it is scoped to
 * a particular record by an identifier. Anything else is a query whose size is
 * whatever the workshop has done since it opened, and those have to say what
 * holds them — in a `bounded:` line above the query, in words, so that the
 * reason can be disagreed with rather than assumed.
 *
 * Three hundred and two lists; fifty had neither. Most had a real answer
 * nobody had written down (a chart of accounts is fifty rows; a workshop has
 * four bank accounts). Six did not, and were rewritten as sums in the
 * database — including a trial balance that read every posting a workshop had
 * ever made in order to print forty figures.
 */
function listsHaveBounds() {
  console.info('\n  Complexity that stays honest\n');

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(full) && !full.endsWith('.test.ts')) files.push(full);
    }
  };
  walk(join('apps', 'web', 'src'));

  let total = 0;
  const unbounded: string[] = [];

  for (const file of files) {
    const lines = read(file).split('\n');

    lines.forEach((line, index) => {
      if (!/\.findMany\(/.test(line)) return;
      total += 1;

      const block = lines.slice(index, index + 22).join('\n');
      const end = block.indexOf('\n  });');
      const body = end > 0 ? block.slice(0, end) : block;

      if (/\btake:\s*\w/.test(body)) return;
      if (/\bid:\s*\{\s*in:|\bid:\s*[a-zA-Z]|Id:\s*[a-zA-Z]/.test(body)) return;

      // A reason, either just above the query or inside it, and up to eight
      // lines of it: a reason worth writing is sometimes a paragraph.
      const above = lines.slice(Math.max(0, index - 8), index).join('\n');
      if (/bounded:/i.test(above) || /bounded:/i.test(body)) return;

      unbounded.push(`${file}:${index + 1}`);
    });
  }

  check(
    unbounded.length === 0,
    `all ${total} lists are bounded, or say in words what holds them`,
    unbounded.length > 0
      ? `no take, no identifier and no "bounded:" line:\n        ${unbounded.join('\n        ')}`
      : undefined,
  );
}

/* ---------------------------------------------------------------------------
   Four. Nothing waits on a blank screen
   --------------------------------------------------------------------------- */

/**
 * Pages that read the database sit under a loading boundary.
 *
 * Or are named here with a reason. The workshop side has had one since the
 * boundary was first drawn; the customer's side had none at all, which meant
 * every portal page showed a blank screen on mobile data outside a garage —
 * the one place where a blank screen reads as a link that did not work.
 */
const NO_BOUNDARY: Record<string, string> = {
  '/': 'the front page holds no workshop records and is rendered before anybody asks for it',
  '/pricing': 'plans and prices, the same for everybody, rendered ahead of the request',
  '/terms': 'written words on a page',
  '/verify': 'a form with nothing behind it until somebody types a registration',
  '/offline': 'what the technician sees when there is no network, so it cannot wait on one',
  '/login': 'a form. The reading happens when it is sent, not when it is drawn',
  '/forgot': 'a form, as above',
  '/signup': 'a form, as above',
  '/signup/customer': 'a form, as above',
  '/confirm-email': 'one sentence and a button to send the message again',
  '/choose':
    'the memberships of one person, and the page is the question. A boundary here would flush a shell before the count is known, and the answer for somebody on one team is a redirect into it rather than a page at all — which a committed 200 cannot perform.',
  '/reset/[token]':
    'drawn identically whether the token is real or not, on purpose, so it reads nothing before it is sent',
  '/invite/[token]': 'one row, by its own token, and the page is a yes or a no',
  '/verify-email/[token]': 'one row, by its own token, and the page is a yes or a no',
  '/print/[kind]/[id]': 'a document going to a printer. A loading state would print.',
  '/pay/[id]':
    'one row, looked up by its own identifier, and the page is drawn. A boundary here bought nothing and cost something real: the shell is sent before the lookup, so an attempt that does not exist answered 200 with the not-found screen inside it instead of 404. This is a public address that a link checker and a search engine will both read.',
  '/pay/subscribe/[orgId]': 'one workshop and its subscription, as above',
};

function nothingWaitsOnBlank() {
  console.info('\n  Nothing waits on a blank screen\n');

  const covered = (file: string): boolean => {
    let dir = dirname(file);
    while (dir.length >= APP.length) {
      if (existsSync(join(dir, 'loading.tsx'))) return true;
      dir = dirname(dir);
    }
    return false;
  };

  const naked: string[] = [];

  for (const route of everyRoute()) {
    const file = join(APP, route.slice(1), 'page.tsx');
    const source = read(file);
    const reads = /from '@\/lib\//.test(source) || /prisma\./.test(source);

    if (!reads) continue;
    if (covered(file)) continue;
    if (NO_BOUNDARY[visible(route)]) continue;

    naked.push(visible(route));
  }

  /* --- and every line of it is type-checked by something -------------------- */

  // Three phases running, a gate turned out to cover less than its name said.
  // `npm run typecheck` runs `tsc --build`, which follows project references,
  // and `apps/web` is not one — so the largest package in the repository had
  // no type gate at all until Phase 63. `infra/scripts` had none until Phase
  // 65, and pointing a compiler at it found thirty-one errors, the first of
  // which was real: `postedLines(orgId, range)` takes a required range whose
  // own comment says the bound is the point, and twenty-three probes were
  // calling it with one argument.
  //
  // So rather than a fourth fix of the same shape: every TypeScript file in
  // the repository must fall inside some tsconfig's `include`. That is what a
  // compiler uses to seed its program, so matching those globs asks the same
  // question as "does anything check this file".

  const INCLUDED: Readonly<Record<string, readonly string[]>> = {
    'packages/core': ['src/**/*.ts'],
    'packages/db': ['src/**/*.ts', 'prisma/**/*.ts', 'prisma.config.ts'],
    'packages/jobs': ['src/**/*.ts'],
    'packages/ui': ['src/**/*.ts', 'src/**/*.tsx'],
    'apps/worker': ['src/**/*.ts'],
    'apps/web': ['**/*.ts', '**/*.tsx'],
    infra: ['scripts/**/*.ts'],
  };

  // Every glob above is `<somewhere>**/*<extension>`: a place to start and an
  // ending. Written as a prefix and a suffix rather than turned into a regular
  // expression, because those are the only two shapes in use and a regular
  // expression here would be harder to read than the thing it matches.
  const insideSomeConfig = (file: string): boolean =>
    Object.entries(INCLUDED).some(([root, globs]) =>
      globs.some((glob) => {
        const [prefix, ending] = glob.split('**/*');
        return file.startsWith(`${root}/${prefix ?? ''}`) && file.endsWith(ending ?? '');
      }),
    );

  const sources: string[] = [];
  const walkSources = (at: string) => {
    for (const entry of readdirSync(at)) {
      if (['node_modules', '.next', 'generated', 'dist', '.git'].includes(entry)) continue;
      const full = join(at, entry);
      if (statSync(full).isDirectory()) walkSources(full);
      else if (/[.]tsx?$/.test(entry) && !/[.]d[.]ts$/.test(entry)) {
        sources.push(relative(process.cwd(), full).split(sep).join('/'));
      }
    }
  };
  walkSources(process.cwd());

  const unchecked = sources.filter((file) => !insideSomeConfig(file));

  check(
    unchecked.length === 0,
    `all ${sources.length} TypeScript files are inside some tsconfig, so something type-checks them`,
    unchecked.slice(0, 10).join(', '),
  );

  check(
    naked.length === 0,
    'every page that reads the database shows the car rather than nothing',
    naked.length > 0 ? naked.join(', ') : undefined,
  );

  // And the reasons stay honest: one that names a page that no longer exists
  // is a reason nobody has read since it was written.
  const addresses = new Set(everyRoute().map(visible));
  const stale = Object.keys(NO_BOUNDARY).filter((route) => !addresses.has(route));

  check(
    stale.length === 0,
    'and no reason is given for a page that no longer exists',
    stale.join(', '),
  );

  // A boundary that draws a spinner is not what was promised.
  const boundaries = everyRoute()
    .map((route) => join(APP, route.slice(1)))
    .flatMap((dir) => {
      const found: string[] = [];
      let at = dir;
      while (at.length >= APP.length) {
        const file = join(at, 'loading.tsx');
        if (existsSync(file)) found.push(file);
        at = dirname(at);
      }
      return found;
    });

  const spinners = [...new Set(boundaries)].filter((file) => !read(file).includes('LoadingCar'));

  check(
    spinners.length === 0,
    'and every one of them draws the vehicle, not a spinner',
    spinners.join(', '),
  );
}

function main() {
  console.info('\n  The four things that are not features');

  theChecksRun();
  everyScreenMeasured();
  listsHaveBounds();
  nothingWaitsOnBlank();

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`\n  ${checked} checks. The four promises are kept.\n`);
  }
}

main();
