/**
 * The network: a vehicle's history seen from a workshop that did not write it.
 *
 * This is the thing that is different from workshop software. A customer
 * moves garages and the passport goes with the car; the second workshop sees
 * that history exists and continues the record rather than starting one.
 * Everything before this phase has been building the conditions for it.
 *
 * Two rules make it safe to build on. Another workshop's commercial detail is
 * withheld: what was charged, what the job was called internally, who did the
 * work. And nothing about the vehicle itself is withheld: what was fitted,
 * when, at what mileage, and whether it was examined. The car's history is the
 * car's; the garage's margins are the garage's.
 */

export interface NetworkEvent {
  id: string;
  type: string;
  title: string;
  summary: string | null;
  occurredAt: Date;
  odometerKm: number | null;
  verification: string;
  recordedByOrgId: string | null;
  recordedByOrgName: string | null;
  payload: Record<string, unknown> | null;
}

/**
 * Payload keys that are one workshop's business and not the next one's.
 *
 * Job identifiers point at records the reader cannot open. Named staff are
 * people who did not consent to be listed in another company's screens.
 */
export const WITHHELD_KEYS: readonly string[] = [
  'jobId',
  'jobNumber',
  'performedBy',
  'inspectionId',
];

/** What another workshop may see of an event's payload. */
export function redactForNetwork(
  payload: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!payload) return null;

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (WITHHELD_KEYS.includes(key)) continue;
    safe[key] = value;
  }
  return safe;
}

export interface NetworkSummary {
  /** Entries recorded by this workshop. */
  ownEntries: number;
  /** Entries recorded by anybody else. */
  otherEntries: number;
  /** Other workshops that have recorded on this vehicle, by name, oldest first. */
  otherWorkshops: string[];
  firstEntry: Date | null;
  lastEntry: Date | null;
  lastOdometerKm: number | null;
  /** One sentence for the top of the page. */
  statement: string;
}

/**
 * What a workshop is told about a vehicle's history before it touches it.
 *
 * Counts and names, not contents. Enough to know the record exists and who
 * has been keeping it; the entries themselves come once the vehicle is on the
 * ramp and the workshop has a reason to read them.
 */
export function summariseNetwork(
  events: readonly NetworkEvent[],
  viewingOrgId: string,
): NetworkSummary {
  const sorted = [...events].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  const own = sorted.filter((event) => event.recordedByOrgId === viewingOrgId);
  const others = sorted.filter((event) => event.recordedByOrgId !== viewingOrgId);

  const names: string[] = [];
  for (const event of others) {
    const name = event.recordedByOrgName ?? 'another workshop';
    if (!names.includes(name)) names.push(name);
  }

  const withKm = [...sorted].reverse().find((event) => event.odometerKm !== null);

  return {
    ownEntries: own.length,
    otherEntries: others.length,
    otherWorkshops: names,
    firstEntry: sorted[0]?.occurredAt ?? null,
    lastEntry: sorted[sorted.length - 1]?.occurredAt ?? null,
    lastOdometerKm: withKm?.odometerKm ?? null,
    statement: statementFor(
      own.length,
      others.length,
      names,
      sorted[sorted.length - 1]?.occurredAt ?? null,
    ),
  };
}

function statementFor(own: number, others: number, names: string[], last: Date | null): string {
  if (own === 0 && others === 0) {
    return 'No history on this vehicle yet. What you record here starts it.';
  }

  const when = last
    ? `, most recently ${last.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
    : '';

  if (others === 0) {
    return `${own} entr${own === 1 ? 'y' : 'ies'} on this vehicle, all recorded here${when}.`;
  }

  const who =
    names.length === 1
      ? names[0]
      : names.length === 2
        ? `${names[0]} and ${names[1]}`
        : `${names.length} other workshops`;

  if (own === 0) {
    return `${others} entr${others === 1 ? 'y' : 'ies'} on this vehicle, recorded by ${who}${when}. Their commercial detail is withheld; the car's history is not. What you record continues it.`;
  }

  return `${own + others} entries on this vehicle: ${own} recorded here and ${others} by ${who}${when}. Their commercial detail is withheld.`;
}

/** Whether a workshop that has never seen the vehicle may take it on. */
export function assertAdoptable(input: {
  vehicleExists: boolean;
  alreadyServicedHere: boolean;
}): void {
  if (!input.vehicleExists) {
    throw new NetworkError(
      'NO_VEHICLE',
      'No vehicle with that identifier is on the network yet. Add it, and its history starts with you.',
    );
  }

  if (input.alreadyServicedHere) {
    throw new NetworkError('ALREADY_HERE', 'This vehicle is already on your books.');
  }
}

export class NetworkError extends Error {
  constructor(
    readonly code: 'NO_VEHICLE' | 'ALREADY_HERE' | 'BAD_IDENTIFIER' | 'BAD_VIN' | 'VIN_TAKEN',
    message: string,
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}
