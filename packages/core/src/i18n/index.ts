/**
 * Languages. Phase 37.5.
 *
 * English is the source of truth: every string in the product is written in
 * English where it is used, and a dictionary per language maps that English
 * sentence to its translation. A sentence with no translation is shown in
 * English and named by the coverage script, never shown as a key or a
 * blank. Arabic is read right to left, so the language carries its
 * direction and the page carries both on its root element.
 */

import { AR } from './ar';
import { AREAS } from './areas/index';
import { FR } from './fr';

export const LANGUAGES = ['en', 'fr', 'ar'] as const;
export type Language = (typeof LANGUAGES)[number];

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  ar: 'العربية',
};

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function dirFor(language: Language): 'ltr' | 'rtl' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

/**
 * The locale dates and money are written in for a reader: their language, in
 * the workshop's country, so a French reader in a British workshop reads
 * "15 septembre 2026" and "2 401,20 £". Arabic keeps Western digits, which is
 * what plates, part numbers and invoices around it use. Phase 40.5.
 */
export function readingLocaleFor(
  language: Language,
  region: { locale: string; country?: string | null },
): string {
  if (language === 'en') return region.locale;
  if (region.locale.startsWith(language)) {
    return language === 'ar' ? `${region.locale}-u-nu-latn` : region.locale;
  }
  const tag = region.country ? `${language}-${region.country}` : language;
  return language === 'ar' ? `${tag}-u-nu-latn` : tag;
}

/** The BCP 47 tag the browser and Intl want for this language, given the region. */
export function htmlLangFor(language: Language, regionLocale?: string | null): string {
  if (language === 'en') return regionLocale?.startsWith('en') ? regionLocale : 'en';
  if (language === 'fr') return regionLocale?.startsWith('fr') ? regionLocale : 'fr';
  return regionLocale?.startsWith('ar') ? regionLocale : 'ar';
}

const DICTIONARIES: Record<Language, Readonly<Record<string, string>>> = {
  en: {},
  fr: Object.assign({}, FR, ...AREAS.map((area) => area.fr)),
  ar: Object.assign({}, AR, ...AREAS.map((area) => area.ar)),
};

interface Pattern {
  re: RegExp;
  slots: string[];
  out: string;
  /** The longest fixed piece of the key, checked before the expression runs. */
  anchor: string;
  /** How many characters of the key are fixed words rather than slots. */
  fixed: number;
}

const PATTERNS: Partial<Record<Language, Pattern[]>> = {};

/**
 * Keys with slots, as expressions that read a finished English sentence back
 * into its slots. Most fixed words first, so "Job #{v1} was never finished." wins
 * over "{v1} was never finished.".
 */
function patternsFor(language: Language): Pattern[] {
  const cached = PATTERNS[language];
  if (cached) return cached;
  const built: Pattern[] = [];
  for (const [key, out] of Object.entries(DICTIONARIES[language])) {
    if (!/\{\w+\}/.test(key)) continue;
    const slots: string[] = [];
    const pieces = key.split(/\{(\w+)\}/);
    let source = '^';
    let anchor = '';
    pieces.forEach((piece, index) => {
      if (index % 2 === 1) {
        slots.push(piece);
        source += '([\\s\\S]*?)';
      } else {
        source += piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (piece.length > anchor.length) anchor = piece;
      }
    });
    // A key that is nearly all slot would match any sentence at all.
    if (anchor.trim().length < 3) continue;
    const fixed = pieces.filter((_, index) => index % 2 === 0).join('').length;
    built.push({ re: new RegExp(source + '$'), slots, out, anchor, fixed });
  }
  built.sort((a, b) => b.fixed - a.fixed || b.anchor.length - a.anchor.length);
  PATTERNS[language] = built;
  return built;
}

const CALENDAR: Partial<Record<Language, [RegExp, Map<string, string>]>> = {};

/**
 * English month and weekday names inside a value read out of a sentence
 * ("3 March 2026", "Monday 3 March") in the reader's language. Core writes
 * those dates in English before the page knows who is reading; the names are
 * taken from Intl, so they are spelled as the language spells them.
 */
function localiseCalendarWords(language: Language, value: string): string {
  if (language === 'en') return value;
  let entry = CALENDAR[language];
  if (!entry) {
    const names = new Map<string, string>();
    const month = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });
    const shortMonth = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone: 'UTC' });
    const theirMonth = new Intl.DateTimeFormat(language, { month: 'long', timeZone: 'UTC' });
    const theirShortMonth = new Intl.DateTimeFormat(language, { month: 'short', timeZone: 'UTC' });
    for (let m = 0; m < 12; m += 1) {
      const date = new Date(Date.UTC(2026, m, 15));
      names.set(month.format(date), theirMonth.format(date));
      names.set(shortMonth.format(date).replace('.', ''), theirShortMonth.format(date));
    }
    const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: 'UTC' });
    const theirWeekday = new Intl.DateTimeFormat(language, { weekday: 'long', timeZone: 'UTC' });
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(Date.UTC(2026, 0, 5 + d));
      names.set(weekday.format(date), theirWeekday.format(date));
    }
    // "May" is both a month and a short month; either way it is the same name.
    const words = [...names.keys()].sort((a, b) => b.length - a.length);
    entry = [new RegExp(`\\b(${words.join('|')})\\b`, 'g'), names];
    CALENDAR[language] = entry;
  }
  const [pattern, names] = entry;
  // Only where the name sits beside a number, so a person called April is left alone.
  if (!/\d/.test(value)) return value;
  return value.replace(pattern, (word) => names.get(word) ?? word);
}

