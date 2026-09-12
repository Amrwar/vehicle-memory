import * as React from 'react';

import { cn } from './cn';

/**
 * The passport as a document. Phase 23.
 *
 * Every piece here is a part of a physical passport: the cover with its foil
 * emblem, the identity page with a photograph window and a machine-readable
 * zone, the stamps a border officer would press on a visa page, and the seal
 * that says the document is intact. None of it is decoration for its own
 * sake; each part carries a fact about the vehicle, and the page reads the
 * same in black and white, with the images off, or through a screen reader.
 *
 * Server-safe: no hooks, no browser APIs. The booklet that opens lives in the
 * app, because it needs a pointer.
 */

/* ------------------------------------------------------------- the emblem */

/** A wheel inside a laurel: the device on the cover and the seal. */
export function PassportEmblem({ size = 72, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className={cn('passport-foil-stroke', className)}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* laurel */}
      {Array.from({ length: 9 }, (_, index) => {
        const angle = -150 + index * 16;
        const rad = (angle * Math.PI) / 180;
        const x = 50 + 42 * Math.cos(rad);
        const y = 58 + 42 * Math.sin(rad);
        return (
          <g key={`l${index}`} transform={`translate(${x} ${y}) rotate(${angle + 90})`}>
            <path d="M0 -7 C 4 -4, 4 4, 0 7 C -4 4, -4 -4, 0 -7 Z" />
          </g>
        );
      })}
      {Array.from({ length: 9 }, (_, index) => {
        const angle = -30 - index * 16;
        const rad = (angle * Math.PI) / 180;
        const x = 50 + 42 * Math.cos(rad);
        const y = 58 + 42 * Math.sin(rad);
        return (
          <g key={`r${index}`} transform={`translate(${x} ${y}) rotate(${angle + 90})`}>
            <path d="M0 -7 C 4 -4, 4 4, 0 7 C -4 4, -4 -4, 0 -7 Z" />
          </g>
        );
      })}
      {/* wheel */}
      <circle cx="50" cy="48" r="22" />
      <circle cx="50" cy="48" r="15.5" />
      <circle cx="50" cy="48" r="4" className="passport-foil-fill" />
      {Array.from({ length: 8 }, (_, index) => {
        const rad = (index * 45 * Math.PI) / 180;
        return (
          <line
            key={`s${index}`}
            x1={50 + 4.5 * Math.cos(rad)}
            y1={48 + 4.5 * Math.sin(rad)}
            x2={50 + 15 * Math.cos(rad)}
            y2={48 + 15 * Math.sin(rad)}
          />
        );
      })}
      {/* the road under it */}
      <path d="M22 88 Q 50 80 78 88" />
    </svg>
  );
}

/* -------------------------------------------------------------- the cover */

