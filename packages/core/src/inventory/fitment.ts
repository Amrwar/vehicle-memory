/**
 * Which vehicles a part fits, and what to say when nobody knows.
 *
 * The dangerous answer here is not "it does not fit". It is silence read as
 * approval. A parts screen that shows nothing when it has no fitment data
 * teaches somebody that no warning means the part is right, and the day it
 * finally does have data for one part and not another, the silence means two
 * different things and nobody can tell which.
 *
 * So there are three states and never two. It fits, it does not fit, or
 * nobody has said. The third is not a failure of the feature; it is the
 * honest majority of the time until a fitment provider is wired in, and the
 * screens are built to show it without looking broken.
 *
 * Fitment data itself is not invented here. Guessing which pads fit a
 * particular car puts the wrong pads on it, and the person who finds out is
 * braking.
 */

export type FitVerdict = 'FITS' | 'DOES_NOT_FIT' | 'UNKNOWN';

/** Where a fitment claim came from, which changes how much it is worth. */
export type FitmentSource = 'SUPPLIER' | 'MANUFACTURER' | 'WORKSHOP' | 'OBSERVED';

export interface Fitment {
  make: string;
  model: string | null;
  /** Inclusive. Null at either end means open in that direction. */
  yearFrom: number | null;
  yearTo: number | null;
  /** Narrows further where a model spans two engines. */
  engineCode: string | null;
  source: FitmentSource;
  note: string | null;
}

export interface VehicleFacts {
  make: string | null;
  model: string | null;
  year: number | null;
  engineCode?: string | null;
}

export interface FitResult {
  verdict: FitVerdict;
  /** The entry that decided it, where one did. */
  matched: Fitment | null;
  /** A sentence for the screen, never a bare verdict. */
  why: string;
  /**
   * How much weight to put on it. An observation from one workshop's own
   * history is worth less than a manufacturer's catalogue, and a screen that
   * presented both as "fits" would be lying by omission.
   */
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
}

/** Case and spacing differ between catalogues; the vehicle does not. */
function same(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function withinYears(fitment: Fitment, year: number | null): boolean {
  // A vehicle with no year cannot be excluded on year. Treating a missing
  // year as outside the range would report a perfectly good part as wrong.
  if (year == null) return true;
  if (fitment.yearFrom != null && year < fitment.yearFrom) return false;
  if (fitment.yearTo != null && year > fitment.yearTo) return false;
  return true;
}

const CONFIDENCE: Record<FitmentSource, FitResult['confidence']> = {
  MANUFACTURER: 'HIGH',
  SUPPLIER: 'HIGH',
  WORKSHOP: 'MEDIUM',
  OBSERVED: 'LOW',
};

function describe(fitment: Fitment): string {
  const years =
    fitment.yearFrom && fitment.yearTo
      ? ` ${fitment.yearFrom}–${fitment.yearTo}`
      : fitment.yearFrom
        ? ` ${fitment.yearFrom} onwards`
        : fitment.yearTo
          ? ` up to ${fitment.yearTo}`
          : '';

  return `${fitment.make}${fitment.model ? ` ${fitment.model}` : ''}${years}`;
}

/**
 * Whether a part fits a vehicle.
 *
 * Linear in the number of fitment entries for that part, which is tens. The
 * order of the checks matters: a match on make and model wins over a
 * make-only entry, so the specific claim decides rather than whichever row
 * came back first.
 */
export function fitsVehicle(
  fitments: readonly Fitment[],
  vehicle: VehicleFacts,
  partName = 'This part',
): FitResult {
  if (fitments.length === 0) {
    return {
      verdict: 'UNKNOWN',
      matched: null,
      why: `Nobody has recorded what ${partName.toLowerCase()} fits. That is not the same as it fitting.`,
      confidence: 'NONE',
    };
  }

  if (!vehicle.make) {
    return {
      verdict: 'UNKNOWN',
      matched: null,
      why: 'The vehicle has no make on record, so nothing can be checked against it.',
      confidence: 'NONE',
    };
  }

  const sameMake = fitments.filter((fitment) => same(fitment.make, vehicle.make));

  if (sameMake.length === 0) {
    return {
      verdict: 'DOES_NOT_FIT',
      matched: null,
      why: `Recorded as fitting ${[...new Set(fitments.map((entry) => entry.make))].join(', ')}, and this is a ${vehicle.make}.`,
      confidence: 'HIGH',
    };
  }

  // A claim naming the model beats one naming only the make. Otherwise a
  // catalogue-wide "fits Ford" would settle a question a model-specific row
  // was there to answer.
  const ranked = [...sameMake].sort((a, b) => {
    const specificity = (fitment: Fitment) =>
      (fitment.model ? 2 : 0) + (fitment.engineCode ? 1 : 0);
    return specificity(b) - specificity(a);
  });

  for (const fitment of ranked) {
    if (fitment.model && !same(fitment.model, vehicle.model)) continue;
    if (!withinYears(fitment, vehicle.year)) continue;

    // An engine code on the entry and none on the vehicle is not a match and
    // not a refusal. It is the question nobody can answer yet.
    if (fitment.engineCode && !vehicle.engineCode) {
      return {
        verdict: 'UNKNOWN',
        matched: fitment,
        why: `Fits ${describe(fitment)} with engine ${fitment.engineCode}. This vehicle has no engine code on record, so check it before fitting.`,
        confidence: 'NONE',
      };
    }

    if (fitment.engineCode && !same(fitment.engineCode, vehicle.engineCode)) continue;

    return {
      verdict: 'FITS',
      matched: fitment,
      why: `Recorded as fitting ${describe(fitment)}${fitment.source === 'OBSERVED' ? ', from this workshop having fitted one before' : ''}.`,
      confidence: CONFIDENCE[fitment.source],
    };
  }

  // Right make, wrong everything else. That is a real refusal rather than a
  // gap, because somebody has described this make in enough detail to exclude
  // this car.
  const near = ranked[0]!;

  return {
    verdict: 'DOES_NOT_FIT',
    matched: near,
    why: `Recorded for ${[...new Set(ranked.map(describe))].slice(0, 3).join('; ')}. This is a ${[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}.`,
    confidence: CONFIDENCE[near.source],
  };
}

/**
 * The line a job screen shows, if any.
 *
 * Only two of the three verdicts are worth interrupting somebody for. A part
 * that fits needs no sentence, and a screen that congratulated the user on
 * every correct line would train them to dismiss the one that mattered.
 */
export function fitmentWarning(result: FitResult): string | null {
  if (result.verdict === 'DOES_NOT_FIT') return result.why;
  if (result.verdict === 'UNKNOWN' && result.matched) return result.why;
  return null;
}
