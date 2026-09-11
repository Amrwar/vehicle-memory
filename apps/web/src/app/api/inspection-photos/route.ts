import { prisma } from '@carnet/db';
import { type NextRequest, NextResponse } from 'next/server';

import { requireSession } from '@/lib/guard';
import { attachPhoto, InspectionError } from '@/lib/inspections';
import { StorageError, ticketFor } from '@/lib/storage';

/**
 * Two steps of one upload.
 *
 * POST asks for somewhere to put a file and gets a signed URL back. The
 * browser then uploads straight to the store. PUT records that it happened.
 *
 * Split in two on purpose. The bytes never pass through this application, so a
 * four-megabyte photograph does not have to fit inside a serverless request
 * body, and the row is only written once the store has confirmed it holds the
 * file. A row pointing at bytes that are not there is the failure somebody
 * discovers when the customer asks to see the picture.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** The inspection this result belongs to, if it is this workshop's and open. */
async function openResult(orgId: string, resultId: string) {
  const result = await prisma.inspectionResult.findFirst({
    where: { id: resultId, inspection: { job: { orgId } } },
    select: { id: true, inspectionId: true, inspection: { select: { status: true } } },
  });

  if (!result) return { error: 'No such item on this inspection.', status: 404 } as const;

  if (result.inspection.status === 'COMPLETED') {
    return { error: 'That inspection has already gone to the customer.', status: 409 } as const;
  }

  return { result } as const;
}

export async function POST(request: NextRequest) {
  const { orgId } = await requireSession('job:write');

  const body = (await request.json()) as {
    resultId?: string;
    filename?: string;
    contentType?: string;
    sizeBytes?: number;
  };

  const found = await openResult(orgId, body.resultId ?? '');
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status });

  try {
    const ticket = await ticketFor({
      orgId,
      scope: 'inspections',
      scopeId: found.result.inspectionId,
      filename: body.filename ?? 'photo.jpg',
      contentType: body.contentType ?? '',
      sizeBytes: Number(body.sizeBytes ?? 0),
    });

    // The public URL is not returned here. Nothing should be shown until the
    // bytes are confirmed, and returning a link invites exactly that.
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
    resultId?: string;
    key?: string;
    filename?: string;
    mimeType?: string;
    sizeBytes?: number;
    caption?: string;
  };

  const found = await openResult(orgId, body.resultId ?? '');
  if ('error' in found) return NextResponse.json({ error: found.error }, { status: found.status });

  // The key was minted by this application a moment ago and carries the
  // organisation in its first segment. Checking it prevents a caller pointing
  // a row at somebody else's file.
  if (!body.key?.startsWith(`${orgId}/inspections/${found.result.inspectionId}/`)) {
    return NextResponse.json({ error: 'That file does not belong here.' }, { status: 400 });
  }

  try {
    const id = await attachPhoto({
      orgId,
      userId: user.userId,
      resultId: found.result.id,
      key: body.key,
      filename: body.filename ?? 'photo.jpg',
      mimeType: body.mimeType ?? 'image/jpeg',
      sizeBytes: Number(body.sizeBytes ?? 0),
      caption: body.caption ?? null,
    });

    return NextResponse.json({ id });
  } catch (error) {
    if (error instanceof InspectionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    throw error;
  }
}
