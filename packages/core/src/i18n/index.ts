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

/** The BCP 47 tag the browser and Intl want for this language, given the region. */
export function htmlLangFor(language: Language, regionLocale?: string | null): string {
  if (language === 'en') return regionLocale?.startsWith('en') ? regionLocale : 'en';
  if (language === 'fr') return regionLocale?.startsWith('fr') ? regionLocale : 'fr';
  return regionLocale?.startsWith('ar') ? regionLocale : 'ar';
}

const DICTIONARIES: Record<Language, Readonly<Record<string, string>>> = {
  en: {},
  fr: FR,
  ar: AR,
};

export type Vars = Record<string, string | number>;

/**
 * The sentence in the language, with `{name}` slots filled. Unknown
 * sentences come back in English, filled the same way, so a missing
 * translation is a missing translation and never a broken page.
 */
export function translate(language: Language, text: string, vars?: Vars): string {
  const found = language === 'en' ? text : (DICTIONARIES[language][text] ?? text);
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

/** Whether a sentence has a translation in a language. For the coverage script. */
export function hasTranslation(language: Language, text: string): boolean {
  return language === 'en' || text in DICTIONARIES[language];
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
