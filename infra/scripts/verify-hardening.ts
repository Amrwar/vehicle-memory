/**
 * A leaked password is refused, and the check fails open.
 *
 *   npx tsx infra/scripts/verify-hardening.ts
 *
 * The breach check talks to Have I Been Pwned by k-anonymity. This does not:
 * it hands the check a stub for the range service, so it runs the same way
 * offline and in CI, and asserts three things. A password whose suffix is in
 * the range is refused with a sentence that says how often it has leaked. A
 * password not in the range passes. And when the service is unreachable the
 * check passes and says so in the log, because a sign-up that cannot complete
 * because a third party is down is the worse failure.
 *
 * Nothing is written; there is nothing to clean up.
 */

import 'dotenv/config';

process.env.PASSWORD_BREACH_CHECK = 'on';

import { passwordRange } from '@carnet/core';

let failures = 0;

function check(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.info(`  ok     ${label}: ${JSON.stringify(actual)}`);
  } else {
    failures += 1;
    console.error(
      `  FAIL   ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

async function main() {
  // Imported after the environment is set, so the setting is read as "on".
  const { breachedPasswordProblem } = await import('../../apps/web/src/lib/breach');

  const leaked = 'correct horse battery staple';
  const { prefix, suffix } = passwordRange(leaked);

  const range = async (asked: string) =>
    asked === prefix
      ? `0000000000000000000000000000000000A:1\n${suffix}:4213\n`
      : 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:1\n';

  console.info('\nA password that has leaked');
  const problem = await breachedPasswordProblem(leaked, range);
  check('is refused', problem !== null, true);
  check('  saying how often', /4,213 times/.test(problem ?? ''), true);
  check('  and what to do instead', /four unrelated words/.test(problem ?? ''), true);

  console.info('\nOne that has not');
  check('passes', await breachedPasswordProblem('a genuinely private phrase 7731', range), null);

  console.info('\nWhen the service cannot be reached');
  const warnings: string[] = [];
  const original = console.warn;
  console.warn = (line: string) => warnings.push(String(line));
  try {
    check('the check fails open', await breachedPasswordProblem(leaked, async () => null), null);
  } finally {
    console.warn = original;
  }
  check(
    '  and says so in the log',
    warnings.some((line) => line.includes('breach.check.unavailable')),
    true,
  );

  console.info('\nSwitched off');
  process.env.PASSWORD_BREACH_CHECK = 'off';
  const { breachedPasswordProblem: again } = await import('../../apps/web/src/lib/breach');
  // The environment is parsed once per process; the setting read at import
  // is the one that counts, which is why production sets it before start.
  check('the import made under "on" still checks', (await again(leaked, range)) !== null, true);

  console.info(
    failures === 0
      ? '\nverify-hardening: all checks passed'
      : `\nverify-hardening: ${failures} FAILED`,
  );
  if (failures > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
