import { isPrintKind, type PrintKind } from '@carnet/core';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { PrintActions } from '@/components/print/actions';
import {
  CounterSalePrint,
  EstimatePrint,
  InspectionPrint,
  InvoicePrint,
  KeyTagPrint,
  LabelsPrint,
  WorkOrderPrint,
} from '@/components/print/documents';
import { currentUser } from '@/lib/auth';
import { tFor } from '@/lib/i18n';
import {
  counterSaleDocument,
  estimateDocument,
  inspectionDocument,
  invoiceDocument,
  labelsDocument,
  readerFor,
  workOrderDocument,
} from '@/lib/print';

export const dynamic = 'force-dynamic';

const TITLES: Record<PrintKind, string> = {
  invoice: 'Invoice',
  estimate: 'Quote',
  inspection: 'Inspection report',
  'work-order': 'Work order',
  'key-tag': 'Key tag',
  labels: 'Part labels',
  'counter-sale': 'Receipt',
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kind: string }>;
}): Promise<Metadata> {
  const { kind } = await params;
  const t = await tFor();
  return { title: isPrintKind(kind) ? t(TITLES[kind]) : t('Print') };
}

/** Where "Back" goes, for the person who printed it. */
function backFor(kind: PrintKind, id: string, audience: 'workshop' | 'customer'): string | null {
  if (audience === 'customer') {
    return kind === 'estimate' ? `/portal/estimates/${id}` : '/portal';
  }
  switch (kind) {
    case 'invoice':
      return `/invoices/${id}`;
    case 'work-order':
    case 'key-tag':
      return `/jobs/${id}`;
    case 'counter-sale':
      return '/counter';
    case 'labels':
      return '/parts';
    default:
      return null;
  }
}

/**
 * A document, printed. Phase 42.
 *
 * Outside the workshop's own layout, so nothing but the document is on the
 * page: the letterhead, the document, and on screen the buttons to print it
 * or take it as a PDF. The same page is what the PDF is rendered from.
 */
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ print?: string; parts?: string; part?: string; copies?: string }>;
}) {
  const { kind, id } = await params;
  const query = await searchParams;
  if (!isPrintKind(kind)) notFound();
  if (!query.parts && query.part) query.parts = `${query.part}:${query.copies ?? '1'}`;

  if (!(await currentUser())) redirect('/login');
  const reader = await readerFor(kind, id);
  if (!reader) notFound();
  const t = await tFor();

  let body: React.ReactNode;
  switch (kind) {
    case 'invoice': {
      const doc = await invoiceDocument(reader.orgId, id);
      if (!doc) notFound();
      body = <InvoicePrint t={t} reader={reader} doc={doc} />;
      break;
    }
    case 'estimate': {
      const doc = await estimateDocument(reader.orgId, id);
      if (!doc) notFound();
      body = <EstimatePrint t={t} reader={reader} doc={doc} />;
      break;
    }
    case 'inspection': {
      const doc = await inspectionDocument(reader.orgId, id);
      if (!doc) notFound();
      body = <InspectionPrint t={t} reader={reader} doc={doc} />;
      break;
    }
    case 'work-order':
    case 'key-tag': {
      const doc = await workOrderDocument(reader.orgId, id);
      if (!doc) notFound();
      body =
        kind === 'work-order' ? (
          <WorkOrderPrint t={t} reader={reader} doc={doc} />
        ) : (
          <KeyTagPrint t={t} reader={reader} doc={doc} />
        );
      break;
    }
    case 'counter-sale': {
      const doc = await counterSaleDocument(reader.orgId, id);
      if (!doc) notFound();
      body = <CounterSalePrint t={t} reader={reader} doc={doc} />;
      break;
    }
    case 'labels': {
      try {
        const doc = await labelsDocument(reader.orgId, query.parts ?? '');
        body = <LabelsPrint t={t} reader={reader} doc={doc} />;
      } catch {
        notFound();
      }
      break;
    }
  }

  const search = query.parts ? `?parts=${encodeURIComponent(query.parts)}` : '';

  return (
    <div className="print-desk">
      <PrintActions
        pdfHref={`/api/print/${kind}/${id}${search}`}
        backHref={backFor(kind, id, reader.audience)}
        autoPrint={query.print === '1'}
      />
      {body}
    </div>
  );
}
