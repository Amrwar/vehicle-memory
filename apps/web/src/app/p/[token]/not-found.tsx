import type { Metadata } from 'next';

import { StrandedCar } from '@/components/stranded-car';
import { Mark } from '@/components/marketing';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return {
    title: t('Link expired'),
    robots: { index: false, follow: false },
  };
}

/**
 * A dead passport link.
 *
 * Whoever lands here has no account, arrived from a link somebody sent them,
 * and is probably standing next to a car deciding whether to buy it. Next's
 * default "This page could not be found" tells them nothing and implies the
 * fault is theirs.
 *
 * So this page does three things: says plainly what happened, explains that
 * expiry is a feature rather than a failure, and tells them exactly how to get
 * a working link. The illustration is there to take the sting out of a dead
 * end, not to decorate it.
 */
export default async function PassportLinkNotFound() {
  const t = await tFor();
  return (
    <div className="grid min-h-dvh place-items-center bg-(--ground) px-4 py-10">
      <main id="main" className="w-full max-w-lg text-center">
        <div className="mb-2 flex items-center justify-center gap-2">
          <Mark size={18} className="text-(--brand)" />
          <span className="font-display text-[14px] font-semibold">Carnet</span>
        </div>

        <StrandedCar className="mx-auto w-full max-w-[380px]" />

        <h1 className="mt-6 font-display text-[26px] font-semibold leading-tight">
          {t('This link has run out of road')}
        </h1>

        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-(--text-soft)">
          {t(
            'The vehicle history it pointed to is still there. The link itself has expired, or the owner has withdrawn it.',
          )}
        </p>

        <div className="mx-auto mt-7 max-w-md rounded-(--radius-lg) border border-(--border) bg-(--surface) p-5 text-start">
          <p className="eyebrow mb-2">{t('Why links expire')}</p>
          <p className="text-[14px] leading-relaxed text-(--text-soft)">
            {t(
              'A vehicle’s history belongs to the vehicle, and its owner decides who may read it. Every share link is time-limited and can be revoked at any moment, so a record shared once for a sale does not stay open to the internet forever.',
            )}
          </p>
        </div>

        <div className="mx-auto mt-4 max-w-md rounded-(--radius-lg) border border-(--brand) bg-(--brand-soft) p-5 text-start">
          <p className="eyebrow mb-2 text-(--brand-text)">{t('What to do')}</p>
          <p className="text-[14px] leading-relaxed text-(--text-soft)">
            {t(
              'Ask whoever sent it to share the vehicle again. It takes them a few seconds and produces a fresh link.',
            )}
          </p>
        </div>

        <p className="mt-8 text-[12px] leading-relaxed text-(--text-faint)">
          {t(
            'Carnet keeps a permanent, append-only record of what has happened to a vehicle: services, repairs, parts, mileage and inspections, each attributed to the workshop that recorded it. The history follows the car, not the owner.',
          )}
        </p>
      </main>
    </div>
  );
}