export function PassportCover({
  title = 'Vehicle Passport',
  issuer = 'Carnet',
  footer,
  className,
  children,
}: {
  title?: string;
  issuer?: string;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn('passport-cover flex flex-col items-center justify-between p-6', className)}>
      <p className="passport-foil-text text-[13px]">{issuer}</p>
      <div className="grid place-items-center gap-4">
        <PassportEmblem size={104} />
        <p className="passport-foil-text text-center text-[22px] leading-tight">{title}</p>
      </div>
      <div className="grid place-items-center gap-1 text-center">
        {children}
        {footer ?? (
          <p className="passport-foil-text text-[10px] opacity-80">
            A record that belongs to the car
          </p>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- a page */

export function PassportPage({
  number,
  heading,
  bound = true,
  className,
  children,
}: {
  /** The page number printed in the corner, as passports do. */
  number?: number;
  heading?: React.ReactNode;
  bound?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn('passport-page passport-document', bound && 'passport-page-bound', className)}
    >
      {heading ? (
        <header className="flex items-baseline justify-between gap-3 border-b border-(--passport-paper-edge) px-6 pt-4 pb-2 sm:px-8">
          <h2 className="passport-foil-text text-[14px]" style={{ color: 'var(--passport-ink)' }}>
            {heading}
          </h2>
          {number !== undefined ? (
            <span className="passport-label" aria-label={`Page ${number}`}>
              {String(number).padStart(2, '0')}
            </span>
          ) : null}
        </header>
      ) : null}
      <div className="px-6 py-5 sm:px-8">{children}</div>
    </section>
  );
}

/* -------------------------------------------------------- identity fields */

export interface PassportField {
  label: string;
  value: React.ReactNode;
  /** Let a long value take the whole row. */
  wide?: boolean;
}

export function PassportFields({
  fields,
  className,
}: {
  fields: PassportField[];
  className?: string;
}) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {fields.map((field) => (
        <div key={field.label} className={cn('grid gap-0.5', field.wide && 'sm:col-span-2')}>
          <dt className="passport-label">{field.label}</dt>
          <dd className="passport-value break-words">{field.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The photograph window. Whatever goes inside sits behind the passport's own frame. */
export function PassportPhoto({
  caption,
  className,
  children,
}: {
  caption?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className={cn('grid gap-1.5', className)}>
      <div className="passport-photo aspect-[4/5] overflow-hidden">{children}</div>
      {caption ? <figcaption className="passport-label text-center">{caption}</figcaption> : null}
    </figure>
  );
}

/** The two lines at the foot of the identity page. */
export function PassportMrz({ lines, className }: { lines: [string, string]; className?: string }) {
  return (
    <div
      className={cn('passport-mrz px-6 py-3 sm:px-8', className)}
      aria-label="Machine readable zone"
    >
      <div>{lines[0]}</div>
      <div>{lines[1]}</div>
    </div>
  );
}

/* --------------------------------------------------------------- stamps */

export type StampInk = 'verified' | 'recorded' | 'owner' | 'alert' | 'cancel';

/** Which ink a verification level is stamped in. Colour never alone: the label says it too. */
export function inkFor(
  verification: string,
  options: { alert?: boolean; cancelled?: boolean } = {},
): StampInk {
  if (options.cancelled) return 'cancel';
  if (options.alert) return 'alert';
  if (verification === 'WORKSHOP_VERIFIED' || verification === 'AUTHORITY_VERIFIED')
    return 'verified';
  if (verification === 'WORKSHOP_RECORDED') return 'recorded';
  return 'owner';
}

export function PassportStamp({
  ink,
  authority,
  kind,
  date,
  title,
  detail,
  odometer,
  cancelled = false,
  tilt = 0,
  className,
}: {
  ink: StampInk;
  /** Who pressed it: the workshop, the owner, an authority. */
  authority: string;
  /** What kind of entry: service, part fitted, transfer. */
  kind: string;
  date: string;
  title: string;
  detail?: string | null;
  odometer?: string | null;
  cancelled?: boolean;
  /** Degrees. Deterministic per entry, never random on render. */
  tilt?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'passport-stamp grid gap-1',
        cancelled && 'passport-stamp-cancelled',
        className,
      )}
      data-ink={ink}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="passport-stamp-title">{authority}</span>
        <span className="font-mono text-[11px] tracking-[0.08em] uppercase">{date}</span>
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase opacity-80">
          {kind}
        </span>
        {odometer ? (
          <span className="font-mono text-[11px] tracking-[0.06em]">{odometer}</span>
        ) : null}
      </div>
      <p className="font-sans text-[13px] leading-snug" style={{ color: 'var(--passport-ink)' }}>
        {title}
      </p>
      {detail ? (
        <p
          className="font-sans text-[12px] leading-snug"
          style={{ color: 'var(--passport-ink-soft)' }}
        >
          {detail}
        </p>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------------- seal */

export function PassportSeal({
  intact,
  head,
  className,
}: {
  intact: boolean;
  /** The chain head, shortened, printed on the seal. */
  head: string | null;
  className?: string;
}) {
  return (
    <div className={cn('grid place-items-center gap-1.5', className)}>
      <div
        className="passport-seal"
        data-state={intact ? 'intact' : 'broken'}
        role="img"
        aria-label={intact ? 'Seal: history intact' : 'Seal: history broken'}
      >
        <span className="passport-seal-ring" aria-hidden />
        <PassportEmblem size={44} className="[&_*]:stroke-current" />
      </div>
      <p
        className="passport-label text-center"
        style={{ color: intact ? 'var(--passport-stamp-verified)' : 'var(--passport-stamp-alert)' }}
      >
        {intact ? 'History intact' : 'History broken'}
      </p>
      {head ? (
        <p
          className="font-mono text-[10px] tracking-[0.12em] uppercase"
          style={{ color: 'var(--passport-ink-faint)' }}
        >
          {head.slice(0, 4)}-{head.slice(4, 8)}
        </p>
      ) : null}
    </div>
  );
}

/** A deterministic tilt for a stamp, so the page looks pressed by hand and renders the same twice. */
export function stampTilt(seed: string): number {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  return ((hash % 7) - 3) * 0.9;
}
