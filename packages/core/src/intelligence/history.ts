/**
 * Reading a vehicle's whole mileage history at once.
 *
 * The existing check compares each new reading against the one before it,
 * which catches the obvious case and misses the one that matters. A rollback
 * followed by two years of normal driving leaves no adjacent pair that looks
 * wrong: every step goes up. You only see it by looking at the sequence.
 *
 * Three rules shape everything here, and they exist because the output of this
 * module is an accusation about somebody's car.
 *
 * Nothing is scored. A single number out of ten reads as a verdict, gets
 * quoted in an advert or used to knock money off a price, and cannot carry the
 * reasoning that produced it. Findings are stated individually with what they
 * rest on, and the person reading decides.
 *
 * Every finding carries how certain it is, and the difference is not
 * decoration. A reading lower than an earlier one is arithmetic. A drop in
 * annual mileage before a sale is a pattern that also fits a change of job, a
 * long illness or a second car, and stating it as fraud would be wrong far
 * more often than it was right.
 *
 * An absence of records is never evidence of anything. Gaps are reported
 * because a buyer should know the history is thin, and reported as thin
 * history rather than as suspicion.
 */

// The same threshold the per-reading check uses. Two definitions of "nobody
// drives that far" would eventually disagree, and the pair of checks would
// then contradict each other on the same vehicle.
import { IMPLAUSIBLE_KM_PER_DAY } from '../vehicle/mileage';

export type HistoryFindingKind =
  | 'ROLLBACK'
  | 'MASKED_ROLLBACK'
  | 'IMPLAUSIBLE_RATE'
  | 'RATE_COLLAPSE'
  | 'CONFLICT'
  | 'THIN_HISTORY';

export type HistorySeverity = 'INFO' | 'CONCERN' | 'SERIOUS';

/**
 * How much the finding rests on.
 *
 * CERTAIN means arithmetic: the numbers themselves are contradictory and no
 * innocent explanation changes them. LIKELY means a pattern with few innocent
 * explanations. POSSIBLE means something worth a question, not an answer.
 */
export type HistoryConfidence = 'CERTAIN' | 'LIKELY' | 'POSSIBLE';

export interface HistoryReading {
  km: number;
  readAt: Date;
  source: 'WORKSHOP' | 'OWNER' | 'INSPECTION' | 'AUTHORITY' | 'TELEMATICS';
  /** Which workshop recorded it, where one did. */
  orgId?: string | null;
  orgName?: string | null;
}

export interface HistoryFinding {
  kind: HistoryFindingKind;
  severity: HistorySeverity;
  confidence: HistoryConfidence;
  /** When the problem is, not when it was noticed. */
  at: Date;
  /** One line, for a list. */
  summary: string;
  /** The reasoning, for somebody deciding what to do about it. */
  detail: string;
}

/** Ignore rate calculations over intervals shorter than this. */
const MIN_DAYS_FOR_RATE = 1;

/** A recent average this much below the long-run one is worth naming. */
export const COLLAPSE_RATIO = 0.35;

/** Below this, there is not enough history to say anything about rate. */
const MIN_DAYS_FOR_COLLAPSE = 730;

/** Two readings this close together should agree. */
const CONFLICT_WINDOW_DAYS = 14;

/** And should not differ by more than this when they do not. */
const CONFLICT_TOLERANCE_KM = 500;

/** A stretch of history this long with nothing in it is worth mentioning. */
export const THIN_HISTORY_DAYS = 550;

function days(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000;
}

