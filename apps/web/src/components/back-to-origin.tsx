'use client';

import * as React from 'react';

import { useT } from '@/components/language-provider';

/**
 * The way back from a page reached by link.
 *
 * A shared passport is opened from somewhere: the home page's demonstration,
 * a message from the seller, a search. Somebody who arrived from this site
 * expects the browser's back to work and a visible way to do it; somebody who
 * arrived from a message expects a way to the front door. This offers both:
 * history when it is ours to go back into, the front door otherwise.
 */
export function BackToOrigin({ fallback = '/', label }: { fallback?: string; label?: string }) {
  const t = useT();
  const [canGoBack, setCanGoBack] = React.useState(false);

  React.useEffect(() => {
    try {
      const referrer = document.referrer ? new URL(document.referrer) : null;
      setCanGoBack(window.history.length > 1 && referrer?.origin === window.location.origin);
    } catch {
      setCanGoBack(false);
    }
  }, []);

  if (canGoBack) {
    return (
      <button
        type="button"
        onClick={() => window.history.back()}
        className="inline-flex items-center gap-1.5 text-[13px] text-(--text-soft) hover:text-(--text) hover:underline"
      >
        <span aria-hidden>←</span> {label ? t(label) : t('Back')}
      </button>
    );
  }

  return (
    <a
      href={fallback}
      className="inline-flex items-center gap-1.5 text-[13px] text-(--text-soft) hover:text-(--text) hover:underline"
    >
      <span aria-hidden>←</span> Carnet
    </a>
  );
}
