import type { Channel } from '@carnet/core';

import { type Outbound, type SendResult, type Transport, TransportError } from './index';

/**
 * Text messages through Twilio's REST API.
 *
 * Plain `fetch` against a documented HTTP endpoint rather than the vendor SDK.
 * The SDK is a large dependency, a supply-chain surface and a second place for
 * retry logic to live, in exchange for wrapping one form-encoded POST.
 *
 * Twilio answers a bad number with 400 and a busy moment with 429 or 5xx,
 * which is exactly the distinction the domain layer needs, so the status is
 * passed through untouched.
 */
export class TwilioTransport implements Transport {
  readonly name = 'twilio';
  readonly channels: readonly Channel[] = ['SMS'];

  constructor(
    private readonly config: {
      accountSid: string;
      authToken: string;
      /** A number you own, or a messaging service SID. */
      from: string;
    },
  ) {}

  async send(message: Outbound): Promise<SendResult> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Messages.json`;

    const form = new URLSearchParams({
      To: message.to,
      Body: message.body,
      // A messaging service is addressed by SID; a plain number by number.
      ...(this.config.from.startsWith('MG')
        ? { MessagingServiceSid: this.config.from }
        : { From: this.config.from }),
    });

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: form,
        // Without this a hung connection holds a worker slot indefinitely and
        // the queue stops draining for reasons nothing reports.
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      // A network failure or a timeout. No status, and worth trying again.
      throw new TransportError(
        'http',
        null,
        error instanceof Error ? error.message : String(error),
      );
    }

    const text = await response.text();

    if (!response.ok) {
      // Twilio's body carries a human-readable `message`, which is far more
      // use in a failed row than the status alone.
      let detail = text.slice(0, 300);

      try {
        const parsed = JSON.parse(text) as { message?: string; code?: number };
        if (parsed.message) detail = `${parsed.message}${parsed.code ? ` (${parsed.code})` : ''}`;
      } catch {
        // Not JSON. The raw body is still better than nothing.
      }

      throw new TransportError('http', response.status, detail);
    }

    const body = JSON.parse(text) as { sid?: string };

    return { reference: body.sid ?? null, provider: this.name };
  }
}
