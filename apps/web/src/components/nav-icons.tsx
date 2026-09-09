import * as React from 'react';

/**
 * Navigation icons.
 *
 * Line art on a 20px grid at 1.5 stroke, drawn to the same weight as the type
 * beside it. Each one is the object it names rather than a generic symbol: the
 * diary is a calendar, jobs is a clipboard, vehicles is a car. An icon set
 * where half the entries are abstract shapes is worse than no icons, because
 * the reader has to learn a vocabulary to save themselves reading a word.
 *
 * They exist to make the sidebar scannable at a glance and to give the
 * collapsed rail something to show. The label always stays.
 */

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

export type NavIconName =
  | 'dashboard'
  | 'diary'
  | 'jobs'
  | 'customers'
  | 'vehicles'
  | 'invoices'
  | 'payments'
  | 'reports'
  | 'parts'
  | 'suppliers'
  | 'purchasing'
  | 'transfers'
  | 'people'
  | 'sites'
  | 'ledger'
  | 'statements'
  | 'settings'
  | 'audit';

const PATHS: Record<NavIconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="2.6" y="2.6" width="6.2" height="6.2" rx="1.2" />
      <rect x="11.2" y="2.6" width="6.2" height="4" rx="1.2" />
      <rect x="2.6" y="11.2" width="6.2" height="6.2" rx="1.2" />
      <rect x="11.2" y="8.8" width="6.2" height="8.6" rx="1.2" />
    </>
  ),
  diary: (
    <>
      <rect x="2.8" y="4.2" width="14.4" height="13" rx="1.6" />
      <path d="M2.8 8.2h14.4M6.6 2.6v3M13.4 2.6v3" />
    </>
  ),
  jobs: (
    <>
      <path d="M7 3.6H5.4A1.4 1.4 0 0 0 4 5v11.4a1.4 1.4 0 0 0 1.4 1.4h9.2a1.4 1.4 0 0 0 1.4-1.4V5a1.4 1.4 0 0 0-1.4-1.4H13" />
      <rect x="7" y="2.2" width="6" height="2.8" rx="0.9" />
      <path d="M7.4 9.6h5.2M7.4 12.8h3.4" />
    </>
  ),
  customers: (
    <>
      <circle cx="8" cy="6.8" r="2.9" />
      <path d="M2.9 16.6a5.1 5.1 0 0 1 10.2 0" />
      <path d="M13.6 4.4a2.7 2.7 0 0 1 0 5M15.4 16.6a4.6 4.6 0 0 0-1.8-3.6" />
    </>
  ),
  vehicles: (
    <>
      <path d="M3 12.4h14M4.4 12.4V9.2l1.7-3.5a1.4 1.4 0 0 1 1.26-.8h5.28a1.4 1.4 0 0 1 1.26.8l1.7 3.5v3.2" />
      <path d="M3.4 12.4v2.4h2.2v-2.4M14.4 12.4v2.4h2.2v-2.4" />
      <circle cx="6.6" cy="10.4" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="13.4" cy="10.4" r="0.85" fill="currentColor" stroke="none" />
    </>
  ),
  invoices: (
    <>
      <path d="M4.4 2.8h11.2v14.4l-2.24-1.4-2.24 1.4-2.24-1.4-2.24 1.4-2.24-1.4z" />
      <path d="M7.4 7h5.2M7.4 10.4h3.4" />
    </>
  ),
  payments: (
    <>
      <rect x="2.4" y="5" width="15.2" height="10" rx="1.6" />
      <path d="M2.4 8.6h15.2M5.6 12h2.8" />
    </>
  ),
  reports: (
    <>
      <path d="M3.2 16.8h13.6" />
      <path d="M5.6 16.8V9.4M9.4 16.8V4.8M13.2 16.8v-4.6M17 16.8V7.6" />
    </>
  ),
  parts: (
    <>
      <path d="M10 2.6 17 6.4v7.2L10 17.4 3 13.6V6.4z" />
      <path d="M3 6.4 10 10.2l7-3.8M10 10.2v7.2" />
    </>
  ),
  suppliers: (
    <>
      <path d="M2.6 8.4 10 3.4l7.4 5" />
      <path d="M4.4 9.6v7.2h11.2V9.6" />
      <path d="M8 16.8v-4.4h4v4.4" />
    </>
  ),
  purchasing: (
    <>
      <path d="M2.6 3.4h2.2l2 9.6h8.4" />
      <path d="M6.2 6.4h11l-1.4 5.2H7.2" />
      <circle cx="8.4" cy="16" r="1.2" />
      <circle cx="14.6" cy="16" r="1.2" />
    </>
  ),
  transfers: (
    <>
      <path d="M3 6.6h9.4M9.6 3.8 12.4 6.6 9.6 9.4" />
      <path d="M17 13.4H7.6M10.4 10.6 7.6 13.4l2.8 2.8" />
    </>
  ),
  people: (
    <>
      <circle cx="10" cy="6.2" r="2.8" />
      <path d="M4.6 16.8a5.4 5.4 0 0 1 10.8 0" />
      <path d="M4.2 9.2a2 2 0 1 0 0-4M15.8 5.2a2 2 0 1 1 0 4" />
    </>
  ),
  sites: (
    <>
      <path d="M4.6 17V8.2l4-2.8 4 2.8V17" />
      <path d="M12.6 17V10.6l3.4-2v8.4M2.6 17h14.8" />
      <path d="M7.4 11.4h2.4M7.4 14.2h2.4" />
    </>
  ),
  ledger: (
    <>
      <path d="M4.2 3.4h9.6a1.6 1.6 0 0 1 1.6 1.6v11.6H5.8a1.6 1.6 0 0 1-1.6-1.6z" />
      <path d="M7.2 3.4v13.2M9.8 7.2h3.4M9.8 10.4h3.4" />
    </>
  ),
  statements: (
    <>
      <path d="M10 2.8a7.2 7.2 0 1 0 7.2 7.2H10z" />
      <path d="M12.6 2.6a5.6 5.6 0 0 1 4.6 4.6h-4.6z" />
    </>
  ),
  settings: (
    <>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M15.6 12.2a1.3 1.3 0 0 0 .26 1.43l.05.05a1.55 1.55 0 1 1-2.2 2.2l-.05-.05a1.3 1.3 0 0 0-1.43-.26 1.3 1.3 0 0 0-.79 1.19v.14a1.55 1.55 0 1 1-3.1 0v-.07a1.3 1.3 0 0 0-.85-1.19 1.3 1.3 0 0 0-1.43.26l-.05.05a1.55 1.55 0 1 1-2.2-2.2l.05-.05a1.3 1.3 0 0 0 .26-1.43 1.3 1.3 0 0 0-1.19-.79h-.14a1.55 1.55 0 1 1 0-3.1h.07a1.3 1.3 0 0 0 1.19-.85 1.3 1.3 0 0 0-.26-1.43l-.05-.05a1.55 1.55 0 1 1 2.2-2.2l.05.05a1.3 1.3 0 0 0 1.43.26h.06a1.3 1.3 0 0 0 .79-1.19v-.14a1.55 1.55 0 1 1 3.1 0v.07a1.3 1.3 0 0 0 .79 1.19 1.3 1.3 0 0 0 1.43-.26l.05-.05a1.55 1.55 0 1 1 2.2 2.2l-.05.05a1.3 1.3 0 0 0-.26 1.43v.06a1.3 1.3 0 0 0 1.19.79h.14a1.55 1.55 0 1 1 0 3.1h-.07a1.3 1.3 0 0 0-1.19.79z" />
    </>
  ),
  audit: (
    <>
      <path d="M10 2.4 3.6 5v4.8c0 3.9 2.6 6.9 6.4 7.8 3.8-.9 6.4-3.9 6.4-7.8V5z" />
      <path d="m7.4 9.8 1.9 1.9 3.5-3.6" />
    </>
  ),
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  return (
    <svg {...base} className={className}>
      {PATHS[name]}
    </svg>
  );
}
