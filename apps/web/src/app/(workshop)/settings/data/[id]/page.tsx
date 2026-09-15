import { Alert, Badge, Button, Card, CardBody, CardHeader, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { importDetail, ImportError, runImport, saveMapping } from '@/lib/imports';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Import') };
}
export const dynamic = 'force-dynamic';

/**
 * One import: map the columns, see the preview, run it, read the report.
 * Phase 33. The three steps are one page because the person doing this is
 * looking at a spreadsheet in another window and wants to fix row 412 and
 * try again, not navigate.
 */
async function map(formData: FormData) {
  'use server';

  const { orgId } = await requireSession('settings:write');
  const batchId = String(formData.get('batchId') ?? '');
  const mapping: Record<string, string> = {};
  for (const [name, value] of formData.entries()) {
    const m = /^column-(\d+)$/.exec(name);
    if (m && typeof value === 'string' && value) mapping[m[1]!] = value;
  }
  try {
    await saveMapping({ orgId, batchId, mapping });
  } catch (error) {
    if (error instanceof ImportError)
      redirect(`/settings/data/${batchId}?problem=${encodeURIComponent(error.message)}`);
    throw error;
  }
  redirect(`/settings/data/${batchId}?saved=1`);
}

async function run(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const batchId = String(formData.get('batchId') ?? '');
  try {
    await runImport({ orgId, userId: user.userId, batchId });
  } catch (error) {
    if (error instanceof ImportError)
      redirect(`/settings/data/${batchId}?problem=${encodeURIComponent(error.message)}`);
    throw error;
  }
  redirect(`/settings/data/${batchId}?done=1`);
}

