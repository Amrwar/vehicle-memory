import { suggestSeverity } from '@carnet/core';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Input, Registration } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { PhotoCapture } from '@/components/photo-capture';
import { requireSession } from '@/lib/guard';
import {
  completeInspection,
  inspectionFor,
  InspectionError,
  recordResult,
} from '@/lib/inspections';

export const metadata: Metadata = { title: 'Inspection' };
export const dynamic = 'force-dynamic';

/**
 * Carrying out an inspection, on a tablet, next to the car. FR-2700.
 *
 * Everything here is shaped by who is holding the screen: somebody standing in
 * a workshop with oily hands who is interrupted every few minutes.
 *
 * Each item saves the moment it is answered. No submit button at the end, and
 * nothing held in the browser, because a tablet that sleeps in a cold workshop
 * would otherwise lose the hour just spent under a car.
 *
 * Three buttons per item and they are large. Green, amber, red. Marking
 * something amber or red opens the reason, and the reason is required: the
 * customer sees the colour, and a red the workshop cannot explain is worse
 * than no inspection at all.
 *
 * Nothing is preselected, and unchecked items stay unchecked. Refusing to
 * finish an inspection with gaps in it would make somebody tick boxes to
 * escape the screen, and a green tick meaning "I wanted to leave" is the one
 * outcome worse than an honest blank.
 */
