import { describe, expect, it } from 'vitest';

import {
  binFor,
  countAgainst,
  countedSoFar,
  stillOwedOn,
  type ReceivingLine,
  scanAgainstOrder,
  whatIsLeft,
} from './receiving';

function line(over: Partial<ReceivingLine> & { orderLineId: string }): ReceivingLine {
  return {
    productId: `p-${over.orderLineId}`,
    partNumber: `PN-${over.orderLineId}`,
    barcode: `BAR-${over.orderLineId}`,
    description: `Part ${over.orderLineId}`,
    ordered: 10,
    alreadyReceived: 0,
    counted: 0,
    bin: 'A2',
    ...over,
  };
}

const order: ReceivingLine[] = [
  line({ orderLineId: 'a' }),
  line({ orderLineId: 'b', ordered: 4, alreadyReceived: 4 }),
];

describe('what is still owed', () => {
  it('is what was ordered less what has come', () => {
    expect(stillOwedOn(line({ orderLineId: 'a', alreadyReceived: 3 }))).toBe(7);
  });

  it('counts what has been scanned in this session too', () => {
    expect(stillOwedOn(line({ orderLineId: 'a', alreadyReceived: 3, counted: 2 }))).toBe(5);
  });

  it('is never negative, because an over-receipt is not a debt', () => {
    expect(stillOwedOn(line({ orderLineId: 'a', ordered: 2, alreadyReceived: 5 }))).toBe(0);
  });
});

describe('which line the box belongs to', () => {
  it('finds it by the part number printed on the box', () => {
    const found = scanAgainstOrder(order, 'PN-a');
    expect(found.found).toBe('line');
    if (found.found === 'line') expect(found.line.orderLineId).toBe('a');
  });

  it('finds it by the supplier’s own barcode', () => {
    expect(scanAgainstOrder(order, 'BAR-a').found).toBe('line');
  });

  it('forgives case and surrounding space, which scanners add', () => {
    expect(scanAgainstOrder(order, '  pn-A  ').found).toBe('line');
  });

  it('says how many are still owed, so the count can be checked against it', () => {
    const found = scanAgainstOrder(order, 'PN-a');
    if (found.found === 'line') expect(found.outstanding).toBe(10);
  });

  it('says a line already fully received is settled, rather than ignoring the scan', () => {
    // "You have had all four of those" is what somebody needs to hear before
    // they open the box.
    const found = scanAgainstOrder(order, 'PN-b');
    expect(found.found).toBe('settled');
  });

  it('says loudly when the box is not on this order at all', () => {
    // The supplier sent something nobody ordered, or this is the wrong order,
    // or the box belongs to another delivery. All three are worth stopping for.
    const found = scanAgainstOrder(order, '5012345678900');
    expect(found.found).toBe('not-on-this-order');
    if (found.found === 'not-on-this-order') expect(found.scanned).toBe('5012345678900');
  });

  it('says nothing was scanned when nothing was', () => {
    expect(scanAgainstOrder(order, '   ').found).toBe('not-on-this-order');
  });

  it('asks when one order has two open lines for the same part', () => {
    // A split delivery, two prices, two dates. Picking one would book the
    // goods against whichever was created first.
    const split = [
      line({ orderLineId: 'x', partNumber: 'SAME' }),
      line({ orderLineId: 'y', partNumber: 'SAME' }),
    ];
    const found = scanAgainstOrder(split, 'SAME');
    expect(found.found).toBe('several');
    if (found.found === 'several') expect(found.lines).toHaveLength(2);
  });

  it('does not ask when only one of the two is still open', () => {
    const split = [
      line({ orderLineId: 'x', partNumber: 'SAME', ordered: 5, alreadyReceived: 5 }),
      line({ orderLineId: 'y', partNumber: 'SAME' }),
    ];
    const found = scanAgainstOrder(split, 'SAME');
    expect(found.found).toBe('line');
    if (found.found === 'line') expect(found.line.orderLineId).toBe('y');
  });
});

describe('what a typed quantity means', () => {
  const ten = line({ orderLineId: 'a' });

  it('is exact when it settles the line', () => {
    expect(countAgainst(ten, 10)).toEqual({ verdict: 'EXACT', remaining: 0, excess: 0 });
  });

  it('is short when some are still to come', () => {
    expect(countAgainst(ten, 6)).toEqual({ verdict: 'SHORT', remaining: 4, excess: 0 });
  });

  it('is over when more arrived than were ordered, and says by how many', () => {
    // Reported rather than refused, because the refusal belongs at the submit
    // and the person at the pallet needs it now, while the driver is in the
    // yard and somebody can still do something about it.
    expect(countAgainst(ten, 12)).toEqual({ verdict: 'OVER', remaining: 0, excess: 2 });
  });

  it('refuses nought and nonsense as counts', () => {
    expect(countAgainst(ten, 0).verdict).toBe('NOT_A_COUNT');
    expect(countAgainst(ten, -3).verdict).toBe('NOT_A_COUNT');
    expect(countAgainst(ten, Number.NaN).verdict).toBe('NOT_A_COUNT');
  });

  it('measures against what is left, not against what was ordered', () => {
    const half = line({ orderLineId: 'a', alreadyReceived: 7 });
    expect(countAgainst(half, 3)).toEqual({ verdict: 'EXACT', remaining: 0, excess: 0 });
    expect(countAgainst(half, 4).verdict).toBe('OVER');
  });
});

describe('where it goes', () => {
  it('goes to its existing home unless somebody says otherwise', () => {
    // A delivery that made somebody retype the bin every time is a delivery
    // where the same part ends up on two shelves.
    expect(binFor(line({ orderLineId: 'a' }))).toBe('A2');
  });

  it('goes where somebody says when they say', () => {
    expect(binFor(line({ orderLineId: 'a' }), 'C7')).toBe('C7');
  });

  it('keeps its home when the box is left empty', () => {
    expect(binFor(line({ orderLineId: 'a' }), '   ')).toBe('A2');
  });

  it('is nothing when it has no home and nobody said', () => {
    expect(binFor(line({ orderLineId: 'a', bin: null }))).toBeNull();
  });
});

describe('what the pallet still owes', () => {
  it('counts the lines and the items still to come', () => {
    const left = whatIsLeft(order);
    expect(left.outstandingLines).toBe(1);
    expect(left.outstandingItems).toBe(10);
    expect(left.done).toBe(false);
  });

  it('puts the line with most outstanding first', () => {
    const many = [
      line({ orderLineId: 'few', ordered: 2 }),
      line({ orderLineId: 'many', ordered: 8 }),
    ];
    expect(whatIsLeft(many).lines.map((one) => one.orderLineId)).toEqual(['many', 'few']);
  });

  it('is done when nothing is outstanding', () => {
    const settled = [line({ orderLineId: 'a', ordered: 3, alreadyReceived: 3 })];
    expect(whatIsLeft(settled).done).toBe(true);
    expect(whatIsLeft(settled).lines).toEqual([]);
  });

  it('is done once this session has counted the rest', () => {
    const counting = [line({ orderLineId: 'a', ordered: 3, counted: 3 })];
    expect(whatIsLeft(counting).done).toBe(true);
  });
});

describe('what goes to the submit', () => {
  it('carries only what was counted', () => {
    const session = [
      line({ orderLineId: 'a', counted: 4 }),
      line({ orderLineId: 'b', counted: 0 }),
    ];
    expect(countedSoFar(session)).toEqual([{ orderLineId: 'a', quantity: 4 }]);
  });

  it('is empty when nothing has been scanned', () => {
    expect(countedSoFar(order)).toEqual([]);
  });
});
