import { describe, expect, it } from 'vitest';

import {
  changed,
  coverage,
  describeClock,
  describeMeasured,
  describeSeconds,
  ENOUGH,
  type Measured,
  medianSeconds,
  record,
  slowestTenth,
  type Stretch,
  verdictOf,
  worstStretchesFirst,
} from './stretches';

const stretch: Stretch = {
  name: 'Car in to job open',
  from: 'the car arrived',
  to: 'the job was written',
  target: 15 * 60,
  because: 'A judgement.',
};

const measured = (samples: number[], candidates = samples.length): Measured => ({
  stretch,
  samples,
  candidates,
});

describe('what usually happens', () => {
  it('takes the median, so one car left over a bank holiday changes nothing', () => {
    const usual = [300, 360, 420, 400, 380];
    const withOutlier = [...usual, 3 * 86_400];

    expect(medianSeconds(usual)).toBe(380);
    // The mean would be over twelve hours. The median barely moves.
    expect(medianSeconds(withOutlier)).toBe(390);
  });

  it('says nothing rather than zero when there is nothing to say', () => {
    expect(medianSeconds([])).toBeNull();
    expect(slowestTenth([])).toBeNull();
  });

  it('reports the slow tail as well, because that is where complaints come from', () => {
    // A process that works, and two jobs a month that escape it entirely. The
    // median says ten minutes and the workshop still gets complaints; the
    // ninetieth percentile is the reason, and reporting only the median hides
    // it completely.
    const samples = [
      ...Array.from({ length: 17 }, (_, i) => 600 + i * 10),
      2 * 86_400,
      2 * 86_400,
      2 * 86_400,
    ];

    expect(medianSeconds(samples)).toBe(695);
    expect(slowestTenth(samples)).toBe(172_800);
  });
});

describe('being honest about how much was seen', () => {
  it('reports the share it could measure', () => {
    expect(coverage(measured([1, 2, 3], 12))).toBe(25);
    expect(coverage(measured([], 0))).toBe(0);
  });

  it('refuses to judge a stretch it barely saw, however good the figures look', () => {
    const barely = measured([1, 1], 500);

    expect(barely.samples.length).toBeLessThan(ENOUGH);
    expect(verdictOf(barely)).toBe('unknown');
    expect(describeMeasured(barely)).toContain('not enough to say anything');
  });

  it('judges one it saw enough of', () => {
    expect(verdictOf(measured([300, 300, 300, 300, 300]))).toBe('good');
    expect(verdictOf(measured([3_000, 3_000, 3_000, 3_000, 3_000]))).toBe('slow');
  });

  it('says the figure, the tail, the target and the coverage in one line', () => {
    const said = describeMeasured(measured([300, 360, 420, 400, 380], 20));

    expect(said).toContain('usually 6 minutes');
    expect(said).toContain('target 15 minutes');
    expect(said).toContain('from 5 of 20');
  });
});

describe('a duration in words somebody would use', () => {
  it('rounds to the unit that matters', () => {
    expect(describeSeconds(45)).toBe('45 seconds');
    expect(describeSeconds(600)).toBe('10 minutes');
    expect(describeSeconds(7_412)).toBe('2.1 hours');
    expect(describeSeconds(3 * 86_400)).toBe('3 days');
  });
});

describe('reading the whole day', () => {
  const all = [
    measured([300, 300, 300, 300, 300]),
    measured([3_000, 3_000, 3_000, 3_000, 3_000]),
    measured([1], 40),
  ];

  it('puts the stretch furthest past its target first', () => {
    expect(medianSeconds(worstStretchesFirst(all)[0]!.samples)).toBe(3_000);
  });

  it('counts the slow ones and the ones it could not see', () => {
    expect(describeClock(all)).toContain('1 slower than they should be');
    expect(describeClock(all)).toContain('1 with too little to go on');
  });

  it('says so plainly when everything is inside', () => {
    expect(describeClock([measured([60, 60, 60, 60, 60])])).toContain(
      'all inside what a good workshop would take',
    );
  });
});

describe('before a pilot and after it', () => {
  const before = record(measured([600, 620, 640, 660, 680]));
  const after = record(measured([300, 310, 320, 330, 340]));

  it('says what moved, and by how much', () => {
    const change = changed(before, after);

    expect(change.comparable).toBe(true);
    expect(change.by).toBeLessThan(0);
    expect(change.sentence).toContain('faster');
  });

  it('refuses to compare two figures measured on almost nothing', () => {
    // A pilot that moves a median from twelve minutes to four, on three jobs
    // each side, has moved nothing anybody can rely on.
    const thin = changed(record(measured([700, 700, 700])), record(measured([200, 200, 200])));

    expect(thin.comparable).toBe(false);
    expect(thin.by).toBeNull();
    expect(thin.sentence).toContain('not enough work measured');
  });

  it('says the same when it is the same', () => {
    expect(changed(before, before).sentence).toContain('the same');
  });
});
