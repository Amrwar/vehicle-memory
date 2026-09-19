import { headers } from 'next/headers';

/**
 * One identifier, from the press to the inbox. Phase 59. NFR-803.
 *
 * A workshop rings to say a customer never got their message. Since Phase 50
 * the health page answers that for the message itself: consent, suppression,
 * status, held or stuck. What it cannot do is go the other way. Somebody
 * pressed a button and nothing happened — was the action recorded at all, did
 * it reach the outbox, did the outbox turn into a message, or did the whole
 * thing fall over before any of that?
 *
 * Four records and one identifier answers it. The proxy mints one per request;
 * everything that request causes carries it, including the background work it
 * enqueues, which is the half NFR-803 has been asking for since the first week
 * and nothing did.
 *
 * Read from a header rather than held in a variable, because the alternative
 * would be an async-local store entered around every server action — and one
 * action somebody forgot to wrap would silently have no trace, which is the
 * failure this is meant to end.
 */

/** The header the proxy sets, and the only place this is carried. */
export const TRACE_HEADER = 'x-carnet-trace';

/**
 * The current request's trace, or null.
 *
 * Null outside a request: a scheduled job, a verification script, a worker
 * pass. That is not a gap. Nobody pressed anything, and a trace invented for
 * a reminder queued at four in the morning would say a person was there.
 */
export async function traceId(): Promise<string | null> {
  try {
    return (await headers()).get(TRACE_HEADER);
  } catch {
    // No request in scope. Called from a job, a script, or a build.
    return null;
  }
}

/**
 * Shaped to be recognisable by eye and searchable by hand.
 *
 * Twelve hex characters after a `t-`, which is short enough to read down a
 * telephone and long enough that two presses in the same second do not
 * collide. Not a UUID: the operator's search box takes this, and a person
 * reading it off a log line has to be able to type it back.
 */
export function mintTrace(random: () => string = () => crypto.randomUUID()): string {
  return `t-${random().replace(/-/g, '').slice(0, 12)}`;
}

/** Whether a string looks like one, for the search box that accepts several things. */
export function looksLikeTrace(value: string): boolean {
  return /^t-[0-9a-f]{12}$/i.test(value.trim());
}
