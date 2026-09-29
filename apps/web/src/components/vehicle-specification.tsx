import { SPEC_LINES, SPEC_SOURCE_SENTENCE } from '@carnet/core';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Input } from '@carnet/ui';
import Link from 'next/link';

import { tFor } from '@/lib/i18n';
import type { partsThatFit, whatTheCarTakes, whatWentIn } from '@/lib/specification';

const GROUP_LABEL = {
  engine: 'Engine',
  brakes: 'Brakes',
  tyres: 'Tyres',
  battery: 'Battery',
  intervals: 'Intervals',
} as const;

/**
 * What the car takes.
 *
 * Fourteen numbers a technician needs before touching the car, each with where
 * it came from. Two things this screen deliberately does not do.
 *
 * It does not fill a blank in. A line nobody has answered is absent, and the
 * count at the top says how many are — because a blank sends somebody to look
 * it up and a wrong number does not, and a wrong oil grade is an engine.
 *
 * And it does not settle an argument. Where the sheet for this car and the
 * sheet for the model say different things, both are shown and the screen says
 * plainly that they disagree. That is the single most useful line it can
 * carry: one of them is wrong, and somebody should find out which before the
 * drain plug comes out.
 *
 * Phase 88.
 */
export async function VehicleSpecification({
  sheet,
  fits,
  wentIn,
  canWrite,
  vehicleId,
  save,
}: {
  sheet: Awaited<ReturnType<typeof whatTheCarTakes>>;
  fits: Awaited<ReturnType<typeof partsThatFit>>;
  wentIn: Awaited<ReturnType<typeof whatWentIn>>;
  canWrite: boolean;
  vehicleId: string;
  save: (formData: FormData) => Promise<void>;
}) {
  const t = await tFor();

  const byKey = new Map(sheet.lines.map((line) => [line.key, line]));
  const groups = [...new Set(SPEC_LINES.map((line) => line.group))];

  return (
    <Card id="specification">
      <CardHeader
        title={t('What this car takes')}
        description={t(
          'Written once for the model, inherited by every car that decodes to it. A line nobody has answered is left blank on purpose.',
        )}
      />

      <CardBody className="grid gap-4 text-[13px]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">
            {t('{answered} of {of} filled in', {
              answered: sheet.howFull.answered,
              of: sheet.howFull.of,
            })}
          </Badge>
          {sheet.inheritedFrom.map((from) => (
            <span key={from.id} className="text-(--text-faint)">
              {t('From your sheet for {what}', {
                what: [from.make, from.model, from.engineCode].filter(Boolean).join(' '),
              })}
            </span>
          ))}
        </div>

        {/* An argument between two sources is the most useful thing here. */}
        {sheet.disagreements.length > 0 ? (
          <Alert tone="warning">
            <p className="font-medium">{t('Two sources do not agree')}</p>
            <ul className="mt-1 grid gap-0.5">
              {sheet.disagreements.map((line) => (
                <li key={line.key}>
                  {t(line.label)}: {line.value} ({t(SPEC_SOURCE_SENTENCE[line.source])})
                  {line.disagrees.map((other) => (
                    <span key={other.source}>
                      {' · '}
                      {other.value} ({t(SPEC_SOURCE_SENTENCE[other.source])})
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </Alert>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((group) => {
            const lines = SPEC_LINES.filter((line) => line.group === group);
            const answered = lines.filter((line) => byKey.has(line.key));
            return (
              <div
                key={group}
                className="grid gap-1 rounded-(--radius-md) border border-(--border) p-3"
              >
                <p className="eyebrow">{t(GROUP_LABEL[group])}</p>
                {answered.length === 0 ? (
                  <p className="text-(--text-faint)">{t('Nobody has filled this in yet.')}</p>
                ) : (
                  answered.map((line) => {
                    const resolved = byKey.get(line.key)!;
                    return (
                      <div key={line.key} className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-(--text-faint)">{t(line.label)}</span>
                        <span className="font-medium">
                          {resolved.value}
                          {line.unit ? ` ${t(line.unit)}` : ''}
                        </span>
                        {resolved.source === 'THIS_CAR' ? (
                          <span className="text-[11px] text-(--text-faint)">{t('this car')}</span>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

        {/* The parts that fit, from the fitment rows Phase 43 already holds. */}
        {fits.length > 0 ? (
          <div className="grid gap-1">
            <p className="eyebrow">{t('Parts recorded as fitting this car')}</p>
            <ul className="grid gap-0.5">
              {fits.map((part) => (
                <li key={part.productId} className="flex flex-wrap items-baseline gap-x-2">
                  <Link
                    href={`/parts/${part.productId}`}
                    className="text-(--brand-text) hover:underline"
                  >
                    {part.name}
                  </Link>
                  <span className="datum text-[11px] text-(--text-faint)">{part.partNumber}</span>
                  <span className="text-(--text-faint)">
                    {part.inStock > 0
                      ? t('{count} on the shelf', { count: part.inStock })
                      : t('None on the shelf')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* What actually went in, verbatim. No grade is read out of a name:
            a parser that is wrong once has put the wrong oil in an engine. */}
        {wentIn.length > 0 ? (
          <div className="grid gap-1">
            <p className="eyebrow">{t('What has gone in')}</p>
            <ul className="grid gap-0.5">
              {wentIn.map((line) => (
                <li key={line.id} className="flex flex-wrap items-baseline gap-x-2">
                  <span>{line.description}</span>
                  <Link
                    href={`/jobs/${line.jobId}`}
                    className="text-[11px] text-(--brand-text) hover:underline"
                  >
                    #{line.jobNumber}
                  </Link>
                  {line.at ? (
                    <span className="text-[11px] text-(--text-faint)">
                      {line.at.toISOString().slice(0, 10)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canWrite ? (
          <form action={save} className="grid gap-2 border-t border-(--border) pt-3">
            <input type="hidden" name="vehicleId" value={vehicleId} />
            <p className="text-(--text-faint)">
              {t('Anything you put here applies to this car only, and overrides the model sheet.')}
            </p>
            <div className="grid gap-2 md:grid-cols-3">
              {SPEC_LINES.map((line) => (
                <Input
                  key={line.key}
                  name={line.key}
                  defaultValue={
                    byKey.get(line.key)?.source === 'THIS_CAR'
                      ? String(byKey.get(line.key)!.value)
                      : ''
                  }
                  placeholder={line.unit ? `${t(line.label)} (${t(line.unit)})` : t(line.label)}
                  aria-label={t(line.label)}
                />
              ))}
            </div>
            <div>
              <Button type="submit" variant="secondary">
                {t('Save for this car')}
              </Button>
            </div>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}
