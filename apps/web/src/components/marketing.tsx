import { cn } from '@carnet/ui';
import Link from 'next/link';
import * as React from 'react';

/**
 * Marketing furniture.
 *
 * Shared between the home page and pricing so the two read as one site rather
 * than two pages that happen to share a palette. Everything here is a server
 * component: the front door has no state, and shipping JavaScript to render a
 * headline is how a marketing site ends up slower than the app behind it.
 */

export function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-30 border-b border-(--border) bg-(--surface)/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-display text-[17px] font-semibold tracking-tight">Carnet</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Sections">
          <NavLink href="/#how">How it works</NavLink>
          <NavLink href="/#passport">The passport</NavLink>
          <NavLink href="/pricing">Pricing</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <Link
              href="/dashboard"
              className={cn(
                'rounded-(--radius-md) bg-(--brand-solid) px-3.5 py-2 text-[13px] font-medium',
                'text-(--on-brand-solid) shadow-sm transition-colors hover:bg-(--brand-solid-hover)',
              )}
            >
              Open workshop
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-(--radius-md) px-3 py-2 text-[13px] text-(--text-soft) transition-colors hover:bg-(--surface-sunk) hover:text-(--text)"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={cn(
                  'rounded-(--radius-md) bg-(--brand-solid) px-3.5 py-2 text-[13px] font-medium',
                  'text-(--on-brand-solid) shadow-sm transition-colors hover:bg-(--brand-solid-hover)',
                )}
              >
                Start free
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-(--radius-sm) px-2.5 py-1.5 text-[13px] text-(--text-soft) transition-colors hover:bg-(--surface-sunk) hover:text-(--text)"
    >
      {children}
    </Link>
  );
}

export function Mark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className="text-(--brand)"
    >
      <circle cx="10" cy="10" r="8.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 4.6v5.4l3.4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-(--border) bg-(--surface)">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <Mark size={20} />
            <span className="font-display text-[15px] font-semibold">Carnet</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-(--text-soft)">
            Workshop management with a service history that belongs to the car, not to the garage
            that happened to write it.
          </p>
        </div>

        <FooterColumn
          title="Product"
          links={[
            { href: '/#how', label: 'How it works' },
            { href: '/#passport', label: 'The passport' },
            { href: '/#features', label: 'Features' },
            { href: '/pricing', label: 'Pricing' },
          ]}
        />
        <FooterColumn
          title="Try it"
          links={[
            { href: '/signup', label: 'Start a free trial' },
            { href: '/login', label: 'Sign in' },
            { href: '/p/demo-share-token', label: 'See a real passport' },
          ]}
        />
        <FooterColumn
          title="Contact"
          links={[
            { href: 'mailto:hefnyamr@rocketmail.com', label: 'hefnyamr@rocketmail.com' },
            { href: 'tel:+15145534360', label: '+1 514 553 4360' },
          ]}
        />
      </div>

      <div className="border-t border-(--border)">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-[12px] text-(--text-faint) sm:px-6">
          <p>Carnet is a working demonstration system. Figures shown are seeded data.</p>
          <p>Amr Hefny</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <p className="eyebrow mb-2.5">{title}</p>
      <ul className="grid gap-1.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-[13px] text-(--text-soft) transition-colors hover:text-(--text)"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A section heading with an eyebrow, used down the whole page. */
export function SectionHead({
  eyebrow,
  title,
  lede,
  align = 'left',
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  align?: 'left' | 'centre';
}) {
  return (
    <div className={cn('max-w-2xl', align === 'centre' && 'mx-auto text-center')}>
      <p className="eyebrow mb-2.5">{eyebrow}</p>
      <h2 className="font-display text-[clamp(1.5rem,4vw,2.1rem)] font-semibold leading-[1.15] tracking-tight">
        {title}
      </h2>
      {lede ? <p className="mt-3 text-[15px] leading-relaxed text-(--text-soft)">{lede}</p> : null}
    </div>
  );
}

export function Section({
  id,
  children,
  className,
  tone = 'ground',
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  tone?: 'ground' | 'surface';
}) {
  return (
    <section
      id={id}
      className={cn(
        'scroll-mt-16 border-b border-(--border) px-4 py-14 sm:px-6 sm:py-18',
        tone === 'surface' ? 'bg-(--surface)' : 'bg-(--ground)',
        className,
      )}
    >
      <div className="mx-auto max-w-[1180px]">{children}</div>
    </section>
  );
}
