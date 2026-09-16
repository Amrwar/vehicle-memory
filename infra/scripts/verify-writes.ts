/**
 * Every write that moves money or stock says what a repeat does to it.
 *
 *   npx tsx infra/scripts/verify-writes.ts          check
 *   npx tsx infra/scripts/verify-writes.ts --write  check, then write the register
 *
 * Phase 46's exit condition, made mechanical.
 *
 * The rule is narrow on purpose. Not every write in the product is in here:
 * a note saved twice is a note, and a register that included it would be long
 * enough that nobody would read the parts that matter. What is in here is
 * everything that can cost somebody money or take a part off a shelf, and for
 * each one there is a line in its own docblock saying what happens when the
 * same call arrives again.
 *
 *     @repeat GUARDED(CONSTRAINT: coupon_redemptions_one_per_invoice) The
 *     second one is refused before any money moves.
 *
 * A declaration lives beside the code rather than in a document, because a
 * document drifts and nobody notices; a marker drifts and a function without
 * one fails this check the moment somebody adds it. The document is written
 * from the markers, which is why it cannot be wrong.
 *
 * The check fails when a function in one of these files writes and has no
 * marker, when a marker claims a guard without naming it, and when anything is
 * still declared ONE_ONLY — which is the disposition a write is allowed to
 * carry while somebody is fixing it, and not one it is allowed to keep.
 */

import 'dotenv/config';

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertDeclared,
  assertShippable,
  describeRepeat,
  type GuardKind,
  type Repeat,
  repeatTally,
  type WriteSafety,
} from '@carnet/core';

const ROOT = join(__dirname, '..', '..');
const LIB = join(ROOT, 'apps', 'web', 'src', 'lib');
const REGISTER = join(ROOT, 'docs', '04-engineering', '09-repeating-a-write.md');

/**
 * The files under the rule.
 *
 * Money, stock, and the documents a customer is shown. The list is here
 * rather than inferred so that removing a file from it is a deliberate act
 * somebody has to explain in a diff, not something that happens by renaming.
 */
const UNDER_THE_RULE = [
  ['money.ts', 'Bills and the money against them'],
  ['counter.ts', 'The counter'],
  ['coupons.ts', 'Coupons'],
  ['giftcards.ts', 'Gift cards'],
  ['giftcard-refunds.ts', 'Refunds onto a card'],
  ['deposits.ts', 'Money held for a customer'],
  ['deposit-credits.ts', 'Credit kept from a refund'],
  ['card-payments.ts', 'Paying by card'],
  ['inventory.ts', 'Stock'],
  ['payables.ts', 'What the workshop owes'],
  ['payroll.ts', 'Paying people'],
  ['banking.ts', 'The bank and the books'],
  ['accounting.ts', 'The ledger'],
  ['retention.ts', 'Points and referrals'],
] as const;

/** What counts as writing, for a function that has no marker to defend it. */
const WRITES =
  /\.(create|createMany|update|updateMany|upsert|delete|deleteMany|executeRaw)\(|\$transaction/;

/**
 * A guard that lives in the caller rather than in the write.
 *
 * Some writes cannot recognise a repeat from the inside: two cash payments of
 * fifty pounds against one bill are two real payments, and only the form they
 * came from can tell them apart. Those writes are guarded by the key their
 * callers pass to once(), which is a real guard — as long as every caller
 * actually passes one. So a write that claims it is checked against the pages
 * that call it, and the claim fails the moment somebody adds a call that does
 * not.
 */
const BY_THE_CALLER = 'once(';

/** How a write says its key is the caller's. */
const HELD_BY_CALLER = 'hand to once';

const MARKER =
  /@repeat\s+(HARMLESS|GUARDED|ONE_ONLY)(?:\s*\((CONSTRAINT|KEY|STATE|OVERWRITE):\s*([^)]+)\))?\s+([\s\S]*?)(?:\n\s*\*\s*\n|\n\s*\*\/|\n\s*\*\s*@)/;

let failures = 0;

function fail(message: string) {
  failures += 1;
  console.error(`  FAIL  ${message}`);
}

