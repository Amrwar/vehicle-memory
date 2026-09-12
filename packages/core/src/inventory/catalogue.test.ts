import { describe, expect, it } from 'vitest';

import {
  assertOrderDraftable,
  assertProductSaveable,
  meaningfulLines,
  normalisePartNumber,
  priceWarning,
} from './catalogue';

describe('normalisePartNumber', () => {
  it('removes case and spacing, which are how people type', () => {
    expect(normalisePartNumber(' bp-1042 ')).toBe('BP-1042');
    expect(normalisePartNumber('BP 1042')).toBe('BP1042');
  });

  it('keeps hyphens, which are part of the number', () => {
    // "BP-1042" and "BP1042" can genuinely be different parts from different
    // makers, so the hyphen is not punctuation to be tidied away.
    expect(normalisePartNumber('BP-1042')).not.toBe(normalisePartNumber('BP1042'));
  });
});

describe('assertProductSaveable', () => {
  const part = { partNumber: 'BP-1042', name: 'Front pads', costPrice: 18.5, sellPrice: 42 };

  it('accepts an ordinary part', () => {
    expect(() => assertProductSaveable(part)).not.toThrow();
  });

  it('needs the number on the box', () => {
    expect(() => assertProductSaveable({ ...part, partNumber: '   ' })).toThrow(/part number/);
  });

  it('needs a name a customer would understand', () => {
    expect(() => assertProductSaveable({ ...part, name: '' })).toThrow(/invoice/);
  });

  it('refuses a price below zero or that is not a number', () => {
    expect(() => assertProductSaveable({ ...part, costPrice: -1 })).toThrow(/cost/);
    expect(() => assertProductSaveable({ ...part, sellPrice: Number.NaN })).toThrow(/sell price/);
    expect(() => assertProductSaveable({ ...part, reorderPoint: -2 })).toThrow(/reorder point/);
  });

  it('allows a zero cost, because the invoice is often still in the van', () => {
    expect(() => assertProductSaveable({ ...part, costPrice: 0 })).not.toThrow();
  });
});

describe('priceWarning', () => {
  it('says nothing about an ordinary margin', () => {
    expect(priceWarning({ costPrice: 18.5, sellPrice: 42 })).toBeNull();
  });

  it('mentions a zero cost, which flatters every margin report', () => {
    expect(priceWarning({ costPrice: 0, sellPrice: 42 })).toContain('cost is zero');
  });

  it('mentions selling below cost without refusing it', () => {
    // A loss-leader is a decision a workshop is entitled to make. It is also,
    // far more often, a typo.
    expect(priceWarning({ costPrice: 42, sellPrice: 18.5 })).toContain('below the cost');
  });

  it('does not warn on a part with no prices at all yet', () => {
    expect(priceWarning({ costPrice: 0, sellPrice: 0 })).toBeNull();
  });
});

describe('assertOrderDraftable', () => {
  const line = { description: 'Wiper blades', quantity: 2, unitCost: 6.25 };

  it('needs somebody to send it to', () => {
    expect(() => assertOrderDraftable({ supplierId: '', lines: [line] })).toThrow(/who the order/);
  });

  it('needs at least one real line', () => {
    expect(() => assertOrderDraftable({ supplierId: 's', lines: [] })).toThrow(/nothing on it/);
    expect(() =>
      assertOrderDraftable({
        supplierId: 's',
        lines: [{ description: '   ', quantity: 0, unitCost: 0 }],
      }),
    ).toThrow(/nothing on it/);
  });

  it('ignores blank rows the form always sends', () => {
    expect(() =>
      assertOrderDraftable({
        supplierId: 's',
        lines: [line, { description: '', quantity: 0, unitCost: 0 }],
      }),
    ).not.toThrow();
  });

  it('refuses a real line with no quantity', () => {
    expect(() =>
      assertOrderDraftable({ supplierId: 's', lines: [{ ...line, quantity: 0 }] }),
    ).toThrow(/quantity above zero/);
  });

  it('refuses a cost below zero', () => {
    expect(() =>
      assertOrderDraftable({ supplierId: 's', lines: [{ ...line, unitCost: -1 }] }),
    ).toThrow(/below zero/);
  });

  it('counts a catalogue line with no description as real', () => {
    expect(() =>
      assertOrderDraftable({
        supplierId: 's',
        lines: [{ productId: 'p', description: '', quantity: 1, unitCost: 0 }],
      }),
    ).not.toThrow();
  });
});

describe('meaningfulLines', () => {
  it('keeps order and drops what nobody filled in', () => {
    const kept = meaningfulLines([
      { description: 'A', quantity: 1, unitCost: 1 },
      { description: '', quantity: 0, unitCost: 0 },
      { productId: 'p', description: '', quantity: 1, unitCost: 1 },
    ]);

    expect(kept.map((l) => l.description || l.productId)).toEqual(['A', 'p']);
  });
});
