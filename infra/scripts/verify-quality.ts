/**
 * The other half of the requirements. Phase 56.
 *
 *   npx tsx infra/scripts/verify-quality.ts
 *
 * There are eighty-four non-functional requirements and, until this phase,
 * exactly one of them appeared in the traceability matrix. The functional side
 * has been traced requirement by requirement for fifty phases; the quality
 * side — how fast, how safe, how private, how legible, how available — was a
 * document with numbers in it and nothing pointing at the code.
 *
 * Several were in fact enforced, some of them thoroughly: the recovery targets
 * have been measured since Phase 49, the performance budgets since Phase 51,
 * the translation rule since Phase 40.5. They were enforced anonymously. A
 * requirement whose enforcement nobody can name is a requirement nobody can
 * check has stopped being enforced.
 *
 * So every one of the eighty-four is accounted for here, as one of three
 * things, and the register is checked against the document rather than trusted:
 *
 *   checked   Something runs and would fail. The thing that runs is named and
 *             has to exist.
 *   read      True of the repository as it stands, and asserted below, here,
 *             now — not by a script somewhere else.
 *   not yet   Not enforced by anything. What it would take is written down,
 *             because "not yet" without that is a wish.
 *
 * The last kind is the point of the exercise. Seventeen of the eighty-four need
 * a person, a production deployment, or a month of real traffic, and saying so
 * out loud is worth more than a green tick that means somebody once looked.
 */

import 'dotenv/config';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { redaction } from '../../packages/jobs/src/log';

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

const exists = (path: string) => {
  try {
    statSync(path);
    return true;
  } catch {
    return false;
  }
};

function filesUnder(dir: string, match: RegExp): string[] {
  const found: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at)) {
      const full = join(at, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (match.test(full)) found.push(full);
    }
  };
  walk(dir);
  return found;
}

/* ---------------------------------------------------------------------------
   The register
   --------------------------------------------------------------------------- */

type How = 'checked' | 'read' | 'not yet';

interface Account {
  how: How;
  /** For `checked`: the file that would fail. Must exist. */
  by?: string;
  /** In one line: what enforces it, or what it would take. */
  note: string;
}

