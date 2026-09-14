'use client';

import { Button } from '@carnet/ui';

/** Prints the page. A real button, because a receipt is a thing on paper. */
export function PrintButton({ label = 'Print' }: { label?: string }) {
  return (
    <Button type="button" variant="primary" onClick={() => window.print()} className="print:hidden">
      {label}
    </Button>
  );
}
