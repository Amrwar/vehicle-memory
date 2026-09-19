import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The trace a background job inherited from the request that caused it.
 *
 * Phase 59, and the half of NFR-803 that had never existed. The web side reads
 * its trace from a request header, which a job does not have: by the time the
 * outbox is drained the request is long gone, possibly on another machine, and
 * quite possibly a day earlier.
 *
 * So the event carries it and the worker puts it back. Each event is handled
 * inside a context holding its own trace, and everything the handler writes or
 * logs picks it up from there without being passed it — which matters because
 * the alternative is threading an argument through every handler, and the one
 * somebody forgets is invisible.
 *
 * Async-local rather than a module variable, because the worker handles a
 * batch and two events must not be able to read each other's trace. A variable
 * would work perfectly until the day two jobs overlapped, and then it would
 * attribute one workshop's message to another workshop's press.
 */
const store = new AsyncLocalStorage<string | null>();

/** Runs the work with this trace in scope, whatever it awaits. */
export function withTrace<T>(trace: string | null, work: () => Promise<T>): Promise<T> {
  return store.run(trace ?? null, work);
}

/**
 * The trace in scope, or null.
 *
 * Null is the ordinary answer for a scheduled sweep: a reminder queued at four
 * in the morning was nobody's press, and inventing a trace for it would say a
 * person was there.
 */
export function currentTrace(): string | null {
  return store.getStore() ?? null;
}