const REGISTER: Record<string, Account> = {
  /* --- NFR-100, performance ----------------------------------------------- */
  'NFR-101': {
    how: 'checked',
    by: 'infra/scripts/verify-performance.ts',
    note: 'a read of a single record, p95 under 200 ms, measured over twenty samples per screen',
  },
  'NFR-102': {
    how: 'checked',
    by: 'infra/scripts/verify-performance.ts',
    note: 'a list of up to fifty rows, p95 under 400 ms',
  },
  'NFR-103': {
    how: 'checked',
    by: 'infra/scripts/verify-performance.ts',
    note: 'the diary week, p95 under 600 ms',
  },
  'NFR-104': {
    how: 'checked',
    by: 'infra/scripts/verify-performance.ts',
    note: 'the passport with five hundred events, p95 under 800 ms',
  },
  'NFR-105': {
    how: 'checked',
    by: 'infra/scripts/verify-paint.ts',
    note: 'Largest Contentful Paint over an emulated Slow 4G connection on a slowed processor, three runs a screen, the middle one counting. Phase 60.',
  },
  'NFR-106': {
    how: 'not yet',
    note: 'Interaction to Next Paint. A field measurement: it needs real fingers on real devices, which means the pilot. Deliberately not folded into verify-paint, because a number from an emulator wearing a field metric’s name is worse than no number.',
  },
  'NFR-107': {
    how: 'checked',
    by: 'infra/scripts/verify-paint.ts',
    note: 'Cumulative Layout Shift on the same runs, with a control proving the measurement can see a shift. Phase 60.',
  },
  'NFR-108': {
    how: 'not yet',
    note: 'the technician list interactive in 1.5 s on a workshop tablet over its own Wi-Fi. Needs the tablet and the Wi-Fi.',
  },
  'NFR-109': {
    how: 'checked',
    by: 'infra/scripts/verify-storage.ts',
    note: 'a photograph reaches the store and comes back; the acknowledgement timing itself needs a device',
  },
  'NFR-110': {
    how: 'not yet',
    note: 'no query over 100 ms without an index-backed plan. Needs query logging from a loaded deployment; verify-performance measures the screen rather than the plan behind it.',
  },
  'NFR-111': {
    how: 'checked',
    by: 'infra/scripts/verify-throughout.ts',
    note: 'every list has a bound or a written reason saying what holds it. Phase 55.',
  },

  /* --- NFR-200, scalability ------------------------------------------------ */
  'NFR-201': {
    how: 'not yet',
    note: 'two thousand tenants on one deployment. Needs a deployment with two thousand tenants on it.',
  },
  'NFR-202': {
    how: 'not yet',
    note: 'five thousand concurrent users. Needs a load generator and somewhere to point it.',
  },
  'NFR-203': {
    how: 'checked',
    by: 'infra/scripts/verify-performance.ts',
    note: 'twenty-five thousand jobs per tenant per year: npm run db:scale builds half a million and the budgets are measured against them',
  },
  'NFR-204': {
    how: 'not yet',
    note: 'a hundred million passport events stored. The chain and its indexes are built for it; nobody has put a hundred million rows in.',
  },
  'NFR-205': {
    how: 'not yet',
    note: 'twenty million photographs. A property of the object store rather than of this code.',
  },
  'NFR-206': {
    how: 'read',
    note: 'the application tier holds no state between requests: sessions are rows, not memory',
  },
  'NFR-207': {
    how: 'read',
    note: 'background work runs in apps/worker, a separate process from the request handler',
  },
  'NFR-208': {
    how: 'checked',
    by: 'infra/scripts/verify-performance.ts',
    note: 'the passport budget is measured against the vehicle with the most events on it',
  },

  /* --- NFR-300, availability ----------------------------------------------- */
  'NFR-301': {
    how: 'not yet',
    note: '99.9% monthly availability. Measured by being up for a month, which needs a month.',
  },
  'NFR-302': {
    how: 'not yet',
    note: '99.5% on the public passport path, as above',
  },
  'NFR-303': {
    how: 'checked',
    by: 'infra/scripts/verify-recovery.ts',
    note: 'recovery time objective of one hour, measured by losing the database and restoring it',
  },
  'NFR-304': {
    how: 'checked',
    by: 'infra/scripts/verify-recovery.ts',
    note: 'recovery point objective of five minutes, measured as the work lost',
  },
  'NFR-305': {
    how: 'checked',
    by: 'infra/scripts/verify-backup.ts',
    note: 'a backup exists, is complete, and restores',
  },
  'NFR-306': {
    how: 'checked',
    by: '.github/workflows/ci.yml',
    note: 'restoration is tested on every build rather than quarterly, which is stronger than the requirement asks',
  },
  'NFR-307': {
    how: 'checked',
    by: 'infra/scripts/verify-deliverability.ts',
    note: 'a provider outage queues and retries rather than stopping the work',
  },
  'NFR-308': {
    how: 'not yet',
    note: 'no downtime on deployment. A property of the hosting and the rollout, observable only while deploying.',
  },
  'NFR-309': {
    how: 'read',
    note: 'every migration is hand-written SQL, reviewed for the expand-migrate-contract shape; nothing mechanical enforces it',
  },

  /* --- NFR-400, security ---------------------------------------------------- */
  'NFR-401': {
    how: 'checked',
    by: 'infra/scripts/verify-headers.ts',
    note: 'Strict-Transport-Security on every response; TLS itself is the platform',
  },
  'NFR-402': {
    how: 'checked',
    by: 'infra/scripts/verify-credentials.ts',
    note: 'passwords are hashed with a memory-hard function and a per-password salt',
  },
  'NFR-403': {
    how: 'checked',
    by: 'infra/scripts/verify-credentials.ts',
    note: 'httpOnly, Secure, SameSite, and rotated when who you are changes',
  },
  'NFR-404': {
    how: 'read',
    note: 'every write is a server action, which carries its own origin check; there are no hand-rolled form posts',
  },
  'NFR-405': {
    how: 'checked',
    by: 'infra/scripts/verify-hardening.ts',
    note: 'input validated at the boundary rather than in the browser',
  },
  'NFR-406': {
    how: 'read',
    note: 'every raw query in the product is a Prisma.sql template, which parameterises; string-built SQL is asserted absent below',
  },
  'NFR-407': {
    how: 'checked',
    by: 'infra/scripts/verify-tenancy.ts',
    note: 'every address carrying an identifier, asked as another workshop. Phase 48.',
  },
  'NFR-408': {
    how: 'checked',
    by: '.github/workflows/ci.yml',
    note: 'the committed-secrets check in the audit job',
  },
  'NFR-409': {
    how: 'checked',
    by: '.github/workflows/ci.yml',
    note: 'npm audit at critical, blocking the merge',
  },
  'NFR-410': {
    how: 'checked',
    by: 'infra/scripts/verify-passports.ts',
    note: 'share links carry enough entropy and expire',
  },
  'NFR-411': {
    how: 'checked',
    by: 'infra/scripts/verify-hardening.ts',
    note: 'rate limits on signing in and on the public links',
  },
  'NFR-412': {
    how: 'checked',
    by: 'infra/scripts/verify-storage.ts',
    note: 'type and size checked, stored outside the web root, served through a handler that authorises',
  },
  'NFR-413': {
    how: 'not yet',
    note: 'a penetration test before general availability. Needs somebody whose job it is, and it is named in the security model as outstanding.',
  },
  'NFR-414': {
    how: 'checked',
    by: 'infra/scripts/verify-headers.ts',
    note: 'every header on every response, with a per-request nonce',
  },

  /* --- NFR-500, privacy ------------------------------------------------------ */
  'NFR-501': {
    how: 'not yet',
    note: 'data collected only where a purpose requires it. A judgement about each field, recorded in the data model, not a thing a script can decide.',
  },
  'NFR-502': {
    how: 'checked',
    by: 'infra/scripts/verify-erasure.ts',
    note: "a customer's data, exported on request. Every kind the product holds, including the empty ones, so that 'we hold nothing of that sort' and 'we forgot to look' stay different answers. Thirty days is the law's patience; one database answers at once.",
  },
  'NFR-503': {
    how: 'checked',
    by: 'infra/scripts/verify-erasure.ts',
    note: "erasure removes the person and keeps the vehicle. Checked by searching every text column of every table for the person's own name, email and address afterwards and requiring nothing back, rather than by trusting the fourteen statements in the register.",
  },
  'NFR-504': {
    how: 'read',
    note: 'lawful basis and retention per category are written in the security model and the data model',
  },
  'NFR-505': {
    how: 'checked',
    by: 'infra/scripts/verify-passports.ts',
    note: 'third-party access is an explicit, scoped, revocable grant',
  },
  'NFR-506': {
    how: 'checked',
    by: 'infra/scripts/verify-passports.ts',
    note: 'every third-party read is recorded and shown to the owner',
  },
  'NFR-507': {
    how: 'checked',
    by: 'infra/scripts/verify-region.ts',
    note: 'the region a workshop is in decides where its data sits',
  },
  'NFR-508': {
    how: 'not yet',
    note: 'sub-processors listed publicly and customers told before changes. A page and a process, neither of which exists yet.',
  },

  /* --- NFR-600, usability and accessibility ---------------------------------- */
  'NFR-601': {
    how: 'checked',
    by: 'infra/scripts/verify-access.ts',
    note: 'the mechanical half of WCAG 2.2 AA on every page',
  },
  'NFR-602': {
    how: 'checked',
    by: 'infra/scripts/audit-theme.ts',
    note: 'every pair of colours the design system puts together, in both themes',
  },
  'NFR-603': {
    how: 'checked',
    by: 'infra/scripts/verify-access.ts',
    note: 'status carries a word or an icon, never colour alone',
  },
  'NFR-604': {
    how: 'checked',
    by: 'infra/scripts/verify-access.ts',
    note: 'keyboard reachable, with a focus indicator that is visible',
  },
  'NFR-605': {
    how: 'checked',
    by: 'infra/scripts/verify-screens.ts',
    note: 'forty pixels through the middle of anything a thumb presses, on every one of a hundred and twenty-eight addresses. Phase 55.',
  },
  'NFR-606': {
    how: 'not yet',
    note: 'usable wearing nitrile gloves. Needs a technician, a pair of gloves and a car.',
  },
  'NFR-607': {
    how: 'not yet',
    note: 'a new service advisor takes a booking unaided within five minutes. Needs a new service advisor — the pilot.',
  },
  'NFR-608': {
    how: 'not yet',
    note: 'a customer approves an estimate on a phone within sixty seconds. Needs the customer.',
  },
  'NFR-609': {
    how: 'checked',
    by: 'infra/scripts/audit-theme.ts',
    note: 'light and dark, and the system preference respected',
  },
  'NFR-610': {
    how: 'checked',
    by: 'infra/scripts/verify-engines.ts',
    note: 'the lived-in screens, the links a customer is sent, and the Arabic ones, in Chromium, WebKit and Firefox. Phase 56.',
  },
  'NFR-611': {
    how: 'read',
    note: 'nothing in the product opens on hover; every menu and disclosure opens on a press',
  },
  'NFR-612': {
    how: 'checked',
    by: 'infra/scripts/verify-screens.ts',
    note: 'the lived-in screens measured right to left as well as left to right, and the direction asserted rather than assumed',
  },

  /* --- NFR-700, maintainability ---------------------------------------------- */
  'NFR-701': {
    how: 'read',
    note: 'packages/core imports neither the web framework nor the ORM, asserted below',
  },
  'NFR-702': {
    how: 'read',
    note: 'the coverage thresholds in vitest.config.ts, enforced by the test run',
  },
  'NFR-703': {
    how: 'read',
    note: 'strict mode on, and every type suppression carries a justification, asserted below',
  },
  'NFR-704': {
    how: 'read',
    note: 'thirteen ADRs, numbered without gaps, each recorded before the work it describes',
  },
  'NFR-705': {
    how: 'checked',
    by: '.github/workflows/ci.yml',
    note: 'docs:openapi:check fails when the document and the implementation disagree',
  },
  'NFR-706': {
    how: 'not yet',
    note: 'clone to running in fifteen minutes, measured literally by handing the instructions to somebody who has not seen the project. Needs that person.',
  },
  'NFR-707': {
    how: 'read',
    note: 'every job in the workflow carries a timeout, asserted below',
  },
  'NFR-708': {
    how: 'read',
    note: 'the workflow runs on every push to main; bypassing it is a repository setting rather than a thing in this tree',
  },

  /* --- NFR-800, observability ------------------------------------------------ */
  'NFR-801': {
    how: 'read',
    note: 'one line of JSON per event, from a single log function',
  },
  'NFR-802': {
    how: 'checked',
    by: 'packages/jobs/src/log.test.ts',
    note: 'credentials, tokens, card details and whole records are taken out by name before the line is written. Phase 56.',
  },
  'NFR-803': {
    how: 'checked',
    by: 'infra/scripts/verify-trace.ts',
    note: 'one identifier per request, on every audit row, outbox event, message and notification it causes, and inherited by the job the event wakes. Phase 59.',
  },
  'NFR-804': {
    how: 'checked',
    by: 'infra/scripts/verify-pilot.ts',
    note: 'jobs, inspections, estimates and passport events are all counted from the audit log, per capability. Phase 54.',
  },
  'NFR-805': {
    how: 'checked',
    by: 'infra/scripts/verify-alerts.ts',
    note: 'captured with context, shown on the operator page, and now sent to the operator. Phase 57.',
  },
  'NFR-806': {
    how: 'checked',
    by: 'infra/scripts/verify-alerts.ts',
    note: 'twenty-two signals, each with a runbook entry, alerted to the operator from the hourly sweep. Phase 57.',
  },
  'NFR-807': {
    how: 'checked',
    by: 'infra/scripts/verify-alerts.ts',
    note: 'a signal with no runbook entry cannot become a message: it is reported as needing one and the check fails. Phase 57.',
  },

  /* --- NFR-900, compliance and localisation ---------------------------------- */
  'NFR-901': {
    how: 'checked',
    by: 'infra/scripts/verify-tax.ts',
    note: 'what a tax document has to say, per jurisdiction',
  },
  'NFR-902': {
    how: 'checked',
    by: 'infra/scripts/verify-integrity.ts',
    note: 'numbering sequential and gapless per organisation, tried against on purpose',
  },
  'NFR-903': {
    how: 'checked',
    by: 'infra/scripts/verify-erasure.ts',
    note: 'financial records survive an erasure: the books are totalled before and after and must agree exactly, and the customer row stays behind, anonymised, because every invoice points at it. The seven years themselves are a retention policy, not a thing code can hold.',
  },
  'NFR-904': {
    how: 'checked',
    by: 'infra/scripts/verify-region.ts',
    note: 'a base currency per organisation, and money in minor units throughout',
  },
  'NFR-905': {
    how: 'checked',
    by: 'infra/scripts/i18n-scan.ts',
    note: 'no display string outside the translator, and every sentence answered in French and Arabic. In the workflow since Phase 55.',
  },
  'NFR-906': {
    how: 'checked',
    by: 'infra/scripts/verify-languages.ts',
    note: "dates, numbers and money rendered in the reader's locale",
  },
  'NFR-907': {
    how: 'read',
    note: 'every timestamp column is a timestamptz and every date is built in UTC, asserted below',
  },
};

