import { describe, expect, it } from 'vitest';

import {
  EVIDENCE_ORDER,
  EVIDENCE_SENTENCE,
  needsConfirmation,
  QUALIFYING,
  qualifies,
  rankSubstitutes,
  strongestEvidence,
  substitutionSentence,
  type Substitute,
} from './substitution';

function candidate(over: Partial<Substitute> & { productId: string }): Substitute {
  return {
    partNumber: over.productId.toUpperCase(),
    name: 'Front brake disc',
    brand: 'Marden',
    evidence: ['SAME_PART_NUMBER'],
    inStock: 0,
    cost: 30,
    ...over,
  };
}

describe('the confidence is the evidence', () => {
  it('has a sentence for every kind, and no number anywhere', () => {
    for (const kind of EVIDENCE_ORDER) {
      expect(EVIDENCE_SENTENCE[kind]).toBeTruthy();
      expect(EVIDENCE_SENTENCE[kind]).not.toMatch(/\d/);
    }
  });

  it('takes our own confirmed swap over a supplier cross-reference', () => {
    expect(strongestEvidence(['SAME_PART_NUMBER', 'SUBSTITUTED_BEFORE'])).toBe(
      'SUBSTITUTED_BEFORE',
    );
  });

  it('takes a fitment somebody here typed over a feed', () => {
    expect(strongestEvidence(['CATALOGUE', 'RECORDED_HERE'])).toBe('RECORDED_HERE');
  });

  it('does not claim two of our own products share a part number', () => {
    // They cannot: `products` is unique on (org, partNumber). The evidence is
    // about a supplier's numbering, and the sentence has to say so or the
    // rule reads as one that could never fire.
    expect(EVIDENCE_SENTENCE.SAME_PART_NUMBER).toContain('supplier');
  });

  it('is nothing when nothing is known', () => {
    expect(strongestEvidence([])).toBeNull();
  });
});

describe('fitting the same car is not a claim that two parts interchange', () => {
  // The rule this file exists for, and the one the first draft got wrong: a
  // brake disc that fits the car, that we fitted to the car, and that a
  // catalogue vouches for is still not an alternative to a set of brake pads.

  it('qualifies only on a confirmed swap or a shared supplier number', () => {
    expect([...QUALIFYING].sort()).toEqual(['SAME_PART_NUMBER', 'SUBSTITUTED_BEFORE']);
  });

  it('refuses a part that only suits the same vehicle', () => {
    expect(qualifies(['FITTED_TO_THIS_CAR', 'FITTED_TO_THIS_MODEL', 'CATALOGUE'])).toBe(false);
  });

  it('and drops it from the list rather than ranking it last', () => {
    const ranked = rankSubstitutes([
      candidate({ productId: 'discs' }),
      candidate({
        productId: 'pads',
        name: 'Front brake pad set',
        evidence: ['FITTED_TO_THIS_CAR', 'RECORDED_HERE', 'CATALOGUE'],
        inStock: 9,
        cost: 1,
      }),
    ]);

    expect(ranked.map((one) => one.productId)).toEqual(['discs']);
  });

  it('accepts a confirmed swap on its own', () => {
    expect(qualifies(['SUBSTITUTED_BEFORE'])).toBe(true);
  });
});

describe('what gets shown', () => {
  it('drops a candidate with no evidence at all', () => {
    expect(rankSubstitutes([candidate({ productId: 'a', evidence: [] })])).toEqual([]);
  });

  it('orders by qualifying evidence before anything else', () => {
    const ranked = rankSubstitutes([
      candidate({ productId: 'crossref', evidence: ['SAME_PART_NUMBER'], inStock: 9, cost: 1 }),
      candidate({
        productId: 'done-before',
        evidence: ['SUBSTITUTED_BEFORE'],
        inStock: 0,
        cost: 99,
      }),
    ]);

    expect(ranked.map((one) => one.productId)).toEqual(['done-before', 'crossref']);
  });

  it('puts what is on the shelf first when the evidence is equal', () => {
    const ranked = rankSubstitutes([
      candidate({ productId: 'ordered', inStock: 0, cost: 10 }),
      candidate({ productId: 'here', inStock: 2, cost: 12 }),
    ]);

    expect(ranked[0]?.productId).toBe('here');
  });

  it('carries the corroboration beside the reason, not instead of it', () => {
    const ranked = rankSubstitutes([
      candidate({
        productId: 'a',
        evidence: ['CATALOGUE', 'SAME_PART_NUMBER', 'FITTED_TO_THIS_CAR'],
      }),
    ]);

    expect(ranked[0]?.strongest).toBe('SAME_PART_NUMBER');
    expect(ranked[0]?.corroboration).toEqual(['FITTED_TO_THIS_CAR', 'CATALOGUE']);
  });

  it('prefers the candidate more is known about when both qualify the same way', () => {
    const ranked = rankSubstitutes([
      candidate({ productId: 'bare', evidence: ['SAME_PART_NUMBER'] }),
      candidate({
        productId: 'corroborated',
        evidence: ['SAME_PART_NUMBER', 'FITTED_TO_THIS_CAR'],
      }),
    ]);

    expect(ranked[0]?.productId).toBe('corroborated');
  });
});

describe('nothing substitutes by itself', () => {
  it('always needs a person', () => {
    expect(needsConfirmation).toBe(true);
  });

  it('writes down what was fitted, in place of what, and why', () => {
    expect(
      substitutionSentence({
        original: 'BD-4410',
        fitted: 'MRD-901',
        evidence: 'SAME_PART_NUMBER',
      }),
    ).toBe('MRD-901 fitted in place of BD-4410 — a supplier lists both under one number');
  });
});
