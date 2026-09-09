import { type Currency, fromDecimal, type Money, money, multiply, subtract } from '../shared/money';

/**
 * Stock levels, valuation and reservation.
 *
 * Three quantities that are constantly confused, and the confusion is the
 * source of most inventory bugs:
 *
 *   onHand      physically on the shelf
 *   reserved    committed to a job, still on the shelf
 *   available   onHand - reserved, what a new job may take
 *
 * A system that reserves against `onHand` will promise the same set of brake
 * pads to two jobs, and the second technician discovers it with the car on the
 * lift.
 *
 * Invariants S1 to S4 in docs/02-design/01-domain-model.md.
 */

export type MovementType =
  'RECEIPT' | 'ISSUE' | 'ADJUSTMENT' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'RETURN' | 'STOCKTAKE';

export interface StockPosition {
  /** Physically present. May be negative if the workshop over-issued. */
  onHand: number;
  /** Committed to jobs, not yet consumed. */
  reserved: number;
  /** Weighted average cost per unit, in major units as a decimal string. */
  avgCost: string | number;
}

export class StockError extends Error {
  readonly code: StockErrorCode;

  constructor(code: StockErrorCode, message: string) {
    super(message);
    this.name = 'StockError';
    this.code = code;
  }
}

export type StockErrorCode =
  'INSUFFICIENT_AVAILABLE' | 'NEGATIVE_QUANTITY' | 'RELEASE_EXCEEDS_RESERVED';

/** What a new job may take without breaking an existing promise. */
export function availableQuantity(position: StockPosition): number {
  return round3(position.onHand - position.reserved);
}

/* ---------------------------------------------------------------------------
   Weighted average cost
   --------------------------------------------------------------------------- */

export interface ReceiptResult {
  onHand: number;
  avgCost: Money;
  /** Total value added to stock by this receipt. */
  valueAdded: Money;
}

/**
 * Applies a goods receipt, recalculating weighted average cost.
 *
 *   newAvg = (onHand * avgCost + received * unitCost) / (onHand + received)
 *
 * Weighted average rather than FIFO because a workshop's stock is fungible
 * consumables and the same part number bought at two prices is genuinely
 * indistinguishable on the shelf. FIFO would require lot tracking that nobody
 * would maintain, and unmaintained lot tracking is worse than none.
 *
 * The awkward case is receiving into a negative balance, which happens when a
 * workshop issues a part before booking in the delivery. Averaging against a
 * negative quantity produces nonsense, so the new cost simply becomes the
 * receipt cost.
 */
export function applyReceipt(
  position: StockPosition,
  receivedQuantity: number,
  receivedUnitCost: string | number,
  currency: Currency = 'GBP',
): ReceiptResult {
  if (receivedQuantity <= 0) {
    throw new StockError('NEGATIVE_QUANTITY', 'A receipt quantity must be greater than zero');
  }

  const unitCost = fromDecimal(receivedUnitCost, currency);
  const existingCost = fromDecimal(position.avgCost, currency);
  const newOnHand = round3(position.onHand + receivedQuantity);

  let avgCost: Money;

  if (position.onHand <= 0) {
    // Nothing meaningful to average against.
    avgCost = unitCost;
  } else {
    const existingValue = multiply(existingCost, position.onHand).minor;
    const incomingValue = multiply(unitCost, receivedQuantity).minor;
    avgCost = money(Math.round((existingValue + incomingValue) / newOnHand), currency);
  }

  return {
    onHand: newOnHand,
    avgCost,
    valueAdded: multiply(unitCost, receivedQuantity),
  };
}

export interface IssueResult {
  onHand: number;
  /** Cost charged against the job. FR-1011. */
  cost: Money;
}

/**
 * Issues stock to a job at the current weighted average cost.
 *
 * Issuing more than is on hand is permitted and produces a negative balance.
 * That is deliberate: the part is physically in the car, and refusing to
 * record it would leave the job costed at zero while the stock figure stayed
 * comfortingly wrong. A negative balance is visible and gets investigated; a
 * silently uncosted job does not.
 */
export function applyIssue(
  position: StockPosition,
  quantity: number,
  currency: Currency = 'GBP',
): IssueResult {
  if (quantity <= 0) {
    throw new StockError('NEGATIVE_QUANTITY', 'An issue quantity must be greater than zero');
  }

  return {
    onHand: round3(position.onHand - quantity),
    cost: multiply(fromDecimal(position.avgCost, currency), quantity),
  };
}

/** Total value of a position, used for the stock figure in the balance sheet. */
export function stockValue(position: StockPosition, currency: Currency = 'GBP'): Money {
  return multiply(fromDecimal(position.avgCost, currency), position.onHand);
}

/**
 * A stocktake sets the counted quantity and posts the difference as an
 * adjustment. The variance is what the accounts need; the count alone is not
 * enough to explain the movement.
 */
export interface StocktakeResult {
  counted: number;
  variance: number;
  varianceValue: Money;
  direction: 'shortage' | 'surplus' | 'exact';
}

