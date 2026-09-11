import { describe, expect, it } from 'vitest';

import { fitmentWarning, fitsVehicle, type Fitment } from './fitment';

function fitment(overrides: Partial<Fitment> & Pick<Fitment, 'make'>): Fitment {
  return {
    model: null,
    yearFrom: null,
    yearTo: null,
    engineCode: null,
    source: 'SUPPLIER',
    note: null,
    ...overrides,
  };
}

const CIVIC = { make: 'Honda', model: 'Civic', year: 2020 };

describe('fitsVehicle', () => {
  it('does not treat silence as approval', () => {
    // The dangerous answer is not "it does not fit". It is nothing at all,
    // read as a tick.
    const result = fitsVehicle([], CIVIC);

    expect(result.verdict).toBe('UNKNOWN');
    expect(result.confidence).toBe('NONE');
    expect(result.why).toContain('not the same as it fitting');
  });

  it('confirms a plain match', () => {
    const result = fitsVehicle(
      [fitment({ make: 'Honda', model: 'Civic', yearFrom: 2018, yearTo: 2022 })],
      CIVIC,
    );

    expect(result.verdict).toBe('FITS');
    expect(result.confidence).toBe('HIGH');
  });

  it('refuses a different make outright', () => {
    const result = fitsVehicle([fitment({ make: 'Toyota', model: 'Corolla' })], CIVIC);

    expect(result.verdict).toBe('DOES_NOT_FIT');
    expect(result.why).toContain('Toyota');
  });

  it('refuses a year outside the range', () => {
    const result = fitsVehicle(
      [fitment({ make: 'Honda', model: 'Civic', yearFrom: 2010, yearTo: 2015 })],
      CIVIC,
    );

    expect(result.verdict).toBe('DOES_NOT_FIT');
  });

  it('handles an open-ended range at either side', () => {
    expect(
      fitsVehicle([fitment({ make: 'Honda', model: 'Civic', yearFrom: 2018 })], CIVIC).verdict,
    ).toBe('FITS');

    expect(
      fitsVehicle([fitment({ make: 'Honda', model: 'Civic', yearTo: 2022 })], CIVIC).verdict,
    ).toBe('FITS');
  });

  it('does not exclude a vehicle that has no year on record', () => {
    // Treating a missing year as outside the range reports a perfectly good
    // part as wrong, which is the error that makes people stop reading the
    // warnings.
    const result = fitsVehicle(
      [fitment({ make: 'Honda', model: 'Civic', yearFrom: 2018, yearTo: 2022 })],
      { make: 'Honda', model: 'Civic', year: null },
    );

    expect(result.verdict).toBe('FITS');
  });

  it('ignores case and spacing, because catalogues differ and the car does not', () => {
    const result = fitsVehicle([fitment({ make: ' honda ', model: 'CIVIC' })], CIVIC);
    expect(result.verdict).toBe('FITS');
  });

  it('still fits under a make-wide claim that excludes nothing', () => {
    // "Fits Honda" with no model named is a claim about every Honda, and a
    // row about the Jazz says nothing about the Civic either way.
    const result = fitsVehicle(
      [
        fitment({ make: 'Honda' }),
        fitment({ make: 'Honda', model: 'Jazz', yearFrom: 2015, yearTo: 2020 }),
      ],
      CIVIC,
    );

    expect(result.verdict).toBe('FITS');
  });

  it('picks the entry that actually covers the vehicle', () => {
    // Two rows for the same model and different years. The one that matches
    // has to decide it, not whichever came back from the database first.
    const result = fitsVehicle(
      [
        fitment({ make: 'Honda', model: 'Civic', yearFrom: 2005, yearTo: 2010 }),
        fitment({ make: 'Honda', model: 'Civic', yearFrom: 2018, yearTo: 2022 }),
      ],
      CIVIC,
    );

    expect(result.verdict).toBe('FITS');
    expect(result.matched!.yearFrom).toBe(2018);
  });

  it('refuses when every row for that model rules the vehicle out', () => {
    const result = fitsVehicle(
      [
        fitment({ make: 'Honda', model: 'Civic', yearFrom: 2005, yearTo: 2010 }),
        fitment({ make: 'Honda', model: 'Civic', yearFrom: 2011, yearTo: 2015 }),
      ],
      CIVIC,
    );

    expect(result.verdict).toBe('DOES_NOT_FIT');
    expect(result.why).toContain('2005');
  });

  it('asks rather than guesses when an engine code is needed and absent', () => {
    const result = fitsVehicle(
      [fitment({ make: 'Honda', model: 'Civic', engineCode: 'L15B7' })],
      CIVIC,
    );

    expect(result.verdict).toBe('UNKNOWN');
    expect(result.why).toContain('no engine code on record');
  });

  it('matches on the engine code when the vehicle has one', () => {
    const result = fitsVehicle([fitment({ make: 'Honda', model: 'Civic', engineCode: 'L15B7' })], {
      ...CIVIC,
      engineCode: 'l15b7',
    });

    expect(result.verdict).toBe('FITS');
  });

  it('says nothing can be checked against a vehicle with no make', () => {
    const result = fitsVehicle([fitment({ make: 'Honda' })], {
      make: null,
      model: null,
      year: null,
    });

    expect(result.verdict).toBe('UNKNOWN');
  });

  it('rates a workshop observation below a supplier catalogue', () => {
    // Presenting both as "fits" would be lying by omission: one is a
    // catalogue, the other is that somebody once fitted one.
    const supplier = fitsVehicle(
      [fitment({ make: 'Honda', model: 'Civic', source: 'SUPPLIER' })],
      CIVIC,
    );
    const observed = fitsVehicle(
      [fitment({ make: 'Honda', model: 'Civic', source: 'OBSERVED' })],
      CIVIC,
    );

    expect(supplier.confidence).toBe('HIGH');
    expect(observed.confidence).toBe('LOW');
    expect(observed.why).toContain('fitted one before');
  });
});

describe('fitmentWarning', () => {
  it('says nothing when the part fits', () => {
    // Congratulating somebody on every correct line trains them to dismiss
    // the one that matters.
    const result = fitsVehicle([fitment({ make: 'Honda', model: 'Civic' })], CIVIC);
    expect(fitmentWarning(result)).toBeNull();
  });

  it('speaks up when it does not fit', () => {
    const result = fitsVehicle([fitment({ make: 'Toyota' })], CIVIC);
    expect(fitmentWarning(result)).toContain('Toyota');
  });

  it('speaks up when an engine code is needed and missing', () => {
    const result = fitsVehicle(
      [fitment({ make: 'Honda', model: 'Civic', engineCode: 'L15B7' })],
      CIVIC,
    );
    expect(fitmentWarning(result)).toContain('engine code');
  });

  it('stays quiet when nobody has recorded anything', () => {
    // There is nothing useful to say on every part line in a workshop with no
    // fitment data, which is every workshop until a provider is wired in.
    const result = fitsVehicle([], CIVIC);
    expect(fitmentWarning(result)).toBeNull();
  });
});
