/**
 * Reordering.
 *
 * The question a workshop actually asks is not "are we below the reorder
 * point" but "how many should I order, and will it arrive before we run out".
 * Answering the second needs three things the first ignores: how fast the part
 * actually moves, how long the supplier takes, and what is already on order.
 *
 * FR-1006, FR-1007.
 */

export interface UsageRecord {
  /** Quantity issued. Positive. */
  quantity: number;
  at: Date;
}

export interface ReorderInput {
  available: number;
  /** Quantity on outstanding purchase orders, not yet received. */
  onOrder: number;
  /** Issues over the observation window. */
  usage: readonly UsageRecord[];
  /** Supplier lead time in days. */
  leadTimeDays: number;
  /** How many days of cover to hold beyond lead time. */
  safetyDays?: number;
  /** How many days of stock an order should bring the part up to. */
  coverageDays?: number;
  /** Minimum order quantity imposed by the supplier. */
  minimumOrderQuantity?: number;
  /** Parts sold in boxes of six cannot be ordered in fives. */
  packSize?: number;
  now?: Date;
}

export type ReorderConfidence = 'none' | 'low' | 'medium' | 'high';

export interface ReorderSuggestion {
  /** How many to order. Zero means no action. */
  quantity: number;
  reorderPoint: number;
  averageDailyUsage: number;
  /** Days until stock runs out at the observed rate, null when it does not move. */
  daysOfCover: number | null;
  /** True when stock will run out before a new order could arrive. */
  urgent: boolean;
  confidence: ReorderConfidence;
  reason: string;
}

const DEFAULT_SAFETY_DAYS = 7;
const DEFAULT_COVERAGE_DAYS = 60;

/**
 * Average daily usage over the window actually observed, not over an assumed
 * period. A part with three issues in the last fortnight and none before it
 * should not be averaged across a year.
 */
export function averageDailyUsage(usage: readonly UsageRecord[], now = new Date()): number {
  if (usage.length === 0) return 0;

  const ordered = [...usage].sort((a, b) => a.at.getTime() - b.at.getTime());
  const earliest = ordered[0]!.at;
  const days = Math.max(1, (now.getTime() - earliest.getTime()) / 86_400_000);
  const total = ordered.reduce((sum, record) => sum + Math.abs(record.quantity), 0);

  return total / days;
}

/**
 * Confidence in the usage figure. Reported rather than hidden, because an
 * order quantity derived from two data points should not be presented with
 * the same authority as one derived from forty.
 */
function confidenceFor(usage: readonly UsageRecord[], now: Date): ReorderConfidence {
  if (usage.length === 0) return 'none';

  const ordered = [...usage].sort((a, b) => a.at.getTime() - b.at.getTime());
  const spanDays = (now.getTime() - ordered[0]!.at.getTime()) / 86_400_000;

  if (usage.length < 3 || spanDays < 30) return 'low';
  if (usage.length < 10 || spanDays < 90) return 'medium';
  return 'high';
}

export function suggestReorder(input: ReorderInput): ReorderSuggestion {
  const now = input.now ?? new Date();
  const safetyDays = input.safetyDays ?? DEFAULT_SAFETY_DAYS;
  const coverageDays = input.coverageDays ?? DEFAULT_COVERAGE_DAYS;
  const packSize = input.packSize && input.packSize > 0 ? input.packSize : 1;

  const daily = averageDailyUsage(input.usage, now);
  const confidence = confidenceFor(input.usage, now);

  // Enough to cover the supplier's lead time, plus a buffer.
  const reorderPoint = round3(daily * (input.leadTimeDays + safetyDays));
  const position = input.available + input.onOrder;
  const daysOfCover = daily > 0 ? round1(input.available / daily) : null;

  if (daily === 0) {
    return {
      quantity: 0,
      reorderPoint: 0,
      averageDailyUsage: 0,
      daysOfCover: null,
      urgent: false,
      confidence,
      reason:
        input.available <= 0
          ? 'No stock and no recorded usage. Order manually if this part is needed.'
          : 'This part has not moved in the observed period.',
    };
  }

  if (position > reorderPoint) {
    return {
      quantity: 0,
      reorderPoint,
      averageDailyUsage: round3(daily),
      daysOfCover,
      urgent: false,
      confidence,
      reason:
        input.onOrder > 0
          ? `${input.available} available with ${input.onOrder} on order, above the reorder point of ${reorderPoint}.`
          : `${input.available} available, above the reorder point of ${reorderPoint}.`,
    };
  }

  // Bring the position up to the coverage target, then round up to a whole
  // pack and respect the supplier's minimum.
  const target = daily * coverageDays;
  let quantity = Math.max(0, target - position);
  quantity = Math.ceil(quantity / packSize) * packSize;

  if (input.minimumOrderQuantity && quantity < input.minimumOrderQuantity) {
    quantity = input.minimumOrderQuantity;
  }

  // Will it run out before a replenishment could arrive?
  const urgent = daysOfCover !== null && daysOfCover < input.leadTimeDays;

  return {
    quantity: round3(quantity),
    reorderPoint,
    averageDailyUsage: round3(daily),
    daysOfCover,
    urgent,
    confidence,
    reason: urgent
      ? `Only ${daysOfCover} days of cover against a ${input.leadTimeDays} day lead time. Order now.`
      : `${input.available} available against a reorder point of ${reorderPoint}. Ordering ${round3(quantity)} gives about ${coverageDays} days of cover.`,
  };
}

export function describeConfidence(confidence: ReorderConfidence): string {
  switch (confidence) {
    case 'none':
      return 'No usage recorded';
    case 'low':
      return 'Few data points, treat as a starting figure';
    case 'medium':
      return 'Reasonable history';
    case 'high':
      return 'Well established usage';
  }
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
