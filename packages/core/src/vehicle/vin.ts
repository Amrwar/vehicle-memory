/**
 * VIN handling.
 *
 * The VIN is the primary key of the entire product: it is what makes a
 * history portable, because it is the one identifier that does not change
 * when the car is sold, re-registered or exported.
 *
 * The check digit is validated, but a failure never blocks entry (FR-304).
 * Pre-1981 vehicles, grey imports and several non-North-American
 * manufacturers produce VINs that do not conform. Refusing them would exclude
 * exactly the older vehicles whose history is most valuable, so we warn and
 * record the fact instead.
 */

const VIN_LENGTH = 17;

/** I, O and Q are excluded from VINs to avoid confusion with 1 and 0. */
const INVALID_LETTERS = /[IOQ]/;
const VALID_CHARACTERS = /^[A-HJ-NPR-Z0-9]{17}$/;

/** Transliteration table defined by ISO 3779 / FMVSS 115. */
const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
  '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
};

const POSITION_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export type VinProblem =
  | 'EMPTY'
  | 'WRONG_LENGTH'
  | 'INVALID_CHARACTER'
  | 'FORBIDDEN_LETTER'
  | 'CHECK_DIGIT_MISMATCH';

export interface VinValidation {
  /** Uppercased, whitespace and hyphens stripped. */
  normalised: string;
  /** Structurally a VIN: 17 valid characters. */
  wellFormed: boolean;
  /** Check digit agrees. False is a warning, not a rejection. */
  checkDigitValid: boolean;
  problems: VinProblem[];
  /** True when the VIN may be stored, i.e. it is structurally sound. */
  acceptable: boolean;
}

export function normaliseVin(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase();
}

export function validateVin(input: string): VinValidation {
  const normalised = normaliseVin(input ?? '');
  const problems: VinProblem[] = [];

  if (normalised.length === 0) {
    return {
      normalised,
      wellFormed: false,
      checkDigitValid: false,
      problems: ['EMPTY'],
      acceptable: false,
    };
  }

  if (normalised.length !== VIN_LENGTH) {
    problems.push('WRONG_LENGTH');
  }

  if (INVALID_LETTERS.test(normalised)) {
    problems.push('FORBIDDEN_LETTER');
  }

  if (!VALID_CHARACTERS.test(normalised) && !problems.includes('WRONG_LENGTH')) {
    problems.push('INVALID_CHARACTER');
  }

  const wellFormed = problems.length === 0;
  const checkDigitValid = wellFormed ? verifyCheckDigit(normalised) : false;

  if (wellFormed && !checkDigitValid) {
    problems.push('CHECK_DIGIT_MISMATCH');
  }

  return {
    normalised,
    wellFormed,
    checkDigitValid,
    problems,
    // Structurally sound VINs are stored even when the check digit disagrees.
    acceptable: wellFormed,
  };
}

export function verifyCheckDigit(vin: string): boolean {
  const expected = computeCheckDigit(vin);
  return expected !== null && expected === vin[8];
}

export function computeCheckDigit(vin: string): string | null {
  if (vin.length !== VIN_LENGTH) return null;

  let total = 0;
  for (let i = 0; i < VIN_LENGTH; i += 1) {
    const character = vin[i];
    if (character === undefined) return null;

    const value = TRANSLITERATION[character];
    if (value === undefined) return null;

    total += value * (POSITION_WEIGHTS[i] ?? 0);
  }

  const remainder = total % 11;
  return remainder === 10 ? 'X' : String(remainder);
}

/**
 * The World Manufacturer Identifier: first three characters. Useful for
 * grouping and for a coarse manufacturer guess before a decode service is
 * consulted.
 */
export function worldManufacturerId(vin: string): string | null {
  const normalised = normaliseVin(vin);
  return normalised.length >= 3 ? normalised.slice(0, 3) : null;
}

/**
 * Model year from position 10. The code repeats on a 30-year cycle, so the
 * result is disambiguated using the current year: a 'K' read in 2026 means
 * 2019, not 1989.
 */
export function modelYearFromVin(vin: string, referenceYear = new Date().getUTCFullYear()): number | null {
  const normalised = normaliseVin(vin);
  if (normalised.length !== VIN_LENGTH) return null;

  const code = normalised[9];
  if (!code) return null;

  const YEAR_CODES = 'ABCDEFGHJKLMNPRSTVWXY123456789';
  const index = YEAR_CODES.indexOf(code);
  if (index === -1) return null;

  // The cycle began in 1980 with 'A'.
  let year = 1980 + index;
  while (year + 30 <= referenceYear + 1) {
    year += 30;
  }

  return year;
}

/**
 * Formats a VIN for display in groups, which makes it far easier to read
 * aloud or compare against a windscreen plate. Rendered in a monospaced face
 * by the design system for the same reason.
 */
export function formatVin(vin: string): string {
  const normalised = normaliseVin(vin);
  if (normalised.length !== VIN_LENGTH) return normalised;
  return `${normalised.slice(0, 3)} ${normalised.slice(3, 9)} ${normalised.slice(9)}`;
}

export function describeVinProblem(problem: VinProblem): string {
  switch (problem) {
    case 'EMPTY':
      return 'Enter a VIN.';
    case 'WRONG_LENGTH':
      return 'A VIN is 17 characters long.';
    case 'INVALID_CHARACTER':
      return 'A VIN contains only letters and digits.';
    case 'FORBIDDEN_LETTER':
      return 'A VIN never contains the letters I, O or Q.';
    case 'CHECK_DIGIT_MISMATCH':
      return 'The check digit does not match. This is common on older and imported vehicles, so the VIN can still be saved.';
  }
}
