import { Button } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { StrandedCar } from '@/components/stranded-car';
import { Mark } from '@/components/marketing';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

/**
 * The application-wide 404.
 *
 * Catches every URL that matches no route, whoever is looking at it: a member
 * of staff who mistyped, somebody following a stale bookmark, or a stranger
 * who arrived from a link that no longer exists.
 *
 * Because the audience is mixed, the copy says what happened without assuming
 * an account, and the routes offered are ones anybody can safely try.
 */
export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-(--ground) px-4 py-12">
      <main id="main" className="w-full max-w-xl text-center">
        <div className="mb-1 flex items-center justify-center gap-2">
          <Mark size={18} className="text-(--brand)" />
          <span className="font-display text-[14px] font-semibold">Carnet</span>
        </div>

        <StrandedCar className="mx-auto w-full max-w-[400px]" />

        <p className="eyebrow mt-4">Error 404</p>

        <h1 className="mt-2 font-display text-[30px] font-semibold leading-tight tracking-tight">
          The road stops here
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-(--text-soft)">
          There is nothing at this address. The page may have moved, or the link that brought you
          here may be out of date.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          <Link href="/dashboard">
            <Button variant="primary" size="lg">
              Back to the workshop
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg">Sign in</Button>
          </Link>
        </div>

        <p className="mx-auto mt-8 max-w-sm text-[12px] leading-relaxed text-(--text-faint)">
          If you followed a link to a vehicle&rsquo;s history, ask whoever sent it to share the
          vehicle again. Share links are time-limited by design, so the owner stays in control of
          who can read the record.
        </p>
      </main>
    </div>
  );
}
