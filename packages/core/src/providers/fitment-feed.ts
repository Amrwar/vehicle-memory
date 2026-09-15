import { normalisePartNumber } from '../inventory/catalogue';

/**
 * What a part fits, from somebody's catalogue. Phase 43.
 *
 * A feed is a seam: given a part number and brand, it answers with the
 * vehicles the catalogue says the part fits. Real catalogues are licensed
 * and every supplier's is shaped differently, so the product holds the
 * shape of the question and the rules for taking the answer in, and a
 * deployment names the feed.
 *
 * The rules are the feature. What somebody here recorded is never replaced
 * by a catalogue, because the person who typed it had the car on the ramp.
 * A claim already held is not written twice. And what a feed said last time
 * and no longer says is taken away, because a catalogue that withdraws a
 * fitment usually withdrew it for a reason.
 */

export type FeedSource = 'MANUFACTURER' | 'SUPPLIER';

export interface FeedFitment {
  make: string;
  model?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  engineCode?: string | null;
  note?: string | null;
}

export interface FitmentFeed {
  /** Stored against every row the feed wrote, so the next fetch knows its own. */
  readonly name: string;
  readonly source: FeedSource;
  /** Whether the feed can say anything useful about parts it was not built for. */
  readonly sample: boolean;
  lookup(part: { partNumber: string; brand: string | null }): Promise<FeedFitment[]>;
}

/** A fitment already recorded against the part. */
export interface HeldFitment {
  id: string;
  make: string;
  model: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engineCode: string | null;
  source: string;
  feedName: string | null;
}

/** The most rows one fetch may write to one part. */
export const FEED_ROWS_PER_PART = 200;

const clean = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

const year = (value: number | null | undefined): number | null | undefined => {
  if (value === null || value === undefined) return null;
  return Number.isInteger(value) && value >= 1885 && value <= 2200 ? value : undefined;
};

/**
 * A feed row as it may be written, or null when it cannot be.
 *
 * A row with no maker, a year that is not a year, or years the wrong way
 * round is dropped rather than repaired. A catalogue that sends that has
 * made a mistake nobody here can correct.
 */
export function cleanFeedFitment(row: FeedFitment): FeedFitment | null {
  const make = clean(row.make);
  const from = year(row.yearFrom);
  const to = year(row.yearTo);
  if (!make || from === undefined || to === undefined) return null;
  if (from !== null && to !== null && from > to) return null;

  return {
    make,
    model: clean(row.model),
    yearFrom: from,
    yearTo: to,
    engineCode: clean(row.engineCode),
    note: clean(row.note),
  };
}

/** Two claims are the same claim when they name the same vehicles. */
export function fitmentKey(row: {
  make: string;
  model?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  engineCode?: string | null;
}): string {
  return [
    row.make.trim().toLowerCase(),
    row.model?.trim().toLowerCase() ?? '',
    row.yearFrom ?? '',
    row.yearTo ?? '',
    row.engineCode?.trim().toLowerCase() ?? '',
  ].join('|');
}

export interface FeedImportPlan {
  /** New rows to write, stamped with the feed. */
  create: FeedFitment[];
  /** Rows this feed wrote before and no longer sends. */
  remove: string[];
  /** Claims already held, from this feed or another catalogue. */
  unchanged: number;
  /** Claims the feed sent that somebody here had already recorded. */
  keptWorkshop: number;
  /** Rows the feed sent that could not be written. */
  invalid: number;
}

/**
 * What a fetch changes, decided before anything is written.
 *
 * Only rows this same feed wrote are ever removed; a workshop's rows, the
 * manufacturer's rows typed in by hand and another feed's rows stay as they
 * are. Past the per-part limit the rest are counted as invalid rather than
 * written, so one bad catalogue cannot fill a part with thousands of rows.
 */
export function planFeedImport(
  held: readonly HeldFitment[],
  incoming: readonly FeedFitment[],
  feedName: string,
): FeedImportPlan {
  const heldByKey = new Map<string, HeldFitment[]>();
  for (const row of held) {
    const key = fitmentKey(row);
    heldByKey.set(key, [...(heldByKey.get(key) ?? []), row]);
  }

  const create: FeedFitment[] = [];
  const sent = new Set<string>();
  let unchanged = 0;
  let keptWorkshop = 0;
  let invalid = 0;

  for (const raw of incoming) {
    const row = cleanFeedFitment(raw);
    if (!row) {
      invalid += 1;
      continue;
    }

    const key = fitmentKey(row);
    if (sent.has(key)) continue;
    sent.add(key);

    const existing = heldByKey.get(key) ?? [];
    if (existing.some((entry) => entry.source === 'WORKSHOP')) {
      keptWorkshop += 1;
    } else if (existing.length > 0) {
      unchanged += 1;
    } else if (create.length + held.length >= FEED_ROWS_PER_PART) {
      invalid += 1;
    } else {
      create.push(row);
    }
  }

  const remove = held
    .filter((row) => row.feedName === feedName && !sent.has(fitmentKey(row)))
    .map((row) => row.id);

  return { create, remove, unchanged, keptWorkshop, invalid };
}

/**
 * The sample feed.
 *
 * It knows the demonstration parts and nothing else, and says so: a workshop
 * that fetches for a part of its own is told the feed has nothing, never
 * handed an invented fitment.
 */
const SAMPLE_CATALOGUE: Readonly<Record<string, FeedFitment[]>> = {
  '34116794300': [
    { make: 'BMW', model: 'X5', yearFrom: 2018, yearTo: 2023 },
    { make: 'BMW', model: 'X6', yearFrom: 2019, yearTo: 2023 },
  ],
  '34116864059': [
    { make: 'BMW', model: '320d', yearFrom: 2015, yearTo: 2021 },
    { make: 'BMW', model: '330i', yearFrom: 2016, yearTo: 2019 },
  ],
  '04152-YZZA1': [
    { make: 'Toyota', model: 'Corolla', yearFrom: 2018 },
    { make: 'Toyota', model: 'C-HR', yearFrom: 2017 },
    { make: 'Toyota', model: 'RAV4', yearFrom: 2019 },
  ],
  '87139-0D070': [
    { make: 'Toyota', model: 'Corolla' },
    { make: 'Toyota', model: 'Yaris', yearFrom: 2011, yearTo: 2020 },
  ],
};

export const sampleFitmentFeed: FitmentFeed = {
  name: 'Sample catalogue',
  source: 'SUPPLIER',
  sample: true,
  lookup: async (part) => SAMPLE_CATALOGUE[normalisePartNumber(part.partNumber)] ?? [],
};
