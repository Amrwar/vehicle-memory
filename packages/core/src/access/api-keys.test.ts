import { describe, expect, it } from 'vitest';

import {
  API_KEY_PREFIX,
  ApiKeyError,
  assertKeyNameable,
  assertKeyUsable,
  bearerToken,
  describeApiKey,
  hashApiKey,
  issueApiKey,
  sinceFrom,
} from './api-keys';

describe('issueApiKey', () => {
  it('mints a recognisable token and keeps only its digest', () => {
    const issued = issueApiKey();
    expect(issued.token.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(issued.token.length).toBeGreaterThan(30);
    expect(issued.hash).toBe(hashApiKey(issued.token));
    expect(issued.hash).not.toContain(issued.token);
    expect(issued.prefix).toBe(issued.token.slice(0, 10));
  });

  it('never mints the same token twice', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => issueApiKey().token));
    expect(tokens.size).toBe(50);
  });
});

describe('bearerToken', () => {
  it('reads the token out of a bearer header, whatever the casing', () => {
    expect(bearerToken('Bearer cn_abc')).toBe('cn_abc');
    expect(bearerToken('bearer cn_abc')).toBe('cn_abc');
    expect(bearerToken('  Bearer   cn_abc  ')).toBe('cn_abc');
  });

  it('ignores anything that is not one of ours', () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken('')).toBeNull();
    expect(bearerToken('Basic dXNlcjpwYXNz')).toBeNull();
    expect(bearerToken('Bearer sk_live_notours')).toBeNull();
    expect(bearerToken('cn_abc')).toBeNull();
  });
});

describe('assertKeyNameable', () => {
  it('insists on a name', () => {
    expect(() => assertKeyNameable('  ')).toThrow(ApiKeyError);
    expect(() => assertKeyNameable('Xero sync')).not.toThrow();
  });
});

describe('assertKeyUsable', () => {
  it('refuses a key we never issued and one that was revoked, distinctly', () => {
    try {
      assertKeyUsable(null);
      expect.unreachable();
    } catch (error) {
      expect((error as ApiKeyError).code).toBe('UNKNOWN');
    }
    try {
      assertKeyUsable({ revokedAt: new Date() });
      expect.unreachable();
    } catch (error) {
      expect((error as ApiKeyError).code).toBe('REVOKED');
    }
    expect(() => assertKeyUsable({ revokedAt: null })).not.toThrow();
  });
});

describe('sinceFrom', () => {
  const now = new Date('2026-09-12T12:00:00Z');

  it('defaults to a month back', () => {
    expect(sinceFrom(null, now)).toEqual(new Date('2026-08-13T12:00:00Z'));
    expect(sinceFrom('not a date', now)).toEqual(new Date('2026-08-13T12:00:00Z'));
  });

  it('honours a date within the year', () => {
    expect(sinceFrom('2026-06-01', now)).toEqual(new Date('2026-06-01'));
  });

  it('will not go back more than a year, however hard it is asked', () => {
    const floor = sinceFrom('2019-01-01', now);
    expect(now.getTime() - floor.getTime()).toBe(366 * 86_400_000);
  });
});

describe('describeApiKey', () => {
  it('says what a key has been doing without saying what it is', () => {
    const base = { name: 'Xero sync', prefix: 'cn_abcdefg' };
    expect(describeApiKey({ ...base, lastUsedAt: null, revokedAt: null })).toBe(
      'Xero sync (cn_abcdefg…) never used.',
    );
    expect(
      describeApiKey({ ...base, lastUsedAt: new Date(2026, 8, 10, 12), revokedAt: null }),
    ).toMatch(/last used 10\/09\/2026/);
    expect(
      describeApiKey({
        ...base,
        lastUsedAt: new Date(2026, 8, 10, 12),
        revokedAt: new Date(2026, 8, 11, 12),
      }),
    ).toMatch(/revoked 11\/09\/2026/);
  });
});
