import Link from 'next/link';

/**
 * The way back from a page you arrived at by clicking something.
 *
 * Every detail page in the product now carries one. The sidebar gets somebody
 * to a list, and nothing got them back from a record to the list they came
 * from except the browser's own button, which the customer-facing and
 * tablet screens do not always show at all.
 *
 * It names the destination rather than saying "Back". A person who has been
 * interrupted, and everybody in a workshop is interrupted, cannot remember
 * where back leads, and a label that says where it goes costs nothing.
 */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-[13px] text-(--text-soft) transition-colors hover:text-(--brand-text)"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M10 3.5 5.5 8l4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </Link>
  );
}
