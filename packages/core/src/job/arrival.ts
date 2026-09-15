/**
 * Arrival and departure. Phase 35.
 *
 * The two moments a car changes hands: the customer hands it over, and the
 * workshop hands it back. Each is a record of what the car was like at that
 * moment (mileage, fuel, what was already marked, what was left inside,
 * where the keys went) and a signature saying both sides saw the same
 * thing. Most of what a workshop is ever argued with about is settled by
 * one of these two records, which is why they are a record of their own
 * and not a note.
 *
 * The rules are pure: what may be checked in, what may be checked out, what
 * a signature has to be before it counts, and where the keys are given
 * the events that moved them.
 */

export type ArrivalErrorCode =
  | 'CLOSED'
  | 'ALREADY_IN'
  | 'NOT_IN'
  | 'ALREADY_OUT'
  | 'NOT_DONE'
  | 'OWING'
  | 'MILEAGE_BACK'
  | 'BAD_FUEL'
  | 'NO_SIGNATURE'
  | 'NO_NAME'
  | 'NO_HOOK';

export class ArrivalError extends Error {
  readonly code: ArrivalErrorCode;

  constructor(code: ArrivalErrorCode, message: string) {
    super(message);
    this.name = 'ArrivalError';
    this.code = code;
  }
}

/** Fuel in eighths, as the gauge shows it. */
export const FUEL_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;
export type FuelEighths = (typeof FUEL_LEVELS)[number];

