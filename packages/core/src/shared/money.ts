/**
 * Money.
 *
 * Represented as an integer number of minor units (pence, cents) with an
 * explicit currency. Floating point is not used anywhere in this module,
 * because 0.1 + 0.2 !== 0.3 and an invoice that is a penny out is a defect a
 * bookkeeper will find and never forget (persona P6).
 *
 * Rounding is half-away-from-zero, which is what tax authorities and
 * accountants expect. Banker's rounding is defensible statistically and
 * indefensible when a customer checks the arithmetic on the counter.
 */

export type Currency = string;

export interface Money {
  /** Integer minor units. 1_408_00 is £1,408.00 when currency is GBP. */
  readonly minor: number;
  readonly currency: Currency;
}

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** Minor units per major unit. Extend as currencies are added. */
const MINOR_UNITS: Record<string, number> = {
  GBP: 100,
  EUR: 100,
  USD: 100,
  AUD: 100,
  AED: 100,
  EGP: 100,
  JPY: 1,
  KWD: 1000,
  BHD: 1000,
};

export function minorUnitsFor(currency: Currency): number {
  return MINOR_UNITS[currency.toUpperCase()] ?? 100;
}

export function money(minor: number, currency: Currency = 'GBP'): Money {
  if (!Number.isInteger(minor)) {
    throw new MoneyError(`Money must be whole minor units, received ${minor}`);
  }
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyError(`Money amount ${minor} exceeds safe integer range`);
  }
  return { minor, currency: currency.toUpperCase() };
}

export const zero = (currency: Currency = 'GBP'): Money => money(0, currency);

/**
 * Builds Money from a decimal string or number. Strings are parsed digit by
 * digit rather than via parseFloat, so "1408.005" does not silently become
 * 1408.00499999.
 */
export function fromDecimal(value: string | number, currency: Currency = 'GBP'): Money {
  const scale = minorUnitsFor(currency);
  const text = typeof value === 'number' ? value.toFixed(scaleDigits(scale) + 2) : value.trim();

  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    throw new MoneyError(`"${value}" is not a valid decimal amount`);
  }

  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = text.replace('-', '').split('.');
  const digits = scaleDigits(scale);

  const padded = (fraction + '0'.repeat(digits + 1)).slice(0, digits + 1);
  const truncated = padded.slice(0, digits);
  const nextDigit = Number(padded[digits] ?? '0');

  let minor = Number(whole) * scale + Number(truncated || '0');
  if (nextDigit >= 5) minor += 1;

  return money(negative ? -minor : minor, currency);
}

function scaleDigits(scale: number): number {
  return Math.round(Math.log10(scale));
}

export function toDecimalString(value: Money): string {
  const scale = minorUnitsFor(value.currency);
  const digits = scaleDigits(scale);
  const negative = value.minor < 0;
  const abs = Math.abs(value.minor);
  const whole = Math.floor(abs / scale);
  const fraction = abs % scale;
  const body = digits === 0 ? `${whole}` : `${whole}.${String(fraction).padStart(digits, '0')}`;
  return negative ? `-${body}` : body;
}

export function toNumber(value: Money): number {
  return value.minor / minorUnitsFor(value.currency);
}

function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`Cannot combine ${a.currency} with ${b.currency}`);
  }
}

export function add(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor + b.minor, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return money(a.minor - b.minor, a.currency);
}

export function sum(values: readonly Money[], currency: Currency = 'GBP'): Money {
  return values.reduce((acc, value) => add(acc, value), zero(currency));
}

export function negate(value: Money): Money {
  return money(-value.minor, value.currency);
}

/** Multiplies by a quantity or rate, rounding half away from zero. */
export function multiply(value: Money, factor: number): Money {
  if (!Number.isFinite(factor)) {
    throw new MoneyError(`Cannot multiply money by ${factor}`);
  }
  return money(roundHalfAway(value.minor * factor), value.currency);
}

/** Applies a percentage, e.g. `percentOf(total, 20)` for 20% VAT. */
export function percentOf(value: Money, percent: number): Money {
  return multiply(value, percent / 100);
}

export function isZero(value: Money): boolean {
  return value.minor === 0;
}

export function isNegative(value: Money): boolean {
  return value.minor < 0;
}

export function compare(a: Money, b: Money): number {
  assertSameCurrency(a, b);
  return a.minor === b.minor ? 0 : a.minor < b.minor ? -1 : 1;
}

export function equals(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.minor === b.minor;
}

export function max(a: Money, b: Money): Money {
  return compare(a, b) >= 0 ? a : b;
}

export function min(a: Money, b: Money): Money {
  return compare(a, b) <= 0 ? a : b;
}

/**
 * Splits an amount into n parts that sum exactly to the original. The
 * remainder is distributed one minor unit at a time from the first part, so
 * splitting 100p three ways gives 34p, 33p, 33p rather than three 33p parts
 * and a lost penny.
 */
export function allocate(value: Money, parts: number): Money[] {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new MoneyError(`Cannot allocate into ${parts} parts`);
  }
  const base = Math.trunc(value.minor / parts);
  let remainder = value.minor - base * parts;
  const step = remainder < 0 ? -1 : 1;

  return Array.from({ length: parts }, () => {
    let share = base;
    if (remainder !== 0) {
      share += step;
      remainder -= step;
    }
    return money(share, value.currency);
  });
}

/**
 * Distributes an amount across weights, preserving the total exactly. Used to
 * apportion an order-level discount across lines, and to split the passport
 * revenue share across contributing workshops.
 */
export function allocateByWeights(value: Money, weights: readonly number[]): Money[] {
  if (weights.length === 0) return [];
  const total = weights.reduce((a, b) => a + b, 0);

  if (total <= 0) {
    return allocate(value, weights.length);
  }

  const raw = weights.map((weight) => Math.trunc((value.minor * weight) / total));
  let remainder = value.minor - raw.reduce((a, b) => a + b, 0);
  const step = remainder < 0 ? -1 : 1;

  // Give the remaining units to the largest weights first, which is the
  // convention that produces the least surprising result.
  const order = weights
    .map((weight, index) => ({ weight, index }))
    .sort((a, b) => b.weight - a.weight);

  for (const { index } of order) {
    if (remainder === 0) break;
    raw[index] = (raw[index] ?? 0) + step;
    remainder -= step;
  }

  return raw.map((minor) => money(minor, value.currency));
}

function roundHalfAway(value: number): number {
  // Guard against binary representation error before rounding: 2.675 * 100 is
  // 267.49999999999997 in IEEE 754, which would round down incorrectly.
  const corrected = Number(value.toFixed(8));
  return corrected < 0 ? -Math.round(-corrected) : Math.round(corrected);
}

export function formatMoney(
  value: Money,
  locale = 'en-GB',
  options: Intl.NumberFormatOptions = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: value.currency,
    ...options,
  }).format(toNumber(value));
}
