'use client';

import { can, humaniseRole, type Language, type Role, translator } from '@carnet/core';
import { cn } from '@carnet/ui';
import Link from 'next/link';
import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { useT } from '@/components/language-provider';
import { navigationFor } from '@/lib/navigation';

import { NavIcon } from './nav-icons';
import { ThemeToggle } from './theme-toggle';

/**
 * Workshop navigation: the drawing of it.
 *
 * What each person is shown lives in `@/lib/navigation`, written per role in
 * the order that role works in — an advisor opens on **Today** and ends at
 * **Payments**, an owner on **Dashboard** and ends at **Settings**. This file
 * renders that and nothing else, so what `verify-navigation.ts` reads is what
 * a person sees. Phase 80.
 *
 * Filtered again here by permission, which is belt and braces: the check
 * refuses a role an entry they could not open, and this refuses it a second
 * time at the moment of drawing. Items a role cannot reach are absent, not
 * greyed out — a disabled control is an invitation to ask why, and the answer
 * is never satisfying.
 *
 * The active item is marked by a brass rule against the panel edge rather than
 * by a filled pill. A workshop screen is open all day and the sidebar is
 * furniture: it should be legible at a glance and quiet the rest of the time.
 */

/**
 * Feedback on the item that was clicked, for the interval between the click
 * and the next page arriving. `loading.tsx` covers the content area; this
 * covers the sidebar, so the answer to "did that register?" is on the thing
 * the person actually pressed.
 */
function PendingRule() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="nav-pending" /> : null;
}

/**
 * The workshop's name at the top of the navigation, and — for somebody on
 * more than one team — the way to the chooser.
 *
 * A link rather than a menu on purpose. A menu here would have to hold the
 * list, which means loading every workshop into every page's navigation for
 * the sake of the few people who have two; the chooser already exists, knows
 * how to ask, and is one press away.
 */
function Identity({
  as,
  initials,
  orgName,
  subtitle,
}: {
  as: 'link' | 'plain';
  initials: string;
  orgName: string;
  subtitle: string;
}) {
  const inside = (
    <>
      <span
        aria-hidden
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-(--radius-md)',
          'bg-(--brand-solid) font-display text-[13px] font-bold tracking-tight',
          'text-(--on-brand-solid) shadow-sm',
        )}
      >
        {initials}
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-[14px] font-semibold leading-tight">{orgName}</p>
        <p className="truncate text-[11px] text-(--text-faint)">{subtitle}</p>
      </div>
    </>
  );

  const frame = 'flex items-center gap-3 border-b border-(--border) px-4 py-4 ps-16 lg:ps-4';

  if (as === 'plain') return <div className={frame}>{inside}</div>;

  return (
    <Link href="/choose" className={cn(frame, 'w-full text-start hover:bg-(--surface-sunken)')}>
      {inside}
    </Link>
  );
}