/** The docblock immediately above a declaration, if there is one. */
function docblockBefore(source: string, at: number): string {
  const before = source.slice(0, at);
  const opened = before.lastIndexOf('/**');
  if (opened === -1) return '';

  const closed = before.indexOf('*/', opened);
  if (closed === -1) return '';

  // Only if nothing but whitespace stands between the comment and the
  // function; otherwise it belongs to whatever is in between.
  return before.slice(closed + 2).trim() === '' ? before.slice(opened, closed + 2) : '';
}

function read(file: string): { source: string; writes: { name: string; body: string }[] } {
  const source = readFileSync(join(LIB, file), 'utf8');
  const writes: { name: string; body: string }[] = [];

  for (const match of source.matchAll(/^export async function (\w+)/gm)) {
    const start = match.index!;
    const next = source.indexOf('\nexport ', start + 1);
    const body = source.slice(start, next === -1 ? source.length : next);
    if (WRITES.test(body)) writes.push({ name: match[1]!, body });
  }

  return { source, writes };
}

function declared(file: string, name: string, source: string): WriteSafety | null {
  const at = source.indexOf(`export async function ${name}`);
  const doc = docblockBefore(source, at);
  const found = MARKER.exec(doc);

  if (!found) return null;

  const repeat = found[1] as Repeat;
  const kind = found[2] as GuardKind | undefined;
  const named = found[3]?.trim();

  return {
    name: `${name}()`,
    where: `apps/web/src/lib/${file}`,
    repeat,
    ...(kind && named ? { guard: { kind, named } } : {}),
    // Folded back into one line: a marker is written across a docblock and
    // read as a sentence.
    says: found[4]!
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  };
}

/**
 * Pages that call a write without a key around it.
 *
 * Read by text rather than by types, the way verify-authz reads permissions:
 * a server action is a function in a page, and what matters is whether the
 * call sits inside a once() block, which is visible without knowing anything
 * about the program.
 */
function callersWithoutAKey(name: string): string[] {
  const loose: string[] = [];

  for (const file of pagesOnDisk(join(ROOT, 'apps', 'web', 'src', 'app'))) {
    const source = readFileSync(file, 'utf8');

    for (const call of source.matchAll(new RegExp(`\\b${name}\\(`, 'g'))) {
      // The nearest once( before this call, and the nearest action boundary.
      // A call is held if a once( opened after the last action began.
      const before = source.slice(0, call.index!);
      const action = Math.max(
        before.lastIndexOf("'use server'"),
        before.lastIndexOf('export default'),
      );
      const keyed = before.lastIndexOf(BY_THE_CALLER);

      if (keyed <= action) {
        loose.push(file.replace(ROOT, '.').replace(/\\/g, '/'));
        break;
      }
    }
  }

  return loose;
}

function pagesOnDisk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) pagesOnDisk(path, out);
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

function main() {
  console.info('\n  What a repeat does to every write that moves money or stock\n');

  const sections: { title: string; file: string; writes: WriteSafety[] }[] = [];
  const all: WriteSafety[] = [];

  for (const [file, title] of UNDER_THE_RULE) {
    const { source, writes } = read(file);
    const declaredHere: WriteSafety[] = [];

    for (const write of writes) {
      const safety = declared(file, write.name, source);

      if (!safety) {
        fail(`${file}:${write.name}() writes and does not say what a repeat does to it.`);
        continue;
      }

      try {
        assertDeclared(safety);
      } catch (error) {
        fail(`${file}:${write.name}() — ${error instanceof Error ? error.message : error}`);
        continue;
      }

      if (safety.guard?.kind === 'KEY' && safety.guard.named.includes(HELD_BY_CALLER)) {
        for (const loose of callersWithoutAKey(write.name)) {
          fail(
            `${loose} calls ${write.name}() outside once(), and ${write.name}() says its callers hold its key.`,
          );
        }
      }

      declaredHere.push(safety);
      all.push(safety);
    }

    sections.push({ title, file, writes: declaredHere });
    console.info(`  ok    ${file}  ${declaredHere.length} of ${writes.length} declared`);
  }

  try {
    assertShippable(all);
    console.info('\n  ok    nothing would do it again');
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }

  const tally = repeatTally(all);
  console.info(
    `\n  ${tally.total} writes: ${tally.guarded} guarded, ${tally.harmless} harmless, ${tally.open} open`,
  );

  if (process.argv.includes('--write')) {
    writeFileSync(REGISTER, register(sections, tally), 'utf8');
    console.info(`  wrote ${REGISTER.replace(ROOT, '.')}`);
  }

  console.info(
    `\n  ${failures === 0 ? 'Every write that moves money says what a repeat does to it.' : `${failures} failed.`}\n`,
  );
  if (failures > 0) process.exitCode = 1;
}

