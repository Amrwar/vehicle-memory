import {
  applyCredit,
  applyIssue,
  assertReturnCreditable,
  assertReturnable,
  assertSubletBillable,
  assertSubletSound,
  type Currency,
  fromDecimal,
  heldValue,
  postReturnCredited,
  postReturnRefused,
  postReturnSent,
  postSubletBilled,
  type ReturnReason,
  ReturnError,
  subletMargin,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { ensureChartOfAccounts, postEntry } from './accounting';
import { audit } from './guard';
import { defaultWarehouseFor, lockLevel } from './inventory';
import { regionFor } from './region';
import { defaultTaxRateId } from './tax';

/**
 * Parts back, and work sent out, against the database. Phase 38.
 *
 * A return is written in one transaction with the stock it takes off the
 * shelf and its movements, then posted: the cost leaves stock and is held
 * as a credit the supplier owes. The credit note clears it against the
 * bills the supplier is owed, oldest first; what cannot be set against a
 * bill is held on their account and set against the next one booked.
 *
 * Sublet work is a line on the job the customer is charged on, with its
 * cost beside it, and a bill from the vendor that puts the real cost on the
 * books when it arrives.
 */

export { ReturnError };

const OPEN_BILL_STATUSES = ['AWAITING', 'APPROVED', 'PART_PAID', 'DISPUTED'] as const;

function toMinor(value: number): number {
  return Math.round(value * 100);
}

/* ---------------------------------------------------------------------------
   Sending parts back
   --------------------------------------------------------------------------- */

export async function sendReturn(input: {
  orgId: string;
  userId: string;
  orderId: string;
  reason: ReturnReason;
  notes?: string | null;
  lines: { orderLineId: string; quantity: number; unitCost?: number | null }[];
}): Promise<{ returnId: string; number: string; held: number }> {
  const order = await prisma.purchaseOrder.findFirst({
    where: { id: input.orderId, orgId: input.orgId },
    select: {
      id: true,
      number: true,
      supplierId: true,
      lines: {
        select: {
          id: true,
          description: true,
          productId: true,
          received: true,
          unitCost: true,
          returnLines: { select: { quantity: true } },
        },
      },
    },
  });
  if (!order) throw new ReturnError('NOTHING', 'That order is not here.');

  const wanted = input.lines.filter((line) => line.quantity > 0);
  if (wanted.length === 0)
    throw new ReturnError('NOTHING', 'Say what is going back, and how many.');

  const warehouseId = await defaultWarehouseFor(input.orgId);
  const currency = (await regionFor(input.orgId)).currency as Currency;

  const result = await prisma.$transaction(async (tx) => {
    const count = await tx.supplierReturn.count({ where: { orgId: input.orgId } });
    const number = `RET-${String(count + 1).padStart(4, '0')}`;

    const lines: {
      orderLineId: string;
      productId: string | null;
      warehouseId: string | null;
      description: string;
      quantity: number;
      unitCost: number;
    }[] = [];
    const movements: {
      productId: string;
      warehouseId: string;
      quantity: number;
      unitCost: string;
      balanceAfter: number;
    }[] = [];

    for (const want of wanted) {
      const line = order.lines.find((l) => l.id === want.orderLineId);
      if (!line) throw new ReturnError('NOTHING', 'A line on that return is not on the order.');
      const alreadyReturned = line.returnLines.reduce((t, r) => t + Number(r.quantity), 0);

      if (input.reason === 'CORE' || !line.productId || !warehouseId) {
        assertReturnable({
          reason: input.reason,
          description: line.description,
          quantity: want.quantity,
          received: Number(line.received),
          alreadyReturned,
          onHand: null,
        });
        lines.push({
          orderLineId: line.id,
          productId: line.productId,
          warehouseId: null,
          description: line.description,
          quantity: want.quantity,
          unitCost: want.unitCost ?? Number(line.unitCost),
        });
        continue;
      }

      const { position } = await lockLevel(tx, line.productId, warehouseId);
      assertReturnable({
        reason: input.reason,
        description: line.description,
        quantity: want.quantity,
        received: Number(line.received),
        alreadyReturned,
        onHand: position.onHand,
      });
      const issued = applyIssue(position, want.quantity, currency);
      await tx.stockLevel.update({
        where: { productId_warehouseId: { productId: line.productId, warehouseId } },
        data: { onHand: issued.onHand },
      });
      movements.push({
        productId: line.productId,
        warehouseId,
        quantity: -want.quantity,
        unitCost: String(position.avgCost),
        balanceAfter: issued.onHand,
      });
      lines.push({
        orderLineId: line.id,
        productId: line.productId,
        warehouseId,
        description: line.description,
        quantity: want.quantity,
        unitCost: Number(position.avgCost),
      });
    }

    const held = heldValue(lines.map((l) => ({ ...l, reason: input.reason })));

    const created = await tx.supplierReturn.create({
      data: {
        orgId: input.orgId,
        supplierId: order.supplierId,
        orderId: order.id,
        number,
        reason: input.reason,
        notes: input.notes?.trim() || null,
        heldCost: held,
        createdByUserId: input.userId,
        lines: { create: lines },
      },
      select: { id: true },
    });

    for (const movement of movements) {
      await tx.stockMovement.create({
        data: {
          orgId: input.orgId,
          ...movement,
          type: 'RETURN',
          referenceType: 'SupplierReturn',
          referenceId: created.id,
          reason: `Returned to supplier, ${number}`,
        },
      });
    }

    return { returnId: created.id, number, held };
  });

  if (result.held > 0) {
    await ensureChartOfAccounts(input.orgId);
    await postEntry(
      input.orgId,
      postReturnSent({
        returnId: result.returnId,
        number: result.number,
        held: fromDecimal(result.held.toFixed(2), currency),
        at: new Date(),
      }),
    );
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'return.sent',
    entityType: 'SupplierReturn',
    entityId: result.returnId,
    after: { number: result.number, reason: input.reason, order: order.number, held: result.held },
  });

  return result;
}

