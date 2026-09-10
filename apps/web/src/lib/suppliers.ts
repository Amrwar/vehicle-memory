import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * Suppliers, read as a workshop actually judges them.
 *
 * Not by their address. By whether the order arrived when they said it would,
 * and whether the price on the invoice matches the price on the order. Both
 * are answerable from records the product already holds and neither was
 * anywhere in it, which is how a supplier gets slower by a week a year without
 * anybody noticing.
 *
 * Every figure here is measured rather than configured, for the same reason
 * the lead time on the insights page is: a field for "typical delivery time"
 * is one more thing nobody fills in, and nobody updates when it changes.
 */

export class SupplierError extends Error {
  readonly code: 'DUPLICATE_NAME';

  constructor(code: SupplierError['code'], message: string) {
    super(message);
    this.name = 'SupplierError';
    this.code = code;
  }
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}

export async function supplierDetail(orgId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({
    where: { id: supplierId, orgId },
    select: {
      id: true,
      name: true,
      accountRef: true,
      email: true,
      phone: true,
      addressLine1: true,
      locality: true,
      postcode: true,
      paymentTermsDays: true,
      isActive: true,
      purchaseOrders: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        select: {
          id: true,
          number: true,
          status: true,
          total: true,
          createdAt: true,
          expectedAt: true,
          receipts: {
            orderBy: { receivedAt: 'asc' },
            take: 1,
            select: { receivedAt: true },
          },
          lines: {
            select: {
              productId: true,
              unitCost: true,
              product: { select: { name: true, partNumber: true } },
            },
          },
        },
      },
      bills: {
        select: { id: true, status: true, total: true, amountPaid: true },
      },
    },
  });

  if (!supplier) return null;

  const orders = supplier.purchaseOrders.map((order) => {
    const receivedAt = order.receipts[0]?.receivedAt ?? null;

    return {
      id: order.id,
      number: order.number,
      status: order.status,
      total: Number(order.total),
      createdAt: order.createdAt,
      expectedAt: order.expectedAt,
      receivedAt,
      // Late against what they promised, not against what anybody hoped.
      late: Boolean(receivedAt && order.expectedAt && receivedAt > order.expectedAt),
    };
  });

  const waits = orders
    .filter((order) => order.receivedAt)
    .map((order) => (order.receivedAt!.getTime() - order.createdAt.getTime()) / 86_400_000)
    .filter((wait) => wait >= 0);

  // Three orders is not a lead time, so it says nothing rather than averaging
  // two numbers and presenting the result as a fact.
  const leadTimeDays = waits.length >= 3 ? Math.max(1, Math.round(median(waits) ?? 0)) : null;

  /* --- what each part last cost, and whether that moved ------------------ */

  const history = new Map<string, { name: string; entries: { price: number; at: Date }[] }>();

  for (const order of supplier.purchaseOrders) {
    for (const line of order.lines) {
      if (!line.productId || !line.product) continue;

      const existing = history.get(line.productId) ?? {
        name: `${line.product.name} (${line.product.partNumber})`,
        entries: [],
      };

      existing.entries.push({ price: Number(line.unitCost), at: order.createdAt });
      history.set(line.productId, existing);
    }
  }

  const prices = [...history.entries()]
    .map(([productId, entry]) => {
      const sorted = entry.entries.sort((a, b) => b.at.getTime() - a.at.getTime());
      const latest = sorted[0]!;
      const previous = sorted.find((candidate) => candidate.price !== latest.price);

      return {
        productId,
        name: entry.name,
        lastPrice: latest.price,
        lastAt: latest.at,
        change:
          previous && previous.price > 0
            ? ((latest.price - previous.price) / previous.price) * 100
            : null,
      };
    })
    .sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));

  const outstanding = supplier.bills.reduce(
    (total, bill) => total + (Number(bill.total) - Number(bill.amountPaid)),
    0,
  );

  return {
    ...supplier,
    orders,
    prices,
    orderCount: orders.length,
    openOrders: orders.filter((order) => !['RECEIVED', 'CANCELLED'].includes(order.status)).length,
    lateCount: orders.filter((order) => order.late).length,
    leadTimeDays,
    outstanding,
    openBills: supplier.bills.filter((bill) => Number(bill.total) > Number(bill.amountPaid)).length,
    disputed: supplier.bills.filter((bill) => bill.status === 'DISPUTED').length,
  };
}

/**
 * Adds a supplier.
 *
 * The name is unique per workshop, and the refusal says so plainly rather than
 * surfacing a constraint violation. Two suppliers with the same name is how a
 * workshop ends up with half its orders against one and half against the
 * other, and neither history meaning anything.
 */
export async function createSupplier(input: {
  orgId: string;
  userId: string;
  name: string;
  accountRef?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  locality?: string;
  postcode?: string;
  paymentTermsDays: number;
}) {
  const name = input.name.trim();

  const existing = await prisma.supplier.findFirst({
    where: { orgId: input.orgId, name },
    select: { id: true },
  });

  if (existing) {
    throw new SupplierError(
      'DUPLICATE_NAME',
      `There is already a supplier called ${name}. Two with the same name means half your orders go against one and half against the other.`,
    );
  }

  const supplier = await prisma.supplier.create({
    data: {
      orgId: input.orgId,
      name,
      accountRef: input.accountRef?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      addressLine1: input.addressLine1?.trim() || null,
      locality: input.locality?.trim() || null,
      postcode: input.postcode?.trim() || null,
      paymentTermsDays: Math.max(0, input.paymentTermsDays),
    },
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'supplier.created',
    entityType: 'Supplier',
    entityId: supplier.id,
    after: { name },
  });

  return supplier.id;
}
