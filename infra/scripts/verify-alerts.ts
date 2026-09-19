/**
 * Whether anybody would be told. Phase 57.
 *
 *   npx tsx infra/scripts/verify-alerts.ts
 *
 * Phase 50 put every signal on a page and Phase 56 wrote down that nothing
 * ever sent a message about any of them. This checks the part that now does:
 * that a thing going wrong produces one message rather than none or six, that
 * the message carries the one thing to do, that a signal nobody has written an
 * action for cannot become a message at all, and that the whole apparatus
 * makes no noise at four in the morning about something that is fine.
 *
 * The state is real — rows in `operator_alerts` — and this probe puts the
 * table back exactly as it found it, because an alerting system that has been
 * told a lie by its own test is an alerting system that stays quiet about the
 * real thing for six hours.
 */

import 'dotenv/config';

import {
  alertBody,
  alertSubject,
  decideAlerts,
  explained,
  QUIET_FOR_MS,
  type Remembered,
  RUNBOOK,
  signal,
  type Signal,
  type Standing,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { openAlerts, sweepAlerts, withoutAnAction } from '../../apps/web/src/lib/alerts';
import { ar, fr } from '../../packages/core/src/i18n/areas/health';

let failures = 0;
let checked = 0;

function check(ok: boolean, what: string, detail?: unknown) {
  checked += 1;
  if (ok) {
    console.info(`  ok    ${what}`);
  } else {
    failures += 1;
    console.info(`  FAIL  ${what}${detail === undefined ? '' : `  (${String(detail)})`}`);
  }
}

const NOW = new Date('2026-09-19T04:00:00Z');

const said = (name: string, standing: Standing): Signal =>
  signal({
    area: 'Workers',
    name,
    standing,
    template: '{count} waiting.',
    values: { count: 40 },
  });

const was = (key: string, standing: Standing, sentAt: Date | null): Remembered => ({
  key,
  standing,
  sentAt,
});

async function main() {
  console.info('\n  Whether anybody would be told\n');

  /* --- every signal has an action, or it cannot be sent -------------------- */

  console.info('  An alert with no action is not an alert');

  // Read off the live health page rather than off a list. A signal added next
  // month is caught the first time it is reported, rather than the first time
  // it goes wrong — which would be the worst possible moment to find out that
  // nobody wrote down what to do about it.
  const missing = await withoutAnAction();

  check(
    missing.length === 0,
    `every one of the health page's signals has a runbook entry`,
    missing.length > 0 ? missing.join(', ') : undefined,
  );

  check(
    RUNBOOK.every((entry) => entry.first.trim().length > 20 && entry.done.trim().length > 10),
    `all ${RUNBOOK.length} of them say the first thing to do and what done looks like`,
  );

  // And a signal nobody has written about is refused rather than sent empty.
  const invented = decideAlerts({
    signals: [said('A signal invented next month', 'failed')],
    remembered: [],
    now: NOW,
  });

  check(
    invented.alerts.length === 0 && invented.unexplained.length === 1,
    'a signal with no entry sends nothing, and is named as needing one',
    invented.unexplained.join(', '),
  );

  /* --- the words a person actually reads ---------------------------------- */

  console.info('\n  Translated, including the part no scanner can see');

  // t(runbook.first) is a dynamic argument, so neither i18n-scan nor
  // verify-languages can see it: both collect literals. Without this check the
  // operator's page would quietly be English inside a French session and
  // nothing anywhere would say so.
  const untranslated = RUNBOOK.flatMap((entry) => [
    ...(fr[entry.first] ? [] : [`fr: ${entry.signal}`]),
    ...(ar[entry.first] ? [] : [`ar: ${entry.signal}`]),
  ]);

  check(
    untranslated.length === 0,
    'every runbook action is answered in French and in Arabic',
    untranslated.join(', '),
  );

  /* --- one message, not none and not six ---------------------------------- */

  console.info('\n  One message, not none and not six');

  const first = decideAlerts({
    signals: [said('Events waiting', 'failed')],
    remembered: [],
    now: NOW,
  });

  check(
    first.alerts.length === 1 && first.alerts[0]!.kind === 'raised',
    'the first time, it sends',
  );

  const again = decideAlerts({
    signals: [said('Events waiting', 'failed')],
    remembered: [was('Events waiting', 'failed', new Date(NOW.getTime() - 60_000))],
    now: NOW,
  });

  check(again.alerts.length === 0, 'an hour later, with nothing changed, it says nothing');

  const worse = decideAlerts({
    signals: [said('Events waiting', 'failed')],
    remembered: [was('Events waiting', 'degraded', new Date(NOW.getTime() - 60_000))],
    now: NOW,
  });

  check(
    worse.alerts[0]?.kind === 'worse',
    'but it speaks up straight away when the same thing gets worse',
  );

  const later = decideAlerts({
    signals: [said('Events waiting', 'failed')],
    remembered: [was('Events waiting', 'failed', new Date(NOW.getTime() - QUIET_FOR_MS - 1))],
    now: NOW,
  });

  check(later.alerts.length === 1, 'and again once the quiet period is over');

  const over = decideAlerts({
    signals: [said('Events waiting', 'healthy')],
    remembered: [was('Events waiting', 'failed', new Date(NOW.getTime() - 60_000))],
    now: NOW,
  });

  check(over.alerts[0]?.kind === 'cleared', 'and says so when it is over');

  const neverSaid = decideAlerts({
    signals: [said('Events waiting', 'healthy')],
    remembered: [was('Events waiting', 'failed', null)],
    now: NOW,
  });

  check(
    neverSaid.alerts.length === 0,
    'but never announces the end of something it never announced',
  );

  /* --- what the message says ---------------------------------------------- */

  console.info('\n  What a person reads at four in the morning');

  const chain = decideAlerts({
    signals: [said('Passport chains', 'failed')],
    remembered: [],
    now: NOW,
  }).alerts[0]!;

  const body = alertBody(chain, 'https://carnet.test/admin/health');

  check(
    alertSubject(chain) === 'Carnet failed: Passport chains',
    'the subject says which and how bad, because that is all a telephone shows',
    alertSubject(chain),
  );

  check(
    body.includes('First thing:') && body.includes('Fixed when:'),
    'and the message carries the one thing to do, and what done looks like',
  );

  check(body.includes('/admin/health'), 'and where to look at everything else');

  /* --- against the real thing --------------------------------------------- */

  console.info('\n  Against the database, on the real health page');

  const before = await prisma.operatorAlert.findMany({ select: { key: true } });

  const told = await sweepAlerts();

  check(
    told.unexplained.length === 0,
    'a real sweep finds nothing it cannot explain',
    told.unexplained.join(', '),
  );

  const open = await openAlerts();

  // A healthy seeded database should produce nothing worth waking anybody for.
  // If it does, that is worth knowing, and it is not a failure of this probe.
  console.info(
    open.length === 0
      ? '\n  Nothing on this database is worth waking anybody for.'
      : `\n  ${open.length} open: ${open.map((one) => `${one.key} (${one.standing})`).join(', ')}`,
  );

  // Put the table back. Rows this run created are removed; rows that were
  // already there are left exactly as they were, because they are somebody's
  // real state and the quiet period depends on them.
  const known = new Set(before.map((one) => one.key));
  const made = open.filter((one) => !known.has(one.key)).map((one) => one.key);

  if (made.length > 0) {
    await prisma.operatorAlert.deleteMany({ where: { key: { in: made } } });
  }

  check(
    (await prisma.operatorAlert.count()) === before.length,
    'and the probe left the alert state as it found it',
    `${before.length} before`,
  );

  /* --- and it is actually wired up ---------------------------------------- */

  console.info('\n  And something runs it');

  const cron = await import('node:fs').then((fs) =>
    fs.readFileSync('apps/web/src/app/api/cron/[job]/route.ts', 'utf8'),
  );

  check(cron.includes('sweepAlerts'), 'the hourly job asks whether anybody needs telling');

  check(
    explained().length === RUNBOOK.length,
    `${RUNBOOK.length} things can go wrong and each has somewhere to start`,
  );

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`\n  ${checked} checks. Somebody would be told.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