/* ---------------------------------------------------------------------------
   The document, against the register
   --------------------------------------------------------------------------- */

function everyRequirementIsAccountedFor() {
  console.info('\n  Every quality requirement is accounted for\n');

  const doc = read('docs/01-requirements/02-non-functional-requirements.md');
  const stated = [...doc.matchAll(/^\|\s*(NFR-\d+)\s*\|/gm)].map((m) => m[1]!);
  const unique = [...new Set(stated)];

  const missing = unique.filter((id) => !REGISTER[id]);
  const invented = Object.keys(REGISTER).filter((id) => !unique.includes(id));

  check(
    missing.length === 0,
    `all ${unique.length} of them say what enforces them, or what it would take`,
    missing.join(', '),
  );

  check(
    invented.length === 0,
    'and the register names none that the document does not',
    invented.join(', '),
  );

  // A named enforcement that is not there is worse than none: it reads as
  // covered. This is the check that would have caught the twenty-six scripts
  // nobody ran, had anything pointed at them.
  const vanished = Object.entries(REGISTER)
    .filter(([, account]) => account.by && !exists(account.by))
    .map(([id, account]) => `${id} → ${account.by}`);

  check(vanished.length === 0, 'and everything named as enforcing one exists', vanished.join(', '));

  // A "checked" whose script nothing runs is a "not yet" wearing a tick.
  const ci = read('.github/workflows/ci.yml');
  // Named in the workflow directly, or through the npm script that runs it —
  // `npm run audit:theme` is as run as `npx tsx infra/scripts/audit-theme.ts`.
  const scripts: Record<string, string> = JSON.parse(read('package.json')).scripts;
  const runByName = new Set(
    Object.entries(scripts)
      .filter(([name]) => ci.includes(`npm run ${name}`))
      .flatMap(([, command]) => /infra\/scripts\/[a-z-]+\.ts/.exec(command) ?? []),
  );

  const asleep = Object.entries(REGISTER)
    .filter(([, account]) => account.how === 'checked' && account.by?.startsWith('infra/scripts/'))
    .filter(
      ([, account]) => !ci.includes(account.by!.split('/').pop()!) && !runByName.has(account.by!),
    )
    .map(([id, account]) => `${id} → ${account.by}`);

  check(
    asleep.length === 0,
    'and everything named as checked is run by the workflow',
    asleep.join(', '),
  );

  const counts = { checked: 0, read: 0, 'not yet': 0 } as Record<How, number>;
  for (const account of Object.values(REGISTER)) counts[account.how] += 1;

  console.info(
    `\n  ${unique.length} quality requirements: ${counts.checked} checked by something that runs, ` +
      `${counts.read} true of the repository, ${counts['not yet']} not enforced by anything.\n`,
  );

  for (const [id, account] of Object.entries(REGISTER)) {
    if (account.how !== 'not yet') continue;
    console.info(`  --     ${id}  ${account.note}`);
  }
}

