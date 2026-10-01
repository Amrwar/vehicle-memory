/**
 * The owner's day, sharpened. Phase 40.
 *
 * Four questions an owner asks that the product could answer from records it
 * already held and did not: how much of the work comes back, whether what
 * customers say is getting better or worse and where, who to buy a part from
 * when it is short, and whether a supplier is getting slower.
 *
 * Every figure here refuses to be stated on a base too small to mean
 * anything. One comeback in four jobs is not a twenty-five per cent comeback
 * rate, it is one car, and saying otherwise is how a good technician gets a
 * bad name.
 */

import { MIN_RESPONSES } from '../retention/reviews';

const DAY = 86_400_000;

/** A car back within this many days of finished work is offered as a comeback. */
export const COMEBACK_WINDOW_DAYS = 30;
/** Past this, the same fault again is a new repair and cannot be marked as a comeback. */
export const COMEBACK_LIMIT_DAYS = 90;
/** Fewer finished jobs than this and no rate is stated, only the count. */
export const MIN_JOBS_FOR_RATE = 10;
/** Fewer orders than this and no supplier measure is stated. */
export const MIN_ORDERS = 3;

/* ------------------------------------------------------------------------- */
/* Comebacks                                                                  */
/* ------------------------------------------------------------------------- */

export type ComebackErrorCode =
  'SAME_JOB' | 'OTHER_VEHICLE' | 'NOT_FINISHED' | 'NOT_BEFORE' | 'TOO_LATE' | 'NO_REASON' | 'LOOP';

export class ComebackError extends Error {
  readonly code: ComebackErrorCode;

  constructor(code: ComebackErrorCode, message: string) {
    super(message);
    this.name = 'ComebackError';
    this.code = code;
  }
}

export interface ComebackJob {
  id: string;
  vehicleId: string;
  createdAt: Date;
}

export interface OriginalJob {
  id: string;
  number?: number;
  vehicleId: string;
  completedAt: Date | null;
  comebackOfJobId?: string | null;
}

/**
 * Whether a job may be recorded as the same work coming back.
 *
 * The same car, work that was finished before this job was opened, not so
 * long ago that it is a new repair, and a sentence saying what came back. A
 * comeback with no reason is an accusation nobody can answer.
 */
export function assertComebackLink(input: {
  job: ComebackJob;
  original: OriginalJob;
  reason: string;
  limitDays?: number;
}): void {
  const { job, original } = input;
  const limit = input.limitDays ?? COMEBACK_LIMIT_DAYS;
  const named = original.number ? `Job #${original.number}` : 'That job';

  if (job.id === original.id) {
    throw new ComebackError('SAME_JOB', 'A job cannot be a comeback of itself.');
  }
  if (job.vehicleId !== original.vehicleId) {
    throw new ComebackError(
      'OTHER_VEHICLE',
      `${named} was on a different car. A comeback is the same car coming back.`,
    );
  }
  if (!original.completedAt) {
    throw new ComebackError('NOT_FINISHED', `${named} was never finished, so it cannot come back.`);
  }
  if (original.completedAt.getTime() >= job.createdAt.getTime()) {
    throw new ComebackError(
      'NOT_BEFORE',
      `${named} was finished after this job was opened, so this cannot be it coming back.`,
    );
  }
  if (job.createdAt.getTime() - original.completedAt.getTime() > limit * DAY) {
    throw new ComebackError(
      'TOO_LATE',
      `${named} was finished more than ${limit} days before this one. That is a new repair, not a comeback.`,
    );
  }
  if (original.comebackOfJobId === job.id) {
    throw new ComebackError(
      'LOOP',
      `${named} is already recorded as a comeback of this job. Two jobs cannot be each other's comeback.`,
    );
  }
  if (input.reason.trim().length < 3) {
    throw new ComebackError(
      'NO_REASON',
      'Say what came back, such as the same noise or the same leak. A comeback with no reason is an accusation nobody can answer.',
    );
  }
}

/**
 * Finished work on the same car in the days before this job was opened,
 * newest first. What the job page offers; the person decides, because a car
 * back in a fortnight for tyres is not the brake job coming back.
 */
