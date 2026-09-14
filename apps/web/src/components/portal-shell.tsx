import Link from 'next/link';
import * as React from 'react';

import { Mark } from '@/components/marketing';

import { ThemeToggle } from './theme-toggle';

/**
 * The frame every customer-facing page sits in. Redesigned in Phase 32.5.
 *
 * Two navigations for two hands. On a phone the tabs sit at the bottom,
 * where a thumb is, five of them with icons, always visible, so the
 * invoices and the passports are one tap from anywhere and not hidden
 * behind a vehicle. On a desktop the same tabs run under the header, and
 * the page widens to two columns rather than stretching a phone layout
 * across a monitor.
 *
 * The same shell wraps the pages reached by a link with no account behind
 * it, which is why it takes `signedIn` rather than reading a session
 * itself. A stranger holding a share link sees the page and no navigation.
 */

export type PortalTab =
  'home' | 'vehicles' | 'passports' | 'invoices' | 'updates' | 'rewards' | 'workshops' | 'book';

const TABS: {
  key: PortalTab;
  href: string;
  label: string;
  icon: React.ReactNode;
  phone: boolean;
}[] = [
  {
    key: 'home',
    href: '/portal',
    label: 'Home',
    phone: true,
    icon: <path d="M3.5 10.5 12 3.5l8.5 7v9a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1v-9Z" />,
  },
  {
    key: 'passports',
    href: '/portal/passports',
    label: 'Passports',
    phone: true,
    icon: (
      <>
        <rect x="5" y="3.5" width="14" height="17" rx="2" />
        <circle cx="12" cy="10" r="2.5" />
        <path d="M8.5 16.5h7" />
      </>
    ),
  },
  {
    key: 'invoices',
    href: '/portal/invoices',
    label: 'Invoices',
    phone: true,
    icon: (
      <>
        <path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5v-17Z" />
        <path d="M9 8.5h6M9 12h6" />
      </>
    ),
  },
  {
    key: 'updates',
    href: '/portal/updates',
    label: 'Updates',
    phone: true,
    icon: (
      <>
        <path d="M6 9a6 6 0 0 1 12 0v4l1.5 3h-15L6 13V9Z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </>
    ),
  },
  {
    key: 'rewards',
    href: '/portal/rewards',
    label: 'Rewards',
    phone: false,
    icon: (
      <>
        <rect x="3.5" y="8" width="17" height="12" rx="2" />
        <path d="M3.5 12h17M12 8v12M12 8c-2.5 0-4-1.2-4-2.5S9.5 3 12 5.5M12 8c2.5 0 4-1.2 4-2.5S14.5 3 12 5.5" />
      </>
    ),
  },
  {
    key: 'workshops',
    href: '/portal/workshops',
    label: 'Workshops',
    phone: false,
    icon: (
      <>
        <path d="M4 10.5 5.5 5h13l1.5 5.5" />
        <path d="M4.5 10.5h15v9h-15v-9Z" />
        <path d="M9 19.5v-4h6v4" />
      </>
    ),
  },
  {
    key: 'book',
    href: '/portal/book',
    label: 'Book',
    phone: true,
    icon: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="2" />
        <path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
  },
];

function TabIcon({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export function PortalShell({
  children,
  signedIn = true,
  active,
  wide = false,
}: {
  children: React.ReactNode;
  signedIn?: boolean;
  active?: PortalTab;
  /** Two columns on a desktop; the home and a vehicle use it. */
  wide?: boolean;
}) {
  const current = active === 'vehicles' ? 'home' : active;
  const width = wide ? 'max-w-5xl' : 'max-w-2xl';

  return (
    <div className="min-h-dvh bg-(--ground)">
      <header className="border-b border-(--border) bg-(--surface)">
        <div className={`mx-auto flex ${width} items-center justify-between gap-3 px-4 py-3`}>
          <Link href={signedIn ? '/portal' : '/'} className="flex items-center gap-2.5">
            <Mark size={22} className="text-(--brand)" />
            <span className="leading-none">
              <span className="block font-display text-[15px] font-semibold">Carnet</span>
              <span className="block text-[10px] font-medium tracking-[0.14em] text-(--text-faint) uppercase">
                Your cars
              </span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <ThemeToggle className="w-[6.5rem]" />
            {signedIn ? (
              <form action="/api/sign-out" method="post">
                <button
                  type="submit"
                  className="cursor-pointer text-[13px] font-medium text-(--text-soft) hover:text-(--text)"
                >
                  Sign out
                </button>
              </form>
            ) : null}
          </div>
        </div>

        {signedIn ? (
          <nav aria-label="Your account" className={`mx-auto hidden ${width} px-4 sm:block`}>
            <ul className="flex gap-1">
              {TABS.map((tab) => {
                const on = current === tab.key;
                return (
                  <li key={tab.key}>
                    <Link
                      href={tab.href}
                      aria-current={on ? 'page' : undefined}
                      className={
                        'flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-[13px] font-medium transition-colors ' +
                        (on
                          ? 'border-(--brand) text-(--brand-text)'
                          : 'border-transparent text-(--text-soft) hover:border-(--border-strong) hover:text-(--text)')
                      }
                    >
                      <TabIcon className="h-4 w-4">{tab.icon}</TabIcon>
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </header>

      <main
        id="main"
        tabIndex={-1}
        className={`mx-auto ${width} px-4 py-6 outline-none ${signedIn ? 'pb-24 sm:pb-10' : ''}`}
      >
        {children}
      </main>

      {signedIn ? (
        <nav
          aria-label="Your account"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-(--border) bg-(--surface) pb-[env(safe-area-inset-bottom)] sm:hidden"
        >
          <ul className="grid grid-cols-5">
            {TABS.filter((tab) => tab.phone).map((tab) => {
              const on = current === tab.key;
              return (
                <li key={tab.key}>
                  <Link
                    href={tab.href}
                    aria-current={on ? 'page' : undefined}
                    className={
                      'flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium ' +
                      (on ? 'text-(--brand-text)' : 'text-(--text-faint)')
                    }
                  >
                    <TabIcon className={`h-[22px] w-[22px] ${on ? 'stroke-[2]' : ''}`}>
                      {tab.icon}
                    </TabIcon>
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
