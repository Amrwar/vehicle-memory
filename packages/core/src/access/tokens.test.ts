import { describe, expect, it } from 'vitest';

import {
  assertNotFlooding,
  assertTokenUsable,
  checkPassword,
  expiryFor,
  MAX_REQUESTS_PER_HOUR,
  RESET_MIN_PASSWORD_LENGTH,
  RESET_REQUESTED_MESSAGE,
  TokenError,
  TOKEN_LIFETIME_MINUTES,
  unverifiedWarning,
} from './tokens';

const NOW = new Date('2026-09-11T09:00:00');

describe('expiryFor', () => {
  it('gives a reset an hour and a verification three days', () => {
    // A reset is a key to an account and was asked for thirty seconds ago. A
    // verification is proof of an address, and somebody signing up on a
    // Friday should not have to start again on Monday.
    expect(expiryFor('PASSWORD_RESET', NOW).getTime() - NOW.getTime()).toBe(60 * 60_000);
    expect(expiryFor('EMAIL_VERIFICATION', NOW).getTime() - NOW.getTime()).toBe(
      TOKEN_LIFETIME_MINUTES.EMAIL_VERIFICATION * 60_000,
    );
  });
});

describe('assertTokenUsable', () => {
  const live = {
    purpose: 'PASSWORD_RESET' as const,
    expiresAt: new Date('2026-09-11T09:30:00'),
    usedAt: null,
  };

  it('allows a live token', () => {
    expect(() => assertTokenUsable(live, NOW)).not.toThrow();
  });

  it('refuses one nobody issued', () => {
    // Also what a superseded token looks like, because issuing a new one
    // retires the old rather than leaving every link ever sent alive.
    expect(() => assertTokenUsable(null, NOW)).toThrow(/not one of ours/);
  });

  it('refuses one already spent, before checking whether it expired', () => {
    // Two different events. A spent token is likelier to be somebody clicking
    // an old email, and deserves the gentler message.
    const spent = {
      ...live,
      usedAt: new Date('2026-09-11T09:05:00'),
      expiresAt: new Date('2026-09-11T08:00:00'),
    };

    expect(() => assertTokenUsable(spent, NOW)).toThrow(/already been used/);
  });

  it('refuses one that ran out, and says how long it had', () => {
    const stale = { ...live, expiresAt: new Date('2026-09-11T08:00:00') };

    expect(() => assertTokenUsable(stale, NOW)).toThrow(/only lasts 1 hour/);
  });

  it('does not quote an hour count for the three-day one', () => {
    const stale = {
      purpose: 'EMAIL_VERIFICATION' as const,
      expiresAt: new Date('2026-09-01T09:00:00'),
      usedAt: null,
    };

    expect(() => assertTokenUsable(stale, NOW)).toThrow(/has expired/);
  });

  it('treats the moment of expiry as expired', () => {
    expect(() => assertTokenUsable({ ...live, expiresAt: NOW }, NOW)).toThrow(TokenError);
  });
});

describe('assertNotFlooding', () => {
  it('allows an ordinary number of requests', () => {
    expect(() => assertNotFlooding(MAX_REQUESTS_PER_HOUR - 1)).not.toThrow();
  });

  it('stops somebody using the form as a way to send mail', () => {
    expect(() => assertNotFlooding(MAX_REQUESTS_PER_HOUR)).toThrow(
      /several times in the last hour/,
    );
  });
});

describe('RESET_REQUESTED_MESSAGE', () => {
  it('never says whether the address exists', () => {
    // A form answering "no such account" is how somebody enumerates a
    // customer list, and it takes about an hour.
    expect(RESET_REQUESTED_MESSAGE).toContain('If that address has an account');
    expect(RESET_REQUESTED_MESSAGE).not.toMatch(/\bnot found\b|\bno account\b|\bunknown\b/i);
  });
});

describe('checkPassword', () => {
  it('accepts a long phrase', () => {
    expect(checkPassword('brake fluid tuesday morning').ok).toBe(true);
  });

  it('refuses anything short, and says why length beats symbols', () => {
    const check = checkPassword('x'.repeat(RESET_MIN_PASSWORD_LENGTH - 1));

    expect(check.ok).toBe(false);
    expect(check.problem).toContain('short phrase you will remember');
  });

  it('refuses the words on every attacker list', () => {
    expect(checkPassword('mypassword1234').ok).toBe(false);
    expect(checkPassword('carnetcarnet99').ok).toBe(false);
    expect(checkPassword('qwertyqwerty12').ok).toBe(false);
  });

  it('refuses a password containing the address it protects', () => {
    // One guess away from anybody who knows the address, which is everybody
    // who has ever been emailed by them.
    expect(checkPassword('ahmedahmed2026', 'ahmed@hillsidemotors.test').ok).toBe(false);
  });

  it('does not refuse on a very short address fragment', () => {
    // A two-letter local part would otherwise ban half the dictionary.
    expect(checkPassword('brake fluid tuesday', 'jo@example.test').ok).toBe(true);
  });

  it('refuses one character held down', () => {
    expect(checkPassword('aaaaaaaaaaaaaaaa').ok).toBe(false);
  });
});

describe('unverifiedWarning', () => {
  it('says nothing on the first day', () => {
    // Somebody signing up should not be nagged before the message has had a
    // chance to arrive.
    expect(unverifiedWarning(0)).toBeNull();
  });

  it('explains what is actually lost, rather than threatening', () => {
    const early = unverifiedWarning(3)!;

    expect(early).toContain('bounces');
    expect(early).not.toMatch(/suspend|lock|disable/i);
  });

  it('gets firmer after a week', () => {
    expect(unverifiedWarning(10)).toContain('treated as spam');
  });
});