export function comebackCandidates<T extends OriginalJob>(
  job: ComebackJob,
  previous: readonly T[],
  windowDays = COMEBACK_WINDOW_DAYS,
): T[] {
  return previous
    .filter(
      (entry) =>
        entry.id !== job.id &&
        entry.vehicleId === job.vehicleId &&
        entry.completedAt !== null &&
        entry.completedAt.getTime() < job.createdAt.getTime() &&
        job.createdAt.getTime() - entry.completedAt.getTime() <= windowDays * DAY,
    )
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
}

export interface Rate {
  part: number;
  base: number;
  /** A percentage to one decimal place, or null when the base is too small to say. */
  value: number | null;
}

/** A share, stated only when there is enough to state it on. */
export function rateOf(part: number, base: number, min = MIN_JOBS_FOR_RATE): Rate {
  return {
    part,
    base,
    value: base >= min && base > 0 ? Math.round((part / base) * 1000) / 10 : null,
  };
}

export interface Named {
  id: string;
  name: string;
}

export interface FinishedJob {
  id: string;
  completedAt: Date;
  site: Named;
  /** The technicians who did the work. */
  people: readonly Named[];
  /** True when a later job was recorded as this one coming back. */
  cameBack: boolean;
}

export interface GroupRate extends Named {
  rate: Rate;
}

function byRate(a: GroupRate, b: GroupRate): number {
  if (a.rate.value === null && b.rate.value !== null) return 1;
  if (b.rate.value === null && a.rate.value !== null) return -1;
  if (a.rate.value !== null && b.rate.value !== null && a.rate.value !== b.rate.value) {
    return b.rate.value - a.rate.value;
  }
  if (a.rate.part !== b.rate.part) return b.rate.part - a.rate.part;
  return b.rate.base - a.rate.base || a.name.localeCompare(b.name);
}

/**
 * The comeback rate for the workshop, each site and each person.
 *
 * A comeback counts against the job that came back, so against the site that
 * did that work and every technician on it, not against whoever put it right.
 * The base is the finished work, so a technician who did two jobs and had one
 * back has no rate, only the count, until there is enough to say.
 */
export function comebackRates(
  jobs: readonly FinishedJob[],
  min = MIN_JOBS_FOR_RATE,
): { overall: Rate; bySite: GroupRate[]; byPerson: GroupRate[] } {
  const sites = new Map<string, { name: string; part: number; base: number }>();
  const people = new Map<string, { name: string; part: number; base: number }>();

  for (const job of jobs) {
    const site = sites.get(job.site.id) ?? { name: job.site.name, part: 0, base: 0 };
    site.base += 1;
    if (job.cameBack) site.part += 1;
    sites.set(job.site.id, site);

    const seen = new Set<string>();
    for (const person of job.people) {
      if (seen.has(person.id)) continue;
      seen.add(person.id);
      const entry = people.get(person.id) ?? { name: person.name, part: 0, base: 0 };
      entry.base += 1;
      if (job.cameBack) entry.part += 1;
      people.set(person.id, entry);
    }
  }

  const toRows = (map: Map<string, { name: string; part: number; base: number }>) =>
    [...map.entries()]
      .map(([id, entry]) => ({ id, name: entry.name, rate: rateOf(entry.part, entry.base, min) }))
      .sort(byRate);

  return {
    overall: rateOf(jobs.filter((job) => job.cameBack).length, jobs.length, min),
    bySite: toRows(sites),
    byPerson: toRows(people),
  };
}

/** The rate as a person would say it, never a percentage on too little. */
export function describeRate(rate: Rate, noun = 'job'): string {
  if (rate.base === 0) return `No finished ${noun}s in this period.`;
  const plural = (n: number) => `${n} ${noun}${n === 1 ? '' : 's'}`;
  if (rate.value === null) {
    return `${rate.part} back out of ${plural(rate.base)}. Too few to state as a rate.`;
  }
  return `${rate.value}%: ${rate.part} back out of ${plural(rate.base)}.`;
}

/* ------------------------------------------------------------------------- */
/* What customers said, over time                                             */
/* ------------------------------------------------------------------------- */

