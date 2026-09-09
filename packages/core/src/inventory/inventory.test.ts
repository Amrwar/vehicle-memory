import { describe, expect, it } from 'vitest';

import { fromDecimal, toDecimalString } from '../shared/money';
import {
  applyIssue,
  applyReceipt,
  applyStocktake,
  availableQuantity,
  consumeReservation,
  release,
  reserve,
  StockError,
  stockValue,
  summariseStock,
  stockTone,
} from './stock';
import { averageDailyUsage, suggestReorder } from './reorder';
import {
  approvalRequired,
  assertOrderTransition,
  canTransitionRequest,
  matchBill,
  type OrderLine,
  orderTotals,
  ProcurementError,
  validateReceipt,
} from './procurement';

/* ===========================================================================
   Stock
   =========================================================================== */

describe('available quantity', () => {
  it('is on hand less reserved, not on hand', () => {
    // The bug this prevents: promising the same set of pads to two jobs.
    expect(availableQuantity({ onHand: 10, reserved: 4, avgCost: '0' })).toBe(6);
  });

  it('can be zero while stock is physically present', () => {
    expect(availableQuantity({ onHand: 4, reserved: 4, avgCost: '0' })).toBe(0);
  });
});

describe('weighted average cost', () => {
  it('averages a receipt against existing stock', () => {
    // 10 at 20.00 plus 10 at 30.00 is 20 at 25.00
    const result = applyReceipt({ onHand: 10, reserved: 0, avgCost: '20.00' }, 10, '30.00');
    expect(result.onHand).toBe(20);
    expect(toDecimalString(result.avgCost)).toBe('25.00');
  });

  it('weights by quantity, not by number of receipts', () => {
    // 90 at 10.00 plus 10 at 20.00 is 100 at 11.00, not 15.00
    const result = applyReceipt({ onHand: 90, reserved: 0, avgCost: '10.00' }, 10, '20.00');
    expect(toDecimalString(result.avgCost)).toBe('11.00');
  });

  it('takes the receipt cost when there was no stock', () => {
    const result = applyReceipt({ onHand: 0, reserved: 0, avgCost: '0' }, 5, '42.50');
    expect(toDecimalString(result.avgCost)).toBe('42.50');
  });

  it('takes the receipt cost when the balance was negative', () => {
    // Averaging against a negative quantity produces nonsense.
    const result = applyReceipt({ onHand: -3, reserved: 0, avgCost: '20.00' }, 10, '30.00');
    expect(result.onHand).toBe(7);
    expect(toDecimalString(result.avgCost)).toBe('30.00');
  });

  it('records the value added to stock', () => {
    const result = applyReceipt({ onHand: 0, reserved: 0, avgCost: '0' }, 4, '12.50');
    expect(toDecimalString(result.valueAdded)).toBe('50.00');
  });

  it('refuses a zero or negative receipt', () => {
    expect(() => applyReceipt({ onHand: 0, reserved: 0, avgCost: '0' }, 0, '1')).toThrow(
      StockError,
    );
    expect(() => applyReceipt({ onHand: 0, reserved: 0, avgCost: '0' }, -1, '1')).toThrow(
      StockError,
    );
  });

  it('handles fractional quantities, because fluids are not integers', () => {
    const result = applyReceipt({ onHand: 0, reserved: 0, avgCost: '0' }, 4.2, '6.00');
    expect(result.onHand).toBe(4.2);
    expect(toDecimalString(result.valueAdded)).toBe('25.20');
  });
});

describe('issuing stock', () => {
  it('costs the issue at weighted average', () => {
    const result = applyIssue({ onHand: 20, reserved: 0, avgCost: '25.00' }, 2);
    expect(result.onHand).toBe(18);
    expect(toDecimalString(result.cost)).toBe('50.00');
  });

  // Deliberate: the part is in the car. Refusing to record it would leave the
  // job costed at zero while the stock figure stayed comfortingly wrong.
  it('allows the balance to go negative rather than losing the cost', () => {
    const result = applyIssue({ onHand: 1, reserved: 0, avgCost: '25.00' }, 3);
    expect(result.onHand).toBe(-2);
    expect(toDecimalString(result.cost)).toBe('75.00');
  });
});

