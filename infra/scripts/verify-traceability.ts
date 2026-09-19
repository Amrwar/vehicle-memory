/**
 * Whether the traceability matrix is true. Phase 61.
 *
 *   npx tsx infra/scripts/verify-traceability.ts
 *
 * A traceability matrix is the easiest document in a project to write and the
 * easiest to write falsely. Every row is a claim — this requirement is met by
 * that code and held there by that test — and nothing about a table makes any
 * of those claims so. A row naming a function that was renamed two years ago
 * reads exactly like a row naming one that exists.
 *
 * This is the difference. Three things are checked, and each of them found
 * something the first time it ran:
 *
 *   Every requirement has a row. Eighty-four did not: Phase 1 and 2 work,
 *     traced by section rather than by requirement, named at the foot of that
 *     page for months as a gap somebody would close one day.
 *
 *   Every test a row names exists. A row can then be wrong about what a test
 *     covers, which no script can judge, but it cannot name a file that is
 *     not there.
 *
 *   Every function a row names exists in the source. This is the one that
 *     catches a matrix drifting away from the code underneath it, which is
 *     the way these documents usually die: not by being wrong when written
 *     but by staying still while everything else moves.
 *
 * And the count of what is admitted rather than claimed is reported rather
 * than buried, because the number that matters about a matrix like this is how
 * many rows say "Missing".
 */

import 'dotenv/config';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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

const MATRIX = 'docs/01-requirements/04-traceability-matrix.md';
const REQUIREMENTS = 'docs/01-requirements/01-functional-requirements.md';

interface Row {
  req: string;
  implementation: string;
  test: string;
  status: string;
}

function rows(): Row[] {
  const body = read(MATRIX).split('## Coverage summary')[0]!;

  return body
    .split('\n')
    .filter((line) => /^\|\s*FR-\d+\s*\|/.test(line))
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim());
      return {
        req: cells[1]!,
        implementation: cells[4] ?? '',
        test: cells[5] ?? '',
        status: cells[6] ?? '',
      };
    });
}

function filesUnder(dir: string): string[] {
  const found: string[] = [];
  const walk = (at: string) => {
    for (const entry of readdirSync(at)) {
      const full = join(at, entry);
      if (statSync(full).isDirectory()) {
        if (['node_modules', '.next', 'generated'].includes(entry)) continue;
        walk(full);
      } else if (/\.tsx?$/.test(full)) {
        found.push(full);
      }
    }
  };
  walk(dir);
  return found;
}

