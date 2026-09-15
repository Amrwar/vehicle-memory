/**
 * Conversations. Phase 36.
 *
 * One thread per customer, and one per job when a message is about a job,
 * whatever carried it: email, a text, WhatsApp, the portal. What went out
 * and what came back are two tables with different shapes, so the thread
 * is a view over both, ordered by time, and the rules about which channel
 * a customer can be reached on, what a template turns into, and what a
 * payment link says are pure and tested here.
 */

import type { Channel } from './delivery';
import { render, type Values } from './templates';

/** Every channel a message can travel by, in the order a composer offers them. */
export const CHANNELS: readonly Channel[] = ['SMS', 'WHATSAPP', 'EMAIL'];

export function channelLabel(channel: Channel | string): string {
  switch (channel) {
    case 'SMS':
      return 'text';
    case 'WHATSAPP':
      return 'WhatsApp';
    case 'EMAIL':
      return 'email';
    case 'PORTAL':
      return 'portal';
    default:
      return String(channel).toLowerCase();
  }
}

export interface Reachable {
  email?: string | null;
  mobile?: string | null;
}

/** Which channels this customer can actually be reached on, from what is on file. */
export function reachableChannels(customer: Reachable): Channel[] {
  const out: Channel[] = [];
  if (customer.mobile?.trim()) out.push('SMS', 'WHATSAPP');
  if (customer.email?.trim()) out.push('EMAIL');
  return out;
}

/** The address a message by this channel goes to, or null if there is none. */
export function addressFor(channel: Channel, customer: Reachable): string | null {
  if (channel === 'EMAIL') return customer.email?.trim() || null;
  return customer.mobile?.trim() || null;
}

/**
 * The channel to offer first: the one the customer last wrote on, else the
 * cheapest they can be reached on. A reply on the channel the question came
 * by is what a person would do.
 */
export function preferredChannel(input: {
  customer: Reachable;
  lastInboundChannel?: Channel | string | null;
}): Channel | null {
  const reachable = reachableChannels(input.customer);
  if (reachable.length === 0) return null;
  const last = input.lastInboundChannel as Channel | undefined;
  if (last && reachable.includes(last)) return last;
  return reachable[0] ?? null;
}

/* ---------------------------------------------------------------------------
   The thread, as one list
   --------------------------------------------------------------------------- */

export interface OutboundEntry {
  id: string;
  channel: Channel | string;
  subject?: string | null;
  body: string;
  status: string;
  error?: string | null;
  at: Date;
  sentAt?: Date | null;
}

export interface InboundEntry {
  id: string;
  channel: Channel | string;
  subject?: string | null;
  body: string;
  at: Date;
  confidence?: string | null;
}

export interface ThreadEntry {
  id: string;
  direction: 'out' | 'in';
  channel: Channel | string;
  subject: string | null;
  body: string;
  at: Date;
  /** For outbound: what became of it, in a word. */
  state: 'sent' | 'delivered' | 'queued' | 'failed' | 'suppressed' | 'received';
  detail: string | null;
}

