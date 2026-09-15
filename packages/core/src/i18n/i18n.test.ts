import { describe, expect, it } from 'vitest';

import { AR } from './ar';
import { FR } from './fr';
import {
  dictionaryKeys,
  dirFor,
  hasTranslation,
  htmlLangFor,
  isLanguage,
  pickLanguage,
  translate,
  translator,
} from './index';

describe('languages', () => {
  it('knows three, and which way each reads', () => {
    expect(isLanguage('fr')).toBe(true);
    expect(isLanguage('de')).toBe(false);
    expect(dirFor('ar')).toBe('rtl');
    expect(dirFor('fr')).toBe('ltr');
    expect(htmlLangFor('ar', 'en-GB')).toBe('ar');
    expect(htmlLangFor('en', 'en-CA')).toBe('en-CA');
    expect(htmlLangFor('fr', 'fr-FR')).toBe('fr-FR');
  });

  it('translates a sentence and fills its slots, falling back to English', () => {
    expect(translate('fr', 'Sign in')).toBe(FR['Sign in']);
    expect(translate('ar', 'Sign in')).toBe(AR['Sign in']);
    expect(translate('en', 'Sign in')).toBe('Sign in');
    expect(translate('fr', 'No such sentence anywhere')).toBe('No such sentence anywhere');
    expect(translate('en', 'Hello {name}', { name: 'Maria' })).toBe('Hello Maria');
    expect(translate('fr', 'Hello {name}', { name: 'Maria' })).toBe(
      FR['Hello {name}']!.replace('{name}', 'Maria'),
    );
    const t = translator('ar');
    expect(t('Sign in')).toBe(AR['Sign in']);
  });

  it('picks the chosen language, then the saved one, then the browser, then English', () => {
    expect(pickLanguage({ cookie: 'ar', saved: 'fr', acceptLanguage: 'en' })).toBe('ar');
    expect(pickLanguage({ cookie: null, saved: 'fr', acceptLanguage: 'en' })).toBe('fr');
    expect(pickLanguage({ acceptLanguage: 'de-DE,ar;q=0.8,en;q=0.5' })).toBe('ar');
    expect(pickLanguage({ acceptLanguage: 'de' })).toBe('en');
    expect(pickLanguage({ cookie: 'xx' })).toBe('en');
  });

  it('has the same sentences in French and Arabic, every one translated', () => {
    const fr = new Set(dictionaryKeys('fr'));
    const ar = new Set(dictionaryKeys('ar'));
    const onlyFr = [...fr].filter((k) => !ar.has(k));
    const onlyAr = [...ar].filter((k) => !fr.has(k));
    expect(onlyFr).toEqual([]);
    expect(onlyAr).toEqual([]);
    // A French word can be the English word (Contact, Questions); Arabic never is.
    for (const [key, value] of Object.entries(FR)) expect(value.trim(), key).not.toBe('');
    for (const [key, value] of Object.entries(AR)) {
      expect(value.trim(), key).not.toBe('');
      expect(value, key).not.toBe(key);
    }
    expect(hasTranslation('fr', 'Sign in')).toBe(true);
    expect(hasTranslation('en', 'anything')).toBe(true);
  });

  it('keeps every slot a sentence has in its translations', () => {
    for (const dict of [FR, AR]) {
      for (const [key, value] of Object.entries(dict)) {
        const slots = (key.match(/\{\w+\}/g) ?? []).sort();
        const kept = (value.match(/\{\w+\}/g) ?? []).sort();
        expect(kept, key).toEqual(slots);
      }
    }
  });
});