export interface RatedAnswer {
  rating: number;
  at: Date;
  site?: Named | null;
  people?: readonly Named[];
}

function averageOf(rows: readonly RatedAnswer[], min: number): number | null {
  if (rows.length < min || rows.length === 0) return null;
  return Math.round((rows.reduce((total, row) => total + row.rating, 0) / rows.length) * 10) / 10;
}

export interface MonthOfRatings {
  /** YYYY-MM. */
  month: string;
  start: Date;
  count: number;
  average: number | null;
}

/** The last few months, oldest first, each averaged only when enough answered. */
export function monthlyRatings(
  rows: readonly RatedAnswer[],
  months = 6,
  now = new Date(),
  min = MIN_RESPONSES,
): MonthOfRatings[] {
  const out: MonthOfRatings[] = [];
  for (let back = months - 1; back >= 0; back -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const inside = rows.filter((row) => row.at >= start && row.at < end);
    out.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
      start,
      count: inside.length,
      average: averageOf(inside, min),
    });
  }
  return out;
}

export type Direction = 'up' | 'down' | 'steady';

export interface RatingTrend {
  current: number | null;
  previous: number | null;
  currentCount: number;
  previousCount: number;
  /** Null unless both windows had enough answers to average. */
  direction: Direction | null;
}

/** How far an average has to move before it is called a movement. */
export const RATING_MOVE = 0.3;

/**
 * The last ninety days against the ninety before. A direction only when both
 * windows had enough answers, and "steady" for a movement smaller than one
 * unhappy customer would cause.
 */
export function ratingTrend(
  rows: readonly RatedAnswer[],
  options: { now?: Date; days?: number; min?: number } = {},
): RatingTrend {
  const now = options.now ?? new Date();
  const days = options.days ?? 90;
  const min = options.min ?? MIN_RESPONSES;
  const split = now.getTime() - days * DAY;
  const floor = split - days * DAY;

  const current = rows.filter((row) => row.at.getTime() > split && row.at <= now);
  const previous = rows.filter((row) => row.at.getTime() > floor && row.at.getTime() <= split);

  const a = averageOf(current, min);
  const b = averageOf(previous, min);
  let direction: Direction | null = null;
  if (a !== null && b !== null) {
    // Rounded before comparing, so 0.3 in tenths is 0.3 and not 0.29999.
    const change = Math.round((a - b) * 10) / 10;
    direction = change >= RATING_MOVE ? 'up' : change <= -RATING_MOVE ? 'down' : 'steady';
  }

  return {
    current: a,
    previous: b,
    currentCount: current.length,
    previousCount: previous.length,
    direction,
  };
}

export interface GroupTrend extends Named {
  trend: RatingTrend;
}

/**
 * The trend for each site, or each technician who worked on the job that was
 * rated. Busiest first, because a site with forty answers says more than one
 * with six.
 */
export function reputationBy(
  rows: readonly RatedAnswer[],
  by: 'site' | 'person',
  options: { now?: Date; days?: number; min?: number } = {},
): GroupTrend[] {
  const groups = new Map<string, { name: string; rows: RatedAnswer[] }>();

  for (const row of rows) {
    const keys = by === 'site' ? (row.site ? [row.site] : []) : (row.people ?? []);
    const seen = new Set<string>();
    for (const key of keys) {
      if (seen.has(key.id)) continue;
      seen.add(key.id);
      const group = groups.get(key.id) ?? { name: key.name, rows: [] };
      group.rows.push(row);
      groups.set(key.id, group);
    }
  }

  return [...groups.entries()]
    .map(([id, group]) => ({ id, name: group.name, trend: ratingTrend(group.rows, options) }))
    .filter((group) => group.trend.currentCount + group.trend.previousCount > 0)
    .sort(
      (a, b) =>
        b.trend.currentCount - a.trend.currentCount ||
        b.trend.previousCount - a.trend.previousCount ||
        a.name.localeCompare(b.name),
    );
}

