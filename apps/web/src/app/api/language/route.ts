import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { setLanguage } from '@/lib/i18n';

/**
 * The language switcher posts here. Phase 37.5.
 *
 * A plain form so it works on every page, signed in or not, with no
 * script. The cookie is set for a year; a signed-in person's choice is
 * saved on their account too. Sent back to the page they were on, never
 * off the site.
 */
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const form = await request.formData();
  const language = String(form.get('language') ?? '');
  const back = String(form.get('back') ?? '/');
  const user = await currentUser();

  await setLanguage({ language, userId: user?.userId ?? null });

  const safeBack = back.startsWith('/') && !back.startsWith('//') ? back : '/';
  return NextResponse.redirect(new URL(safeBack, request.url), { status: 303 });
}
