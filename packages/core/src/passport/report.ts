/**
 * The report a seller hands a buyer, and a buyer can check.
 *
 * This is the point where an append-only chain stops being a technical
 * curiosity and becomes the reason somebody pays more for one car than
 * another. A buyer standing in a stranger's driveway does not care about
 * hashes. They care whether the thing they are reading was written by
 * somebody with no reason to lie, and whether anything has been taken out.
 *
 * So the report has three parts and they are always in this order. What the
 * record says. What it does not cover. Whether it is intact.
 *
 * The second part is the one that earns the first. A report that lists
 * twenty-seven service events and says nothing about the four years before
 * them is a report designed to be misread, and the person it misleads is the
 * one with the money.
 */

export type Verdict = 'INTACT' | 'BROKEN' | 'UNVERIFIED';

export interface ReportInput {
  /** Distinct owners on record, including the current one. */
  owners: number;
  /** Events in the vehicle's chain, of any kind. */
  events: number;
  serviceEvents: number;
  inspections: number;
  /** Findings marked critical at the most recent inspection and not resolved. */
  unresolvedCritical: number;
  unresolvedAdvisory: number;
  /** Recalls known to be outstanding. */
  openRecalls: number;
  odometerKm: number | null;
  firstRecordAt: Date | null;
  lastServiceAt: Date | null;
  firstRegisteredAt: Date | null;
  /** Odometer readings the product itself flagged as implausible. */
  mileageAnomalies: number;
  /** The chain verification, which is the only part a buyer cannot fake. */
  chain: Verdict;
  now?: Date;
  /** The reader's locale, for the dates and numbers inside the sentences. Phase 40.5. */
  locale?: string;
}

export interface ReportLine {
  label: string;
  value: string;
  /** Set where the figure is a reason to ask a question. */
  concern?: 'WARN' | 'STOP';
}

export interface Report {
  headline: ReportLine[];
  /** What the record does not cover, stated before anybody has to ask. */
  gaps: string[];
  /** Things a buyer should raise with the seller. */
  questions: string[];
  chain: Verdict;
  chainWords: string;
  /**
   * A plain verdict for somebody who reads one line. Never a score: a number
   * invites comparison between two cars whose records cover different things.
   */
  verdict: string;
}

function years(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (365.25 * 86_400_000));
}

/** Set and restored around one synchronous buildReport call. */
let locale = 'en-GB';

function date(value: Date): string {
  return value.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

/**
 * The report.
 *
 * Pure arithmetic over figures gathered elsewhere, so the same numbers appear
 * on the seller's screen, the buyer's page and any printed version without
 * three implementations drifting apart.
 */
export function buildReport(input: ReportInput): Report {
  const previous = locale;
  locale = input.locale ?? 'en-GB';
  try {
    return reportOf(input);
  } finally {
    locale = previous;
  }
}

function reportOf(input: ReportInput): Report {
  const now = input.now ?? new Date();

  const headline: ReportLine[] = [
    { label: 'Owners on record', value: String(input.owners) },
    { label: 'Recorded events', value: String(input.events) },
    { label: 'Services', value: String(input.serviceEvents) },
    { label: 'Inspections', value: String(input.inspections) },
    {
      label: 'Unresolved critical items',
      value: String(input.unresolvedCritical),
      concern: input.unresolvedCritical > 0 ? 'STOP' : undefined,
    },
    {
      label: 'Outstanding recalls',
      value: String(input.openRecalls),
      concern: input.openRecalls > 0 ? 'STOP' : undefined,
    },
    {
      label: 'Mileage recorded',
      value: input.odometerKm == null ? 'None' : `${input.odometerKm.toLocaleString(locale)} km`,
    },
    {
      label: 'Last service',
      value: input.lastServiceAt ? date(input.lastServiceAt) : 'None on record',
      concern:
        input.lastServiceAt && years(input.lastServiceAt, now) > 2
          ? 'WARN'
          : input.lastServiceAt
            ? undefined
            : 'WARN',
    },
  ];

  /* --- what this does not cover --------------------------------------------- */

  const gaps: string[] = [];

  if (input.firstRegisteredAt && input.firstRecordAt) {
    const uncovered = years(input.firstRegisteredAt, input.firstRecordAt);
    if (uncovered >= 1) {
      gaps.push(
        `The record starts in ${date(input.firstRecordAt)}, and the vehicle was first registered in ${date(input.firstRegisteredAt)}. About ${Math.floor(uncovered)} year${Math.floor(uncovered) === 1 ? '' : 's'} before that is not covered here at all.`,
      );
    }
  } else if (!input.firstRecordAt) {
    gaps.push('Nothing is recorded for this vehicle yet.');
  }

  if (input.serviceEvents === 0) {
    gaps.push('No service has been recorded, which is not the same as none having been done.');
  }

  if (input.inspections === 0) {
    gaps.push(
      'Nothing here was inspected by a workshop, so the condition of the vehicle is not part of this record.',
    );
  }

  gaps.push(
    'This covers what participating workshops recorded. Work done elsewhere, or by the owner, does not appear.',
  );

  /* --- what to ask ---------------------------------------------------------- */

  const questions: string[] = [];

  if (input.unresolvedCritical > 0) {
    questions.push(
      `${input.unresolvedCritical} critical item${input.unresolvedCritical === 1 ? ' was' : 's were'} found and ${input.unresolvedCritical === 1 ? 'has' : 'have'} not been recorded as put right. Ask for the invoice, not a description.`,
    );
  }

  if (input.openRecalls > 0) {
    questions.push(
      `${input.openRecalls} manufacturer recall${input.openRecalls === 1 ? '' : 's'} shows as outstanding. A franchised dealer does these free; ask whether it has been done and is simply unrecorded.`,
    );
  }

  if (input.mileageAnomalies > 0) {
    questions.push(
      `${input.mileageAnomalies} odometer reading${input.mileageAnomalies === 1 ? '' : 's'} did not follow the one before it. That has innocent explanations, and it also has one that is not. Ask.`,
    );
  }

  if (input.lastServiceAt && years(input.lastServiceAt, now) > 2) {
    questions.push(
      `The last recorded service was ${date(input.lastServiceAt)}. Ask what has been done since and where.`,
    );
  }

  if (input.owners >= 4 && input.owners > 0) {
    questions.push(
      `${input.owners} owners is a lot for one vehicle. Not a fault in itself, and worth a question.`,
    );
  }

  /* --- whether it is intact -------------------------------------------------- */

  const chainWords =
    input.chain === 'INTACT'
      ? 'Every record in this history was checked against the one before it, and nothing has been altered or removed since it was written.'
      : input.chain === 'BROKEN'
        ? 'This history does not check out. A record has been altered or removed since it was written, and nothing here should be relied on.'
        : 'This history could not be checked. Treat it as unverified.';

  const verdict =
    input.chain === 'BROKEN'
      ? 'Do not rely on this record.'
      : input.unresolvedCritical > 0 || input.openRecalls > 0
        ? 'The record is intact, and it has things in it to ask about.'
        : input.events === 0
          ? 'There is nothing on record for this vehicle.'
          : input.serviceEvents >= 3 && input.inspections > 0
            ? 'A full record, intact, with nothing outstanding on it.'
            : 'Intact, but thin. Read what it does not cover as carefully as what it does.';

  return { headline, gaps, questions, chain: input.chain, chainWords, verdict };
}
