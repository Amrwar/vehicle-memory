/**
 * One press, followed all the way through. Phase 59. NFR-803.
 *
 *   npx tsx infra/scripts/verify-trace.ts [baseUrl]
 *
 * Phase 50 answered "why did this customer not get their message". The
 * question a workshop asks more often is the same one pointed the other way —
 * *I pressed the button and nothing happened* — and until this phase nothing
 * could answer it, because no record said which press it came from.
 *
 * What is checked here is the chain and the discipline that keeps it whole:
 *
 *   The request mints one, and keeps one it was given.
 *   Every write a request causes carries it — checked against the source,
 *     because twenty-eight call sites across twenty files is exactly the
 *     shape of thing where one gets missed and nobody ever notices.
 *   A job inherits the trace of the event that woke it, and two jobs running
 *     at once do not read each other's.
 *   Nothing invents one. A reminder queued at four in the morning was nobody's
 *     press, and a trace on it would say a person was there.
 */

import 'dotenv/config';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { prisma } from '@carnet/db';
import { currentTrace, withTrace } from '@carnet/jobs';

import { follow, type Step } from '../../apps/web/src/lib/followed';
import { looksLikeTrace, mintTrace, TRACE_HEADER } from '../../apps/web/src/lib/trace';
import { hasTranslation } from '@carnet/core';

const BASE = process.argv[2] ?? 'http://localhost:3000';

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
   Every write a request causes carries it
   --------------------------------------------------------------------------- */

/**
 * Read off the source rather than trusted.
 *
 * The rule is simple and entirely unenforceable by hand: anything written
 * because somebody pressed something takes the trace of that press. There are
 * thirty-one places that write one of these four tables, spread over twenty
 * files, and the one somebody forgets next month is invisible — the record
 * still saves, the page still works, and one link of the chain is quietly
 * missing for whoever comes looking a year later.
 */
const TRACED_TABLES = ['auditLog', 'outboxEvent', 'messageLog', 'staffNotification'] as const;

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at)) {
      const full = join(at, entry);
      if (statSync(full).isDirectory()) {
        if (['node_modules', '.next', 'generated'].includes(entry)) continue;
        walk(full);
      } else if (/\.tsx?$/.test(full) && !full.endsWith('.d.ts')) {
        found.push(full);
      }
    }
  };
  walk(dir);
  return found;
}

function everyWriteCarriesIt() {
  console.info('\n  Everything a press causes carries the press\n');

  const pattern = new RegExp(
    `\\b(?:tx|prisma|db)\\.(${TRACED_TABLES.join('|')})\\.create(?:Many)?\\(`,
  );

  const unstamped: string[] = [];
  let sites = 0;

  for (const file of ['apps/web/src', 'packages/jobs/src'].flatMap(filesUnder)) {
    if (file.endsWith('.test.ts')) continue;

    const lines = readFileSync(file, 'utf8').split('\n');

    lines.forEach((line, index) => {
      if (!pattern.test(line)) return;
      sites += 1;

      // The call's own body: up to its closing brace at the same depth, or
      // thirty lines, whichever comes first.
      const block = lines.slice(index, index + 30).join('\n');
      const body = block.split(/\n\s{0,6}\}\);/)[0] ?? block;

      if (!/traceId/.test(body)) unstamped.push(`${file}:${index + 1}`);
    });
  }

  check(
    unstamped.length === 0,
    `all ${sites} places that write one of those four tables stamp the trace`,
    unstamped.join('\n        '),
  );

  // And the schema keeps it nullable, which is the difference between "nobody
  // pressed anything" and "we lost it".
  const schema = readFileSync('packages/db/prisma/schema.prisma', 'utf8');
  const required = [...schema.matchAll(/traceId\s+String(\?)?/g)].filter((m) => !m[1]);

  check(
    required.length === 0,
    'and the column stays nullable, so a scheduled job is not made to invent one',
    required.length > 0 ? `${required.length} declared non-null` : undefined,
  );
}

/* ---------------------------------------------------------------------------
   The words, including the ones no scanner can see
   --------------------------------------------------------------------------- */

/**
 * The four steps are rendered as `t(moment.step)` — a variable, not a literal.
 *
 * Neither i18n-scan nor verify-languages can see that: both collect literals.
 * So without this check the chain would read in English inside a French
 * session with every other check green. The same gap as the runbook in Phase
 * 57, in a different place, which is why it is worth a check of its own rather
 * than a resolution to remember.
 */
const STEPS: Step[] = ['recorded', 'queued', 'told', 'sent'];

function theStepsAreTranslated() {
  console.info('\n  The words, including the ones no scanner can see\n');

  // Asked of the merged dictionary rather than of one area file, because the
  // merged dictionary is what `t()` reads. This probe used to import
  // `areas/health` directly and passed for months; Phase 71 moved `queued` to
  // the area the word belongs to, the merged dictionary still answered it,
  // and the probe reported a translation missing that was not. A check that
  // reads a different thing from the product is checking a different product.
  const missing = STEPS.flatMap((step) => [
    ...(hasTranslation('fr', step) ? [] : [`fr: ${step}`]),
    ...(hasTranslation('ar', step) ? [] : [`ar: ${step}`]),
  ]);

  check(
    missing.length === 0,
    'each step of the chain is answered in French and in Arabic',
    missing.join(', '),
  );
}

/* ---------------------------------------------------------------------------
   The shape of one, and what a stranger may send
   --------------------------------------------------------------------------- */

