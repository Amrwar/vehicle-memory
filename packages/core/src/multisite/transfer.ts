import { add, type Money, money, multiply, sum, zero } from '../shared/money';

/**
 * Moving stock between sites.
 *
 * The part that catches people out is the middle. A box that has left Leeds
 * and has not arrived in Bradford is somewhere, and if the system deducts it
 * on dispatch and only adds it on receipt without tracking the gap, that stock
 * simply vanishes from every report for two days. At the next stocktake it
 * reads as shrinkage, and shrinkage is investigated as theft.
 *
 * So a transfer has three quantities, not two: sent, received, and in transit
 * as the difference. In transit is a real balance that belongs to the
 * organisation and appears in the group stock value, just not at either site.
 */

export type TransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'PART_RECEIVED' | 'RECEIVED' | 'CANCELLED';

const TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  DRAFT: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['PART_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PART_RECEIVED: ['RECEIVED', 'CANCELLED'],
  // Terminal. A transfer that arrived is history; sending it back is a new
  // transfer in the other direction, which is also what physically happened.
  RECEIVED: [],
  CANCELLED: [],
};

export function canTransitionTransfer(from: TransferStatus, to: TransferStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export class TransferError extends Error {
  readonly code:
    | 'SAME_SITE'
    | 'NOT_DISPATCHED'
    | 'OVER_RECEIPT'
    | 'NOTHING_TO_SEND'
    | 'CANCEL_IN_TRANSIT'
    | 'BAD_TRANSITION';

  constructor(code: TransferError['code'], message: string) {
    super(message);
    this.name = 'TransferError';
    this.code = code;
  }
}

export interface TransferLine {
  productId: string;
  partNumber: string;
  description: string;
  /** Quantity that left the origin. */
  sent: number;
  /** Quantity booked in at the destination so far. */
  received: number;
  /** Weighted average cost at the origin when it was dispatched. */
  unitCost: Money;
}

export interface StockTransfer {
  id: string;
  reference: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: TransferStatus;
  lines: TransferLine[];
  dispatchedAt: Date | null;
  receivedAt: Date | null;
}

/** Quantity that has left but not arrived. */
export function inTransit(line: TransferLine): number {
  return Math.max(0, line.sent - line.received);
}

export function transferInTransit(transfer: StockTransfer): number {
  return transfer.lines.reduce((total, line) => total + inTransit(line), 0);
}

/** Value of everything still on the road, which belongs to nobody's shelf. */
export function inTransitValue(transfer: StockTransfer, currency = 'GBP'): Money {
  return sum(
    transfer.lines.map((line) => multiply(line.unitCost, inTransit(line))),
    currency,
  );
}

export function transferValue(transfer: StockTransfer, currency = 'GBP'): Money {
  return sum(
    transfer.lines.map((line) => multiply(line.unitCost, line.sent)),
    currency,
  );
}

/* ---------------------------------------------------------------------------
   Dispatch
   --------------------------------------------------------------------------- */

export interface DispatchCheck {
  ok: boolean;
  problems: string[];
}

/**
 * Whether a transfer can leave.
 *
 * Available rather than on-hand: stock already promised to a job at this site
 * must not be driven to another one. That is the failure that produces a
 * technician standing at an empty rack holding a job card that says the part
 * is reserved for them.
 */
export function checkDispatch(
  transfer: StockTransfer,
  available: ReadonlyMap<string, number>,
): DispatchCheck {
  const problems: string[] = [];

  if (transfer.fromWarehouseId === transfer.toWarehouseId) {
    problems.push('The origin and destination are the same site.');
  }

  if (transfer.lines.length === 0 || transfer.lines.every((line) => line.sent <= 0)) {
    problems.push('Nothing to send.');
  }

  for (const line of transfer.lines) {
    if (line.sent <= 0) {
      problems.push(`${line.partNumber}: quantity must be more than zero.`);
      continue;
    }

    const free = available.get(line.productId) ?? 0;
    if (line.sent > free) {
      problems.push(
        `${line.partNumber}: ${line.sent} requested, ${free} available. The difference is either not on the shelf or already reserved for a job here.`,
      );
    }
  }

  return { ok: problems.length === 0, problems };
}

export function assertDispatchable(
  transfer: StockTransfer,
  available: ReadonlyMap<string, number>,
): void {
  if (transfer.fromWarehouseId === transfer.toWarehouseId) {
    throw new TransferError('SAME_SITE', 'A transfer must have two different sites.');
  }

  const check = checkDispatch(transfer, available);
  if (!check.ok) {
    throw new TransferError('NOTHING_TO_SEND', check.problems.join(' '));
  }
}

/* ---------------------------------------------------------------------------
   Receipt
   --------------------------------------------------------------------------- */

/**
 * Named for transfers specifically: the procurement module has its own
 * ReceiptLine for goods arriving from a supplier, and the two are different
 * shapes. One barrel exporting both under one name is a compile error, and
 * silently picking a winner would be worse.
 */
export interface TransferReceiptLine {
  productId: string;
  quantity: number;
}

export interface ReceiptOutcome {
  status: TransferStatus;
  lines: TransferLine[];
  /** Lines where less arrived than left, once the transfer is closed. */
  discrepancies: { partNumber: string; sent: number; received: number; short: number }[];
}

/**
 * Books in a delivery.
 *
 * Over-receipt is refused rather than absorbed. Booking in more than was sent
 * means either the paperwork or the van is wrong, and quietly accepting the
 * larger number destroys the only evidence that something went missing
 * somewhere else.
 */
export function applyTransferReceipt(
  transfer: StockTransfer,
  received: readonly TransferReceiptLine[],
  options: { closeShort?: boolean } = {},
): ReceiptOutcome {
  if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'PART_RECEIVED') {
    throw new TransferError(
      'NOT_DISPATCHED',
      `Transfer ${transfer.reference} is ${transfer.status.toLowerCase().replace('_', ' ')}, so nothing can be booked in against it.`,
    );
  }

  const byProduct = new Map(received.map((line) => [line.productId, line.quantity]));

  const lines = transfer.lines.map((line) => {
    const arriving = byProduct.get(line.productId) ?? 0;
    if (arriving < 0) {
      throw new TransferError('OVER_RECEIPT', `${line.partNumber}: cannot receive a negative.`);
    }

    const total = line.received + arriving;
    if (total > line.sent) {
      throw new TransferError(
        'OVER_RECEIPT',
        `${line.partNumber}: ${total} booked in against ${line.sent} sent. Count it again before accepting.`,
      );
    }

    return { ...line, received: total };
  });

  const outstanding = lines.reduce((total, line) => total + inTransit(line), 0);
  const complete = outstanding === 0;

  const discrepancies =
    complete || options.closeShort
      ? lines
          .filter((line) => line.received < line.sent)
          .map((line) => ({
            partNumber: line.partNumber,
            sent: line.sent,
            received: line.received,
            short: line.sent - line.received,
          }))
      : [];

  return {
    status: complete || options.closeShort ? 'RECEIVED' : 'PART_RECEIVED',
    lines,
    discrepancies,
  };
}

