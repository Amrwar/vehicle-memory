import { describe, expect, it } from 'vitest';

import { bounceKind, describeDeliverability, eventOf, maySendTo, reactTo } from './events';

describe('eventOf', () => {
  it('reads the names a provider actually sends', () => {
    expect(eventOf('email.delivered')).toBe('DELIVERED');
    expect(eventOf('email.bounced')).toBe('BOUNCED');
    expect(eventOf('email.complained')).toBe('COMPLAINED');
  });

  it('copes with a provider that omits the namespace', () => {
    expect(eventOf('BOUNCED')).toBe('BOUNCED');
    expect(eventOf(' complaint ')).toBe('COMPLAINED');
  });

  it('does not guess at something it has never seen', () => {
    expect(eventOf('email.opened')).toBe('UNKNOWN');
  });
});

describe('bounceKind', () => {
  it('believes the provider when it says which', () => {
    expect(bounceKind({ kind: 'Permanent' })).toBe('HARD');
    expect(bounceKind({ kind: 'transient' })).toBe('SOFT');
  });

  it('reads the sentence when there is no field', () => {
    expect(bounceKind({ message: '550 5.1.1 user unknown' })).toBe('HARD');
    expect(bounceKind({ message: 'Mailbox full, try again later' })).toBe('SOFT');
  });

  it('refuses to decide when nothing says', () => {
    // Guessing hard on an ambiguous bounce loses a real customer. Guessing
    // soft merely delays the suppression by one more send, so the safe
    // direction is to admit it does not know.
    expect(bounceKind({})).toBe('UNKNOWN');
    expect(bounceKind({ message: 'Delivery failed' })).toBe('UNKNOWN');
  });
});

describe('reactTo', () => {
  it('records a delivery as proof it arrived', () => {
    const reaction = reactTo({ event: 'DELIVERED' });

    expect(reaction.status).toBe('DELIVERED');
    expect(reaction.suppress).toBe(false);
  });

  it('learns nothing from a sent event, because the queue already wrote it', () => {
    // Acting on it would overwrite a later event with an earlier one.
    expect(reactTo({ event: 'SENT' }).status).toBeNull();
  });

  it('does not undo a delivery when a delay arrives late', () => {
    // Providers deliver events out of order. A delayed notice arriving after
    // a delivered one must not turn a message that reached somebody back into
    // one that did not.
    expect(reactTo({ event: 'DELAYED', currentStatus: 'DELIVERED' }).status).toBeNull();
    expect(reactTo({ event: 'DELAYED', currentStatus: 'SENT' }).status).toBe('SENT');
  });

  it('suppresses on a permanent bounce and says why', () => {
    const reaction = reactTo({
      event: 'BOUNCED',
      bounce: { kind: 'hard', message: '550 no such user' },
    });

    expect(reaction.status).toBe('FAILED');
    expect(reaction.suppress).toBe(true);
    expect(reaction.note).toContain('Nothing further will be sent');
  });

  it('does not suppress on a temporary one', () => {
    // A full mailbox is fixed by teatime. Suppressing would lose a customer
    // over a fault that cured itself.
    const reaction = reactTo({ event: 'BOUNCED', bounce: { message: 'mailbox full' } });

    expect(reaction.status).toBe('FAILED');
    expect(reaction.suppress).toBe(false);
    expect(reaction.note).toContain('temporary');
  });

  it('does not suppress when the reason is unclear', () => {
    const reaction = reactTo({ event: 'BOUNCED', bounce: { message: 'delivery problem' } });

    expect(reaction.suppress).toBe(false);
    expect(reaction.note).toContain('not clear enough to act on');
  });

  it('treats a spam complaint as a person asking to be left alone', () => {
    // Suppressing without withdrawing consent would keep asking the question
    // they have just answered.
    const reaction = reactTo({ event: 'COMPLAINED' });

    expect(reaction.status).toBe('SUPPRESSED');
    expect(reaction.suppress).toBe(true);
    expect(reaction.withdrawConsent).toBe(true);
  });

  it('does nothing at all with an event it does not know', () => {
    const reaction = reactTo({ event: 'UNKNOWN' });

    expect(reaction.status).toBeNull();
    expect(reaction.suppress).toBe(false);
  });
});

describe('maySendTo', () => {
  it('allows an ordinary address', () => {
    expect(maySendTo({ address: 'maria@example.test', suppressed: new Set() }).allowed).toBe(true);
  });

  it('refuses a suppressed one, whatever the capitals', () => {
    const decision = maySendTo({
      address: '  Maria@Example.test ',
      suppressed: new Set(['maria@example.test']),
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('lift the suppression');
  });
});

describe('describeDeliverability', () => {
  it('says nothing has been sent when nothing has', () => {
    expect(
      describeDeliverability({ sent: 0, delivered: 0, bounced: 0, complained: 0, suppressed: 0 }),
    ).toBe('Nothing has been sent yet.');
  });

  it('stays quiet about a healthy bounce rate', () => {
    const line = describeDeliverability({
      sent: 100,
      delivered: 98,
      bounced: 1,
      complained: 0,
      suppressed: 1,
    });

    expect(line).not.toContain('providers');
    expect(line).toContain('1 addresses are suppressed');
  });

  it('warns at the level providers themselves warn at', () => {
    const line = describeDeliverability({
      sent: 100,
      delivered: 95,
      bounced: 3,
      complained: 0,
      suppressed: 3,
    });

    expect(line).toContain('above the level providers are comfortable with');
  });

  it('is blunt once it is bad enough to cost them', () => {
    const line = describeDeliverability({
      sent: 100,
      delivered: 90,
      bounced: 8,
      complained: 2,
      suppressed: 10,
    });

    expect(line).toContain('treating everything you send as suspicious');
  });
});
