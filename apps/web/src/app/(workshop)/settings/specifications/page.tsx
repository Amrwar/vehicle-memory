import { SPEC_LINES } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import {
  modelSheets,
  recordModelSheet,
  removeSheet,
  SpecificationError,
} from '@/lib/specification';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('What each model takes') };
}
export const dynamic = 'force-dynamic';

/**
 * The sheets, written once per model.
 *
 * This is the screen that pays for the feature. Fourteen numbers typed once
 * for a make, model, year range and engine are then held by every car that
 * decodes to it — and a car is added from its VIN, which Phase 43 decodes into
 * exactly those four things. Nobody types a spec per car, and nobody buys a
 * specification database.
 *
 * Nothing is defaulted here either. A sheet with three lines filled in is a
 * sheet with three lines filled in, and the count says so rather than a
 * progress bar implying somebody is behind on homework.
 *
 * Phase 88.
 */

async function save(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  const values: Record<string, string> = {};
  for (const line of SPEC_LINES) values[line.key] = String(formData.get(line.key) ?? '');

  const number = (name: string) => {
    const raw = String(formData.get(name) ?? '').trim();
    return raw === '' ? null : Number(raw);
  };

  try {
    await recordModelSheet({
      orgId,
      userId: user.userId,
      sheetId: String(formData.get('sheetId') ?? '') || null,
      make: String(formData.get('make') ?? ''),
      model: String(formData.get('model') ?? ''),
      yearFrom: number('yearFrom'),
      yearTo: number('yearTo'),
      engineCode: String(formData.get('engineCode') ?? ''),
      values,
    });
  } catch (error) {
    const message =
      error instanceof SpecificationError ? error.message : 'That sheet could not be saved.';
    redirect(`/settings/specifications?warning=${encodeURIComponent(message)}`);
  }

  redirect('/settings/specifications?saved=1');
}

async function drop(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await removeSheet({
      orgId,
      userId: user.userId,
      sheetId: String(formData.get('sheetId') ?? ''),
    });
  } catch (error) {
    const message =
      error instanceof SpecificationError ? error.message : 'That sheet could not be removed.';
    redirect(`/settings/specifications?warning=${encodeURIComponent(message)}`);
  }

  redirect('/settings/specifications');
}

export default async function SpecificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ warning?: string; saved?: string; edit?: string }>;
}) {
  const { orgId, user } = await requireSession('settings:read');
  const t = await tFor();

  const { warning, saved, edit } = await searchParams;
  const sheets = await modelSheets(orgId);
  const mayWrite = can(user.role, 'settings:write');
  const editing = edit ? (sheets.find((sheet) => sheet.id === edit) ?? null) : null;

  const describe = (sheet: (typeof sheets)[number]) =>
    [
      sheet.make,
      sheet.model,
      sheet.yearFrom || sheet.yearTo
        ? `${sheet.yearFrom ?? ''}–${sheet.yearTo ?? ''}`.replace(/^–|–$/, '')
        : null,
      sheet.engineCode,
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">{t('Settings')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Settings')}
        title={t('What each model takes')}
        description={t(
          'Oil, coolant, brake fluid, tyres, battery and intervals, written once for a model. Every car that decodes to it inherits them.',
        )}
      />

      {warning ? (
        <Alert tone="warning" className="mt-4">
          {warning}
        </Alert>
      ) : null}
      {saved ? (
        <Alert tone="success" className="mt-4">
          {t('Saved.')}
        </Alert>
      ) : null}

      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title={t('Your sheets')}
          description={t('{count} written so far', { count: sheets.length })}
        />
        <CardBody className="p-0">
          {sheets.length === 0 ? (
            <p className="p-4 text-[13px] text-(--text-faint)">
              {t('No sheets yet. Write one below for a model you see often.')}
            </p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>{t('Model')}</Th>
                    <Th>{t('Filled in')}</Th>
                    <Th>{t('Engine oil')}</Th>
                    <Th> </Th>
                  </Tr>
                </thead>
                <tbody>
                  {sheets.map((sheet) => (
                    <Tr key={sheet.id}>
                      <Td>
                        <span className="font-medium">{describe(sheet)}</span>
                        {sheet.feedName ? (
                          <Badge tone="neutral" className="ms-2">
                            {sheet.feedName}
                          </Badge>
                        ) : null}
                      </Td>
                      <Td>
                        {t('{answered} of {of}', {
                          answered: sheet.answered,
                          of: SPEC_LINES.length,
                        })}
                      </Td>
                      <Td>{sheet.values.oilGrade ?? '—'}</Td>
                      <Td>
                        {mayWrite ? (
                          <span className="flex gap-2">
                            <a
                              href={`/settings/specifications?edit=${sheet.id}`}
                              className="text-[12px] text-(--brand-text) hover:underline"
                            >
                              {t('Edit')}
                            </a>
                            <form action={drop}>
                              <input type="hidden" name="sheetId" value={sheet.id} />
                              <Button type="submit" variant="ghost" className="text-[12px]">
                                {t('Remove')}
                              </Button>
                            </form>
                          </span>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      {mayWrite ? (
        <Card className="mt-5">
          <CardHeader
            title={editing ? t('Edit this sheet') : t('Write a sheet')}
            description={t(
              'Leave anything you do not know empty. A blank sends somebody to look it up; a wrong number does not.',
            )}
          />
          <CardBody>
            <form action={save} className="grid gap-4">
              <input type="hidden" name="sheetId" value={editing?.id ?? ''} />

              <div className="grid gap-2 md:grid-cols-4">
                <Input
                  name="make"
                  required
                  defaultValue={editing?.make ?? ''}
                  placeholder={t('Make')}
                  aria-label={t('Make')}
                />
                <Input
                  name="model"
                  defaultValue={editing?.model ?? ''}
                  placeholder={t('Model')}
                  aria-label={t('Model')}
                />
                <Input
                  name="yearFrom"
                  type="number"
                  defaultValue={editing?.yearFrom ?? ''}
                  placeholder={t('From year')}
                  aria-label={t('From year')}
                />
                <Input
                  name="yearTo"
                  type="number"
                  defaultValue={editing?.yearTo ?? ''}
                  placeholder={t('To year')}
                  aria-label={t('To year')}
                />
                <Input
                  name="engineCode"
                  defaultValue={editing?.engineCode ?? ''}
                  placeholder={t('Engine code')}
                  aria-label={t('Engine code')}
                />
              </div>

              <div className="grid gap-2 md:grid-cols-3">
                {SPEC_LINES.map((line) => (
                  <Input
                    key={line.key}
                    name={line.key}
                    defaultValue={String(editing?.values[line.key] ?? '')}
                    placeholder={line.unit ? `${t(line.label)} (${t(line.unit)})` : t(line.label)}
                    aria-label={t(line.label)}
                  />
                ))}
              </div>

              <div>
                <Button type="submit">
                  {editing ? t('Save the sheet') : t('Write the sheet')}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
