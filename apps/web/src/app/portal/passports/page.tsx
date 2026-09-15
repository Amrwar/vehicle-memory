import { Badge, Button, Card, CardBody, EmptyState, Registration } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { PortalShell } from '@/components/portal-shell';
import { requireUser } from '@/lib/guard';
import { passportsForOwner } from '@/lib/passports';
import { regionForUser } from '@/lib/region';
import { tFor } from '@/lib/i18n';
import type { Translator } from '@carnet/core';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Your passports') };
}
export const dynamic = 'force-dynamic';

/**
 * The customer's passports, one card each. Phase 27.
 *
 * Maria (persona P4) does not know what a hash chain is and should not have
 * to. What she needs to know is whether the record is sound, how much of
 * her car's life is in it, and how to show it to somebody. So each card
 * says those three things and nothing else.
 */
export default async function PortalPassportsPage() {
  const t = await tFor();
  const user = await requireUser();
  const region = await regionForUser(user.userId);
  const { rows, summary } = await passportsForOwner(user.userId);

  const date = (value: Date | null) =>
    value ? value.toLocaleDateString(region.locale, { month: 'long', year: 'numeric' }) : null;

  return (
    <PortalShell active="passports">
      <h1 className="font-display text-[24px] font-semibold leading-tight">
        {t('Your passports')}
      </h1>
      <p className="mt-1 text-[14px] text-(--text-soft)">
        {rows.length === 0
          ? t(
              'Each car you own has a passport: its history, kept by every garage that worked on it.',
            )
          : summary.broken > 0
            ? summary.passports === 1
              ? t('1 car. One record does not verify; the garage that keeps it has been told.')
              : t(
                  '{count} cars. One record does not verify; the garage that keeps it has been told.',
                  { count: summary.passports },
                )
            : soundSummary(t, summary.passports, summary.entries)}
      </p>

      {rows.length === 0 ? (
        <EmptyState
          className="mt-5 rounded-(--radius-lg) border border-(--border) bg-(--surface)"
          title={t('No passports yet')}
          description={t(
            'Add your car by its registration. The garage that last worked on it confirms it is yours, and its passport appears here.',
          )}
          action={
            <Link href="/portal/claim">
              <Button variant="primary">{t('Add your car')}</Button>
            </Link>
          }
        />
      ) : (
        <ul className="mt-5 grid gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <CardBody>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-[17px] font-semibold">
                          {row.year} {row.make} {row.model}
                        </h2>
                        {row.registration ? <Registration value={row.registration} /> : null}
                      </div>
                      <p className="mt-1 text-[13px] text-(--text-faint)">
                        {row.entries === 0
                          ? t('Nothing recorded yet.')
                          : recordLine(t, row.entries, row.workshops, date(row.firstRecorded))}
                      </p>
                    </div>
                    {row.entries === 0 ? null : row.intact ? (
                      <Badge tone="success" dot>
                        {t('Record sound')}
                      </Badge>
                    ) : (
                      <Badge tone="danger" dot>
                        {t('Does not verify')}
                      </Badge>
                    )}
                  </div>

                  {row.openRecalls > 0 ? (
                    <p className="mt-3 rounded-(--radius-sm) bg-(--danger-soft) px-2.5 py-1.5 text-[13px] text-(--danger)">
                      {t('This vehicle has an outstanding safety recall. Contact your workshop.')}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/portal/vehicles/${row.id}/passport`}>
                      <Button size="touch" variant="primary">
                        {t('Open the passport')}
                      </Button>
                    </Link>
                    <Link href={`/portal/vehicles/${row.id}#share`}>
                      <Button size="touch">{t('Show it to a buyer')}</Button>
                    </Link>
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-[12px] leading-relaxed text-(--text-faint)">
        {t(
          'A passport belongs to the car, not to you or to any garage. When you sell the car, the record goes with it and your name does not.',
        )}
      </p>
    </PortalShell>
  );
}

function soundSummary(t: Translator, cars: number, entries: number): string {
  const vars = { cars, entries };
  if (cars === 1) {
    return entries === 1
      ? t('1 car, 1 entry, every record sound.')
      : t('1 car, {entries} entries, every record sound.', vars);
  }
  return entries === 1
    ? t('{cars} cars, 1 entry, every record sound.', vars)
    : t('{cars} cars, {entries} entries, every record sound.', vars);
}

function recordLine(t: Translator, entries: number, garages: number, since: string | null): string {
  const vars = { entries, garages, date: since ?? '' };
  if (since) {
    if (entries === 1) return t('1 entry from 1 garage, since {date}.', vars);
    return garages === 1
      ? t('{entries} entries from 1 garage, since {date}.', vars)
      : t('{entries} entries from {garages} garages, since {date}.', vars);
  }
  if (entries === 1) return t('1 entry from 1 garage.');
  return garages === 1
    ? t('{entries} entries from 1 garage.', vars)
    : t('{entries} entries from {garages} garages.', vars);
}
