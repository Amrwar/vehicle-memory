'use client';

import { Button } from '@carnet/ui';

import { useT } from '@/components/language-provider';

/** Prints the page. A real button, because a receipt is a thing on paper. */
export function PrintButton({ label }: { label?: string }) {
  const t = useT();
  return (
    <Button type="button" variant="primary" onClick={() => window.print()} className="print:hidden">
      {label ? t(label) : t('Print')}
    </Button>
  );
}
