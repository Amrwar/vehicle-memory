/**
 * Which sentences in these files have no French or Arabic yet. Phase 40.5.
 *
 *   npx tsx infra/scripts/i18n-missing.ts <files or folders...>
 *
 * Reads every t('...') and msg('...') in the files named, and lists each
 * sentence the dictionaries do not have in both languages. The whole-product
 * check is verify-languages.ts; this is the one to run while working on part
 * of it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { hasTranslation } from '@carnet/core';

const ROOT = join(__dirname, '..', '..');

function walk(path: string, out: string[] = []): string[] {
  if (statSync(path).isFile()) {
    if (/\.tsx?$/.test(path)) out.push(path);
    return out;
  }
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    walk(join(path, entry), out);
  }
  return out;
}

const targets = process.argv.slice(2);
let missing = 0;
for (const target of targets) {
  for (const file of walk(join(ROOT, target))) {
    const src = readFileSync(file, 'utf8');
    const found = new Set<string>();
    for (const m of src.matchAll(/\b(?:t|msg)\(\s*'((?:[^'\\]|\\.)*)'\s*[,)]/g)) {
      found.add(m[1]!.replace(/\\'/g, "'"));
    }
    for (const m of src.matchAll(/\b(?:t|msg)\(\s*"((?:[^"\\]|\\.)*)"\s*[,)]/g)) {
      found.add(m[1]!);
    }
    for (const text of found) {
      const langs = (['fr', 'ar'] as const).filter((language) => !hasTranslation(language, text));
      if (langs.length > 0) {
        missing += 1;
        const where = relative(ROOT, file).replace(/\\/g, '/');
        console.info(`  ${langs.join('+').padEnd(5)} ${where}  ${JSON.stringify(text)}`);
      }
    }
  }
}
console.info(`\n  ${missing} sentences without both translations.\n`);
process.exit(missing === 0 ? 0 : 1);
