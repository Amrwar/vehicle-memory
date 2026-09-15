import { type Channel, redact } from '@carnet/core';

import type { Outbound, SendResult, Transport } from './index';

/**
 * Writes the message to the log instead of sending it.
 *
 * The default, and what runs in development and in CI. It is a real transport
 * rather than a no-op: it reports success, so the queue drains and every state
 * downstream of sending can be exercised without a provider account or a
 * network.
 *
 * Addresses are redacted even here. Development logs get pasted into tickets
 * as readily as production ones, and the seed data is full of addresses that
 * look real enough for somebody to try.
 */
export class ConsoleTransport implements Transport {
  readonly name = 'console';
  readonly channels: readonly Channel[] = ['EMAIL', 'SMS', 'WHATSAPP'];

  async send(message: Outbound): Promise<SendResult> {
    const reference = `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    console.info(
      JSON.stringify({
        time: new Date().toISOString(),
        event: 'message.console',
        channel: message.channel,
        to: redact(message.to),
        subject: message.subject,
        // The body is the one thing worth seeing in full here: this transport
        // exists so somebody can read what would have gone out.
        body: message.body,
        reference,
      }),
    );

    return { reference, provider: this.name };
  }
}
