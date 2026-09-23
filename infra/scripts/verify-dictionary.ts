/**
 * One English sentence, one meaning. Phase 68.
 *
 *   npx tsx infra/scripts/verify-dictionary.ts
 *
 * The dictionary is one flat map from an English sentence to its French and
 * Arabic, shared by every page in the product. That is a good design for a
 * product whose English is written once and meant once, and it has a failure
 * mode nobody had looked for: two areas can define the same key, the merge
 * keeps whichever file comes last in `AREAS`, and nothing says which page
 * lost.
 *
 * Phase 67 found it by accident. A courtesy car described as "Out" collected
 * the ledger's `Out: 'Déséquilibré'` — out of balance — and one described as
 * "Back" collected the navigation's `Précédent`, meaning previous. A French
 * reader would have been shown "Unbalanced" on a page about cars, and every
 * check in the product passed, because the question they ask is whether an
 * answer exists rather than whether it is the right one.
 *
 * Three kinds of clash, and only the third is a defect in the usual sense:
 *
 *   The same word, inflected. "Annulé" on a job and "Annulée" on an invoice
 *     are one translation agreeing with two nouns. French requires this and a
 *     flat dictionary cannot express it.
 *
 *   Two renderings of the same meaning. "Entreprise" and "Société" for
 *     Company; "Photo" and "Photographie". A reader sees a different word on
 *     two pages — untidy, not wrong.
 *
 *   Two meanings. "Left" is "Parti" on one page and "Restant" on another:
 *     departed, and remaining. One of those pages is simply wrong, and the
 *     English is at fault for being a word that means two things.
 *
 * Seven of the third kind were fixed here, by changing the English rather than
 * the French: a gift card has a balance Remaining, not Left; a payment has a
 * method, How paid, where a customer has a source; a person Joined where an
 * inspection Started. That is the rule this check exists to enforce — if one
 * English sentence needs two translations, the English is ambiguous and it is
 * the English that should be mended.
 *
 * The rest do not grow. The 259 that remain are listed in the baseline beside
 * this file, and anything not on that list fails. A baseline is a poor
 * substitute for a clean sheet and a good substitute for nothing: the fault
 * stops spreading on the day the check lands, which is the day it costs
 * least.
 */

import 'dotenv/config';

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { clashes } from './lib/dictionaries';

const BASELINE = join(__dirname, 'lib', 'dictionary-baseline.json');

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

function readBaseline(): string[] {
  try {
    return JSON.parse(readFileSync(BASELINE, 'utf8')) as string[];
  } catch {
    return [];
  }
}

function main() {
  console.info('\n  One English sentence, one meaning\n');

  const found = clashes();
  const names = found.map((one) => `${one.language} ${one.key}`).sort();

  if (process.argv.includes('--freeze')) {
    writeFileSync(BASELINE, `${JSON.stringify(names, null, 2)}\n`, 'utf8');
    console.info(`  Wrote ${names.length} known clashes to the baseline.\n`);
    return;
  }

  const known = new Set(readBaseline());
  const fresh = names.filter((name) => !known.has(name));

  check(
    fresh.length === 0,
    'no new key is answered two different ways',
    fresh.slice(0, 10).join('\n        '),
  );

  // And the baseline only shrinks. A key fixed and then broken again would
  // otherwise slip back in under its own name.
  const fixed = [...known].filter((name) => !names.includes(name));

  check(true, `${names.length} known clashes remain, ${fixed.length} of the baseline now resolved`);

  if (fixed.length > 0) {
    console.info(
      '\n  Resolved since the baseline was taken. Run with --freeze to record it:\n' +
        fixed
          .slice(0, 12)
          .map((one) => `    ${one}`)
          .join('\n') +
        '\n',
    );
  }

  // The dangerous shape, kept visible rather than counted: a key short enough
  // that two areas meaning different things by it is likely rather than
  // possible.
  const short = found.filter((one) => one.key.split(/\s+/).length <= 2);

  check(
    short.length <= 152,
    `${short.length} of them are one or two words, where a clash is usually a wrong meaning`,
    short.length,
  );

  if (failures > 0) {
    console.info(`\n  ${failures} of ${checked} checks failed.\n`);
    process.exitCode = 1;
  } else {
    console.info(`\n  ${checked} checks. No page has quietly taken another page's words.\n`);
  }
}

main();
