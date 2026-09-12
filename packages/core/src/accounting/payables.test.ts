import { describe, expect, it } from 'vitest';

import { money } from '../shared/money';

import {
  allocateAcrossBills,
  assertSupplierPayable,
  billStateAfter,
  outstandingOnBill,
  type PayableBill,
  postSupplierPayment,
  remittanceAdvice,
} from './payables';

const gbp = (pounds: number) => money(Math.round(pounds * 100), 'GBP');

const bill = (over: Partial<PayableBill> & { id: string }): PayableBill => ({
  reference: over.id.toUpperCase(),
  supplierId: 'sup',
  status: 'APPROVED',
  total: gbp(100),
  amountPaid: gbp(0),
  dueAt: new Date('2026-09-10'),
  ...over,
});

describe('allocateAcrossBills', () => {
  it('pays the oldest due bill first', () => {
    const { allocations, unallocated } = allocateAcrossBills(
      [
        bill({ id: 'newer', dueAt: new Date('2026-09-20') }),
        bill({ id: 'older', dueAt: new Date('2026-09-01') }),
      ],
      gbp(150),
    );

    expect(allocations.map((a) => [a.billId, a.amount.minor])).toEqual([
      ['older', 10000],
      ['newer', 5000],
    ]);
    expect(unallocated.minor).toBe(0);
  });

  it('reports what lands on no bill', () => {
    const { unallocated } = allocateAcrossBills([bill({ id: 'a' })], gbp(120));
    expect(unallocated.minor).toBe(2000);
  });

  it('skips paid and disputed bills', () => {
    // Paying a disputed bill is a decision, not an allocation.
    const { allocations } = allocateAcrossBills(
      [
        bill({ id: 'paid', status: 'PAID', amountPaid: gbp(100) }),
        bill({ id: 'disputed', status: 'DISPUTED' }),
        bill({ id: 'open' }),
      ],
      gbp(50),
    );
    expect(allocations.map((a) => a.billId)).toEqual(['open']);
  });

  it('refuses when nothing is owed', () => {
    expect(() =>
      allocateAcrossBills([bill({ id: 'paid', status: 'PAID', amountPaid: gbp(100) })], gbp(10)),
    ).toThrow(/Nothing is owed/);
  });

  it('refuses nothing and less', () => {
    expect(() => allocateAcrossBills([bill({ id: 'a' })], gbp(0))).toThrow(/more than nothing/);
  });
});

describe('assertSupplierPayable', () => {
  const bills = [bill({ id: 'a' }), bill({ id: 'b', supplierId: 'other' })];

  it('accepts allocations that add up to the payment', () => {
    expect(() =>
      assertSupplierPayable({
        supplierId: 'sup',
        amount: gbp(60),
        allocations: [{ billId: 'a', amount: gbp(60) }],
        bills,
      }),
    ).not.toThrow();
  });

  it('refuses a bill from a different supplier', () => {
    expect(() =>
      assertSupplierPayable({
        supplierId: 'sup',
        amount: gbp(10),
        allocations: [{ billId: 'b', amount: gbp(10) }],
        bills,
      }),
    ).toThrow(/different supplier/);
  });

  it('refuses more than a bill owes', () => {
    expect(() =>
      assertSupplierPayable({
        supplierId: 'sup',
        amount: gbp(120),
        allocations: [{ billId: 'a', amount: gbp(120) }],
        bills,
      }),
    ).toThrow(/only has £100.00 outstanding/);
  });

  it('refuses money that lands on no bill', () => {
    // A credit the product cannot show is refused rather than quietly held.
    expect(() =>
      assertSupplierPayable({
        supplierId: 'sup',
        amount: gbp(100),
        allocations: [{ billId: 'a', amount: gbp(60) }],
        bills,
      }),
    ).toThrow(/£40.00 of the payment lands on no bill/);
  });

  it('refuses a disputed bill by name', () => {
    expect(() =>
      assertSupplierPayable({
        supplierId: 'sup',
        amount: gbp(10),
        allocations: [{ billId: 'd', amount: gbp(10) }],
        bills: [bill({ id: 'd', status: 'DISPUTED' })],
      }),
    ).toThrow(/D is disputed/);
  });
});

describe('billStateAfter and outstandingOnBill', () => {
  it('settles when the total is reached', () => {
    const b = bill({ id: 'a', amountPaid: gbp(40) });
    expect(outstandingOnBill(b).minor).toBe(6000);
    expect(billStateAfter(b, gbp(60))).toBe('PAID');
    expect(billStateAfter(b, gbp(59.99))).toBe('PART_PAID');
  });
});

describe('postSupplierPayment', () => {
  it('brings payable down and the bank down by the same amount', () => {
    const entry = postSupplierPayment({
      paymentId: 'p1',
      reference: 'PAY-1',
      supplierName: 'Euro Car Parts',
      amount: gbp(321.6),
      method: 'BANK_TRANSFER',
      paidAt: new Date('2026-09-12'),
    });

    const debits = entry.lines.reduce((t, l) => t + l.debit.minor, 0);
    const credits = entry.lines.reduce((t, l) => t + l.credit.minor, 0);
    expect(debits).toBe(credits);
    expect(entry.lines.find((l) => l.accountCode === '2000')?.debit.minor).toBe(32160);
    expect(entry.lines.find((l) => l.accountCode === '1000')?.credit.minor).toBe(32160);
  });

  it('comes out of the till when paid in cash', () => {
    const entry = postSupplierPayment({
      paymentId: 'p2',
      reference: 'PAY-2',
      supplierName: 'Local',
      amount: gbp(20),
      method: 'CASH',
      paidAt: new Date(),
    });
    expect(entry.lines.some((l) => l.accountCode === '1010' && l.credit.minor === 2000)).toBe(true);
  });
});

describe('remittanceAdvice', () => {
  it('lists each bill, marks part payments, and gives the reference to look for', () => {
    const { subject, body } = remittanceAdvice({
      workshopName: 'Hillside Motors',
      supplierName: 'Euro Car Parts',
      paidAt: new Date('2026-09-12'),
      method: 'BANK_TRANSFER',
      reference: 'FP-4471',
      total: gbp(150),
      lines: [
        { reference: 'PMF-40128', amount: gbp(100), settles: true },
        { reference: 'PMF-40130', amount: gbp(50), settles: false },
      ],
    });

    expect(subject).toContain('£150.00');
    expect(body).toContain('reference FP-4471');
    expect(body).toContain('PMF-40128');
    expect(body).toContain('PMF-40130');
    expect(body).toContain('(part payment)');
    expect(body).toContain('Total £150.00');
  });
});
