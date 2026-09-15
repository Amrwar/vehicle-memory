import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
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
import { requireSession } from '@/lib/guard';
import { saveTaxRateWithParts, TaxError } from '@/lib/tax';
import { tFor } from '@/lib/i18n';
import {
  catalogueSettings,
  saveJobType,
  setDefaultTaxRate,
  setJobTypeActive,
  SettingsError,
  setTaxRateActive,
} from '@/lib/settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Tax rates and kinds of work') };
}
export const dynamic = 'force-dynamic';

/**
 * Tax rates and kinds of work. FR-4604, FR-4605.
 *
 * Two lists every job reaches for. A tax rate that has been invoiced cannot
 * have its percentage changed, because the lines priced at it would re-price
 * underneath a document already sent; a new percentage is a new rate. There
 * is always exactly one default. Kinds of work carry a colour for the diary,
 * a default duration for the planner and whether a second pair of eyes is
 * required before the car goes back.
 */

function back(problem: string): never {
  redirect(`/settings/catalogue?problem=${encodeURIComponent(problem)}`);
}

async function saveRate(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  // Up to three taxes on one rate, each with its name and percentage, and
  // whether it is charged on top of the ones before it. Phase 41.
  const parts = [0, 1, 2]
    .map((index) => ({
      name: String(formData.get(`part.${index}.name`) ?? '').trim(),
      rate: String(formData.get(`part.${index}.rate`) ?? '').trim(),
      compound: formData.get(`part.${index}.compound`) === 'yes',
    }))
    .filter((part) => part.name || part.rate)
    .map((part) => ({ name: part.name, ratePct: Number(part.rate), compound: part.compound }));

  try {
    await saveTaxRateWithParts({
      orgId,
      userId: user.userId,
      taxRateId: String(formData.get('taxRateId') ?? '') || null,
      name: String(formData.get('name') ?? ''),
      parts,
    });
  } catch (error) {
    if (error instanceof SettingsError || error instanceof TaxError) back(error.message);
    throw error;
  }

  redirect('/settings/catalogue?saved=rate');
}

async function makeDefault(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await setDefaultTaxRate({
      orgId,
      userId: user.userId,
      taxRateId: String(formData.get('taxRateId') ?? ''),
    });
  } catch (error) {
    if (error instanceof SettingsError) back(error.message);
    throw error;
  }

  redirect('/settings/catalogue?saved=rate');
}

async function toggleRate(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await setTaxRateActive({
      orgId,
      userId: user.userId,
      taxRateId: String(formData.get('taxRateId') ?? ''),
      active: String(formData.get('active') ?? '') === 'yes',
    });
  } catch (error) {
    if (error instanceof SettingsError) back(error.message);
    throw error;
  }

  redirect('/settings/catalogue?saved=rate');
}

async function saveType(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const hours = String(formData.get('defaultHours') ?? '').trim();

  try {
    await saveJobType({
      orgId,
      userId: user.userId,
      jobTypeId: String(formData.get('jobTypeId') ?? '') || null,
      name: String(formData.get('name') ?? ''),
      colour: String(formData.get('colour') ?? ''),
      defaultHours: hours ? Number(hours) : null,
      requiresQualityCheck: formData.get('requiresQualityCheck') === 'on',
    });
  } catch (error) {
    if (error instanceof SettingsError) back(error.message);
    throw error;
  }

  redirect('/settings/catalogue?saved=type');
}

async function toggleType(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await setJobTypeActive({
      orgId,
      userId: user.userId,
      jobTypeId: String(formData.get('jobTypeId') ?? ''),
      active: String(formData.get('active') ?? '') === 'yes',
    });
  } catch (error) {
    if (error instanceof SettingsError) back(error.message);
    throw error;
  }

  redirect('/settings/catalogue?saved=type');
}