export function fuelLabel(eighths: number | null | undefined): string {
  if (eighths === null || eighths === undefined) return 'not noted';
  const labels = ['empty', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞', 'full'];
  return labels[eighths] ?? 'not noted';
}

/**
 * The parts of a car a person walks round and looks at. The list is what
 * the check-in form ticks; a mark that is not on the list goes in the
 * notes. Twelve, because a form with forty boxes is a form nobody fills.
 */
export const DAMAGE_AREAS = [
  'Front bumper',
  'Bonnet',
  'Windscreen',
  'Roof',
  'Driver side',
  'Passenger side',
  'Rear bumper',
  'Boot lid',
  'Wheels and tyres',
  'Lights',
  'Mirrors',
  'Interior',
] as const;

export type DamageArea = (typeof DAMAGE_AREAS)[number];

export interface DamageMark {
  area: DamageArea | string;
  note?: string | null;
}

export interface SignatureStrokes {
  /** Each stroke a list of [x, y] points in the pad's own pixels. */
  strokes: readonly (readonly (readonly [number, number])[])[];
  width: number;
  height: number;
}

/**
 * Whether a signature is a signature and not a dot, a stray touch or an
 * empty pad. Two rules: enough points to be a movement, and a bounding box
 * that is not a speck. Nobody's signature is judged for legibility.
 */
export function signatureIsUsable(input: SignatureStrokes | null | undefined): boolean {
  if (!input || input.width <= 0 || input.height <= 0) return false;
  const points = input.strokes.flat();
  if (points.length < 8) return false;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  return spanX >= input.width * 0.08 && spanY >= input.height * 0.05;
}

/** Statuses in which a car can be checked in: it is here, and the job is open. */
const IN_STATUSES: readonly string[] = [
  'RECEIVED',
  'INSPECTING',
  'DIAGNOSED',
  'ESTIMATED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IN_PROGRESS',
  'QUALITY_CHECK',
];

/** Statuses in which a car can leave: the work is done. */
const OUT_STATUSES: readonly string[] = ['COMPLETED', 'INVOICED', 'PAID'];

export function assertCheckInAllowed(input: {
  jobStatus: string;
  alreadyIn: boolean;
  odometerKm?: number | null;
  lastOdometerKm?: number | null;
  fuelEighths?: number | null;
}): void {
  if (input.alreadyIn) {
    throw new ArrivalError(
      'ALREADY_IN',
      'This car has already been checked in. The record is on the job; add a note if something was missed.',
    );
  }
  if (!IN_STATUSES.includes(input.jobStatus)) {
    throw new ArrivalError(
      'CLOSED',
      'This job is finished, so there is no car to check in. Open a new job for the same car.',
    );
  }
  assertReading(input.odometerKm, input.lastOdometerKm);
  assertFuel(input.fuelEighths);
}

export function assertCheckOutAllowed(input: {
  jobStatus: string;
  checkedIn: boolean;
  alreadyOut: boolean;
  outstandingMinor: number;
  letGoOwingReason?: string | null;
  odometerKm?: number | null;
  odometerInKm?: number | null;
  fuelEighths?: number | null;
}): void {
  if (input.alreadyOut) {
    throw new ArrivalError('ALREADY_OUT', 'This car has already been handed back.');
  }
  if (!OUT_STATUSES.includes(input.jobStatus)) {
    throw new ArrivalError(
      'NOT_DONE',
      'The work is not marked completed yet. Complete the job first, so the customer is handed back a finished car.',
    );
  }
  if (input.outstandingMinor > 0 && !input.letGoOwingReason?.trim()) {
    throw new ArrivalError(
      'OWING',
      'There is money outstanding on this job. Take the payment first, or say why the car is leaving unpaid.',
    );
  }
  assertReading(input.odometerKm, input.odometerInKm);
  assertFuel(input.fuelEighths);
}

function assertReading(reading: number | null | undefined, floor: number | null | undefined) {
  if (reading === null || reading === undefined) return;
  if (!Number.isInteger(reading) || reading < 0) {
    throw new ArrivalError('MILEAGE_BACK', 'The mileage has to be a whole number of kilometres.');
  }
  if (floor !== null && floor !== undefined && reading < floor) {
    throw new ArrivalError(
      'MILEAGE_BACK',
      `The last reading was ${floor.toLocaleString()} km. ${reading.toLocaleString()} is lower, so one of the two is wrong.`,
    );
  }
}

function assertFuel(fuel: number | null | undefined) {
  if (fuel === null || fuel === undefined) return;
  if (!Number.isInteger(fuel) || fuel < 0 || fuel > 8) {
    throw new ArrivalError('BAD_FUEL', 'Fuel is noted in eighths, from empty to full.');
  }
}

/** A signature and the name it was given under, checked together. */
export function assertSigned(input: {
  signature: SignatureStrokes | null | undefined;
  name: string | null | undefined;
}): void {
  if (!signatureIsUsable(input.signature)) {
    throw new ArrivalError(
      'NO_SIGNATURE',
      'Sign on the pad. A dot or an empty pad is not a signature.',
    );
  }
  if (!input.name?.trim()) {
    throw new ArrivalError('NO_NAME', 'Say who signed.');
  }
}

/* ---------------------------------------------------------------------------
   Keys
   --------------------------------------------------------------------------- */

export type KeyAction = 'HUNG' | 'TAKEN' | 'RETURNED' | 'HANDED_TO_CUSTOMER';

export interface KeyEvent {
  action: KeyAction;
  hook?: string | null;
  byName?: string | null;
  at: Date;
}

export interface KeyState {
  where: 'hook' | 'with' | 'customer' | 'unknown';
  hook: string | null;
  holder: string | null;
  since: Date | null;
  /** One sentence for the job card. */
  sentence: string;
}

/**
 * Where the keys are, from the events that moved them. The latest event
 * wins; a hook remembered from the last hanging is carried through a
 * taking, so "returned" can put them back where they were.
 */
export function keyState(events: readonly KeyEvent[]): KeyState {
  let hook: string | null = null;
  let state: KeyState = {
    where: 'unknown',
    hook: null,
    holder: null,
    since: null,
    sentence: 'Keys not recorded.',
  };
  const ordered = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
  for (const event of ordered) {
    if (event.action === 'HUNG' || event.action === 'RETURNED') {
      hook = event.hook?.trim() || hook;
      state = {
        where: 'hook',
        hook,
        holder: null,
        since: event.at,
        sentence: hook ? `Keys on hook ${hook}.` : 'Keys hung up, hook not noted.',
      };
    } else if (event.action === 'TAKEN') {
      state = {
        where: 'with',
        hook,
        holder: event.byName ?? null,
        since: event.at,
        sentence: event.byName ? `Keys with ${event.byName}.` : 'Keys taken, by whom not noted.',
      };
    } else if (event.action === 'HANDED_TO_CUSTOMER') {
      state = {
        where: 'customer',
        hook,
        holder: null,
        since: event.at,
        sentence: 'Keys handed back to the customer.',
      };
    }
  }
  return state;
}

/** What a key movement needs before it is recorded. */
export function assertKeyMove(input: {
  action: KeyAction;
  hook?: string | null;
  current: KeyState;
}): void {
  if (input.action === 'HUNG' && !input.hook?.trim() && !input.current.hook) {
    throw new ArrivalError('NO_HOOK', 'Say which hook the keys are on.');
  }
  if (input.action === 'TAKEN' && input.current.where === 'customer') {
    throw new ArrivalError(
      'NOT_IN',
      'The keys went back to the customer; there is nothing to take.',
    );
  }
}