function on(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function km(value: number): string {
  return value.toLocaleString('en-GB');
}

function perYear(kmPerDay: number): number {
  return Math.round(kmPerDay * 365);
}

/**
 * Every reading that is lower than one recorded before it.
 *
 * Two shapes, reported differently. A rollback at the end of the history is
 * visible to anybody comparing the last two readings. A rollback in the middle,
 * with higher readings on both sides, is the one that survives an ordinary
 * check, and is worth saying so plainly because the current reading looks
 * perfectly normal.
 */
function rollbacks(ordered: readonly HistoryReading[]): HistoryFinding[] {
  const found: HistoryFinding[] = [];

  let highest = ordered[0];

  for (let index = 1; index < ordered.length; index += 1) {
    const reading = ordered[index]!;

    if (!highest || reading.km >= highest.km) {
      highest = reading;
      continue;
    }

    const lost = highest.km - reading.km;

    // Is there a later reading above the earlier peak? If so, the sequence
    // recovered and nothing at the end of the history looks wrong.
    const masked = ordered.slice(index + 1).some((later) => later.km >= highest!.km);

    found.push({
      kind: masked ? 'MASKED_ROLLBACK' : 'ROLLBACK',
      severity: 'SERIOUS',
      confidence: 'CERTAIN',
      at: reading.readAt,
      summary: `The odometer read ${km(lost)} fewer miles on ${on(reading.readAt)} than it had on ${on(highest.readAt)}.`,
      detail: masked
        ? `The reading fell from ${km(highest.km)} to ${km(reading.km)}, then later rose above the earlier figure again. Because the most recent readings are consistent with each other, a check that only compares the last two would show nothing wrong.`
        : `The reading fell from ${km(highest.km)} to ${km(reading.km)}. An odometer does not go backwards on its own. Either the instrument cluster was replaced, which a workshop should have recorded, or the reading was altered.`,
    });

    // Keep measuring against the peak. A second, deeper rollback after this
    // one is a separate event and should be reported as one.
  }

  return found;
}

/** Distances nobody drove. */
function implausibleRates(ordered: readonly HistoryReading[]): HistoryFinding[] {
  const found: HistoryFinding[] = [];

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const reading = ordered[index]!;

    const elapsed = days(previous.readAt, reading.readAt);
    if (elapsed < MIN_DAYS_FOR_RATE) continue;

    const rate = (reading.km - previous.km) / elapsed;
    if (rate <= IMPLAUSIBLE_KM_PER_DAY) continue;

    found.push({
      kind: 'IMPLAUSIBLE_RATE',
      severity: 'SERIOUS',
      confidence: 'CERTAIN',
      at: reading.readAt,
      summary: `${km(Math.round(rate))} miles a day between ${on(previous.readAt)} and ${on(reading.readAt)}.`,
      detail: `The reading rose by ${km(reading.km - previous.km)} miles in ${Math.round(elapsed)} days. Sustained over that period it is not a distance a road vehicle covers, so one of the two readings is wrong.`,
    });
  }

  return found;
}

/**
 * A vehicle that suddenly started covering far less ground.
 *
 * The signature of clocking before a sale, and also the signature of somebody
 * retiring, changing job, buying a second car or being ill. Reported as a
 * question and never as a conclusion, and only when there is enough history
 * behind it for the long-run figure to mean anything.
 */
function rateCollapse(ordered: readonly HistoryReading[]): HistoryFinding[] {
  const first = ordered[0];
  const last = ordered.at(-1);

  if (!first || !last || ordered.length < 4) return [];

  const span = days(first.readAt, last.readAt);
  if (span < MIN_DAYS_FOR_COLLAPSE) return [];

  const overall = (last.km - first.km) / span;
  if (overall <= 0) return [];

  // The most recent year, against everything before it.
  const cutoff = new Date(last.readAt.getTime() - 365 * 86_400_000);
  const recent = ordered.filter((reading) => reading.readAt >= cutoff);

  const recentFirst = recent[0];
  if (!recentFirst || recent.length < 2) return [];

  const recentSpan = days(recentFirst.readAt, last.readAt);
  if (recentSpan < 180) return [];

  const rate = (last.km - recentFirst.km) / recentSpan;

  if (rate >= overall * COLLAPSE_RATIO) return [];

  return [
    {
      kind: 'RATE_COLLAPSE',
      severity: 'CONCERN',
      confidence: 'POSSIBLE',
      at: recentFirst.readAt,
      summary: `Recent use is about ${km(perYear(rate))} miles a year, against ${km(perYear(overall))} over its life.`,
      detail: `This is worth asking the seller about, and it is not evidence of anything on its own. A change of job, retirement, illness or a second car all produce exactly this pattern. So does an altered odometer.`,
    },
  ];
}

