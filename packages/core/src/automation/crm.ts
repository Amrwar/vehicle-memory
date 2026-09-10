import { type Money, money, sum, zero } from '../shared/money';

/**
 * Who to talk to, and whether you may.
 *
 * Consent comes first in this file because it is the part that gates
 * everything else. A campaign is a list and a message; the only interesting
 * question is which of those people asked to hear from you, and the answer has
 * to be checked at the moment of sending rather than at the moment the list
 * was built. Lists go stale. Somebody who withdrew consent on Tuesday must not
 * receive Wednesday's send because the segment was computed on Monday.
 */

export type Channel = 'EMAIL' | 'SMS';

export interface ConsentState {
  email: boolean;
  sms: boolean;
  /** No address means no consent, whatever the flag says. */
  hasEmail: boolean;
  hasMobile: boolean;
}

export type SendRefusal = 'NO_CONSENT' | 'NO_ADDRESS' | 'TRANSACTIONAL_ONLY' | 'RECENTLY_CONTACTED';

export interface SendDecision {
  allowed: boolean;
  refusal: SendRefusal | null;
  reason: string;
}

/** Below this many days between marketing messages, it is pestering. */
export const MIN_DAYS_BETWEEN_MARKETING = 14;

/**
 * Whether a marketing message may go out.
 *
 * Transactional messages, a booking confirmation or an estimate, are never
 * gated on marketing consent: somebody who asked for work done has asked to be
 * told about it. Conflating the two either spams people who opted out of
 * marketing or silences the confirmation somebody is waiting for.
 */
export function mayMarket(input: {
  channel: Channel;
  consent: ConsentState;
  lastMarketedAt?: Date | null;
  now?: Date;
}): SendDecision {
  const now = input.now ?? new Date();
  const hasAddress = input.channel === 'EMAIL' ? input.consent.hasEmail : input.consent.hasMobile;

  if (!hasAddress) {
    return {
      allowed: false,
      refusal: 'NO_ADDRESS',
      reason:
        input.channel === 'EMAIL'
          ? 'No email address on this customer.'
          : 'No mobile number on this customer.',
    };
  }

  const given = input.channel === 'EMAIL' ? input.consent.email : input.consent.sms;

  if (!given) {
    return {
      allowed: false,
      refusal: 'NO_CONSENT',
      reason: `They have not agreed to marketing by ${input.channel.toLowerCase()}.`,
    };
  }

  if (input.lastMarketedAt) {
    const days = (now.getTime() - input.lastMarketedAt.getTime()) / 86_400_000;

    if (days < MIN_DAYS_BETWEEN_MARKETING) {
      return {
        allowed: false,
        refusal: 'RECENTLY_CONTACTED',
        reason: `Marketed to ${Math.round(days)} days ago. The floor is ${MIN_DAYS_BETWEEN_MARKETING}.`,
      };
    }
  }

  return { allowed: true, refusal: null, reason: 'They agreed, and it has been long enough.' };
}

/** Transactional messages bypass marketing consent, and only those. */
export function mayNotify(input: { channel: Channel; consent: ConsentState }): SendDecision {
  const hasAddress = input.channel === 'EMAIL' ? input.consent.hasEmail : input.consent.hasMobile;

  return hasAddress
    ? { allowed: true, refusal: null, reason: 'A message about their own work.' }
    : {
        allowed: false,
        refusal: 'NO_ADDRESS',
        reason: `No ${input.channel === 'EMAIL' ? 'email address' : 'mobile number'} to send to.`,
      };
}

/* ---------------------------------------------------------------------------
   Segments
   --------------------------------------------------------------------------- */

export type SegmentRule =
  | { kind: 'lapsed'; days: number }
  | { kind: 'spent-over'; minorUnits: number }
  | { kind: 'visits-at-least'; count: number }
  | { kind: 'has-vehicle-older-than'; years: number }
  | { kind: 'never-returned' }
  | { kind: 'declined-work-since'; days: number };

export interface SegmentMember {
  customerId: string;
  name: string;
  visits: number;
  lifetimeMinor: number;
  daysSinceLastVisit: number | null;
  oldestVehicleYears: number | null;
  declinedSinceDays: number | null;
  consent: ConsentState;
}

export function describeSegment(rule: SegmentRule): string {
  switch (rule.kind) {
    case 'lapsed':
      return `Not been in for ${rule.days} days`;
    case 'spent-over':
      return `Spent more than £${(rule.minorUnits / 100).toFixed(0)} with you`;
    case 'visits-at-least':
      return `Been in at least ${rule.count} times`;
    case 'has-vehicle-older-than':
      return `Has a vehicle over ${rule.years} years old`;
    case 'never-returned':
      return 'Came once and never came back';
    case 'declined-work-since':
      return `Declined work in the last ${rule.days} days`;
  }
}

export function inSegment(member: SegmentMember, rule: SegmentRule): boolean {
  switch (rule.kind) {
    case 'lapsed':
      return member.daysSinceLastVisit !== null && member.daysSinceLastVisit >= rule.days;
    case 'spent-over':
      return member.lifetimeMinor > rule.minorUnits;
    case 'visits-at-least':
      return member.visits >= rule.count;
    case 'has-vehicle-older-than':
      return member.oldestVehicleYears !== null && member.oldestVehicleYears > rule.years;
    case 'never-returned':
      return member.visits === 1;
    case 'declined-work-since':
      return member.declinedSinceDays !== null && member.declinedSinceDays <= rule.days;
  }
}