describe('stock value', () => {
  it('multiplies quantity by weighted average cost', () => {
    expect(toDecimalString(stockValue({ onHand: 12, reserved: 3, avgCost: '25.50' }))).toBe(
      '306.00',
    );
  });

  it('values reserved stock too, since it is still on the shelf', () => {
    const all = stockValue({ onHand: 10, reserved: 10, avgCost: '5.00' });
    expect(toDecimalString(all)).toBe('50.00');
  });
});

describe('stocktake', () => {
  it('reports a shortage with its value', () => {
    const result = applyStocktake({ onHand: 20, reserved: 0, avgCost: '25.00' }, 18);
    expect(result.variance).toBe(-2);
    expect(result.direction).toBe('shortage');
    expect(toDecimalString(result.varianceValue)).toBe('-50.00');
  });

  it('reports a surplus', () => {
    const result = applyStocktake({ onHand: 20, reserved: 0, avgCost: '25.00' }, 23);
    expect(result.direction).toBe('surplus');
    expect(result.variance).toBe(3);
  });

  it('reports an exact count', () => {
    expect(applyStocktake({ onHand: 20, reserved: 0, avgCost: '25.00' }, 20).direction).toBe(
      'exact',
    );
  });

  it('refuses a negative count', () => {
    expect(() => applyStocktake({ onHand: 5, reserved: 0, avgCost: '1' }, -1)).toThrow(StockError);
  });
});

describe('reservation', () => {
  it('reserves in full when stock allows', () => {
    const result = reserve({ onHand: 10, reserved: 2, avgCost: '0' }, 4);
    expect(result).toMatchObject({ reserved: 4, shortfall: 0, status: 'RESERVED' });
    expect(result.reservedTotal).toBe(6);
  });

  // Partial reservation is what a workshop actually does: take the three, order
  // the fourth. Refusing outright makes them record nothing.
  it('reserves what it can and reports the shortfall', () => {
    const result = reserve({ onHand: 3, reserved: 0, avgCost: '0' }, 4);
    expect(result).toMatchObject({ reserved: 3, shortfall: 1, status: 'PARTIAL' });
  });

  it('reports unavailable when everything is already committed', () => {
    const result = reserve({ onHand: 4, reserved: 4, avgCost: '0' }, 2);
    expect(result).toMatchObject({ reserved: 0, shortfall: 2, status: 'UNAVAILABLE' });
  });

  it('never reserves against stock already promised elsewhere', () => {
    const result = reserve({ onHand: 10, reserved: 9, avgCost: '0' }, 5);
    expect(result.reserved).toBe(1);
  });

  it('refuses a non-positive reservation', () => {
    expect(() => reserve({ onHand: 10, reserved: 0, avgCost: '0' }, 0)).toThrow(StockError);
  });
});

describe('releasing a reservation', () => {
  it('reduces the reserved figure', () => {
    expect(release({ onHand: 10, reserved: 4, avgCost: '0' }, 3)).toBe(1);
  });

  it('refuses to release more than is reserved', () => {
    expect(() => release({ onHand: 10, reserved: 2, avgCost: '0' }, 3)).toThrow(
      /only 2 is reserved/,
    );
  });
});

describe('consuming a reservation', () => {
  // Doing these as two steps is how a part ends up counted as both reserved
  // and issued.
  it('removes the stock and the reservation together', () => {
    const result = consumeReservation({ onHand: 10, reserved: 4, avgCost: '25.00' }, 4);
    expect(result.onHand).toBe(6);
    expect(result.reserved).toBe(0);
    expect(toDecimalString(result.cost)).toBe('100.00');
  });

  it('floors the reserved figure at zero when a part was fitted unreserved', () => {
    const result = consumeReservation({ onHand: 10, reserved: 0, avgCost: '25.00' }, 2);
    expect(result.reserved).toBe(0);
    expect(result.onHand).toBe(8);
  });
});

