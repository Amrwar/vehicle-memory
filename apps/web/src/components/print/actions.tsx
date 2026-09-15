'use client';

import { Button } from '@carnet/ui';
import { useEffect } from 'react';

import { useT } from '@/components/language-provider';

/**
 * Print, or take the file. Hidden on paper. Phase 42.
 *
 * Opened with ?print=1, the page asks for the print dialog itself: that is
 * where the PDF link lands when no PDF could be made, so the person still
 * leaves with paper, or with a PDF their browser saves.
 */
export function PrintActions({
  pdfHref,
  backHref,
  autoPrint,
}: {
  pdfHref: string | null;
  backHref: string | null;
  autoPrint: boolean;
}) {
  const t = useT();

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  return (
    <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2">
      {backHref ? (
        <a href={backHref} className="text-[13px] text-(--text-soft) hover:underline">
          {t('Back')}
        </a>
      ) : (
        <span />
      )}
      <div className="flex flex-wrap gap-2">
        {pdfHref ? (
          <a href={pdfHref}>
            <Button type="button" variant="secondary">
              {t('Download PDF')}
            </Button>
          </a>
        ) : null}
        <Button type="button" variant="primary" onClick={() => window.print()}>
          {t('Print')}
        </Button>
      </div>
    </div>
  );
}