async function record(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');
  const inspectionId = String(formData.get('inspectionId') ?? '');

  const measurement = String(formData.get('measurementValue') ?? '').trim();
  const cost = String(formData.get('estimatedCost') ?? '').trim();

  try {
    await recordResult({
      orgId,
      userId: user.userId,
      inspectionId,
      templateItemId: String(formData.get('templateItemId') ?? ''),
      severity: String(formData.get('severity') ?? 'PASS') as 'PASS' | 'ADVISORY' | 'CRITICAL',
      note: String(formData.get('note') ?? ''),
      recommendedAction: String(formData.get('recommendedAction') ?? ''),
      measurementValue: measurement === '' ? null : Number(measurement),
      estimatedCost: cost === '' ? null : Math.round(Number(cost) * 100) / 100,
    });
  } catch (error) {
    if (error instanceof InspectionError) {
      redirect(`/shop/inspect/${inspectionId}?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }

  // Back to the item just answered, so the page does not jump to the top and
  // lose somebody's place halfway round a car.
  redirect(`/shop/inspect/${inspectionId}#item-${formData.get('templateItemId')}`);
}

async function finish(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');
  const inspectionId = String(formData.get('inspectionId') ?? '');

  try {
    const result = await completeInspection({
      orgId,
      userId: user.userId,
      inspectionId,
      notes: String(formData.get('notes') ?? ''),
    });

    redirect(`/shop?inspected=${result.lines}`);
  } catch (error) {
    if (error instanceof InspectionError) {
      redirect(`/shop/inspect/${inspectionId}?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }
}

const TONES = {
  PASS: { label: 'Good', tone: 'success' as const },
  ADVISORY: { label: 'Watch', tone: 'warning' as const },
  CRITICAL: { label: 'Act now', tone: 'danger' as const },
};

export default async function InspectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { orgId } = await requireSession('job:write');
  const { id } = await params;
  const { error } = await searchParams;

  const loaded = await inspectionFor(orgId, id);
  if (!loaded) notFound();

  const { inspection, sections, byItem, progress } = loaded;
  const vehicle = inspection.job.vehicle;
  const done = inspection.status === 'COMPLETED';

  return (
    <div className="min-h-dvh bg-(--ground) pb-24">
      <header className="sticky top-0 z-10 border-b border-(--border) bg-(--surface)">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="eyebrow">Job {inspection.job.number}</p>
              <h1 className="font-display text-[19px] font-semibold leading-tight">
                {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
              </h1>
            </div>
            {vehicle.registration ? <Registration value={vehicle.registration} /> : null}
          </div>

          {/* A bar, not a score. Nine greens and one red is not ninety per
              cent healthy, and the number beside it says what it counts. */}
          <div className="mt-2.5 flex items-center gap-3">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--border)"
              role="progressbar"
              aria-valuenow={progress.checked}
              aria-valuemin={0}
              aria-valuemax={progress.total}
              aria-label="Items checked"
            >
              <div
                className="h-full bg-(--brand-solid)"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
            <span className="text-[12px] tabular-nums text-(--text-soft)">
              {progress.checked} of {progress.total}
            </span>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 py-5 outline-none">
        {error ? (
          <Alert tone="danger" className="mb-4" title="Not recorded">
            {error}
          </Alert>
        ) : null}

        {done ? (
          <Alert tone="info" className="mb-4" title="Already sent">
            This inspection has gone to the customer and cannot be changed. Start a new one to
            record another look at the vehicle.
          </Alert>
        ) : null}

        {sections.map((section) => (
          <section key={section.name} className="mb-6">
            <h2 className="mb-2.5 font-display text-[16px] font-semibold">{section.name}</h2>

            <div className="grid gap-2.5">
              {section.items.map((item) => {
                const result = byItem.get(item.id);
                const severity = result?.severity ?? 'NOT_CHECKED';
                const answered = severity !== 'NOT_CHECKED';
                const measures = item.measurementType !== 'NONE';

                const suggestion = measures
                  ? suggestSeverity(item.measurementType, result?.measurementValue)
                  : null;

                return (
                  <Card key={item.id} id={`item-${item.id}`}>
                    <CardBody>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{item.name}</p>
                          {item.guidance ? (
                            <p className="mt-0.5 text-[13px] text-(--text-soft)">{item.guidance}</p>
                          ) : null}
                        </div>

                        {answered ? (
                          <Badge tone={TONES[severity as keyof typeof TONES].tone} size="sm">
                            {TONES[severity as keyof typeof TONES].label}
                          </Badge>
                        ) : (
                          <Badge tone="neutral" size="sm">
                            not checked
                          </Badge>
                        )}
                      </div>

                      {result?.note || result?.recommendedAction ? (
                        <p className="mt-2 text-[13px] leading-relaxed text-(--text-soft)">
                          {result.recommendedAction ?? result.note}
                        </p>
                      ) : null}

                      {suggestion ? (
                        <p className="mt-2 text-[12px] text-(--text-faint)">{suggestion.because}</p>
                      ) : null}

                      {done ? null : (
                        <form action={record} className="mt-3 grid gap-3">
                          <input type="hidden" name="inspectionId" value={inspection.id} />
                          <input type="hidden" name="templateItemId" value={item.id} />

                          {measures ? (
                            <label className="grid gap-1">
                              <span className="text-[12px] font-medium text-(--text-soft)">
                                Measurement
                              </span>
                              <Input
                                name="measurementValue"
                                type="number"
                                step="0.1"
                                inputMode="decimal"
                                defaultValue={result?.measurementValue ?? ''}
                                placeholder={item.measurementType.replace(/_/g, ' ').toLowerCase()}
                              />
                            </label>
                          ) : null}

                          <label className="grid gap-1">
                            <span className="text-[12px] font-medium text-(--text-soft)">
                              What you found
                            </span>
                            <Input
                              name="note"
                              defaultValue={result?.note ?? ''}
                              placeholder="Needed for anything not green"
                            />
                          </label>

                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="grid gap-1">
                              <span className="text-[12px] font-medium text-(--text-soft)">
                                What it needs
                              </span>
                              <Input
                                name="recommendedAction"
                                defaultValue={result?.recommendedAction ?? ''}
                                placeholder="Becomes the quote line"
                              />
                            </label>

                            <label className="grid gap-1">
                              <span className="text-[12px] font-medium text-(--text-soft)">
                                Roughly, in pounds
                              </span>
                              <Input
                                name="estimatedCost"
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                defaultValue={result?.estimatedCost ?? ''}
                              />
                            </label>
                          </div>

                          {/* Three buttons, thumb-sized, in the order somebody
                              reads them. The value goes with the press, so one
                              tap records the answer. */}
                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              type="submit"
                              name="severity"
                              value="PASS"
                              size="touch"
                              variant="secondary"
                            >
                              Good
                            </Button>
                            <Button
                              type="submit"
                              name="severity"
                              value="ADVISORY"
                              size="touch"
                              variant="secondary"
                            >
                              Watch
                            </Button>
                            <Button
                              type="submit"
                              name="severity"
                              value="CRITICAL"
                              size="touch"
                              variant="primary"
                            >
                              Act now
                            </Button>
                          </div>
                        </form>
                      )}
                      {/* Outside the form on purpose: the upload is its own
                          exchange, and a file input inside a server action
                          would be posted along with the answer. A photograph
                          can only be attached once the item has been recorded,
                          because it hangs off that row. */}
                      {!done && result ? (
                        <div className="mt-3 border-t border-(--border) pt-3">
                          <PhotoCapture resultId={result.resultId} count={result.photoCount ?? 0} />
                        </div>
                      ) : null}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}

        {done ? (
          <Link href="/shop">
            <Button size="touch" variant="secondary">
              Back to my jobs
            </Button>
          </Link>
        ) : (
          <Card className="border-(--brand)">
            <CardHeader
              title="Send it to the customer"
              description="Anything marked amber or red becomes a quote line they can approve item by item."
            />
            <CardBody>
              <form action={finish} className="grid gap-3">
                <input type="hidden" name="inspectionId" value={inspection.id} />

                <label className="grid gap-1">
                  <span className="text-[12px] font-medium text-(--text-soft)">
                    Anything to add for the customer
                  </span>
                  <Input name="notes" placeholder="Optional" />
                </label>

                <p className="text-[13px] leading-relaxed text-(--text-soft)">
                  You have checked {progress.checked} of {progress.total}.
                  {progress.remaining > 0
                    ? ` The other ${progress.remaining} will be shown to the customer as not checked, which is honest and protects you if something fails later on a part nobody looked at.`
                    : ''}
                </p>

                <div>
                  <Button type="submit" size="touch" variant="primary">
                    Send to the customer
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>
        )}
      </main>
    </div>
  );
}
