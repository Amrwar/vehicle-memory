import { describe, expect, it } from 'vitest';

import {
  afterFailure,
  backoffFor,
  classifyFailure,
  MAX_SEND_ATTEMPTS,
  normaliseEmail,
  normaliseMobile,
  quietHours,
  redact,
} from './delivery';
import {
  assertTemplateSound,
  canRender,
  placeholdersIn,
  render,
  segmentsFor,
  type TemplateError,
  toGsm,
} from './templates';

/* ===========================================================================
   Addresses
   =========================================================================== */

describe('email addresses', () => {
  it('tidies what people actually type', () => {
    expect(normaliseEmail('  Maria@Example.TEST ')).toBe('maria@example.test');
    // A trailing comma from a paste out of a spreadsheet.
    expect(normaliseEmail('maria@example.test,')).toBe('maria@example.test');
  });

  it('refuses what no provider will deliver to', () => {
    for (const bad of [
      '',
      'maria',
      'maria@',
      '@example.test',
      'maria @example.test',
      'maria@test',
    ]) {
      expect(normaliseEmail(bad)).toBeNull();
    }
  });

  it('treats nothing as nothing', () => {
    expect(normaliseEmail(null)).toBeNull();
    expect(normaliseEmail(undefined)).toBeNull();
  });
});

describe('mobile numbers', () => {
  it('puts a national number into E.164', () => {
    expect(normaliseMobile('07700 900123')).toBe('+447700900123');
    expect(normaliseMobile('(07700) 900-123')).toBe('+447700900123');
  });

  it('leaves a number that already has a country code', () => {
    expect(normaliseMobile('+33 6 12 34 56 78')).toBe('+33612345678');
    expect(normaliseMobile('0044 7700 900123')).toBe('+447700900123');
  });

  it('refuses a number with no country code and no leading zero', () => {
    // Guessing here delivers a message to a stranger in another country.
    expect(normaliseMobile('7700900123')).toBeNull();
  });

  it('refuses nonsense', () => {
    expect(normaliseMobile('+44abc')).toBeNull();
    expect(normaliseMobile('')).toBeNull();
  });
});

describe('what an address looks like in a log', () => {
  it('keeps enough to recognise and not enough to reuse', () => {
    // Logs get pasted into tickets and chat.
    expect(redact('maria@example.test')).toBe('ma***@example.test');
    expect(redact('+447700900123')).toBe('*********0123');
  });
});

/* ===========================================================================
   Timing
   =========================================================================== */

describe('quiet hours', () => {
  it('lets email go at any hour', () => {
    // An email sits silently in an inbox until morning.
    const decision = quietHours({ channel: 'EMAIL', now: new Date('2026-09-10T03:00:00') });
    expect(decision.send).toBe(true);
  });

  it('sends a text during the day', () => {
    expect(quietHours({ channel: 'SMS', now: new Date('2026-09-10T14:00:00') }).send).toBe(true);
  });

  it('holds an overnight text until the morning', () => {
    // A text lights up a phone on a bedside table.
    const decision = quietHours({ channel: 'SMS', now: new Date('2026-09-10T03:00:00') });

    expect(decision.send).toBe(false);
    expect(decision.holdUntil?.getHours()).toBe(8);
    expect(decision.holdUntil?.getDate()).toBe(10);
  });

  it('holds a late-evening text until the next morning', () => {
    const decision = quietHours({ channel: 'SMS', now: new Date('2026-09-10T22:30:00') });

    expect(decision.send).toBe(false);
    expect(decision.holdUntil?.getDate()).toBe(11);
    expect(decision.holdUntil?.getHours()).toBe(8);
  });

  it('says why, in words a workshop would use', () => {
    expect(quietHours({ channel: 'SMS', now: new Date('2026-09-10T03:00:00') }).reason).toMatch(
      /woken by their garage/,
    );
  });
});

describe('backoff', () => {
  it('grows with each attempt', () => {
    expect(backoffFor(1, () => 0.5)).toBeLessThan(backoffFor(4, () => 0.5));
  });

  it('is capped, so an hour of trouble is not a day of silence', () => {
    expect(backoffFor(20, () => 0.5)).toBeLessThanOrEqual(15 * 60_000);
  });

  it('is jittered, so an outage ending does not become a second outage', () => {
    // Without jitter every message queued during the outage retries in the
    // same instant.
    expect(backoffFor(4, () => 0)).not.toBe(backoffFor(4, () => 1));
  });
});

/* ===========================================================================
   Failures
   =========================================================================== */

