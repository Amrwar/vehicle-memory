/**
 * The list you clear before you open anything else.
 *
 * The product already shows a workshop its problems. `/now` says whose move
 * every job is, the dashboard carries the money, the equipment screen names a
 * lapsed certificate, the plan names a booking that cannot be kept. All of it
 * is true and none of it is a morning.
 *
 * A morning is one list, ordered by what it costs to miss, that a person can
 * get to the bottom of before the first car arrives.
 *
 * ## Exactly one action
 *
 * The constraint the whole thing turns on, and the one that makes it a list
 * rather than another dashboard. Every item names one thing to do, as a verb,
 * with somewhere to do it. "Three invoices are overdue" is not an item: it is
 * a number, and a number leaves the reader to work out what to do, which they
 * will do tomorrow instead.
 *
 * If something needs two decisions it is two items, or it is not ready to be
 * on this list at all.
 *
 * ## Only what today can change
 *
 * An invoice ninety days overdue and already with a collector is a fact, not
 * a thing to miss. A comeback from March with no cause recorded is worth
 * knowing and is not urgent. What belongs here is the set of things where
 * *acting this morning* changes the outcome, and a list that included
 * everything else would be a list nobody finishes -- and a list nobody
 * finishes is a list nobody opens.
 *
 * ## It must be possible to reach the end
 *
 * So it is capped, and the cap is honest: "and eleven more" rather than a
 * silent truncation. A workshop with sixty things to not miss has a problem
 * this screen cannot solve, and pretending it has eight would be the screen
 * lying to make itself look calm.
 *
 * Phase 95.
 */

/**
 * What it costs to miss something, worst first.
 *
 * The order is an argument, not a preference. A car leaving on an uninspected
 * lift can hurt somebody; that outranks everything. A promise to a customer
 * outranks money because the money is usually recoverable and the customer
 * often is not. And the record comes last -- not because it does not matter,
 * but because a comeback whose cause is unrecorded will still be unrecorded
 * this afternoon, and a car promised at four will not.
 */
export const COST_ORDER = ['SAFETY', 'A_PROMISE', 'MONEY', 'THE_RECORD'] as const;

export type Cost = (typeof COST_ORDER)[number];

/*
 * "An incomplete history" rather than "The record". Two sentences already own
 * that English elsewhere -- the job page's check-in sheet, and the passport
 * report's "What the record says" -- and one English sentence has to mean one
 * thing or a translator is left guessing which. Naming the cost outright
 * rather than the thing it happens to is also the truer sentence: what it
 * costs to leave a comeback unexplained is a history that cannot be read.
 */
export const COST_SENTENCE: Record<Cost, string> = {
  SAFETY: 'Somebody could be hurt',
  A_PROMISE: 'A promise to a customer',
  MONEY: 'Money',
  THE_RECORD: 'An incomplete history',
};

/** Where an item came from, so a screen can group and a check can enumerate. */
export const MISS_KINDS = [
  'equipment-unusable',
  'booking-cannot-be-kept',
  'job-late',
  'job-promised-today',
  'estimate-never-sent',
  'quality-check-outstanding',
  'certificate-lapsing',
  'invoice-overdue',
  'part-late',
  'comeback-unexplained',
] as const;

export type MissKind = (typeof MISS_KINDS)[number];

/**
 * A sentence, as a key and its values.
 *
 * Not a formatted string. The screen translates it, which is how
 * `JobStanding.reason` has worked since Phase 84 -- and a formatted English
 * sentence here would be untranslatable text inside the model, which the
 * whole product refuses.
 */
export interface Say {
  key: string;
  vars?: Record<string, string | number>;
}

