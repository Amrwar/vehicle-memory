import { describe, expect, it } from 'vitest';

import {
  ArrivalError,
  assertCheckInAllowed,
  assertCheckOutAllowed,
  assertKeyMove,
  assertSigned,
  DAMAGE_AREAS,
  fuelLabel,
  keyState,
  signatureIsUsable,
  type SignatureStrokes,
} from './arrival';

const scrawl: SignatureStrokes = {
  width: 400,
  height: 150,
  strokes: [
    [
      [20, 80],
      [60, 40],
      [100, 90],
      [140, 30],
      [180, 100],
    ],
    [
      [200, 70],
      [240, 60],
      [280, 95],
      [320, 40],
    ],
  ],
};

function code(run: () => void): string | null {
  try {
    run();
    return null;
  } catch (error) {
    return error instanceof ArrivalError ? error.code : String(error);
  }
}

describe('a signature', () => {
  it('counts when it moves across the pad', () => {
    expect(signatureIsUsable(scrawl)).toBe(true);
  });

  it('does not count as a dot, a stray touch, or nothing', () => {
    expect(signatureIsUsable(null)).toBe(false);
    expect(signatureIsUsable({ width: 400, height: 150, strokes: [] })).toBe(false);
    expect(
      signatureIsUsable({
        width: 400,
        height: 150,
        strokes: [
          [
            [10, 10],
            [11, 10],
            [12, 11],
            [12, 12],
            [13, 12],
            [13, 13],
            [14, 13],
            [14, 14],
          ],
        ],
      }),
    ).toBe(false);
  });

  it('is checked together with the name', () => {
    expect(code(() => assertSigned({ signature: scrawl, name: 'Maria' }))).toBeNull();
    expect(code(() => assertSigned({ signature: null, name: 'Maria' }))).toBe('NO_SIGNATURE');
    expect(code(() => assertSigned({ signature: scrawl, name: '  ' }))).toBe('NO_NAME');
  });
});

describe('checking in', () => {
  it('is allowed once, while the job is open', () => {
    expect(
      code(() => assertCheckInAllowed({ jobStatus: 'RECEIVED', alreadyIn: false })),
    ).toBeNull();
    expect(code(() => assertCheckInAllowed({ jobStatus: 'RECEIVED', alreadyIn: true }))).toBe(
      'ALREADY_IN',
    );
    expect(code(() => assertCheckInAllowed({ jobStatus: 'PAID', alreadyIn: false }))).toBe(
      'CLOSED',
    );
  });

  it('refuses a reading that goes backwards and a fuel level off the gauge', () => {
    expect(
      code(() =>
        assertCheckInAllowed({
          jobStatus: 'RECEIVED',
          alreadyIn: false,
          odometerKm: 1000,
          lastOdometerKm: 2000,
        }),
      ),
    ).toBe('MILEAGE_BACK');
    expect(
      code(() => assertCheckInAllowed({ jobStatus: 'RECEIVED', alreadyIn: false, fuelEighths: 9 })),
    ).toBe('BAD_FUEL');
    expect(
      code(() =>
        assertCheckInAllowed({
          jobStatus: 'RECEIVED',
          alreadyIn: false,
          odometerKm: 2500,
          lastOdometerKm: 2000,
          fuelEighths: 4,
        }),
      ),
    ).toBeNull();
  });
});

describe('checking out', () => {
  const done = { jobStatus: 'PAID', checkedIn: true, alreadyOut: false, outstandingMinor: 0 };

  it('needs the work finished and the money in, or a reason', () => {
    expect(code(() => assertCheckOutAllowed(done))).toBeNull();
    expect(code(() => assertCheckOutAllowed({ ...done, jobStatus: 'IN_PROGRESS' }))).toBe(
      'NOT_DONE',
    );
    expect(code(() => assertCheckOutAllowed({ ...done, outstandingMinor: 1200 }))).toBe('OWING');
    expect(
      code(() =>
        assertCheckOutAllowed({
          ...done,
          outstandingMinor: 1200,
          letGoOwingReason: 'Account customer, invoiced monthly',
        }),
      ),
    ).toBeNull();
    expect(code(() => assertCheckOutAllowed({ ...done, alreadyOut: true }))).toBe('ALREADY_OUT');
  });

  it('will not let the car leave with fewer kilometres than it arrived with', () => {
    expect(
      code(() => assertCheckOutAllowed({ ...done, odometerKm: 74_800, odometerInKm: 74_900 })),
    ).toBe('MILEAGE_BACK');
    expect(
      code(() => assertCheckOutAllowed({ ...done, odometerKm: 74_912, odometerInKm: 74_900 })),
    ).toBeNull();
  });
});

describe('the keys', () => {
  const t = (minutes: number) => new Date(Date.UTC(2026, 8, 15, 9, minutes));

  it('are nowhere until somebody says', () => {
    expect(keyState([]).where).toBe('unknown');
  });

  it('follow the latest event and remember the hook', () => {
    const events = [
      { action: 'HUNG' as const, hook: '12', at: t(0) },
      { action: 'TAKEN' as const, byName: 'John', at: t(30) },
    ];
    expect(keyState(events)).toMatchObject({ where: 'with', holder: 'John', hook: '12' });
    expect(keyState([...events, { action: 'RETURNED', at: t(90) }])).toMatchObject({
      where: 'hook',
      hook: '12',
      sentence: 'Keys on hook 12.',
    });
    expect(keyState([...events, { action: 'HANDED_TO_CUSTOMER', at: t(120) }]).sentence).toBe(
      'Keys handed back to the customer.',
    );
  });

  it('is told the order however the events arrive', () => {
    expect(
      keyState([
        { action: 'TAKEN', byName: 'John', at: t(30) },
        { action: 'HUNG', hook: '4', at: t(0) },
      ]).where,
    ).toBe('with');
  });

  it('needs a hook to hang on and keys to take', () => {
    expect(code(() => assertKeyMove({ action: 'HUNG', current: keyState([]) }))).toBe('NO_HOOK');
    expect(
      code(() =>
        assertKeyMove({
          action: 'TAKEN',
          current: keyState([{ action: 'HANDED_TO_CUSTOMER', at: t(0) }]),
        }),
      ),
    ).toBe('NOT_IN');
    expect(
      code(() => assertKeyMove({ action: 'HUNG', hook: '7', current: keyState([]) })),
    ).toBeNull();
  });
});

describe('the form', () => {
  it('has a short list of places to look and a gauge in eighths', () => {
    expect(DAMAGE_AREAS.length).toBe(12);
    expect(fuelLabel(4)).toBe('½');
    expect(fuelLabel(8)).toBe('full');
    expect(fuelLabel(null)).toBe('not noted');
  });
});
