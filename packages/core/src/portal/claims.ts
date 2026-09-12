/**
 * A customer asking for their own car.
 *
 * This is the one place in the product where getting the design wrong would
 * undo everything else, so the reasoning is worth stating before the rules.
 *
 * A vehicle identification number is visible through the windscreen of every
 * parked car. A registration plate is visible from further away than that.
 * Neither is a secret, and neither is evidence of anything: if entering one
 * were enough to open a vehicle's history, then standing in a supermarket car
 * park with a phone would be enough to read a stranger's service record, what
 * they were quoted, what they declined, and how far they drive each year.
 *
 * So a self-registered account starts with nothing, and stays with nothing
 * until somebody who actually knows the person says otherwise. There are
 * exactly two ways in.
 *
 * An invitation. The workshop has the customer in front of them, creates the
 * link, and the person who opens it is attached to that customer record. The
 * workshop has taken responsibility for the identification.
 *
 * A claim. The customer registers, enters a registration number, and the
 * request goes to the workshop that last serviced that vehicle for a person to
 * approve. They ring the customer, or recognise the name, or decline it. The
 * product never decides this on its own, because it cannot: it has no way to
 * tell an owner from somebody who walked past the car.
 *
 * Everything below exists to make the second path safe enough to be useful
 * without ever becoming automatic.
 */

export class ClaimError extends Error {
  constructor(
    readonly code:
      | 'NO_VEHICLE'
      | 'NO_WORKSHOP'
      | 'ALREADY_YOURS'
      | 'ALREADY_ASKED'
      | 'TOO_MANY'
      | 'UNVERIFIED'
      | 'NOT_PENDING'
      | 'NO_REASON',
    message: string,
  ) {
    super(message);
    this.name = 'ClaimError';
  }
}

export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

/**
 * How many vehicles somebody may ask about before it stops being plausible.
 *
 * Three open requests at once. A person with four cars exists and can ask
 * again once one is answered; somebody working through a car park cannot.
 * The limit is on open requests rather than on total, so an honest customer is
 * never permanently capped.
 */
export const MAX_OPEN_CLAIMS = 3;

/** How long a workshop has before a request is worth chasing. */
export const CHASE_AFTER_DAYS = 3;

export interface ClaimRequest {
  /** Whether the person asking has proven their email address. */
  verified: boolean;
  /** Open requests this person already has. */
  openClaims: number;
  /** Whether this vehicle is already attached to them. */
  alreadyTheirs: boolean;
  /** Whether they have an unanswered request for this same vehicle. */
  alreadyAsked: boolean;
  /** Whether any workshop has ever serviced it, and so can vouch. */
  hasWorkshop: boolean;
}

/**
 * Whether a request may even be made.
 *
 * Every refusal names something the person can do about it. A refusal that
 * only says no teaches somebody to try again in a minute, and this is a form
 * where somebody trying repeatedly is the thing to notice.
 */
export function assertVehicleClaimable(request: ClaimRequest): void {
  if (!request.verified) {
    throw new ClaimError(
      'UNVERIFIED',
      'Confirm your email address first. A workshop is being asked to hand over a vehicle history, and they should at least know the address is real.',
    );
  }

  if (request.alreadyTheirs) {
    throw new ClaimError('ALREADY_YOURS', 'That vehicle is already on your account.');
  }

  if (request.alreadyAsked) {
    throw new ClaimError(
      'ALREADY_ASKED',
      'You have already asked about that one. The workshop has it and will answer.',
    );
  }

  if (!request.hasWorkshop) {
    throw new ClaimError(
      'NO_WORKSHOP',
      'No workshop using Carnet has worked on that vehicle, so there is nobody who can confirm it is yours. Ask your garage whether they use Carnet.',
    );
  }

  if (request.openClaims >= MAX_OPEN_CLAIMS) {
    throw new ClaimError(
      'TOO_MANY',
      `You have ${request.openClaims} requests waiting. Wait for one to be answered before asking about another.`,
    );
  }
}

export interface ClaimDecision {
  status: ClaimStatus;
  /** What the workshop wrote. Required on a refusal. */
  reason?: string | null;
}

/**
 * Whether a workshop's answer is one that can be recorded.
 *
 * A refusal has to say why. The customer is told the outcome either way, and
 * "no" with nothing behind it is the answer that generates a telephone call
 * to the workshop rather than saving them one.
 */
