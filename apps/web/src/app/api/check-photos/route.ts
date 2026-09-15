import { prisma } from '@carnet/db';
import { type NextRequest, NextResponse } from 'next/server';

import { ArrivalError, attachCheckPhoto } from '@/lib/arrival';
import { requireSession } from '@/lib/guard';
import { StorageError, ticketFor } from '@/lib/storage';

/**
 * Photographs at check-in and check-out. Phase 35.
 *
 * Two steps of one upload, the same as inspection photographs: POST asks
 * for somewhere to put the file, the browser uploads straight to the
 * store, PUT records that it happened. The row is written only once the
 * bytes are confirmed.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function ownCheck(orgId: string, checkId: string) {
  const check = await prisma.vehicleCheck.findFirst({
    where: { id: checkId, orgId },
    select: { id: true },
  });
  return check ? { check } : ({ error: 'No such check on this job.', status: 404 } as const);
}

export async function POST(request: NextRequest) {
  const { orgId } = await requireSession('job:write');
  const body = (await request.json()) as {
    checkId?: string;
    filename?: string;
    contentType?: string;
    sizeBytes?: number;
  };

  const found = await ownCheck(orgId, body.checkId ?? '');
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status });

  try {
    const ticket = await ticketFor({
      orgId,
      scope: 'checks',
      scopeId: found.check.id,
      filename: body.filename ?? 'photo.jpg',
      contentType: body.contentType ?? '',
      sizeBytes: Number(body.sizeBytes ?? 0),
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
  const { orgId, user } = await requireSession('job:write');
  const body = (await request.json()) as {
    checkId?: string;
    key?: string;
    filename?: string;
    mimeType?: string;
    sizeBytes?: number;
    caption?: string;
  };

  const found = await ownCheck(orgId, body.checkId ?? '');
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status });

  if (!body.key?.startsWith(`${orgId}/checks/${found.check.id}/`)) {
    return NextResponse.json({ error: 'That file does not belong here.' }, { status: 400 });
  }

  try {
    const id = await attachCheckPhoto({
      orgId,
      userId: user.userId,
      checkId: found.check.id,
      key: body.key,
      filename: body.filename ?? 'photo.jpg',
      mimeType: body.mimeType ?? 'image/jpeg',
      sizeBytes: Number(body.sizeBytes ?? 0),
      caption: body.caption ?? null,
    });
    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof ArrivalError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
