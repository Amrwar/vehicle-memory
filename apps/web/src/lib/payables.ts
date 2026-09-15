import {
  ACCOUNT,
  type Allocation,
  allocateAcrossBills,
  assertSupplierPayable,
  billStateAfter,
  fromDecimal,
  type Money,
  type PayableBill,
  PayablesError,
  type PaymentMethod,
  postSupplierPayment,
  remittanceAdvice,
  toNumber,
  zero,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { postEntry } from './accounting';
import { audit } from './guard';
import { pushNow } from './outbound';
import { regionFor } from './region';

/**
 * Supplier bills and paying them, against the database.
 *
 * A bill is booked against an order, approved by somebody, and paid, usually
 * several at a time. Each step has a ledger consequence and the posting sits
 * outside the transaction that wrote the document, as everywhere else in the
 * money code.
 */

export { PayablesError };

const asBill = (row: {
  id: string;
  reference: string;
  supplierId: string;
  status: string;
  total: unknown;
  amountPaid: unknown;
  dueAt: Date | null;
}): PayableBill => ({
  id: row.id,
  reference: row.reference,
  supplierId: row.supplierId,
  status: row.status as PayableBill['status'],
  total: fromDecimal(String(row.total)),
  amountPaid: fromDecimal(String(row.amountPaid)),
  dueAt: row.dueAt,
});

/* ---------------------------------------------------------------------------
   Booking a bill
   --------------------------------------------------------------------------- */

/**
 * Records a supplier's invoice against an order.
 *
 * This is where the debt enters the books. The accounting model has stock
 * debited at the moment goods arrive, and the receipt path does not yet post,
 * so for now the bill carries both sides: stock and input tax up, payable up.
 * When receipt-time posting lands, this becomes the variance between the two.
 */
export async function bookBill(input: {
  orgId: string;
  userId: string;
  orderId: string;
  reference: string;
  subtotal: number;
  taxTotal: number;
  billedAt: Date;
  dueAt?: Date | null;
}): Promise<string> {
  const reference = input.reference.trim();

  if (!reference) {
    throw new PayablesError(
      'NOT_POSITIVE',
      'The bill needs the supplier’s own invoice number on it.',
    );
  }

  if (!Number.isFinite(input.subtotal) || input.subtotal <= 0) {
    throw new PayablesError('NOT_POSITIVE', 'A bill has to be for more than nothing.');
  }

  const order = await prisma.purchaseOrder.findFirstOrThrow({
    where: { id: input.orderId, orgId: input.orgId },
    select: {
      id: true,
      number: true,
      supplierId: true,
      supplier: { select: { paymentTermsDays: true } },
    },
  });

  const taken = await prisma.supplierBill.findUnique({
    where: { orgId_reference: { orgId: input.orgId, reference } },
    select: { id: true },
  });

  if (taken) {
    throw new PayablesError(
      'OVER_ALLOCATED',
      `A bill with reference ${reference} is already booked. A supplier invoice booked twice is a supplier paid twice.`,
    );
  }

  const tax = Number.isFinite(input.taxTotal) && input.taxTotal > 0 ? input.taxTotal : 0;
  const total = Math.round((input.subtotal + tax) * 100) / 100;
  const dueAt =
    input.dueAt ??
    new Date(input.billedAt.getTime() + order.supplier.paymentTermsDays * 86_400_000);

  const bill = await prisma.supplierBill.create({
    data: {
      orgId: input.orgId,
      supplierId: order.supplierId,
      orderId: order.id,
      reference,
      status: 'AWAITING',
      subtotal: input.subtotal,
      taxTotal: tax,
      total,
      amountPaid: 0,
      billedAt: input.billedAt,
      dueAt,
    },
    select: { id: true },
  });

  const currency = (await regionFor(input.orgId)).currency;

  await postEntry(input.orgId, {
    reference: `${reference}/B`,
    description: `Supplier bill ${reference} on ${order.number}`,
    sourceType: 'SupplierBill',
    sourceId: bill.id,
    postedAt: input.billedAt,
    lines: [
      {
        accountCode: ACCOUNT.STOCK,
        debit: fromDecimal(input.subtotal.toFixed(2), currency),
        credit: zero(currency),
        memo: 'Goods billed',
      },
      ...(tax > 0
        ? [
            {
              accountCode: ACCOUNT.TAX_RECEIVABLE,
              debit: fromDecimal(tax.toFixed(2), currency),
              credit: zero(currency),
              memo: 'Input tax',
            },
          ]
        : []),
      {
        accountCode: ACCOUNT.PAYABLE,
        debit: zero(currency),
        credit: fromDecimal(total.toFixed(2), currency),
        memo: 'Owed to the supplier',
      },
    ],
  });

  // Credit held on the supplier's account from a return comes off this bill. Phase 38.
  const { applyHeldCredits } = await import('./returns');
  await applyHeldCredits(input.orgId, order.supplierId);

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'supplierbill.booked',
    entityType: 'SupplierBill',
    entityId: bill.id,
    after: { reference, order: order.number, total },
  });

  return bill.id;
}

