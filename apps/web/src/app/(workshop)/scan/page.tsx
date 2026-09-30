import { scanDestination, SCAN_KINDS } from '@carnet/core';
import { Alert, Badge, Button, Card, CardBody, CardHeader, Input, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { resolveScan, whyThoseWereTried } from '@/lib/scanning';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Scan') };
}
export const dynamic = 'force-dynamic';

const KIND_LABEL = {
  vehicle: 'Vehicle',
  job: 'Job',
  part: 'Part',
  bin: 'Bin',
  inspection: 'Inspection',
  equipment: 'Machine',
} as const;

/**
 * One box, and whatever is in front of you.
 *
 * A wedge scanner is a keyboard: it types what it reads and presses return. So
 * this is a form with one field that is focused on arrival, and the whole
 * workflow is point, pull the trigger, land on the record.
 *
 * Two things it will not do.
 *
 * It will not guess. If what was scanned matches a job and a part, it asks
 * which — because opening the wrong job looks exactly like opening the right
 * one, and somebody books a part out against a car that is not on the ramp.
 *
 * It will not pretend. When nothing matches it says what it tried and why,
 * rather than "not found", because "I looked for a job, a part and a bin with
 * that number" tells a person whether to check the label or check the record.
 *
 * Phase 92.
 */

async function look(formData: FormData) {
  'use server';

  const { orgId } = await requireSession('job:read');
  const text = String(formData.get('code') ?? '').trim();
  if (!text) redirect('/scan');

  const outcome = await resolveScan(orgId, text);

  if (outcome.found === 'one') {
    redirect(scanDestination(outcome.kind, outcome.id));
  }

  redirect(`/scan?q=${encodeURIComponent(text)}`);
}

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { orgId } = await requireSession('job:read');
  const t = await tFor();
  const { q } = await searchParams;

  const outcome = q ? await resolveScan(orgId, q) : null;
  const tried = q ? whyThoseWereTried(q) : [];

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('Scan')}
        description={t(
          'Point the scanner at a key tag, a shelf edge, a job sheet or a windscreen. Or type what is printed on the label.',
        )}
      />

      <Card className="mt-5">
        <CardBody>
          <form action={look} className="flex flex-wrap items-end gap-2">
            <Input
              name="code"
              autoFocus
              defaultValue={q ?? ''}
              className="w-96"
              placeholder={t('Scan or type a code')}
              aria-label={t('Scan or type a code')}
            />
            <Button type="submit">{t('Find it')}</Button>
          </form>
        </CardBody>
      </Card>

      {/* A single match is shown rather than redirected to.
          `redirect()` from a page render cannot move anybody here: this route
          sits under a loading boundary, the shell has already streamed by the
          time the answer is known, and the status is settled -- the same
          constraint Phase 73 found when `notFound()` could not turn a 200 into
          a 404. Proved rather than assumed: `/scan?q=ALIGN-1` stayed on /scan
          in a real browser.
          It is also the better screen. Somebody who pasted a link, or reloaded,
          sees what the code resolved to before being moved anywhere. The form
          still goes straight there, because a server action redirects before
          anything streams -- which is the workflow that matters, since a wedge
          scanner submits the form. */}
      {outcome?.found === 'one' ? (
        <Card className="mt-5">
          <CardHeader title={t('That is')} />
          <CardBody>
            <Link
              href={scanDestination(outcome.kind, outcome.id)}
              className="flex flex-wrap items-center gap-2 rounded-(--radius-md) border border-(--border) p-2.5 text-[13px] hover:bg-(--surface-sunken)"
            >
              <Badge tone="success">{t(KIND_LABEL[outcome.kind])}</Badge>
              <bdi>{outcome.label}</bdi>
            </Link>
          </CardBody>
        </Card>
      ) : null}

      {outcome?.found === 'several' ? (
        <Card className="mt-5">
          <CardHeader
            title={t('That matches more than one thing')}
            description={t(
              'Which did you mean? Opening the wrong one looks exactly like opening the right one, so this asks rather than choosing.',
            )}
          />
          <CardBody className="grid gap-1.5 text-[13px]">
            {outcome.matches.map((match) => (
              <Link
                key={`${match.kind}:${match.id}`}
                href={scanDestination(match.kind, match.id)}
                className="flex flex-wrap items-center gap-2 rounded-(--radius-md) border border-(--border) p-2.5 hover:bg-(--surface-sunken)"
              >
                <Badge tone="neutral">{t(KIND_LABEL[match.kind])}</Badge>
                <bdi>{match.label}</bdi>
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {outcome?.found === 'none' ? (
        <Alert tone="warning" className="mt-5">
          <p className="font-medium">{t('Nothing here matches that.')}</p>
          <p className="mt-1 text-[13px]">
            {t('It was looked for as: {kinds}', {
              kinds: tried.map((one) => t(KIND_LABEL[one.kind]).toLowerCase()).join(', '),
            })}
          </p>
        </Alert>
      ) : null}

      <Card className="mt-5">
        <CardHeader
          title={t('What carries a code')}
          description={t(
            'Everything Carnet prints carries one. A code of ours can never be mistaken for anything else.',
          )}
        />
        <CardBody className="flex flex-wrap gap-2 text-[13px]">
          {SCAN_KINDS.map((kind) => (
            <Badge key={kind} tone="neutral">
              {t(KIND_LABEL[kind])}
            </Badge>
          ))}
        </CardBody>
      </Card>
    </>
  );
}
