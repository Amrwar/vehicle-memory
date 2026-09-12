/**
 * What the provider tells you after a message has left.
 *
 * Sending is not delivering. The queue has recorded a message as SENT since
 * Phase 5, and SENT only ever meant that a provider accepted it at the door.
 * Everything after that happens out of sight: it reaches an inbox, it bounces
 * off a mailbox that no longer exists, or somebody presses the spam button.
 *
 * Two of those three matter enough to act on, and they are different in kind.
 *
 * A bounce is a fact about an address. A mailbox that does not exist will not
 * exist tomorrow either, and continuing to send to it is how a sender's
 * reputation is destroyed: providers read a high bounce rate as evidence that
 * the list was bought rather than earned, and start filing everything else in
 * spam. So a hard bounce stops that address being used again.
 *
 * A complaint is a fact about a person. Somebody pressing "this is spam" has
 * asked to be left alone in the only way the interface gives them, and it does
 * not matter whether they ticked a consent box last year. It withdraws
 * marketing consent as well as suppressing the address, because the second
 * without the first would keep asking the question they have just answered.
 *
 * A soft bounce is neither. A full mailbox or a server having a bad afternoon
 * is temporary, and suppressing on one would lose a customer over a fault that
 * fixed itself by teatime.
 */

export type DeliveryEvent = 'SENT' | 'DELIVERED' | 'DELAYED' | 'BOUNCED' | 'COMPLAINED' | 'UNKNOWN';

/** How a provider names each event, mapped onto what the product calls it. */
const NAMES: Record<string, DeliveryEvent> = {
  'email.sent': 'SENT',
  'email.delivered': 'DELIVERED',
  'email.delivery_delayed': 'DELAYED',
  'email.bounced': 'BOUNCED',
  'email.complained': 'COMPLAINED',
  // Some providers use the bare verb rather than a namespaced one.
  sent: 'SENT',
  delivered: 'DELIVERED',
  bounced: 'BOUNCED',
  complained: 'COMPLAINED',
  complaint: 'COMPLAINED',
};

export function eventOf(type: string): DeliveryEvent {
  return NAMES[type.trim().toLowerCase()] ?? 'UNKNOWN';
}

export type BounceKind = 'HARD' | 'SOFT' | 'UNKNOWN';

/**
 * Whether a bounce is about the address or about the weather.
 *
 * Providers disagree on where they put this, so both the structured field and
 * the human sentence are read. When neither says, the answer is UNKNOWN and
 * nothing is suppressed: guessing hard on an ambiguous bounce loses a real
 * customer, and guessing soft merely delays a suppression by one more send.
 */
export function bounceKind(input: { kind?: string | null; message?: string | null }): BounceKind {
  const stated = input.kind?.trim().toLowerCase();

  if (stated === 'hard' || stated === 'permanent') return 'HARD';
  if (stated === 'soft' || stated === 'transient' || stated === 'temporary') return 'SOFT';

  const text = (input.message ?? '').toLowerCase();

  if (!text) return 'UNKNOWN';

  // The phrases that mean the address itself is wrong.
  if (
    /user unknown|no such user|does not exist|doesn't exist|unknown recipient|invalid recipient|address rejected|mailbox unavailable|no mailbox|recipient not found|550/.test(
      text,
    )
  ) {
    return 'HARD';
  }

  // The phrases that mean try again later.
  if (
    /mailbox full|over quota|quota exceeded|temporarily|try again|greylist|timed out|too many|rate limit|4\d\d/.test(
      text,
    )
  ) {
    return 'SOFT';
  }

  return 'UNKNOWN';
}

export interface Reaction {
  /** What the message row should become. */
  status: 'SENT' | 'DELIVERED' | 'FAILED' | 'SUPPRESSED' | null;
  /** Whether the address should stop being used. */
  suppress: boolean;
  /** Whether marketing consent should be withdrawn as well. */
  withdrawConsent: boolean;
  /** What to write against the message, and show a person. */
  note: string | null;
}

