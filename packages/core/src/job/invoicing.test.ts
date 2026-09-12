import { describe, expect, it } from 'vitest';

import { money } from '../shared/money';

import {
  assertInvoiceable,
  assertInvoiceCreditable,
  assertInvoiceRefundable,
  assertPaymentRecordable,
  describeSettlement,
  dueDateFor,
  outstandingOn,
  stateAfterCredit,
  stateAfterPayment,
} from './invoicing';

const gbp = (pounds: number) => money(Math.round(pounds * 100), 'GBP');

describe('dueDateFor', () => {
  it('gives the customer the stated number of whole days', () => {
    const due = dueDateFor(new Date('2026-09-01T10:00:00Z'), 14);
    expect(due.getDate()).toBe(15);
    expect(due.getHours()).toBe(23);
  });
});

describe('assertInvoiceable', () => {
  const ready = { status: 'COMPLETED' as const, alreadyInvoiced: false, chargeableLines: 3 };

  it('lets a completed, priced, uninvoiced job through', () => {
    expect(() => assertInvoiceable(ready)).not.toThrow();
  });

  it('never invoices the same job twice', () => {
    // Checked before status, so a second invoice is refused for the right
    // reason even when the job has moved on.
    expect(() =>
      assertInvoiceable({ ...ready, alreadyInvoiced: true, status: 'INVOICED' }),
    ).toThrow(/credit note/);
  });

  it('will not bill for work still on the ramp', () => {
    expect(() => assertInvoiceable({ ...ready, status: 'IN_PROGRESS' })).toThrow(
      /still on the ramp/,
    );
  });

  it('refuses an empty invoice', () => {
    expect(() => assertInvoiceable({ ...ready, chargeableLines: 0 })).toThrow(/nothing priced/);
  });
});

describe('assertPaymentRecordable', () => {
  const invoice = { status: 'ISSUED' as const, total: gbp(240), amountPaid: gbp(100) };

  it('takes what is owed', () => {
    expect(() => assertPaymentRecordable(invoice, gbp(140))).not.toThrow();
    expect(() => assertPaymentRecordable(invoice, gbp(40))).not.toThrow();
  });

  it('never takes more than is owed', () => {
    // An overpayment is money held for somebody else, not a tip.
    expect(() => assertPaymentRecordable(invoice, gbp(140.01))).toThrow(
      /Only £140.00 is outstanding/,
    );
  });

  it('refuses nothing and less than nothing', () => {
    expect(() => assertPaymentRecordable(invoice, gbp(0))).toThrow(/more than nothing/);
    expect(() => assertPaymentRecordable(invoice, gbp(-5))).toThrow(/more than nothing/);
  });

  it('refuses a draft and a void', () => {
    expect(() => assertPaymentRecordable({ ...invoice, status: 'DRAFT' }, gbp(1))).toThrow(
      /not been issued/,
    );
    expect(() => assertPaymentRecordable({ ...invoice, status: 'VOID' }, gbp(1))).toThrow(/voided/);
  });
});

describe('stateAfterPayment', () => {
  it('settles when the balance is reached', () => {
    const invoice = { status: 'ISSUED' as const, total: gbp(240), amountPaid: gbp(100) };
    expect(stateAfterPayment(invoice, gbp(140))).toBe('PAID');
    expect(stateAfterPayment(invoice, gbp(139.99))).toBe('PART_PAID');
  });
});

describe('outstandingOn', () => {
  it('is what is left', () => {
    expect(outstandingOn({ total: gbp(240), amountPaid: gbp(100) })).toEqual(gbp(140));
  });
});