export default async function ImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; done?: string; problem?: string }>;
}) {
  const { orgId, region } = await requireSession('settings:read');
  const { id } = await params;
  const { saved, done, problem } = await searchParams;
  const t = await tFor();
  const batch = await importDetail(orgId, id);
  if (!batch) notFound();

  const { spec, headers, rows, mapping, validation, report } = batch;
  const imported = batch.status === 'IMPORTED';
  const ready = validation.missingRequired.length === 0 && validation.rows.length > 0;
  const placedKeys = new Set(Object.values(mapping));
  const sample = rows.slice(0, 3);

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings/data">{t('Data in and out')}</BackLink>
      </div>
      <PageHeader
        eyebrow={`${t('Import')} · ${t(spec.title)}`}
        title={batch.fileName}
        description={`${t('{count} rows.', { count: rows.length.toLocaleString(region.locale) })} ${t(spec.becomes)}`}
        actions={
          <Badge tone={imported ? 'success' : ready ? 'warning' : 'neutral'} dot>
            {imported ? t('Imported') : ready ? t('Ready to import') : t('Mapping needed')}
          </Badge>
        }
      />

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}
      {saved ? (
        <Alert tone="success" className="mb-5">
          {t('Mapping saved. The preview below is run against it.')}
        </Alert>
      ) : null}
      {done && report ? (
        <Alert
          tone={report.failed.length || report.invalid ? 'warning' : 'success'}
          title={t('Imported')}
          className="mb-5"
        >
          {t('{count} went in.', { count: report.imported.toLocaleString(region.locale) })}{' '}
          {report.invalid
            ? `${t('{count} failed the rules and were left out.', { count: report.invalid })} `
            : ''}
          {report.failed.length
            ? `${t('{count} could not be written.', { count: report.failed.length })} `
            : ''}
          {t('The report below says which, and why.')}
        </Alert>
      ) : null}

      {imported && report ? (
        <Card className="mb-5">
          <CardHeader
            title={t('What became of it')}
            description={t('Run {date}.', {
              date:
                batch.importedAt?.toLocaleString(region.locale, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }) ?? '',
            })}
          />
          <CardBody className="grid gap-3 text-[13px]">
            <p>
              {t('{count} imported.', { count: report.imported.toLocaleString(region.locale) })}{' '}
              {t('{count} failed the rules before anything was written.', {
                count: report.invalid,
              })}{' '}
              {t('{count} passed the rules and were refused at the point of writing.', {
                count: report.failed.length,
              })}
            </p>
            {report.notes.length ? (
              <ul className="grid gap-1 text-(--text-soft)">
                {report.notes.map((n, i) => (
                  <li key={i}>{t(n)}</li>
                ))}
              </ul>
            ) : null}
            {report.failed.length ? (
              <table className="w-full text-[13px]">
                <thead className="text-start text-[11px] uppercase tracking-wider text-(--text-faint)">
                  <tr>
                    <th className="py-1 pe-3">{t('Row')}</th>
                    <th className="py-1">{t('Why it did not go in')}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.failed.slice(0, 200).map((f) => (
                    <tr key={f.row} className="border-t border-(--border)">
                      <td className="py-1 pe-3 tabular-nums">{f.row}</td>
                      <td className="py-1">{t(f.message)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader
            title={t('1. Which column is which')}
            description={t(
              'Suggested from your headers. Anything left as ignored is not imported.',
            )}
          />
          <CardBody>
            <form action={map} className="grid gap-3">
              <input type="hidden" name="batchId" value={batch.id} />
              <table className="w-full text-[13px]">
                <thead className="text-start text-[11px] uppercase tracking-wider text-(--text-faint)">
                  <tr>
                    <th className="py-1 pe-3">{t('Your column')}</th>
                    <th className="py-1 pe-3">{t('First rows')}</th>
                    <th className="py-1">{t('Becomes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((header, index) => (
                    <tr key={index} className="border-t border-(--border) align-top">
                      <td className="py-2 pe-3 font-medium">
                        {header || t('Column {number}', { number: index + 1 })}
                      </td>
                      <td className="py-2 pe-3 text-(--text-faint)">
                        {sample
                          .map((r) => r[index])
                          .filter(Boolean)
                          .slice(0, 2)
                          .join(' · ') || '—'}
                      </td>
                      <td className="py-2">
                        <select
                          name={`column-${index}`}
                          defaultValue={mapping[String(index)] ?? ''}
                          disabled={imported}
                          className="w-full rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                        >
                          <option value="">{t('Ignore')}</option>
                          {spec.fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.required
                                ? t('{field} (required)', { field: t(f.label) })
                                : t(f.label)}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!imported ? (
                <div>
                  <Button type="submit" variant="secondary">
                    {t('Save the mapping and preview')}
                  </Button>
                </div>
              ) : null}
              <ul className="grid gap-0.5 text-[12px] text-(--text-faint)">
                {spec.fields
                  .filter((f) => f.hint)
                  .map((f) => (
                    <li key={f.key}>
                      <span className="font-medium text-(--text-soft)">{t(f.label)}.</span>{' '}
                      {t(f.hint ?? '')}
                    </li>
                  ))}
              </ul>
            </form>
          </CardBody>
        </Card>

        <div className="grid content-start gap-5">
          <Card className={ready && !imported ? 'border-(--brand)' : undefined}>
            <CardHeader
              title={t('2. What would go in')}
              description={
                validation.missingRequired.length
                  ? t('Map these first: {fields}.', {
                      fields: validation.missingRequired.map((field) => t(field)).join(', '),
                    })
                  : t('{passing} rows pass, {failing} do not.', {
                      passing: validation.rows.length.toLocaleString(region.locale),
                      failing: validation.problems.length.toLocaleString(region.locale),
                    })
              }
            />
            <CardBody className="grid gap-3 text-[13px]">
              {validation.missingRequired.length === 0 &&
              spec.fields.some((f) => !placedKeys.has(f.key) && !f.required) ? (
                <p className="text-(--text-faint)">
                  {t('Not mapped, so not imported: {fields}.', {
                    fields: spec.fields
                      .filter((f) => !placedKeys.has(f.key))
                      .map((f) => t(f.label))
                      .join(', '),
                  })}
                </p>
              ) : null}
              {spec.id === 'balances' && validation.rows.length > 0 ? (
                <p className="text-(--text-soft)">
                  {batch.imbalance === 0
                    ? t('The debits and credits balance.')
                    : t('The sides differ by {amount}; the difference goes to retained earnings.', {
                        amount: Math.abs(batch.imbalance).toFixed(2),
                      })}
                </p>
              ) : null}
              {validation.problems.length ? (
                <table className="w-full">
                  <thead className="text-start text-[11px] uppercase tracking-wider text-(--text-faint)">
                    <tr>
                      <th className="py-1 pe-3">{t('Row')}</th>
                      <th className="py-1 pe-3">{t('Field')}</th>
                      <th className="py-1">{t('Problem')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.problems.slice(0, 100).map((p, i) => (
                      <tr key={i} className="border-t border-(--border)">
                        <td className="py-1 pe-3 tabular-nums">{p.row}</td>
                        <td className="py-1 pe-3">{t(p.field)}</td>
                        <td className="py-1">{t(p.message)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {validation.problems.length > 100 ? (
                <p className="text-(--text-faint)">
                  {t('And {count} more. Fix the file and upload it again, or import what passes.', {
                    count: validation.problems.length - 100,
                  })}
                </p>
              ) : null}
              {!imported && ready ? (
                <form action={run} className="mt-2">
                  <input type="hidden" name="batchId" value={batch.id} />
                  <Button type="submit" variant="primary" size="lg">
                    {t('Import {count} rows', {
                      count: validation.rows.length.toLocaleString(region.locale),
                    })}
                  </Button>
                  <p className="mt-2 text-[12px] text-(--text-faint)">
                    {t(
                      'Rows that fail the rules are left out and listed in the report. Each row goes in through the same checks the pages use, so a duplicate customer is refused, not doubled.',
                    )}
                  </p>
                </form>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
