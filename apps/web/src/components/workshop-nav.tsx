'use client';

import {
  can,
  humaniseRole,
  type Language,
  type Permission,
  type Role,
  translate,
} from '@carnet/core';
import { cn } from '@carnet/ui';
import Link from 'next/link';
import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { NavIcon, type NavIconName } from './nav-icons';
import { ThemeToggle } from './theme-toggle';

/**
 * Workshop navigation.
 *
 * Grouped by what a person is doing rather than by which module a feature
 * lives in, and filtered by role: a bookkeeper never sees the diary, a
 * service advisor never sees the ledger. Items the role cannot reach are
 * absent, not greyed out — a disabled control is an invitation to ask why.
 *
 * The active item is marked by a brass rule against the panel edge rather than
 * by a filled pill. A workshop screen is open all day and the sidebar is
 * furniture: it should be legible at a glance and quiet the rest of the time.
 */

interface Item {
  href: string;
  label: string;
  icon: NavIconName;
  permission: Permission;
}

interface Group {
  label: string;
  items: Item[];
}

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

const GROUPS: Group[] = [
  {
    label: 'Workshop',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', permission: 'job:read' },
      { href: '/ask', label: 'Ask', icon: 'ask', permission: 'report:operational' },
      { href: '/diary', label: 'Diary', icon: 'diary', permission: 'diary:read' },
      { href: '/floor', label: 'The floor', icon: 'floor', permission: 'diary:read' },
      { href: '/jobs', label: 'Jobs', icon: 'jobs', permission: 'job:read' },
      { href: '/inspections', label: 'Inspections', icon: 'inspections', permission: 'job:read' },
      { href: '/warranty', label: 'Warranty', icon: 'warranty', permission: 'job:read' },
      { href: '/recalls', label: 'Recalls', icon: 'recalls', permission: 'vehicle:read' },
      { href: '/capacity', label: 'Capacity', icon: 'capacity', permission: 'diary:read' },
      { href: '/plan', label: 'Plan the day', icon: 'plan', permission: 'diary:read' },
      { href: '/skills', label: 'Skills', icon: 'skills', permission: 'people:read' },
      { href: '/customers', label: 'Customers', icon: 'customers', permission: 'customer:read' },
      { href: '/vehicles', label: 'Vehicles', icon: 'vehicles', permission: 'vehicle:read' },
      { href: '/passports', label: 'Passports', icon: 'passports', permission: 'vehicle:read' },
      { href: '/reminders', label: 'Reminders', icon: 'reminders', permission: 'customer:read' },
      { href: '/crm', label: 'Relationships', icon: 'crm', permission: 'customer:read' },
      { href: '/fleet', label: 'Fleets', icon: 'fleet', permission: 'customer:read' },
      { href: '/reputation', label: 'Reputation', icon: 'reputation', permission: 'customer:read' },
      { href: '/inbox', label: 'Conversations', icon: 'inbox', permission: 'customer:read' },
      {
        href: '/claims',
        label: 'Vehicle requests',
        icon: 'claims',
        permission: 'customer:read',
      },
    ],
  },
  {
    label: 'Money',
    items: [
      { href: '/estimates', label: 'Estimates', icon: 'estimates', permission: 'estimate:read' },
      { href: '/invoices', label: 'Invoices', icon: 'invoices', permission: 'invoice:read' },
      { href: '/payments', label: 'Payments', icon: 'payments', permission: 'payment:read' },
      { href: '/gift-cards', label: 'Gift cards', icon: 'giftcards', permission: 'payment:read' },
      { href: '/payables', label: 'Suppliers owed', icon: 'payables', permission: 'ledger:read' },
      { href: '/reports', label: 'Reports', icon: 'reports', permission: 'report:operational' },
      {
        href: '/reports/business',
        label: 'Business',
        icon: 'business',
        permission: 'report:operational',
      },
      { href: '/insights', label: 'Insights', icon: 'insights', permission: 'report:operational' },
      { href: '/counter', label: 'Counter', icon: 'counter', permission: 'invoice:write' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/parts', label: 'Parts', icon: 'parts', permission: 'inventory:read' },
      { href: '/suppliers', label: 'Suppliers', icon: 'suppliers', permission: 'inventory:read' },
      {
        href: '/purchasing',
        label: 'Purchasing',
        icon: 'purchasing',
        permission: 'purchase:request',
      },
      { href: '/transfers', label: 'Transfers', icon: 'transfers', permission: 'stock:transfer' },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/people', label: 'People', icon: 'people', permission: 'people:read' },
      { href: '/payroll', label: 'Payroll', icon: 'payroll', permission: 'payroll:read' },
      { href: '/group', label: 'Sites', icon: 'sites', permission: 'report:financial' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/ledger', label: 'Ledger', icon: 'ledger', permission: 'ledger:read' },
      { href: '/expenses', label: 'Expenses', icon: 'expenses', permission: 'report:financial' },
      { href: '/banking', label: 'Banking', icon: 'banking', permission: 'ledger:read' },
      {
        href: '/financials',
        label: 'Statements',
        icon: 'statements',
        permission: 'report:financial',
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/settings', label: 'Settings', icon: 'settings', permission: 'settings:read' },
      { href: '/settings/team', label: 'Team', icon: 'team', permission: 'settings:read' },
      { href: '/automation', label: 'Automation', icon: 'automation', permission: 'settings:read' },
      { href: '/messages', label: 'Messages', icon: 'messages', permission: 'settings:read' },
      { href: '/audit', label: 'Audit log', icon: 'audit', permission: 'audit:read' },
    ],
  },
];

export function WorkshopNav({
  role,
  orgName,
  userName,
  approvalsWaiting = 0,
  language = 'en',
  unreadNotifications = 0,
}: {
  /** Unread notifications for this person. Phase 39. */
  unreadNotifications?: number;
  role: Role;
  orgName: string;
  userName: string;
  approvalsWaiting?: number;
  /** The person's language; labels are translated on the way out. Phase 37.5. */
  language?: Language;
}) {
  const t = (text: string) => translate(language, text);
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const visible = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(role, item.permission)),
  })).filter((group) => group.items.length > 0);

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
          'fixed left-3 top-3 z-40 grid h-11 w-11 place-items-center lg:hidden',
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
          'fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-(--border)',
          'bg-(--surface) transition-transform lg:translate-x-0',
          open ? 'translate-x-0 shadow-lg' : '-translate-x-full',
        )}
        aria-label="Workshop"
      >
        {/* Identity. The mark is the workshop's initials rather than a stock
            glyph, so somebody with two tabs open knows which is which. */}
        <div className="flex items-center gap-3 border-b border-(--border) px-4 py-4 pl-16 lg:pl-4">
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
            <p className="truncate font-display text-[14px] font-semibold leading-tight">
              {orgName}
            </p>
            <p className="truncate text-[11px] text-(--text-faint)">{t('Carnet Workshop')}</p>
          </div>
        </div>

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
            className="relative grid h-9 w-9 shrink-0 place-items-center rounded-(--radius-md) border border-(--border) hover:bg-(--surface-sunk)"
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
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-(--danger) px-1 text-[10px] font-semibold text-white">
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
                            'absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full',
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
              <p className="truncate text-[11px] text-(--text-faint)">{humaniseRole(role)}</p>
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
