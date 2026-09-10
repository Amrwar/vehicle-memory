import { describe, expect, it } from 'vitest';

import {
  type HistoryFinding,
  type HistoryReading,
  inspectHistory,
  summariseHistory,
} from './history';

const NOW = new Date('2026-09-10T09:00:00');

function reading(
  daysAgo: number,
  km: number,
  overrides: Partial<HistoryReading> = {},
): HistoryReading {
  return {
    km,
    readAt: new Date(NOW.getTime() - daysAgo * 86_400_000),
    source: 'WORKSHOP',
    orgId: 'org-1',
    orgName: 'Hillside Motors',
    ...overrides,
  };
}

function kinds(findings: HistoryFinding[]): string[] {
  return findings.map((finding) => finding.kind);
}

describe('a clean history', () => {
  // Roughly 12,000 a year, recorded every six months.
  const clean = [
    reading(1_460, 20_000),
    reading(1_095, 32_000),
    reading(730, 44_000),
    reading(365, 56_000),
    reading(10, 68_000),
  ];

  it('finds nothing wrong', () => {
    expect(inspectHistory(clean, NOW)).toEqual([]);
  });

  it('says so without promising more than it can', () => {
    // "Nothing found" unqualified reads as a guarantee.
    expect(summariseHistory([], clean.length)).toMatch(
      /cannot speak for time nobody wrote anything down/,
    );
  });

  it('says nothing at all about a single reading', () => {
    expect(inspectHistory([reading(10, 68_000)], NOW)).toEqual([]);
  });
});

describe('an odometer that went backwards', () => {
  it('is found, and stated as arithmetic rather than suspicion', () => {
    const findings = inspectHistory(
      [reading(730, 90_000), reading(365, 95_000), reading(10, 60_000)],
      NOW,
    );

    const rollback = findings.find((finding) => finding.kind === 'ROLLBACK');

    expect(rollback?.severity).toBe('SERIOUS');
    expect(rollback?.confidence).toBe('CERTAIN');
    expect(rollback?.summary).toMatch(/35,000 fewer miles/);
  });

  it('is found when later readings hide it', () => {
    // Up, down, up. Every adjacent pair at the end looks fine, so a check that
    // compares only the last two readings shows nothing.
    const findings = inspectHistory(
      [
        reading(1_460, 80_000),
        reading(1_095, 45_000),
        reading(730, 60_000),
        reading(365, 75_000),
        reading(10, 92_000),
      ],
      NOW,
    );

    expect(kinds(findings)).toContain('MASKED_ROLLBACK');
    expect(findings[0]?.detail).toMatch(/only compares the last two would show nothing/);
  });

  it('offers the innocent explanation as well as the guilty one', () => {
    const findings = inspectHistory([reading(365, 95_000), reading(10, 60_000)], NOW);

    expect(findings[0]?.detail).toMatch(/instrument cluster was replaced/);
  });
});

describe('distances nobody drove', () => {
  it('flags a rate no road vehicle sustains', () => {
    const findings = inspectHistory([reading(30, 40_000), reading(10, 90_000)], NOW);

    const rate = findings.find((finding) => finding.kind === 'IMPLAUSIBLE_RATE');

    expect(rate?.confidence).toBe('CERTAIN');
    expect(rate?.summary).toMatch(/2,500 miles a day/);
  });

  it('ignores two readings taken the same day', () => {
    // A big jump over a few hours is a typo or two entries for one visit, and
    // dividing by nearly zero produces a spectacular meaningless number.
    const sameDay = [
      { ...reading(10, 40_000) },
      { ...reading(10, 40_900), readAt: new Date(NOW.getTime() - 10 * 86_400_000 + 3_600_000) },
    ];

    expect(kinds(inspectHistory(sameDay, NOW))).not.toContain('IMPLAUSIBLE_RATE');
  });
});

describe('a vehicle that suddenly slowed down', () => {
  it('raises it as a question, never as a conclusion', () => {
    const findings = inspectHistory(
      [
        reading(1_460, 20_000),
        reading(1_095, 38_000),
        reading(730, 56_000),
        reading(365, 60_000),
        reading(10, 61_500),
      ],
      NOW,
    );

    const collapse = findings.find((finding) => finding.kind === 'RATE_COLLAPSE');

    expect(collapse?.confidence).toBe('POSSIBLE');
    expect(collapse?.severity).toBe('CONCERN');
    // Stating this as fraud would be wrong more often than right.
    expect(collapse?.detail).toMatch(/retirement, illness or a second car/);
  });

  it('says nothing when there is too little history to compare against', () => {
    const findings = inspectHistory([reading(200, 10_000), reading(10, 10_400)], NOW);

    expect(kinds(findings)).not.toContain('RATE_COLLAPSE');
  });
});

describe('two workshops that disagree', () => {
  it('reports the conflict, and names the likeliest cause', () => {
    const findings = inspectHistory(
      [
        reading(400, 50_000),
        reading(20, 62_000, { orgId: 'org-1', orgName: 'Hillside Motors' }),
        reading(14, 68_000, { orgId: 'org-2', orgName: 'Kirkstall Autocentre' }),
      ],
      NOW,
    );

    const conflict = findings.find((finding) => finding.kind === 'CONFLICT');

    expect(conflict?.confidence).toBe('LIKELY');
    expect(conflict?.detail).toMatch(/a typed digit is the most common reason/);
  });

  it('ignores one workshop writing two figures in a fortnight', () => {
    // That is a typo to correct, not a disagreement between parties.
    const findings = inspectHistory(
      [reading(400, 50_000), reading(20, 62_000), reading(14, 68_000)],
      NOW,
    );

    expect(kinds(findings)).not.toContain('CONFLICT');
  });
});

describe('gaps in the record', () => {
  it('reports a long silence as thin history, not as suspicion', () => {
    // An absence of records is not evidence of anything.
    const findings = inspectHistory([reading(1_200, 30_000), reading(10, 45_000)], NOW);

    const gap = findings.find((finding) => finding.kind === 'THIN_HISTORY');

    expect(gap?.severity).toBe('INFO');
    expect(gap?.detail).toMatch(/not a finding against the vehicle/);
  });

  it('says when the newest reading is itself old', () => {
    const findings = inspectHistory([reading(2_000, 30_000), reading(700, 45_000)], NOW);

    expect(findings.some((finding) => finding.summary.startsWith('Nothing recorded since'))).toBe(
      true,
    );
  });
});

describe('what is said first', () => {
  const serious = [reading(365, 95_000), reading(10, 60_000)];

  it('puts the impossible above the merely odd', () => {
    const findings = inspectHistory(
      [reading(1_460, 20_000), reading(1_095, 90_000), reading(10, 60_000)],
      NOW,
    );

    expect(findings[0]?.severity).toBe('SERIOUS');
  });

  it('leads with contradiction when the numbers contradict', () => {
    expect(summariseHistory(inspectHistory(serious, NOW), 2)).toMatch(/contradicts itself/);
  });

  it('separates "worth asking about" from "impossible"', () => {
    const concerns: HistoryFinding[] = [
      {
        kind: 'RATE_COLLAPSE',
        severity: 'CONCERN',
        confidence: 'POSSIBLE',
        at: NOW,
        summary: 's',
        detail: 'd',
      },
    ];

    expect(summariseHistory(concerns, 6)).toMatch(/Nothing in the record is impossible/);
  });

  it('admits when there is barely anything to go on', () => {
    expect(summariseHistory([], 2)).toMatch(/Too few readings/);
  });
});
