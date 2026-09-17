import { describe, expect, it } from 'vitest';

import {
  broken,
  describeDuration,
  describeRecovery,
  fileMissing,
  fileOrphaned,
  missedTargets,
  recoveryOf,
  rowsMissing,
  timeTaken,
  workLost,
  worstGapsFirst,
} from './restored';

const at = (iso: string) => new Date(iso);

describe('how much work a restore lost', () => {
  it('is the window between the last write that survived and the last that happened', () => {
    expect(
      workLost({
        lastSurvived: at('2026-09-17T02:00:00Z'),
        lastHappened: at('2026-09-17T02:04:00Z'),
      }),
    ).toBe(240);
  });

  it('is nothing when the last write survived, however old the backup is', () => {
    // A backup taken at midnight from a system nobody touched until morning
    // has lost nothing. Reporting eight hours would send somebody chasing a
    // problem that does not exist.
    const midnight = at('2026-09-17T00:00:00Z');
    expect(workLost({ lastSurvived: midnight, lastHappened: midnight })).toBe(0);
  });

  it('never goes negative when the copy somehow has the newer write', () => {
    expect(
      workLost({
        lastSurvived: at('2026-09-17T02:05:00Z'),
        lastHappened: at('2026-09-17T02:00:00Z'),
      }),
    ).toBe(0);
  });
});

describe('how long the doors were shut', () => {
  it('runs from losing it to having it back and checked', () => {
    expect(timeTaken({ lost: at('2026-09-17T02:00:00Z'), back: at('2026-09-17T02:18:00Z') })).toBe(
      1_080,
    );
  });
});

describe('a table held against the original', () => {
  it('says nothing when every row came back', () => {
    expect(rowsMissing({ table: 'invoices', before: 40, after: 40 })).toBeNull();
  });

  it('names what is missing, and how many', () => {
    const gap = rowsMissing({ table: 'invoices', before: 40, after: 37 });
    expect(gap?.kind).toBe('missing');
    expect(gap?.sentence).toContain('3 missing');
  });

  it('calls a table that grew orphaned rather than missing', () => {
    const gap = rowsMissing({ table: 'invoices', before: 40, after: 41 });
    expect(gap?.kind).toBe('orphaned');
    expect(gap?.sentence).toContain('1 rows more');
  });
});

describe('the store and the rows that point at it', () => {
  it('separates a hole from a leftover, because they are repaired in opposite directions', () => {
    const hole = fileMissing({ what: 'Photograph', name: 'p-1', key: 'org/1/a.jpg' });
    const leftover = fileOrphaned({ key: 'org/1/b.jpg' });

    expect(hole.kind).toBe('missing');
    expect(leftover.kind).toBe('orphaned');
  });

  it('names the key in both, because the key is what somebody goes and looks for', () => {
    expect(fileMissing({ what: 'Photograph', name: 'p-1', key: 'org/1/a.jpg' }).sentence).toContain(
      'org/1/a.jpg',
    );
    expect(fileOrphaned({ key: 'org/1/b.jpg' }).sentence).toContain('org/1/b.jpg');
  });
});

describe('reading the drill', () => {
  const gaps = [
    fileOrphaned({ key: 'org/1/b.jpg' }),
    fileMissing({ what: 'Photograph', name: 'p-1', key: 'org/1/a.jpg' }),
    broken({ what: 'Passport', name: 'WBA…', because: 'the chain no longer verifies' }),
    null,
  ];

  it('puts broken first, then holes, then leftovers', () => {
    const worst = worstGapsFirst(recoveryOf({ lost: 0, took: 60, checked: 4 }, gaps).gaps);
    expect(worst.map((gap) => gap.kind)).toEqual(['broken', 'missing', 'orphaned']);
  });

  it('says so plainly when everything came back', () => {
    expect(describeRecovery(recoveryOf({ lost: 0, took: 90, checked: 12 }, [null]))).toBe(
      'Lost 0 seconds of work, back in 2 minutes, 12 checked, everything came back.',
    );
  });

  it('and counts each kind when it did not', () => {
    const said = describeRecovery(recoveryOf({ lost: 240, took: 600, checked: 4 }, gaps));
    expect(said).toContain('1 broken');
    expect(said).toContain('1 missing');
    expect(said).toContain('1 orphaned');
  });
});

describe('the promise', () => {
  it('is kept by a recovery inside both targets', () => {
    expect(missedTargets(recoveryOf({ lost: 60, took: 600, checked: 1 }, []))).toEqual([]);
  });

  it('names the number that was missed, and by how much', () => {
    const missed = missedTargets(recoveryOf({ lost: 3_600, took: 7_200, checked: 1 }, []));

    expect(missed).toHaveLength(2);
    expect(missed[0]).toContain('1 hour');
    expect(missed[0]).toContain('5 minutes');
    expect(missed[1]).toContain('2 hours');
  });
});

describe('a duration', () => {
  it('reads the way somebody would say it', () => {
    expect(describeDuration(1)).toBe('1 second');
    expect(describeDuration(45)).toBe('45 seconds');
    expect(describeDuration(60)).toBe('1 minute');
    expect(describeDuration(300)).toBe('5 minutes');
    expect(describeDuration(5_400)).toBe('1.5 hours');
  });
});
