import { currentTrace } from './trace';

/**
 * One line of JSON per event.
 *
 * Structured because these lines are read by a log search rather than by a
 * person scrolling, and the questions asked of them are always "how many" and
 * "which one", not "what happened next".
 */

/**
 * Fields that never leave the process with their value intact. NFR-802.
 *
 * Matched on the name rather than the value, because a password looks like any
 * other string and a session token looks like any other identifier. Naming is
 * the only signal available at the moment of writing, and a field somebody
 * called `password` is a field somebody knew was a password.
 *
 * The list is deliberately about the four things NFR-802 names — credentials,
 * session tokens, payment details and whole personal records — rather than
 * about personal data in general. A log with no customer in it cannot answer
 * "which one", and a log that cannot answer "which one" is a log nobody uses.
 */
const NEVER = [
  'password',
  'passwordhash',
  'secret',
  'token',
  'tokenhash',
  'authorization',
  'cookie',
  'session',
  'apikey',
  'privatekey',
  'cardnumber',
  'pan',
  'cvv',
  'cvc',
  'iban',
  'sortcode',
  'accountnumber',
] as const;

const REDACTED = '[redacted]';

function isSecret(key: string): boolean {
  const name = key.toLowerCase().replace(/[^a-z]/g, '');
  return NEVER.some((banned) => name.includes(banned));
}

/**
 * The same object with anything named like a secret taken out.
 *
 * Depth-limited and cycle-safe: a log line is not the place to discover that
 * somebody passed a Prisma model with its relations attached, and an
 * exception thrown while writing a log loses the event it was reporting.
 */
function safe(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (depth > 6) return '[deep]';
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.slice(0, 50).map((item) => safe(item, depth + 1, seen));
  if (value instanceof Date) return value.toISOString();

  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSecret(key) ? REDACTED : safe(inner, depth + 1, seen);
  }
  return out;
}

export function log(event: string, detail: Record<string, unknown> = {}): void {
  // The trace of whatever caused this, where there is one. Phase 59: it is
  // what joins a line written by a worker to the press that produced it.
  const trace = currentTrace();

  console.info(
    JSON.stringify({
      time: new Date().toISOString(),
      event,
      ...(trace ? { trace } : {}),
      ...(safe(detail) as Record<string, unknown>),
    }),
  );
}

/** Exported for the quality checks, which assert the promise rather than trust it. */
export const redaction = { isSecret, safe, REDACTED };