describe('stock summary', () => {
  it('flags stock below the reorder point', () => {
    const summary = summariseStock({ onHand: 3, reserved: 0, avgCost: '0' }, 10);
    expect(summary.state).toBe('SHORT');
    expect(summary.needsOrdering).toBe(true);
  });

  it('does not flag for ordering when a purchase order is outstanding', () => {
    const summary = summariseStock({ onHand: 3, reserved: 0, avgCost: '0' }, 10, 20);
    expect(summary.state).toBe('SHORT');
    expect(summary.needsOrdering).toBe(false);
  });

  it('reports none available when everything is reserved', () => {
    expect(summariseStock({ onHand: 5, reserved: 5, avgCost: '0' }, 2).state).toBe('OUT');
  });

  it('reports an over-issued balance distinctly from an empty one', () => {
    expect(summariseStock({ onHand: -2, reserved: 0, avgCost: '0' }, 5).state).toBe('OVER');
    expect(stockTone('OVER')).toBe('danger');
  });

  it('reports healthy stock', () => {
    const summary = summariseStock({ onHand: 40, reserved: 5, avgCost: '0' }, 10);
    expect(summary.state).toBe('OK');
    expect(summary.needsOrdering).toBe(false);
  });
});

/* ===========================================================================
   Reordering
   =========================================================================== */

const daysAgo = (n: number): Date => new Date(Date.now() - n * 86_400_000);

describe('average daily usage', () => {
  it('averages over the observed window, not an assumed period', () => {
    const usage = [
      { quantity: 2, at: daysAgo(30) },
      { quantity: 2, at: daysAgo(20) },
      { quantity: 2, at: daysAgo(10) },
    ];
    // 6 units across 30 days
    expect(averageDailyUsage(usage)).toBeCloseTo(0.2, 2);
  });

  it('is zero with no usage', () => {
    expect(averageDailyUsage([])).toBe(0);
  });
});

describe('reorder suggestion', () => {
  const usage = Array.from({ length: 12 }, (_, i) => ({ quantity: 2, at: daysAgo(90 - i * 7) }));

  it('suggests nothing when the position is above the reorder point', () => {
    const result = suggestReorder({ available: 200, onOrder: 0, usage, leadTimeDays: 5 });
    expect(result.quantity).toBe(0);
    expect(result.reason).toContain('above the reorder point');
  });

  it('suggests a quantity when stock is low', () => {
    const result = suggestReorder({ available: 1, onOrder: 0, usage, leadTimeDays: 5 });
    expect(result.quantity).toBeGreaterThan(0);
  });

  it('counts stock already on order, so it does not order twice', () => {
    const low = suggestReorder({ available: 1, onOrder: 0, usage, leadTimeDays: 5 });
    const covered = suggestReorder({ available: 1, onOrder: 500, usage, leadTimeDays: 5 });
    expect(covered.quantity).toBe(0);
    expect(low.quantity).toBeGreaterThan(0);
  });

  it('flags urgency when stock runs out before a delivery could arrive', () => {
    const heavy = Array.from({ length: 30 }, (_, i) => ({ quantity: 5, at: daysAgo(30 - i) }));
    const result = suggestReorder({ available: 2, onOrder: 0, usage: heavy, leadTimeDays: 7 });
    expect(result.urgent).toBe(true);
    expect(result.reason).toContain('Order now');
  });

  it('rounds up to a whole pack', () => {
    const result = suggestReorder({
      available: 0,
      onOrder: 0,
      usage,
      leadTimeDays: 5,
      packSize: 6,
    });
    expect(result.quantity % 6).toBe(0);
  });

  it('respects a supplier minimum order quantity', () => {
    const result = suggestReorder({
      available: 0,
      onOrder: 0,
      usage: [{ quantity: 1, at: daysAgo(180) }],
      leadTimeDays: 3,
      minimumOrderQuantity: 25,
    });
    expect(result.quantity).toBeGreaterThanOrEqual(25);
  });

  // Reported rather than hidden: a figure from two data points should not be
  // presented with the same authority as one from forty.
  it('reports low confidence on thin history', () => {
    const result = suggestReorder({
      available: 0,
      onOrder: 0,
      usage: [{ quantity: 1, at: daysAgo(3) }],
      leadTimeDays: 3,
    });
    expect(result.confidence).toBe('low');
  });

  it('reports high confidence on a long history', () => {
    const long = Array.from({ length: 40 }, (_, i) => ({ quantity: 1, at: daysAgo(300 - i * 7) }));
    expect(
      suggestReorder({ available: 5, onOrder: 0, usage: long, leadTimeDays: 3 }).confidence,
    ).toBe('high');
  });

  it('declines to guess for a part that has never moved', () => {
    const result = suggestReorder({ available: 4, onOrder: 0, usage: [], leadTimeDays: 5 });
    expect(result.quantity).toBe(0);
    expect(result.confidence).toBe('none');
    expect(result.reason).toContain('not moved');
  });

  it('says so when a part has no stock and no usage', () => {
    const result = suggestReorder({ available: 0, onOrder: 0, usage: [], leadTimeDays: 5 });
    expect(result.reason).toContain('Order manually');
  });
});

