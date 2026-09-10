/**
 * One line of JSON per event.
 *
 * Structured because these lines are read by a log search rather than by a
 * person scrolling, and the questions asked of them are always "how many" and
 * "which one", not "what happened next".
 */
export function log(event: string, detail: Record<string, unknown> = {}): void {
  console.info(JSON.stringify({ time: new Date().toISOString(), event, ...detail }));
}
