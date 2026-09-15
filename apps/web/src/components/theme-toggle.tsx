'use client';

import { cn } from '@carnet/ui';
import { msg } from '@carnet/core';
import * as React from 'react';

import { useT } from '@/components/language-provider';

/**
 * Light, dark, or whatever the machine says.
 *
 * Three states rather than two. A workshop tablet on the shop floor is often
 * set to dark for a night shift while the office desktop is not, and the
 * person is the same person; forcing one choice across both is worse than
 * following the device.
 *
 * The choice is stamped on <html> as data-theme and mirrored into
 * localStorage. The inline script in the root layout replays it before first
 * paint, so a dark-mode user never sees a white flash.
 */

export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'carnet-theme';

const OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: msg('Light'),
    icon: (
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="3.1" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 1.4v1.5M8 13.1v1.5M14.6 8h-1.5M2.9 8H1.4M12.7 3.3l-1 1M4.3 11.7l-1 1M12.7 12.7l-1-1M4.3 4.3l-1-1"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    value: 'system',
    label: msg('Auto'),
    icon: (
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden>
        <rect
          x="1.9"
          y="2.9"
          width="12.2"
          height="8.2"
          rx="1.3"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M5.6 13.6h4.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    value: 'dark',
    label: msg('Dark'),
    icon: (
      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden>
        <path
          d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
];

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', choice);
  }
}

export function ThemeToggle({ className }: { className?: string }) {
  // Rendered as "system" on the server, then corrected on mount. Reading
  // localStorage during render would mismatch the server HTML and React would
  // throw the whole tree away to recover from it.
  const t = useT();
  const [choice, setChoice] = React.useState<ThemeChoice>('system');
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') setChoice(stored);
    setReady(true);
  }, []);

  function choose(next: ThemeChoice) {
    setChoice(next);
    apply(next);
    try {
      if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Private browsing refuses storage. The choice still applies to this
      // tab, which is the part the person can see.
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={t('Colour theme')}
      className={cn(
        'grid grid-cols-3 gap-0.5 rounded-(--radius-sm) border border-(--border) bg-(--surface-sunk) p-0.5',
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const selected = ready && choice === option.value;

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={t(option.label)}
            onClick={() => choose(option.value)}
            className={cn(
              'flex h-6 items-center justify-center rounded-(--radius-xs) transition-colors',
              selected
                ? 'bg-(--surface) text-(--brand-text) shadow-sm'
                : 'text-(--text-faint) hover:text-(--text)',
            )}
          >
            {option.icon}
            <span className="sr-only">{t(option.label)}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Runs before the first paint, so the stored choice is on <html> by the time
 * anything is drawn. Inlined deliberately: a separate request here is a
 * guaranteed flash of the wrong theme.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;