/* ===========================================================================
   Procurement
   =========================================================================== */

describe('purchase request lifecycle', () => {
  it('allows approval and rejection from pending', () => {
    expect(canTransitionRequest('PENDING', 'APPROVED')).toBe(true);
    expect(canTransitionRequest('PENDING', 'REJECTED')).toBe(true);
  });

  it('refuses ordering something that was never approved', () => {
    expect(canTransitionRequest('PENDING', 'ORDERED')).toBe(false);
  });

  it('treats rejected and ordered as terminal', () => {
    expect(canTransitionRequest('REJECTED', 'APPROVED')).toBe(false);
    expect(canTransitionRequest('ORDERED', 'REJECTED')).toBe(false);
  });
});

describe('approval threshold', () => {
  it('requires approval above the threshold', () => {
    expect(approvalRequired(fromDecimal('850.00'), 250).required).toBe(true);
  });

  // A rubber stamp on a fifteen-pound filter is worse than no control: it
  // creates the appearance of oversight without the substance.
  it('does not require approval for a routine consumable', () => {
    expect(approvalRequired(fromDecimal('14.99'), 250).required).toBe(false);
  });

  it('treats exactly the threshold as within the limit', () => {
    expect(approvalRequired(fromDecimal('250.00'), 250).required).toBe(false);
  });
});

describe('purchase order lifecycle', () => {
  it('walks draft to billed', () => {
    expect(() => assertOrderTransition('DRAFT', 'SENT')).not.toThrow();
    expect(() => assertOrderTransition('SENT', 'PART_RECEIVED')).not.toThrow();
    expect(() => assertOrderTransition('PART_RECEIVED', 'RECEIVED')).not.toThrow();
    expect(() => assertOrderTransition('RECEIVED', 'BILLED')).not.toThrow();
  });

  it('allows repeated partial receipts', () => {
    expect(() => assertOrderTransition('PART_RECEIVED', 'PART_RECEIVED')).not.toThrow();
  });

  it('refuses to bill an order that has not been received', () => {
    expect(() => assertOrderTransition('SENT', 'BILLED')).toThrow(ProcurementError);
  });

  it('refuses to cancel a received order', () => {
    // Goods are on the shelf; the correction is a return, not a cancellation.
    expect(() => assertOrderTransition('RECEIVED', 'CANCELLED')).toThrow(/Permitted: BILLED/);
  });
});

const ORDER: OrderLine[] = [
  { id: 'l1', description: 'Front brake pads', quantity: 4, received: 0, unitCost: '63.00' },
  { id: 'l2', description: 'Front brake discs', quantity: 4, received: 0, unitCost: '61.50' },
];

