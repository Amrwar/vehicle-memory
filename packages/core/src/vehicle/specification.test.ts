import { describe, expect, it } from 'vitest';

import {
  coerceSpec,
  disagreements,
  howFull,
  intervalsFrom,
  missingSpec,
  resolveSpec,
  SPEC_KEYS,
  SPEC_LINES,
  SPEC_SOURCE_SENTENCE,
  SPEC_SOURCES,
  specKindOf,
  type SpecCandidate,
} from './specification';

const modelSheet: SpecCandidate = {
  source: 'MODEL_SHEET',
  values: { oilGrade: '0W-20', oilCapacityL: 6.5, tyreFront: '255/50 R19' },
};

describe('the lines', () => {
  it('are the fourteen a technician asks for', () => {
    expect(SPEC_LINES).toHaveLength(14);
    expect(SPEC_KEYS).toHaveLength(14);
  });

  it('are unique, so no line can quietly shadow another', () => {
    expect(new Set(SPEC_KEYS).size).toBe(SPEC_KEYS.length);
  });

  it('name a source for every kind there is', () => {
    for (const source of SPEC_SOURCES) expect(SPEC_SOURCE_SENTENCE[source]).toBeTruthy();
  });
});

describe('where a line comes from', () => {
  it('takes what somebody wrote for this car over the model sheet', () => {
    const resolved = resolveSpec([
      modelSheet,
      { source: 'THIS_CAR', values: { oilGrade: '5W-30' } },
    ]);

    const oil = resolved.find((line) => line.key === 'oilGrade');
    expect(oil?.value).toBe('5W-30');
    expect(oil?.source).toBe('THIS_CAR');
  });

  it('takes the workshop sheet over a feed', () => {
    const resolved = resolveSpec([
      { source: 'FEED', values: { oilGrade: '5W-40' }, feedName: 'sample' },
      modelSheet,
    ]);

    expect(resolved.find((line) => line.key === 'oilGrade')?.source).toBe('MODEL_SHEET');
  });

  it('falls through to the feed where nobody here has said', () => {
    const resolved = resolveSpec([
      modelSheet,
      { source: 'FEED', values: { brakeFluid: 'DOT 4' }, feedName: 'sample' },
    ]);

    const fluid = resolved.find((line) => line.key === 'brakeFluid');
    expect(fluid?.value).toBe('DOT 4');
    expect(fluid?.feedName).toBe('sample');
  });
});

describe('a blank is a blank', () => {
  it('leaves an unanswered line off the sheet rather than defaulting it', () => {
    const resolved = resolveSpec([modelSheet]);
    expect(resolved.map((line) => line.key)).toEqual(['oilGrade', 'oilCapacityL', 'tyreFront']);
  });

  it('names what is missing so the screen can ask', () => {
    const missing = missingSpec(resolveSpec([modelSheet]));
    expect(missing).toContain('coolantType');
    expect(missing).not.toContain('oilGrade');
    expect(missing).toHaveLength(11);
  });

  it('treats an empty string as unanswered, not as an answer', () => {
    const resolved = resolveSpec([{ source: 'THIS_CAR', values: { oilGrade: '' } }, modelSheet]);

    expect(resolved.find((line) => line.key === 'oilGrade')?.source).toBe('MODEL_SHEET');
  });

  it('keeps a zero, which is a real pressure answer and not a blank', () => {
    const resolved = resolveSpec([{ source: 'THIS_CAR', values: { tyrePressureFrontBar: 0 } }]);
    expect(resolved.find((line) => line.key === 'tyrePressureFrontBar')?.value).toBe(0);
  });

  it('is empty when nobody has said anything at all', () => {
    expect(resolveSpec([])).toEqual([]);
    expect(missingSpec([])).toHaveLength(14);
  });
});

