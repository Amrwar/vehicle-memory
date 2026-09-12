import { createHash } from 'node:crypto';

/**
 * Before general availability. Phase 21.
 *
 * Two small pieces of arithmetic the security model promised and the product
 * did not yet do: refusing a password that has already leaked, and refusing
 * an integration that calls faster than a workshop's database should be
 * asked to answer. Both are pure here; the network and the database are
 * somebody else's job.
 */

/* ------------------------------------------------- breached passwords (T1) */

/**
 * k-anonymity against Have I Been Pwned's range API. The first five hex
 * characters of the SHA-1 go over the wire; the remaining thirty-five never
 * leave the server, and the answer is a list of suffixes to compare against
 * locally. Nobody outside learns the password, or even its full digest.
 */
export function passwordRange(password: string): { prefix: string; suffix: string } {
  const digest = createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  return { prefix: digest.slice(0, 5), suffix: digest.slice(5) };
}

/** How many times the suffix appears in the range body, or zero. */
export function breachCount(rangeBody: string, suffix: string): number {
  const wanted = suffix.toUpperCase();
  for (const line of rangeBody.split(/\r?\n/)) {
    const [candidate, count] = line.trim().split(':');
    if (candidate === wanted) return Number(count ?? 0) || 0;
  }
  return 0;
}

export function describeBreach(count: number): string {
  if (count <= 0) return '';
  const times = count === 1 ? 'once' : `${count.toLocaleString('en-GB')} times`;
  return `That password has appeared in ${count === 1 ? 'a' : ''} data breach${count === 1 ? '' : 'es'} ${times}. Choose one nobody has used before; a phrase of four unrelated words is easy to remember and hard to guess.`;
}

/* ----------------------------------------------------- API rate limit (T8) */

export interface RateWindow {
  windowStartedAt: Date | null;
  windowCount: number;
}

export interface RateDecision {
  allowed: boolean;
  /** The window to write back: reset when it has lapsed, counted otherwise. */
  next: { windowStartedAt: Date; windowCount: number };
  remaining: number;
  /** When the window ends and the count starts again. */
  resetAt: Date;
  /** Whole seconds until then, for the Retry-After header. */
  retryAfterSeconds: number;
}

/** A thousand calls an hour per key: a busy accounting sync uses a few dozen. */
export const API_CALLS_PER_WINDOW = 1000;
export const API_WINDOW_MS = 60 * 60 * 1000;

/**
 * A fixed window. Simpler than a sliding one and honest about it: a client
 * that empties the window in the last minute and again in the first minute
 * of the next has made two thousand calls in two minutes, and the limit is
 * still a limit, because the third thousand waits an hour.
 */
export function decideRate(
  state: RateWindow,
  now = new Date(),
  limit = API_CALLS_PER_WINDOW,
  windowMs = API_WINDOW_MS,
): RateDecision {
  const lapsed =
    state.windowStartedAt === null || now.getTime() - state.windowStartedAt.getTime() >= windowMs;

  const windowStartedAt = lapsed ? now : state.windowStartedAt!;
  const count = lapsed ? 0 : state.windowCount;
  const resetAt = new Date(windowStartedAt.getTime() + windowMs);
  const allowed = count < limit;

  return {
    allowed,
    next: { windowStartedAt, windowCount: allowed ? count + 1 : count },
    remaining: Math.max(0, limit - (allowed ? count + 1 : count)),
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
  };
}

/* -------------------------------------------- content security policy (§7) */

export interface CspOptions {
  nonce: string;
  /** Development needs eval for React's error overlay and websockets for reload. */
  development: boolean;
}

/**
 * One policy for every page. Scripts run only with this request's nonce,
 * and anything a nonced script loads is trusted through 'strict-dynamic'.
 * Styles allow inline because the product sets widths and colours from
 * data (a utilisation bar, a job type's colour) as style attributes, which
 * a nonce cannot cover. Images and connections allow https: because
 * photographs and paperwork live in object storage under signed URLs.
 */
export function contentSecurityPolicy(options: CspOptions): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic'${options.development ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https:${options.development ? ' ws: wss:' : ''}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
    ...(options.development ? [] : ['upgrade-insecure-requests']),
  ];
  return directives.join('; ');
}

/** The headers every response carries, for the probe to assert. */
export const REQUIRED_SECURITY_HEADERS: readonly string[] = [
  'content-security-policy',
  'x-content-type-options',
  'referrer-policy',
  'x-frame-options',
  'permissions-policy',
];

/** What a policy must and must not contain, for the probe. */
export function assessPolicy(policy: string): string[] {
  const problems: string[] = [];
  const script = /script-src([^;]*)/.exec(policy)?.[1] ?? '';
  if (!script) problems.push('no script-src');
  if (script.includes("'unsafe-inline'")) problems.push("script-src allows 'unsafe-inline'");
  if (!/'nonce-[A-Za-z0-9+/=_-]+'/.test(script)) problems.push('script-src carries no nonce');
  if (!/object-src 'none'/.test(policy)) problems.push("object-src is not 'none'");
  if (!/frame-ancestors/.test(policy)) problems.push('no frame-ancestors');
  if (!/base-uri 'self'/.test(policy)) problems.push("base-uri is not 'self'");
  return problems;
}