/** Somebody has checked the bill against the delivery and it may be paid. */
export async function approveBill(input: {
  orgId: string;
  userId: string;
  billId: string;
}): Promise<void> {
  const bill = await prisma.supplierBill.findFirstOrThrow({
    where: { id: input.billId, orgId: input.orgId },
    select: { id: true, status: true, reference: true },
  });

  if (bill.status !== 'AWAITING' && bill.status !== 'DISPUTED') return;

  await prisma.supplierBill.update({ where: { id: bill.id }, data: { status: 'APPROVED' } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'supplierbill.approved',
    entityType: 'SupplierBill',
    entityId: bill.id,
    before: { status: bill.status },
    after: { status: 'APPROVED', reference: bill.reference },
  });
}

/** The bill does not match what arrived, and is parked until it does. */
export async function disputeBill(input: {
  orgId: string;
  userId: string;
  billId: string;
  reason: string;
}): Promise<void> {
  if (!input.reason.trim()) {
    throw new PayablesError('DISPUTED', 'Say what is wrong with it. The supplier will be asked.');
  }

  const bill = await prisma.supplierBill.findFirstOrThrow({
    where: { id: input.billId, orgId: input.orgId },
    select: { id: true, status: true, reference: true },
  });

  if (bill.status === 'PAID') {
    throw new PayablesError(
      'DISPUTED',
      'This bill has been paid. Take it up with the supplier as a credit rather than a dispute.',
    );
  }

  await prisma.supplierBill.update({ where: { id: bill.id }, data: { status: 'DISPUTED' } });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'supplierbill.disputed',
    entityType: 'SupplierBill',
    entityId: bill.id,
    after: { reference: bill.reference, reason: input.reason.trim() },
  });
}

/* ---------------------------------------------------------------------------
   Paying
   --------------------------------------------------------------------------- */

/** What is owed to each supplier, oldest due first. */
export async function payablesFor(orgId: string) {
  const currency = (await regionFor(orgId)).currency;
  const bills = await prisma.supplierBill.findMany({
    where: { orgId, status: { in: ['AWAITING', 'APPROVED', 'PART_PAID', 'DISPUTED'] } },
    orderBy: [{ dueAt: 'asc' }, { billedAt: 'asc' }],
    include: {
      supplier: { select: { id: true, name: true, email: true } },
      order: { select: { id: true, number: true } },
    },
  });

  const bySupplier = new Map<
    string,
    {
      supplier: (typeof bills)[number]['supplier'];
      bills: typeof bills;
      outstanding: Money;
      payable: Money;
      overdue: number;
    }
  >();

  const now = Date.now();

  for (const bill of bills) {
    const view = asBill(bill);
    const owed = { minor: view.total.minor - view.amountPaid.minor, currency };
    if (owed.minor <= 0) continue;

    const entry = bySupplier.get(bill.supplierId) ?? {
      supplier: bill.supplier,
      bills: [],
      outstanding: zero(currency),
      payable: zero(currency),
      overdue: 0,
    };

    entry.bills.push(bill);
    entry.outstanding = { minor: entry.outstanding.minor + owed.minor, currency };
    if (bill.status === 'APPROVED' || bill.status === 'PART_PAID') {
      entry.payable = { minor: entry.payable.minor + owed.minor, currency };
    }
    if (bill.dueAt && bill.dueAt.getTime() < now) entry.overdue += 1;

    bySupplier.set(bill.supplierId, entry);
  }

  return [...bySupplier.values()].sort(
    (a, b) => b.overdue - a.overdue || b.outstanding.minor - a.outstanding.minor,
  );
}

/**
 * Pays a supplier.
 *
 * Without explicit allocations the payment is spread oldest due first across
 * the supplier's approved bills, which is what their statement will do. With
 * them, every penny has to land on a bill of theirs and nothing may exceed
 * what a bill still owes. Only approved and part-paid bills are payable:
 * paying one nobody has checked is how a wrong delivery gets paid for.
 */