/**
 * Cancelling.
 *
 * A transfer already on the road cannot be cancelled, only received. The stock
 * is physically somewhere and pretending the movement never happened is how a
 * balance ends up wrong at both sites at once.
 */
export function assertCancellable(transfer: StockTransfer): void {
  if (transfer.status === 'IN_TRANSIT' || transfer.status === 'PART_RECEIVED') {
    throw new TransferError(
      'CANCEL_IN_TRANSIT',
      `Transfer ${transfer.reference} has already left. Book in what arrives, then raise a transfer back for anything being returned.`,
    );
  }

  if (!canTransitionTransfer(transfer.status, 'CANCELLED')) {
    throw new TransferError(
      'BAD_TRANSITION',
      `A ${transfer.status.toLowerCase()} transfer cannot be cancelled.`,
    );
  }
}

/* ---------------------------------------------------------------------------
   Suggesting a transfer
   --------------------------------------------------------------------------- */

export interface SiteStock {
  warehouseId: string;
  siteName: string;
  productId: string;
  partNumber: string;
  onHand: number;
  reserved: number;
  reorderPoint: number;
}

export interface TransferSuggestion {
  productId: string;
  partNumber: string;
  fromWarehouseId: string;
  fromSite: string;
  toWarehouseId: string;
  toSite: string;
  quantity: number;
  reason: string;
}

