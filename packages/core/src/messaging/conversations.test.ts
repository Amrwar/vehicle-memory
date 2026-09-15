import { describe, expect, it } from 'vitest';

import {
  addressFor,
  DEFAULT_TEMPLATES,
  fillTemplate,
  isUnread,
  mergeThread,
  orderThreads,
  paymentSentence,
  preferredChannel,
  reachableChannels,
} from './conversations';
import { placeholdersIn } from './templates';

const t = (minutes: number) => new Date(Date.UTC(2026, 8, 15, 9, minutes));

describe('which channel', () => {
  it('follows what is on file', () => {
    expect(reachableChannels({ email: 'a@b.test', mobile: '+447700900000' })).toEqual([
      'SMS',
      'WHATSAPP',
      'EMAIL',
    ]);
    expect(reachableChannels({ email: 'a@b.test' })).toEqual(['EMAIL']);
    expect(reachableChannels({})).toEqual([]);
    expect(addressFor('WHATSAPP', { mobile: ' +447700900000 ' })).toBe('+447700900000');
    expect(addressFor('EMAIL', { mobile: '+447700900000' })).toBeNull();
  });

  it('replies on the channel the customer wrote on', () => {
    const customer = { email: 'a@b.test', mobile: '+447700900000' };
    expect(preferredChannel({ customer, lastInboundChannel: 'WHATSAPP' })).toBe('WHATSAPP');
    expect(preferredChannel({ customer, lastInboundChannel: null })).toBe('SMS');
    expect(preferredChannel({ customer: { email: 'a@b.test' }, lastInboundChannel: 'SMS' })).toBe(
      'EMAIL',
    );
    expect(preferredChannel({ customer: {} })).toBeNull();
  });
});

describe('the thread', () => {
  it('reads as one conversation, oldest first, with what became of each message', () => {
    const merged = mergeThread(
      [
        { id: 'o1', channel: 'SMS', body: 'Your quote', status: 'SENT', at: t(0), sentAt: t(1) },
        {
          id: 'o2',
          channel: 'EMAIL',
          body: 'Bounced',
          status: 'FAILED',
          error: 'No such mailbox',
          at: t(5),
        },
      ],
      [{ id: 'i1', channel: 'SMS', body: 'Yes please', at: t(3) }],
    );
    expect(merged.map((e) => `${e.direction}:${e.id}:${e.state}`)).toEqual([
      'out:o1:sent',
      'in:i1:received',
      'out:o2:failed',
    ]);
    expect(merged[2]!.detail).toBe('No such mailbox');
  });

  it('knows what is unread and puts it first', () => {
    const base = { assignedToUserId: null, status: 'OPEN' as const };
    const quiet = { id: 'q', lastMessageAt: t(50), lastInboundAt: t(10), readAt: t(20), ...base };
    const fresh = { id: 'f', lastMessageAt: t(30), lastInboundAt: t(30), readAt: t(20), ...base };
    const never = { id: 'n', lastMessageAt: t(1), lastInboundAt: t(1), readAt: null, ...base };
    const closed = {
      id: 'c',
      lastMessageAt: t(90),
      lastInboundAt: t(90),
      readAt: null,
      ...base,
      status: 'CLOSED' as const,
    };
    expect(isUnread(quiet)).toBe(false);
    expect(isUnread(fresh)).toBe(true);
    expect(isUnread({ lastInboundAt: null, readAt: null })).toBe(false);
    expect(orderThreads([quiet, closed, never, fresh]).map((x) => x.id)).toEqual([
      'f',
      'n',
      'q',
      'c',
    ]);
  });
});

describe('templates that are messages', () => {
  it('are sentences with a few facts in them, every one renderable', () => {
    for (const template of DEFAULT_TEMPLATES) {
      expect(template.body.length).toBeGreaterThan(40);
      expect(placeholdersIn(template.body).length).toBeGreaterThan(0);
    }
    const filled = fillTemplate(DEFAULT_TEMPLATES[0]!.body, {
      firstName: 'Maria',
      vehicle: 'BMW X5',
      workshopName: 'Hillside Motors',
    });
    expect(filled.text).toBe(
      'Hello Maria, your BMW X5 is ready to collect. We are open until 6 today. Hillside Motors',
    );
  });

  it('says what is missing rather than sending a blank', () => {
    const filled = fillTemplate(DEFAULT_TEMPLATES[0]!.body, { firstName: 'Maria' });
    expect(filled.text).toBeNull();
    expect(filled.problem).toContain('{{vehicle}}');
  });

  it('writes a payment link as a sentence', () => {
    expect(paymentSentence({ amount: '£261.60', link: 'https://x/pay', vehicle: 'BMW X5' })).toBe(
      'The bill for the BMW X5 comes to £261.60. You can pay it here: https://x/pay',
    );
    expect(paymentSentence({ amount: '£10', link: 'l' })).toContain('for the work');
  });
});