/**
 * A finished sentence with values already in it ("Job #41 was never
 * finished.") translated through a key with slots ("Job #{v1} was never
 * finished."). Each value is itself translated when it is a known sentence.
 */
function translateFinished(language: Language, text: string, depth: number): string | null {
  for (const pattern of patternsFor(language)) {
    if (pattern.anchor && !text.includes(pattern.anchor)) continue;
    // A key that is mostly slots ("{first}, then {rest}") is only trusted when
    // its fixed words are a real share of the sentence, so it cannot half
    // translate some longer sentence that happens to contain ", then ".
    if (pattern.fixed < 20 && pattern.fixed < text.length * 0.4) continue;
    const match = pattern.re.exec(text);
    if (!match) continue;
    const vars: Vars = {};
    pattern.slots.forEach((slot, index) => {
      const value = match[index + 1] ?? '';
      const translated = depth < 2 ? translateAt(language, value, depth + 1) : value;
      vars[slot] = translated === value ? localiseCalendarWords(language, value) : translated;
    });
    return pattern.out.replace(/\{(\w+)\}/g, (whole, name: string) =>
      name in vars ? String(vars[name]) : whole,
    );
  }
  return null;
}

/**
 * A qualifier on a key, which English never shows.
 *
 * `t('Active#subscription')` reads "Active" in English and « Active » in
 * French; `t('Active#plan')` reads "Active" and « Actif ». One English word,
 * two French endings, because *une* souscription and *un* forfait do not
 * agree the same way — and a flat dictionary of key to string cannot hold
 * both. Thirty-four of the words this product shows are in that position, and
 * before Phase 83 the merged dictionary silently kept whichever area was
 * loaded last, so one of the two pages was always wrong.
 *
 * The qualifier names the noun being described rather than the gender,
 * because the noun is what a translator needs and the gender is what they
 * work out. It is lower case and at the end, so `Job #41` and `#10482` are
 * untouched: those are a hash and a digit.
 *
 * Resolution is the qualified key, then the bare key, then English. A page
 * that has not been told which noun it means still gets a translation; it
 * just gets the general one.
 */
const QUALIFIER = /#[a-z][a-z-]*$/;

/** The key as the reader sees it: everything before the qualifier. */
export function plainKey(text: string): string {
  return text.replace(QUALIFIER, '');
}

function translateAt(language: Language, text: string, depth: number): string {
  if (language === 'en' || !/[A-Za-z]{2}/.test(text)) return text;
  const exact = DICTIONARIES[language][text];
  if (exact !== undefined) return exact;
  return translateFinished(language, text, depth) ?? text;
}

export type Vars = Record<string, string | number>;

/**
 * The sentence in the language, with `{name}` slots filled. Unknown
 * sentences come back in English, filled the same way, so a missing
 * translation is a missing translation and never a broken page.
 */
export function translate(language: Language, text: string, vars?: Vars): string {
  const plain = plainKey(text);
  if (language === 'en' && !vars) return plain;
  const found =
    language === 'en'
      ? plain
      : (DICTIONARIES[language][text] ??
        DICTIONARIES[language][plain] ??
        (vars ? plain : translateAt(language, plain, 0)));
  if (!vars) return found;
  return found.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/** A translator bound to one language, for a page to pass around. */
export function translator(language: Language) {
  return (text: string, vars?: Vars) => translate(language, text, vars);
}
export type Translator = ReturnType<typeof translator>;

/**
 * Marks English that is shown later through t(), where t is not yet in
 * scope: a list of labels at the top of a file. Returns the text unchanged;
 * the coverage script reads msg('...') as it reads t('...'). Phase 40.5.
 */
export function msg<T extends string>(text: T): T {
  return text;
}

/** Whether a sentence has a translation in a language. For the coverage script. */
export function hasTranslation(language: Language, text: string): boolean {
  return (
    language === 'en' || text in DICTIONARIES[language] || plainKey(text) in DICTIONARIES[language]
  );
}

export function dictionaryKeys(language: Language): string[] {
  return Object.keys(DICTIONARIES[language]);
}

/**
 * Which language to show: what the person chose (a cookie), else what
 * they saved on their account, else the first language their browser
 * asks for that we have, else English.
 */
export function pickLanguage(input: {
  cookie?: string | null;
  saved?: string | null;
  acceptLanguage?: string | null;
}): Language {
  if (isLanguage(input.cookie)) return input.cookie;
  if (isLanguage(input.saved)) return input.saved;
  const wanted = (input.acceptLanguage ?? '')
    .split(',')
    .map((part) => part.trim().split(';')[0]?.toLowerCase().slice(0, 2) ?? '')
    .filter(Boolean);
  for (const code of wanted) if (isLanguage(code)) return code;
  return 'en';
}