describe('when two sources disagree', () => {
  // The most useful thing this sheet can say. One of them is wrong about an
  // engine, and somebody should find out which before the drain plug comes out.

  it('shows the argument rather than silently picking', () => {
    const resolved = resolveSpec([
      modelSheet,
      { source: 'FEED', values: { oilGrade: '5W-40' }, feedName: 'sample' },
    ]);

    const oil = resolved.find((line) => line.key === 'oilGrade');
    expect(oil?.value).toBe('0W-20');
    expect(oil?.disagrees).toEqual([{ source: 'FEED', value: '5W-40' }]);
  });

  it('says nothing when they agree', () => {
    const resolved = resolveSpec([
      modelSheet,
      { source: 'FEED', values: { oilGrade: '0W-20' }, feedName: 'sample' },
    ]);

    expect(disagreements(resolved)).toEqual([]);
  });

  it('does not call 6.5 and "6.5" an argument', () => {
    const resolved = resolveSpec([
      { source: 'THIS_CAR', values: { oilCapacityL: 6.5 } },
      { source: 'MODEL_SHEET', values: { oilCapacityL: '6.5' } },
    ]);

    expect(disagreements(resolved)).toEqual([]);
  });

  it('collects every line worth arguing about', () => {
    const resolved = resolveSpec([
      { source: 'THIS_CAR', values: { oilGrade: '5W-30', tyreFront: '255/50 R19' } },
      { source: 'MODEL_SHEET', values: { oilGrade: '0W-20', tyreFront: '275/45 R20' } },
    ]);

    expect(disagreements(resolved).map((line) => line.key)).toEqual(['oilGrade', 'tyreFront']);
  });
});

describe('how full the sheet is', () => {
  it('is a count of fourteen, never a percentage', () => {
    expect(howFull(resolveSpec([modelSheet]))).toEqual({ answered: 3, of: 14 });
  });
});

describe('the intervals the schedule wanted all along', () => {
  it('are handed over when the sheet has them', () => {
    const resolved = resolveSpec([
      { source: 'MODEL_SHEET', values: { serviceIntervalMonths: 12, serviceIntervalKm: 15000 } },
    ]);

    expect(intervalsFrom(resolved)).toEqual({ months: 12, km: 15000 });
  });

  it('are nothing when the sheet is silent, rather than a made-up year', () => {
    expect(intervalsFrom(resolveSpec([modelSheet]))).toBeNull();
  });

  it('carry one where only one is known', () => {
    const resolved = resolveSpec([{ source: 'MODEL_SHEET', values: { serviceIntervalKm: 20000 } }]);
    expect(intervalsFrom(resolved)).toEqual({ months: null, km: 20000 });
  });
});

describe('what a form sends, and what a column holds', () => {
  it('takes a comma for a decimal point, and trims', () => {
    expect(coerceSpec({ oilCapacityL: ' 6,5 ' }).values.oilCapacityL).toBe(6.5);
  });

  it('rounds a whole-number line rather than storing 12.4 months', () => {
    expect(coerceSpec({ serviceIntervalMonths: '12.4' }).values.serviceIntervalMonths).toBe(12);
  });

  it('refuses a figure that is not one, rather than making it nought', () => {
    // Nought bar is a real pressure and a real thing to be wrong about, so it
    // must never be what a typo turns into.
    const { values, refused } = coerceSpec({ tyrePressureFrontBar: 'about 2' });
    expect(refused).toEqual(['tyrePressureFrontBar']);
    expect(values.tyrePressureFrontBar).toBeUndefined();
  });

  it('clears a line when the box is emptied', () => {
    expect(coerceSpec({ oilGrade: '   ' }).values.oilGrade).toBeNull();
    expect(coerceSpec({ batteryAh: '' }).values.batteryAh).toBeNull();
  });

  it('leaves a line alone when the form did not carry it', () => {
    expect('oilGrade' in coerceSpec({ batteryAh: 90 }).values).toBe(false);
  });

  it('keeps text as text, untouched but trimmed', () => {
    expect(coerceSpec({ tyreFront: ' 255/50 R19 ' }).values.tyreFront).toBe('255/50 R19');
  });

  it('knows which lines are figures and which are words', () => {
    expect(specKindOf('oilGrade')).toBe('text');
    expect(specKindOf('oilCapacityL')).toBe('decimal');
    expect(specKindOf('batteryAh')).toBe('whole');
  });
});
