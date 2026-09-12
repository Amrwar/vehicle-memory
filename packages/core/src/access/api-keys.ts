import { createHash, randomBytes } from 'node:crypto';

/**
 * Keys for the things a workshop already runs.
 *
 * A larger workshop or a fleet integrates accounting, a calendar, a fleet
 * platform. Each needs to read the records without a person signed in. A key
 * is that person: it belongs to one organisation, it is shown once, only its
 * digest is stored, and it can be revoked in a list that names it.
 *
 * Read only, deliberately. Writing through an API is how a record gets a
 * shape nobody in the workshop chose. The first integration that needs to
 * write will name what it needs to write, and that is the moment to decide.
 */

/** Every token starts with this, so one found in a log is recognisable. */
export const API_KEY_PREFIX = 'cn_';

export function issueApiKey(): { token: string; hash: string; prefix: string } {
  const token = `${API_KEY_PREFIX}${randomBytes(24).toString('base64url')}`;
  return { token, hash: hashApiKey(token), prefix: token.slice(0, 10) };
}

export function hashApiKey(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** The token out of an Authorization header, or nothing. */
export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  const token = match?.[1] ?? null;
  return token && token.startsWith(API_KEY_PREFIX) ? token : null;
}

export class ApiKeyError extends Error {
  constructor(
    readonly code: 'NO_NAME' | 'REVOKED' | 'UNKNOWN' | 'MISSING' | 'RATE_LIMITED',
    message: string,
    /** For RATE_LIMITED: whole seconds until the window resets. */
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

export function assertKeyNameable(name: string): void {
  if (!name.trim()) {
    throw new ApiKeyError(
      'NO_NAME',
      'Name the key after what will use it, so the person revoking it later knows what breaks.',
    );
  }
}

export function assertKeyUsable(key: { revokedAt: Date | null } | null): void {
  if (!key) throw new ApiKeyError('UNKNOWN', 'That key is not one we issued.');
  if (key.revokedAt) throw new ApiKeyError('REVOKED', 'That key was revoked.');
}

/** A window for "everything since", bounded so a first sync cannot ask for a decade. */
export function sinceFrom(value: string | null, now = new Date()): Date {
  const floor = new Date(now.getTime() - 366 * 86_400_000);
  if (!value) return new Date(now.getTime() - 30 * 86_400_000);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date(now.getTime() - 30 * 86_400_000);
  return parsed < floor ? floor : parsed;
}

/** One line for the list. */
export function describeApiKey(key: {
  name: string;
  prefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}): string {
  if (key.revokedAt)
    return `${key.name} (${key.prefix}…) revoked ${key.revokedAt.toLocaleDateString('en-GB')}.`;
  if (!key.lastUsedAt) return `${key.name} (${key.prefix}…) never used.`;
  return `${key.name} (${key.prefix}…) last used ${key.lastUsedAt.toLocaleDateString('en-GB')}.`;
}