describe('order totals', () => {
  it('sums the ordered value', () => {
    expect(toDecimalString(orderTotals(ORDER).subtotal)).toBe('498.00');
  });

  it('reports outstanding value as goods arrive', () => {
    const partly = [{ ...ORDER[0]!, received: 4 }, ORDER[1]!];
    const totals = orderTotals(partly);
    expect(toDecimalString(totals.outstandingValue)).toBe('246.00');
    expect(totals.partiallyReceived).toBe(true);
    expect(totals.fullyReceived).toBe(false);
  });

  it('reports fully received when everything has arrived', () => {
    const all = ORDER.map((line) => ({ ...line, received: line.quantity }));
    expect(orderTotals(all).fullyReceived).toBe(true);
    expect(toDecimalString(orderTotals(all).outstandingValue)).toBe('0.00');
  });
});

describe('goods receipt validation', () => {
  it('accepts a full delivery and marks the order received', () => {
    const result = validateReceipt(ORDER, [
      { orderLineId: 'l1', quantity: 4 },
      { orderLineId: 'l2', quantity: 4 },
    ]);
    expect(result.ok).toBe(true);
    expect(result.resultingStatus).toBe('RECEIVED');
  });

  it('accepts a partial delivery and keeps the order open', () => {
    const result = validateReceipt(ORDER, [{ orderLineId: 'l1', quantity: 2 }]);
    expect(result.ok).toBe(true);
    expect(result.resultingStatus).toBe('PART_RECEIVED');
  });

  // A supplier sending ten when eight were ordered is a conversation, not a
  // stock figure to quietly inflate.
  it('refuses an over-receipt and says by how much', () => {
    const result = validateReceipt(ORDER, [{ orderLineId: 'l1', quantity: 6 }]);
    expect(result.ok).toBe(false);
    expect(result.problems[0]!.code).toBe('OVER_RECEIPT');
    expect(result.problems[0]!.message).toContain('only 4 outstanding');
  });

  it('refuses a line that is not on the order', () => {
    const result = validateReceipt(ORDER, [{ orderLineId: 'nope', quantity: 1 }]);
    expect(result.problems[0]!.code).toBe('UNKNOWN_LINE');
  });

  it('refuses a zero quantity', () => {
    expect(validateReceipt(ORDER, [{ orderLineId: 'l1', quantity: 0 }]).problems[0]!.code).toBe(
      'NON_POSITIVE',
    );
  });

  it('accounts for what was already received', () => {
    const partly = [{ ...ORDER[0]!, received: 3 }, ORDER[1]!];
    expect(validateReceipt(partly, [{ orderLineId: 'l1', quantity: 2 }]).ok).toBe(false);
    expect(validateReceipt(partly, [{ orderLineId: 'l1', quantity: 1 }]).ok).toBe(true);
  });
});

describe('three-way match', () => {
  const received = ORDER.map((line) => ({ ...line, received: line.quantity }));

  it('matches a correct bill', () => {
    const result = matchBill({ orderLines: received, billedTotal: fromDecimal('498.00') });
    expect(result.status).toBe('MATCHED');
  });

  it('tolerates pennies of carriage and rounding', () => {
    const result = matchBill({ orderLines: received, billedTotal: fromDecimal('502.00') });
    expect(result.status).toBe('MATCHED');
  });

  it('flags a price increase the supplier did not mention', () => {
    const result = matchBill({ orderLines: received, billedTotal: fromDecimal('620.00') });
    expect(result.status).toBe('PRICE_VARIANCE');
    expect(result.message).toContain('Query it');
  });

  // The control that stops a workshop paying for goods that never arrived.
  it('flags being billed for goods that did not arrive', () => {
    const halfDelivered = [
      { ...ORDER[0]!, received: 4 },
      { ...ORDER[1]!, received: 0 },
    ];
    const result = matchBill({ orderLines: halfDelivered, billedTotal: fromDecimal('498.00') });
    expect(result.status).toBe('QUANTITY_VARIANCE');
    expect(result.message).toContain('Check the delivery before paying');
  });

  it('reports the variance and its percentage', () => {
    const result = matchBill({ orderLines: received, billedTotal: fromDecimal('548.00') });
    expect(toDecimalString(result.variance)).toBe('50.00');
    expect(result.variancePct).toBeCloseTo(10.04, 1);
  });
});
