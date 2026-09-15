import { Alert, Badge, Button, Card, CardBody, CardHeader, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { importDetail, ImportError, runImport, saveMapping } from '@/lib/imports';

export const metadata: Metadata = { title: 'Import' };
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
        <BackLink href="/settings/data">Data in and out</BackLink>
      </div>
      <PageHeader
        eyebrow={`Import · ${spec.title}`}
        title={batch.fileName}
        description={`${rows.length.toLocaleString(region.locale)} rows. ${spec.becomes}`}
        actions={
          <Badge tone={imported ? 'success' : ready ? 'warning' : 'neutral'} dot>
            {imported ? 'Imported' : ready ? 'Ready to import' : 'Mapping needed'}
          </Badge>
        }
      />

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {problem}
        </Alert>
      ) : null}
      {saved ? (
        <Alert tone="success" className="mb-5">
          Mapping saved. The preview below is run against it.
        </Alert>
      ) : null}
      {done && report ? (
        <Alert
          tone={report.failed.length || report.invalid ? 'warning' : 'success'}
          title="Imported"
          className="mb-5"
        >
          {report.imported.toLocaleString(region.locale)} went in.{' '}
          {report.invalid ? `${report.invalid} failed the rules and were left out. ` : ''}
          {report.failed.length ? `${report.failed.length} could not be written. ` : ''}
          The report below says which, and why.
        </Alert>
      ) : null}

      {imported && report ? (
        <Card className="mb-5">
          <CardHeader
            title="What became of it"
            description={`Run ${batch.importedAt?.toLocaleString(region.locale, { dateStyle: 'medium', timeStyle: 'short' })}.`}
          />
          <CardBody className="grid gap-3 text-[13px]">
            <p>
              <span className="font-medium">{report.imported.toLocaleString(region.locale)}</span>{' '}
              imported. <span className="font-medium">{report.invalid}</span> failed the rules
              before anything was written.{' '}
              <span className="font-medium">{report.failed.length}</span> passed the rules and were
              refused at the point of writing.
            </p>
            {report.notes.length ? (
              <ul className="grid gap-1 text-(--text-soft)">
                {report.notes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            ) : null}
            {report.failed.length ? (
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-wider text-(--text-faint)">
                  <tr>
                    <th className="py-1 pr-3">Row</th>
                    <th className="py-1">Why it did not go in</th>
                  </tr>
                </thead>
                <tbody>
                  {report.failed.slice(0, 200).map((f) => (
                    <tr key={f.row} className="border-t border-(--border)">
                      <td className="py-1 pr-3 tabular-nums">{f.row}</td>
                      <td className="py-1">{f.message}</td>
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
            title="1. Which column is which"
            description="Suggested from your headers. Anything left as ignored is not imported."
          />
          <CardBody>
            <form action={map} className="grid gap-3">
              <input type="hidden" name="batchId" value={batch.id} />
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-wider text-(--text-faint)">
                  <tr>
                    <th className="py-1 pr-3">Your column</th>
                    <th className="py-1 pr-3">First rows</th>
                    <th className="py-1">Becomes</th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((header, index) => (
                    <tr key={index} className="border-t border-(--border) align-top">
                      <td className="py-2 pr-3 font-medium">{header || `Column ${index + 1}`}</td>
                      <td className="py-2 pr-3 text-(--text-faint)">
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
                          <option value="">Ignore</option>
                          {spec.fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                              {f.required ? ' (required)' : ''}
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
                    Save the mapping and preview
                  </Button>
                </div>
              ) : null}
              <ul className="grid gap-0.5 text-[12px] text-(--text-faint)">
                {spec.fields
                  .filter((f) => f.hint)
                  .map((f) => (
                    <li key={f.key}>
                      <span className="font-medium text-(--text-soft)">{f.label}.</span> {f.hint}
                    </li>
                  ))}
              </ul>
            </form>
          </CardBody>
        </Card>

        <div className="grid content-start gap-5">
          <Card className={ready && !imported ? 'border-(--brand)' : undefined}>
            <CardHeader
              title="2. What would go in"
              description={
                validation.missingRequired.length
                  ? `Map ${validation.missingRequired.join(' and ')} first.`
                  : `${validation.rows.length.toLocaleString(region.locale)} rows pass, ${validation.problems.length.toLocaleString(region.locale)} do not.`
              }
            />
            <CardBody className="grid gap-3 text-[13px]">
              {validation.missingRequired.length === 0 &&
              spec.fields.some((f) => !placedKeys.has(f.key) && !f.required) ? (
                <p className="text-(--text-faint)">
                  Not mapped, so not imported:{' '}
                  {spec.fields
                    .filter((f) => !placedKeys.has(f.key))
                    .map((f) => f.label)
                    .join(', ')}
                  .
                </p>
              ) : null}
              {spec.id === 'balances' && validation.rows.length > 0 ? (
                <p className="text-(--text-soft)">
                  {batch.imbalance === 0
                    ? 'The debits and credits balance.'
                    : `The sides differ by ${Math.abs(batch.imbalance).toFixed(2)}; the difference goes to retained earnings.`}
                </p>
              ) : null}
              {validation.problems.length ? (
                <table className="w-full">
                  <thead className="text-left text-[11px] uppercase tracking-wider text-(--text-faint)">
                    <tr>
                      <th className="py-1 pr-3">Row</th>
                      <th className="py-1 pr-3">Field</th>
                      <th className="py-1">Problem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validation.problems.slice(0, 100).map((p, i) => (
                      <tr key={i} className="border-t border-(--border)">
                        <td className="py-1 pr-3 tabular-nums">{p.row}</td>
                        <td className="py-1 pr-3">{p.field}</td>
                        <td className="py-1">{p.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
              {validation.problems.length > 100 ? (
                <p className="text-(--text-faint)">
                  And {validation.problems.length - 100} more. Fix the file and upload it again, or
                  import what passes.
                </p>
              ) : null}
              {!imported && ready ? (
                <form action={run} className="mt-2">
                  <input type="hidden" name="batchId" value={batch.id} />
                  <Button type="submit" variant="primary" size="lg">
                    Import {validation.rows.length.toLocaleString(region.locale)} rows
                  </Button>
                  <p className="mt-2 text-[12px] text-(--text-faint)">
                    Rows that fail the rules are left out and listed in the report. Each row goes in
                    through the same checks the pages use, so a duplicate customer is refused, not
                    doubled.
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