/**
 * Finds parts one site is short of that another is holding spare.
 *
 * Only surplus above the holder's own reorder point is offered: solving one
 * site's shortage by creating another's is not a saving, it is the same
 * purchase order with a delay and a van journey attached.
 */
export function suggestTransfers(stock: readonly SiteStock[]): TransferSuggestion[] {
  const byProduct = new Map<string, SiteStock[]>();
  for (const row of stock) {
    const existing = byProduct.get(row.productId) ?? [];
    existing.push(row);
    byProduct.set(row.productId, existing);
  }

  const suggestions: TransferSuggestion[] = [];

  for (const rows of byProduct.values()) {
    const short = rows
      .filter((row) => row.onHand - row.reserved < row.reorderPoint)
      .sort((a, b) => a.onHand - a.reserved - (b.onHand - b.reserved));

    const surplus = rows
      .map((row) => ({ row, spare: row.onHand - row.reserved - row.reorderPoint }))
      .filter((entry) => entry.spare > 0)
      .sort((a, b) => b.spare - a.spare);

    for (const need of short) {
      const gap = need.reorderPoint - (need.onHand - need.reserved);
      if (gap <= 0) continue;

      const source = surplus.find(
        (entry) => entry.row.warehouseId !== need.warehouseId && entry.spare > 0,
      );
      if (!source) continue;

      const quantity = Math.min(gap, source.spare);
      source.spare -= quantity;

      suggestions.push({
        productId: need.productId,
        partNumber: need.partNumber,
        fromWarehouseId: source.row.warehouseId,
        fromSite: source.row.siteName,
        toWarehouseId: need.warehouseId,
        toSite: need.siteName,
        quantity,
        reason: `${need.siteName} is ${gap} below its reorder point; ${source.row.siteName} holds ${source.spare + quantity} spare above its own.`,
      });
    }
  }

  return suggestions;
}

/** Group stock value, with the road counted as a place stock can be. */
export function groupStockValue(
  onShelf: readonly Money[],
  transfers: readonly StockTransfer[],
  currency = 'GBP',
): { onShelf: Money; inTransit: Money; total: Money } {
  const shelf = sum(onShelf, currency);
  const road = transfers
    .filter((transfer) => transfer.status === 'IN_TRANSIT' || transfer.status === 'PART_RECEIVED')
    .reduce((total, transfer) => add(total, inTransitValue(transfer, currency)), zero(currency));

  return { onShelf: shelf, inTransit: road, total: add(shelf, road) };
}

/** A blank transfer, so a form has something coherent to start from. */
export function emptyTransfer(
  reference: string,
  fromWarehouseId: string,
  toWarehouseId: string,
): StockTransfer {
  return {
    id: '',
    reference,
    fromWarehouseId,
    toWarehouseId,
    status: 'DRAFT',
    lines: [],
    dispatchedAt: null,
    receivedAt: null,
  };
}

/** Cost carried on a line, for the ledger entry that follows a dispatch. */
export function lineValue(line: TransferLine, currency = 'GBP'): Money {
  return line.sent > 0 ? multiply(line.unitCost, line.sent) : money(0, currency);
}
