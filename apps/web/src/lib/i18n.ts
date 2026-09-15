import {
  dirFor,
  htmlLangFor,
  isLanguage,
  type Language,
  pickLanguage,
  type Translator,
  translator,
} from '@carnet/core';
import { prisma } from '@carnet/db';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';

/**
 * The language of this request. Phase 37.5.
 *
 * A cookie the person set with the switcher, else the language saved on
 * their account (copied to the cookie at sign-in), else what their
 * browser asks for, else English. Read once per request.
 */
export const LANGUAGE_COOKIE = 'carnet_lang';

export const currentLanguage = cache(async (): Promise<Language> => {
  const store = await cookies();
  const headerList = await headers();
  return pickLanguage({
    cookie: store.get(LANGUAGE_COOKIE)?.value ?? null,
    acceptLanguage: headerList.get('accept-language'),
  });
});

/** A translator for this request. Pages call this once and pass `t` down. */
export async function tFor(): Promise<Translator> {
  return translator(await currentLanguage());
}

/** What the root element needs: the language tag and the reading direction. */
export async function htmlAttributes(regionLocale?: string | null) {
  const language = await currentLanguage();
  return { lang: htmlLangFor(language, regionLocale), dir: dirFor(language), language };
}

/**
 * Sets the language: on the cookie for a year, and on the account when
 * somebody is signed in, so the next device follows. The switcher posts
 * here and is sent back where it was.
 */
export async function setLanguage(input: { language: string; userId?: string | null }) {
  if (!isLanguage(input.language)) return;
  const store = await cookies();
  store.set(LANGUAGE_COOKIE, input.language, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: false,
  });
  if (input.userId) {
    await prisma.user.update({
      where: { id: input.userId },
      data: { language: input.language },
    });
  }
}

/** At sign-in: the account's saved language becomes this browser's. */
export async function applySavedLanguage(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { language: true },
  });
  if (user?.language && isLanguage(user.language)) {
    const store = await cookies();
    if (!store.get(LANGUAGE_COOKIE)) {
      store.set(LANGUAGE_COOKIE, user.language, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
        sameSite: 'lax',
        httpOnly: false,
      });
    }
  }
}