export function assertClaimDecidable(input: {
  current: ClaimStatus;
  decision: ClaimDecision;
}): void {
  if (input.current !== 'PENDING') {
    throw new ClaimError(
      'NOT_PENDING',
      `That request was already ${input.current.toLowerCase()}. Answering it twice would tell the customer two different things.`,
    );
  }

  if (input.decision.status === 'REJECTED' && !input.decision.reason?.trim()) {
    throw new ClaimError(
      'NO_REASON',
      'Say why. The customer is told the outcome, and a refusal with nothing behind it produces a phone call rather than saving one.',
    );
  }
}

/**
 * What a customer sees on their own request.
 *
 * Deliberately never says which workshop is considering it before they answer.
 * A pending request is not proof of a relationship, and naming the garage
 * would leak where a car was serviced to somebody who has not yet shown they
 * have any connection to it.
 */
export function describeClaim(input: {
  status: ClaimStatus;
  registration: string;
  askedAt: Date;
  reason?: string | null;
  now?: Date;
}): string {
  const now = input.now ?? new Date();
  const days = Math.floor((now.getTime() - input.askedAt.getTime()) / 86_400_000);

  switch (input.status) {
    case 'APPROVED':
      return `${input.registration} is on your account.`;

    case 'REJECTED':
      return `The workshop did not confirm ${input.registration}. ${input.reason ?? ''}`.trim();

    case 'WITHDRAWN':
      return `You withdrew the request for ${input.registration}.`;

    default:
      return days >= CHASE_AFTER_DAYS
        ? `Still waiting on ${input.registration}, asked ${days} days ago. Ringing the garage is usually quicker than waiting.`
        : `Waiting for the workshop to confirm ${input.registration} is yours.`;
  }
}

/**
 * What a workshop sees, and in what order.
 *
 * Oldest first, deliberately. A queue read newest-first leaves the requests
 * nobody wanted to deal with at the bottom forever, and those are precisely
 * the ones where a customer is sitting waiting.
 */
export function claimQueueOrder<T extends { status: ClaimStatus; askedAt: Date }>(
  claims: readonly T[],
): T[] {
  return [...claims].sort((a, b) => {
    const pending = (claim: T) => (claim.status === 'PENDING' ? 0 : 1);
    return pending(a) - pending(b) || a.askedAt.getTime() - b.askedAt.getTime();
  });
}

/**
 * A registration as the database stores it.
 *
 * Spaces and case are how people type a plate, not how it is held, and a
 * lookup that fails because somebody typed a space is a lookup that sends them
 * to a workshop who has to explain the space.
 */
export function normaliseRegistration(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]/g, '');
}

/** Whether something typed into the box could be a plate at all. */
export function looksLikeRegistration(value: string): boolean {
  const cleaned = normaliseRegistration(value);
  return cleaned.length >= 4 && cleaned.length <= 10 && /^[A-Z0-9]+$/.test(cleaned);
}

/**
 * What somebody typed into the one box on the form.
 *
 * There is one box rather than two because a customer knows their plate and
 * has to go and look for the VIN, and making them choose which kind of thing
 * they are holding is a question the software can answer itself. A VIN is
 * seventeen characters and excludes I, O and Q precisely so it cannot be
 * confused with anything else; a plate is shorter than that everywhere.
 *
 * Both are accepted because a plate is not reliably unique over time. A
 * personalised registration moves from one car to the next, so two vehicles
 * can hold it years apart, and the VIN is the way a customer resolves that
 * without a telephone call.
 */
export function identifierKind(value: string): 'VIN' | 'REGISTRATION' | 'NEITHER' {
  const cleaned = normaliseRegistration(value);

  if (cleaned.length === 17 && /^[A-HJ-NPR-Z0-9]+$/.test(cleaned)) return 'VIN';
  if (looksLikeRegistration(value)) return 'REGISTRATION';

  return 'NEITHER';
}

/**
 * One plate, two cars.
 *
 * Picking either at random would show somebody a stranger's history, so the
 * only honest answer is to say which two and ask for the number that tells
 * them apart. The vehicles are described rather than named: make, model and
 * year are what a person recognises, and none of it identifies an owner.
 */
export function describeAmbiguity(
  candidates: readonly { make?: string | null; model?: string | null; year?: number | null }[],
): string {
  const described = candidates.map(
    (candidate) =>
      [candidate.year, candidate.make, candidate.model].filter(Boolean).join(' ').trim() ||
      'an unidentified vehicle',
  );

  return `That registration has been on more than one vehicle: ${described.join(' and ')}. Enter the 17-character VIN instead. It is on the windscreen, the door frame, and your insurance documents.`;
}
