import type { Channel } from '@carnet/core';
import { createTransport, type Transporter } from 'nodemailer';

import { type Outbound, type SendResult, type Transport, TransportError } from './index';

/**
 * Email over SMTP.
 *
 * SMTP rather than one vendor's HTTP API, because every email provider worth
 * using speaks it and choosing a vendor is a business decision this file has
 * no right to make. Moving from one provider to another is four environment
 * variables.
 *
 * The connection is made once and reused. Opening a TLS session per message
 * is slow enough to matter on a morning's worth of reminders, and enough
 * providers rate-limit connections that it becomes a source of failures.
 */
export class SmtpTransport implements Transport {
  readonly name = 'smtp';
  readonly channels: readonly Channel[] = ['EMAIL'];

  private transporter: Transporter | null = null;

  constructor(
    private readonly config: {
      host: string;
      port: number;
      user?: string;
      pass?: string;
      from: string;
    },
  ) {}

  private connection(): Transporter {
    this.transporter ??= createTransport({
      host: this.config.host,
      port: this.config.port,
      // 465 is implicit TLS; everything else negotiates with STARTTLS.
      secure: this.config.port === 465,
      auth: this.config.user ? { user: this.config.user, pass: this.config.pass } : undefined,
      pool: true,
      maxConnections: 3,
    });

    return this.transporter;
  }

  async send(message: Outbound): Promise<SendResult> {
    try {
      const info = await this.connection().sendMail({
        from: this.config.from,
        to: message.to,
        replyTo: message.replyTo ?? undefined,
        subject: message.subject ?? '',
        text: message.body,
      });

      return { reference: info.messageId ?? null, provider: this.name };
    } catch (error) {
      // Nodemailer carries the server's reply code through as `responseCode`.
      // Passing it on is what lets the domain layer tell a wrong address from
      // a busy server, which is the difference between one attempt and six.
      const code =
        typeof error === 'object' && error && 'responseCode' in error
          ? Number((error as { responseCode: unknown }).responseCode) || null
          : null;

      throw new TransportError(
        'smtp',
        code,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}
