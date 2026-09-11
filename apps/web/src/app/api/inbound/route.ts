import { timingSafeEqual } from 'node:crypto';

import { NextResponse } from 'next/server';

import { env } from '@/lib/env';
import { receiveInbound } from '@/lib/retention';

export const dynamic = 'force-dynamic';

/**
 * Where a provider delivers a reply. FR-3705.
 *
 * Deliberately provider-shaped rather than tied to one. Twilio, a mail
 * forwarder and a WhatsApp gateway all post a sender, a body and their own
 * reference, and the differences between them belong in whatever maps onto
 * this rather than in the product.
 *
 * Authenticated by a shared secret compared in constant time, the same
 * mechanism the scheduled work uses. The alternative is an open endpoint that
 * writes rows into a workshop's inbox, and an inbox anybody can write to is
 * one nobody can trust.
 *
 * Fails closed. With no secret configured this refuses everything rather than
 * accepting everything, because the failure of the other choice is silent.
 */
function authorised(request: Request): boolean {
  const expected = env().CRON_SECRET;
  if (!expected) return false;

  const given =
    request.headers.get('x-carnet-secret') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    '';

  const a = Buffer.from(given);
  const b = Buffer.from(expected);

  // Length is compared first because timingSafeEqual throws on a mismatch,
  // and the length of a secret is not the part worth protecting.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'No.' }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'That was not readable.' }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;

  const orgId = String(payload.orgId ?? '');
  const from = String(payload.from ?? payload.fromAddress ?? '');
  const text = String(payload.body ?? payload.text ?? '');

  if (!orgId || !from || !text) {
    return NextResponse.json(
      { error: 'A message needs an organisation, a sender and something in it.' },
      { status: 400 },
    );
  }

  const channel = String(payload.channel ?? 'SMS').toUpperCase();

  const received = await receiveInbound({
    orgId,
    channel: channel === 'EMAIL' || channel === 'WHATSAPP' ? channel : 'SMS',
    fromAddress: from,
    subject: payload.subject ? String(payload.subject) : null,
    body: text,
    // The provider's own id, so a webhook retry is one row rather than a
    // customer appearing to repeat themselves.
    providerRef: payload.providerRef ? String(payload.providerRef) : null,
  });

  return NextResponse.json({ received: Boolean(received), id: received?.id ?? null });
}
