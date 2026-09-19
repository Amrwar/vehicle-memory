import { describe, expect, it } from 'vitest';

import { redaction } from './log';

const { isSecret, safe, REDACTED } = redaction;

describe('what never reaches a log line', () => {
  it('knows a credential by its name', () => {
    expect(isSecret('password')).toBe(true);
    expect(isSecret('passwordHash')).toBe(true);
    expect(isSecret('tokenHash')).toBe(true);
    expect(isSecret('Authorization')).toBe(true);
    expect(isSecret('stripe_secret_key')).toBe(true);
    expect(isSecret('api-key')).toBe(true);
  });

  it('leaves alone what a log is for', () => {
    expect(isSecret('jobId')).toBe(false);
    expect(isSecret('customerId')).toBe(false);
    expect(isSecret('count')).toBe(false);
    expect(isSecret('durationMs')).toBe(false);
  });

  it('takes the value out and leaves the key, so the shape still reads', () => {
    expect(safe({ jobId: 'j1', password: 'hunter2' })).toEqual({
      jobId: 'j1',
      password: REDACTED,
    });
  });

  it('reaches a secret nested inside something else', () => {
    expect(safe({ request: { headers: { cookie: 'carnet_session=abc' } } })).toEqual({
      request: { headers: { cookie: REDACTED } },
    });
  });

  it('survives an object that points at itself', () => {
    const loop: Record<string, unknown> = { name: 'outbox' };
    loop.self = loop;
    expect(safe(loop)).toEqual({ name: 'outbox', self: '[circular]' });
  });

  it('stops rather than walking a model with every relation attached', () => {
    let deep: Record<string, unknown> = { end: true };
    for (let i = 0; i < 12; i += 1) deep = { next: deep };
    expect(JSON.stringify(safe(deep))).toContain('[deep]');
  });

  it('keeps a date readable', () => {
    expect(safe({ at: new Date('2026-09-19T10:00:00Z') })).toEqual({
      at: '2026-09-19T10:00:00.000Z',
    });
  });
});
