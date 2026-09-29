/**
 * Which sheet this inspection was taken on.
 *
 * `InspectionResult` has snapshotted the section and item names since Phase 1,
 * so a completed inspection keeps the words it was written with even after the
 * template changes. That was right and it was not enough, because it only
 * preserves **what was asked and answered**. It says nothing about what the
 * sheet asked that day and therefore nothing about **what it did not ask**.
 *
 * ## The silence that reads as approval
 *
 * A workshop adds "brake fluid condition" to its sheet in June. A customer
 * opens an inspection from March. There is no brake fluid line on it. Every
 * reading of that is wrong in a different way: it looks like an omission, or
 * like it passed, or like somebody forgot. The truth -- *it was not on the
 * sheet in March* -- is the one thing the record could not say.
 *
 * That is the same failure this product has refused everywhere else. Fitment
 * has three states so silence is never approval. A specification sheet leaves
 * a blank rather than guessing. A substitute is absent rather than weakly
 * suggested. An inspection should be able to say "this check did not include
 * brake fluid", and until a version is recorded it cannot.
 *
 * ## Why a fingerprint, and not a Publish button
 *
 * A version is cut by what the sheet *is*, not by somebody remembering to
 * press something. `fingerprintOf` reduces the ordered sections and items to
 * one string; an inspection starting looks for the version with that
 * fingerprint and cuts a new one only if none matches.
 *
 * Two things follow, both wanted. A workshop that edits its sheet twice
 * before anybody uses it produces one version, not three -- versions mark
 * *sheets that were used*, not keystrokes. And a workshop that removes an item
 * and then puts it back lands on the earlier version again, because the sheet
 * is once more the sheet it was, which is true and which a counter would have
 * got wrong.
 *
 * Phase 90.
 */

/**
 * What separates one field from the next inside a fingerprint, and one line
 * from the next.
 *
 * Needed at all because "Brake" + "s" and "Brakes" + "" are different sheets:
 * concatenating the fields with nothing between them gives both the same
 * fingerprint, and a workshop editing one into the other would go on using a
 * version that no longer described it.
 *
 * Written as escapes rather than as the characters themselves. An earlier
 * draft put the raw control bytes straight into the string literals, which
 * works and is invisible in every editor -- so the one load-bearing detail of
 * this file could not be seen, reviewed or maintained. Control codes, because
 * no workshop types one into the name of a check.
 */
const FIELD = '\u0001';
const LINE = '\u0002';

/** One line of a sheet, as it stood. */
export interface ShapeItem {
  sectionName: string;
  itemName: string;
  guidance?: string | null;
  measurementType?: string | null;
  position?: string | null;
  sortOrder?: number;
}

/**
 * Everything about a sheet that makes it a different sheet.
 *
 * Deliberately not the ids. A workshop that deletes an item and retypes it
 * identically has not changed what it asks, and a fingerprint over ids would
 * say it had -- cutting a version, and telling a customer the sheet changed
 * when it did not.
 *
 * Just as deliberately, `sortOrder` is not in it either. Reordering a sheet
 * changes the order a technician walks the car in; it does not change a single
 * question asked, and a reader comparing two inspections cares about the
 * questions.
 */
export function fingerprintOf(items: readonly ShapeItem[]): string {
  const lines = items
    .map((item) =>
      [
        item.sectionName.trim(),
        item.itemName.trim(),
        (item.guidance ?? '').trim(),
        item.measurementType ?? 'NONE',
        item.position ?? '',
      ].join(FIELD),
    )
    .sort();

  return lines.join(LINE);
}

/** One question, named the way a reader would name it. */
export function questionOf(item: ShapeItem): string {
  return `${item.sectionName.trim()} · ${item.itemName.trim()}`;
}

function questions(items: readonly ShapeItem[]): Set<string> {
  return new Set(items.map(questionOf));
}

export interface WhatChanged {
  added: string[];
  removed: string[];
  /** Same question, different guidance or measurement. */
  reworded: string[];
  /** Nothing about what is asked differs. */
  same: boolean;
}

/**
 * What one sheet asks that another does not, in a reader's words.
 *
 * `reworded` exists because a question whose guidance changed is the same
 * question answered against different advice, which matters to somebody
 * comparing two years of inspections and is not an addition or a removal.
 */
export function whatChanged(
  before: readonly ShapeItem[],
  after: readonly ShapeItem[],
): WhatChanged {
  const wasAsked = questions(before);
  const isAsked = questions(after);

  const detail = (items: readonly ShapeItem[]) =>
    new Map(
      items.map((item) => [
        questionOf(item),
        `${(item.guidance ?? '').trim()}${FIELD}${item.measurementType ?? 'NONE'}`,
      ]),
    );

  const wasDetail = detail(before);
  const isDetail = detail(after);

  const added = [...isAsked].filter((one) => !wasAsked.has(one)).sort();
  const removed = [...wasAsked].filter((one) => !isAsked.has(one)).sort();
  const reworded = [...isAsked]
    .filter((one) => wasAsked.has(one) && wasDetail.get(one) !== isDetail.get(one))
    .sort();

  return {
    added,
    removed,
    reworded,
    same: added.length === 0 && removed.length === 0 && reworded.length === 0,
  };
}

/**
 * What the sheet this inspection was taken on never asked.
 *
 * The sentence an old report needs. Not "these items are missing" -- they are
 * not missing, they did not exist -- but "this check did not include them",
 * which is a statement about the sheet rather than an accusation about the
 * technician.
 */
export function didNotAsk(takenOn: readonly ShapeItem[], askedNow: readonly ShapeItem[]): string[] {
  return whatChanged(takenOn, askedNow).added;
}

/**
 * Whether an old inspection is worth a note at all.
 *
 * A sheet that has not changed needs no explanation, and a report that
 * explained itself every time would train people to skip the explanation on
 * the one occasion it mattered.
 */
export function worthSaying(didNotAskAbout: readonly string[]): boolean {
  return didNotAskAbout.length > 0;
}

/** How a version is described to somebody reading a report. */
export function versionSentence(input: {
  version: number;
  templateName: string;
  itemCount: number;
}): string {
  return `${input.templateName}, version ${input.version} — ${input.itemCount} checks`;
}