function register(
  sections: { title: string; file: string; writes: WriteSafety[] }[],
  tally: ReturnType<typeof repeatTally>,
): string {
  const lines: string[] = [];

  lines.push('# Doing it twice');
  lines.push('');
  lines.push(
    '<!-- Written by `npm run verify:writes -- --write` from the markers in the code. Do not edit by hand. -->',
  );
  lines.push('');
  lines.push(
    'Every write below can be asked for twice, and most of them eventually are.',
    'A person on a slow connection presses the button again because nothing',
    'happened. A page is refreshed mid-submit. Two workers overlap during a',
    'deploy. A provider retries a webhook it never got an answer to. A process is',
    'killed between doing the work and writing down that it did.',
  );
  lines.push('');
  lines.push(
    'So each one says what the second time does. There are only three honest',
    'answers, and the difference between the middle one and the last one is not a',
    'judgement: a guard is a thing in the code or the database that another person',
    'can read. "The user would not do that" is not a guard.',
  );
  lines.push('');
  lines.push('| | |');
  lines.push('| --- | --- |');
  lines.push('| **Harmless** | The second one changes nothing. |');
  lines.push('| **Guarded** | The second one is stopped by something named here. |');
  lines.push(
    '| **Would repeat** | The second one would do it again. Nothing may ship in this state, and the check refuses to pass while anything is. |',
  );
  lines.push('');
  lines.push(
    `Today: **${tally.total}** writes that move money or stock — ${tally.guarded} guarded,`,
    `${tally.harmless} harmless, ${tally.open} that would repeat.`,
  );
  lines.push('');
  lines.push(
    'The list is scoped deliberately. Not every write in the product is here: a',
    'note saved twice is a note, and a register long enough to include it is one',
    'nobody reads the important half of. What is here is everything that can cost',
    'somebody money or take a part off a shelf.',
  );
  lines.push('');
  lines.push(
    'This page is written from markers in the code by',
    '`npm run verify:writes -- --write`, and the same check fails the build when a',
    'function in one of these files writes without one. A document drifts and',
    'nobody notices; a marker drifts and the next person to add a function finds',
    'out immediately.',
  );
  lines.push('');

  for (const section of sections) {
    if (section.writes.length === 0) continue;

    lines.push(`## ${section.title}`);
    lines.push('');
    lines.push(`\`${section.file}\``);
    lines.push('');
    lines.push('| Write | Twice | What stops it | What the second one does |');
    lines.push('| --- | --- | --- | --- |');

    for (const write of section.writes) {
      const twice =
        write.repeat === 'HARMLESS'
          ? 'Harmless'
          : write.repeat === 'GUARDED'
            ? 'Guarded'
            : '**Would repeat**';
      const guard = write.guard ? `\`${write.guard.named}\`` : '—';
      lines.push(`| \`${write.name}\` | ${twice} | ${guard} | ${write.says} |`);
    }

    lines.push('');
  }

  lines.push('## Proved, not asserted');
  lines.push('');
  lines.push(
    '`npm run verify:repeat` runs the awkward moments against a real database: a',
    'button pressed twice, two presses landing in the same instant, four awards of',
    'the same points at once, two workers reaching for one queue, a sale taken',
    'twice, and a claim whose process died holding it. A declaration that nothing',
    'tests is a comment.',
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_Back to the [documentation index](../README.md)._');
  lines.push('');

  return lines.join('\n');
}

main();

export { describeRepeat };
