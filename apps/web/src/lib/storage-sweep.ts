import { readdir, rm, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';

import { prisma } from '@carnet/db';

/**
 * Files in the store that no row points at. Phase 49.
 *
 * A photograph reaches the store without passing through the server: the
 * browser is handed a signed URL and uploads straight to it, and the server
 * only records that it happened. That is the right design for a four-megabyte
 * picture and it has a consequence nobody notices until somebody looks — when
 * the row goes, nothing takes the file with it.
 *
 * The recovery drill is what looked. It found files belonging to conversations
 * that no longer exist, and they would have sat there for ever: a bill that
 * grows, and a photograph of somebody's car that nothing will ever delete,
 * which is the more serious half. A workshop that tells a customer their
 * record has been erased should be telling the truth.
 *
 * Nothing here deletes on its own. A file uploaded thirty seconds ago has no
 * row yet by design — the ticket is issued first and the row is written when
 * the upload finishes — so a sweep with no patience would delete exactly the
 * files somebody is in the middle of adding. Hence the grace period, and hence
 * a tool an operator runs rather than a job that runs itself.
 */

/** Long enough that anything still being uploaded is safe. */
export const GRACE_MS = 24 * 60 * 60 * 1000;

export interface Orphan {
  key: string;
  bytes: number;
  since: Date;
}

/** Every key the database says should exist. */
export async function referencedKeys(): Promise<Set<string>> {
  // bounded: not at all, on purpose. This is the sweep that decides what in the
  // file store is an orphan, and a sweep that looks at part of the store deletes
  // things it has not seen. It runs from a script, on a schedule, never from a
  // page, and it fetches five columns of keys rather than any content.
  const [events, jobs, photos, documents, messages] = await Promise.all([
    prisma.vehicleEventAttachment.findMany({ select: { url: true } }),
    prisma.jobAttachment.findMany({ select: { url: true } }),
    prisma.inspectionPhoto.findMany({ select: { url: true } }),
    prisma.vehicleDocument.findMany({ select: { fileKey: true } }),
    // bounded: as above — the whole store, on purpose.
    prisma.messageAttachment.findMany({ select: { url: true } }),
  ]);

  return new Set([
    ...events.map((row) => row.url),
    ...jobs.map((row) => row.url),
    ...photos.map((row) => row.url),
    ...documents.map((row) => row.fileKey),
    ...messages.map((row) => row.url),
  ]);
}

/** What the local store holds, with how big and how old. */
async function localObjects(root: string): Promise<Orphan[]> {
  const found: Orphan[] = [];

  const walk = async (dir: string) => {
    let entries: string[];

    try {
      entries = await readdir(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = join(dir, entry);
      const info = await stat(full);

      if (info.isDirectory()) {
        await walk(full);
      } else {
        found.push({
          key: relative(root, full).split(sep).join('/'),
          bytes: info.size,
          since: info.mtime,
        });
      }
    }
  };

  await walk(root);
  return found;
}

/** The same, from an S3-compatible bucket. */
async function remoteObjects(): Promise<Orphan[]> {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) return [];

  const client = new S3Client({
    region: process.env.S3_REGION ?? 'auto',
    endpoint: process.env.S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  });

  const found: Orphan[] = [];
  let token: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }),
    );

    for (const object of page.Contents ?? []) {
      if (!object.Key) continue;
      found.push({
        key: object.Key,
        bytes: object.Size ?? 0,
        since: object.LastModified ?? new Date(0),
      });
    }

    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);

  return found;
}

/**
 * Everything in the store that nothing points at and that is old enough to be
 * sure about.
 */
export async function orphanedFiles(now = new Date()): Promise<Orphan[]> {
  const keys = await referencedKeys();

  const objects =
    process.env.STORAGE_DRIVER === 's3'
      ? await remoteObjects()
      : await localObjects(process.env.STORAGE_LOCAL_PATH ?? '.storage');

  return objects
    .filter((object) => !keys.has(object.key))
    .filter((object) => now.getTime() - object.since.getTime() > GRACE_MS)
    .sort((a, b) => b.bytes - a.bytes);
}

/** Removes them. Called only by somebody who has read the list first. */
export async function forgetOrphans(orphans: readonly Orphan[]): Promise<number> {
  if (orphans.length === 0) return 0;

  if (process.env.STORAGE_DRIVER === 's3') {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) return 0;

    const client = new S3Client({
      region: process.env.S3_REGION ?? 'auto',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    });

    for (const orphan of orphans) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: orphan.key }));
    }

    return orphans.length;
  }

  const root = process.env.STORAGE_LOCAL_PATH ?? '.storage';

  for (const orphan of orphans) {
    await rm(join(root, orphan.key), { force: true });
  }

  return orphans.length;
}
