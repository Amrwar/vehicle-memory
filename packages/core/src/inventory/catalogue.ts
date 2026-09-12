/**
 * Adding to the parts catalogue, and raising an order by hand.
 *
 * Both are things a workshop does dozens of times a week and both, until now,
 * had a button on the page and nothing behind it. The rules here are the ones
 * whose absence corrupts numbers rather than merely producing an ugly record:
 * a part number that is not unique fragments stock across two rows; a cost of
 * zero flatters the margin on every job that uses the part; an order with no
 * lines costs the supplier a telephone call.
 */

export class CatalogueError extends Error {
  constructor(
    readonly code:
      | 'NO_PART_NUMBER'
      | 'NO_NAME'
      | 'BAD_PRICE'
      | 'DUPLICATE_PART'
      | 'NO_SUPPLIER'
      | 'NO_LINES'
      | 'BAD_LINE',
    message: string,
  ) {
    super(message);
    this.name = 'CatalogueError';
  }
}

/**
 * A part number as the catalogue stores it.
 *
 * Suppliers print them in every case and spacing imaginable, and the same part
 * typed with a space in it becomes a second product with its own stock. Case
 * and whitespace are removed; hyphens are kept, because "BP-1042" and
 * "BP1042" can genuinely be different parts from different makers.
 */
export function normalisePartNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export interface ProductDetails {
  partNumber: string;
  name: string;
  brand?: string | null;
  unit?: string | null;
  costPrice: number;
  sellPrice: number;
  reorderPoint?: number | null;
  reorderQty?: number | null;
  isStocked?: boolean;
}

/** Whether a part can go into the catalogue at all. */
export function assertProductSaveable(details: ProductDetails): void {
  if (!normalisePartNumber(details.partNumber)) {
    throw new CatalogueError(
      'NO_PART_NUMBER',
      'A part number. It is how the part is found when the box is in your hand.',
    );
  }

  if (!details.name.trim()) {
    throw new CatalogueError('NO_NAME', 'A name that a customer would understand on an invoice.');
  }

  for (const [label, value] of [
    ['cost', details.costPrice],
    ['sell price', details.sellPrice],
    ['reorder point', details.reorderPoint ?? 0],
    ['reorder quantity', details.reorderQty ?? 0],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new CatalogueError('BAD_PRICE', `The ${label} has to be a number, and not below zero.`);
    }
  }
}

/**
 * What is worth saying about the prices before they are saved.
 *
 * Not a refusal. Selling below cost is a decision a workshop is entitled to
 * make on a loss-leader or a goodwill job. It is also, far more often, a
 * typo, and the moment to mention it is now rather than at the month-end
 * margin report.
 */
export function priceWarning(
  details: Pick<ProductDetails, 'costPrice' | 'sellPrice'>,
): string | null {
  if (details.costPrice === 0 && details.sellPrice > 0) {
    return 'The cost is zero, so every job using this part will show its full price as profit. Fill it in when the first invoice arrives if you do not know it yet.';
  }

  if (details.sellPrice > 0 && details.sellPrice < details.costPrice) {
    return 'The sell price is below the cost. Fine if that is deliberate; worth a second look if it is not.';
  }

  return null;
}

export interface OrderLineInput {
  productId?: string | null;
  description: string;
  quantity: number;
  unitCost: number;
}

/** Whether a hand-raised order can be saved as a draft. */
export function assertOrderDraftable(input: {
  supplierId: string;
  lines: readonly OrderLineInput[];
}): void {
  if (!input.supplierId) {
    throw new CatalogueError('NO_SUPPLIER', 'Choose who the order is going to.');
  }

  const real = input.lines.filter((line) => line.description.trim() || line.productId);

  if (real.length === 0) {
    throw new CatalogueError('NO_LINES', 'An order with nothing on it. Add at least one line.');
  }

  for (const line of real) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      throw new CatalogueError(
        'BAD_LINE',
        `"${line.description || 'A line'}" needs a quantity above zero.`,
      );
    }

    if (!Number.isFinite(line.unitCost) || line.unitCost < 0) {
      throw new CatalogueError(
        'BAD_LINE',
        `"${line.description || 'A line'}" has a unit cost that is not a number, or is below zero.`,
      );
    }
  }
}

/** The lines somebody actually filled in, in the order they wrote them. */
export function meaningfulLines(lines: readonly OrderLineInput[]): OrderLineInput[] {
  return lines.filter((line) => line.description.trim() || line.productId);
}
