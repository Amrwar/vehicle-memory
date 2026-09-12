import type { Channel } from '@carnet/core';

/**
 * The line between Carnet and whoever actually carries a message.
 *
 * One interface, three implementations, and the rest of the product knows
 * about none of them. Everything upstream writes a row to `message_logs`; the
 * worker reads it and hands it to whichever transport is configured. Changing
 * provider is an environment variable, not a code change, and no domain code
 * anywhere imports a vendor.
 *
 * A transport does one thing: try to hand over one message, and say precisely
 * what happened. It does not retry, does not decide whether a failure is worth
 * retrying, and does not touch the database. Those are decisions, they live in
 * the domain layer, and they are tested without a network.
 */

export interface Outbound {
  channel: Channel;
  /** Already normalised: an email address, or a number in E.164. */
  to: string;
  subject: string | null;
  body: string;
  /**
   * Where a reply should go, when that is somewhere other than the sender.
   *
   * The product sends as one address for every workshop, because that is the
   * one the domain is verified for, but a reply has to reach the workshop that
   * sent it. Reply-To is how the two are kept apart without pretending to be
   * an address the domain cannot sign for.
   */
  replyTo?: string | null;
}

export interface SendResult {
  /** The provider's own identifier, kept so a delivery report can be matched. */
  reference: string | null;
  /** What actually carried it, recorded per message rather than per install. */
  provider: string;
}

export class TransportError extends Error {
  /** SMTP reply code or HTTP status. The domain layer reads it with `protocol`. */
  readonly code: number | null;
  readonly protocol: 'smtp' | 'http';

  constructor(protocol: 'smtp' | 'http', code: number | null, message: string) {
    super(message);
    this.name = 'TransportError';
    this.protocol = protocol;
    this.code = code;
  }
}

export interface Transport {
  readonly name: string;
  /** Which channels this can carry. A mail transport cannot send a text. */
  readonly channels: readonly Channel[];
  send(message: Outbound): Promise<SendResult>;
}

/**
 * Nothing configured for this channel.
 *
 * Deliberately a transport rather than an absence, so a message that cannot be
 * carried fails with a sentence somebody can act on instead of sitting in the
 * queue looking healthy. That silence is the exact failure this whole layer
 * was written to end.
 */
export class UnconfiguredTransport implements Transport {
  readonly name = 'unconfigured';
  readonly channels: readonly Channel[] = [];

  constructor(private readonly channel: Channel) {}

  async send(): Promise<SendResult> {
    const variable = this.channel === 'EMAIL' ? 'MAIL_TRANSPORT' : 'SMS_TRANSPORT';

    throw new TransportError(
      'http',
      500,
      `No ${this.channel.toLowerCase()} transport is configured. Set ${variable} and its credentials.`,
    );
  }
}
