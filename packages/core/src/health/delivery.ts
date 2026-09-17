import { fill } from './signals';

/**
 * Why a customer did not get their message. Phase 50.
 *
 * This is the whole phase in one function. "Why did this customer not get
 * their message?" is the question a workshop rings about, and the answer has
 * always existed — spread across a status, an attempt count, a provider's
 * error, a suppression list and a consent flag, in five places, none of which
 * mean anything on their own to the person asking.
 *
 * What makes an answer useful is that it names the next move. "FAILED" is not
 * an answer. "The address bounced on 12 September and nothing has been sent to
 * it since; ask them for a different one" is an answer, and the difference
 * between the two is an afternoon.
 *
 * The order matters and is not the order the columns are in. A suppression
 * beats a status, because a suppressed message was never attempted and its
 * status says nothing about why. Consent beats suppression, because a customer
 * who asked not to be written to has not got a delivery problem — they have
 * exactly what they asked for, and an operator chasing a bounce there is
 * chasing the wrong thing entirely.
 */

export type DeliveryOutcome =
  /** It arrived, or the provider says so. */
  | 'delivered'
  /** It left here and nobody has said otherwise. */
  | 'sent'
  /** Still to go, for a reason. */
  | 'waiting'
  /** It will not be sent, and this is why. */
  | 'stopped';

export interface DeliveryVerdict {
  outcome: DeliveryOutcome;
  /** One sentence with its figures left as slots, for a page. */
  template: string;
  values: Record<string, string | number>;
  /** The same, filled in, for a script and a log. */
  sentence: string;
  /** What the person asking should do next, when there is something to do. */
  next?: string;
}

export interface MessageFacts {
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SUPPRESSED';
  attempts: number;
  error?: string | null;
  /** Not before this. Carries the retry backoff and the quiet-hours hold. */
  availableAt: Date;
  sentAt?: Date | null;
  /** The address is on the suppression list, with why and when. */
  suppressed?: { reason: string; on: Date; detail?: string | null } | null;
  /** The customer withdrew consent for this channel. */
  consentWithdrawn?: boolean;
  /** Past this, sending is given up on rather than retried for ever. */
  maxAttempts: number;
  now?: Date;
}

function day(at: Date): string {
  return at.toISOString().slice(0, 10);
}

function verdict(
  outcome: DeliveryOutcome,
  template: string,
  values: Record<string, string | number>,
  next?: string,
): DeliveryVerdict {
  return { outcome, template, values, sentence: fill(template, values), next };
}

export function whyMessage(facts: MessageFacts): DeliveryVerdict {
  const now = facts.now ?? new Date();

  // Asked not to be written to. First, because this is not a fault and
  // treating it as one sends somebody chasing a delivery problem that does not
  // exist — and because the one thing nobody should do about it is retry.
  if (facts.consentWithdrawn) {
    return verdict(
      'stopped',
      'They asked not to be written to on this channel, so nothing was sent.',
      {},
      'Nothing to fix. Ring them, or ask them to opt back in on their own page.',
    );
  }

  // Suppressed beats the status, because a suppressed message was never
  // attempted and its status has nothing to say about why.
  if (facts.suppressed) {
    return verdict(
      'stopped',
      'The address was stopped on {on} after {reason}, and nothing has gone to it since.',
      { on: day(facts.suppressed.on), reason: facts.suppressed.reason.toLowerCase() },
      'Ask them for a different address, or lift the block on the messages page if you know it was wrong.',
    );
  }

  if (facts.status === 'SUPPRESSED') {
    return verdict(
      'stopped',
      'It was not sent, because sending to that address is blocked.',
      {},
      'The messages page lists what is blocked and why.',
    );
  }

  if (facts.status === 'DELIVERED') {
    return verdict('delivered', 'It arrived. The provider confirmed it.', {});
  }

  if (facts.status === 'SENT') {
    return verdict(
      'sent',
      'It left here on {on}. Nobody has told us it arrived, and most providers never do.',
      { on: facts.sentAt ? day(facts.sentAt) : day(now) },
      'If they say it is not there, check the junk folder before anything else.',
    );
  }

  if (facts.status === 'FAILED') {
    const givenUp = facts.attempts >= facts.maxAttempts;

    return givenUp
      ? verdict(
          'stopped',
          'Sending was tried {attempts} times and given up on. The last thing the provider said was: {error}',
          { attempts: facts.attempts, error: facts.error ?? 'nothing' },
          'Read what the provider said. It is usually the address.',
        )
      : verdict(
          'waiting',
          'The last attempt failed and it will be tried again. The provider said: {error}',
          { error: facts.error ?? 'nothing' },
        );
  }

  // Queued. Two quite different reasons, and telling them apart is the point:
  // one is the product working and one is the product stuck.
  const waitingFor = Math.round((facts.availableAt.getTime() - now.getTime()) / 1000);

  if (waitingFor > 60) {
    return verdict(
      'waiting',
      facts.attempts > 0
        ? 'It failed {attempts} time(s) and is waiting {minutes} minutes before trying again.'
        : 'It is waiting {minutes} minutes, because messages are held outside the hours a customer wants to hear from you.',
      { attempts: facts.attempts, minutes: Math.round(waitingFor / 60) },
    );
  }

  return verdict(
    'waiting',
    'It is due to go now and has not gone yet.',
    {},
    'If it stays here, the worker that sends messages is not running.',
  );
}

/** Whether a queue of these is the product working or the product stuck. */
export function stuckMessages(
  messages: readonly { status: MessageFacts['status']; availableAt: Date }[],
  now = new Date(),
): number {
  return messages.filter(
    (message) => message.status === 'QUEUED' && message.availableAt.getTime() <= now.getTime(),
  ).length;
}
