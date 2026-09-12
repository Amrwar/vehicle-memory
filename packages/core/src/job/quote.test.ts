import { describe, expect, it } from 'vitest';

import { assertQuoteSendable, QUOTE_LINK_DAYS, quoteChannelFor, quoteMessage } from './quote';

const ready = { status: 'DRAFT' as const, lineCount: 3, total: 144, reachable: true };

describe('assertQuoteSendable', () => {
  it('lets an ordinary draft go', () => {
    expect(() => assertQuoteSendable(ready)).not.toThrow();
  });

  it('will not send the same quote twice', () => {
    expect(() => assertQuoteSendable({ ...ready, status: 'SENT' })).toThrow(/already been sent/);
  });

  it('says what state a finished quote is in', () => {
    expect(() => assertQuoteSendable({ ...ready, status: 'APPROVED' })).toThrow(/approved/);
    expect(() => assertQuoteSendable({ ...ready, status: 'PARTIALLY_APPROVED' })).toThrow(
      /partially approved/,
    );
  });

  it('refuses an empty quote', () => {
    expect(() => assertQuoteSendable({ ...ready, lineCount: 0 })).toThrow(/nothing on this quote/);
  });

  it('refuses a quote that adds up to nothing', () => {
    // Nearly always an unpriced line, and a customer approving nought pounds of
    // work is a conversation nobody wants afterwards.
    expect(() => assertQuoteSendable({ ...ready, total: 0 })).toThrow(/total is zero/);
  });

  it('refuses when there is nowhere to send it', () => {
    expect(() => assertQuoteSendable({ ...ready, reachable: false })).toThrow(/nowhere to send/);
  });

  it('checks the state before the contents', () => {
    // A sent quote with a zero total is still, first, a sent quote.
    expect(() =>
      assertQuoteSendable({ status: 'SENT', lineCount: 0, total: 0, reachable: false }),
    ).toThrow(/already been sent/);
  });
});

describe('quoteChannelFor', () => {
  it('prefers email, because a quote is a document', () => {
    expect(quoteChannelFor({ email: 'm@example.test', mobile: '07700900123' })).toBe('EMAIL');
  });

  it('falls back to a text when there is only a mobile', () => {
    expect(quoteChannelFor({ email: '  ', mobile: '07700900123' })).toBe('SMS');
  });

  it('says so when there is nothing', () => {
    expect(quoteChannelFor({})).toBeNull();
    expect(quoteChannelFor({ email: null, mobile: '' })).toBeNull();
  });
});

describe('quoteMessage', () => {
  const input = {
    customerName: 'Maria Okafor',
    workshopName: 'Hillside Motors',
    vehicle: 'Volkswagen Golf',
    jobNumber: 1042,
    total: '£144.00',
    link: 'https://carnetpassport.com/e/abc',
    channel: 'EMAIL' as const,
  };

  it('addresses the person by first name and says what to do', () => {
    const { subject, body } = quoteMessage(input);

    expect(subject).toBe('Your quote from Hillside Motors for the Volkswagen Golf');
    expect(body).toContain('Hello Maria.');
    expect(body).toContain('£144.00');
    expect(body).toContain('https://carnetpassport.com/e/abc');
    expect(body).toContain('approve or decline each item');
    expect(body).toContain(`${QUOTE_LINK_DAYS} days`);
  });

  it('says nothing is done until they have answered', () => {
    expect(quoteMessage(input).body).toContain('nothing is done until you have');
  });

  it('is one sentence with the link when it goes by text', () => {
    const { body } = quoteMessage({ ...input, channel: 'SMS' });

    expect(body.split('\n')).toHaveLength(1);
    expect(body).toContain('Hillside Motors');
    expect(body).toContain('£144.00');
    expect(body).toContain('https://carnetpassport.com/e/abc');
    expect(body.length).toBeLessThan(200);
  });
});
