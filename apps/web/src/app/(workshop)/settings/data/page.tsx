import { DATASETS } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  PageHeader,
  Select,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { EXPORTS } from '@/lib/exports';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { ImportError, importsFor, uploadImport } from '@/lib/imports';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Data in and out') };
}
export const dynamic = 'force-dynamic';

/**
 * Data in, data out. Phase 33.
 *
 * A workshop arriving with five thousand customers in another system, and
 * a workshop leaving with everything: both from one page. Imports are
 * files kept as they came, mapped, previewed and run; exports are every
 * dataset, whole, in the shapes the import reads.
 */
async function upload(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const file = formData.get('file');
  const dataset = String(formData.get('dataset') ?? '');
  if (!(file instanceof File) || file.size === 0)
    redirect('/settings/data?problem=Choose%20a%20file');
  let id: string;
  try {
    id = await uploadImport({
      orgId,
      userId: user.userId,
      dataset,
      fileName: file.name,
      text: await file.text(),
    });
  } catch (error) {
    if (error instanceof ImportError) {
      redirect(`/settings/data?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  redirect(`/settings/data/${id}`);
}

const TONE = { UPLOADED: 'neutral', MAPPED: 'warning', IMPORTED: 'success' } as const;

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string }>;
}) {
  const { orgId, region } = await requireSession('settings:read');
  const { problem } = await searchParams;
  const imports = await importsFor(orgId);
  const t = await tFor();

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">{t('Settings')}</BackLink>
      </div>
      <PageHeader
        eyebrow={t('Settings')}
        title={t('Data in and out')}
        description={t(
          'Bring what you have from another system; take everything with you whenever you like',
        )}
      />

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <Card className="border-(--brand)">
            <CardHeader
              title={t('Import a file')}
              description={t(
                'A CSV from any system. You map the columns on the next page, see every problem row by row, then import.',
              )}
            />
            <CardBody>
              <form action={upload} className="grid gap-4">
                <Field label={t('What is in the file?')}>
                  <Select name="dataset" defaultValue="customers">
                    {DATASETS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {t(d.title)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={t('The file')}
                  hint={t(
                    'CSV, up to 20,000 rows. Commas, semicolons or tabs; the first line is the headers.',
                  )}
                >
                  <input
                    type="file"
                    name="file"
                    accept=".csv,text/csv,text/plain"
                    required
                    className="block w-full cursor-pointer rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 py-2 text-[13px] file:mr-3 file:cursor-pointer file:rounded-(--radius-sm) file:border-0 file:bg-(--surface-sunk) file:px-3 file:py-1.5 file:text-[13px] file:font-medium"
                  />
                </Field>
                <div>
                  <Button type="submit" variant="primary">
                    {t('Upload and map the columns')}
                  </Button>
                </div>
              </form>
              <ul className="mt-4 grid gap-1 text-[12px] text-(--text-faint)">
                {DATASETS.map((d) => (
                  <li key={d.id}>
                    <span className="font-medium text-(--text-soft)">{t(d.title)}.</span>{' '}
                    {t(d.becomes)}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('Imports so far')} />
            {imports.length === 0 ? (
              <EmptyState
                title={t('Nothing imported yet')}
                description={t('Files you bring appear here with what became of them.')}
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {imports.map((batch) => {
                  const report = batch.report as {
                    imported?: number;
                    failed?: unknown[];
                    invalid?: number;
                  } | null;
                  return (
                    <li
                      key={batch.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/settings/data/${batch.id}`}
                          className="text-[14px] font-medium underline"
                        >
                          {batch.fileName}
                        </Link>
                        <p className="text-[12px] text-(--text-faint)">
                          {t(DATASETS.find((d) => d.id === batch.dataset)?.title ?? batch.dataset)}{' '}
                          ·{' '}
                          {t('{count} rows', {
                            count: batch.rowCount.toLocaleString(region.locale),
                          })}{' '}
                          ·{' '}
                          {batch.createdAt.toLocaleDateString(region.locale, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {batch.createdBy ? ` · ${batch.createdBy.name}` : ''}
                          {report
                            ? ` · ${t('{imported} in, {left} not', {
                                imported: report.imported ?? 0,
                                left: (report.failed?.length ?? 0) + (report.invalid ?? 0),
                              })}`
                            : ''}
                        </p>
                      </div>
                      <Badge tone={TONE[batch.status]} size="sm" dot>
                        {batch.status === 'UPLOADED'
                          ? t('to map')
                          : batch.status === 'MAPPED'
                            ? t('ready')
                            : t('imported')}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader
            title={t('Export everything')}
            description={t(
              'Each dataset whole, in the shape the import reads. The passports go out as the network exchanges them.',
            )}
          />
          <CardBody>
            <ul className="grid gap-2">
              {EXPORTS.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-(--radius-md) border border-(--border) px-3.5 py-2.5"
                >
                  <span className="text-[14px] font-medium">{t(e.title)}</span>
                  <a href={`/api/exports/${e.id}`} className="shrink-0">
                    <Button variant={e.id === 'everything' ? 'primary' : 'secondary'} size="sm">
                      {e.kind === 'csv' ? t('Download CSV') : t('Download JSON')}
                    </Button>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-(--text-faint)">
              {t(
                'Exports work in every state of the subscription, including read-only and cancelled. Your data is yours; the terms say so and this page keeps the promise.',
              )}
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
