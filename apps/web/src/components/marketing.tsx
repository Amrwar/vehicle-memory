import { cn } from '@carnet/ui';
import Link from 'next/link';
import * as React from 'react';
import { currentLanguage, tFor } from '@/lib/i18n';
import { LanguageSwitch } from './language-switch';

/**
 * Marketing furniture.
 *
 * Shared between the home page and pricing so the two read as one site rather
 * than two pages that happen to share a palette. Everything here is a server
 * component: the front door has no state, and shipping JavaScript to render a
 * headline is how a marketing site ends up slower than the app behind it.
 */

export async function MarketingHeader({
  signedIn,
  back = '/',
}: {
  signedIn: boolean;
  back?: string;
}) {
  const t = await tFor();
  const language = await currentLanguage();
  return (
    <header className="sticky top-0 z-30 border-b border-(--border) bg-(--surface)/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Mark />
          <span className="font-display text-[17px] font-semibold tracking-tight">Carnet</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label={t('Sections')}>
          <NavLink href="/#how">{t('How it works')}</NavLink>
          <NavLink href="/#passport">{t('The passport')}</NavLink>
          <NavLink href="/pricing">{t('Pricing')}</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <LanguageSwitch current={language} back={back} compact className="mr-1" />
          {signedIn ? (
            <Link
              href="/dashboard"
              className={cn(
                'rounded-(--radius-md) bg-(--brand-solid) px-3.5 py-2 text-[13px] font-medium',
                'text-(--on-brand-solid) shadow-sm transition-colors hover:bg-(--brand-solid-hover)',
              )}
            >
              {t('Open workshop')}
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-(--radius-md) px-3 py-2 text-[13px] text-(--text-soft) transition-colors hover:bg-(--surface-sunk) hover:text-(--text)"
              >
                {t('Sign in')}
              </Link>
              <Link
                href="/signup"
                className={cn(
                  'rounded-(--radius-md) bg-(--brand-solid) px-3.5 py-2 text-[13px] font-medium',
                  'text-(--on-brand-solid) shadow-sm transition-colors hover:bg-(--brand-solid-hover)',
                )}
              >
                {t('Start your trial')}
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

/**
 * The mark: a passport booklet with the wheel from its cover. The same
 * drawing as the favicon and the home-screen icon, in one colour so it can
 * sit in a header at eighteen pixels or on petrol at twenty-six.
 */
export function Mark({
  size = 24,
  className = 'text-(--brand)',
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
      className={className}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5.2 2.6h9.6a1.6 1.6 0 0 1 1.6 1.6v11.6a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6V4.2a1.6 1.6 0 0 1 1.6-1.6z" />
      <path d="M6.4 2.6v14.8" />
      <circle cx="11.5" cy="8.6" r="2.7" />
      <path d="M11.5 4.7v1.2M11.5 11.3v1.2M7.6 8.6h1.2M14.2 8.6h1.2" />
      <path d="M8.8 14.3h5.2" />
    </svg>
  );
}

export async function MarketingFooter() {
  const t = await tFor();
  return (
    <footer className="border-t border-(--border) bg-(--surface)">
      <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <div className="flex items-center gap-2.5">
            <Mark size={20} />
            <span className="font-display text-[15px] font-semibold">Carnet</span>
          </div>
          <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-(--text-soft)">
            {t(
              'Workshop management with a service history that belongs to the car, not to the garage that happened to write it.',
            )}
          </p>
        </div>

        <FooterColumn
          title={t('Product')}
          links={[
            { href: '/#how', label: t('How it works') },
            { href: '/#passport', label: t('The passport') },
            { href: '/#features', label: t('Features') },
            { href: '/pricing', label: t('Pricing') },
          ]}
        />
        <FooterColumn
          title={t('Try it')}
          links={[
            { href: '/signup', label: t('Start your trial') },
            { href: '/login', label: t('Sign in') },
            { href: '/p/demo-share-token', label: t('See a real passport') },
          ]}
        />
        <FooterColumn
          title={t('Contact')}
          links={[
            { href: 'mailto:hefnyamr@rocketmail.com', label: 'hefnyamr@rocketmail.com' },
            { href: 'tel:+15145534360', label: '+1 514 553 4360' },
          ]}
        />
      </div>

      <div className="border-t border-(--border)">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center justify-between gap-2 px-4 py-4 text-[12px] text-(--text-faint) sm:px-6">
          <p>{t('Carnet is a working demonstration system. Figures shown are seeded data.')}</p>
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
  /**
   * The page's own title, rather than a section within it.
   *
   * Every page needs exactly one h1. Without it a screen reader has no anchor
   * for what the page is, and the heading outline starts at level two with
   * nothing above it.
   */
  primary = false,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  align?: 'left' | 'centre';
  primary?: boolean;
}) {
  const Heading = primary ? 'h1' : 'h2';

  return (
    <div className={cn('max-w-2xl', align === 'centre' && 'mx-auto text-center')}>
      <p className="eyebrow mb-2.5">{eyebrow}</p>
      <Heading className="font-display text-[clamp(1.5rem,4vw,2.1rem)] font-semibold leading-[1.15] tracking-tight">
        {title}
      </Heading>
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
