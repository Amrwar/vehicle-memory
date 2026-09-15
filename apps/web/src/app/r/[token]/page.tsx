import { Button, Card, CardBody } from '@carnet/ui';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { tFor } from '@/lib/i18n';
import { recordRating, reviewByToken } from '@/lib/retention';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return {
    title: t('How did we do?'),
    robots: { index: false, follow: false },
  };
}

/**
 * The one question a customer is asked. FR-3702.
 *
 * No account, no sign-in, one tap. Everything about this page is arranged so
 * somebody answers it standing at a kettle: five large targets, no text
 * required, and the whole thing above the fold on a phone.
 *
 * What happens next depends on the answer, and the page says so afterwards
 * rather than before. Telling somebody in advance that five stars leads to a
 * public review and four does not would be asking them to perform.
 */
async function answer(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  const rating = Number(formData.get('rating') ?? 0);

  const result = await recordRating({
    token,
    rating,
    comment: String(formData.get('comment') ?? ''),
  });

  if (!result) notFound();

  redirect(`/r/${token}?done=1`);
}

export default async function ReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ done?: string }>;
}) {
  const t = await tFor();
  const { token } = await params;
  const { done } = await searchParams;

  const request = await reviewByToken(token);
  if (!request) notFound();

  const vehicle = [request.job.vehicle.make, request.job.vehicle.model].filter(Boolean).join(' ');

  // Answered already, whether just now or a week ago. The same page either
  // way: a customer who opens the link twice should not be asked twice.
  if (request.rating !== null || done) {
    const rating = request.rating ?? 0;

    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-12">
        <p className="text-[12px] font-medium tracking-wide text-(--brand-text) uppercase">
          {request.org.name}
        </p>

        <h1 className="font-display text-[24px] leading-tight font-semibold">{t('Thank you.')}</h1>

        {rating >= 5 ? (
          <>
            <p className="text-[15px] leading-relaxed text-(--text-soft)">
              {t(
                'If you have a moment, saying so publicly helps other people find a workshop they can trust.',
              )}
            </p>
            <p className="text-[13px] text-(--text-faint)">
              {t(
                'Your workshop will send you the link to do that. There is nothing else to do here.',
              )}
            </p>
          </>
        ) : rating >= 4 ? (
          <p className="text-[15px] leading-relaxed text-(--text-soft)">
            {t(
              'If there was something that would have made it a five, ring us and say so. It is the most useful thing anybody tells us.',
            )}
          </p>
        ) : (
          <p className="text-[15px] leading-relaxed text-(--text-soft)">
            {t(
              'Somebody here will read this today and get in touch. We would rather put it right than leave it.',
            )}
          </p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-12">
      <p className="text-[12px] font-medium tracking-wide text-(--brand-text) uppercase">
        {request.org.name}
      </p>

      <h1 className="font-display text-[24px] leading-tight font-semibold text-balance">
        {vehicle
          ? t('How did we do with your {vehicle}?', { vehicle })
          : t('How did we do with your vehicle?')}
      </h1>

      <p className="text-[14px] text-(--text-soft)">
        {t('Job {number}', { number: request.job.number })} · {request.job.shortDescription}
      </p>

      <Card>
        <form action={answer}>
          <input type="hidden" name="token" value={token} />

          <CardBody className="grid gap-4">
            <fieldset>
              <legend className="mb-2 text-[14px] font-medium">{t('Tap a rating')}</legend>

              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="submit"
                    name="rating"
                    value={rating}
                    // Forty-eight pixels at least, because this is answered on
                    // a phone with one thumb while the kettle boils.
                    className="min-h-[56px] min-w-[56px] flex-1 rounded-(--radius) border border-(--border) text-[20px] font-semibold hover:border-(--brand) hover:bg-(--surface-sunken)"
                    aria-label={t('{rating} out of 5', { rating })}
                  >
                    {rating}
                  </button>
                ))}
              </div>

              <p className="mt-2 flex justify-between text-[12px] text-(--text-faint)">
                <span>{t('Badly')}</span>
                <span>{t('Very well')}</span>
              </p>
            </fieldset>

            <label className="grid gap-1.5">
              <span className="text-[14px] font-medium">{t('Anything you want to say')}</span>
              <textarea
                name="comment"
                rows={3}
                maxLength={1000}
                className="w-full rounded-(--radius) border border-(--border) bg-(--surface) px-3 py-2 text-[15px]"
                placeholder={t('Optional')}
              />
            </label>

            <Button type="submit" name="rating" value="0" variant="secondary" className="sr-only">
              {t('Send')}
            </Button>
          </CardBody>
        </form>
      </Card>

      <p className="text-[12px] leading-relaxed text-(--text-faint)">
        {t(
          'This goes to the workshop that did the work. It is not published anywhere, and nothing about you is passed to anybody else.',
        )}
      </p>
    </main>
  );
}
