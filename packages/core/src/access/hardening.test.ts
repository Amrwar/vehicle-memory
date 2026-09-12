import { describe, expect, it } from 'vitest';

import {
  API_CALLS_PER_WINDOW,
  assessPolicy,
  breachCount,
  contentSecurityPolicy,
  decideRate,
  describeBreach,
  passwordRange,
} from './hardening';

describe('passwordRange', () => {
  it('splits the SHA-1 so only five characters travel', () => {
    // SHA-1("password") = 5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8
    const range = passwordRange('password');
    expect(range.prefix).toBe('5BAA6');
    expect(range.suffix).toBe('1E4C9B93F3F0682250B6CF8331B7EE68FD8');
    expect(range.prefix.length + range.suffix.length).toBe(40);
  });
});

describe('breachCount', () => {
  const body = [
    '1D2DA4053E34E76F6576ED1DA63134B5E2A:2',
    '1E4C9B93F3F0682250B6CF8331B7EE68FD8:3861493',
    '1E2AAA439972480CEC7F16C795BBB429372:1',
  ].join('\r\n');

  it('finds the suffix whatever the line endings or the case', () => {
    expect(breachCount(body, '1e4c9b93f3f0682250b6cf8331b7ee68fd8')).toBe(3_861_493);
  });

  it('returns zero for a suffix that is not there', () => {
    expect(breachCount(body, 'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')).toBe(0);
    expect(breachCount('', 'ABC')).toBe(0);
  });
});

describe('describeBreach', () => {
  it('says how often, and what to do instead', () => {
    expect(describeBreach(0)).toBe('');
    expect(describeBreach(1)).toMatch(/^That password has appeared in a data breach once/);
    expect(describeBreach(3_861_493)).toMatch(/3,861,493 times/);
    expect(describeBreach(2)).toMatch(/four unrelated words/);
  });
});

describe('decideRate', () => {
  const now = new Date('2026-09-13T12:00:00Z');

  it('opens a window on the first call', () => {
    const decision = decideRate({ windowStartedAt: null, windowCount: 0 }, now);
    expect(decision.allowed).toBe(true);
    expect(decision.next).toEqual({ windowStartedAt: now, windowCount: 1 });
    expect(decision.remaining).toBe(API_CALLS_PER_WINDOW - 1);
    expect(decision.resetAt).toEqual(new Date('2026-09-13T13:00:00Z'));
  });

  it('counts within the window and refuses at the limit', () => {
    const started = new Date('2026-09-13T11:30:00Z');
    const under = decideRate({ windowStartedAt: started, windowCount: 999 }, now);
    expect(under.allowed).toBe(true);
    expect(under.remaining).toBe(0);

    const over = decideRate({ windowStartedAt: started, windowCount: 1000 }, now);
    expect(over.allowed).toBe(false);
    expect(over.next.windowCount).toBe(1000);
    expect(over.retryAfterSeconds).toBe(30 * 60);
  });

  it('starts again once the window has lapsed', () => {
    const decision = decideRate(
      { windowStartedAt: new Date('2026-09-13T10:59:00Z'), windowCount: 1000 },
      now,
    );
    expect(decision.allowed).toBe(true);
    expect(decision.next.windowStartedAt).toEqual(now);
    expect(decision.next.windowCount).toBe(1);
  });
});

describe('contentSecurityPolicy', () => {
  it('is strict in production and the probe agrees', () => {
    const policy = contentSecurityPolicy({ nonce: 'abc123', development: false });
    expect(policy).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    expect(policy).not.toContain('unsafe-eval');
    expect(policy).toContain('upgrade-insecure-requests');
    expect(assessPolicy(policy)).toEqual([]);
  });

  it('allows eval and websockets in development only', () => {
    const policy = contentSecurityPolicy({ nonce: 'abc123', development: true });
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).toContain('ws: wss:');
    expect(policy).not.toContain('upgrade-insecure-requests');
  });

  it('names what is wrong with a weak policy', () => {
    expect(assessPolicy("default-src 'self'; script-src 'self' 'unsafe-inline'")).toEqual([
      "script-src allows 'unsafe-inline'",
      'script-src carries no nonce',
      "object-src is not 'none'",
      'no frame-ancestors',
      "base-uri is not 'self'",
    ]);
  });
});
