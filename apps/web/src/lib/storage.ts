import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Where files go.
 *
 * The same shape as the messaging transports, for the same reason: pick a
 * protocol rather than a vendor. S3's API is spoken by Cloudflare R2, Amazon
 * S3, Backblaze and MinIO, so moving between them is a URL and two keys, and
 * no code above this file knows which one is behind it.
 *
 * A photograph never passes through the server. A workshop picture is commonly
 * three or four megabytes and a serverless request body caps well below that,
 * so the browser is handed a short-lived signed URL and uploads straight to
 * the store. The server only records that it happened.
 *
 * Which of these matters is not obvious until it costs money: inspection
 * photographs are read far more often than they are written, because every
 * customer opens their report and every future buyer opens the passport. A
 * store that charges for egress bills for all of that. R2 does not, which is
 * why it is the recommendation, and why nothing here depends on that choice.
 */

export type StorageDriver = 'local' | 's3';

export interface UploadTicket {
  /** Where the browser PUTs the file. */
  url: string;
  /** Headers it must send with it, if any. */
  headers: Record<string, string>;
  /** The key to record against the row afterwards. */
  key: string;
  /** How the file is read back later. */
  publicUrl: string;
}

export class StorageError extends Error {
  readonly code: 'UNCONFIGURED' | 'TOO_LARGE' | 'BAD_TYPE';

  constructor(code: StorageError['code'], message: string) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
  }
}

/** What a camera on a phone produces, and nothing else. */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
/** Paperwork is a PDF or a picture of the paper. Phase 20. */
const DOCUMENT_TYPES = [...ALLOWED_TYPES, 'application/pdf'];

/** Above this, something has gone wrong or somebody is uploading a video. */
export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

export function driver(): StorageDriver {
  return process.env.STORAGE_DRIVER === 's3' ? 's3' : 'local';
}

function client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new StorageError(
      'UNCONFIGURED',
      'The file store is set to s3 and has no endpoint or keys. Set S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY.',
    );
  }

  return new S3Client({
    // R2 ignores the region but the client insists on one.
    region: process.env.S3_REGION ?? 'auto',
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    // R2 and MinIO address buckets by path rather than by subdomain.
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
  });
}

/**
 * Somewhere to put one file, valid for a few minutes.
 *
 * The key carries the organisation and the thing it belongs to, so a store
 * can be read by a person looking for something without a database beside
 * them, and so one workshop's files are never interleaved with another's.
 */
export async function ticketFor(input: {
  orgId: string;
  scope: string;
  scopeId: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  /** Photographs only, or paperwork too. Photographs by default. */
  accept?: 'photo' | 'document';
}): Promise<UploadTicket> {
  const allowed = input.accept === 'document' ? DOCUMENT_TYPES : ALLOWED_TYPES;
  if (!allowed.includes(input.contentType)) {
    throw new StorageError(
      'BAD_TYPE',
      input.accept === 'document'
        ? `${input.contentType || 'That file'} is not a PDF or a picture of the paper.`
        : `${input.contentType || 'That file'} is not a photograph. Use a picture from the camera.`,
    );
  }

  if (input.sizeBytes > MAX_PHOTO_BYTES) {
    throw new StorageError(
      'TOO_LARGE',
      `That file is ${Math.round(input.sizeBytes / 1024 / 1024)}MB. The limit is ${MAX_PHOTO_BYTES / 1024 / 1024}MB.`,
    );
  }

  // Random rather than derived from the filename. Two technicians
  // photographing the same wheel both produce IMG_0001.jpg.
  const extension = input.filename.split('.').pop()?.toLowerCase().slice(0, 5) ?? 'jpg';
  const key = `${input.orgId}/${input.scope}/${input.scopeId}/${randomBytes(12).toString('hex')}.${extension}`;

  if (driver() === 'local') {
    // Development. The browser posts to a route in this application, which
    // writes the file to disk. Not for production: the disk on a serverless
    // host is discarded, and a photograph that vanishes silently is worse than
    // one that was never taken.
    return {
      url: `/api/uploads?key=${encodeURIComponent(key)}`,
      headers: { 'content-type': input.contentType },
      key,
      publicUrl: `/api/uploads?key=${encodeURIComponent(key)}`,
    };
  }

  const bucket = process.env.S3_BUCKET;

  if (!bucket) {
    throw new StorageError('UNCONFIGURED', 'The file store has no bucket. Set S3_BUCKET.');
  }

  const url = await getSignedUrl(
    client(),
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
    }),
    { expiresIn: 300 },
  );

  return {
    url,
    headers: { 'content-type': input.contentType },
    key,
    publicUrl: `/api/uploads?key=${encodeURIComponent(key)}`,
  };
}

/**
 * A link to read one file, valid for an hour.
 *
 * Signed rather than public, because an inspection photograph is a picture of
 * somebody's car with their registration in it, and a bucket left open is a
 * bucket somebody eventually indexes.
 */
export async function readUrlFor(key: string): Promise<string | null> {
  if (driver() === 'local') return `/api/uploads?key=${encodeURIComponent(key)}`;

  const bucket = process.env.S3_BUCKET;
  if (!bucket) return null;

  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: 3600,
  });
}

/** Writes a file to disk. Development only; see the note in `ticketFor`. */
export async function writeLocal(key: string, body: Buffer): Promise<void> {
  const root = process.env.STORAGE_LOCAL_PATH ?? '.storage';
  const path = join(root, key);

  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, body);
}
