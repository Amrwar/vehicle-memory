/**
 * The checks, in the order CI runs them. Phase 70.
 *
 *   npm run checks                            the ones needing only a database
 *   npm run checks http://localhost:3000      and the ones needing the app too
 *
 * Named `run-checks` rather than `verify-locally`, because it is not one of
 * the checks: it runs them. The first name put it in the `verify-*` namespace,
 * and `verify-throughout` immediately insisted that CI run it too — which
 * would have run all eighty-eight a second time, inside the first. The check
 * was right and the name was wrong.
 *
 * Eighty-eight verification scripts, and until now no way to run them locally
 * the way they are actually run. CI reseeds the database at three points
 * because several of them assert exact opening balances and then change them —
 * `verify-inventory` books stock in and does not put it back, and its step in
 * the workflow says so. Locally there was no such orchestration, so running two
 * probes in a row could leave the second measuring the first.
 *
 * The result was not a broken check. It was worse: a check that fails for a
 * reason that has nothing to do with the code, in language identical to a real
 * defect. Three times in one week that cost somebody an investigation before
 * they noticed the database was simply dirty.
 *
 * The order is read out of `.github/workflows/ci.yml` rather than copied into
 * a list here. A list somebody types falls behind the day somebody adds a
 * script, and this repository has found that four times now: the screens probe
 * measuring a third of the screens, the traceability summary counting itself
 * wrong, the tenant filter covering a third of the models, the type gate
 * covering none of the web app. The workflow is the one place that already has
 * to be right.
 */

import 'dotenv/config';

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..');

interface Step {
  /** As it appears in the workflow, for reporting. */
  what: string;
  command: string;
  /** Whether it wants the application running, not merely a database. */
  needsApp: boolean;
}

/**
 * Every probe and reseed in the workflow, in the order they appear.
 *
 * Matched on the command rather than on the step's name: a step can be renamed
 * without changing what it runs, and what it runs is the thing that matters.
 */
function stepsFromCi(): Step[] {
  const lines = readFileSync(join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8').split('\n');
  const steps: Step[] = [];

  for (const line of lines) {
    const trimmed = line
      .trim()
      .replace(/^-\s*/, '')
      .replace(/^run:\s*/, '');

    if (trimmed === 'npm run db:seed') {
      steps.push({ what: 'reseed the database', command: 'npm run db:seed', needsApp: false });
      continue;
    }

    const probe = /^npx tsx (?:--tsconfig \S+ )?(infra\/scripts\/verify-[a-z-]+\.ts)(.*)$/.exec(
      trimmed,
    );

    if (!probe) continue;

    const args = (probe[2] ?? '').trim();
    steps.push({
      what: probe[1]!.replace('infra/scripts/', '').replace('.ts', ''),
      command: trimmed,
      needsApp: args.includes('http'),
    });
  }

  return steps;
}

async function reachable(base: string): Promise<boolean> {
  try {
    const answer = await fetch(base, { redirect: 'manual' });
    return answer.status > 0;
  } catch {
    return false;
  }
}

async function main() {
  const base = process.argv[2];
  const all = stepsFromCi();

  // Before anything, because twenty-nine probes that cannot reach the app
  // report twenty-nine failures, and every one of them is ECONNREFUSED
  // wearing the name of a feature. The first run of this script did exactly
  // that, which is the fault it was written to cure.
  if (base && !(await reachable(base))) {
    console.error(
      `\n  Nothing is answering at ${base}.\n\n` +
        '  The checks that need the application would all fail, and each would\n' +
        '  fail in the language of whatever it checks rather than saying the\n' +
        '  app is not running.\n\n' +
        '  Start it with `npm run build && npm start`, or leave the address off\n' +
        '  to run only the checks that need a database.\n',
    );
    process.exitCode = 1;
    return;
  }

  const steps = base ? all : all.filter((step) => !step.needsApp);

  console.info(`\n  The checks, in the order CI runs them\n`);
  console.info(
    `  ${all.length} steps in the workflow` +
      (base ? '' : `, ${all.length - steps.length} of them skipped for want of a running app`) +
      '\n',
  );

  const failed: string[] = [];
  const started = Date.now();

  for (const [index, step] of steps.entries()) {
    const command = base ? step.command.replace('http://localhost:3000', base) : step.command;
    const at = `${String(index + 1).padStart(2)}/${steps.length}`;

    process.stdout.write(`  ${at}  ${step.what.padEnd(26)}`);

    const began = Date.now();
    const run = spawnSync(command, {
      cwd: ROOT,
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf8',
    });

    const seconds = Math.round((Date.now() - began) / 1000);

    if (run.status === 0) {
      console.info(`ok    ${seconds}s`);
      continue;
    }

    failed.push(step.what);
    console.info(`FAIL  ${seconds}s`);

    // The lines that say what failed, not the tail. The tail of a probe is its
    // own summary — "1 of 15 checks failed" — which is the one thing the
    // reader already knows. The first version of this printed the tail and hid
    // the cause behind it, which took two runs of three minutes each to notice.
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`
      .split('\n')
      .filter((line) => line.trim().length > 0);

    const blamed = output.filter((line) => /\b(FAIL|BROKEN)\b/.test(line));
    const said = blamed.length > 0 ? blamed.slice(0, 6) : output.slice(-6);

    for (const line of said) console.info(`        ${line}`);
  }

  const minutes = Math.round((Date.now() - started) / 6000) / 10;

  if (failed.length === 0) {
    console.info(`\n  All ${steps.length} steps passed, in ${minutes} minutes.\n`);
    return;
  }

  console.info(`\n  ${failed.length} of ${steps.length} failed, in ${minutes} minutes:`);
  for (const one of failed) console.info(`    ${one}`);
  console.info('');
  process.exitCode = 1;
}

main();