describe('assertInvoiceCreditable', () => {
  const invoice = {
    status: 'PAID' as const,
    total: gbp(240),
    amountPaid: gbp(240),
    credited: gbp(40),
  };

  it('credits up to what is left of the invoice', () => {
    expect(() => assertInvoiceCreditable(invoice, gbp(200), 'Part under warranty')).not.toThrow();
  });

  it('will not credit past the invoice total', () => {
    // A negative sale does not exist.
    expect(() => assertInvoiceCreditable(invoice, gbp(200.01), 'Too much')).toThrow(
      /At most £200.00/,
    );
  });

  it('insists on a reason', () => {
    expect(() => assertInvoiceCreditable(invoice, gbp(10), '   ')).toThrow(/Say why/);
  });

  it('has nothing to credit on a draft', () => {
    expect(() => assertInvoiceCreditable({ ...invoice, status: 'DRAFT' }, gbp(10), 'x')).toThrow(
      /Edit the draft/,
    );
  });
});

describe('stateAfterCredit', () => {
  it('leaves a fully paid invoice settled, with the customer owed the difference', () => {
    const invoice = {
      status: 'PAID' as const,
      total: gbp(240),
      amountPaid: gbp(240),
      credited: gbp(0),
    };
    expect(stateAfterCredit(invoice, gbp(40))).toBe('PAID');
  });

  it('settles an unpaid invoice that is credited in full', () => {
    const invoice = {
      status: 'ISSUED' as const,
      total: gbp(240),
      amountPaid: gbp(0),
      credited: gbp(0),
    };
    expect(stateAfterCredit(invoice, gbp(240))).toBe('PAID');
  });

  it('keeps an unpaid invoice open when only part is credited', () => {
    const invoice = {
      status: 'ISSUED' as const,
      total: gbp(240),
      amountPaid: gbp(0),
      credited: gbp(0),
    };
    expect(stateAfterCredit(invoice, gbp(40))).toBe('ISSUED');
  });
});

describe('assertInvoiceRefundable', () => {
  it('refunds the lesser of what was paid and what was credited', () => {
    expect(() =>
      assertInvoiceRefundable({
        amountPaid: gbp(240),
        refunded: gbp(0),
        credited: gbp(40),
        amount: gbp(40),
      }),
    ).not.toThrow();

    expect(() =>
      assertInvoiceRefundable({
        amountPaid: gbp(240),
        refunded: gbp(0),
        credited: gbp(40),
        amount: gbp(40.01),
      }),
    ).toThrow(/At most £40.00/);
  });

  it('never refunds money that was not received', () => {
    expect(() =>
      assertInvoiceRefundable({
        amountPaid: gbp(20),
        refunded: gbp(0),
        credited: gbp(100),
        amount: gbp(50),
      }),
    ).toThrow(/At most £20.00/);
  });

  it('will not refund twice', () => {
    expect(() =>
      assertInvoiceRefundable({
        amountPaid: gbp(240),
        refunded: gbp(40),
        credited: gbp(40),
        amount: gbp(1),
      }),
    ).toThrow(/Nothing is refundable/);
  });

  it('needs a credit note first', () => {
    // A refund is money going back for a reason, and the credit note is the
    // reason.
    expect(() =>
      assertInvoiceRefundable({
        amountPaid: gbp(240),
        refunded: gbp(0),
        credited: gbp(0),
        amount: gbp(10),
      }),
    ).toThrow(/Raise a credit note first/);
  });
});

describe('describeSettlement', () => {
  const base = {
    status: 'ISSUED' as const,
    total: gbp(240),
    amountPaid: gbp(0),
    dueAt: new Date('2026-09-20'),
  };

  it('says paid in full', () => {
    expect(describeSettlement({ ...base, status: 'PAID', amountPaid: gbp(240) })).toBe(
      'Paid in full.',
    );
  });

  it('says how overdue', () => {
    const line = describeSettlement({ ...base, now: new Date('2026-09-25T12:00:00Z') });
    expect(line).toContain('overdue by 5 days');
  });

  it('says what has come and what is still to come', () => {
    const line = describeSettlement({
      ...base,
      status: 'PART_PAID',
      amountPaid: gbp(100),
      now: new Date('2026-09-10'),
    });
    expect(line).toBe('£100.00 paid, £140.00 still to come.');
  });

  it('says a void counts for nothing', () => {
    expect(describeSettlement({ ...base, status: 'VOID' })).toContain('nothing');
  });
});