/* ---------------------------------------------------------------------------
   The credit note
   --------------------------------------------------------------------------- */

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Sets an amount of credit against a supplier's open bills; returns what is left. */
async function setAgainstBills(
  tx: Tx,
  input: { orgId: string; supplierId: string; returnId: string; creditMinor: number },
): Promise<number> {
  const bills = await tx.supplierBill.findMany({
    where: {
      orgId: input.orgId,
      supplierId: input.supplierId,
      status: { in: [...OPEN_BILL_STATUSES] },
    },
    orderBy: [{ billedAt: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, total: true, amountPaid: true, status: true },
  });
  const plan = applyCredit(
    bills.map((b) => ({
      id: b.id,
      outstandingMinor: toMinor(Number(b.total) - Number(b.amountPaid)),
    })),
    input.creditMinor,
  );
  for (const application of plan.applications) {
    const bill = bills.find((b) => b.id === application.billId)!;
    const paid = Math.round((Number(bill.amountPaid) + application.minor / 100) * 100) / 100;
    const settled = toMinor(paid) >= toMinor(Number(bill.total));
    await tx.supplierBill.update({
      where: { id: bill.id },
      data: {
        amountPaid: paid,
        status: settled
          ? 'PAID'
          : bill.status === 'AWAITING' || bill.status === 'DISPUTED'
            ? bill.status
            : 'PART_PAID',
      },
    });
    await tx.supplierCreditApplication.upsert({
      where: { returnId_billId: { returnId: input.returnId, billId: bill.id } },
      create: { returnId: input.returnId, billId: bill.id, amount: application.minor / 100 },
      update: { amount: { increment: application.minor / 100 } },
    });
  }
  return plan.unappliedMinor;
}

export async function creditReturn(input: {
  orgId: string;
  userId: string;
  returnId: string;
  reference: string;
  net: number;
  tax: number;
  creditedAt?: Date;
}): Promise<{ appliedMinor: number; unappliedMinor: number }> {
  const found = await prisma.supplierReturn.findFirst({
    where: { id: input.returnId, orgId: input.orgId },
    select: { id: true, number: true, status: true, supplierId: true, heldCost: true },
  });
  if (!found) throw new ReturnError('NOT_OPEN', 'That return is not here.');
  assertReturnCreditable({
    status: found.status,
    reference: input.reference,
    net: input.net,
    tax: input.tax,
  });

  const currency = (await regionFor(input.orgId)).currency as Currency;
  const grossMinor = toMinor(input.net) + toMinor(input.tax);
  const at = input.creditedAt ?? new Date();

  const unappliedMinor = await prisma.$transaction(async (tx) => {
    // Claimed first, so two presses cannot credit it twice.
    const claimed = await tx.supplierReturn.updateMany({
      where: { id: found.id, status: 'SENT' },
      data: {
        status: 'CREDITED',
        creditReference: input.reference.trim(),
        creditNet: input.net,
        creditTax: input.tax,
        creditedAt: at,
      },
    });
    if (claimed.count === 0) {
      throw new ReturnError('NOT_OPEN', 'This return has already been credited.');
    }
    const left = await setAgainstBills(tx, {
      orgId: input.orgId,
      supplierId: found.supplierId,
      returnId: found.id,
      creditMinor: grossMinor,
    });
    await tx.supplierReturn.update({
      where: { id: found.id },
      data: { creditUnapplied: left / 100 },
    });
    return left;
  });

  await ensureChartOfAccounts(input.orgId);
  await postEntry(
    input.orgId,
    postReturnCredited({
      returnId: found.id,
      number: found.number,
      reference: input.reference.trim(),
      net: fromDecimal(input.net.toFixed(2), currency),
      tax: fromDecimal(input.tax.toFixed(2), currency),
      held: fromDecimal(Number(found.heldCost).toFixed(2), currency),
      at,
    }),
  );

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'return.credited',
    entityType: 'SupplierReturn',
    entityId: found.id,
    after: {
      reference: input.reference.trim(),
      net: input.net,
      tax: input.tax,
      unapplied: unappliedMinor / 100,
    },
  });

  return { appliedMinor: grossMinor - unappliedMinor, unappliedMinor };
}

