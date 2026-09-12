import {
  assertOrderDraftable,
  assertProductSaveable,
  CatalogueError,
  meaningfulLines,
  normalisePartNumber,
  type OrderLineInput,
  type ProductDetails,
} from '@carnet/core';
import { prisma } from '@carnet/db';

import { audit } from './guard';

/**
 * The parts catalogue and hand-raised orders, against the database.
 *
 * Rules are in `@carnet/core`. What is here needs the database: whether a
 * part number is already taken, the order number, and which warehouse a new
 * stocked part starts in.
 */

export { CatalogueError };

/** Adds a part to the catalogue. Returns the id. */
export async function createProduct(input: {
  orgId: string;
  userId: string;
  details: ProductDetails & { categoryId?: string | null; barcode?: string | null };
}): Promise<string> {
  const details = input.details;

  assertProductSaveable(details);

  const partNumber = normalisePartNumber(details.partNumber);

  // The unique index would refuse this too, but with a message about a
  // constraint. Somebody typing a part number wants to be told which part it
  // already is.
  const taken = await prisma.product.findUnique({
    where: { orgId_partNumber: { orgId: input.orgId, partNumber } },
    select: { id: true, name: true },
  });

  if (taken) {
    throw new CatalogueError(
      'DUPLICATE_PART',
      `${partNumber} is already in the catalogue as "${taken.name}". Open that one rather than adding it twice: two rows for one part means two stock figures, both wrong.`,
    );
  }

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        orgId: input.orgId,
        partNumber,
        name: details.name.trim(),
        brand: details.brand?.trim() || null,
        unit: details.unit?.trim() || 'each',
        costPrice: details.costPrice,
        sellPrice: details.sellPrice,
        reorderPoint: details.reorderPoint ?? 0,
        reorderQty: details.reorderQty ?? 0,
        barcode: details.barcode?.trim() || null,
        categoryId: details.categoryId || null,
        isStocked: details.isStocked ?? true,
      },
      select: { id: true },
    });

    // A stocked part starts with a stock row at zero in the default warehouse,
    // so the parts list shows it as out rather than not showing it at all.
    // A part that is never held (fitted straight from the supplier's van) has
    // no stock row, because zero would be a lie about a quantity nobody counts.
    if (details.isStocked ?? true) {
      const warehouse = await tx.warehouse.findFirst({
        where: { orgId: input.orgId },
        orderBy: [{ isDefault: 'desc' }, { code: 'asc' }],
        select: { id: true },
      });

      if (warehouse) {
        await tx.stockLevel.create({
          data: { productId: created.id, warehouseId: warehouse.id, avgCost: details.costPrice },
        });
      }
    }

    return created;
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'product.created',
    entityType: 'Product',
    entityId: product.id,
    after: {
      partNumber,
      name: details.name,
      costPrice: details.costPrice,
      sellPrice: details.sellPrice,
    },
  });

  return product.id;
}

/** Everything the order form needs to offer. */
export async function orderFormOptions(orgId: string) {
  const [suppliers, products] = await Promise.all([
    prisma.supplier.findMany({
      where: { orgId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, paymentTermsDays: true },
    }),
    prisma.product.findMany({
      where: { orgId, isActive: true },
      orderBy: { name: 'asc' },
      take: 500,
      select: { id: true, partNumber: true, name: true, costPrice: true },
    }),
  ]);

  return { suppliers, products };
}

/**
 * Raises a purchase order by hand, as a draft.
 *
 * A draft, deliberately. The approval step exists so a part worth eight hundred
 * pounds is not ordered by whoever happened to be at the screen, and a form
 * that skipped it would be a form that made the approval step decorative.
 */
export async function createPurchaseOrder(input: {
  orgId: string;
  userId: string;
  supplierId: string;
  expectedAt?: Date | null;
  notes?: string | null;
  lines: readonly OrderLineInput[];
}): Promise<string> {
  assertOrderDraftable({ supplierId: input.supplierId, lines: input.lines });

  const lines = meaningfulLines(input.lines);

  const supplier = await prisma.supplier.findFirst({
    where: { id: input.supplierId, orgId: input.orgId },
    select: { id: true },
  });

  if (!supplier) throw new CatalogueError('NO_SUPPLIER', 'That supplier is not one of yours.');

  // Product lines take their description from the catalogue so the order
  // says what the supplier calls it, and the cost typed on the form wins over
  // the catalogue's, because the quote in front of somebody is newer.
  const products = new Map(
    (
      await prisma.product.findMany({
        where: {
          orgId: input.orgId,
          id: { in: lines.flatMap((l) => (l.productId ? [l.productId] : [])) },
        },
        select: { id: true, partNumber: true, name: true },
      })
    ).map((row) => [row.id, row]),
  );

  const subtotal = lines.reduce((total, line) => total + line.quantity * line.unitCost, 0);

  const order = await prisma.$transaction(async (tx) => {
    const sequence = await tx.documentSequence.upsert({
      where: { orgId_kind: { orgId: input.orgId, kind: 'PURCHASE_ORDER' } },
      create: { orgId: input.orgId, kind: 'PURCHASE_ORDER', prefix: 'PO-', next: 2 },
      update: { next: { increment: 1 } },
    });

    // The upsert returns the row after the increment, so the number just
    // taken is one below it on the update path and 1 on the create path.
    const number = `${sequence.prefix || 'PO-'}${sequence.next - 1}`;

    return tx.purchaseOrder.create({
      data: {
        orgId: input.orgId,
        number,
        supplierId: supplier.id,
        status: 'DRAFT',
        expectedAt: input.expectedAt ?? null,
        notes: input.notes?.trim() || null,
        subtotal: Math.round(subtotal * 100) / 100,
        taxTotal: 0,
        total: Math.round(subtotal * 100) / 100,
        lines: {
          create: lines.map((line, index) => {
            const product = line.productId ? products.get(line.productId) : undefined;
            return {
              productId: product?.id ?? null,
              description:
                line.description.trim() ||
                (product ? `${product.partNumber} ${product.name}` : 'Unnamed line'),
              quantity: line.quantity,
              unitCost: line.unitCost,
              sortOrder: index,
            };
          }),
        },
      },
      select: { id: true, number: true },
    });
  });

  await audit({
    orgId: input.orgId,
    actorUserId: input.userId,
    action: 'purchase_order.created',
    entityType: 'PurchaseOrder',
    entityId: order.id,
    after: { number: order.number, supplierId: supplier.id, lines: lines.length, subtotal },
  });

  return order.id;
}
