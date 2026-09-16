import { describe, expect, it } from 'vitest';

import { HELP_ARTICLES, helpArticle, helpForPath, searchHelp } from './articles';

describe('the help', () => {
  it('is twelve short pages, each about a screen', () => {
    expect(HELP_ARTICLES).toHaveLength(12);
    expect(HELP_ARTICLES.every((article) => article.body.length === 2)).toBe(true);
    expect(new Set(HELP_ARTICLES.map((article) => article.slug)).size).toBe(12);
  });

  it('finds an article by its title, its keywords or a word in its middle', () => {
    expect(searchHelp('invoice')[0]?.article.slug).toBe('invoices-and-payments');
    // A keyword that appears in no sentence of the article.
    expect(searchHelp('vhc')[0]?.article.slug).toBe('inspections');
    expect(searchHelp('credit note')[0]?.article.slug).toBe('invoices-and-payments');
    expect(searchHelp('gdpr')[0]?.article.slug).toBe('your-data');
  });

  it('shows the sentence the words were found in', () => {
    const hit = searchHelp('credit note')[0];
    expect(hit?.excerpt).toContain('corrected with a credit note');
  });

  it('answers nothing to nothing, and to a word nobody wrote', () => {
    expect(searchHelp('  ')).toEqual([]);
    expect(searchHelp('kombucha')).toEqual([]);
  });

  it('knows which article belongs to a screen, longest path first', () => {
    expect(helpForPath('/settings/site')?.slug).toBe('tax-prices-sites');
    expect(helpForPath('/invoices/abc123')?.slug).toBe('invoices-and-payments');
    expect(helpForPath('/nowhere')).toBeNull();
    expect(helpArticle('what-this-is')?.title).toBe('What this product is for');
    expect(helpArticle('nothing')).toBeNull();
  });
});