export default async function CatalogueSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; problem?: string; rate?: string; type?: string }>;
}) {
  const { orgId } = await requireSession('settings:write');
  const { saved, problem, rate: editRate, type: editType } = await searchParams;
  const { taxRates, jobTypes } = await catalogueSettings(orgId);
  const t = await tFor();

  const editingRate = taxRates.find((row) => row.id === editRate) ?? null;
  const editingType = jobTypes.find((row) => row.id === editType) ?? null;

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">{t('Settings')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Settings')}
        title={t('Tax rates and kinds of work')}
        description={t('The two lists every job reaches for')}
      />

      {saved ? (
        <Alert tone="success" className="mb-5">
          {t('Saved. The change is in the audit log with what it was before.')}
        </Alert>
      ) : null}
      {problem ? (
        <Alert tone="danger" title={t('Not saved')} className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid gap-5 content-start">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('Tax rates')}
              description={t('Exactly one is the default for new lines')}
            />
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Rate')}</Th>
                    <Th className="text-end">%</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {taxRates.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        {row.name}
                        {row.components.length > 1 ||
                        (row.components[0] && row.components[0].name !== row.name) ? (
                          <span className="block text-[12px] text-(--text-faint)">
                            {row.components
                              .map((part) =>
                                part.compound
                                  ? t('{name} {rate}% on top', {
                                      name: part.name,
                                      rate: Number(part.rate),
                                    })
                                  : `${part.name} ${Number(part.rate)}%`,
                              )
                              .join(' + ')}
                          </span>
                        ) : null}
                        {row.isDefault ? (
                          <Badge tone="brand" size="sm" className="ms-2">
                            {t('default')}
                          </Badge>
                        ) : null}
                        {!row.isActive ? (
                          <Badge tone="neutral" size="sm" className="ms-2">
                            {t('retired')}
                          </Badge>
                        ) : null}
                      </Td>
                      <Td className="datum text-end">{Number(row.rate)}</Td>
                      <Td className="text-end whitespace-nowrap">
                        {row.isActive ? (
                          <a
                            href={`/settings/catalogue?rate=${row.id}#rate`}
                            className="me-2 text-[13px] text-(--brand-text) hover:underline"
                          >
                            {t('Edit')}
                          </a>
                        ) : null}
                        {row.isActive && !row.isDefault ? (
                          <form action={makeDefault} className="inline">
                            <input type="hidden" name="taxRateId" value={row.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              {t('Make default')}
                            </Button>
                          </form>
                        ) : null}
                        {!row.isDefault ? (
                          <form action={toggleRate} className="inline">
                            <input type="hidden" name="taxRateId" value={row.id} />
                            <input
                              type="hidden"
                              name="active"
                              value={row.isActive ? 'no' : 'yes'}
                            />
                            <Button type="submit" variant="ghost" size="sm">
                              {row.isActive ? t('Retire') : t('Restore')}
                            </Button>
                          </form>
                        ) : null}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          <Card id="rate">
            <CardHeader
              title={
                editingRate ? t('Edit {name}', { name: editingRate.name }) : t('Add a tax rate')
              }
            />
            <form action={saveRate}>
              {editingRate ? <input type="hidden" name="taxRateId" value={editingRate.id} /> : null}
              <CardBody className="grid gap-4">
                <Field label={t('Name')} hint={t('As it reads on the invoice')}>
                  <Input
                    name="name"
                    defaultValue={editingRate?.name ?? ''}
                    required
                    maxLength={40}
                    placeholder={t('VAT 20%')}
                  />
                </Field>
                <div className="grid gap-2">
                  <p className="text-[13px] font-medium">{t('The taxes on this rate')}</p>
                  <p className="text-[12px] text-(--text-faint)">
                    {t(
                      'Most rates are one tax. Where two are charged on the same line, add the second; tick “on top” where it is charged on the price with the first tax in.',
                    )}
                  </p>
                  {[0, 1, 2].map((index) => {
                    const part = editingRate?.components[index];
                    return (
                      <div
                        key={index}
                        className="grid items-end gap-2 sm:grid-cols-[1fr_7rem_auto]"
                      >
                        <Field label={t('Tax {number}', { number: index + 1 })}>
                          <Input
                            name={`part.${index}.name`}
                            defaultValue={
                              part?.name ?? (index === 0 && editingRate ? editingRate.name : '')
                            }
                            required={index === 0}
                            maxLength={40}
                            placeholder={index === 0 ? t('VAT') : ''}
                          />
                        </Field>
                        <Field label={t('Percent')}>
                          <Input
                            name={`part.${index}.rate`}
                            type="number"
                            min={0}
                            max={100}
                            step="0.001"
                            defaultValue={
                              part
                                ? Number(part.rate)
                                : index === 0 && editingRate
                                  ? Number(editingRate.rate)
                                  : ''
                            }
                            required={index === 0}
                          />
                        </Field>
                        {index > 0 ? (
                          <label className="flex items-center gap-2 pb-2 text-[13px]">
                            <input
                              type="checkbox"
                              name={`part.${index}.compound`}
                              value="yes"
                              defaultChecked={part?.compound ?? false}
                            />
                            {t('on top')}
                          </label>
                        ) : (
                          <span />
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardBody>
              <CardBody className="flex gap-2 border-t border-(--border)">
                <Button type="submit" variant="primary">
                  {editingRate ? t('Save rate') : t('Add rate')}
                </Button>
                {editingRate ? (
                  <a
                    href="/settings/catalogue"
                    className="self-center text-[13px] text-(--text-soft) hover:underline"
                  >
                    {t('Cancel')}
                  </a>
                ) : null}
              </CardBody>
            </form>
            <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
              {t(
                'A rate that has been invoiced keeps its taxes. Add the new one and retire the old, so what was invoiced still reads the way it was sent.',
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-5 content-start">
          <Card className="overflow-hidden">
            <CardHeader
              title={t('Kinds of work')}
              description={t('Colour for the diary, hours for the planner')}
            />
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>{t('Kind')}</Th>
                    <Th className="text-end">{t('Hours')}</Th>
                    <Th>{t('Checks')}</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {jobTypes.map((row) => (
                    <Tr key={row.id}>
                      <Td>
                        <span
                          aria-hidden
                          className="me-2 inline-block h-2.5 w-2.5 rounded-full align-middle"
                          style={{ backgroundColor: row.colour }}
                        />
                        {row.name}
                        {!row.isActive ? (
                          <Badge tone="neutral" size="sm" className="ms-2">
                            {t('retired')}
                          </Badge>
                        ) : null}
                        <span className="ms-2 text-[12px] text-(--text-faint)">
                          {row._count.jobs === 1
                            ? t('1 job')
                            : t('{count} jobs', { count: row._count.jobs })}
                          {row._count.skills > 0
                            ? ` · ${
                                row._count.skills === 1
                                  ? t('1 skill')
                                  : t('{count} skills', { count: row._count.skills })
                              }`
                            : ''}
                        </span>
                      </Td>
                      <Td className="datum text-end">
                        {row.defaultHours === null ? '—' : Number(row.defaultHours)}
                      </Td>
                      <Td className="text-(--text-soft)">
                        {row.requiresQualityCheck ? t('Quality check') : '—'}
                      </Td>
                      <Td className="text-end whitespace-nowrap">
                        {row.isActive ? (
                          <a
                            href={`/settings/catalogue?type=${row.id}#type`}
                            className="me-2 text-[13px] text-(--brand-text) hover:underline"
                          >
                            {t('Edit')}
                          </a>
                        ) : null}
                        <form action={toggleType} className="inline">
                          <input type="hidden" name="jobTypeId" value={row.id} />
                          <input type="hidden" name="active" value={row.isActive ? 'no' : 'yes'} />
                          <Button type="submit" variant="ghost" size="sm">
                            {row.isActive ? t('Retire') : t('Restore')}
                          </Button>
                        </form>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          </Card>

          <Card id="type">
            <CardHeader
              title={
                editingType ? t('Edit {name}', { name: editingType.name }) : t('Add a kind of work')
              }
              description={
                editingType ? undefined : t('Skills it needs are set on the skills page')
              }
            />
            <form action={saveType}>
              {editingType ? <input type="hidden" name="jobTypeId" value={editingType.id} /> : null}
              <CardBody className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_7rem_7rem]">
                  <Field label={t('Name')}>
                    <Input
                      name="name"
                      defaultValue={editingType?.name ?? ''}
                      required
                      maxLength={60}
                      placeholder={t('Brake repair')}
                    />
                  </Field>
                  <Field label={t('Colour')}>
                    <Input
                      name="colour"
                      type="color"
                      defaultValue={editingType?.colour ?? '#2a41d8'}
                      required
                      className="h-9 p-1"
                    />
                  </Field>
                  <Field label={t('Hours')} hint={t('Usual')}>
                    <Input
                      name="defaultHours"
                      type="number"
                      min={0}
                      max={100}
                      step="0.25"
                      defaultValue={
                        editingType?.defaultHours === null || editingType === null
                          ? ''
                          : Number(editingType.defaultHours)
                      }
                    />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    name="requiresQualityCheck"
                    defaultChecked={editingType?.requiresQualityCheck ?? false}
                    className="h-4 w-4"
                  />
                  {t('Needs a quality check before the car goes back')}
                </label>
              </CardBody>
              <CardBody className="flex gap-2 border-t border-(--border)">
                <Button type="submit" variant="primary">
                  {editingType ? t('Save kind of work') : t('Add kind of work')}
                </Button>
                {editingType ? (
                  <a
                    href="/settings/catalogue"
                    className="self-center text-[13px] text-(--text-soft) hover:underline"
                  >
                    {t('Cancel')}
                  </a>
                ) : null}
              </CardBody>
            </form>
          </Card>
        </div>
      </div>
    </>
  );
}