export async function paySupplier(input: {
  orgId: string;
  userId: string;
  supplierId: string;
  amount: Money;
  method: PaymentMethod;
  reference?: string | null;
  note?: string | null;
  allocations?: readonly Allocation[];
  paidAt?: Date;
}): Promise<string> {
  const supplier = await prisma.supplier.findFirstOrThrow({
    where: { id: input.supplierId, orgId: input.orgId },
    select: { id: true, name: true, email: true },
  });

  const rows = await prisma.supplierBill.findMany({
    where: {
      orgId: input.orgId,
      supplierId: supplier.id,
      status: { in: ['APPROVED', 'PART_PAID', 'DISPUTED'] },
    },
    select: {
      id: true,
      reference: true,
      supplierId: true,
      status: true,
      total: true,
      amountPaid: true,
      dueAt: true,
    },
  });

  const bills = rows.map(asBill);

  const allocations =
    input.allocations ??
    (() => {
      const spread = allocateAcrossBills(bills, input.amount);
      if (spread.unallocated.minor > 0) {
        throw new PayablesError(
          'UNALLOCATED',
          `Only ${format({ minor: input.amount.minor - spread.unallocated.minor, currency: input.amount.currency })} is owed on approved bills. Pay that, or approve the rest first.`,
        );
      }
      return spread.allocations;
    })();

  assertSupplierPayable({ supplierId: supplier.id, amount: input.amount, allocations, bills });

  const paidAt = input.paidAt ?? new Date();
  const byId = new Map(bills.map((bill) => [bill.id, bill]));

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.supplierPayment.create({
      data: {
        orgId: input.orgId,
        supplierId: supplier.id,
        amount: toNumber(input.amount),
        method: input.method,
        reference: input.reference?.trim() || null,
        note: input.note?.trim() || null,
        paidAt,
        recordedByUserId: input.userId,
        allocations: {
          create: allocations.map((allocation) => ({
            billId: allocation.billId,
            amount: toNumber(allocation.amount),
          })),
        },
      },
      select: { id: true },
    });

    for (const allocation of allocations) {
      const bill = byId.get(allocation.billId)!;
      await tx.supplierBill.update({
        where: { id: bill.id },
        data: {
          amountPaid: { increment: toNumber(allocation.amount) },
          status: billStateAfter(bill, allocation.amount),
        },
      });
    }

    return created;
  });

  const reference = input.reference?.trim() || `PAY-${payment.id.slice(-6).toUpperCase()}`;

  await postEntry(
    input.orgId,
    postSupplierPayment({
      paymentId: payment.id,
      reference,
      supplierName: supplier.name,
      amount: input.amount,
      method: input.method,
      paidAt,
    }),
  );

  // The remittance advice. The one document a supplier's accounts department
  // wants, and the one that stops them ringing to ask what the money was for.
  if (supplier.email) {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: input.orgId },
      select: { name: true },
    });

    const advice = remittanceAdvice({
      workshopName: org.name,
      supplierName: supplier.name,
      paidAt,
      method: input.method,
      reference: input.reference?.trim() || null,
      total: input.amount,
      lines: allocations.map((allocation) => {
        const bill = byId.get(allocation.billId)!;
        return {
          reference: bill.reference,
          amount: allocation.amount,
          settles: billStateAfter(bill, allocation.amount) === 'PAID',
        };
      }),
    });

    const queued = await prisma.messageLog.create({
      data: {
        orgId: input.orgId,
        channel: 'EMAIL',
        toAddress: supplier.email,
        subject: advice.subject,
        body: advice.body,
        status: 'QUEUED',
        relatedType: 'SupplierPayment',
        relatedId: payment.id,
      },
      select: { id: true },
    });

    await pushNow(queued.id);
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'supplier.paid',
    entityType: 'SupplierPayment',
    entityId: payment.id,
    after: {
      supplier: supplier.name,
      amount: toNumber(input.amount),
      method: input.method,
      bills: allocations.length,
    },
  });

  return payment.id;
}

/** Payments made, newest first. */
export async function supplierPaymentsFor(orgId: string, limit = 50) {
  return prisma.supplierPayment.findMany({
    where: { orgId },
    orderBy: { paidAt: 'desc' },
    take: limit,
    include: {
      supplier: { select: { id: true, name: true } },
      recordedBy: { select: { name: true } },
      allocations: { include: { bill: { select: { reference: true } } } },
    },
  });
}

function format(value: Money, locale = 'en-GB'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: value.currency }).format(
    value.minor / 100,
  );
}
