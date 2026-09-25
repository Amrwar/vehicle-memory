/**
 * A 404 that says 200. Phase 73.
 *
 *   npx tsx infra/scripts/verify-status.ts
 *
 * `loading.tsx` draws a Suspense boundary over everything below it. A
 * boundary flushes: the response line, headers and the loading screen go out
 * as soon as the page underneath suspends, which an async page does on its
 * first await. So by the time that page calls `notFound()`, the 200 has
 * gone. Next can still swap the body for the not-found page — and does, which
 * is why nobody noticed — but the status is already spoken for.
 *
 * The effect: a revoked passport share link, a used handover link, and a car
 * that was not yours all answered 200. Link checkers, crawlers and anything
 * else that reads a status rather than a page were told the record was there.
 *
 * There is no way to hold the status open once the shell has gone, so the
 * rule is structural rather than something to remember: a page that has to be
 * able to say "there is nothing here" must not sit under a loading boundary.
 * It asks its cheap question first, outside any boundary, and draws its own
 * fallback around the slow half.
 *
 * Inside the application shell the status is not read by anything — there is
 * a session, a human, and a page that says so — and one loading screen over
 * the whole shell is worth more than a status code nobody reads. ADR-0015
 * writes that down. This file is what keeps the exception from widening
 * quietly.
 *
 * Nothing here needs a database or a running application: it reads the route
 * tree, which is the thing that decides.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const APP = join(process.cwd(), 'apps', 'web', 'src', 'app');
const ADR = join(process.cwd(), 'docs', '03-adr', '0015-the-status-and-the-loading-screen.md');

/**
 * The segments where a loading boundary is allowed to sit above a page that
 * can answer "not found". Read from the ADR rather than typed here, so that
 * widening the exception means writing down why.
 */
function shelteredSegments(): string[] {
  const adr = readFileSync(ADR, 'utf8');
  const listed = [...adr.matchAll(/^- `([^`]+)`/gm)].map((match) => match[1]!);
  return listed;
}

let failures = 0;

function check(label: string, ok: boolean, detail = ''): void {
  if (ok) {
    console.info(`  ok     ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL   ${label}${detail ? `\n         ${detail}` : ''}`);
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Every ancestor directory of this page, from the app root down to its own. */
function ancestors(pagePath: string): string[] {
  const parts = relative(APP, pagePath).split(sep).slice(0, -1);
  return parts.map((_, index) => join(APP, ...parts.slice(0, index + 1))).concat([APP]);
}

function main() {
  const files = walk(APP);
  const pages = files.filter((file) => file.endsWith(`${sep}page.tsx`));
  const boundaries = new Set(
    files
      .filter((file) => file.endsWith(`${sep}loading.tsx`))
      .map((file) => file.slice(0, -'loading.tsx'.length - 1)),
  );

  const sheltered = shelteredSegments();
  check(
    'the ADR names the shelters, and there is at least one',
    sheltered.length > 0,
    'ADR-0015 should list each sheltered segment as a `- `segment`` bullet',
  );

  const sayNotFound = pages.filter((page) => /\bnotFound\(\)/.test(readFileSync(page, 'utf8')));
  check(`${sayNotFound.length} pages can say a record is not there`, sayNotFound.length > 0);

  const covered: string[] = [];
  const shelteredCovered: string[] = [];

  for (const page of sayNotFound) {
    const route = relative(APP, page).split(sep).slice(0, -1).join('/');
    const above = ancestors(page).filter((dir) => boundaries.has(dir));

    if (above.length === 0) continue;

    const shelter = sheltered.find(
      (segment) => route === segment || route.startsWith(`${segment}/`),
    );
    if (shelter) shelteredCovered.push(`${route} (sheltered by ${shelter})`);
    else
      covered.push(
        `/${route} under ${above.map((dir) => `${relative(APP, dir)}/loading.tsx`).join(', ')}`,
      );
  }

  check(
    'no page that answers 404 sits under a loading boundary',
    covered.length === 0,
    covered.length === 0
      ? ''
      : `${covered.length} would answer 200 instead:\n         ` +
          covered.join('\n         ') +
          '\n         Ask the cheap question in the page, outside the boundary, and\n' +
          '         draw the fallback inside it. Or shelter the segment in ADR-0015\n' +
          '         and say why the status is not read there.',
  );

  console.info(
    `\n  ${shelteredCovered.length} sheltered by ADR-0015, where a session, a human and a page that says so` +
      '\n  are the whole audience for the answer.',
  );

  // The public links, named, because these are the ones a stranger meets and
  // the ones something other than a person reads.
  for (const route of [
    'p/[token]',
    'handover/[token]',
    'portal/vehicles/[id]',
    'portal/estimates/[id]',
  ]) {
    const dir = join(APP, ...route.split('/'));
    const above = ancestors(join(dir, 'page.tsx')).filter((one) => boundaries.has(one));
    check(`/${route} decides before it streams`, above.length === 0);
  }

  console.info(
    failures === 0
      ? '\n  A page that is not there says so, in the status line as well as the words.'
      : `\n  ${failures} failed.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main();
