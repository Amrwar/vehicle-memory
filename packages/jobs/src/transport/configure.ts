import type { Channel } from '@carnet/core';

import { ConsoleTransport } from './console';
import { SmtpTransport } from './smtp';
import { type Transport, UnconfiguredTransport } from './index';
import { TwilioTransport } from './twilio';

/**
 * Which transport carries which channel, decided once at start-up.
 *
 * Reading the configuration here rather than at each send means a missing
 * credential is discovered when the worker boots, in a log line somebody is
 * watching, rather than six hours later on the first reminder of the morning.
 *
 * The default is the console transport in both directions. A deployment that
 * has not been told how to send does not silently drop messages, and it does
 * not crash either; it writes them where they can be read, and says clearly in
 * its start-up line that this is what it is doing.
 */
export interface Transports {
  EMAIL: Transport;
  SMS: Transport;
  WHATSAPP: Transport;
}

function mail(env: NodeJS.ProcessEnv): Transport {
  const choice = env.MAIL_TRANSPORT ?? 'console';

  if (choice === 'console') return new ConsoleTransport();

  if (choice === 'smtp') {
    const host = env.SMTP_HOST;

    // Configured to use SMTP without a host is a mistake worth reporting on
    // every message, not one to paper over by quietly logging instead.
    if (!host) return new UnconfiguredTransport('EMAIL');

    return new SmtpTransport({
      host,
      port: Number(env.SMTP_PORT ?? 587),
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
      from: env.MAIL_FROM ?? 'Carnet <no-reply@carnet.local>',
    });
  }

  return new UnconfiguredTransport('EMAIL');
}

function sms(env: NodeJS.ProcessEnv): Transport {
  const choice = env.SMS_TRANSPORT ?? 'console';

  if (choice === 'console') return new ConsoleTransport();

  if (choice === 'twilio') {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const from = env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !from) return new UnconfiguredTransport('SMS');

    return new TwilioTransport({ accountSid, authToken, from });
  }

  return new UnconfiguredTransport('SMS');
}

/**
 * WhatsApp. Phase 36. The same seam as texts: the console by default, and
 * Twilio's WhatsApp sender as the one real adapter, addressed with the
 * `whatsapp:` prefix Twilio uses. A workshop that has not been told how to
 * send on WhatsApp gets the console, and the start-up line says so.
 */
function whatsapp(env: NodeJS.ProcessEnv): Transport {
  const choice = env.WHATSAPP_TRANSPORT ?? 'console';

  if (choice === 'console') return new ConsoleTransport();

  if (choice === 'twilio') {
    const accountSid = env.TWILIO_ACCOUNT_SID;
    const authToken = env.TWILIO_AUTH_TOKEN;
    const from = env.TWILIO_WHATSAPP_FROM ?? env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !from) return new UnconfiguredTransport('WHATSAPP');

    return new TwilioTransport({ accountSid, authToken, from, whatsapp: true });
  }

  return new UnconfiguredTransport('WHATSAPP');
}

export function configureTransports(env: NodeJS.ProcessEnv = process.env): Transports {
  return { EMAIL: mail(env), SMS: sms(env), WHATSAPP: whatsapp(env) };
}

/** The transport for a channel, or one that fails with a useful sentence. */
export function transportFor(transports: Transports, channel: Channel): Transport {
  return transports[channel] ?? new UnconfiguredTransport(channel);
}
