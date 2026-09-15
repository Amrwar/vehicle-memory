import { LANGUAGE_NAMES, LANGUAGES, type Language, translator } from '@carnet/core';

/**
 * Three buttons, one per language, the current one pressed. Phase 37.5.
 *
 * A form that posts to the language route, so it works without a script
 * and from any page. `back` is the page to return to.
 */
export function LanguageSwitch({
  current,
  back,
  compact = false,
  className,
}: {
  current: Language;
  back: string;
  compact?: boolean;
  className?: string;
}) {
  const t = translator(current);
  return (
    <form
      action="/api/language"
      method="post"
      className={['inline-flex items-center gap-1', className ?? ''].join(' ')}
      aria-label={t('Language')}
    >
      <input type="hidden" name="back" value={back} />
      {LANGUAGES.map((language) => (
        <button
          key={language}
          type="submit"
          name="language"
          value={language}
          lang={language}
          aria-pressed={language === current}
          className={[
            'rounded-(--radius-sm) px-2 py-1 text-[12px] font-medium transition-colors',
            language === current
              ? 'bg-(--brand) text-white'
              : 'text-(--text-soft) hover:bg-(--surface-sunk) hover:text-(--text)',
          ].join(' ')}
        >
          {compact ? language.toUpperCase() : LANGUAGE_NAMES[language]}
        </button>
      ))}
    </form>
  );
}