export interface SegmentResult {
  members: SegmentMember[];
  /** In the segment, and reachable on this channel. */
  reachable: SegmentMember[];
  /** In the segment but cannot be contacted, and why. */
  unreachable: { member: SegmentMember; reason: string }[];
  totalValue: Money;
}

/**
 * Builds a segment, and separates who can actually be contacted.
 *
 * The gap between the two is the number that matters. A campaign reporting
 * "480 customers" when 90 of them have no consent and 40 have no address is
 * reporting an intention, not a send, and the difference is discovered after
 * somebody has already decided the campaign was worth doing.
 */
export function buildSegment(
  members: readonly SegmentMember[],
  rules: readonly SegmentRule[],
  channel: Channel,
  currency = 'GBP',
): SegmentResult {
  const matching = members.filter((member) => rules.every((rule) => inSegment(member, rule)));

  const reachable: SegmentMember[] = [];
  const unreachable: { member: SegmentMember; reason: string }[] = [];

  for (const member of matching) {
    const decision = mayMarket({ channel, consent: member.consent });

    if (decision.allowed) reachable.push(member);
    else unreachable.push({ member, reason: decision.reason });
  }

  return {
    members: matching,
    reachable,
    unreachable,
    totalValue: sum(
      matching.map((member) => money(member.lifetimeMinor, currency)),
      currency,
    ),
  };
}

/* ---------------------------------------------------------------------------
   Cohorts
   --------------------------------------------------------------------------- */

export interface CohortRow {
  /** The month somebody first came in, as YYYY-MM. */
  cohort: string;
  size: number;
  /** Share still returning, by months since their first visit. */
  retention: number[];
  lifetimeMinor: number;
}

export interface FirstVisit {
  customerId: string;
  firstVisit: Date;
  /** Every completed visit, first included. */
  visits: Date[];
  lifetimeMinor: number;
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * Retention by the month somebody first arrived.
 *
 * Cohorts rather than an overall rate, because an overall retention figure
 * moves when the number of new customers moves and tells you nothing about
 * whether the ones you had are staying. A workshop with falling retention and
 * rising acquisition looks healthy right up until the acquisition stops.
 *
 * A cohort is only counted at a given month if it has had time to reach it.
 * Including a cohort three months old in a twelve-month column produces a
 * retention figure that falls off a cliff for reasons that are purely
 * arithmetic.
 */
export function cohorts(
  customers: readonly FirstVisit[],
  months = 12,
  asOf: Date = new Date(),
): CohortRow[] {
  const byCohort = new Map<string, FirstVisit[]>();

  for (const customer of customers) {
    const key = monthKey(customer.firstVisit);
    byCohort.set(key, [...(byCohort.get(key) ?? []), customer]);
  }

  return [...byCohort.entries()]
    .map(([cohort, group]) => {
      const retention: number[] = [];

      for (let month = 0; month < months; month += 1) {
        const oldestInCohort = group[0]!.firstVisit;

        // Not enough time has passed for this column to mean anything.
        if (monthsBetween(oldestInCohort, asOf) < month) break;

        const returned = group.filter((customer) =>
          customer.visits.some((visit) => monthsBetween(customer.firstVisit, visit) === month),
        ).length;

        retention.push(Math.round((returned / group.length) * 1000) / 10);
      }

      return {
        cohort,
        size: group.length,
        retention,
        lifetimeMinor: group.reduce((total, customer) => total + customer.lifetimeMinor, 0),
      };
    })
    .sort((a, b) => b.cohort.localeCompare(a.cohort));
}

/** Average value of a customer from a cohort, which is what acquisition is worth. */
export function lifetimeValue(row: CohortRow, currency = 'GBP'): Money {
  return row.size === 0
    ? zero(currency)
    : money(Math.round(row.lifetimeMinor / row.size), currency);
}

/* ---------------------------------------------------------------------------
   Campaigns
   --------------------------------------------------------------------------- */

export type CampaignStatus = 'DRAFT' | 'SENDING' | 'SENT' | 'CANCELLED';

export interface CampaignPlan {
  recipients: number;
  suppressed: number;
  /** What it will cost, where the channel costs money. */
  estimatedCost: Money;
  warnings: string[];
}

/** Roughly what a text costs to send. Email is treated as free. */
export const SMS_COST_MINOR = 4;

/**
 * What a campaign will actually do, before it does it.
 *
 * Shown before sending because a campaign is the one action in this product
 * that cannot be undone. An invoice can be credited and a job reopened; a
 * message that has reached four hundred people has reached them.
 */
export function planCampaign(
  segment: SegmentResult,
  channel: Channel,
  currency = 'GBP',
): CampaignPlan {
  const warnings: string[] = [];

  if (segment.reachable.length === 0) {
    warnings.push('Nobody in this segment can be contacted on this channel.');
  }

  if (segment.unreachable.length > segment.reachable.length && segment.members.length > 0) {
    warnings.push(
      `More of this segment cannot be reached (${segment.unreachable.length}) than can (${segment.reachable.length}).`,
    );
  }

  const noConsent = segment.unreachable.filter((entry) =>
    entry.reason.includes('not agreed'),
  ).length;

  if (noConsent > 0) {
    warnings.push(
      `${noConsent} ${noConsent === 1 ? 'person has' : 'people have'} not agreed to marketing and will not be sent to.`,
    );
  }

  return {
    recipients: segment.reachable.length,
    suppressed: segment.unreachable.length,
    estimatedCost:
      channel === 'SMS'
        ? money(segment.reachable.length * SMS_COST_MINOR, currency)
        : zero(currency),
    warnings,
  };
}
