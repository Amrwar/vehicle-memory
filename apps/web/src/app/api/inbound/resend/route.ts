import { createHmac, timingSafeEqual } from 'node:crypto';

import { prisma } from '@carnet/db';
import { NextResponse } from 'next/server';

import { readDeliveryPayload, recordDeliveryEvent } from '@/lib/deliverability';
import { env } from '@/lib/env';
import { receiveInbound } from '@/lib/retention';

export const dynamic = 'force-dynamic';

/**
 * Where the mail provider delivers a reply. FR-3801.
 *
 * A shape of its own rather than bending the generic endpoint, because a
 * provider webhook is not a client calling an API: it cannot be given a bearer
 * token, it signs its requests instead, and it sends whatever payload it
 * likes. Mapping that onto the product's own idea of an inbound message is a
 * translation, and translations belong at the edge.
 *
 * Signature verification follows the Svix scheme, which Resend and a good
 * number of other providers use: an HMAC over the id, the timestamp and the
 * exact bytes of the body, compared in constant time.
 *
 * Fails closed. With no secret configured this refuses everything rather than
 * accepting everything, because the endpoint writes into a workshop's inbox.
 */

/** How far out of step a provider's clock may be before a replay is suspected. */
const TOLERANCE_SECONDS = 300;

function verify(input: {
  secret: string;
  id: string;
  timestamp: string;
  signatures: string;
  body: string;
}): boolean {
  const sent = Number(input.timestamp);

  if (!Number.isFinite(sent)) return false;

  // An old request is refused even with a good signature. Without this a
  // captured webhook could be replayed for as long as the secret lives.
  if (Math.abs(Date.now() / 1000 - sent) > TOLERANCE_SECONDS) return false;

  // The secret is sent as `whsec_` followed by base64. Anything else is taken
  // at face value, so a plain shared secret also works for testing.
  const key = input.secret.startsWith('whsec_')
    ? Buffer.from(input.secret.slice(6), 'base64')
    : Buffer.from(input.secret);

  const expected = createHmac('sha256', key)
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest('base64');

  // The header carries a space-separated list, each entry prefixed with its
  // version. A provider rotating a secret sends both for a while, and refusing
  // the second would drop mail during the rotation.
  return input.signatures
    .split(' ')
    .map((entry) => entry.split(',').at(-1) ?? '')
    .some((candidate) => {
      const a = Buffer.from(candidate);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    });
}

/**
 * Which workshop a message belongs to.
 *
 * Read from the address it was sent to, never from the body. Inbound mail
 * arrives on a subdomain whose whole left-hand side is the workshop's slug, so
 * `hillside-motors@reply.carnetpassport.com` is unambiguous and a sender
 * cannot claim to be writing to a different workshop by editing their message.
 */
async function organisationFor(to: string): Promise<string | null> {
  const address = /<([^>]+)>/.exec(to)?.[1] ?? to;
  const local = address.split('@')[0]?.trim().toLowerCase();

  if (!local) return null;

  // Plus-addressing is stripped, because mail clients add it and a customer
  // forwarding a thread can introduce one.
  const slug = local.split('+')[0]!;

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });

  return org?.id ?? null;
}

/**
 * Which workshop a delivery event belongs to.
 *
 * Found through the message that was sent, not through the address itself: the
 * recipient of a bounce is a customer, and two workshops may both have a
 * customer at the same address. The message says which of them sent it.
 */
async function organisationForSender(address: string): Promise<string | null> {
  const message = await prisma.messageLog.findFirst({
    where: { toAddress: address.trim().toLowerCase() },
    orderBy: { createdAt: 'desc' },
    select: { orgId: true },
  });

  return message?.orgId ?? null;
}

/**
 * The message itself, which the webhook does not carry.
 *
 * Resend sends metadata and nothing else: no body, no headers, no
 * attachments. Without this call every reply arrives looking empty and is
 * thrown away, which is not a failure anybody would see in a log.
 *
 * The key is the same secret the SMTP password holds, because with this
 * provider they are one credential. Read from either, preferring the explicit
 * one, so a deployment that sets both cannot have them drift apart.
 */