export async function refuseReturn(input: {
  orgId: string;
  userId: string;
  returnId: string;
  reason: string;
}): Promise<void> {
  const found = await prisma.supplierReturn.findFirst({
    where: { id: input.returnId, orgId: input.orgId },
    select: { id: true, number: true, status: true, heldCost: true },
  });
  if (!found) throw new ReturnError('NOT_OPEN', 'That return is not here.');
  if (!input.reason.trim())
    throw new ReturnError('NO_REFERENCE', 'Say why the supplier refused it.');

  const claimed = await prisma.supplierReturn.updateMany({
    where: { id: found.id, status: 'SENT' },
    data: { status: 'REFUSED', refusedReason: input.reason.trim() },
  });
  if (claimed.count === 0) throw new ReturnError('NOT_OPEN', 'This return is already closed.');

  const currency = (await regionFor(input.orgId)).currency as Currency;
  if (Number(found.heldCost) > 0) {
    await ensureChartOfAccounts(input.orgId);
    await postEntry(
      input.orgId,
      postReturnRefused({
        returnId: found.id,
        number: found.number,
        held: fromDecimal(Number(found.heldCost).toFixed(2), currency),
        at: new Date(),
      }),
    );
  }

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'return.refused',
    entityType: 'SupplierReturn',
    entityId: found.id,
    after: { reason: input.reason.trim() },
  });
}

/**
 * Credit held on a supplier's account set against their open bills, oldest
 * credit first. Called when a bill is booked, so held credit is never
 * forgotten while a bill is paid in full.
 */
