import { describe, expect, it } from 'vitest';

import { hasTranslation, plainKey, translate } from './index';

describe('a qualifier the English never shows', () => {
  it('is stripped for English', () => {
    expect(translate('en', 'Active#subscription')).toBe('Active');
    expect(plainKey('Active#subscription')).toBe('Active');
  });

  it('leaves a hash before digits alone, because that is a number', () => {
    expect(plainKey('Job #41')).toBe('Job #41');
    expect(plainKey('#10482')).toBe('#10482');
    expect(translate('en', 'Job #41 was never finished.')).toBe('Job #41 was never finished.');
  });

  it('only strips at the end, so a hash mid-sentence survives', () => {
    expect(plainKey('See #notes for the rest')).toBe('See #notes for the rest');
  });

  it('falls back to the bare key when the qualified one is unknown', () => {
    // 'Active' is in the dictionary; 'Active#nothing-like-this' is not.
    expect(translate('fr', 'Active#nothing-like-this')).toBe(translate('fr', 'Active'));
  });

  it('and counts as translated either way', () => {
    expect(hasTranslation('fr', 'Active#nothing-like-this')).toBe(hasTranslation('fr', 'Active'));
  });

  it('fills slots after resolving', () => {
    expect(translate('en', '{count} left#part', { count: 3 })).toBe('3 left');
  });
});
