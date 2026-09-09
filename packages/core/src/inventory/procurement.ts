import {
  add,
  type Currency,
  fromDecimal,
  type Money,
  multiply,
  subtract,
  sum,
  zero,
} from '../shared/money';

/**
 * Procurement: request, approve, order, receive, bill.
 *
 * The rule that gives this its shape is separation of duty. A technician who
 * needs a part requests it; somebody else approves the spend. That is why
 * `purchase:request` and `purchase:approve` are separate permissions, and why
 * a request is a distinct object rather than a draft order.
 *
 * FR-1101 to FR-1108.
 */

/* ---------------------------------------------------------------------------
   Purchase request
   --------------------------------------------------------------------------- */

export type PurchaseRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ORDERED';

const REQUEST_TRANSITIONS: Readonly<
  Record<PurchaseRequestStatus, readonly PurchaseRequestStatus[]>
> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['ORDERED', 'REJECTED'],
  REJECTED: [],
  ORDERED: [],
};

export function canTransitionRequest(
  from: PurchaseRequestStatus,
  to: PurchaseRequestStatus,
): boolean {
  return REQUEST_TRANSITIONS[from].includes(to);
}

export interface ApprovalRequirement {
  required: boolean;
  reason: string;
}

/**
 * Whether a request needs a manager's approval before it can be ordered.
 *
 * Below the threshold a service advisor may order directly, because requiring
 * sign-off on a fifteen-pound oil filter produces a rubber stamp rather than a
 * control, and a rubber stamp is worse than no control at all: it creates the
 * appearance of oversight without the substance.
 */
export function approvalRequired(
  total: Money,
  thresholdMajorUnits: number | string,
  currency: Currency = 'GBP',
): ApprovalRequirement {
  const threshold = fromDecimal(thresholdMajorUnits, currency);

  if (total.minor > threshold.minor) {
    return {
      required: true,
      reason: `Above the ${threshold.minor / 100} approval threshold for this organisation.`,
    };
  }

  return { required: false, reason: 'Within the amount an advisor may order directly.' };
}

/* ---------------------------------------------------------------------------
   Purchase order
   --------------------------------------------------------------------------- */

export type PurchaseOrderStatus =
  'DRAFT' | 'SENT' | 'PART_RECEIVED' | 'RECEIVED' | 'BILLED' | 'CANCELLED';

const ORDER_TRANSITIONS: Readonly<Record<PurchaseOrderStatus, readonly PurchaseOrderStatus[]>> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['PART_RECEIVED', 'RECEIVED', 'CANCELLED'],
  PART_RECEIVED: ['PART_RECEIVED', 'RECEIVED', 'CANCELLED'],
  // A fully received order can still be cancelled only by returning goods,
  // which is a separate movement, so cancellation is not offered here.
  RECEIVED: ['BILLED'],
  BILLED: [],
  CANCELLED: [],
};

export class ProcurementError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'ProcurementError';
    this.code = code;
  }
}

export function assertOrderTransition(from: PurchaseOrderStatus, to: PurchaseOrderStatus): void {
  if (!ORDER_TRANSITIONS[from].includes(to)) {
    throw new ProcurementError(
      'ILLEGAL_TRANSITION',
      `A purchase order cannot move from ${from} to ${to}. Permitted: ${
        ORDER_TRANSITIONS[from].join(', ') || 'none'
      }.`,
    );
  }
}

export interface OrderLine {
  id: string;
  description: string;
  quantity: number;
  received: number;
  unitCost: string | number;
}

export interface OrderTotals {
  subtotal: Money;
  outstandingValue: Money;
  lineCount: number;
  fullyReceived: boolean;
  partiallyReceived: boolean;
}

export function orderTotals(lines: readonly OrderLine[], currency: Currency = 'GBP'): OrderTotals {
  const subtotal = sum(
    lines.map((line) => multiply(fromDecimal(line.unitCost, currency), line.quantity)),
    currency,
  );

  const outstandingValue = sum(
    lines.map((line) =>
      multiply(fromDecimal(line.unitCost, currency), Math.max(0, line.quantity - line.received)),
    ),
    currency,
  );

  const received = lines.filter((line) => line.received > 0).length;

  return {
    subtotal,
    outstandingValue,
    lineCount: lines.length,
    fullyReceived: lines.length > 0 && lines.every((line) => line.received >= line.quantity),
    partiallyReceived: received > 0 && !lines.every((line) => line.received >= line.quantity),
  };
}

/* ---------------------------------------------------------------------------
   Goods receipt
   --------------------------------------------------------------------------- */

export interface ReceiptLine {
  orderLineId: string;
  quantity: number;
  /** Actual cost on the delivery note, which is often not the ordered cost. */
  unitCost?: string | number;
}

export interface ReceiptValidation {
  ok: boolean;
  problems: ReceiptProblem[];
  /** Status the order should move to once this receipt is applied. */
  resultingStatus: PurchaseOrderStatus;
}

export interface ReceiptProblem {
  orderLineId: string;
  code: 'UNKNOWN_LINE' | 'OVER_RECEIPT' | 'NON_POSITIVE';
  message: string;
}

/**
 * Validates a delivery against the order.
 *
 * Over-receipt is refused rather than silently absorbed. A supplier sending
 * ten when eight were ordered is a conversation to have, not a stock figure to
 * quietly inflate, and the workshop will be billed for ten.
 */
