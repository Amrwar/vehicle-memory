'use client';

import { humanisePermission } from '@carnet/core';
import { useSearchParams } from 'next/navigation';

import { useT } from '@/components/language-provider';

/**
 * Says why the last click went somewhere else.
 *
 * A permission refusal that silently drops you on the dashboard is the same
 * failure as a greyed-out button: the person is left guessing whether they
 * mistyped, whether the page is broken, or whether they are not allowed. Say
 * which, name the permission, and let them ask their manager for it.
 */
export function AccessNotice() {
  const t = useT();
  const denied = useSearchParams().get('denied');
  if (!denied) return null;

  return (
    <div
      role="status"
      className="mb-5 flex items-start gap-2.5 rounded-(--radius-md) border border-(--warning) bg-(--warning-soft) px-3.5 py-2.5"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden
        className="mt-0.5 shrink-0 text-(--warning)"
      >
        <circle cx="8" cy="8" r="6.6" stroke="currentColor" strokeWidth="1.4" />
        <path d="M8 4.8v3.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="8" cy="11" r="0.85" fill="currentColor" />
      </svg>
      <p className="text-[13px] leading-relaxed text-(--warning)">
        {t(
          'That page needs {permission}, which your role does not carry. You have been brought back to your own workspace. Ask an owner or manager if you need it.',
          { permission: t(humanisePermission(denied)) },
        )}
      </p>
    </div>
  );
}