function main() {
  console.info('\n  Whether the traceability matrix is true\n');

  const all = rows();

  /* --- every requirement has a row ----------------------------------------- */

  const required = [
    ...new Set([...read(REQUIREMENTS).matchAll(/^\|\s*(FR-\d+)\s*\|/gm)].map((m) => m[1]!)),
  ];
  const traced = new Set(all.map((one) => one.req));
  const untraced = required.filter((req) => !traced.has(req));

  check(
    untraced.length === 0,
    `all ${required.length} requirements have a row of their own`,
    untraced.join(', '),
  );

  // And no row for a requirement that no longer exists, which is the same
  // drift pointing the other way.
  const stale = [...traced].filter((req) => !required.includes(req));
  check(stale.length === 0, 'and no row names a requirement that has gone', stale.join(', '));

  const duplicated = all
    .map((one) => one.req)
    .filter((req, index, list) => list.indexOf(req) !== index);
  check(duplicated.length === 0, 'and none is traced twice', [...new Set(duplicated)].join(', '));

  /* --- every test a row names exists ---------------------------------------- */

  const onDisk = new Set([
    ...readdirSync('infra/scripts').filter((file) => file.endsWith('.ts')),
    ...['apps/web/src', 'packages'].flatMap(filesUnder).map((file) => file.split(/[\\/]/).pop()!),
  ]);

  const namedTests = new Set<string>();
  for (const row of all) {
    for (const [, file] of row.test.matchAll(/`([a-z0-9-]+\.test\.ts|verify-[a-z-]+\.ts)`/g)) {
      namedTests.add(file!);
    }
  }

  const absentTests = [...namedTests].filter((file) => !onDisk.has(file)).sort();

  check(
    absentTests.length === 0,
    `all ${namedTests.size} tests the matrix names exist`,
    absentTests.join(', '),
  );

  /* --- every function a row names exists ------------------------------------ */

  // The one that catches a matrix drifting away from the code underneath it,
  // which is how these documents usually die: not wrong when written, but
  // standing still while everything around them moves.
  const source = [
    'apps/web/src',
    'packages/core/src',
    'packages/jobs/src',
    'packages/db/src',
    // The checks themselves: several rows name a function inside one, which
    // is a perfectly good thing for a row to name.
    'infra/scripts',
  ]
    .flatMap(filesUnder)
    .filter((file) => !file.includes('generated'))
    .map((file) => read(file))
    .join('\n');

  const named = new Set<string>();
  for (const row of all) {
    for (const [, fn] of row.implementation.matchAll(/`([a-zA-Z][a-zA-Z0-9_]*)\(\)`/g)) {
      named.add(fn!);
    }
  }

  const invented = [...named].filter((fn) => !new RegExp(`\\b${fn}\\b`).test(source)).sort();

  check(
    invented.length === 0,
    `all ${named.size} functions the matrix names exist in the source`,
    invented.length > 0
      ? `${invented.join(', ')} — named in a row and nowhere in the code`
      : undefined,
  );

  /* --- and what the matrix admits ------------------------------------------- */

  const byStatus = new Map<string, number>();
  for (const row of all) byStatus.set(row.status, (byStatus.get(row.status) ?? 0) + 1);

  const admitted = all.filter((one) => one.status !== 'Done');

  console.info(
    `\n  ${all.length} rows: ` +
      [...byStatus.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([status, n]) => `${n} ${status.toLowerCase()}`)
        .join(', ') +
      '.\n',
  );

  for (const row of admitted) {
    console.info(`  ${row.status.padEnd(10)} ${row.req}`);
  }

  // Not a failure. A row that says "Missing" is the matrix working: what would
  // be a failure is a requirement nothing implements and a row that says Done.
  // The kind has to be one of these; anything after it is the detail, which
  // is welcome. "Partial — stub decoder, real provider in Phase 2" says more
  // than "Partial" and is still a Partial.
  const KINDS = ['Missing', 'Partial', 'Deferred', 'Superseded', 'Planned'];
  const kindOf = (status: string) => status.split(/[\s—-]/)[0] ?? '';

  check(
    admitted.every((row) => KINDS.includes(kindOf(row.status))),
    'and every row that is not Done says which kind of not-done it is',
    admitted
      .filter((row) => !KINDS.includes(kindOf(row.status)))
      .map((row) => `${row.req}: ${row.status}`)
      .join(', '),
  );

  // A row admitting there is nothing there must not also claim a test.
  const claimingBoth = admitted.filter(
    (row) => kindOf(row.status) === 'Missing' && row.test.replace(/[—-]/g, '').trim().length > 0,
  );

  check(
    claimingBoth.length === 0,
    'and nothing claims a test for a requirement it admits is not built',
    claimingBoth.map((row) => row.req).join(', '),
  );

  /* --- the summary is recounted rather than remembered ---------------------- */

  const summary = read(MATRIX).split('## Coverage summary')[1] ?? '';
  const total = /\*\*Total\*\*\s*\|\s*\*\*(\d+)\*\*/.exec(summary);

  check(
    Number(total?.[1] ?? 0) === all.length,
    'the coverage summary counts what is actually in the table',
    `summary says ${total?.[1]}, the table holds ${all.length}`,
  );

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`\n  ${checked} checks. The matrix says what is true.\n`);
  }
}

main();
