import Link from 'next/link';
import * as React from 'react';

import { ThemeToggle } from './theme-toggle';

/**
 * The frame every customer-facing page sits in.
 *
 * Narrow, because this is read on a phone in a car park far more often than at
 * a desk. The navigation is four words, not a sidebar: somebody who visits
 * twice a year should not have to learn a layout.
 *
 * The same shell wraps the pages reached by a link with no account behind it,
 * which is why it takes `signedIn` rather than reading a session itself. A
 * stranger holding a share link sees the page and no navigation at all.
 */
export function PortalShell({
  children,
  signedIn = true,
  active,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
  active?: 'vehicles' | 'updates' | 'invoices' | 'book';
}) {
  return (
    <div className="min-h-dvh bg-(--ground)">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="border-b border-(--border) bg-(--surface)">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3.5">
          <Link href={signedIn ? '/portal' : '/'} className="flex items-center gap-2">
            <svg
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
              className="text-(--brand)"
            >
              <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M10 4.6v5.4l3.4 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="font-display text-[14px] font-semibold">Carnet</span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle className="w-[6.5rem]" />
            {signedIn ? (
              <form action="/api/sign-out" method="post">
                <button type="submit" className="text-[13px] text-(--text-faint) underline">
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </div>

        {signedIn ? (
          <nav aria-label="Your account" className="mx-auto max-w-2xl px-4 pb-2">
            <ul className="flex flex-wrap gap-4 text-[13px]">
              {[
                { href: '/portal', label: 'My vehicles', key: 'vehicles' },
                { href: '/portal/updates', label: 'Updates', key: 'updates' },
                { href: '/portal/invoices', label: 'Invoices', key: 'invoices' },
                { href: '/portal/book', label: 'Book a visit', key: 'book' },
              ].map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active === item.key ? 'page' : undefined}
                    className={
                      active === item.key
                        ? 'font-medium text-(--brand-text)'
                        : 'text-(--text-soft) hover:text-(--text)'
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main id="main" className="mx-auto max-w-2xl px-4 py-6">
        {children}
      </main>
    </div>
  );
}
