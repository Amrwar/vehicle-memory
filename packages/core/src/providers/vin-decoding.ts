import { modelYearFromVin, normaliseVin, validateVin } from '../vehicle/vin';

/**
 * What a VIN says about the car. Phase 43.
 *
 * A decoder is a seam: the product asks one question, "what is this VIN",
 * and whichever decoder the deployment names answers it. The one that always
 * works is built in and reads only what the VIN itself encodes: the maker,
 * from the first three characters, and the model year, from the tenth, when
 * the VIN is of the kind that encodes one. A remote decoder adds the model,
 * engine, fuel and body.
 *
 * Nothing a decoder says is written to a vehicle by itself. It fills in the
 * form; a person reads it against the car in front of them and saves it.
 */

export interface VinDecoding {
  vin: string;
  make: string | null;
  model: string | null;
  year: number | null;
  engine: string | null;
  fuel: string | null;
  body: string | null;
  /** Which decoder answered, as a name a person can read. */
  decoder: string;
  /** Whether the model was named, which is what makes a decode useful. */
  complete: boolean;
}

export interface VinDecoder {
  readonly name: string;
  decode(vin: string): Promise<VinDecoding>;
}

export class VinDecodeError extends Error {
  constructor(
    readonly code: 'BAD_VIN' | 'UNAVAILABLE',
    message: string,
  ) {
    super(message);
    this.name = 'VinDecodeError';
  }
}

/**
 * World Manufacturer Identifiers for the makers a workshop sees most.
 *
 * Deliberately a short table of identifiers that are not in doubt. A maker
 * missing from it decodes as unknown, which the form shows as a blank to
 * fill in; a maker guessed wrongly would be typed into the history of a car.
 */
export const WMI_MAKES: Readonly<Record<string, string>> = {
  // Germany
  WBA: 'BMW',
  WBS: 'BMW',
  WBY: 'BMW',
  WMW: 'MINI',
  WDB: 'Mercedes-Benz',
  WDC: 'Mercedes-Benz',
  WDD: 'Mercedes-Benz',
  WDF: 'Mercedes-Benz',
  W1K: 'Mercedes-Benz',
  W1N: 'Mercedes-Benz',
  W1V: 'Mercedes-Benz',
  WME: 'smart',
  WAU: 'Audi',
  WUA: 'Audi',
  WVW: 'Volkswagen',
  WV1: 'Volkswagen',
  WV2: 'Volkswagen',
  WP0: 'Porsche',
  WP1: 'Porsche',
  W0L: 'Opel',
  W0V: 'Opel',
  WF0: 'Ford',
  // France, Spain, Czechia, Italy, Sweden
  VF1: 'Renault',
  VF3: 'Peugeot',
  VF7: 'Citroën',
  VR3: 'Peugeot',
  VSS: 'SEAT',
  TMB: 'Škoda',
  ZFA: 'Fiat',
  ZAR: 'Alfa Romeo',
  ZFF: 'Ferrari',
  ZHW: 'Lamborghini',
  YV1: 'Volvo',
  YS3: 'Saab',
  // United Kingdom
  SAJ: 'Jaguar',
  SAL: 'Land Rover',
  SCC: 'Lotus',
  SCF: 'Aston Martin',
  SJN: 'Nissan',
  SB1: 'Toyota',
  SHH: 'Honda',
  SHS: 'Honda',
  // Japan and Korea
  JTD: 'Toyota',
  JTE: 'Toyota',
  JTN: 'Toyota',
  JT2: 'Toyota',
  JTH: 'Lexus',
  JHM: 'Honda',
  JN1: 'Nissan',
  JM1: 'Mazda',
  JMZ: 'Mazda',
  JF1: 'Subaru',
  JS3: 'Suzuki',
  JSA: 'Suzuki',
  JMB: 'Mitsubishi',
  KMH: 'Hyundai',
  KNA: 'Kia',
  KND: 'Kia',
  TMA: 'Hyundai',
  U5Y: 'Kia',
  // North America
  '1FA': 'Ford',
  '1FM': 'Ford',
  '1FT': 'Ford',
  '1G1': 'Chevrolet',
  '1GC': 'Chevrolet',
  '1HG': 'Honda',
  '1N4': 'Nissan',
  '2T1': 'Toyota',
  '4T1': 'Toyota',
  '4JG': 'Mercedes-Benz',
  '5UX': 'BMW',
  '5YJ': 'Tesla',
  '3VW': 'Volkswagen',
  '7SA': 'Tesla',
  // China
  LRW: 'Tesla',
  LBV: 'BMW',
  LSJ: 'MG',
  LC0: 'BYD',
};