/**
 * What to do about one event.
 *
 * Deliberately never downgrades. A provider can deliver events out of order,
 * and a delayed notice arriving after a delivered one must not turn a message
 * that reached somebody back into one that did not.
 */
export function reactTo(input: {
  event: DeliveryEvent;
  bounce?: { kind?: string | null; message?: string | null };
  currentStatus?: string | null;
}): Reaction {
  const settled = input.currentStatus === 'DELIVERED' || input.currentStatus === 'SUPPRESSED';

  switch (input.event) {
    case 'DELIVERED':
      return {
        status: 'DELIVERED',
        suppress: false,
        withdrawConsent: false,
        note: 'Reached the recipient.',
      };

    case 'SENT':
      // Nothing to learn: the queue already wrote SENT when the provider
      // accepted it. Recording it again would only overwrite a later event.
      return { status: null, suppress: false, withdrawConsent: false, note: null };

    case 'DELAYED':
      return {
        status: settled ? null : 'SENT',
        suppress: false,
        withdrawConsent: false,
        note: 'The receiving server is holding it. Providers keep trying for a day or so.',
      };

    case 'BOUNCED': {
      const kind = bounceKind(input.bounce ?? {});

      if (kind === 'HARD') {
        return {
          status: 'FAILED',
          suppress: true,
          withdrawConsent: false,
          note: `Bounced permanently. ${input.bounce?.message ?? 'The address does not exist.'} Nothing further will be sent to it until somebody corrects it.`,
        };
      }

      return {
        status: 'FAILED',
        suppress: false,
        withdrawConsent: false,
        note:
          kind === 'SOFT'
            ? `Bounced, and it looks temporary. ${input.bounce?.message ?? ''}`.trim()
            : `Bounced, and the reason is not clear enough to act on. ${input.bounce?.message ?? ''}`.trim(),
      };
    }

    case 'COMPLAINED':
      return {
        status: 'SUPPRESSED',
        suppress: true,
        withdrawConsent: true,
        note: 'Marked as spam by the recipient. The address is suppressed and marketing consent has been withdrawn.',
      };

    default:
      return { status: null, suppress: false, withdrawConsent: false, note: null };
  }
}

export type SuppressionReason = 'HARD_BOUNCE' | 'COMPLAINT' | 'MANUAL';

/**
 * Whether a message may be sent to an address at all.
 *
 * Checked at the moment of sending rather than when queued, because a
 * suppression can arrive between the two: a reminder queued on Monday night
 * and sent on Tuesday morning must respect a bounce recorded in between.
 */
export function maySendTo(input: { address: string; suppressed: ReadonlySet<string> }): {
  allowed: boolean;
  reason: string | null;
} {
  if (input.suppressed.has(input.address.trim().toLowerCase())) {
    return {
      allowed: false,
      reason:
        'That address is suppressed after a permanent bounce or a spam complaint. Correct it or lift the suppression first.',
    };
  }

  return { allowed: true, reason: null };
}

/** What a workshop is told about its own deliverability. */
export function describeDeliverability(input: {
  sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  suppressed: number;
}): string {
  if (input.sent === 0) return 'Nothing has been sent yet.';

  const bounceRate = input.bounced / input.sent;

  // Two per cent is the figure providers themselves start warning about, and
  // five is where they begin throttling. Saying so is more useful than a bare
  // percentage nobody can calibrate.
  const verdict =
    bounceRate >= 0.05
      ? ' That is high enough that providers will start treating everything you send as suspicious.'
      : bounceRate >= 0.02
        ? ' That is above the level providers are comfortable with. Worth looking at the addresses.'
        : '';

  return `${input.delivered} of ${input.sent} confirmed delivered, ${input.bounced} bounced, ${input.complained} marked as spam.${verdict}${
    input.suppressed > 0 ? ` ${input.suppressed} addresses are suppressed.` : ''
  }`;
}
