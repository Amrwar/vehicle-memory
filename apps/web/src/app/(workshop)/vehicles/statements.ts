import {
  expiryState,
  type NetworkSummary,
  type PaperworkSummary,
  type Translator,
} from '@carnet/core';

/**
 * The one-line statements at the top of a vehicle, said in the reader's
 * language. Phase 40.5.
 *
 * The rules in core write these sentences in English, pieced together, with
 * dates formatted for Britain. Rebuilt here from the same figures so each
 * sentence is whole in every language and the dates follow the region.
 */

/** Where a vehicle's history came from, in one sentence. */
export function networkSentence(
  t: Translator,
  summary: Pick<NetworkSummary, 'ownEntries' | 'otherEntries' | 'otherWorkshops' | 'lastEntry'>,
  locale: string,
): string {
  const own = summary.ownEntries;
  const others = summary.otherEntries;

  if (own === 0 && others === 0) {
    return t('No history on this vehicle yet. What you record here starts it.');
  }

  const when = summary.lastEntry
    ? summary.lastEntry.toLocaleDateString(locale, { month: 'long', year: 'numeric' })
    : '—';

  if (others === 0) {
    return own === 1
      ? t('1 entry on this vehicle, all recorded here, most recently {when}.', { when })
      : t('{count} entries on this vehicle, all recorded here, most recently {when}.', {
          count: own,
          when,
        });
  }

  const names = summary.otherWorkshops.map((name) => t(name));
  const first = names[0] ?? '';
  const second = names[1] ?? '';

  if (own === 0) {
    if (names.length === 1) {
      return others === 1
        ? t(
            '1 entry on this vehicle, recorded by {first}, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.',
            { first, when },
          )
        : t(
            '{count} entries on this vehicle, recorded by {first}, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.',
            { count: others, first, when },
          );
    }
    if (names.length === 2) {
      return t(
        '{count} entries on this vehicle, recorded by {first} and {second}, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.',
        { count: others, first, second, when },
      );
    }
    return t(
      '{count} entries on this vehicle, recorded by {workshops} other workshops, most recently {when}. Their commercial detail is withheld; the car’s history is not. What you record continues it.',
      { count: others, workshops: names.length, when },
    );
  }

  const total = own + others;
  if (names.length === 1) {
    return t(
      '{total} entries on this vehicle: {own} recorded here and {others} by {first}, most recently {when}. Their commercial detail is withheld.',
      { total, own, others, first, when },
    );
  }
  if (names.length === 2) {
    return t(
      '{total} entries on this vehicle: {own} recorded here and {others} by {first} and {second}, most recently {when}. Their commercial detail is withheld.',
      { total, own, others, first, second, when },
    );
  }
  return t(
    '{total} entries on this vehicle: {own} recorded here and {others} by {workshops} other workshops, most recently {when}. Their commercial detail is withheld.',
    { total, own, others, workshops: names.length, when },
  );
}

/** What paperwork a vehicle has, and whether its MOT and insurance are still good. */
export function paperworkSentence(
  t: Translator,
  paperwork: Pick<
    PaperworkSummary,
    'counts' | 'mot' | 'insurance' | 'motExpiresAt' | 'insuranceExpiresAt'
  >,
  locale: string,
): string {
  const live = Object.values(paperwork.counts).reduce((total, count) => total + (count ?? 0), 0);
  const dayMonth = (value: Date) =>
    value.toLocaleDateString(locale, { day: 'numeric', month: 'long' });

  const parts: string[] = [];
  if (live === 0) parts.push(t('No paperwork on this vehicle yet.'));
  else if (live === 1) parts.push(t('1 document on file.'));
  else parts.push(t('{count} documents on file.', { count: live }));

  if (paperwork.mot === 'EXPIRED') parts.push(t('The MOT has expired.'));
  else if (paperwork.mot === 'SOON' && paperwork.motExpiresAt)
    parts.push(t('The MOT runs out on {date}.', { date: dayMonth(paperwork.motExpiresAt) }));

  if (paperwork.insurance === 'EXPIRED') parts.push(t('The insurance has expired.'));
  else if (paperwork.insurance === 'SOON' && paperwork.insuranceExpiresAt)
    parts.push(
      t('The insurance runs out on {date}.', { date: dayMonth(paperwork.insuranceExpiresAt) }),
    );

  return parts.join(' ');
}

function shortDate(value: Date, locale: string): string {
  return value.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** A document's expiry, as a badge says it. */
export function expiryLabel(
  t: Translator,
  expiresAt: Date | null | undefined,
  locale: string,
): string {
  const state = expiryState(expiresAt);
  if (state === 'NONE' || !expiresAt) return t('No expiry');
  const date = shortDate(expiresAt, locale);
  if (state === 'EXPIRED') return t('Expired {date}', { date });
  if (state === 'SOON') return t('Runs out {date}', { date });
  return t('Valid until {date}', { date });
}

/** The MOT badge. */
export function motLabel(t: Translator, expiresAt: Date | null | undefined, locale: string) {
  const state = expiryState(expiresAt);
  if (state === 'NONE' || !expiresAt) return t('MOT no expiry');
  const date = shortDate(expiresAt, locale);
  if (state === 'EXPIRED') return t('MOT expired {date}', { date });
  if (state === 'SOON') return t('MOT runs out {date}', { date });
  return t('MOT valid until {date}', { date });
}

/** The insurance badge. */
export function insuranceLabel(t: Translator, expiresAt: Date | null | undefined, locale: string) {
  const state = expiryState(expiresAt);
  if (state === 'NONE' || !expiresAt) return t('Insurance no expiry');
  const date = shortDate(expiresAt, locale);
  if (state === 'EXPIRED') return t('Insurance expired {date}', { date });
  if (state === 'SOON') return t('Insurance runs out {date}', { date });
  return t('Insurance valid until {date}', { date });
}