export async function applyHeldCredits(orgId: string, supplierId: string): Promise<number> {
  const held = await prisma.supplierReturn.findMany({
    where: { orgId, supplierId, status: 'CREDITED', creditUnapplied: { gt: 0 } },
    orderBy: { creditedAt: 'asc' },
    select: { id: true, creditUnapplied: true },
  });
  if (held.length === 0) return 0;
  let applied = 0;
  await prisma.$transaction(async (tx) => {
    for (const credit of held) {
      const before = toMinor(Number(credit.creditUnapplied));
      const left = await setAgainstBills(tx, {
        orgId,
        supplierId,
        returnId: credit.id,
        creditMinor: before,
      });
      applied += before - left;
      await tx.supplierReturn.update({
        where: { id: credit.id },
        data: { creditUnapplied: left / 100 },
      });
      if (left > 0) break;
    }
  });
  return applied;
}

/** Credit held per supplier, for the payables page. */
export async function heldCreditBySupplier(orgId: string): Promise<Map<string, number>> {
  const rows = await prisma.supplierReturn.groupBy({
    by: ['supplierId'],
    where: { orgId, status: 'CREDITED', creditUnapplied: { gt: 0 } },
    _sum: { creditUnapplied: true },
  });
  return new Map(rows.map((r) => [r.supplierId, Number(r._sum.creditUnapplied ?? 0)]));
}

