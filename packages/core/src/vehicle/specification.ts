/**
 * What the car takes.
 *
 * A technician about to service a car needs fourteen numbers: the oil grade
 * and how much of it, the coolant, the brake fluid, the tyre sizes and
 * pressures, the battery, and how often the whole thing comes back. Every one
 * of them is in a handbook somebody is not holding, and the cost of getting
 * one wrong runs from a warning light to a seized engine.
 *
 * The obvious implementation buys a universal specification database. There
 * isn't a good cheap one, the good ones are licensed per lookup, and — this is
 * the part that decides it — **a wrong oil grade is an engine**. A sheet that
 * fills in 5W-30 because it half-recognised the model is worse than a sheet
 * that says nothing, because the blank sends somebody to look it up and the
 * wrong number does not.
 *
 * So, the same shape as fitment and substitution before it: nothing is
 * invented, every line says where it came from, and **a blank is a blank**.
 *
 * ## Where a line comes from
 *
 * Three sources, most specific first. A car-specific line beats the model
 * sheet, because somebody wrote it down while looking at *that* car — a
 * retrofitted engine, non-standard tyres, an owner who wants a heavier oil.
 * The model sheet beats a feed for the same reason it does everywhere else in
 * this product: a workshop that services forty of these a year knows.
 *
 * ## Why this is "VIN to a specification sheet"
 *
 * Because of the inheritance. A car is added from its VIN, which Phase 43
 * decodes into make, model, year and engine — and that is the key of the model
 * sheet. The workshop writes the sheet once and every car that decodes to it
 * arrives holding the numbers. Nobody types fourteen figures per car, and
 * nobody buys a database.
 *
 * Phase 88.
 */

/** Where a line on the sheet came from, strongest first. */
export const SPEC_SOURCES = ['THIS_CAR', 'MODEL_SHEET', 'FEED'] as const;

export type SpecSource = (typeof SPEC_SOURCES)[number];

export const SPEC_SOURCE_SENTENCE: Record<SpecSource, string> = {
  THIS_CAR: 'Recorded for this car',
  MODEL_SHEET: 'From your sheet for this model',
  FEED: 'From a data feed',
};

/**
 * The fourteen lines, and what kind of thing each one is.
 *
 * Exported as data rather than as a set of interface fields so that the
 * screens, the forms and the checks all iterate the same list. A hand-written
 * list in the component is a list that grows a fifteenth line six months after
 * the sheet does.
 */
export const SPEC_LINES = [
  { key: 'oilGrade', group: 'engine', label: 'Engine oil', unit: null, kind: 'text' },
  { key: 'oilCapacityL', group: 'engine', label: 'Oil capacity', unit: 'L', kind: 'decimal' },
  { key: 'coolantType', group: 'engine', label: 'Coolant', unit: null, kind: 'text' },
  {
    key: 'coolantCapacityL',
    group: 'engine',
    label: 'Coolant capacity',
    unit: 'L',
    kind: 'decimal',
  },
  { key: 'brakeFluid', group: 'brakes', label: 'Brake fluid', unit: null, kind: 'text' },
  { key: 'tyreFront', group: 'tyres', label: 'Front tyres', unit: null, kind: 'text' },
  { key: 'tyreRear', group: 'tyres', label: 'Rear tyres', unit: null, kind: 'text' },
  {
    key: 'tyrePressureFrontBar',
    group: 'tyres',
    label: 'Front pressure',
    unit: 'bar',
    kind: 'decimal',
  },
  {
    key: 'tyrePressureRearBar',
    group: 'tyres',
    label: 'Rear pressure',
    unit: 'bar',
    kind: 'decimal',
  },
  { key: 'batteryType', group: 'battery', label: 'Battery', unit: null, kind: 'text' },
  { key: 'batteryAh', group: 'battery', label: 'Capacity', unit: 'Ah', kind: 'whole' },
  { key: 'batteryCca', group: 'battery', label: 'Cold cranking', unit: 'A', kind: 'whole' },
  {
    key: 'serviceIntervalMonths',
    group: 'intervals',
    label: 'Service every',
    unit: 'months',
    kind: 'whole',
  },
  { key: 'serviceIntervalKm', group: 'intervals', label: 'or every', unit: 'km', kind: 'whole' },
] as const;

export type SpecKey = (typeof SPEC_LINES)[number]['key'];
export type SpecGroup = (typeof SPEC_LINES)[number]['group'];
export type SpecKind = (typeof SPEC_LINES)[number]['kind'];

const KIND = Object.fromEntries(SPEC_LINES.map((line) => [line.key, line.kind])) as Record<
  SpecKey,
  SpecKind
>;

export function specKindOf(key: SpecKey): SpecKind {
  return KIND[key];
}

export const SPEC_KEYS: readonly SpecKey[] = SPEC_LINES.map((line) => line.key);

/** One sheet as it was written down, by a person or a feed. */
export type SpecValues = Partial<Record<SpecKey, string | number | null>>;

