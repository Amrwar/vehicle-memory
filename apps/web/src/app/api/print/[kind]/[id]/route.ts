import { isPrintKind, pdfFilename } from '@carnet/core';
import { prisma } from '@carnet/db';

import { LANGUAGE_COOKIE } from '@/lib/i18n';
import { renderPdf } from '@/lib/pdf';
import { readerFor } from '@/lib/print';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SESSION_COOKIE = 'carnet_session';

async function numberFor(kind: string, id: string): Promise<string> {
  switch (kind) {
    case 'invoice':
      return (
        (await prisma.invoice.findUnique({ where: { id }, select: { number: true } }))?.number ?? id
      );
    case 'estimate': {
      const row = await prisma.estimate.findUnique({
        where: { id },
        select: { version: true, job: { select: { number: true } } },
      });
      return row ? `${row.job.number}-v${row.version}` : id;
    }
    case 'inspection': {
      const row = await prisma.inspection.findUnique({
        where: { id },
        select: { job: { select: { number: true } } },
      });
      return row ? String(row.job.number) : id;
    }
    case 'work-order':
    case 'key-tag': {
      const row = await prisma.job.findUnique({ where: { id }, select: { number: true } });
      return row ? String(row.number) : id;
    }
    case 'counter-sale':
      return (
        (await prisma.counterSale.findUnique({ where: { id }, select: { reference: true } }))
          ?.reference ?? id
      );
    default:
      return new Date().toISOString().slice(0, 10);
  }
}

/**
 * A printed document as a PDF. Phase 42.
 *
 * Checked here as the page checks it, before a browser is started for
 * anybody who may not read the document. The PDF is the print page rendered
 * with the reader's own cookies, so it is exactly what they would print. When
 * no PDF can be made, the reader is sent to the print page, which opens the
 * print dialog: paper, or the browser's own PDF.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await context.params;
  if (!isPrintKind(kind)) return new Response('No such document.', { status: 404 });

  const reader = await readerFor(kind, id);
  if (!reader) return new Response('No such document.', { status: 404 });

  const url = new URL(request.url);
  const page = new URL(`/print/${kind}/${id}`, url.origin);
  const parts = url.searchParams.get('parts');
  if (parts) page.searchParams.set('parts', parts);

  const cookies = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((pair) => pair.trim())
    .map((pair) => {
      const at = pair.indexOf('=');
      return at > 0 ? { name: pair.slice(0, at), value: pair.slice(at + 1) } : null;
    })
    .filter(
      (cookie): cookie is { name: string; value: string } =>
        cookie !== null && [SESSION_COOKIE, LANGUAGE_COOKIE].includes(cookie.name),
    );

  const pdf = await renderPdf({ url: page.toString(), cookies });
  if (!pdf) {
    page.searchParams.set('print', '1');
    return Response.redirect(page.toString(), 303);
  }

  const filename = pdfFilename({
    kind,
    number: await numberFor(kind, id),
    orgName: reader.letterhead.name,
  });
  return new Response(Buffer.from(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}
