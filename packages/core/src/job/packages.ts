/**
 * Service packages. Phase 37.
 *
 * A package is a piece of work priced and described as one thing: the
 * labour, the parts, the checklist, how long it takes, what it costs and
 * how often it comes round. A job made from a package starts with all of
 * that on it, which is the difference between "Full service" typed at the
 * counter and a job a technician can pick up without asking.
 *
 * The rules are pure: what a package has to have before it is saved, what
 * it comes to, what its lines become on a job, and when the next one is
 * due.
 */

export type PackageErrorCode =
  'NO_NAME' | 'NO_CODE' | 'NO_LINES' | 'BAD_LINE' | 'BAD_PRICE' | 'BAD_DURATION' | 'BAD_INTERVAL';

export class PackageError extends Error {
  readonly code: PackageErrorCode;

  constructor(code: PackageErrorCode, message: string) {
    super(message);
    this.name = 'PackageError';
    this.code = code;
  }
}

export type PackageLineKind = 'LABOUR' | 'PART' | 'FEE';

export interface PackageLine {
  kind: PackageLineKind;
  description: string;
  /** Hours for labour, units for a part, 1 for a fee. */
  quantity: number;
  /** The rate for labour, the unit price for a part, the amount for a fee. */
  unitPrice: number;
  productId?: string | null;
}

export interface PackageCheck {
  title: string;
  detail?: string | null;
}

export interface PackageShape {
  code: string;
  name: string;
  durationMinutes: number;
  /** A fixed price for the whole package; null means the lines add up. */
  price: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
  lines: readonly PackageLine[];
  checks: readonly PackageCheck[];
}

/** What the lines come to, and what the package is sold at. */
export function packageTotal(input: { lines: readonly PackageLine[]; price: number | null }) {
  const linesTotal = round2(
    input.lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0),
  );
  const price = input.price === null ? linesTotal : round2(input.price);
  return {
    linesTotal,
    price,
    /** Positive when the fixed price undercuts the lines: the customer's saving. */
    saving: round2(linesTotal - price),
    fixed: input.price !== null,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function assertPackageSound(input: PackageShape): void {
  if (!input.name.trim()) throw new PackageError('NO_NAME', 'Give the package a name.');
  if (!input.code.trim()) throw new PackageError('NO_CODE', 'Give the package a short code.');
  if (input.lines.length === 0) {
    throw new PackageError(
      'NO_LINES',
      'A package needs at least one line of labour, parts or fees.',
    );
  }
  for (const line of input.lines) {
    if (!line.description.trim()) {
      throw new PackageError('BAD_LINE', 'Every line needs a description.');
    }
    if (!(line.quantity > 0) || !Number.isFinite(line.quantity)) {
      throw new PackageError('BAD_LINE', `"${line.description}" needs a quantity above zero.`);
    }
    if (line.unitPrice < 0 || !Number.isFinite(line.unitPrice)) {
      throw new PackageError('BAD_LINE', `"${line.description}" cannot have a negative price.`);
    }
  }
  if (input.price !== null && (input.price < 0 || !Number.isFinite(input.price))) {
    throw new PackageError('BAD_PRICE', 'A fixed price cannot be negative.');
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes <= 0) {
    throw new PackageError('BAD_DURATION', 'Say how long the package takes, in minutes.');
  }
  for (const interval of [input.intervalMonths, input.intervalKm]) {
    if (interval !== null && (!Number.isInteger(interval) || interval <= 0)) {
      throw new PackageError(
        'BAD_INTERVAL',
        'An interval is a whole number of months or kilometres.',
      );
    }
  }
}

/** The package's lines as the three kinds of line a job carries. */
export function jobLinesFromPackage(lines: readonly PackageLine[]) {
  const labour: { description: string; hours: number; rate: number }[] = [];
  const parts: {
    description: string;
    quantity: number;
    unitPrice: number;
    productId: string | null;
  }[] = [];
  const fees: { description: string; amount: number }[] = [];
  for (const line of lines) {
    if (line.kind === 'LABOUR') {
      labour.push({ description: line.description, hours: line.quantity, rate: line.unitPrice });
    } else if (line.kind === 'PART') {
      parts.push({
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        productId: line.productId ?? null,
      });
    } else {
      fees.push({ description: line.description, amount: round2(line.quantity * line.unitPrice) });
    }
  }
  return { labour, parts, fees };
}

/** Hours of labour on the package, for the diary. */
export function packageHours(input: { durationMinutes: number }): number {
  return Math.max(0.25, Math.round((input.durationMinutes / 60) * 4) / 4);
}

/**
 * When the next one is due, from when and at what mileage this one was
 * done. Whichever comes first, date or distance, is what the reminder
 * goes on; a package with no interval is not a recurring one.
 */
export function nextServiceFrom(input: {
  completedAt: Date;
  odometerKm: number | null;
  intervalMonths: number | null;
  intervalKm: number | null;
}): { dueAt: Date | null; dueKm: number | null } | null {
  if (input.intervalMonths === null && input.intervalKm === null) return null;
  const dueAt = input.intervalMonths
    ? new Date(
        Date.UTC(
          input.completedAt.getUTCFullYear(),
          input.completedAt.getUTCMonth() + input.intervalMonths,
          input.completedAt.getUTCDate(),
        ),
      )
    : null;
  const dueKm =
    input.intervalKm && input.odometerKm !== null ? input.odometerKm + input.intervalKm : null;
  return { dueAt, dueKm };
}

/** One line for a menu: the name, the time, the price. */
export function packageSummary(input: {
  name: string;
  durationMinutes: number;
  priceText: string;
}): string {
  const hours = packageHours(input);
  return `${input.name}, about ${hours} hour${hours === 1 ? '' : 's'}, ${input.priceText}`;
}