export function describeTrend(trend: RatingTrend): string {
  if (trend.currentCount === 0 && trend.previousCount === 0) return 'Nobody has answered.';
  if (trend.current === null) {
    return `${trend.currentCount} ${trend.currentCount === 1 ? 'answer' : 'answers'} lately. Too few to average.`;
  }
  if (trend.direction === null) {
    return `${trend.current} from ${trend.currentCount} answers. Too few before that to compare.`;
  }
  if (trend.direction === 'steady') {
    return `${trend.current} from ${trend.currentCount} answers, steady against ${trend.previous}.`;
  }
  return `${trend.current} from ${trend.currentCount} answers, ${trend.direction} from ${trend.previous}.`;
}

/* ------------------------------------------------------------------------- */
/* Suppliers                                                                  */
/* ------------------------------------------------------------------------- */

export interface SupplierOrder {
  createdAt: Date;
  expectedAt: Date | null;
  /** The first delivery against the order, if any arrived. */
  firstReceivedAt: Date | null;
  ordered: number;
  received: number;
  /** At cost, what arrived and what went back. */
  receivedValue: number;
  returnedValue: number;
  /** Nothing more is coming: received in full, billed, or cancelled. */
  closed: boolean;
}

export interface SupplierMeasures {
  orders: number;
  /** Median days from order to first delivery. */
  leadDays: number | null;
  /** Share of deliveries that arrived by the end of the day promised. */
  onTimePct: number | null;
  /** Of what was ordered on closed orders, the share that arrived. */
  fillPct: number | null;
  /** Of the value that arrived, the share sent back. */
  returnPct: number | null;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

const pct = (part: number, whole: number) => Math.round((part / whole) * 1000) / 10;

/**
 * How a supplier behaves, measured from their orders, each figure stated
 * only when enough orders stand behind it.
 */
export function measureSupplier(
  orders: readonly SupplierOrder[],
  min = MIN_ORDERS,
): SupplierMeasures {
  const arrived = orders.filter((order) => order.firstReceivedAt);
  const waits = arrived
    .map((order) => (order.firstReceivedAt!.getTime() - order.createdAt.getTime()) / DAY)
    .filter((wait) => wait >= 0);

  const promised = arrived.filter((order) => order.expectedAt);
  const onTime = promised.filter(
    (order) => order.firstReceivedAt!.getTime() < order.expectedAt!.getTime() + DAY,
  );

  const closed = orders.filter((order) => order.closed && order.ordered > 0);
  const ordered = closed.reduce((total, order) => total + order.ordered, 0);
  const received = closed.reduce(
    (total, order) => total + Math.min(order.received, order.ordered),
    0,
  );

  const receivedValue = arrived.reduce((total, order) => total + order.receivedValue, 0);
  const returnedValue = arrived.reduce((total, order) => total + order.returnedValue, 0);

  return {
    orders: orders.length,
    leadDays: waits.length >= min ? Math.max(1, Math.round(median(waits))) : null,
    onTimePct: promised.length >= min ? pct(onTime.length, promised.length) : null,
    fillPct: closed.length >= min && ordered > 0 ? pct(received, ordered) : null,
    returnPct:
      arrived.length >= min && receivedValue > 0 ? pct(returnedValue, receivedValue) : null,
  };
}

export interface SupplierPeriod {
  label: string;
  start: Date;
  end: Date;
  measures: SupplierMeasures;
}

/** Quarter by quarter, oldest first, ending with the quarter `now` is in. */
export function performanceOverTime(
  orders: readonly SupplierOrder[],
  options: { now?: Date; quarters?: number; min?: number } = {},
): SupplierPeriod[] {
  const now = options.now ?? new Date();
  const quarters = options.quarters ?? 4;
  const thisQuarter = Math.floor(now.getMonth() / 3);
  const out: SupplierPeriod[] = [];

  for (let back = quarters - 1; back >= 0; back -= 1) {
    const start = new Date(now.getFullYear(), (thisQuarter - back) * 3, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
    const inside = orders.filter((order) => order.createdAt >= start && order.createdAt < end);
    out.push({
      label: `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`,
      start,
      end,
      measures: measureSupplier(inside, options.min),
    });
  }
  return out;
}

/**
 * What changed over the periods, in sentences. Only between periods that
 * each had enough to measure, and only a change big enough to notice: two
 * days on the wait, ten points on arriving when promised.
 */
export function describePerformance(periods: readonly SupplierPeriod[]): string[] {
  const sentences: string[] = [];

  const leads = periods.filter((period) => period.measures.leadDays !== null);
  if (leads.length >= 2) {
    const first = leads[0]!;
    const last = leads[leads.length - 1]!;
    const change = last.measures.leadDays! - first.measures.leadDays!;
    if (Math.abs(change) >= 2) {
      sentences.push(
        `${change > 0 ? 'Slower' : 'Quicker'}: deliveries took ${last.measures.leadDays} days in ${last.label}, against ${first.measures.leadDays} in ${first.label}.`,
      );
    }
  }

  const promises = periods.filter((period) => period.measures.onTimePct !== null);
  if (promises.length >= 2) {
    const first = promises[0]!;
    const last = promises[promises.length - 1]!;
    const change = last.measures.onTimePct! - first.measures.onTimePct!;
    if (Math.abs(change) >= 10) {
      sentences.push(
        `${change < 0 ? 'Less' : 'More'} reliable: ${last.measures.onTimePct}% arrived by the day promised in ${last.label}, against ${first.measures.onTimePct}% in ${first.label}.`,
      );
    }
  }

  if (sentences.length > 0) return sentences;
  if (leads.length < 2 && promises.length < 2) {
    return ['Too few orders in each quarter to say whether they are changing.'];
  }
  return ['No change worth noting between the quarters that can be measured.'];
}

export interface SupplierOption extends Named {
  /** What they charged for this part on the latest order, or null if they never supplied it. */
  lastCost: number | null;
  lastOrderedAt: Date | null;
  timesSupplied: number;
  measures: SupplierMeasures;
}

export interface ComparedSupplier extends SupplierOption {
  cheapest: boolean;
  quickest: boolean;
  mostReliable: boolean;
}

/**
 * Who to buy a part from, laid side by side.
 *
 * Suppliers who have sold this part come first, cheapest last time first;
 * the rest follow, quickest first, because they can be asked. Each of
 * cheapest, quickest and most reliable is marked only where at least two
 * could be compared: the only supplier with a price is not the cheapest, it
 * is the only one. The product never picks; a part needed by four o'clock is
 * worth the extra pound.
 */
export function compareSuppliers(options: readonly SupplierOption[]): ComparedSupplier[] {
  const priced = options.filter((option) => option.lastCost !== null);
  const timed = options.filter((option) => option.measures.leadDays !== null);
  const reliable = options.filter((option) => option.measures.onTimePct !== null);

  const cheapest =
    priced.length >= 2 ? Math.min(...priced.map((option) => option.lastCost!)) : null;
  const quickest =
    timed.length >= 2 ? Math.min(...timed.map((option) => option.measures.leadDays!)) : null;
  const steadiest =
    reliable.length >= 2 ? Math.max(...reliable.map((option) => option.measures.onTimePct!)) : null;

  return options
    .map((option) => ({
      ...option,
      cheapest: cheapest !== null && option.lastCost === cheapest,
      quickest: quickest !== null && option.measures.leadDays === quickest,
      mostReliable: steadiest !== null && option.measures.onTimePct === steadiest,
    }))
    .sort((a, b) => {
      if ((a.lastCost === null) !== (b.lastCost === null)) return a.lastCost === null ? 1 : -1;
      if (a.lastCost !== null && b.lastCost !== null && a.lastCost !== b.lastCost) {
        return a.lastCost - b.lastCost;
      }
      const la = a.measures.leadDays ?? Number.POSITIVE_INFINITY;
      const lb = b.measures.leadDays ?? Number.POSITIVE_INFINITY;
      if (la !== lb) return la - lb;
      return a.name.localeCompare(b.name);
    });
}

/** The list an owner clears before opening anything else. Phase 95. */
export * from './do-not-miss';

/** What was true when the doors shut. Phase 96. */
export * from './close-of-day';

/** What happened while we were shut. Phase 97. */
export * from './start-of-day';
export * from './control-tower';
