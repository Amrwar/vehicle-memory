/**
 * The box in your hands.
 *
 * Receiving a delivery is a two-handed job done standing up. A pallet, a
 * delivery note, a scanner, and thirty boxes that have to end up on the right
 * shelves with the right quantities booked against the right order. The
 * screens built in Phase 2 assume somebody sitting down with the note,
 * matching lines by eye and typing figures into a form.
 *
 * `validateReceipt` already refuses a bad receipt at the moment it is
 * submitted, and that is the right place for the last word. It is the wrong
 * place for the *first* word: by then the pallet is unloaded, the boxes are on
 * the floor, and "3 received but only 2 outstanding" is a puzzle about
 * something that happened twenty minutes ago.
 *
 * What is missing is the answer at the moment of the scan.
 *
 * ## The scan identifies; it never counts
 *
 * A tempting design adds one to a line per scan. It is fast, and it is how a
 * workshop receives eleven of ten without noticing: the scanner double-fires,
 * nobody is looking at the screen, and the count is wrong in a way that is
 * only discovered when the stocktake disagrees months later.
 *
 * So a scan selects a line and nothing else. A person then says how many,
 * which is the number on the box in their hand. That is one more keystroke and
 * it is the keystroke that makes the figure somebody's rather than the
 * scanner's.
 *
 * ## What is not on this order is said, loudly
 *
 * The single most useful thing this can do. A box that scans to a part not on
 * the order means one of three things -- the supplier sent something nobody
 * ordered, somebody is receiving against the wrong order, or the box belongs
 * to a different delivery entirely -- and all three are worth stopping for.
 * A system that ignored the scan would have the receiver shrug and move on.
 *
 * Phase 93.
 */

/** One line of a purchase order, as the person at the pallet sees it. */
export interface ReceivingLine {
  orderLineId: string;
  productId: string | null;
  partNumber: string | null;
  barcode: string | null;
  description: string;
  ordered: number;
  /** Booked in on earlier deliveries against this order. */
  alreadyReceived: number;
  /** Counted in this session and not yet submitted. */
  counted: number;
  /** Where this part lives, where it has a home. */
  bin: string | null;
}

/** What is still owed on a line. Never negative: an over-receipt is not a debt. */
export function stillOwedOn(line: ReceivingLine): number {
  return Math.max(0, line.ordered - line.alreadyReceived - line.counted);
}

export type ScanResult =
  | { found: 'line'; line: ReceivingLine; outstanding: number }
  | { found: 'settled'; line: ReceivingLine }
  | { found: 'several'; lines: ReceivingLine[] }
  | { found: 'not-on-this-order'; scanned: string };

function matches(line: ReceivingLine, value: string): boolean {
  const want = value.trim().toLowerCase();
  if (!want) return false;
  return (
    line.orderLineId.toLowerCase() === want ||
    (line.productId ?? '').toLowerCase() === want ||
    (line.partNumber ?? '').toLowerCase() === want ||
    (line.barcode ?? '').toLowerCase() === want
  );
}

/**
 * Which line the box in your hands belongs to.
 *
 * Four answers, and the last two are the ones that earn this function.
 *
 * `settled` is a line already fully received: not an error, and not something
 * to silently ignore either. "You have had all ten of those" is what somebody
 * needs to hear before they open the box.
 *
 * `not-on-this-order` is the loud one. Three things cause it and all three are
 * worth stopping for.
 */
export function scanAgainstOrder(lines: readonly ReceivingLine[], scanned: string): ScanResult {
  const hits = lines.filter((line) => matches(line, scanned));

  if (hits.length === 0) return { found: 'not-on-this-order', scanned: scanned.trim() };

  // Two lines of one order for the same part -- a split delivery, two prices,
  // two dates -- is a real thing, and picking one would book the goods against
  // whichever was created first. Ask.
  if (hits.length > 1) {
    const open = hits.filter((line) => stillOwedOn(line) > 0);
    if (open.length > 1) return { found: 'several', lines: open };
    if (open.length === 1)
      return { found: 'line', line: open[0]!, outstanding: stillOwedOn(open[0]!) };
    return { found: 'settled', line: hits[0]! };
  }

  const line = hits[0]!;
  const outstanding = stillOwedOn(line);
  return outstanding > 0 ? { found: 'line', line, outstanding } : { found: 'settled', line };
}

export type CountVerdict = 'EXACT' | 'SHORT' | 'OVER' | 'NOT_A_COUNT';

export interface Counted {
  verdict: CountVerdict;
  /** What would still be owed after this. */
  remaining: number;
  /** How many more than were owed. Zero unless OVER. */
  excess: number;
}

/**
 * What a typed quantity means against what is owed.
 *
 * An over-receipt is reported rather than refused here, because the refusal
 * belongs at the submit where `validateReceipt` makes it -- and because the
 * person at the pallet needs to be told *now*, while the box is in their
 * hands and the driver is still in the yard, which is the only moment anybody
 * can do anything about it.
 */
export function countAgainst(line: ReceivingLine, quantity: number): Counted {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { verdict: 'NOT_A_COUNT', remaining: stillOwedOn(line), excess: 0 };
  }

  const owed = stillOwedOn(line);
  if (quantity > owed) {
    return { verdict: 'OVER', remaining: 0, excess: Math.round((quantity - owed) * 1000) / 1000 };
  }

  const remaining = Math.round((owed - quantity) * 1000) / 1000;
  return { verdict: remaining === 0 ? 'EXACT' : 'SHORT', remaining, excess: 0 };
}

/**
 * Where a part should go, unless somebody says otherwise.
 *
 * Its existing home. A delivery that made somebody retype the bin every time
 * is a delivery where the same part ends up on two shelves, and then neither
 * count is right.
 */
export function binFor(line: ReceivingLine, typed?: string | null): string | null {
  const said = typed?.trim();
  return said ? said : line.bin;
}

export interface WhatIsLeft {
  lines: ReceivingLine[];
  outstandingLines: number;
  outstandingItems: number;
  done: boolean;
}

/**
 * What the pallet still owes, so somebody knows when to stop looking.
 *
 * Ordered by what is outstanding, most first, because the line with eight
 * boxes still to come is the one worth walking back to the pallet for.
 */
export function whatIsLeft(lines: readonly ReceivingLine[]): WhatIsLeft {
  const open = lines
    .filter((line) => stillOwedOn(line) > 0)
    .sort((a, b) => stillOwedOn(b) - stillOwedOn(a));

  return {
    lines: open,
    outstandingLines: open.length,
    outstandingItems:
      Math.round(open.reduce((total, line) => total + stillOwedOn(line), 0) * 1000) / 1000,
    done: open.length === 0,
  };
}

/** What has been counted in this session, ready for `validateReceipt`. */
export function countedSoFar(
  lines: readonly ReceivingLine[],
): { orderLineId: string; quantity: number }[] {
  return lines
    .filter((line) => line.counted > 0)
    .map((line) => ({ orderLineId: line.orderLineId, quantity: line.counted }));
}
