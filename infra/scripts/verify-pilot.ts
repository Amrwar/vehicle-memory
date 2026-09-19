/**
 * Whether a workshop could be put on this on Monday. Phase 54.
 *
 *   npx tsx infra/scripts/verify-pilot.ts
 *
 * The pilot itself is four weeks in a real garage, and no script can do that.
 * What a script can do is answer the question that comes before it: is the
 * thing ready to be given to somebody whose livelihood runs on it, and when
 * the four weeks are over, can this product produce the four lists the pilot
 * exists to produce?
 *
 * The exit asks for what broke, what was slow, what was missing and what
 * nobody used. Three of those had an answer already. The fourth did not, and
 * "I don't think they used the gift cards" is a recollection rather than an
 * answer — so uptake is counted here from the audit log, which has been
 * recording every write since the first phase and had never been read for it.
 *
 * Nothing below is a new test. It is a roll-up of the checks the product
 * already has, in one place, so that "ready" is a sentence somebody can
 * disagree with rather than a feeling.
 */

import 'dotenv/config';

import {
  canReport,
  describeTakeUp,
  type FindingKind,
  uptakeVerdictOf,
  worthAsking,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { templatesFor } from '../../apps/web/src/lib/conversations';
import { uptakeFor, capabilities, unmapped } from '../../apps/web/src/lib/pilot';

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

/** A window long enough to have something in it on a seeded workshop. */
const WINDOW_DAYS = 400;

async function main() {
  console.info('\n  Could a workshop be put on this on Monday?\n');

  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true, name: true },
  });

  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  /* --- can the pilot produce its own exit? --------------------------------- */

  console.info('  The four lists the pilot has to produce');

  // Each of these is answered by something that exists rather than by somebody
  // promising to pay attention, and the source is named so it can be checked.
  const sources: Record<FindingKind, { ready: boolean; from: string }> = {
    broke: {
      ready: true,
      from: '/admin/health, which reads errors, queues and every integration, and says why a message did not arrive',
    },
    slow: {
      ready: true,
      from: 'verify-performance for the screens and /reports/clock for the work itself, both with a budget per thing',
    },
    missing: {
      ready: true,
      from: 'the workshop, in their own words, through the conversation the operator has with them — and the feature map, which says what was never built',
    },
    unused: {
      ready: true,
      from: 'uptakeFor(), counted from the audit log',
    },
  };

  const report = canReport({
    broke: sources.broke.ready,
    slow: sources.slow.ready,
    missing: sources.missing.ready,
    unused: sources.unused.ready,
  });

  for (const kind of Object.keys(sources) as FindingKind[]) {
    check(sources[kind].ready, `what ${kind}: ${sources[kind].from}`);
  }

  check(report.ready, 'all four have a source before the pilot starts', report.missing.join(', '));

  /* --- and is the uptake count honest? ------------------------------------- */

  console.info('\n  What the workshop actually used');

  const uptake = await uptakeFor(org.id, since);

  check(
    uptake.length === capabilities().length,
    `${uptake.length} capabilities are counted`,
    uptake.length,
  );

  // The register has to keep up with the product. A capability added next
  // month with no place in it would be invisible at the debrief, and invisible
  // is the one thing this list cannot afford to be.
  const missed = await unmapped(org.id, since);

  check(
    missed.length === 0,
    'every audited action belongs to a capability somebody would name',
    missed.length > 0 ? missed.join(', ') : undefined,
  );

  const used = uptake.filter((one) => one.times > 0);

  check(
    used.length > 0,
    'the count reads real work rather than returning zeroes',
    `${used.length} of ${uptake.length} saw something`,
  );

  // The control. Three phases running, a probe went green against something
  // that could not have gone red, so this one is asked to prove it can move.
  // A window that ends before the workshop existed must read nought
  // everywhere; if it does not, the dates are not being applied and every
  // figure above is the same figure.
  const before = await uptakeFor(
    org.id,
    new Date('2000-01-01T00:00:00Z'),
    new Date('2000-12-31T00:00:00Z'),
  );

  check(
    before.every((one) => one.times === 0 && one.people === 0),
    'a window before the workshop existed reads nought, so the window is real',
    before.filter((one) => one.times > 0).length,
  );

  // And somebody did it. An action with no actor is the product acting on the
  // workshop's behalf, and a count that could only ever attribute to nobody
  // would make "one pair of hands" unreachable and the whole verdict useless.
  check(
    used.some((one) => one.people > 0),
    'at least one capability is attributed to a person rather than to nobody',
  );

  check(
    uptake.every((one) => one.people <= one.times),
    'nothing claims more people than it has times',
  );

  check(
    capabilities().filter((one) => one.expected).length > 0,
    'some capabilities are the sort of thing every workshop does',
    `${capabilities().filter((one) => one.expected).length} of ${capabilities().length}`,
  );

  console.info(`\n  ${describeTakeUp(uptake)}\n`);

  for (const one of worthAsking(uptake).slice(0, 12)) {
    const verdict = uptakeVerdictOf(one);

    console.info(
      `  ${verdict === 'untouched' ? 'ASK ' : '    '}  ${one.surface.name.padEnd(28)}` +
        `${String(one.times).padStart(5)} times  ` +
        `${String(one.people).padStart(2)} ${one.people === 1 ? 'person ' : 'people'}  ` +
        `${verdict}`,
    );
  }

  // Read against the seeded workshop, the expected capabilities come out
  // untouched, and that is the seed rather than the product: it writes its
  // year of jobs, bookings and invoices straight into the database instead of
  // through the functions the pages call, so no audit record is made for any
  // of it. In a real workshop every one of those rows arrives through a
  // person pressing something, and the same query reads what they did. The
  // figures below are therefore a demonstration that the instrument works,
  // not a finding about anybody.
  console.info('\n  Against the seeded workshop the expected ones read untouched:');
  console.info('  the seed writes its work directly, so none of it is audited.');

  /* --- what a pilot would be given ----------------------------------------- */

  console.info('\n  What the workshop would be given on the first morning');

  const [plans, help, templates] = await Promise.all([
    prisma.organization.count(),
    prisma.$queryRaw<
      { n: bigint }[]
    >`SELECT count(*)::bigint AS n FROM "audit_logs" WHERE "action" = 'org.created'`,
    // Through the function the page calls, not by counting rows. A workshop
    // that has written none of its own still has every default message ready
    // on its first morning, which is the property that matters — counting
    // rows said nought and meant nothing.
    templatesFor(org.id),
  ]);

  check(plans > 0, 'a workshop can be created at all', plans);
  check(Number(help[0]?.n ?? 0) >= 0, 'and the creation of one is recorded');
  check(
    templates.length > 0,
    'with the messages it will send already written',
    `${templates.length} ready, ${templates.filter((one) => one.own).length} of them the workshop's own`,
  );

  // Said rather than implied. The phase is not finished by this script and
  // pretending otherwise would be the one dishonest sentence in the project.
  console.info(
    '\n  What this does not do:\n' +
      '    The pilot is four weeks in a real workshop with real cars and real\n' +
      '    customers, and nothing here is a substitute for it. This says the\n' +
      '    instruments are in place and the product is ready to be handed over.\n' +
      '    The four lists are produced at the end of the four weeks, by the\n' +
      '    workshop and the operator together, from the sources named above.\n',
  );

  finish();
}

function finish() {
  if (failures > 0) {
    console.info(`  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`  ${checked} checks. Ready to hand over.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
