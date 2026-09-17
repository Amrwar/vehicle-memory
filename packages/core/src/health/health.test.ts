import { describe, expect, it } from 'vitest';

import { stuckMessages, whyMessage, type MessageFacts } from './delivery';
import {
  describeHealth,
  describeStanding,
  fromAge,
  fromCount,
  needsAttention,
  signal,
  worstSignalsFirst,
  worstStanding,
} from './signals';

const at = (iso: string) => new Date(iso);

const one = (standing: 'healthy' | 'degraded' | 'failed' | 'unknown', name = 'Thing') =>
  signal({ area: 'System', name, standing, template: 'A thing.' });

describe('how a system says how it is', () => {
  it('is as bad as its worst part, because an average gets ignored', () => {
    expect(worstStanding([one('healthy'), one('healthy'), one('failed')])).toBe('failed');
  });

  it('calls a thing nobody has ever used unknown rather than healthy', () => {
    // A green tick beside something that has never sent a message is how a
    // product ends up confidently broken.
    expect(worstStanding([one('healthy'), one('unknown')])).toBe('unknown');
  });

  it('treats degraded as worse than unknown, because somebody is being affected', () => {
    expect(worstStanding([one('unknown'), one('degraded')])).toBe('degraded');
  });

  it('says unknown of nothing at all rather than healthy', () => {
    expect(worstStanding([])).toBe('unknown');
  });

  it('puts the worst first, so the page reads in the order somebody acts in', () => {
    const order = worstSignalsFirst([
      one('healthy', 'A'),
      one('failed', 'B'),
      one('degraded', 'C'),
    ]);
    expect(order.map((s) => s.name)).toEqual(['B', 'C', 'A']);
  });

  it('separates what somebody must act on from what they may read', () => {
    const attention = needsAttention([one('healthy'), one('unknown'), one('failed')]);
    expect(attention).toHaveLength(1);
  });

  it('fills the figures into the sentence the same way the translator will', () => {
    const made = signal({
      area: 'Workers',
      name: 'Outbox',
      standing: 'degraded',
      template: '{count} waiting, the oldest for {minutes} minutes.',
      values: { count: 12, minutes: 40 },
    });

    expect(made.sentence).toBe('12 waiting, the oldest for 40 minutes.');
  });

  it('reads the whole board in one line', () => {
    expect(describeHealth([one('healthy'), one('healthy')])).toBe('2 checked, everything working.');
    expect(describeHealth([one('healthy'), one('failed')])).toContain('1 not working');
  });

  it('names each standing in words a person would use', () => {
    expect(describeStanding('degraded')).toBe('Struggling');
    expect(describeStanding('unknown')).toBe('Never used');
  });
});

describe('reading a number as a standing', () => {
  it('does not report an empty queue as a failure, which is the mistake', () => {
    expect(fromCount({ count: 0, degradedAbove: 5, failedAbove: 50 })).toBe('healthy');
  });

  it('crosses at the thresholds and not before them', () => {
    expect(fromCount({ count: 5, degradedAbove: 5, failedAbove: 50 })).toBe('healthy');
    expect(fromCount({ count: 6, degradedAbove: 5, failedAbove: 50 })).toBe('degraded');
    expect(fromCount({ count: 51, degradedAbove: 5, failedAbove: 50 })).toBe('failed');
  });

  it('treats nothing waiting at all as healthy rather than as age zero', () => {
    expect(fromAge({ seconds: null, degradedAbove: 60, failedAbove: 600 })).toBe('healthy');
  });
});

/* -------------------------------------------------------------------------- */

const facts = (over: Partial<MessageFacts> = {}): MessageFacts => ({
  status: 'QUEUED',
  attempts: 0,
  availableAt: at('2026-09-17T10:00:00Z'),
  maxAttempts: 8,
  now: at('2026-09-17T10:00:00Z'),
  ...over,
});

describe('why a customer did not get their message', () => {
  it('puts consent first, because that is not a delivery problem at all', () => {
    const said = whyMessage(facts({ status: 'FAILED', consentWithdrawn: true, error: 'bounced' }));

    expect(said.outcome).toBe('stopped');
    expect(said.sentence).toContain('asked not to be written to');
    expect(said.next).toContain('Nothing to fix');
  });

  it('puts suppression above the status, because a suppressed message was never tried', () => {
    const said = whyMessage(
      facts({
        status: 'QUEUED',
        suppressed: { reason: 'HARD_BOUNCE', on: at('2026-09-12T09:00:00Z') },
      }),
    );

    expect(said.sentence).toContain('2026-09-12');
    expect(said.sentence).toContain('hard_bounce');
    expect(said.next).toContain('different address');
  });

  it('separates given up on from will be tried again', () => {
    const gaveUp = whyMessage(facts({ status: 'FAILED', attempts: 8, error: 'mailbox full' }));
    const willRetry = whyMessage(facts({ status: 'FAILED', attempts: 2, error: 'timeout' }));

    expect(gaveUp.outcome).toBe('stopped');
    expect(gaveUp.sentence).toContain('8 times');
    expect(willRetry.outcome).toBe('waiting');
    expect(willRetry.sentence).toContain('tried again');
  });

  it('separates a quiet-hours hold from a retry backoff, which share one column', () => {
    const quiet = whyMessage(
      facts({ availableAt: at('2026-09-17T19:00:00Z'), now: at('2026-09-17T10:00:00Z') }),
    );
    const backoff = whyMessage(
      facts({
        attempts: 3,
        availableAt: at('2026-09-17T10:20:00Z'),
        now: at('2026-09-17T10:00:00Z'),
      }),
    );

    expect(quiet.sentence).toContain('outside the hours');
    expect(backoff.sentence).toContain('failed 3 time');
  });

  it('says when the worker is the problem rather than the message', () => {
    const said = whyMessage(facts({ availableAt: at('2026-09-17T09:59:00Z') }));

    expect(said.sentence).toContain('due to go now');
    expect(said.next).toContain('worker');
  });

  it('is honest that sent is not the same as arrived', () => {
    const said = whyMessage(facts({ status: 'SENT', sentAt: at('2026-09-16T08:00:00Z') }));

    expect(said.outcome).toBe('sent');
    expect(said.sentence).toContain('2026-09-16');
    expect(said.sentence).toContain('most providers never do');
  });

  it('and plain when it did arrive', () => {
    expect(whyMessage(facts({ status: 'DELIVERED' })).outcome).toBe('delivered');
  });
});

describe('a queue that is working against a queue that is stuck', () => {
  it('counts only what is due and has not gone', () => {
    const now = at('2026-09-17T10:00:00Z');

    expect(
      stuckMessages(
        [
          { status: 'QUEUED', availableAt: at('2026-09-17T09:50:00Z') },
          { status: 'QUEUED', availableAt: at('2026-09-17T19:00:00Z') },
          { status: 'SENT', availableAt: at('2026-09-17T09:00:00Z') },
        ],
        now,
      ),
    ).toBe(1);
  });
});
