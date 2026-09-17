/**
 * Files in the store that no row points at. Phase 49.
 *
 *   npx tsx infra/scripts/storage-orphans.ts            list them
 *   npx tsx infra/scripts/storage-orphans.ts --remove   and then remove them
 *
 * Listing by default, because this deletes customers' photographs and a tool
 * that deletes by default is a tool that will one day delete the wrong thing.
 * Read the list, then run it again.
 *
 * Anything uploaded in the last day is left alone whatever the list says: a
 * file reaches the store before its row is written, so a sweep with no
 * patience removes exactly the files somebody is in the middle of adding.
 */

import 'dotenv/config';

import { prisma } from '@carnet/db';

import { forgetOrphans, GRACE_MS, orphanedFiles } from '../../apps/web/src/lib/storage-sweep';

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  const remove = process.argv.includes('--remove');
  const orphans = await orphanedFiles();

  console.info('\n  Files nothing points at\n');

  if (orphans.length === 0) {
    console.info('  Nothing. Every file in the store belongs to a row.\n');
    return;
  }

  const total = orphans.reduce((sum, orphan) => sum + orphan.bytes, 0);

  for (const orphan of orphans) {
    console.info(
      `  ${size(orphan.bytes).padStart(8)}  ${orphan.since.toISOString().slice(0, 10)}  ${orphan.key}`,
    );
  }

  console.info(`\n  ${orphans.length} files, ${size(total)}.`);
  console.info(`  Anything newer than ${Math.round(GRACE_MS / 3_600_000)} hours is not listed.`);

  if (!remove) {
    console.info('\n  Nothing has been removed. Run again with --remove to delete these.\n');
    return;
  }

  const gone = await forgetOrphans(orphans);
  console.info(`\n  Removed ${gone}.\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
