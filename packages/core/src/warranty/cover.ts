/**
 * What is still under warranty, and what happens when it is not.
 *
 * A workshop's usual answer to "is this covered" is to look for the invoice,
 * which means the answer depends on whether anybody filed it. The consequence
 * is not a lost argument, it is a part fitted twice and paid for once: the
 * workshop replaces it, absorbs the cost, and never claims from the supplier
 * who would have covered it.
 *
 * Three things shape the rules here.
 *
 * Cover runs out two ways and either is enough. Twelve months or twenty
 * thousand miles means whichever comes first, and a van reaches the second in
 * five months. Checking only the date is how a fleet gets free parts for a
 * year they were not entitled to.
 *
 * Labour and parts expire separately. A supplier warrants the component and
 * the workshop warrants the fitting, and the two are rarely the same length. A
 * claim against the wrong one is a claim that gets rejected.
 *
 * Behind the customer's warranty there is usually the supplier's, and the
 * workshop is the one in the middle. Recording both is what turns a goodwill
 * repair into a recoverable one.
 */

export type CoverKind = 'PART' | 'LABOUR';

export type CoverState = 'ACTIVE' | 'EXPIRED_BY_TIME' | 'EXPIRED_BY_DISTANCE' | 'VOID';

export interface Cover {
  id: string;
  kind: CoverKind;
  description: string;
  /** When the work was done. Cover runs from here, not from the sale. */
  startedOn: Date;
  months: number;
  /** Mileage allowance, where the warranty has one. */
  km: number | null;
  /** Odometer when it was fitted, needed to measure distance since. */
  startedAtKm: number | null;
  /** Set when somebody has voided it, with the reason. */
  voidedReason?: string | null;
  /** The supplier standing behind it, where one does. */
  supplierName?: string | null;
  supplierMonths?: number | null;
}

export interface CoverStatus {
  state: CoverState;
  active: boolean;
  expiresOn: Date;
  /** Negative once it has run out. */
  daysLeft: number;
  /** Null when the warranty has no mileage limit or no reading to measure from. */
  kmLeft: number | null;
  /** One sentence, for whoever is standing at the counter. */
  summary: string;
}

function addMonths(date: Date, months: number): Date {
  const moved = new Date(date);
  const day = moved.getDate();

  moved.setMonth(moved.getMonth() + months);

  // 31 January plus one month is 28 February, not 3 March. Without this a
  // warranty quietly gains days at every month end.
  if (moved.getDate() < day) moved.setDate(0);

  return moved;
}