describe('deciding whether a failure is worth retrying', () => {
  it('reads an SMTP code the SMTP way', () => {
    expect(classifyFailure({ message: 'x', code: 550, protocol: 'smtp' })).toBe('PERMANENT');
    expect(classifyFailure({ message: 'x', code: 451, protocol: 'smtp' })).toBe('TRANSIENT');
  });

  it('reads an HTTP status the HTTP way', () => {
    // The two conventions are opposite, which is why the protocol is passed
    // rather than guessed from the number.
    expect(classifyFailure({ message: 'x', code: 400, protocol: 'http' })).toBe('PERMANENT');
    expect(classifyFailure({ message: 'x', code: 503, protocol: 'http' })).toBe('TRANSIENT');
  });

  it('treats rate limiting as worth waiting for', () => {
    expect(classifyFailure({ message: 'x', code: 429, protocol: 'http' })).toBe('TRANSIENT');
  });

  it('reads the words when there is no code', () => {
    expect(classifyFailure({ message: 'Invalid recipient address' })).toBe('PERMANENT');
    expect(classifyFailure({ message: 'No such mailbox' })).toBe('PERMANENT');
    expect(classifyFailure({ message: 'Connection reset by peer' })).toBe('TRANSIENT');
  });

  it('assumes transient when nothing identifies it', () => {
    // Retrying something unsendable costs a few attempts. Giving up on
    // something sendable costs the message.
    expect(classifyFailure({ message: 'something went wrong' })).toBe('TRANSIENT');
  });
});

describe('what happens to a message that just failed', () => {
  const now = new Date('2026-09-10T10:00:00');

  it('does not retry an address that will never work', () => {
    const next = afterFailure({ attempts: 0, kind: 'PERMANENT', message: 'No such mailbox', now });

    expect(next.status).toBe('FAILED');
    expect(next.availableAt).toBeNull();
    expect(next.reason).toMatch(/Will not be retried/);
  });

  it('schedules another go for something transient', () => {
    const next = afterFailure({ attempts: 1, kind: 'TRANSIENT', message: 'timeout', now });

    expect(next.status).toBe('QUEUED');
    expect(next.attempts).toBe(2);
    expect(next.availableAt!.getTime()).toBeGreaterThan(now.getTime());
  });

  it('gives up eventually, and says so rather than leaving the provider to explain', () => {
    const next = afterFailure({
      attempts: MAX_SEND_ATTEMPTS - 1,
      kind: 'TRANSIENT',
      message: 'timeout',
      now,
    });

    expect(next.status).toBe('FAILED');
    expect(next.reason).toMatch(/Gave up after 6 attempts/);
  });
});

/* ===========================================================================
   Templates
   =========================================================================== */

describe('templates', () => {
  it('finds the placeholders', () => {
    expect(placeholdersIn('Hi {{firstName}}, your {{vehicle}} is ready')).toEqual([
      'firstName',
      'vehicle',
    ]);
  });

  it('accepts a sound one', () => {
    expect(() => assertTemplateSound('Hi {{firstName}}, your {{vehicle}} is ready')).not.toThrow();
  });

  it('refuses a field that does not exist, when it is written', () => {
    // The complaint arrives while somebody is looking at what they typed.
    expect(() => assertTemplateSound('Hi {{nickname}}')).toThrow(/nothing called \{\{nickname\}\}/);
  });

  it('refuses an unclosed brace', () => {
    expect(() => assertTemplateSound('Hi {{firstName}, your car')).toThrow(/unclosed/);
  });

  it('fills in the values', () => {
    expect(
      render('Hi {{firstName}}, your {{vehicle}} is ready', {
        firstName: 'Maria',
        vehicle: 'BMW 320d',
      }),
    ).toBe('Hi Maria, your BMW 320d is ready');
  });

  it('refuses to send a half-filled message', () => {
    // "Hi {{firstName}}, your Vauxhall is ready" is the message every template
    // system sends once.
    expect(() => render('Hi {{firstName}}', {})).toThrow(/needs \{\{firstName\}\}/);
  });

  it('treats a blank value as missing', () => {
    // "Hi , your car is ready" is worse than not sending, because it has the
    // workshop's name at the bottom of it.
    expect(() => render('Hi {{firstName}}', { firstName: '   ' })).toThrow(/nothing to put there/);
  });

  it('carries a code', () => {
    try {
      render('Hi {{firstName}}', {});
    } catch (error) {
      expect((error as TemplateError).code).toBe('MISSING_VALUE');
    }
  });

  it('reports whether it can be filled, without throwing', () => {
    expect(canRender('Hi {{firstName}}', { firstName: 'Maria' })).toEqual({
      ok: true,
      reason: null,
    });

    const cannot = canRender('Hi {{firstName}}', {});
    expect(cannot.ok).toBe(false);
    expect(cannot.reason).toMatch(/nothing to put there/);
  });
});

describe('what a text actually costs', () => {
  it('counts a plain message in 160s', () => {
    expect(segmentsFor('a'.repeat(160))).toMatchObject({ segments: 1, unicode: false });
    expect(segmentsFor('a'.repeat(161)).segments).toBe(2);
  });

  it('shows what one curly apostrophe does', () => {
    // It drops the whole message out of the basic alphabet, cutting the
    // segment from 160 characters to 70.
    const plain = segmentsFor('a'.repeat(140) + "'");
    const curly = segmentsFor('a'.repeat(140) + '’');

    expect(plain.segments).toBe(1);
    expect(curly.segments).toBe(3);
    expect(curly.offenders).toEqual(['’']);
  });

  it('swaps word-processor characters for ones a phone sends cheaply', () => {
    expect(toGsm('It’s ready…')).toBe("It's ready...");
    expect(segmentsFor(toGsm('a'.repeat(140) + '’')).segments).toBe(1);
  });

  it('leaves an accent alone', () => {
    // A cheaper message spelling a customer's name wrong is not a saving.
    expect(toGsm('Zoë')).toBe('Zoë');
  });
});
