import { describe, expect, it } from 'vitest';

import {
  describePaint,
  describePaintRun,
  FOUR_G,
  middle,
  PAINT,
  type Painted,
  paintVerdict,
  say,
  worstPaintFirst,
} from './paint';

const reading = (metric: Painted['metric'], samples: number[]): Painted => ({
  screen: 'A job',
  path: '/jobs/1',
  metric,
  samples,
});

describe('the budgets', () => {
  it('takes its figures from the requirements rather than inventing them', () => {
    expect(PAINT.lcp.limit).toBe(2_000);
    expect(PAINT.cls.limit).toBe(0.1);
    expect(PAINT.lcp.because).toContain('NFR-105');
    expect(PAINT.cls.because).toContain('NFR-107');
  });

  it('names the connection rather than implying one', () => {
    expect(FOUR_G.downloadKbps).toBeGreaterThan(0);
    expect(FOUR_G.latencyMs).toBeGreaterThan(0);
    expect(FOUR_G.processorSlowdown).toBeGreaterThan(1);
  });
});

describe('the middle reading', () => {
  it('is neither the best nor the worst of three', () => {
    expect(middle([900, 1_200, 4_000])).toBe(1_200);
  });

  it('says nothing when there is nothing', () => {
    expect(middle([])).toBe(0);
  });
});

describe('the verdict', () => {
  it('passes a page well inside its budget', () => {
    expect(paintVerdict(reading('lcp', [800, 900, 850]))).toBe('within');
  });

  it('warns before it fails', () => {
    expect(paintVerdict(reading('lcp', [1_700, 1_750, 1_720]))).toBe('near');
  });

  it('fails a page over it', () => {
    expect(paintVerdict(reading('lcp', [2_400, 2_500, 2_450]))).toBe('over');
  });

  it('judges layout shift on its own scale rather than in milliseconds', () => {
    expect(paintVerdict(reading('cls', [0.02, 0.03, 0.02]))).toBe('within');
    expect(paintVerdict(reading('cls', [0.25, 0.3, 0.26]))).toBe('over');
  });

  it('claims nothing about a page it could not measure', () => {
    expect(paintVerdict(reading('lcp', []))).toBe('nothing to say');
    expect(describePaint(reading('lcp', []))).toContain('nothing is claimed');
  });

  it('is decided by the middle reading, so one bad run does not fail a page', () => {
    expect(paintVerdict(reading('lcp', [900, 950, 9_000]))).toBe('within');
  });
});

describe('how it is said', () => {
  it('writes a time as a time and a score as a score', () => {
    expect(say('lcp', 1_234.6)).toBe('1235 ms');
    expect(say('cls', 0.0421)).toBe('0.042');
  });

  it('puts the worst first, because that is where to start', () => {
    const all = [
      reading('lcp', [900, 900, 900]),
      { ...reading('lcp', [3_000, 3_000, 3_000]), screen: 'The diary' },
    ];

    expect(worstPaintFirst(all)[0]!.screen).toBe('The diary');
  });

  it('says the whole run in one line', () => {
    const said = describePaintRun([
      reading('lcp', [900, 900, 900]),
      reading('lcp', [3_000, 3_000, 3_000]),
      reading('cls', []),
    ]);

    expect(said).toContain('1 within budget');
    expect(said).toContain('1 over');
    expect(said).toContain('1 not measured');
  });
});