export function validateReceipt(
  orderLines: readonly OrderLine[],
  receipt: readonly ReceiptLine[],
): ReceiptValidation {
  const byId = new Map(orderLines.map((line) => [line.id, line]));
  const problems: ReceiptProblem[] = [];

  for (const line of receipt) {
    const orderLine = byId.get(line.orderLineId);

    if (!orderLine) {
      problems.push({
        orderLineId: line.orderLineId,
        code: 'UNKNOWN_LINE',
        message: 'This line is not on the purchase order.',
      });
      continue;
    }

    if (line.quantity <= 0) {
      problems.push({
        orderLineId: line.orderLineId,
        code: 'NON_POSITIVE',
        message: 'A received quantity must be greater than zero.',
      });
      continue;
    }

    const outstanding = orderLine.quantity - orderLine.received;
    if (line.quantity > outstanding) {
      problems.push({
        orderLineId: line.orderLineId,
        code: 'OVER_RECEIPT',
        message: `${line.quantity} received but only ${outstanding} outstanding on "${orderLine.description}".`,
      });
    }
  }

  // Project the order state assuming a valid receipt is applied.
  const projected = orderLines.map((line) => {
    const delivered = receipt
      .filter((r) => r.orderLineId === line.id)
      .reduce((total, r) => total + r.quantity, 0);
    return { ...line, received: line.received + delivered };
  });

  const totals = orderTotals(projected);

  return {
    ok: problems.length === 0,
    problems,
    resultingStatus: totals.fullyReceived ? 'RECEIVED' : 'PART_RECEIVED',
  };
}

/* ---------------------------------------------------------------------------
   Three-way match
   --------------------------------------------------------------------------- */

export type MatchStatus = 'MATCHED' | 'PRICE_VARIANCE' | 'QUANTITY_VARIANCE' | 'UNMATCHED';

export interface BillMatch {
  status: MatchStatus;
  orderedValue: Money;
  receivedValue: Money;
  billedValue: Money;
  variance: Money;
  variancePct: number | null;
  message: string;
}

/**
 * Matches a supplier bill against what was ordered and what actually arrived.
 *
 * This is the control that stops a workshop paying for goods it never
 * received, which is the single most common way small businesses lose money to
 * suppliers, usually without ever noticing.
 *
 * Tolerance exists because carriage and rounding produce pennies of difference
 * on almost every bill, and flagging those would train people to ignore the
 * flag.
 */
export function matchBill(input: {
  orderLines: readonly OrderLine[];
  billedTotal: Money;
  tolerancePct?: number;
  currency?: Currency;
}): BillMatch {
  const currency = input.currency ?? input.billedTotal.currency;
  const tolerance = input.tolerancePct ?? 2;

  const orderedValue = sum(
    input.orderLines.map((line) => multiply(fromDecimal(line.unitCost, currency), line.quantity)),
    currency,
  );

  const receivedValue = sum(
    input.orderLines.map((line) =>
      multiply(fromDecimal(line.unitCost, currency), Math.min(line.received, line.quantity)),
    ),
    currency,
  );

  const variance = subtract(input.billedTotal, receivedValue);
  const variancePct =
    receivedValue.minor === 0 ? null : round2((variance.minor / receivedValue.minor) * 100);

  const withinTolerance =
    variancePct === null ? input.billedTotal.minor === 0 : Math.abs(variancePct) <= tolerance;

  if (withinTolerance) {
    return {
      status: 'MATCHED',
      orderedValue,
      receivedValue,
      billedValue: input.billedTotal,
      variance,
      variancePct,
      message: 'The bill matches what was received.',
    };
  }

  // Distinguish "billed for goods that did not arrive" from "billed at a
  // different price", because the conversation with the supplier differs.
  const quantityShortfall = receivedValue.minor < orderedValue.minor;
  const billedAboveOrdered = input.billedTotal.minor > orderedValue.minor;

  if (quantityShortfall && !billedAboveOrdered) {
    return {
      status: 'QUANTITY_VARIANCE',
      orderedValue,
      receivedValue,
      billedValue: input.billedTotal,
      variance,
      variancePct,
      message:
        'The bill is higher than the value of goods actually received. Check the delivery before paying.',
    };
  }

  return {
    status: billedAboveOrdered ? 'PRICE_VARIANCE' : 'UNMATCHED',
    orderedValue,
    receivedValue,
    billedValue: input.billedTotal,
    variance,
    variancePct,
    message: billedAboveOrdered
      ? 'The billed price is above the ordered price. Query it with the supplier.'
      : 'The bill does not reconcile against the order or the receipt.',
  };
}

export function matchTone(status: MatchStatus): 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'MATCHED':
      return 'success';
    case 'PRICE_VARIANCE':
      return 'warning';
    case 'QUANTITY_VARIANCE':
    case 'UNMATCHED':
      return 'danger';
  }
}

/** Builds an order value from lines, used when drafting. */
export function draftOrderValue(
  lines: readonly { quantity: number; unitCost: string | number }[],
  currency: Currency = 'GBP',
): Money {
  return lines.reduce(
    (total, line) => add(total, multiply(fromDecimal(line.unitCost, currency), line.quantity)),
    zero(currency),
  );
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