export function applyStocktake(
  position: StockPosition,
  countedQuantity: number,
  currency: Currency = 'GBP',
): StocktakeResult {
  if (countedQuantity < 0) {
    throw new StockError('NEGATIVE_QUANTITY', 'A counted quantity cannot be negative');
  }

  const variance = round3(countedQuantity - position.onHand);
  const unit = fromDecimal(position.avgCost, currency);

  return {
    counted: countedQuantity,
    variance,
    varianceValue: multiply(unit, variance),
    direction: variance < 0 ? 'shortage' : variance > 0 ? 'surplus' : 'exact',
  };
}

/* ---------------------------------------------------------------------------
   Reservation
   --------------------------------------------------------------------------- */

export interface ReservationOutcome {
  /** How much was actually reserved. */
  reserved: number;
  /** How much could not be, and therefore needs ordering. FR-1102. */
  shortfall: number;
  reservedTotal: number;
  status: 'RESERVED' | 'PARTIAL' | 'UNAVAILABLE';
}

/**
 * Reserves stock for a job part line.
 *
 * Partial reservation is deliberate. If a technician needs four and there are
 * three, taking the three and ordering one is what the workshop would actually
 * do. Refusing outright would force them to record nothing, which is how stock
 * figures stop reflecting reality.
 *
 * This must be called under a row lock on the stock level. Two jobs reserving
 * the last set of pads concurrently would otherwise both succeed.
 */
export function reserve(position: StockPosition, wanted: number): ReservationOutcome {
  if (wanted <= 0) {
    throw new StockError('NEGATIVE_QUANTITY', 'A reservation must be greater than zero');
  }

  const available = availableQuantity(position);
  const reserved = round3(Math.max(0, Math.min(wanted, available)));
  const shortfall = round3(wanted - reserved);

  return {
    reserved,
    shortfall,
    reservedTotal: round3(position.reserved + reserved),
    status: reserved === 0 ? 'UNAVAILABLE' : shortfall > 0 ? 'PARTIAL' : 'RESERVED',
  };
}

/** Releases a reservation, when a job is cancelled or a line removed. */
export function release(position: StockPosition, quantity: number): number {
  if (quantity <= 0) {
    throw new StockError('NEGATIVE_QUANTITY', 'A release must be greater than zero');
  }
  if (quantity > position.reserved + 1e-9) {
    throw new StockError(
      'RELEASE_EXCEEDS_RESERVED',
      `Cannot release ${quantity} when only ${position.reserved} is reserved`,
    );
  }
  return round3(position.reserved - quantity);
}

/**
 * Consuming a reservation when the part is fitted: the reservation ends and
 * the stock leaves the shelf in one step. Doing these separately is how a
 * part ends up counted as both reserved and issued.
 */
export interface ConsumeResult {
  onHand: number;
  reserved: number;
  cost: Money;
}

export function consumeReservation(
  position: StockPosition,
  quantity: number,
  currency: Currency = 'GBP',
): ConsumeResult {
  const issue = applyIssue(position, quantity, currency);
  // A part fitted without a reservation still leaves the shelf; the reserved
  // figure simply floors at zero rather than going negative.
  const reserved = round3(Math.max(0, position.reserved - quantity));

  return { onHand: issue.onHand, reserved, cost: issue.cost };
}

/* ---------------------------------------------------------------------------
   Position summary, for the parts list
   --------------------------------------------------------------------------- */

export type StockState = 'OUT' | 'SHORT' | 'LOW' | 'OK' | 'OVER';

export interface StockSummary {
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  state: StockState;
  /** True when the reorder point is breached and nothing is on order. */
  needsOrdering: boolean;
}

export function summariseStock(
  position: StockPosition,
  reorderPoint: number,
  onOrder = 0,
): StockSummary {
  const available = availableQuantity(position);

  let state: StockState;
  if (position.onHand < 0) state = 'OVER';
  else if (available <= 0) state = 'OUT';
  else if (available < reorderPoint) state = 'SHORT';
  else if (available === reorderPoint) state = 'LOW';
  else state = 'OK';

  return {
    onHand: position.onHand,
    reserved: position.reserved,
    available,
    reorderPoint,
    state,
    needsOrdering: available <= reorderPoint && onOrder <= 0,
  };
}

export function describeStockState(state: StockState): string {
  switch (state) {
    case 'OVER':
      return 'Issued more than recorded';
    case 'OUT':
      return 'None available';
    case 'SHORT':
      return 'Below reorder point';
    case 'LOW':
      return 'At reorder point';
    case 'OK':
      return 'In stock';
  }
}

export function stockTone(state: StockState): 'danger' | 'warning' | 'success' | 'neutral' {
  switch (state) {
    case 'OVER':
    case 'OUT':
      return 'danger';
    case 'SHORT':
    case 'LOW':
      return 'warning';
    case 'OK':
      return 'success';
  }
}

/** Quantities carry three decimals: fluids and part-hours are not integers. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export { subtract as subtractMoney };
