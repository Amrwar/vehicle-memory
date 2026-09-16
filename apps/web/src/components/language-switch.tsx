import { LANGUAGE_NAMES, LANGUAGES, type Language, translator } from '@carnet/core';

/**
 * Three buttons, one per language, the current one pressed. Phase 37.5.
 *
 * A form that posts to the language route, so it works without a script
 * and from any page. `back` is the page to return to.
 *
 * On a narrow screen the three buttons are a third of a header, so `menu`
 * folds them behind the language somebody is already reading: a details
 * element, which opens without a script and closes when the form is
 * submitted because the page reloads. The full row comes back as soon as
 * there is room for it.
 */
export function LanguageSwitch({
  current,
  back,
  compact = false,
  menu = false,
  className,
}: {
  current: Language;
  back: string;
  compact?: boolean;
  /** Fold into a one-button menu below the small breakpoint. */
  menu?: boolean;
  className?: string;
}) {
  const t = translator(current);

  const option = (language: Language, inMenu: boolean) => (
    <button
      key={language}
      type="submit"
      name="language"
      value={language}
      lang={language}
      aria-pressed={language === current}
      className={[
        'rounded-(--radius-sm) text-[12px] font-medium transition-colors',
        inMenu ? 'w-full px-3 py-2 text-start text-[13px]' : 'px-2 py-1',
        language === current
          ? 'bg-(--brand) text-white'
          : 'text-(--text-soft) hover:bg-(--surface-sunk) hover:text-(--text)',
      ].join(' ')}
    >
      {inMenu
        ? LANGUAGE_NAMES[language]
        : compact
          ? language.toUpperCase()
          : LANGUAGE_NAMES[language]}
    </button>
  );

  return (
    <form
      action="/api/language"
      method="post"
      className={['inline-flex items-center gap-1', className ?? ''].join(' ')}
      aria-label={t('Language')}
    >
      <input type="hidden" name="back" value={back} />

      {menu ? (
        <details className="relative sm:hidden">
          <summary
            className="flex cursor-pointer list-none items-center gap-1 rounded-(--radius-sm) px-2 py-1.5 text-[12px] font-medium text-(--text-soft) marker:content-none hover:bg-(--surface-sunk) hover:text-(--text) [&::-webkit-details-marker]:hidden"
            aria-label={t('Language')}
          >
            {current.toUpperCase()}
            <svg
              viewBox="0 0 20 20"
              aria-hidden
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="m5.5 8 4.5 4.5L14.5 8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </summary>
          <div className="absolute end-0 z-40 mt-1 grid w-36 gap-0.5 rounded-(--radius-md) border border-(--border) bg-(--surface) p-1 shadow-(--shadow-lg)">
            {LANGUAGES.map((language) => option(language, true))}
          </div>
        </details>
      ) : null}

      <span
        className={
          menu ? 'hidden items-center gap-1 sm:inline-flex' : 'inline-flex items-center gap-1'
        }
      >
        {LANGUAGES.map((language) => option(language, false))}
      </span>
    </form>
  );
}