export function WorkshopNav({
  role,
  orgName,
  belongings = 1,
  userName,
  approvalsWaiting = 0,
  language,
  unreadNotifications = 0,
}: {
  /** Unread notifications for this person. Phase 39. */
  unreadNotifications?: number;
  role: Role;
  orgName: string;
  /**
   * How many workshops this person is on the team of. Phase 63, FR-108.
   *
   * A count rather than the list: the nav only needs to know whether there is
   * anywhere to go, and the chooser is the page that names them. One workshop
   * shows a name, as it always has; more than one makes that name the way
   * out, which is where somebody looks for it.
   */
  belongings?: number;
  userName: string;
  approvalsWaiting?: number;
  /** The person's language; labels are translated on the way out. Phase 37.5. */
  language?: Language;
}) {
  const fromContext = useT();
  const t = React.useMemo(
    () => (language ? translator(language) : fromContext),
    [language, fromContext],
  );
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const visible = navigationFor(role)
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => can(role, item.permission)),
    }))
    .filter((section) => section.items.length > 0);

  const initials = orgName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="workshop-nav"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'fixed start-3 top-3 z-40 grid h-11 w-11 place-items-center lg:hidden',
          'rounded-(--radius-md) border border-(--border) bg-(--surface) shadow-sm',
          'transition-colors hover:bg-(--surface-sunk)',
        )}
      >
        <span className="sr-only">{open ? t('Close navigation') : t('Open navigation')}</span>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path
            d={open ? 'M4 4l10 10M14 4L4 14' : 'M2 5h14M2 9h14M2 13h14'}
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <nav
        id="workshop-nav"
        className={cn(
          'fixed inset-y-0 start-0 z-30 flex w-64 flex-col border-e border-(--border)',
          'bg-(--surface) transition-transform lg:translate-x-0 lg:rtl:translate-x-0',
          open ? 'translate-x-0 shadow-lg' : '-translate-x-full rtl:translate-x-full',
        )}
        aria-label={t('Workshop')}
      >
        {/* Identity. The mark is the workshop's initials rather than a stock
            glyph, so somebody with two tabs open knows which is which — and
            for somebody on two teams it is also the way between them, because
            the name of where you are is where you look to leave (Phase 63). */}
        <Identity
          as={belongings > 1 ? 'link' : 'plain'}
          initials={initials}
          orgName={orgName}
          subtitle={belongings > 1 ? t('Switch workshop') : t('Carnet Workshop')}
        />

        {/* One box for anything: a plate, a VIN, a phone number, a job,
            an invoice, a part. Phase 39. */}
        <div className="flex items-center gap-2 border-b border-(--border) px-3 py-3">
          <form action="/search" method="get" role="search" className="min-w-0 flex-1">
            <label htmlFor="nav-search" className="sr-only">
              {t('Search')}
            </label>
            <input
              id="nav-search"
              name="q"
              type="search"
              placeholder={t('Plate, VIN, phone, job, invoice, part')}
              className="h-9 w-full rounded-(--radius-md) border border-(--border-strong) bg-(--surface-sunk) px-3 text-[13px] placeholder:text-(--text-faint)"
            />
          </form>
          <Link
            href="/notifications"
            aria-label={t('Notifications')}
            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-(--radius-md) border border-(--border) hover:bg-(--surface-sunk) pointer-coarse:h-10 pointer-coarse:w-10"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M10 2.5a5 5 0 0 0-5 5v3.2L3.5 13.5h13L15 10.7V7.5a5 5 0 0 0-5-5ZM8 16a2 2 0 0 0 4 0"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            {unreadNotifications > 0 ? (
              <span className="absolute -end-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-(--danger) px-1 text-[11px] font-semibold text-white">
                {unreadNotifications > 99 ? '99+' : unreadNotifications}
              </span>
            ) : null}
          </Link>
        </div>

        <div className="scroll-x flex-1 overflow-y-auto px-3 py-4">
          {visible.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              <p className="eyebrow px-2 pb-2">{t(group.label)}</p>
              <ul className="grid gap-px">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const badge =
                    item.href === '/jobs' && approvalsWaiting > 0 ? approvalsWaiting : undefined;

                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group relative flex items-center gap-2.5 rounded-(--radius-md)',
                          'px-2.5 py-2 text-[13px] transition-colors duration-150',
                          'pointer-coarse:min-h-10',
                          active
                            ? 'bg-(--brand-soft) font-medium text-(--brand-text)'
                            : 'text-(--text-soft) hover:bg-(--surface-sunk) hover:text-(--text)',
                        )}
                      >
                        {/* Brass rule against the panel edge. Reads as a
                            position in a list rather than as a button. */}
                        <span
                          aria-hidden
                          className={cn(
                            'absolute -start-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-e-full',
                            'transition-all duration-150',
                            active
                              ? 'bg-(--accent) opacity-100'
                              : 'bg-(--border-strong) opacity-0 group-hover:opacity-60',
                          )}
                        />

                        <NavIcon
                          name={item.icon}
                          className={cn(
                            'shrink-0 transition-colors',
                            active
                              ? 'text-(--brand)'
                              : 'text-(--text-faint) group-hover:text-(--text-soft)',
                          )}
                        />

                        <span className="relative flex-1 truncate">
                          {t(item.label)}
                          <PendingRule />
                        </span>

                        {badge ? (
                          <span
                            className={cn(
                              'tabular shrink-0 rounded-full px-1.5 py-px text-[11px] font-semibold',
                              'bg-(--warning-soft) text-(--warning)',
                            )}
                          >
                            {badge}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-(--border) p-3">
          <div className="flex items-center gap-2.5 rounded-(--radius-md) bg-(--surface-sunk) px-2.5 py-2">
            <span
              aria-hidden
              className={cn(
                'grid h-8 w-8 shrink-0 place-items-center rounded-full',
                'bg-(--surface) text-[11px] font-semibold text-(--text-soft)',
                'ring-1 ring-(--border)',
              )}
            >
              {userName
                .split(/\s+/)
                .slice(0, 2)
                .map((word) => word[0])
                .join('')
                .toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight">{userName}</p>
              <p className="truncate text-[11px] text-(--text-faint)">{t(humaniseRole(role))}</p>
            </div>
            <form action="/api/sign-out" method="post">
              <button
                type="submit"
                title={t('Sign out')}
                className={cn(
                  'grid h-7 w-7 place-items-center rounded-(--radius-sm)',
                  'text-(--text-faint) transition-colors hover:bg-(--surface) hover:text-(--danger)',
                )}
              >
                <span className="sr-only">{t('Sign out')}</span>
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M8 17H4.6A1.6 1.6 0 0 1 3 15.4V4.6A1.6 1.6 0 0 1 4.6 3H8" />
                  <path d="m12.8 13.4 3.4-3.4-3.4-3.4M16.2 10H7.6" />
                </svg>
              </button>
            </form>
          </div>

          <ThemeToggle className="mt-2 w-full" />
        </div>
      </nav>

      {open ? (
        <button
          type="button"
          aria-label={t('Close navigation')}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-(--overlay) lg:hidden"
        />
      ) : null}
    </>
  );
}