export async function returnsFor(orgId: string, options: { orderId?: string } = {}) {
  return prisma.supplierReturn.findMany({
    where: { orgId, ...(options.orderId ? { orderId: options.orderId } : {}) },
    orderBy: [{ status: 'asc' }, { sentAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      number: true,
      reason: true,
      status: true,
      notes: true,
      heldCost: true,
      creditReference: true,
      creditNet: true,
      creditTax: true,
      creditUnapplied: true,
      creditedAt: true,
      refusedReason: true,
      sentAt: true,
      supplier: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
      lines: { select: { id: true, description: true, quantity: true, unitCost: true } },
    },
  });
}

/* ---------------------------------------------------------------------------
   Sublet work
   --------------------------------------------------------------------------- */

const CLOSED_JOB = ['INVOICED', 'PAID', 'CANCELLED'];

export async function addSublet(input: {
  orgId: string;
  userId: string;
  jobId: string;
  supplierId: string;
  description: string;
  cost: number;
  price: number;
}): Promise<{ subletId: string }> {
  assertSubletSound(input);
  const [job, supplier] = await Promise.all([
    prisma.job.findFirst({
      where: { id: input.jobId, orgId: input.orgId },
      select: {
        id: true,
        status: true,
        locationId: true,
        _count: { select: { labourLines: true, partLines: true, feeLines: true } },
      },
    }),
    prisma.supplier.findFirst({
      where: { id: input.supplierId, orgId: input.orgId },
      select: { id: true, name: true },
    }),
  ]);
  if (!job) throw new ReturnError('JOB_CLOSED', 'That job is not here.');
  if (CLOSED_JOB.includes(job.status)) {
    throw new ReturnError(
      'JOB_CLOSED',
      'This job is invoiced or closed; sublet work goes on a new job.',
    );
  }
  if (!supplier) throw new ReturnError('NO_VENDOR', 'That vendor is not one of your suppliers.');

  const subletId = await prisma.$transaction(async (tx) => {
    const line = await tx.jobPartLine.create({
      data: {
        jobId: job.id,
        description: input.description.trim(),
        quantity: 1,
        unitPrice: input.price,
        unitCost: input.cost,
        taxRateId: await defaultTaxRateId(input.orgId, job.locationId, tx),
        status: 'FITTED',
        sortOrder: job._count.labourLines + job._count.partLines + job._count.feeLines,
      },
      select: { id: true },
    });
    const sublet = await tx.jobSublet.create({
      data: {
        orgId: input.orgId,
        jobId: job.id,
        supplierId: supplier.id,
        description: input.description.trim(),
        cost: input.cost,
        price: input.price,
        partLineId: line.id,
        createdByUserId: input.userId,
      },
      select: { id: true },
    });
    return sublet.id;
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'sublet.ordered',
    entityType: 'JobSublet',
    entityId: subletId,
    after: { jobId: job.id, vendor: supplier.name, cost: input.cost, price: input.price },
  });
  return { subletId };
}

export async function markSubletDone(input: { orgId: string; userId: string; subletId: string }) {
  const updated = await prisma.jobSublet.updateMany({
    where: { id: input.subletId, orgId: input.orgId, status: 'ORDERED' },
    data: { status: 'DONE', doneAt: new Date() },
  });
  if (updated.count > 0) {
    await audit({
      orgId: input.orgId,
      actorUserId: input.userId,
      action: 'sublet.done',
      entityType: 'JobSublet',
      entityId: input.subletId,
    });
  }
}

export async function billSublet(input: {
  orgId: string;
  userId: string;
  subletId: string;
  reference: string;
  net: number;
  tax: number;
  billedAt?: Date;
}): Promise<{ billId: string }> {
  const sublet = await prisma.jobSublet.findFirst({
    where: { id: input.subletId, orgId: input.orgId },
    select: {
      id: true,
      status: true,
      description: true,
      partLineId: true,
      supplierId: true,
      supplier: { select: { paymentTermsDays: true } },
    },
  });
  if (!sublet) throw new ReturnError('NO_VENDOR', 'That sublet is not here.');
  assertSubletBillable({
    status: sublet.status,
    reference: input.reference,
    net: input.net,
    tax: input.tax,
  });

  const reference = input.reference.trim();
  const taken = await prisma.supplierBill.findUnique({
    where: { orgId_reference: { orgId: input.orgId, reference } },
    select: { id: true },
  });
  if (taken) {
    throw new ReturnError(
      'ALREADY_BILLED',
      `A bill with reference ${reference} is already booked. A bill booked twice is a vendor paid twice.`,
    );
  }

  const billedAt = input.billedAt ?? new Date();
  const total = Math.round((input.net + input.tax) * 100) / 100;
  const currency = (await regionFor(input.orgId)).currency as Currency;

  const billId = await prisma.$transaction(async (tx) => {
    const claimed = await tx.jobSublet.updateMany({
      where: { id: sublet.id, status: { not: 'BILLED' } },
      data: { status: 'BILLED' },
    });
    if (claimed.count === 0) {
      throw new ReturnError('ALREADY_BILLED', 'The vendor’s bill for this work is already booked.');
    }
    const bill = await tx.supplierBill.create({
      data: {
        orgId: input.orgId,
        supplierId: sublet.supplierId,
        reference,
        status: 'AWAITING',
        subtotal: input.net,
        taxTotal: input.tax,
        total,
        amountPaid: 0,
        billedAt,
        dueAt: new Date(billedAt.getTime() + sublet.supplier.paymentTermsDays * 86_400_000),
      },
      select: { id: true },
    });
    await tx.jobSublet.update({
      where: { id: sublet.id },
      data: { billId: bill.id, doneAt: new Date(), cost: input.net },
    });
    // The real cost on the line, so the job's margin is what it actually made.
    await tx.jobPartLine.update({
      where: { id: sublet.partLineId },
      data: { unitCost: input.net },
    });
    return bill.id;
  });

  await ensureChartOfAccounts(input.orgId);
  await postEntry(
    input.orgId,
    postSubletBilled({
      subletId: sublet.id,
      reference,
      net: fromDecimal(input.net.toFixed(2), currency),
      tax: fromDecimal(input.tax.toFixed(2), currency),
      at: billedAt,
    }),
  );
  await applyHeldCredits(input.orgId, sublet.supplierId);

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'sublet.billed',
    entityType: 'JobSublet',
    entityId: sublet.id,
    after: { reference, net: input.net, tax: input.tax, billId },
  });
  return { billId };
}

export async function subletsForJob(orgId: string, jobId: string) {
  const rows = await prisma.jobSublet.findMany({
    where: { orgId, jobId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      description: true,
      cost: true,
      price: true,
      status: true,
      doneAt: true,
      partLineId: true,
      supplier: { select: { id: true, name: true } },
      bill: { select: { id: true, reference: true, total: true } },
    },
  });
  return rows.map((row) => ({
    ...row,
    cost: Number(row.cost),
    price: Number(row.price),
    margin: subletMargin({ cost: Number(row.cost), price: Number(row.price) }),
  }));
}
