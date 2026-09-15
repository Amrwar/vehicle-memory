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
import { ImportError, importsFor, uploadImport } from '@/lib/imports';

export const metadata: Metadata = { title: 'Data in and out' };
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

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">Settings</BackLink>
      </div>
      <PageHeader
        eyebrow="Settings"
        title="Data in and out"
        description="Bring what you have from another system; take everything with you whenever you like"
      />

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {problem}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid content-start gap-5">
          <Card className="border-(--brand)">
            <CardHeader
              title="Import a file"
              description="A CSV from any system. You map the columns on the next page, see every problem row by row, then import."
            />
            <CardBody>
              <form action={upload} className="grid gap-4">
                <Field label="What is in the file?">
                  <Select name="dataset" defaultValue="customers">
                    {DATASETS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="The file"
                  hint="CSV, up to 20,000 rows. Commas, semicolons or tabs; the first line is the headers."
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
                    Upload and map the columns
                  </Button>
                </div>
              </form>
              <ul className="mt-4 grid gap-1 text-[12px] text-(--text-faint)">
                {DATASETS.map((d) => (
                  <li key={d.id}>
                    <span className="font-medium text-(--text-soft)">{d.title}.</span> {d.becomes}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Imports so far" />
            {imports.length === 0 ? (
              <EmptyState
                title="Nothing imported yet"
                description="Files you bring appear here with what became of them."
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
                          {DATASETS.find((d) => d.id === batch.dataset)?.title ?? batch.dataset} ·{' '}
                          {batch.rowCount.toLocaleString(region.locale)} rows ·{' '}
                          {batch.createdAt.toLocaleDateString(region.locale, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                          {batch.createdBy ? ` · ${batch.createdBy.name}` : ''}
                          {report
                            ? ` · ${report.imported ?? 0} in, ${(report.failed?.length ?? 0) + (report.invalid ?? 0)} not`
                            : ''}
                        </p>
                      </div>
                      <Badge tone={TONE[batch.status]} size="sm" dot>
                        {batch.status === 'UPLOADED'
                          ? 'to map'
                          : batch.status === 'MAPPED'
                            ? 'ready'
                            : 'imported'}
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
            title="Export everything"
            description="Each dataset whole, in the shape the import reads. The passports go out as the network exchanges them."
          />
          <CardBody>
            <ul className="grid gap-2">
              {EXPORTS.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 rounded-(--radius-md) border border-(--border) px-3.5 py-2.5"
                >
                  <span className="text-[14px] font-medium">{e.title}</span>
                  <a href={`/api/exports/${e.id}`} className="shrink-0">
                    <Button variant={e.id === 'everything' ? 'primary' : 'secondary'} size="sm">
                      {e.kind === 'csv' ? 'Download CSV' : 'Download JSON'}
                    </Button>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[12px] leading-relaxed text-(--text-faint)">
              Exports work in every state of the subscription, including read-only and cancelled.
              Your data is yours; the terms say so and this page keeps the promise.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
