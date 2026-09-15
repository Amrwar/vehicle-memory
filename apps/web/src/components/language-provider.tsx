'use client';

import { type Language, type Translator, translator } from '@carnet/core';
import { createContext, useContext, useMemo } from 'react';

/**
 * The person's language, for components that run in the browser. Phase 40.5.
 *
 * The root layout reads the language on the server and puts it here once, so
 * a client component translates its own words with useT() instead of every
 * page passing the language down to it.
 */
const LanguageContext = createContext<Language>('en');

export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: React.ReactNode;
}) {
  return <LanguageContext.Provider value={language}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): Language {
  return useContext(LanguageContext);
}

export function useT(): Translator {
  const language = useContext(LanguageContext);
  return useMemo(() => translator(language), [language]);
}
