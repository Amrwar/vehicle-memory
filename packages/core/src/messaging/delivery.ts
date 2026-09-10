/**
 * Whether a message can go out, when, and what to do when it fails.
 *
 * Everything the product writes to a customer passes through here. The rules
 * are small and the reasons are all the same one: a system that sends on
 * somebody's behalf, unattended, fails in ways that reach real people before
 * anybody notices.
 *
 * A permanent failure is not retried. An address with no @ in it will not
 * start working on the fourth attempt, and treating it as transient burns
 * eight attempts, buries the real failures in the log, and delays every
 * message queued behind it.
 *
 * A text is not sent at three in the morning. The workshop chose the delay
 * when they wrote the rule; they did not choose the hour it would land, and
 * being woken by a garage is how somebody unsubscribes from everything.
 *
 * Nothing here talks to a provider. This module decides; the transports carry
 * out. That split is what makes the decisions testable without a network.
 */

export type Channel = 'EMAIL' | 'SMS';

/** Give up after this many attempts. Past it, somebody has to look. */
export const MAX_SEND_ATTEMPTS = 6;

/** Nothing goes out before this hour, local time. */
export const QUIET_UNTIL_HOUR = 8;

/** Nothing goes out after it, either. */
export const QUIET_FROM_HOUR = 20;

export type FailureKind = 'PERMANENT' | 'TRANSIENT';

export class DeliveryError extends Error {
  readonly kind: FailureKind;

  constructor(kind: FailureKind, message: string) {
    super(message);
    this.name = 'DeliveryError';
    this.kind = kind;
  }
}

/* ---------------------------------------------------------------------------
   Addresses
   --------------------------------------------------------------------------- */

/**
 * An email address, tidied, or nothing.
 *
 * Deliberately not a full RFC 5322 validation, which accepts things no
 * provider will deliver to and rejects nothing anybody actually types wrong.
 * This catches the mistakes that occur: a missing @, a trailing comma from a
 * paste, a space in the middle, an empty local or domain part.
 */
export function normaliseEmail(raw: string | null | undefined): string | null {
  const value = (raw ?? '')
    .trim()
    .replace(/[,;]+$/, '')
    .toLowerCase();

  if (!value || /\s/.test(value)) return null;

  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return null;

  const domain = value.slice(at + 1);
  if (!domain.includes('.') || domain.startsWith('.') || domain.endsWith('.')) return null;

  return value;
}

/**
 * A mobile number in E.164, or nothing.
 *
 * Defaults to the United Kingdom because that is where the product is sold,
 * and a number stored as 07700 900123 has to become +447700900123 before any
 * provider will look at it. A number already carrying a country code is left
 * alone.
 */
export function normaliseMobile(
  raw: string | null | undefined,
  defaultCountry = '44',
): string | null {
  const value = (raw ?? '').replace(/[\s()\-.]/g, '');

  if (!value) return null;

  if (value.startsWith('+')) {
    return /^\+\d{8,15}$/.test(value) ? value : null;
  }

  if (value.startsWith('00')) {
    const digits = value.slice(2);
    return /^\d{8,15}$/.test(digits) ? `+${digits}` : null;
  }

  if (value.startsWith('0')) {
    const digits = value.slice(1);
    return /^\d{7,14}$/.test(digits) ? `+${defaultCountry}${digits}` : null;
  }

  // No leading zero and no country code. Ambiguous, and guessing produces a
  // message delivered to a stranger in another country.
  return null;
}

export function normaliseFor(channel: Channel, raw: string | null | undefined): string | null {
  return channel === 'EMAIL' ? normaliseEmail(raw) : normaliseMobile(raw);
}

/**
 * An address as it should appear in a log.
 *
 * Logs get pasted into tickets and chat. Enough survives to recognise the
 * address you are looking for; not enough to be a mailing list.
 */
