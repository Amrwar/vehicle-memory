import { describe, expect, it } from 'vitest';

import {
  cleanFeedFitment,
  decodeLocally,
  FEED_ROWS_PER_PART,
  googleReviewSite,
  isReviewSiteUrl,
  makeFromWmi,
  normaliseGooglePlaceId,
  noReviewSite,
  planFeedImport,
  readVpicDecoding,
  sampleFitmentFeed,
  stubVinDecoder,
  vinEncodesYear,
  type HeldFitment,
} from './index';

describe('VIN decoding', () => {
  it('names the maker from the first three characters', () => {
    expect(makeFromWmi('wvwzzz1jz3w386752')).toBe('Volkswagen');
    expect(makeFromWmi('WBAJA9C509G000000')).toBe('BMW');
    expect(makeFromWmi('1M8GDM9AXKP042788')).toBeNull();
  });

  it('reads the year only from a VIN built to encode one', () => {
    // North American: the tenth character is the year.
    expect(vinEncodesYear('5YJ3E1EA7KF317000')).toBe(true);
    // European, check digit not used: the tenth character may be anything.
    expect(vinEncodesYear('WVWZZZ1JZ3W386752')).toBe(false);
    // A valid check digit means the VIN follows the standard that has a year.
    expect(vinEncodesYear('1M8GDM9AXKP042788')).toBe(true);
  });

  it('decodes locally without a model, and says so', () => {
    const tesla = decodeLocally('5YJ3E1EA7KF317000', 2026);
    expect(tesla).toMatchObject({ make: 'Tesla', year: 2019, model: null, complete: false });
    expect(decodeLocally('WVWZZZ1JZ3W386752', 2026)).toMatchObject({
      make: 'Volkswagen',
      year: null,
    });
  });

  it('refuses what is not a VIN', async () => {
    expect(() => decodeLocally('ABC')).toThrow(/17 characters/);
    await expect(stubVinDecoder.decode('WVWZZZ1JZ3W38675O')).rejects.toThrow(/no I, O or Q/);
  });

  it('reads the registry answer over the local one', () => {
    const decoded = readVpicDecoding(
      '5YJ3E1EA7KF317000',
      {
        Results: [
          {
            Make: 'TESLA',
            Model: 'Model 3',
            ModelYear: '2019',
            DisplacementL: '',
            EngineCylinders: '',
            EngineModel: '',
            FuelTypePrimary: 'Electric',
            BodyClass: 'Sedan/Saloon',
          },
        ],
      },
      2026,
    );

    expect(decoded).toMatchObject({
      make: 'Tesla',
      model: 'Model 3',
      year: 2019,
      fuel: 'Electric',
      body: 'Sedan/Saloon',
      engine: null,
      decoder: 'NHTSA vPIC',
      complete: true,
    });
  });

  it('describes the engine from its parts, and keeps the local answer when the registry has none', () => {
    const decoded = readVpicDecoding(
      '1M8GDM9AXKP042788',
      {
        Results: [
          {
            Make: 'MOTOR COACH INDUSTRIES',
            Model: '',
            DisplacementL: '12.7',
            EngineCylinders: '6',
            EngineModel: 'Series 60',
          },
        ],
      },
      2026,
    );
    expect(decoded.make).toBe('Motor Coach Industries');
    expect(decoded.engine).toBe('12.7 L · 6 cyl · Series 60');
    expect(decoded.complete).toBe(false);
    expect(readVpicDecoding('WBAJA9C509G000000', { Results: [] }, 2026).make).toBe('BMW');
    expect(readVpicDecoding('WBAJA9C509G000000', null, 2026).decoder).toBe('the built-in reader');
  });
});

const held = (over: Partial<HeldFitment> & { id: string }): HeldFitment => ({
  make: 'Toyota',
  model: 'Corolla',
  yearFrom: null,
  yearTo: null,
  engineCode: null,
  source: 'SUPPLIER',
  feedName: null,
  ...over,
});

