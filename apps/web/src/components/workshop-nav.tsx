'use client';

import { can, humaniseRole, type Permission, type Role } from '@carnet/core';
import { cn } from '@carnet/ui';
import Link from 'next/link';
import { useLinkStatus } from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

/**
 * Workshop navigation.
 *
 * Grouped by what a person is doing rather than by which module a feature
 * lives in, and filtered by role: a bookkeeper never sees the diary, a
 * service advisor never sees the ledger. Items the role cannot reach are
 * absent, not greyed out — a disabled control is an invitation to ask why.
 */

interface Item {
  href: string;
  label: string;
  permission: Permission;
  badge?: number;
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
      { href: '/dashboard', label: 'Dashboard', permission: 'job:read' },
      { href: '/diary', label: 'Diary', permission: 'diary:read' },
      { href: '/jobs', label: 'Jobs', permission: 'job:read' },
      { href: '/customers', label: 'Customers', permission: 'customer:read' },
      { href: '/vehicles', label: 'Vehicles', permission: 'vehicle:read' },
    ],
  },
  {
    label: 'Money',
    items: [
      { href: '/invoices', label: 'Invoices', permission: 'invoice:read' },
      { href: '/payments', label: 'Payments', permission: 'payment:read' },
      { href: '/reports', label: 'Reports', permission: 'report:operational' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { href: '/parts', label: 'Parts', permission: 'inventory:read' },
      { href: '/suppliers', label: 'Suppliers', permission: 'inventory:read' },
      { href: '/purchasing', label: 'Purchasing', permission: 'purchase:request' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { href: '/ledger', label: 'Ledger', permission: 'ledger:read' },
      { href: '/financials', label: 'Statements', permission: 'report:financial' },
    ],
  },
  {
    label: 'Admin',
    items: [
      { href: '/settings', label: 'Settings', permission: 'settings:read' },
      { href: '/audit', label: 'Audit log', permission: 'audit:read' },
    ],
  },
];

export function WorkshopNav({
  role,
  orgName,
  userName,
  approvalsWaiting = 0,
}: {
  role: Role;
  orgName: string;
  userName: string;
  approvalsWaiting?: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  const visible = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(role, item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="workshop-nav"
        onClick={() => setOpen((value) => !value)}
        className="fixed left-3 top-3 z-40 grid h-10 w-10 place-items-center rounded-(--radius-md) border border-(--border) bg-(--surface) lg:hidden"
      >
        <span className="sr-only">{open ? 'Close navigation' : 'Open navigation'}</span>
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
          'fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-(--border) bg-(--surface)',
          'transition-transform lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label="Workshop"
      >
        <div className="flex items-center gap-2.5 border-b border-(--border) px-4 py-3.5 pl-14 lg:pl-4">
          <svg
            width="20"
            height="20"
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
          <div className="min-w-0">
            <p className="truncate font-display text-[14px] font-semibold leading-tight">
              {orgName}
            </p>
            <p className="truncate text-[11px] text-(--text-faint)">Carnet Workshop</p>
          </div>
        </div>

        <div className="scroll-x flex-1 overflow-y-auto px-2 py-3">
          {visible.map((group) => (
            <div key={group.label} className="mb-4 last:mb-0">
              <p className="eyebrow px-2 pb-1.5">{group.label}</p>
              <ul className="grid gap-0.5">
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
                          'flex items-center justify-between gap-2 rounded-(--radius-sm) px-2 py-1.5 text-[13px] transition-colors',
                          active
                            ? 'bg-(--brand-soft) font-medium text-(--brand-text)'
                            : 'text-(--text-soft) hover:bg-(--surface-sunk) hover:text-(--text)',
                        )}
                      >
                        <span className="relative">
                          {item.label}
                          <PendingRule />
                        </span>
                        {badge ? (
                          <span className="tabular rounded-full bg-(--warning-soft) px-1.5 text-[11px] font-semibold text-(--warning)">
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
          <p className="truncate text-[13px] font-medium">{userName}</p>
          <p className="text-[11px] text-(--text-faint)">{humaniseRole(role)}</p>
          <form action="/api/sign-out" method="post" className="mt-2">
            <button
              type="submit"
              className="text-[12px] text-(--text-faint) underline underline-offset-2 hover:text-(--text)"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>

      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-20 bg-(--overlay) lg:hidden"
        />
      ) : null}
    </>
  );
}