export function redact(address: string): string {
  if (address.includes('@')) {
    const [local = '', domain = ''] = address.split('@');
    const head = local.slice(0, 2);
    return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`;
  }

  return address.length <= 4
    ? '*'.repeat(address.length)
    : `${'*'.repeat(address.length - 4)}${address.slice(-4)}`;
}

/* ---------------------------------------------------------------------------
   Timing
   --------------------------------------------------------------------------- */

export interface QuietDecision {
  send: boolean;
  /** When it may go, if not now. */
  holdUntil: Date | null;
  reason: string;
}

/**
 * Whether this is a civilised hour to send at, and when it becomes one.
 *
 * Applied to texts only. An email arriving overnight sits silently in an inbox
 * and is read in the morning; a text lights up a phone on a bedside table, and
 * a garage that does that once does not get a third message read.
 */
export function quietHours(input: {
  channel: Channel;
  now: Date;
  from?: number;
  until?: number;
}): QuietDecision {
  if (input.channel !== 'SMS') {
    return { send: true, holdUntil: null, reason: 'Email can arrive at any hour.' };
  }

  const from = input.from ?? QUIET_FROM_HOUR;
  const until = input.until ?? QUIET_UNTIL_HOUR;
  const hour = input.now.getHours();

  if (hour >= until && hour < from) {
    return { send: true, holdUntil: null, reason: 'Within sending hours.' };
  }

  const holdUntil = new Date(input.now);

  // After the evening cut-off, the next window is tomorrow morning.
  if (hour >= from) holdUntil.setDate(holdUntil.getDate() + 1);

  holdUntil.setHours(until, 0, 0, 0);

  return {
    send: false,
    holdUntil,
    reason: `Texts are held between ${from}:00 and ${until}:00 so nobody is woken by their garage.`,
  };
}

/**
 * How long to wait before trying again.
 *
 * Exponential and capped, with the cap chosen so a provider having an hour of
 * trouble does not leave a message unsent for a day. The jitter matters more
 * than it looks: without it, every message queued during an outage retries in
 * the same instant when the outage ends, and the retry storm becomes the
 * second outage.
 */
export function backoffFor(attempt: number, random = Math.random): number {
  const base = Math.min(2 ** Math.max(1, attempt) * 1_000, 15 * 60_000);
  return Math.round(base * (0.75 + random() * 0.5));
}

/* ---------------------------------------------------------------------------
   Failures
   --------------------------------------------------------------------------- */

/** Provider responses that mean "this will never work". */
const PERMANENT_PATTERNS = [
  /invalid.*(address|recipient|number|to)/i,
  /(address|recipient|number).*(invalid|not valid|malformed)/i,
  /no such (user|mailbox|recipient)/i,
  /unknown recipient/i,
  /mailbox (unavailable|not found|does not exist)/i,
  /unsubscribed|suppressed|blocked|blacklisted/i,
  /not a mobile number|landline/i,
  /permanent(ly)? fail/i,
];

/**
 * Whether a failure is worth trying again.
 *
 * SMTP and most HTTP providers already say so in the status: 5xx is permanent
 * in SMTP terms and 4xx is permanent in HTTP terms, which are opposite
 * conventions and the reason this takes the code and the protocol rather than
 * guessing from a number.
 *
 * When nothing identifies it, the answer is transient. Retrying something
 * unsendable costs a handful of attempts; giving up on something sendable
 * costs the message.
 */
export function classifyFailure(input: {
  message: string;
  /** SMTP reply code, or HTTP status, depending on the transport. */
  code?: number | null;
  protocol?: 'smtp' | 'http';
}): FailureKind {
  const { code, protocol, message } = input;

  if (protocol === 'smtp' && code) {
    return code >= 500 && code < 600 ? 'PERMANENT' : 'TRANSIENT';
  }

  if (protocol === 'http' && code) {
    // 429 is the exception: it is a 4xx that explicitly means try later.
    if (code === 429) return 'TRANSIENT';
    return code >= 400 && code < 500 ? 'PERMANENT' : 'TRANSIENT';
  }

  return PERMANENT_PATTERNS.some((pattern) => pattern.test(message)) ? 'PERMANENT' : 'TRANSIENT';
}

export interface Attempt {
  attempts: number;
  status: 'QUEUED' | 'FAILED';
  availableAt: Date | null;
  reason: string;
}

/**
 * What to do with a message that has just failed.
 *
 * The three outcomes are: never again, later, and later but this is the last
 * time. A row must always end in a state somebody can read, which is why the
 * exhausted case says so in the reason rather than leaving a FAILED row whose
 * only explanation is the provider's last words.
 */
export function afterFailure(input: {
  attempts: number;
  kind: FailureKind;
  message: string;
  now: Date;
  random?: () => number;
}): Attempt {
  const attempts = input.attempts + 1;

  if (input.kind === 'PERMANENT') {
    return {
      attempts,
      status: 'FAILED',
      availableAt: null,
      reason: `Will not be retried: ${input.message}`,
    };
  }

  if (attempts >= MAX_SEND_ATTEMPTS) {
    return {
      attempts,
      status: 'FAILED',
      availableAt: null,
      reason: `Gave up after ${attempts} attempts. Last error: ${input.message}`,
    };
  }

  return {
    attempts,
    status: 'QUEUED',
    availableAt: new Date(input.now.getTime() + backoffFor(attempts, input.random)),
    reason: input.message,
  };
}