export interface SpecCandidate {
  source: SpecSource;
  values: SpecValues;
  /** The feed's name, where a feed wrote it, so the screen can say which. */
  feedName?: string | null;
  /** When it was written or fetched. */
  at?: Date | null;
}

export interface ResolvedLine {
  key: SpecKey;
  group: SpecGroup;
  label: string;
  unit: string | null;
  value: string | number;
  source: SpecSource;
  feedName: string | null;
  /**
   * Where a less specific source says something different.
   *
   * Not hidden, and not silently overruled. Two sources disagreeing about an
   * oil grade is the single most useful thing this sheet can tell anybody --
   * it means one of them is wrong about an engine, and somebody should find
   * out which before the drain plug comes out.
   */
  disagrees: { source: SpecSource; value: string | number }[];
}

function blank(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

const RANK: Record<SpecSource, number> = { THIS_CAR: 0, MODEL_SHEET: 1, FEED: 2 };

/**
 * The sheet, line by line, with the source of each and any argument about it.
 *
 * A line nobody has answered does not appear. `missing()` says which those
 * are, so the screen can ask for them rather than showing fourteen dashes.
 */
export function resolveSpec(candidates: readonly SpecCandidate[]): ResolvedLine[] {
  const ordered = [...candidates].sort((a, b) => RANK[a.source] - RANK[b.source]);

  return SPEC_LINES.flatMap<ResolvedLine>((line) => {
    const answers = ordered.flatMap((candidate) => {
      const value = candidate.values[line.key];
      return blank(value) ? [] : [{ candidate, value: value as string | number }];
    });

    const first = answers[0];
    if (!first) return [];

    return [
      {
        key: line.key,
        group: line.group,
        label: line.label,
        unit: line.unit,
        value: first.value,
        source: first.candidate.source,
        feedName: first.candidate.feedName ?? null,
        disagrees: answers
          .slice(1)
          .filter((other) => String(other.value) !== String(first.value))
          .map((other) => ({ source: other.candidate.source, value: other.value })),
      },
    ];
  });
}

/** The lines nobody has answered, so the screen can ask rather than guess. */
export function missingSpec(resolved: readonly ResolvedLine[]): SpecKey[] {
  const answered = new Set(resolved.map((line) => line.key));
  return SPEC_KEYS.filter((key) => !answered.has(key));
}

/** Any line two sources argue about. Worth a banner, not a footnote. */
export function disagreements(resolved: readonly ResolvedLine[]): ResolvedLine[] {
  return resolved.filter((line) => line.disagrees.length > 0);
}

/**
 * How much of the sheet is filled in, as a count and never as a badge.
 *
 * Deliberately not a percentage with a colour. "Nine of fourteen" is a number
 * somebody can act on; "64% complete" is a number that makes a workshop feel
 * told off for not having typed a coolant capacity they have never needed.
 */
export function howFull(resolved: readonly ResolvedLine[]): { answered: number; of: number } {
  return { answered: resolved.length, of: SPEC_LINES.length };
}

/**
 * What a service schedule should be seeded with, where the sheet says.
 *
 * The intervals are the one part of the sheet that another feature already
 * wanted: `ServiceSchedule` has carried `intervalMonths` and `intervalKm` per
 * car since Phase 1, and until now somebody typed them in per car, from
 * memory, for every car of a model they service weekly.
 */
export function intervalsFrom(
  resolved: readonly ResolvedLine[],
): { months: number | null; km: number | null } | null {
  const find = (key: SpecKey) => resolved.find((line) => line.key === key)?.value ?? null;
  const months = find('serviceIntervalMonths');
  const km = find('serviceIntervalKm');
  if (months === null && km === null) return null;
  return { months: months === null ? null : Number(months), km: km === null ? null : Number(km) };
}

/**
 * What a form sent, turned into what the columns hold -- or refused.
 *
 * A pressure box is a text box until somebody types in it. `12,5`, `  4.6 `
 * and `4.6` are the same answer; `about 5` is not an answer at all, and the
 * important thing is that it becomes a refusal rather than a silent nought.
 * Nought bar is a real pressure and a real thing to be wrong about, so it can
 * never be what a bad number turns into.
 *
 * Empty clears the line. A part of the sheet nobody knows and a coolant
 * capacity of zero litres are different, and only one of them is true of any
 * car.
 */
export function coerceSpec(input: Partial<Record<SpecKey, unknown>>): {
  values: SpecValues;
  refused: SpecKey[];
} {
  const values: SpecValues = {};
  const refused: SpecKey[] = [];

  for (const key of SPEC_KEYS) {
    if (!(key in input)) continue;
    const raw = input[key];

    if (raw === null || raw === undefined || String(raw).trim() === '') {
      values[key] = null;
      continue;
    }

    if (specKindOf(key) === 'text') {
      values[key] = String(raw).trim();
      continue;
    }

    const number = Number(String(raw).trim().replace(',', '.'));
    if (!Number.isFinite(number)) {
      refused.push(key);
      continue;
    }

    values[key] = specKindOf(key) === 'whole' ? Math.round(number) : number;
  }

  return { values, refused };
}
