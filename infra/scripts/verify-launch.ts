/**
 * Whether a workshop could be put on this on Monday. Phase 58.
 *
 *   npx tsx infra/scripts/verify-launch.ts                      the register
 *   node infra/scripts/with-env.mjs .vercel/prod.env \
 *     npx tsx infra/scripts/verify-launch.ts --handover         a deployment
 *
 * Every other check in this repository asks whether the product works. This
 * asks whether the copy of it in front of you has been configured to do
 * anything — a different question, with a nastier failure.
 *
 * The nastiest is not the setting that stops the product. A missing database
 * stops the boot and somebody fixes it in a minute. A mail transport left on
 * `console` stops nothing: every page works, every button responds, every
 * message is written down as queued, and not one customer hears a word. A
 * workshop would run on that for a fortnight before somebody noticed nobody
 * ever replies — and what they would conclude is that the product is broken,
 * because from where they sit it is.
 *
 * Two modes, deliberately. By default this checks the register itself: that
 * every setting the application reads is accounted for, that none is invented,
 * and that each says what a workshop would feel. That passes everywhere,
 * including on a laptop where everything is quite properly set to `console`.
 *
 * `--handover` is the judgement about one particular deployment: it fails
 * unless a real workshop could be put on it. Run it against production
 * before a first morning, and never in ordinary continuous integration, where
 * it would fail for ever and teach everybody to ignore it.
 *
 * Nothing here prints a value. A settings check that logs what it is checking
 * is a settings check nobody can run against production.
 */

import 'dotenv/config';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  describeReadiness,
  handover,
  readSettings,
  SETTINGS,
  type SettingVerdict,
} from '@carnet/core';

const FOR_REAL = process.argv.includes('--handover');

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

/* ---------------------------------------------------------------------------
   The register, against the application's own schema
   --------------------------------------------------------------------------- */

/**
 * Supplied by whoever is hosting this, not by whoever is configuring it.
 *
 * Nothing in the register can be said about these: they exist or they do not
 * depending on where the thing is running, and a workshop feels nothing either
 * way.
 */
const HOST_SUPPLIED = new Set([
  // NODE_ENV is deliberately not here. The host does set it, and it is still
  // worth reporting: anything but production leaves the breached-password
  // check off by default.
  'VERCEL',
  'VERCEL_ENV',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'AWS_LAMBDA_FUNCTION_NAME',
]);

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at)) {
      const full = join(at, entry);
      if (statSync(full).isDirectory()) {
        if (entry === 'node_modules' || entry === 'generated' || entry === '.next') continue;
        walk(full);
      } else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) {
        found.push(full);
      }
    }
  };
  walk(dir);
  return found;
}

/**
 * Every variable the application actually reads.
 *
 * Two sources, because the environment schema turned out not to be the whole
 * truth. It is the one place the application *declares* what it needs, and the
 * first draft of the register was written against it — which missed every
 * setting read straight from `process.env` without passing through it.
 *
 * Among them was STORAGE_DRIVER, whose absence writes every photograph to a
 * disk a serverless host discards. An inspection carried out, the evidence
 * taken, and gone — in the silent class, and invisible to a register written
 * against the file that looked authoritative.
 */
function declared(): string[] {
  const schema = readFileSync('apps/web/src/lib/env.ts', 'utf8');
  const body = schema.slice(schema.indexOf('const schema = z.object({'));
  const fromSchema = [...body.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]!);

  const fromSource = ['apps/web/src', 'packages/db/src', 'packages/jobs/src']
    .flatMap(filesUnder)
    .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)])
    .map((m) => m[1]!);

  return [...new Set([...fromSchema, ...fromSource])]
    .filter((name) => !HOST_SUPPLIED.has(name))
    .sort();
}

function theRegisterIsHonest() {
  console.info('\n  Every setting the application reads is accounted for\n');

  const app = declared();
  const register = SETTINGS.map((one) => one.name);

  const unaccounted = app.filter((name) => !register.includes(name));
  const invented = register.filter((name) => !app.includes(name));

  check(
    unaccounted.length === 0,
    `all ${app.length} of them say what a workshop would feel without them`,
    unaccounted.length > 0
      ? `${unaccounted.join(', ')} — add them to packages/core/src/launch/settings.ts`
      : undefined,
  );

  check(
    invented.length === 0,
    'and the register names none the application does not read',
    invented.join(', '),
  );

  check(
    SETTINGS.every((one) => one.felt.length > 20 && one.set.length > 5),
    'each says what happens without it, and what to set',
  );

  // The ordering is the point of the whole exercise, so it is asserted rather
  // than assumed: a silent failure comes before a loud one.
  const worstFirst = handover(readSettings({}, SETTINGS)).stopping;

  check(
    worstFirst.length === 0 || worstFirst[0]!.setting.consequence === 'silent',
    'and an empty environment complains about the silent failures first',
    worstFirst[0]?.setting.consequence,
  );
}

/* ---------------------------------------------------------------------------
   This deployment
   --------------------------------------------------------------------------- */

function thisDeployment() {
  console.info('\n  What this environment is configured to do\n');

  const readings = readSettings(process.env as Record<string, string | undefined>);
  const { ready, stopping } = handover(readings);

  console.info(`  ${describeReadiness(readings)}\n`);

  const mark: Record<SettingVerdict, string> = {
    ready: 'ok   ',
    missing: 'NONE ',
    pretending: 'FAKE ',
    'not needed': '--   ',
  };

  for (const one of stopping) {
    console.info(`  ${mark[one.verdict]} ${one.setting.name}  (${one.setting.consequence})`);
    console.info(`        ${one.setting.felt}`);
    console.info(`        Set: ${one.setting.set}\n`);
  }

  if (!FOR_REAL) {
    console.info(
      '  Reported, not judged. A laptop is meant to look like this: the\n' +
        '  transports are consoles and the money is pretend on purpose.\n' +
        '  Run with --handover against a real deployment to make it a verdict.\n',
    );
    return;
  }

  check(
    ready,
    'a real workshop could be put on this deployment',
    stopping.length > 0
      ? `${stopping.length} in the way, worst first: ${stopping.map((one) => one.setting.name).join(', ')}`
      : undefined,
  );
}

function main() {
  console.info(
    FOR_REAL
      ? '\n  Could a workshop be put on this deployment?'
      : '\n  Could a workshop be put on a deployment configured like this?',
  );

  theRegisterIsHonest();
  thisDeployment();

  if (failures > 0) {
    console.info(`  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(
      `\n  ${checked} checks. ${FOR_REAL ? 'Ready for a first morning.' : 'The register is honest.'}\n`,
    );
  }
}

main();