describe('fitment feeds', () => {
  it('drops rows it cannot write rather than repairing them', () => {
    expect(cleanFeedFitment({ make: '  ' })).toBeNull();
    expect(cleanFeedFitment({ make: 'BMW', yearFrom: 2020, yearTo: 2018 })).toBeNull();
    expect(cleanFeedFitment({ make: 'BMW', yearFrom: 20.5 })).toBeNull();
    expect(cleanFeedFitment({ make: ' BMW ', model: ' ' })).toEqual({
      make: 'BMW',
      model: null,
      yearFrom: null,
      yearTo: null,
      engineCode: null,
      note: null,
    });
  });

  it('never replaces what somebody here recorded, and never writes a claim twice', () => {
    const plan = planFeedImport(
      [
        held({ id: 'w', source: 'WORKSHOP' }),
        held({ id: 'm', model: 'Yaris', source: 'MANUFACTURER' }),
      ],
      [
        { make: 'toyota', model: 'corolla' },
        { make: 'Toyota', model: 'Yaris' },
        { make: 'Toyota', model: 'RAV4', yearFrom: 2019 },
        { make: 'Toyota', model: 'RAV4', yearFrom: 2019 },
        { make: '' },
      ],
      'Sample catalogue',
    );

    expect(plan.keptWorkshop).toBe(1);
    expect(plan.unchanged).toBe(1);
    expect(plan.create).toEqual([expect.objectContaining({ model: 'RAV4', yearFrom: 2019 })]);
    expect(plan.invalid).toBe(1);
    expect(plan.remove).toEqual([]);
  });

  it('takes away only what the same feed wrote and no longer sends', () => {
    const plan = planFeedImport(
      [
        held({ id: 'old', model: 'Auris', feedName: 'Sample catalogue' }),
        held({ id: 'other', model: 'Prius', feedName: 'Another feed' }),
        held({ id: 'kept', model: 'Corolla', feedName: 'Sample catalogue' }),
      ],
      [{ make: 'Toyota', model: 'Corolla' }],
      'Sample catalogue',
    );
    expect(plan.remove).toEqual(['old']);
    expect(plan.unchanged).toBe(1);
  });

  it('stops at the per-part limit', () => {
    const incoming = Array.from({ length: FEED_ROWS_PER_PART + 5 }, (_, index) => ({
      make: 'Ford',
      model: `Model ${index}`,
    }));
    const plan = planFeedImport([], incoming, 'Feed');
    expect(plan.create).toHaveLength(FEED_ROWS_PER_PART);
    expect(plan.invalid).toBe(5);
  });

  it('has a sample feed that knows only the sample parts', async () => {
    expect(await sampleFitmentFeed.lookup({ partNumber: '04152-yzza1', brand: null })).toHaveLength(
      3,
    );
    expect(await sampleFitmentFeed.lookup({ partNumber: 'MY-OWN-PART', brand: 'Bosch' })).toEqual(
      [],
    );
    expect(sampleFitmentFeed.sample).toBe(true);
  });
});

describe('review sites', () => {
  it('takes a place ID as pasted, or out of a Google address', () => {
    expect(normaliseGooglePlaceId(' ChIJN1t_tDeuEmsRUsoyG83frY4 ')).toBe(
      'ChIJN1t_tDeuEmsRUsoyG83frY4',
    );
    expect(
      normaliseGooglePlaceId(
        'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
      ),
    ).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
    expect(
      normaliseGooglePlaceId(
        'https://www.google.com/maps/place/?q=place_id:x&place_id=ChIJN1t_tDeuEmsRUsoyG83frY4',
      ),
    ).toBe('ChIJN1t_tDeuEmsRUsoyG83frY4');
    expect(normaliseGooglePlaceId('')).toBeNull();
  });

  it('refuses what is not a place ID', () => {
    expect(() => normaliseGooglePlaceId('Hillside Motors, Leeds')).toThrow(/not a Google place ID/);
    expect(() => normaliseGooglePlaceId('<script>')).toThrow(/not a Google place ID/);
  });

  it('builds the write-review address, or nothing', () => {
    const url = googleReviewSite.writeReviewUrl({ googlePlaceId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' });
    expect(url).toBe(
      'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
    );
    expect(isReviewSiteUrl(url!)).toBe(true);
    expect(googleReviewSite.writeReviewUrl({ googlePlaceId: null })).toBeNull();
    expect(googleReviewSite.writeReviewUrl({ googlePlaceId: 'bad id' })).toBeNull();
    expect(
      noReviewSite.writeReviewUrl({ googlePlaceId: 'ChIJN1t_tDeuEmsRUsoyG83frY4' }),
    ).toBeNull();
    expect(isReviewSiteUrl('https://evil.example/writereview')).toBe(false);
  });
});
