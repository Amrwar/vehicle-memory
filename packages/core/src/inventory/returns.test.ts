import { describe, expect, it } from 'vitest';

import {
  postReturnCredited,
  postReturnRefused,
  postReturnSent,
  postSubletBilled,
} from '../accounting/posting';
import { ACCOUNT } from '../accounting/accounts';
import { money } from '../shared/money';
import {
  applyCredit,
  assertReturnCreditable,
  assertReturnable,
  assertSubletBillable,
  assertSubletSound,
  heldValue,
  reasonLabel,
  ReturnError,
  subletMargin,
} from './returns';

function code(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof ReturnError ? error.code : String(error);
  }
}

const at = new Date(Date.UTC(2026, 8, 15));

describe('what may go back', () => {
  const pads = { description: 'Brake pads', received: 4, alreadyReturned: 1, onHand: 2 };

  it('is what was received, less what already went back, and still on the shelf', () => {
    expect(code(() => assertReturnable({ ...pads, reason: 'DEFECTIVE', quantity: 2 }))).toBeNull();
    expect(code(() => assertReturnable({ ...pads, reason: 'DEFECTIVE', quantity: 0 }))).toBe(
      'NOTHING',
    );
    expect(code(() => assertReturnable({ ...pads, reason: 'DEFECTIVE', quantity: 4 }))).toBe(
      'TOO_MANY',
    );
    expect(code(() => assertReturnable({ ...pads, reason: 'SURPLUS', quantity: 3 }))).toBe(
      'NOT_ON_SHELF',
    );
    expect(
      code(() => assertReturnable({ ...pads, onHand: 1, reason: 'WRONG_PART', quantity: 2 })),
    ).toBe('NOT_ON_SHELF');
  });

  it('does not ask a core to be on the shelf', () => {
    expect(
      code(() => assertReturnable({ ...pads, onHand: 0, reason: 'CORE', quantity: 3 })),
    ).toBeNull();
    expect(
      heldValue([
        { reason: 'DEFECTIVE', quantity: 2, unitCost: 12.5 },
        { reason: 'CORE', quantity: 1, unitCost: 80 },
      ]),
    ).toBe(25);
    expect(reasonLabel('CORE')).toBe('Old unit (core)');
  });
});

describe('a credit note', () => {
  it('needs an open return, a reference and an amount', () => {
    const ok = { status: 'SENT', reference: 'CN-1', net: 25, tax: 5 };
    expect(code(() => assertReturnCreditable(ok))).toBeNull();
    expect(code(() => assertReturnCreditable({ ...ok, status: 'CREDITED' }))).toBe('NOT_OPEN');
    expect(code(() => assertReturnCreditable({ ...ok, reference: ' ' }))).toBe('NO_REFERENCE');
    expect(code(() => assertReturnCreditable({ ...ok, net: 0 }))).toBe('BAD_AMOUNT');
  });

  it('comes off the oldest bills first, and the rest is held', () => {
    expect(
      applyCredit(
        [
          { id: 'old', outstandingMinor: 1000 },
          { id: 'paid', outstandingMinor: 0 },
          { id: 'new', outstandingMinor: 5000 },
        ],
        3000,
      ),
    ).toEqual({
      applications: [
        { billId: 'old', minor: 1000 },
        { billId: 'new', minor: 2000 },
      ],
      unappliedMinor: 0,
    });
    expect(applyCredit([{ id: 'a', outstandingMinor: 500 }], 1200)).toEqual({
      applications: [{ billId: 'a', minor: 500 }],
      unappliedMinor: 700,
    });
  });
});

describe('the postings', () => {
  it('take a returned part off the shelf into a credit due', () => {
    const entry = postReturnSent({ returnId: 'r', number: 'RET-1', held: money(2500), at });
    expect(entry.lines.map((l) => [l.accountCode, l.debit.minor, l.credit.minor])).toEqual([
      [ACCOUNT.SUPPLIER_CREDITS, 2500, 0],
      [ACCOUNT.STOCK, 0, 2500],
    ]);
  });

  it('clear the credit due against what is owed, the difference to cost', () => {
    const short = postReturnCredited({
      returnId: 'r',
      number: 'RET-1',
      reference: 'CN-1',
      net: money(2000),
      tax: money(400),
      held: money(2500),
      at,
    });
    const sums = (e: typeof short) =>
      e.lines.reduce((t, l) => [t[0]! + l.debit.minor, t[1]! + l.credit.minor], [0, 0]);
    expect(sums(short)[0]).toBe(sums(short)[1]);
    expect(short.lines.find((l) => l.accountCode === ACCOUNT.PAYABLE)?.debit.minor).toBe(2400);
    expect(short.lines.find((l) => l.accountCode === ACCOUNT.STOCK_ADJUSTMENT)?.debit.minor).toBe(
      500,
    );

    const core = postReturnCredited({
      returnId: 'c',
      number: 'RET-2',
      reference: 'CN-2',
      net: money(8000),
      tax: money(0),
      held: money(0),
      at,
    });
    expect(core.lines.find((l) => l.accountCode === ACCOUNT.COGS_PARTS)?.credit.minor).toBe(8000);
  });

  it('write off what a supplier refuses', () => {
    const refused = postReturnRefused({ returnId: 'r', number: 'RET-1', held: money(2500), at });
    expect(refused.lines.map((l) => [l.accountCode, l.debit.minor, l.credit.minor])).toEqual([
      [ACCOUNT.STOCK_ADJUSTMENT, 2500, 0],
      [ACCOUNT.SUPPLIER_CREDITS, 0, 2500],
    ]);
  });

  it('put a sublet bill to its own cost', () => {
    const bill = postSubletBilled({
      subletId: 's',
      reference: 'INV-9',
      net: money(4500),
      tax: money(900),
      at,
    });
    expect(bill.lines.map((l) => [l.accountCode, l.debit.minor, l.credit.minor])).toEqual([
      [ACCOUNT.COGS_SUBLET, 4500, 0],
      [ACCOUNT.TAX_RECEIVABLE, 900, 0],
      [ACCOUNT.PAYABLE, 0, 5400],
    ]);
  });
});

describe('sublet work', () => {
  it('needs a vendor, a description and amounts', () => {
    const ok = { supplierId: 's', description: 'Four-wheel alignment', cost: 45, price: 75 };
    expect(code(() => assertSubletSound(ok))).toBeNull();
    expect(code(() => assertSubletSound({ ...ok, supplierId: null }))).toBe('NO_VENDOR');
    expect(code(() => assertSubletSound({ ...ok, description: '' }))).toBe('NO_DESCRIPTION');
    expect(code(() => assertSubletSound({ ...ok, cost: -1 }))).toBe('BAD_AMOUNT');
  });

  it('says its margin and whether it is sold below cost', () => {
    expect(subletMargin({ cost: 45, price: 75 })).toEqual({
      margin: 30,
      percent: 40,
      belowCost: false,
    });
    expect(subletMargin({ cost: 80, price: 75 }).belowCost).toBe(true);
  });

  it('is billed once', () => {
    const ok = { status: 'DONE', reference: 'V-1', net: 45, tax: 9 };
    expect(code(() => assertSubletBillable(ok))).toBeNull();
    expect(code(() => assertSubletBillable({ ...ok, status: 'BILLED' }))).toBe('ALREADY_BILLED');
    expect(code(() => assertSubletBillable({ ...ok, reference: '' }))).toBe('NO_REFERENCE');
  });
});