/** Two records of the same fortnight that do not agree. */
function conflicts(ordered: readonly HistoryReading[]): HistoryFinding[] {
  const found: HistoryFinding[] = [];

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const reading = ordered[index]!;

    if (days(previous.readAt, reading.readAt) > CONFLICT_WINDOW_DAYS) continue;

    const gap = Math.abs(reading.km - previous.km);
    if (gap <= CONFLICT_TOLERANCE_KM) continue;

    // Only interesting when two different parties recorded them. One workshop
    // writing two figures in a fortnight is a typo to fix, not a conflict.
    const differentParties = previous.orgId && reading.orgId && previous.orgId !== reading.orgId;
    if (!differentParties) continue;

    found.push({
      kind: 'CONFLICT',
      severity: 'CONCERN',
      confidence: 'LIKELY',
      at: reading.readAt,
      summary: `Two workshops recorded readings ${km(gap)} miles apart within a fortnight.`,
      detail: `${previous.orgName ?? 'One workshop'} recorded ${km(previous.km)} on ${on(previous.readAt)} and ${reading.orgName ?? 'another'} recorded ${km(reading.km)} on ${on(reading.readAt)}. One of them is wrong, and a typed digit is the most common reason.`,
    });
  }

  return found;
}

/** Long stretches with nothing recorded. Absence, reported as absence. */
function thinHistory(ordered: readonly HistoryReading[], now: Date): HistoryFinding[] {
  const found: HistoryFinding[] = [];

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]!;
    const reading = ordered[index]!;

    const gap = days(previous.readAt, reading.readAt);
    if (gap < THIN_HISTORY_DAYS) continue;

    found.push({
      kind: 'THIN_HISTORY',
      severity: 'INFO',
      confidence: 'CERTAIN',
      at: previous.readAt,
      summary: `Nothing recorded between ${on(previous.readAt)} and ${on(reading.readAt)}.`,
      detail: `A gap of about ${Math.round(gap / 30)} months. This says only that nobody wrote anything down, which is ordinary for a vehicle serviced outside the network. It is not a finding against the vehicle.`,
    });
  }

  const last = ordered.at(-1);

  if (last && days(last.readAt, now) >= THIN_HISTORY_DAYS) {
    found.push({
      kind: 'THIN_HISTORY',
      severity: 'INFO',
      confidence: 'CERTAIN',
      at: last.readAt,
      summary: `Nothing recorded since ${on(last.readAt)}.`,
      detail: `The most recent entry is about ${Math.round(days(last.readAt, now) / 30)} months old, so the current mileage is unknown rather than unchanged.`,
    });
  }

  return found;
}

const SEVERITY_ORDER: Record<HistorySeverity, number> = { SERIOUS: 0, CONCERN: 1, INFO: 2 };

/**
 * Everything worth saying about a vehicle's mileage record.
 *
 * Ordered by how much it matters and then by recency, because somebody reading
 * this on a forecourt reads the first two lines.
 */
export function inspectHistory(
  readings: readonly HistoryReading[],
  now: Date = new Date(),
): HistoryFinding[] {
  if (readings.length < 2) return [];

  const ordered = [...readings].sort((a, b) => a.readAt.getTime() - b.readAt.getTime());

  return [
    ...rollbacks(ordered),
    ...implausibleRates(ordered),
    ...rateCollapse(ordered),
    ...conflicts(ordered),
    ...thinHistory(ordered, now),
  ].sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || b.at.getTime() - a.at.getTime(),
  );
}

/**
 * The sentence at the top of the page.
 *
 * Written to be read by somebody deciding whether to buy a car, so it says
 * what was found and what was looked at. "Nothing found" has to be qualified
 * by how much history there was to look through, or it reads as a guarantee.
 */
export function summariseHistory(
  findings: readonly HistoryFinding[],
  readingCount: number,
): string {
  const serious = findings.filter((finding) => finding.severity === 'SERIOUS');
  const concerns = findings.filter((finding) => finding.severity === 'CONCERN');

  if (serious.length > 0) {
    return `The mileage record contradicts itself. ${serious.length === 1 ? 'One reading is' : `${serious.length} readings are`} impossible given the others.`;
  }

  if (concerns.length > 0) {
    return `Nothing in the record is impossible, but ${concerns.length === 1 ? 'there is one thing' : `there are ${concerns.length} things`} worth asking about.`;
  }

  if (readingCount < 3) {
    return `Too few readings to say much. ${readingCount === 1 ? 'One reading' : `${readingCount} readings`} on record.`;
  }

  return `Nothing inconsistent across ${readingCount} readings. That is as much as the record can show; it cannot speak for time nobody wrote anything down.`;
}