function theShape() {
  console.info('\n  What one looks like\n');

  const made = mintTrace();

  check(looksLikeTrace(made), 'a minted trace is one this product recognises', made);
  check(made.length <= 16, 'and short enough to read down a telephone', made.length);

  check(
    !looksLikeTrace('<script>alert(1)</script>') &&
      !looksLikeTrace('t-' + 'z'.repeat(12)) &&
      !looksLikeTrace(''),
    'and anything that is not one is refused, because this goes in a log and a search box',
  );

  const two = new Set(Array.from({ length: 500 }, () => mintTrace()));
  check(two.size === 500, 'five hundred in a row are five hundred different ones', two.size);
}

/* ---------------------------------------------------------------------------
   A job inherits it, and two jobs do not share it
   --------------------------------------------------------------------------- */

async function jobsInheritIt() {
  console.info('\n  A background job inherits the press that caused it\n');

  check(currentTrace() === null, 'outside any job, there is no trace to inherit');

  const seen = await withTrace('t-aaaaaaaaaaaa', async () => currentTrace());
  check(seen === 't-aaaaaaaaaaaa', 'inside one, the handler can read it without being passed it');

  // The reason it is async-local rather than a variable: the worker handles a
  // batch, and one workshop's message must never be attributed to another
  // workshop's press.
  const [first, second] = await Promise.all([
    withTrace('t-111111111111', async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return currentTrace();
    }),
    withTrace('t-222222222222', async () => currentTrace()),
  ]);

  check(
    first === 't-111111111111' && second === 't-222222222222',
    'and two jobs running at once cannot read each other’s',
    `${first} / ${second}`,
  );

  check(currentTrace() === null, 'and nothing leaks out of the context afterwards');
}

/* ---------------------------------------------------------------------------
   Against the running application
   --------------------------------------------------------------------------- */

async function theRealThing() {
  console.info('\n  Against the running application\n');

  const response = await fetch(`${BASE}/login`, { redirect: 'manual' });
  const given = response.headers.get(TRACE_HEADER);

  check(
    given !== null && looksLikeTrace(given),
    'every response carries the trace of the request that made it',
    given,
  );

  const second = await fetch(`${BASE}/login`, { redirect: 'manual' });
  check(
    second.headers.get(TRACE_HEADER) !== given,
    'and a second request gets its own',
    second.headers.get(TRACE_HEADER),
  );

  // A trace already on the way in is kept, so a provider's webhook can be
  // followed from their side to ours.
  const mine = mintTrace();
  const kept = await fetch(`${BASE}/login`, {
    redirect: 'manual',
    headers: { [TRACE_HEADER]: mine },
  });

  check(kept.headers.get(TRACE_HEADER) === mine, 'one offered on the way in is kept', mine);

  // And one that is not the right shape is not. This goes into a log line and
  // a search box, and a header a stranger controls belongs in neither without
  // being looked at first.
  const nasty = await fetch(`${BASE}/login`, {
    redirect: 'manual',
    headers: { [TRACE_HEADER]: 'not-a-trace-<script>' },
  });

  const answered = nasty.headers.get(TRACE_HEADER);
  check(
    answered !== 'not-a-trace-<script>' && answered !== null && looksLikeTrace(answered),
    'and one that is not the right shape is replaced rather than carried',
    answered,
  );
}

/* ---------------------------------------------------------------------------
   And the chain can be followed
   --------------------------------------------------------------------------- */

async function theChain() {
  console.info('\n  And one press can be followed through\n');

  const trace = mintTrace();
  const org = await prisma.organization.findFirstOrThrow({
    where: { slug: 'hillside-motors' },
    select: { id: true },
  });

  const user = await prisma.user.findFirstOrThrow({
    where: { memberships: { some: { orgId: org.id } } },
    select: { id: true },
  });

  // One press, written the way the product writes it: an action recorded, an
  // event queued, a message put in the queue.
  await prisma.auditLog.create({
    data: {
      traceId: trace,
      orgId: org.id,
      actorUserId: user.id,
      action: 'trace.probe',
      entityType: 'Job',
      entityId: 'trace-probe',
    },
  });

  await prisma.outboxEvent.create({
    data: { traceId: trace, orgId: org.id, type: 'trace.probe', payload: {} as never },
  });

  await prisma.messageLog.create({
    data: {
      traceId: trace,
      orgId: org.id,
      channel: 'EMAIL',
      toAddress: 'trace-probe@carnet.test',
      subject: 'trace probe',
      body: 'trace probe',
    },
  });

  const followed = await follow(trace);

  check(followed.moments.length === 3, 'all three records answer to it', followed.moments.length);

  check(
    followed.moments.map((one) => one.step).join(' → ') === 'recorded → queued → sent',
    'in the order they happened, which is where it stops that says what went wrong',
    followed.moments.map((one) => one.step).join(' → '),
  );

  const invented = await follow(mintTrace());
  check(invented.moments.length === 0, 'and a trace nothing carries finds nothing');

  // The audit log refuses deletion by design, so the probe's own row stays.
  // The other two are its to clear, and it clears them: a probe that leaves
  // rows behind is a probe whose second run measures its first.
  await prisma.outboxEvent.deleteMany({ where: { traceId: trace } });
  await prisma.messageLog.deleteMany({ where: { traceId: trace } });

  const after = await follow(trace);
  check(
    after.moments.length === 1 && after.moments[0]!.step === 'recorded',
    'the probe took away everything it could, and says what it could not',
    'the audit record stays, because audit_logs refuses deletion — which is the point of it',
  );
}

async function main() {
  console.info('\n  One press, followed all the way through');

  everyWriteCarriesIt();
  theStepsAreTranslated();
  theShape();
  await jobsInheritIt();
  await theRealThing();
  await theChain();

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`\n  ${checked} checks. A press can be followed to the inbox.\n`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
