import { describe, expect, it } from 'vitest';

import {
  causeSentence,
  type CauseEvidence,
  ENOUGH_TO_SHOW,
  evidenceSentence,
  isSettled,
  jobsBehind,
  rankCauses,
  worthShowing,
} from './knowledge';

const runout: CauseEvidence = {
  causeCode: 'ROTOR_RUNOUT',
  label: 'Rotor runout',
  confirmed: 31,
  rejected: 4,
  undetermined: 2,
};

const padWear: CauseEvidence = {
  causeCode: 'PAD_WEAR_UNEVEN',
  label: 'Uneven pad wear',
  confirmed: 7,
  rejected: 1,
  undetermined: 0,
};

const hub: CauseEvidence = {
  causeCode: 'HUB_FACE',
  label: 'Hub face contamination',
  confirmed: 3,
  rejected: 9,
  undetermined: 1,
};

describe('what the workshop has confirmed before', () => {
  it('orders by how often it has been found, not by how sure it sounds', () => {
    expect(rankCauses([hub, padWear, runout]).map((one) => one.causeCode)).toEqual([
      'ROTOR_RUNOUT',
      'PAD_WEAR_UNEVEN',
      'HUB_FACE',
    ]);
  });

  it('counts the jobs that reached a verdict, not the ones that gave up', () => {
    const [top] = rankCauses([runout]);
    expect(top!.decided).toBe(35);
    expect(top!.share).toBeCloseTo(31 / 35);
  });

  it('shows nothing that has been found fewer than three times', () => {
    const once: CauseEvidence = { ...padWear, causeCode: 'ONCE', confirmed: 2, rejected: 40 };
    expect(rankCauses([once])).toEqual([]);
    expect(ENOUGH_TO_SHOW).toBe(3);
  });

  it('drops a cause that has only ever been ruled out', () => {
    const never: CauseEvidence = {
      causeCode: 'NEVER',
      label: 'Wheel bearing',
      confirmed: 0,
      rejected: 22,
      undetermined: 0,
    };
    expect(rankCauses([never])).toEqual([]);
  });

  // The one that matters. A cause confirmed three times out of twelve is on
  // the list, because three times is three times -- but it sits below one
  // confirmed thirty-one times, and its own line says it was ruled out nine
  // times. The screen never shows a confirmation count without its refusals.
  it('keeps a thin cause but never hides how often it was wrong', () => {
    const ranked = rankCauses([runout, hub]);
    expect(ranked.at(-1)!.causeCode).toBe('HUB_FACE');
    expect(causeSentence(ranked.at(-1)!)).toEqual({
      key: 'Confirmed {confirmed} times, ruled out {rejected}',
      vars: { confirmed: 3, rejected: 9 },
    });
  });

  it('says plainly when a cause has never been ruled out', () => {
    const clean = rankCauses([{ ...runout, rejected: 0 }])[0]!;
    expect(causeSentence(clean)).toEqual({
      key: 'Confirmed {confirmed} times, never ruled out',
      vars: { confirmed: 31 },
    });
  });
});

describe('a workshop with no history yet', () => {
  it('has nothing worth showing', () => {
    expect(worthShowing([])).toBe(false);
    expect(worthShowing([{ ...padWear, confirmed: 1 }])).toBe(false);
  });

  it('and is told that, rather than shown an empty list', () => {
    expect(evidenceSentence({ symptom: 'Brake pedal vibration', jobs: 0, causes: 0 })).toEqual({
      key: 'Nothing has been confirmed here often enough to be worth showing. It will appear once {enough} jobs have settled on the same cause.',
      vars: { enough: 3 },
    });
  });

  it('reports the past rather than forecasting the car on the ramp', () => {
    const sentence = evidenceSentence({ symptom: 'Brake pedal vibration', jobs: 35, causes: 2 });
    expect(sentence.key).toContain('reached a verdict');
    expect(sentence.key).toContain('what they turned out to be');
    expect(sentence.key).not.toContain('likely');
    expect(sentence.vars).toEqual({ jobs: 35, symptom: 'Brake pedal vibration' });
  });
});

describe('the count behind it', () => {
  it('is every job that settled either way', () => {
    expect(jobsBehind([runout, padWear, hub])).toBe(31 + 4 + 7 + 1 + 3 + 9);
  });

  it('ignores the ones that never settled, because they proved nothing', () => {
    expect(jobsBehind([{ ...runout, undetermined: 100 }])).toBe(35);
  });
});

describe('when a diagnosis is finished', () => {
  it('is when every cause considered has a verdict', () => {
    expect(isSettled([{ outcome: 'CONFIRMED' }, { outcome: 'REJECTED' }])).toBe(true);
    expect(isSettled([{ outcome: 'CONFIRMED' }, { outcome: null }])).toBe(false);
  });

  // Not determined is a verdict. A corpus that only hears about the causes
  // somebody found will recommend the last thing that worked for ever.
  it('counts "not determined" as an answer', () => {
    expect(isSettled([{ outcome: 'UNDETERMINED' }])).toBe(true);
  });

  it('and nothing considered is not a finished diagnosis', () => {
    expect(isSettled([])).toBe(false);
  });
});