export interface MissItem {
  kind: MissKind;
  /** Stable across a morning, so the same thing is the same item. */
  id: string;
  /**
   * What the row is about, where naming it helps: a job number and a plate.
   *
   * Not part of the sentence. It was interpolated into one for a while, as
   * `'#{number} {vehicle}: {why}'` with the reason's key in `{why}` -- and a
   * sentence inside another sentence's slot is a sentence nobody translates,
   * whose own slots are dropped. A number and a plate are data: no language
   * changes them, so the screen prints them beside the sentence instead.
   */
  subject?: string | null;
  /** What is true, in one sentence. */
  what: Say;
  /** The one thing to do, as a verb. */
  action: Say;
  /** Where to do it. */
  href: string;
  cost: Cost;
  /**
   * The date the row turns on, where there is one.
   *
   * How long something has been true, or when it runs out -- the same field
   * either way, because both answer "how pressing is this" and both are
   * ordered the same direction. A `Date`, never a formatted string: the
   * screen knows the reader's locale and a library does not, and a date
   * written in a library is a date in one language.
   */
  when?: Date | null;
}

/** Whether an item is fit to be on the list at all. */
export function isOneAction(item: MissItem): boolean {
  return (
    item.what.key.trim().length > 0 &&
    item.action.key.trim().length > 0 &&
    item.href.startsWith('/') &&
    // A verb, not a number. "3 invoices overdue" as an action would be the
    // failure this list exists to avoid, so an action ending in a digit is
    // refused outright.
    !/\d$/.test(item.action.key.trim())
  );
}

function rank(cost: Cost): number {
  return COST_ORDER.indexOf(cost);
}

/**
 * The morning, ordered.
 *
 * By what it costs to miss, then by date, earliest first. Two promises about
 * to be broken are not equal -- the one sitting since Tuesday is the one
 * somebody has already walked past -- and the same direction is right for a
 * date in the future: a certificate lapsing in three days before one lapsing
 * in three weeks. Something with no date at all goes last among its equals.
 */
export function worstToMissFirst(items: readonly MissItem[]): MissItem[] {
  return [...items].sort(
    (a, b) =>
      rank(a.cost) - rank(b.cost) ||
      (a.when?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (b.when?.getTime() ?? Number.MAX_SAFE_INTEGER) ||
      a.kind.localeCompare(b.kind),
  );
}

/** How many of a morning is worth putting on one screen. */
export const A_MORNING = 12;

export interface TheList {
  items: MissItem[];
  /** Left off the screen, and said rather than hidden. */
  more: number;
  /** Nothing to miss. A real answer, and a good one. */
  clear: boolean;
  /** How many of each cost, for the line at the top. */
  byCost: { cost: Cost; count: number }[];
}

/**
 * What to put in front of somebody, and what to admit is behind it.
 *
 * Anything that is not one action is dropped rather than shown badly. A row
 * that says something is wrong and gives nobody anything to press is how a
 * list stops being read, and one bad row costs more than the item it
 * describes.
 */
export function theMorning(items: readonly MissItem[], cap = A_MORNING): TheList {
  const fit = items.filter(isOneAction);
  const ordered = worstToMissFirst(fit);

  const byCost = COST_ORDER.flatMap((cost) => {
    const count = ordered.filter((one) => one.cost === cost).length;
    return count > 0 ? [{ cost, count }] : [];
  });

  return {
    items: ordered.slice(0, cap),
    more: Math.max(0, ordered.length - cap),
    clear: ordered.length === 0,
    byCost,
  };
}

/**
 * The sentence at the top.
 *
 * "Nothing to miss this morning" is worth saying plainly and worth the space:
 * a screen that showed an empty area would leave somebody wondering whether it
 * had loaded, and a workshop that has cleared its list should be told so.
 *
 * A `Say`, not a string. It built `${total} things to deal with.` by hand for
 * a while, which no dictionary can hold a key for -- so a French workshop read
 * one English sentence in the middle of a French screen, and `i18n-scan` could
 * not see it because the literal was in here rather than on a page. The rule
 * this file states about `what` and `action` applies to its own prose too.
 */
export function howTheMorningLooks(list: TheList): Say {
  if (list.clear) return { key: 'Nothing to miss this morning.' };
  const total = list.items.length + list.more;
  return total === 1
    ? { key: '1 thing to deal with.' }
    : { key: '{count} things to deal with.', vars: { count: total } };
}