/* ---------------------------------------------------------------------------
   The ones that are true of the repository, asserted rather than asserted
   --------------------------------------------------------------------------- */

function theRepositorySaysSo() {
  console.info('\n  And the ones that are read off the repository, read\n');

  // NFR-701. The domain layer knows nothing about the web or the database.
  const coreImports = filesUnder(join('packages', 'core', 'src'), /\.ts$/)
    .filter((file) => !file.endsWith('.test.ts'))
    .filter((file) => /from '(next|@prisma\/|@carnet\/db)/.test(read(file)));

  check(
    coreImports.length === 0,
    'NFR-701: the domain layer imports neither the framework nor the ORM',
    coreImports.join(', '),
  );

  // NFR-702. A threshold that is not configured is a number in a document.
  const vitest = read('vitest.config.mts');
  const lines = /lines:\s*(\d+)/.exec(vitest);

  check(
    Number(lines?.[1] ?? 0) >= 70,
    'NFR-702: the coverage threshold is set, and at or above seventy',
    lines?.[1],
  );

  // NFR-703. Strict, and every suppression says why.
  check(read('tsconfig.base.json').includes('"strict": true'), 'NFR-703: strict mode is on');

  const suppressed: string[] = [];
  for (const dir of ['apps/web/src', 'packages', 'infra/scripts']) {
    for (const file of filesUnder(dir, /\.tsx?$/)) {
      if (file.includes('node_modules') || file.includes('generated')) continue;
      const source = read(file).split('\n');
      source.forEach((line, index) => {
        if (!/@ts-(ignore|expect-error)/.test(line)) return;
        // A justification on the same line, or in the comment above it.
        const reason = line.replace(/.*@ts-(ignore|expect-error)/, '').trim();
        const above = source[index - 1] ?? '';
        if (reason.length > 8 || /\/[/*]/.test(above)) return;
        suppressed.push(`${file}:${index + 1}`);
      });
    }
  }

  check(
    suppressed.length === 0,
    'NFR-703: and every type suppression says why',
    suppressed.join(', '),
  );

  // NFR-704. Numbered without gaps: a missing number is a decision somebody
  // made and nobody wrote down.
  const adrs = readdirSync(join('docs', '03-adr'))
    .filter((file) => /^\d{4}-/.test(file))
    .map((file) => Number(file.slice(0, 4)))
    .sort((a, b) => a - b);

  const gaps = adrs.filter((n, i) => i > 0 && n !== adrs[i - 1]! + 1);

  check(
    adrs.length > 0 && gaps.length === 0 && adrs[0] === 1,
    `NFR-704: ${adrs.length} architectural decisions, numbered without a gap`,
    gaps.join(', '),
  );

  // NFR-707. A job with no timeout cannot be over budget; it can only hang.
  const workflow = read('.github/workflows/ci.yml');
  const jobs = [...workflow.matchAll(/^ {2}([a-z-]+):$/gm)].map((m) => m[1]!);
  const timeouts = [...workflow.matchAll(/timeout-minutes:\s*(\d+)/g)].map((m) => Number(m[1]));

  check(
    timeouts.length >= jobs.length - 1,
    `NFR-707: every one of the ${jobs.length} jobs carries a timeout`,
    `${timeouts.length} timeouts`,
  );

  // NFR-206 and NFR-207. Nothing is kept in memory between requests, and the
  // background work is somebody else's process.
  check(exists(join('apps', 'worker')), 'NFR-207: background work runs in its own process');

  // NFR-406. Every raw query is a template, which parameterises. A query built
  // by joining strings is the one shape that does not.
  const built: string[] = [];
  for (const file of filesUnder(join('apps', 'web', 'src'), /\.tsx?$/)) {
    const source = read(file);
    if (/\$queryRawUnsafe|\$executeRawUnsafe/.test(source)) built.push(file);
  }

  check(built.length === 0, 'NFR-406: no query is built by joining strings', built.join(', '));

  // NFR-802. Asserted through the function itself rather than by reading it.
  check(
    redaction.isSecret('passwordHash') &&
      redaction.isSecret('carnet_session_token') &&
      !redaction.isSecret('jobId'),
    'NFR-802: the logger knows a credential from an identifier',
  );

  check(
    JSON.stringify(redaction.safe({ customerId: 'c1', password: 'hunter2' })) ===
      JSON.stringify({ customerId: 'c1', password: redaction.REDACTED }),
    'NFR-802: and takes the value out while leaving the shape',
  );

  // NFR-907. A timestamp without a zone is a timestamp that means something
  // different depending on where the server is.
  const schema = read(join('packages', 'db', 'prisma', 'schema.prisma'));
  const naive = [...schema.matchAll(/^\s*\w+\s+DateTime\s+@db\.Timestamp\b/gm)].length;

  check(naive === 0, 'NFR-907: no timestamp is stored without its zone', `${naive} found`);
}

function main() {
  console.info('\n  The other half of the requirements');

  everyRequirementIsAccountedFor();
  theRepositorySaysSo();

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`\n  ${checked} checks. Every quality requirement is accounted for.\n`);
  }
}

main();
