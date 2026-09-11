/**
 * Selling a car, as a thing the product does rather than a thing that happens
 * to it.
 *
 * The vehicle's history is the asset. It was built by workshops, paid for by
 * owners, and it is worth something precisely because it survives the sale.
 * What must not survive the sale is the previous owner: their name, their
 * address, their telephone number and the fact that they declined a repair in
 * March are theirs, not the car's.
 *
 * So a transfer is two separate operations that have to happen together. The
 * outgoing ownership is closed and the incoming one opened, and the record is
 * repartitioned: everything about the vehicle stays, everything about the
 * person goes with them.
 *
 * The rules below are the ones that are easy to get wrong in a hurry and
 * expensive to get wrong at all.
 */

export class OwnershipError extends Error {
  constructor(
    readonly code:
      'NO_OWNER' | 'SAME_OWNER' | 'BEFORE_PURCHASE' | 'IN_THE_FUTURE' | 'NO_NAME' | 'OPEN_WORK',
    message: string,
  ) {
    super(message);
    this.name = 'OwnershipError';
  }
}

/** The kinds the database records. Kept in step with the `OwnerKind` enum. */
export type OwnerKind = 'PRIVATE' | 'COMPANY' | 'FLEET' | 'DEALER' | 'FINANCE';

export interface Ownership {
  id: string;
  ownerName: string | null;
  ownerKind: OwnerKind;
  startedAt: Date;
  endedAt: Date | null;
}

export interface TransferRequest {
  /** The ownership being closed. */
  current: Ownership | null;
  toName: string;
  toKind: OwnerKind;
  on: Date;
  /** Work still open on the vehicle at this workshop. */
  openJobs: number;
  /** Whether whoever is doing this has said to go ahead anyway. */
  force?: boolean;
  now?: Date;
}

/**
 * Whether this transfer can be recorded, and why not when it cannot.
 *
 * Every refusal names something the person can fix. A refusal that only says
 * "invalid" teaches somebody to try the same thing again in a minute.
 */
export function assertTransferable(request: TransferRequest): void {
  const now = request.now ?? new Date();
  const name = request.toName.trim();

  if (!name) {
    throw new OwnershipError(
      'NO_NAME',
      'Say who the vehicle is going to. A transfer with nobody on the other end is a deleted owner, not a sale.',
    );
  }

  if (!request.current) {
    throw new OwnershipError(
      'NO_OWNER',
      'This vehicle has no current owner on record, so there is nobody to transfer it from. Record an owner first.',
    );
  }

  if (
    request.current.ownerName &&
    request.current.ownerName.trim().toLowerCase() === name.toLowerCase()
  ) {
    throw new OwnershipError(
      'SAME_OWNER',
      'That is the same owner. Correct the name on the existing record instead of transferring to it.',
    );
  }

  if (request.on < request.current.startedAt) {
    throw new OwnershipError(
      'BEFORE_PURCHASE',
      'The sale cannot be dated before the current owner bought it. One of the two dates is wrong.',
    );
  }

  // A day's grace, because somebody recording yesterday's sale this morning in
  // a different timezone is not doing anything wrong.
  if (request.on.getTime() > now.getTime() + 86_400_000) {
    throw new OwnershipError(
      'IN_THE_FUTURE',
      'The sale is dated in the future. Record it when it happens, or the history says the car changed hands before it did.',
    );
  }

  if (request.openJobs > 0 && !request.force) {
    throw new OwnershipError(
      'OPEN_WORK',
      `There ${request.openJobs === 1 ? 'is' : 'are'} ${request.openJobs} open job${request.openJobs === 1 ? '' : 's'} on this vehicle. Finish or close ${request.openJobs === 1 ? 'it' : 'them'} first, or confirm the transfer anyway and the work stays with the previous owner's account.`,
    );
  }
}

/**
 * What a transfer says in the vehicle's own record.
 *
 * Deliberately thin. The chain event names that the vehicle changed hands and
 * when, and nothing else: who bought it is in the ownership row, where it can
 * be erased on request without breaking a hash that other events depend on.
 *
 * That separation is the whole reason the passport can be both permanent and
 * erasable. An append-only chain containing somebody's name is an
 * append-only chain that cannot honour a deletion request.
 */
export function transferEvent(input: { on: Date; odometerKm: number | null }): {
  title: string;
  summary: string;
  payload: Record<string, unknown>;
} {
  return {
    title: 'Vehicle changed hands',
    summary:
      input.odometerKm != null
        ? `Recorded at ${input.odometerKm.toLocaleString('en-GB')} km.`
        : 'No odometer reading taken at the point of sale.',
    payload: {
      occurredOn: input.on.toISOString(),
      odometerKm: input.odometerKm,
      // Names are not in the payload, on purpose. See above.
    },
  };
}

/**
 * How long somebody kept a vehicle, in whole months.
 *
 * Used on the report, where "three owners" means much less than "three owners,
 * the last of whom kept it for two months".
 */
export function heldFor(ownership: Ownership, now = new Date()): number {
  const end = ownership.endedAt ?? now;

  let months =
    (end.getFullYear() - ownership.startedAt.getFullYear()) * 12 +
    (end.getMonth() - ownership.startedAt.getMonth());

  if (end.getDate() < ownership.startedAt.getDate()) months -= 1;

  return Math.max(0, months);
}

/**
 * Owners as a buyer would read them, without naming any of them.
 *
 * A buyer is entitled to know how many people have owned a car and for how
 * long, because a vehicle that changed hands three times in two years is
 * telling them something. They are not entitled to know who those people
 * were.
 */
export function ownerHistory(
  ownerships: readonly Ownership[],
  now = new Date(),
): { position: number; kind: OwnerKind; months: number; current: boolean }[] {
  return [...ownerships]
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
    .map((ownership, index) => ({
      position: index + 1,
      kind: ownership.ownerKind,
      months: heldFor(ownership, now),
      current: ownership.endedAt === null,
    }));
}
