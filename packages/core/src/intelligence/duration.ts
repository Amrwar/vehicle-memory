/**
 * How long jobs really take, against how long they were sold for.
 *
 * A workshop quotes from a book time or from habit, and the difference between
 * that figure and reality is where the money goes. It is invisible day to day
 * because a job that overruns by forty minutes still gets finished; it only
 * shows up as a month that was busy and unprofitable.
 *
 * The median rather than the mean, because one job where somebody left the
 * clock running over lunch moves a mean and does not move a median. The spread
 * is reported alongside it, because a job type that is sometimes an hour and
 * sometimes four is a scheduling problem whatever its average is, and an
 * average hides exactly that.
 *
 * Below a floor of samples there is no answer. Two jobs cannot tell you
 * anything about the third, and a confident figure derived from two is worse
 * than no figure, because somebody will schedule against it.
 */

/** Below this many completed jobs, say nothing. */
export const MIN_SAMPLES = 5;

export interface Sample {
  jobId: string;
  /** Actual minutes booked to the job. */
  minutes: number;
  /** What it was estimated at, where an estimate was made. */
  estimatedMinutes: number | null;
  completedAt: Date;
}

export type Estimate =
  | { known: false; samples: number; reason: string }
  | {
      known: true;
      /** The middle of the distribution, in minutes. */
      median: number;
      /** A quarter of jobs finish faster than this. */
      quickest: number;
      /** A quarter take longer than this. */
      slowest: number;
      samples: number;
      /** How wide the middle half is, relative to the median. */
      spread: number;
      reason: string;
    };

function quantile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) return 0;

  const position = (sorted.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);

  if (lower === upper) return sorted[lower] ?? 0;

  const weight = position - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

/**
 * What this kind of job actually takes.
 *
 * The spread is the part worth reading. A median of ninety minutes with a
 * middle half between eighty and a hundred is a job you can book confidently.
 * The same median with a middle half between forty and four hours is not one
 * job, it is several different jobs sharing a name.
 */
export function durationFor(samples: readonly Sample[]): Estimate {
  const usable = samples.filter((sample) => sample.minutes > 0);

  if (usable.length < MIN_SAMPLES) {
    return {
      known: false,
      samples: usable.length,
      reason: `Only ${usable.length} completed ${usable.length === 1 ? 'job' : 'jobs'} on record. Too few to schedule against.`,
    };
  }

  const minutes = usable.map((sample) => sample.minutes).sort((a, b) => a - b);

  const median = Math.round(quantile(minutes, 0.5));
  const quickest = Math.round(quantile(minutes, 0.25));
  const slowest = Math.round(quantile(minutes, 0.75));

  const spread = median > 0 ? (slowest - quickest) / median : 0;

  return {
    known: true,
    median,
    quickest,
    slowest,
    samples: usable.length,
    spread,
    reason:
      spread > 1
        ? `These jobs vary too much to be one job. The middle half runs from ${quickest} to ${slowest} minutes, so booking to the median will be wrong most of the time.`
        : `Half of these finish between ${quickest} and ${slowest} minutes, across ${usable.length} jobs.`,
  };
}

export interface Quoting {
  jobType: string;
  estimate: Estimate;
  /** What the workshop books it at, in minutes. */
  booked: number | null;
  /** Actual median minus booked. Positive means it runs over. */
  gapMinutes: number | null;
  verdict: 'UNDERQUOTED' | 'OVERQUOTED' | 'ABOUT_RIGHT' | 'UNKNOWN';
  note: string;
}

/** Ignore differences smaller than this share of the booked time. */
const QUOTING_TOLERANCE = 0.15;

/**
 * Whether a job type is sold for what it costs to do.
 *
 * Both directions matter and only one is obvious. Underquoting shows up in
 * the accounts eventually. Overquoting never shows up at all: the work is
 * profitable, the diary has holes in it nobody can explain, and the workshop
 * concludes it needs more customers.
 */
export function assessQuoting(input: {
  jobType: string;
  samples: readonly Sample[];
  bookedMinutes: number | null;
}): Quoting {
  const estimate = durationFor(input.samples);

  if (!estimate.known || input.bookedMinutes === null || input.bookedMinutes <= 0) {
    return {
      jobType: input.jobType,
      estimate,
      booked: input.bookedMinutes,
      gapMinutes: null,
      verdict: 'UNKNOWN',
      note: estimate.known
        ? 'Nothing on record for what this is normally booked at.'
        : estimate.reason,
    };
  }

  const gap = estimate.median - input.bookedMinutes;
  const relative = gap / input.bookedMinutes;

  if (Math.abs(relative) < QUOTING_TOLERANCE) {
    return {
      jobType: input.jobType,
      estimate,
      booked: input.bookedMinutes,
      gapMinutes: gap,
      verdict: 'ABOUT_RIGHT',
      note: `Booked at ${input.bookedMinutes} minutes and typically takes ${estimate.median}.`,
    };
  }

  return gap > 0
    ? {
        jobType: input.jobType,
        estimate,
        booked: input.bookedMinutes,
        gapMinutes: gap,
        verdict: 'UNDERQUOTED',
        note: `Booked at ${input.bookedMinutes} minutes and typically takes ${estimate.median}, so about ${Math.round(gap)} minutes of every one of these is unpaid.`,
      }
    : {
        jobType: input.jobType,
        estimate,
        booked: input.bookedMinutes,
        gapMinutes: gap,
        verdict: 'OVERQUOTED',
        note: `Booked at ${input.bookedMinutes} minutes and typically takes ${estimate.median}. The work pays, but the diary is holding ${Math.abs(Math.round(gap))} minutes a time that could be sold.`,
      };
}

/**
 * The job types worth changing, biggest cost first.
 *
 * Ranked by total minutes across all the jobs of that type rather than by the
 * gap on one, because twenty minutes on a job done four times a day costs far
 * more than two hours on a job done twice a year.
 */
export function worstQuoted(assessments: readonly Quoting[]): Quoting[] {
  return assessments
    .filter(
      (assessment) => assessment.verdict === 'UNDERQUOTED' || assessment.verdict === 'OVERQUOTED',
    )
    .sort((a, b) => {
      const cost = (assessment: Quoting) =>
        Math.abs(assessment.gapMinutes ?? 0) *
        (assessment.estimate.known ? assessment.estimate.samples : 0);

      return cost(b) - cost(a);
    });
}