/** Both directions as one list, oldest first, the way a conversation reads. */
export function mergeThread(
  outbound: readonly OutboundEntry[],
  inbound: readonly InboundEntry[],
): ThreadEntry[] {
  const entries: ThreadEntry[] = [
    ...outbound.map((m) => ({
      id: m.id,
      direction: 'out' as const,
      channel: m.channel,
      subject: m.subject ?? null,
      body: m.body,
      at: m.sentAt ?? m.at,
      state: stateOf(m.status),
      detail: m.error ?? null,
    })),
    ...inbound.map((m) => ({
      id: m.id,
      direction: 'in' as const,
      channel: m.channel,
      subject: m.subject ?? null,
      body: m.body,
      at: m.at,
      state: 'received' as const,
      detail: null,
    })),
  ];
  return entries.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function stateOf(status: string): ThreadEntry['state'] {
  switch (status) {
    case 'SENT':
      return 'sent';
    case 'DELIVERED':
      return 'delivered';
    case 'FAILED':
      return 'failed';
    case 'SUPPRESSED':
      return 'suppressed';
    default:
      return 'queued';
  }
}

/* ---------------------------------------------------------------------------
   Templates that are messages
   --------------------------------------------------------------------------- */

export interface DefaultTemplate {
  key: string;
  name: string;
  /** Null: any channel. */
  channel: Channel | null;
  body: string;
}

/**
 * Written as the message a good service advisor would send, with the few
 * facts that change filled from the job. Not a form with blanks in it: a
 * template a person would be embarrassed to send unedited is one they will
 * never use.
 */
export const DEFAULT_TEMPLATES: readonly DefaultTemplate[] = [
  {
    key: 'ready',
    name: 'Car is ready',
    channel: null,
    body: 'Hello {{firstName}}, your {{vehicle}} is ready to collect. We are open until 6 today. {{workshopName}}',
  },
  {
    key: 'running-late',
    name: 'Running late',
    channel: null,
    body: 'Hello {{firstName}}, the {{vehicle}} is taking a little longer than we said. We will let you know the moment it is done, and we are sorry for the wait. {{workshopName}}',
  },
  {
    key: 'quote-nudge',
    name: 'Quote waiting',
    channel: null,
    body: 'Hello {{firstName}}, the quote for your {{vehicle}} is waiting for you at {{link}}. Nothing happens until you say so; ring us on {{workshopPhone}} if anything is unclear. {{workshopName}}',
  },
  {
    key: 'pay',
    name: 'Bill to pay',
    channel: null,
    body: 'Hello {{firstName}}, the bill for your {{vehicle}} comes to {{amount}}. You can pay it before you collect at {{link}}. {{workshopName}}',
  },
  {
    key: 'parts-arrived',
    name: 'Parts have arrived',
    channel: null,
    body: 'Hello {{firstName}}, the parts for your {{vehicle}} are in. Would you like to book it back in? Reply here or ring {{workshopPhone}}. {{workshopName}}',
  },
];

/** A template filled in, or the reason it cannot be. */
export function fillTemplate(
  body: string,
  values: Values,
): { text: string; problem: null } | { text: null; problem: string } {
  try {
    return { text: render(body, values), problem: null };
  } catch (error) {
    return { text: null, problem: error instanceof Error ? error.message : String(error) };
  }
}

/** The one sentence a payment link goes out with. */
export function paymentSentence(input: {
  amount: string;
  link: string;
  vehicle?: string | null;
}): string {
  const car = input.vehicle?.trim() ? `for the ${input.vehicle.trim()}` : 'for the work';
  return `The bill ${car} comes to ${input.amount}. You can pay it here: ${input.link}`;
}

/* ---------------------------------------------------------------------------
   Read state and ordering
   --------------------------------------------------------------------------- */

export interface ThreadSummary {
  id: string;
  lastMessageAt: Date;
  lastInboundAt: Date | null;
  readAt: Date | null;
  assignedToUserId: string | null;
  status: 'OPEN' | 'CLOSED';
}

/** Something came in that nobody has looked at since. */
export function isUnread(thread: Pick<ThreadSummary, 'lastInboundAt' | 'readAt'>): boolean {
  if (!thread.lastInboundAt) return false;
  return !thread.readAt || thread.readAt.getTime() < thread.lastInboundAt.getTime();
}

/**
 * Unread first, then by the latest message. Closed threads last whatever
 * their dates: a closed thread that gets a reply reopens, so a closed one
 * is by definition quiet.
 */
export function orderThreads<T extends ThreadSummary>(threads: readonly T[]): T[] {
  return [...threads].sort((a, b) => {
    const closed = Number(a.status === 'CLOSED') - Number(b.status === 'CLOSED');
    if (closed !== 0) return closed;
    const unread = Number(isUnread(b)) - Number(isUnread(a));
    if (unread !== 0) return unread;
    return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
  });
}