async function fetchReceivedEmail(id: string): Promise<{
  from?: string;
  to?: unknown;
  subject?: string | null;
  text?: string;
} | null> {
  if (!id) return null;

  const key =
    process.env.RESEND_API_KEY ??
    (process.env.SMTP_PASSWORD?.startsWith('re_') ? process.env.SMTP_PASSWORD : undefined);

  if (!key) return null;

  try {
    const response = await fetch(
      `https://api.resend.com/emails/receiving/${encodeURIComponent(id)}`,
      {
        headers: { authorization: `Bearer ${key}` },
      },
    );

    if (!response.ok) return null;

    return (await response.json()) as {
      from?: string;
      to?: unknown;
      subject?: string;
      text?: string;
    };
  } catch {
    // A provider having a bad minute is not a reason to refuse the webhook and
    // have it retried forever. The row is simply not written.
    return null;
  }
}

export async function POST(request: Request) {
  const secret = env().INBOUND_WEBHOOK_SECRET;

  if (!secret) {
    return NextResponse.json({ error: 'Inbound mail is not configured.' }, { status: 401 });
  }

  // Read once, as text. The signature is over the exact bytes, so parsing
  // first and re-serialising would compute the hash over something else.
  const raw = await request.text();

  const ok = verify({
    secret,
    id: request.headers.get('svix-id') ?? request.headers.get('webhook-id') ?? '',
    timestamp:
      request.headers.get('svix-timestamp') ?? request.headers.get('webhook-timestamp') ?? '',
    signatures:
      request.headers.get('svix-signature') ?? request.headers.get('webhook-signature') ?? '',
    body: raw,
  });

  if (!ok) {
    return NextResponse.json({ error: 'No.' }, { status: 401 });
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'That was not readable.' }, { status: 400 });
  }

  const data = (payload.data ?? payload) as Record<string, unknown>;

  const kind = String(payload.type ?? data.type ?? '');

  // Two quite different things arrive on one webhook. A reply from a customer
  // is a message to file; a bounce or a complaint is a fact about an address.
  // Only the first has a body worth reading, so they part company here.
  if (kind && !kind.includes('received')) {
    const delivery = readDeliveryPayload(payload);

    // Which workshop an event belongs to is read from the recipient, exactly
    // as an inbound reply is, because the provider has no idea who we are.
    const orgId = delivery.toAddress ? await organisationForSender(delivery.toAddress) : null;

    if (!orgId) {
      return NextResponse.json({ received: false, reason: 'No workshop for that address.' });
    }

    const result = await recordDeliveryEvent({ orgId, ...delivery });

    return NextResponse.json({ received: true, ...result });
  }

  // The webhook carries metadata only: no body, no headers, no attachments.
  // The message itself has to be fetched, and without that step every reply
  // arrives looking empty and is thrown away, which is exactly what happened
  // the first time this was tried.
  const full = await fetchReceivedEmail(String(data.email_id ?? data.id ?? ''));

  // A provider sends `to` as an array when a message had several recipients.
  const addressed = full?.to ?? data.to;
  const recipients = Array.isArray(addressed) ? addressed.map(String) : [String(addressed ?? '')];

  const from = String(full?.from ?? data.from ?? '');
  const text = String(full?.text ?? data.text ?? data.body ?? '').trim();

  if (!from || !text) {
    // Accepted rather than refused. A provider that gets an error retries, and
    // retrying an empty message forever helps nobody; the answer is to say it
    // was received and do nothing with it.
    return NextResponse.json({ received: false, reason: 'Nothing to file.' });
  }

  const results: string[] = [];

  for (const recipient of recipients) {
    const orgId = await organisationFor(recipient);
    if (!orgId) continue;

    const message = await receiveInbound({
      orgId,
      channel: 'EMAIL',
      fromAddress: /<([^>]+)>/.exec(from)?.[1] ?? from,
      subject: full?.subject ?? (data.subject ? String(data.subject) : null),
      body: text,
      providerRef: String(payload.id ?? data.id ?? data.message_id ?? '') || null,
    });

    if (message) results.push(message.id);
  }

  return NextResponse.json({ received: results.length > 0, filed: results.length });
}
