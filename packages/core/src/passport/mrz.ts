/**
 * The machine-readable zone at the foot of the passport's identity page.
 *
 * Two lines of forty-four characters, the shape ICAO 9303 gives a travel
 * document, with the same 7-3-1 check digits. Not because a machine reads it
 * (none does yet), but because the zone is what makes a page read as a
 * passport rather than a card with a picture on it, and a made-up zone that
 * did not check would be an ornament. This one checks.
 *
 *   Line 1  P<CNT + make, model, year as the name field, < padded
 *   Line 2  VIN(17) CD  registration(9) CD  first registered YYMMDD CD  owners(2) entries(4) <  composite CD
 */

const FILLER = '<';
const WIDTH = 44;

/** A to Z, 0 to 9 and the filler; everything else becomes the filler. */
export function mrzClean(value: string | null | undefined): string {
  return (value ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, FILLER);
}

function pad(value: string, width: number): string {
  return value.slice(0, width).padEnd(width, FILLER);
}

/** The ICAO 9303 check digit: weights 7, 3, 1 repeating; < is 0, letters are 10 to 35. */
export function mrzCheckDigit(field: string): string {
  const weights = [7, 3, 1];
  let sum = 0;
  for (let i = 0; i < field.length; i += 1) {
    const char = field[i]!;
    const value = char === FILLER ? 0 : /[0-9]/.test(char) ? Number(char) : char.charCodeAt(0) - 55;
    sum += value * weights[i % 3]!;
  }
  return String(sum % 10);
}

export interface MrzVehicle {
  vin: string;
  registration: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  firstRegisteredAt: Date | null;
  owners: number;
  entries: number;
}

export function mrzLines(vehicle: MrzVehicle): [string, string] {
  const name = [vehicle.make, vehicle.model, vehicle.year ? String(vehicle.year) : null]
    .filter(Boolean)
    .map((part) => mrzClean(String(part)))
    .join(FILLER + FILLER);
  const line1 = pad(`P${FILLER}CNT${name}`, WIDTH);

  const vin = pad(mrzClean(vehicle.vin), 17);
  const registration = pad(mrzClean(vehicle.registration), 9);
  const first = vehicle.firstRegisteredAt
    ? [
        String(vehicle.firstRegisteredAt.getFullYear()).slice(2),
        String(vehicle.firstRegisteredAt.getMonth() + 1).padStart(2, '0'),
        String(vehicle.firstRegisteredAt.getDate()).padStart(2, '0'),
      ].join('')
    : FILLER.repeat(6);
  const owners = String(Math.min(99, vehicle.owners)).padStart(2, '0');
  const entries = String(Math.min(9999, vehicle.entries)).padStart(4, '0');

  const body =
    vin +
    mrzCheckDigit(vin) +
    registration +
    mrzCheckDigit(registration) +
    first +
    mrzCheckDigit(first) +
    owners +
    entries +
    FILLER;
  const composite = mrzCheckDigit(body);
  const line2 = pad(body + composite, WIDTH);

  return [line1, line2];
}

/** True when every check digit on the second line agrees with its field. */
export function mrzVerify(line2: string): boolean {
  if (line2.length !== WIDTH) return false;
  const vin = line2.slice(0, 17);
  const registration = line2.slice(18, 27);
  const first = line2.slice(28, 34);
  const body = line2.slice(0, 42);
  return (
    line2[17] === mrzCheckDigit(vin) &&
    line2[27] === mrzCheckDigit(registration) &&
    line2[34] === mrzCheckDigit(first) &&
    line2[42] === mrzCheckDigit(body)
  );
}
