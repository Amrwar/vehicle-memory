import { type DocumentKind, DocumentError } from '@carnet/core';
import { type NextRequest, NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { addDocument, mayHandleDocuments, removeDocument } from '@/lib/documents';
import { StorageError, ticketFor } from '@/lib/storage';

/**
 * Paperwork uploads. Phase 20.
 *
 * The same three steps as inspection photographs: ask for a ticket, PUT the
 * bytes straight to the store, then record the row, so a row never points at
 * bytes that are not there. Two kinds of caller share the route: a workshop
 * member with access to the vehicle, and the owner from the portal. Both
 * are checked the same way.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function actorFor(vehicleId: string) {
  const user = await currentUser();
  if (!user) return { error: 'Sign in first.', status: 401 } as const;

  const actor = await mayHandleDocuments({ orgId: user.orgId, userId: user.userId, vehicleId });
  if (!actor) return { error: 'No such vehicle on your books.', status: 404 } as const;

  return { actor, user } as const;
}

function dateOrNull(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    vehicleId?: string;
    kind?: string;
    filename?: string;
    contentType?: string;
    sizeBytes?: number;
  };

  const found = await actorFor(body.vehicleId ?? '');
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status });

  try {
    const ticket = await ticketFor({
      orgId: found.actor.orgId ?? `owner-${found.user.userId}`,
      scope: 'vehicle-documents',
      scopeId: body.vehicleId ?? '',
      filename: body.filename ?? 'document',
      contentType: body.contentType ?? '',
      sizeBytes: Number(body.sizeBytes ?? 0),
      accept: body.kind === 'PHOTO' ? 'photo' : 'document',
    });

    return NextResponse.json({ url: ticket.url, headers: ticket.headers, key: ticket.key });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function PUT(request: NextRequest) {
  const body = (await request.json()) as {
    vehicleId?: string;
    kind?: string;
    title?: string;
    reference?: string;
    issuedAt?: string;
    expiresAt?: string;
    key?: string;
    filename?: string;
    mimeType?: string;
    sizeBytes?: number;
    note?: string;
  };

  const found = await actorFor(body.vehicleId ?? '');
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status });

  // The key was minted by this application a moment ago and names the vehicle
  // in its scope. Checking it prevents a caller pointing a row at somebody
  // else's file.
  if (!body.key?.includes(`/vehicle-documents/${body.vehicleId}/`)) {
    return NextResponse.json({ error: 'That file does not belong here.' }, { status: 400 });
  }

  try {
    const id = await addDocument({
      actor: found.actor,
      vehicleId: body.vehicleId ?? '',
      kind: (body.kind ?? 'OTHER') as DocumentKind,
      title: body.title ?? '',
      reference: body.reference ?? null,
      issuedAt: dateOrNull(body.issuedAt),
      expiresAt: dateOrNull(body.expiresAt),
      fileKey: body.key,
      filename: body.filename ?? 'document',
      mimeType: body.mimeType ?? '',
      sizeBytes: Number(body.sizeBytes ?? 0),
      note: body.note ?? null,
    });

    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof DocumentError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

export async function DELETE(request: NextRequest) {
  const body = (await request.json()) as {
    vehicleId?: string;
    documentId?: string;
    reason?: string;
  };

  const found = await actorFor(body.vehicleId ?? '');
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status });

  try {
    await removeDocument({
      actor: found.actor,
      documentId: body.documentId ?? '',
      reason: body.reason ?? '',
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof DocumentError) {
      const status = error.code === 'NOT_ALLOWED' ? 403 : error.code === 'GONE' ? 404 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }
    throw error;
  }
}