function days(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Whether one piece of cover still holds.
 *
 * Distance is checked before time, because when both have run out the useful
 * thing to say is the one the customer will dispute, and mileage is the one
 * they can see on the dashboard.
 */
export function coverStatusOf(cover: Cover, now: Date, currentKm: number | null): CoverStatus {
  const expiresOn = addMonths(cover.startedOn, cover.months);
  const daysLeft = days(now, expiresOn);

  const kmLeft =
    cover.km !== null && cover.startedAtKm !== null && currentKm !== null
      ? cover.km - (currentKm - cover.startedAtKm)
      : null;

  if (cover.voidedReason) {
    return {
      state: 'VOID',
      active: false,
      expiresOn,
      daysLeft,
      kmLeft,
      summary: `Not covered: ${cover.voidedReason}`,
    };
  }

  if (kmLeft !== null && kmLeft <= 0) {
    return {
      state: 'EXPIRED_BY_DISTANCE',
      active: false,
      expiresOn,
      daysLeft,
      kmLeft,
      summary: `Out of cover on mileage, by ${Math.abs(kmLeft).toLocaleString('en-GB')} miles.`,
    };
  }

  if (daysLeft < 0) {
    return {
      state: 'EXPIRED_BY_TIME',
      active: false,
      expiresOn,
      daysLeft,
      kmLeft,
      summary: `Cover ran out on ${expiresOn.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })}.`,
    };
  }

  const byDistance =
    kmLeft !== null ? `, or ${kmLeft.toLocaleString('en-GB')} miles, whichever comes first` : '';

  return {
    state: 'ACTIVE',
    active: true,
    expiresOn,
    daysLeft,
    kmLeft,
    summary: `Covered for another ${daysLeft} day${daysLeft === 1 ? '' : 's'}${byDistance}.`,
  };
}

export class WarrantyError extends Error {
  readonly code:
    | 'NOT_COVERED'
    | 'ALREADY_CLAIMED'
    | 'NO_REASON'
    // Settling a claim with what it cost and what came back. Phase 44.
    | 'BAD_SETTLEMENT'
    | 'ALREADY_SETTLED';

  constructor(code: WarrantyError['code'], message: string) {
    super(message);
    this.name = 'WarrantyError';
    this.code = code;
  }
}

/**
 * Whether a claim can be raised at all.
 *
 * Expired cover does not block a claim outright, because a workshop sometimes
 * settles one out of goodwill and that decision should be recorded rather than
 * hidden. What it does is force somebody to say so: a claim against expired
 * cover needs a reason, and that reason is what a manager reads later when the
 * goodwill adds up.
 */
export function assertClaimable(input: {
  status: CoverStatus;
  openClaims: number;
  reason?: string | null;
}): void {
  if (input.openClaims > 0) {
    throw new WarrantyError(
      'ALREADY_CLAIMED',
      'There is already an open claim on this. Settle that one before raising another.',
    );
  }

  if (!input.status.active && !input.reason?.trim()) {
    throw new WarrantyError(
      'NO_REASON',
      `${input.status.summary} A claim can still be raised as goodwill, but somebody has to say why.`,
    );
  }
}

export interface ClaimPosition {
  /** What the workshop stands to lose if nobody else pays. */
  exposure: number;
  /** What the supplier's own warranty would cover, where it still runs. */
  recoverable: number;
  /** True when the supplier's cover has outlived the customer's. */
  supplierStillCovers: boolean;
  note: string;
}

/**
 * Who ends up paying.
 *
 * The figure that matters is not the value of the claim, it is the part of it
 * nobody else will cover. A workshop that replaces a component under its own
 * warranty while the supplier's is still running has simply given away the
 * money, and nothing in an ordinary system ever points that out.
 */
export function positionFor(input: {
  cover: Cover;
  status: CoverStatus;
  partsValue: number;
  labourValue: number;
  now: Date;
}): ClaimPosition {
  const { cover, partsValue, labourValue } = input;

  const supplierExpiry =
    cover.supplierMonths && cover.supplierName
      ? addMonths(cover.startedOn, cover.supplierMonths)
      : null;

  const supplierStillCovers = supplierExpiry !== null && supplierExpiry >= input.now;

  // A supplier warrants the component, never the hour spent fitting it again.
  const recoverable = supplierStillCovers ? partsValue : 0;
  const exposure = partsValue + labourValue - recoverable;

  return {
    exposure,
    recoverable,
    supplierStillCovers,
    note: supplierStillCovers
      ? `${cover.supplierName} still covers the part until ${supplierExpiry!.toLocaleDateString(
          'en-GB',
          { day: 'numeric', month: 'long', year: 'numeric' },
        )}. Claim it back rather than absorbing it.`
      : cover.supplierName
        ? `${cover.supplierName}'s own cover has run out, so all of this falls on the workshop.`
        : 'No supplier warranty recorded, so all of this falls on the workshop.',
  };
}

/** Cover worth chasing: running out soon, on a vehicle still being seen. */
export function expiringWithin(
  covers: readonly { cover: Cover; status: CoverStatus }[],
  days: number,
): { cover: Cover; status: CoverStatus }[] {
  return covers
    .filter((entry) => entry.status.active && entry.status.daysLeft <= days)
    .sort((a, b) => a.status.daysLeft - b.status.daysLeft);
}