/** The maker the first three characters name, when the table knows it. */
export function makeFromWmi(vin: string): string | null {
  const wmi = normaliseVin(vin).slice(0, 3);
  return wmi.length === 3 ? (WMI_MAKES[wmi] ?? null) : null;
}

/**
 * Whether the tenth character can be read as a model year.
 *
 * North American VINs must encode it, and a VIN whose check digit adds up is
 * built to that standard. European makers are not required to, and many put
 * something else there, so a year read from one of theirs is left blank
 * rather than filled in wrongly.
 */
export function vinEncodesYear(vin: string): boolean {
  const normalised = normaliseVin(vin);
  const validation = validateVin(normalised);
  if (!validation.wellFormed) return false;
  return /^[1-5]/.test(normalised) || validation.checkDigitValid;
}

/** What the VIN says by itself. Refuses only a VIN that is not a VIN. */
export function decodeLocally(vin: string, referenceYear?: number): VinDecoding {
  const normalised = normaliseVin(vin);
  if (!validateVin(normalised).wellFormed) {
    throw new VinDecodeError('BAD_VIN', 'A VIN is exactly 17 characters, with no I, O or Q.');
  }

  return {
    vin: normalised,
    make: makeFromWmi(normalised),
    model: null,
    year: vinEncodesYear(normalised) ? modelYearFromVin(normalised, referenceYear) : null,
    engine: null,
    fuel: null,
    body: null,
    decoder: 'the built-in reader',
    complete: false,
  };
}

/** The decoder that needs nothing: the maker and year from the VIN alone. */
export const stubVinDecoder: VinDecoder = {
  name: 'the built-in reader',
  decode: async (vin) => decodeLocally(vin),
};

const tidy = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' || trimmed === '0' || /^not applicable$/i.test(trimmed) ? null : trimmed;
};

/** Title case for a maker the registry spells in capitals. */
function titleMake(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 3) return value;
  return value
    .toLowerCase()
    .split(/([\s-])/)
    .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('');
}

/**
 * The answer from the US vehicle registry's public decoder (vPIC), read.
 *
 * Its DecodeVinValues call returns one flat record of strings, empty where it
 * knows nothing. What it knows is laid over what the VIN says by itself, so a
 * record with no maker keeps the one the WMI table named.
 */
export function readVpicDecoding(vin: string, body: unknown, referenceYear?: number): VinDecoding {
  const local = decodeLocally(vin, referenceYear);
  const results = (body as { Results?: unknown[] } | null)?.Results;
  const record = (Array.isArray(results) ? results[0] : null) as Record<string, unknown> | null;

  if (!record) return local;

  const year = Number(tidy(record.ModelYear));
  const litres = tidy(record.DisplacementL);
  const cylinders = tidy(record.EngineCylinders);
  const engineCode = tidy(record.EngineModel);
  const engine =
    [
      litres && Number.isFinite(Number(litres)) ? `${Number(litres).toFixed(1)} L` : null,
      cylinders ? `${cylinders} cyl` : null,
      engineCode,
    ]
      .filter(Boolean)
      .join(' · ') || null;

  const model = tidy(record.Model);

  return {
    vin: local.vin,
    make: local.make ?? titleMake(tidy(record.Make)),
    model,
    year: Number.isInteger(year) && year > 1900 ? year : local.year,
    engine,
    fuel: tidy(record.FuelTypePrimary),
    body: tidy(record.BodyClass),
    decoder: 'NHTSA vPIC',
    complete: model !== null,
  };
}
