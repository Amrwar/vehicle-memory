import { describe, expect, it } from 'vitest';

import {
  describeErasure,
  describeExport,
  ERASURE,
  FORGOTTEN,
  touched,
  treatmentOf,
  whatWasDone,
} from './erasure';

describe('the register', () => {
  it('names each table once', () => {
    expect(new Set(ERASURE.map((one) => one.table)).size).toBe(ERASURE.length);
  });

  it('says why, at length, for every one', () => {
    for (const holding of ERASURE) {
      expect(holding.because.length).toBeGreaterThan(40);
      expect(holding.holds.length).toBeGreaterThan(10);
    }
  });

  it('keeps the books and the vehicle, and removes the person', () => {
    expect(treatmentOf('invoices')?.treatment).toBe('kept');
    expect(treatmentOf('signatures')?.treatment).toBe('removed');
    expect(treatmentOf('customers')?.treatment).toBe('anonymised');
  });

  it('keeps the passport untouched, because it carries no name to remove', () => {
    // The resolution of the phase's hardest question: a name in a hashed
    // chain can never come out, so it must never go in.
    expect(treatmentOf('vehicle_events')?.treatment).toBe('kept');
    expect(treatmentOf('vehicle_events')?.because).toContain('never be taken out');
  });

  it('takes away a way in, rather than emptying it', () => {
    // An anonymised login is still a login. This one has to go.
    expect(treatmentOf('users')?.treatment).toBe('removed');
  });

  it('knows nothing about a table nobody wrote down', () => {
    expect(treatmentOf('something_invented_next_month')).toBeNull();
  });

  it('lists what is actually touched, for the check that goes looking', () => {
    expect(touched()).toContain('customers');
    expect(touched()).toContain('signatures');
    expect(touched()).not.toContain('invoices');
  });
});

describe('what the customer is told', () => {
  it('separates what went from what stayed', () => {
    const { gone, kept } = whatWasDone();

    expect(gone).toContain('Their signature');
    expect(kept).toContain('Their invoices, payments and credit notes');
    expect(gone.length + kept.length).toBe(ERASURE.length);
  });

  it('replaces a name with something that reads as deliberate', () => {
    // Not a blank. A blank reads as a fault somebody should fix.
    expect(FORGOTTEN.length).toBeGreaterThan(8);
    expect(FORGOTTEN.toLowerCase()).toContain('erased');
  });
});

describe('saying what happened', () => {
  it('counts the records and says what the passport needed', () => {
    const said = describeErasure({
      counts: { customers: 1, signatures: 3 },
      unerasable: [{ eventId: 'e1', where: 'summary' }],
    });

    expect(said).toContain('4 records');
    expect(said).toContain('cannot be changed');
  });

  it('says plainly when the passport carried nothing', () => {
    expect(describeErasure({ counts: { customers: 1 }, unerasable: [] })).toContain(
      'Nothing in the passport carried a name',
    );
  });

  it('describes an export by what is in it', () => {
    const said = describeExport({
      about: 'Maria Ferreira',
      taken: new Date('2026-09-20T09:00:00Z'),
      workshop: 'Hillside Motors',
      holdings: { customer: [{}], invoices: [{}, {}], messages: [] },
    });

    expect(said).toContain('3 records');
    expect(said).toContain('Maria Ferreira');
    expect(said).toContain('2026-09-20');
  });
});
