import * as React from 'react';

import { cn } from './cn';

/* ===========================================================================
   Data display.

   A workshop system is scanned, not read. These components exist to make the
   thing that needs attention visible before the thing that does not.
   =========================================================================== */

/**
 * Wide tables scroll inside their own container so the page body never
 * scrolls sideways.
 */
export function TableWrap({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'scroll-x rounded-(--radius-lg) border border-(--border) bg-(--surface)',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-[13px]', className)} {...props} />;
}

export function Th({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        'sticky top-0 z-10 whitespace-nowrap border-b border-(--border) bg-(--surface-sunk)',
        'px-3 py-2 text-left font-mono text-[10px] font-semibold uppercase tracking-wider',
        'text-(--text-faint)',
        numeric && 'text-right',
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        'border-b border-(--border) px-3 py-2.5 align-middle',
        // The wrapper scrolls horizontally, so wrapping buys nothing and costs
        // a consistent row height. Pages opt back in with `whitespace-normal`.
        'whitespace-nowrap',
        numeric && 'text-right tabular',
        className,
      )}
      {...props}
    />
  );
}

export function Tr({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & { interactive?: boolean }) {
  return (
    <tr
      className={cn(
        'last:[&>td]:border-b-0 transition-colors hover:bg-(--surface-sunk)',
        interactive && 'cursor-pointer',
        className,
      )}
      {...props}
    />
  );
}

/**
 * A dashboard figure. Every tile links somewhere, because a number the owner
 * cannot act on is decoration (FR-1402, persona P1).
 */
export function StatTile({
  label,
  value,
  note,
  tone = 'neutral',
  className,
}: {
  label: string;
  value: React.ReactNode;
  note?: React.ReactNode;
  tone?: 'neutral' | 'brand' | 'warning' | 'danger' | 'success';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 bg-(--surface) p-4 transition-colors',
        'group-hover:bg-(--surface-sunk)',
        className,
      )}
    >
      <span className="eyebrow">{label}</span>
      <span
        className={cn(
          'font-display text-[28px] font-semibold leading-none tabular',
          tone === 'brand' && 'text-(--brand-text)',
          tone === 'warning' && 'text-(--warning)',
          tone === 'danger' && 'text-(--danger)',
          tone === 'success' && 'text-(--success)',
        )}
      >
        {value}
      </span>
      {note ? <span className="text-[12px] text-(--text-faint)">{note}</span> : null}
    </div>
  );
}

/**
 * A row of tiles sharing one border, so they read as one object rather than
 * four floating cards.
 */
export function StatRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-(--radius-lg) border border-(--border) bg-(--border)',
        'grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))]',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Label and value pairs, as used on the vehicle and customer detail pages. */
export function KeyValue({
  items,
  columns = 2,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  columns?: 1 | 2 | 3;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-3',
        columns === 1 && 'grid-cols-1',
        columns === 2 && 'grid-cols-1 sm:grid-cols-2',
        columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="eyebrow mb-0.5">{item.label}</dt>
          <dd className="text-[13px] leading-snug break-words">
            {item.value ?? <span className="text-(--text-faint)">Not recorded</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Diary utilisation. An under-booked day is as much of a problem as an
 * over-booked one, so both ends of the scale are marked.
 */
export function UtilisationBar({
  bookedHours,
  capacityHours,
  state,
  className,
}: {
  bookedHours: number;
  capacityHours: number;
  state: 'empty' | 'light' | 'healthy' | 'full' | 'over';
  className?: string;
}) {
  const pct = capacityHours > 0 ? Math.min(100, (bookedHours / capacityHours) * 100) : 0;

  const colour = {
    empty: 'bg-(--border-strong)',
    light: 'bg-(--info)',
    healthy: 'bg-(--success)',
    full: 'bg-(--warning)',
    over: 'bg-(--danger)',
  }[state];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--surface-sunk)"
        role="meter"
        aria-valuenow={Math.round(bookedHours)}
        aria-valuemin={0}
        aria-valuemax={Math.round(capacityHours)}
        aria-label="Workshop capacity used"
      >
        <div className={cn('h-full rounded-full', colour)} style={{ width: `${pct}%` }} />
      </div>
      <span className="datum shrink-0 text-[11px] text-(--text-faint)">
        {bookedHours.toFixed(1)}/{capacityHours.toFixed(0)}h
      </span>
    </div>
  );
}

/** Simple tab strip, matching the contextual sub-navigation pattern. */
export function TabStrip({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn('scroll-x -mb-px flex gap-1 border-b border-(--border)', className)}
      role="tablist"
    >
      {children}
    </div>
  );
}

export function Tab({
  active,
  className,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { active?: boolean }) {
  return (
    <a
      role="tab"
      aria-selected={active}
      className={cn(
        'whitespace-nowrap border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
        active
          ? 'border-(--brand) text-(--text)'
          : 'border-transparent text-(--text-faint) hover:text-(--text)',
        className,
      )}
      {...props}
    />
  );
}

/* ===========================================================================
   Loading

   Skeletons exist so a click produces a change on screen within a frame. The
   shapes match the real layout closely enough that nothing jumps when the
   content lands — a skeleton that reflows on arrival is worse than a spinner.
   =========================================================================== */

export function Skeleton({
  className,
  width,
}: {
  className?: string;
  /** Convenience for the common case of a text line of a given width. */
  width?: string;
}) {
  return (
    <span className={cn('skeleton block h-4', className)} style={width ? { width } : undefined} />
  );
}

/** Placeholder matching StatRow, so the header does not jump on arrival. */
export function StatRowSkeleton({ tiles = 4 }: { tiles?: number }) {
  return (
    <StatRow>
      {Array.from({ length: tiles }, (_, index) => (
        <div key={index} className="flex flex-col gap-2 bg-(--surface) p-4">
          <Skeleton className="h-2.5" width="4.5rem" />
          <Skeleton className="h-6" width="6rem" />
          <Skeleton className="h-2.5" width="5.5rem" />
        </div>
      ))}
    </StatRow>
  );
}

/** Placeholder matching a Card wrapping a table. */
export function TableSkeleton({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-(--radius-lg) border border-(--border) bg-(--surface)">
      <div className="border-b border-(--border) px-4 py-3">
        <Skeleton className="h-3.5" width="9rem" />
        <Skeleton className="mt-1.5 h-2.5" width="14rem" />
      </div>
      <div className="divide-y divide-(--border)">
        {Array.from({ length: rows }, (_, row) => (
          <div
            key={row}
            className="flex items-center gap-4 px-4 py-3"
            style={{ opacity: 1 - row * 0.1 }}
          >
            {Array.from({ length: columns }, (_, column) => (
              <Skeleton
                key={column}
                className="h-3.5 flex-1"
                width={column === 0 ? '30%' : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
