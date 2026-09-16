import { formatMinor } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { PackageError, packagesFor, savePackage, setPackageActive } from '@/lib/packages';
import { prisma } from '@carnet/db';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Service packages') };
}
export const dynamic = 'force-dynamic';

/**
 * Service packages. Phase 37.
 *
 * A piece of work priced and described as one thing: the labour, the
 * parts, the checklist, how long it takes, what it costs and how often it
 * comes round. Saved whole, so a job made from one is never made from a
 * half-edited one. The form is six lines and six checks because a package
 * with more than that is two packages.
 */
const LINE_SLOTS = 6;
const CHECK_SLOTS = 6;

async function save(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const packageId = String(formData.get('packageId') ?? '') || null;
  const price = String(formData.get('price') ?? '').trim();
  const months = String(formData.get('intervalMonths') ?? '').trim();
  const km = String(formData.get('intervalKm') ?? '').trim();

  const lines = [];
  for (let i = 0; i < LINE_SLOTS; i += 1) {
    const description = String(formData.get(`line-${i}-description`) ?? '').trim();
    if (!description) continue;
    const partNumber = String(formData.get(`line-${i}-part`) ?? '').trim();
    const product = partNumber
      ? await prisma.product.findFirst({ where: { orgId, partNumber }, select: { id: true } })
      : null;
    lines.push({
      kind: String(formData.get(`line-${i}-kind`) ?? 'LABOUR') as 'LABOUR' | 'PART' | 'FEE',
      description,
      quantity: Number(formData.get(`line-${i}-quantity`) ?? 1),
      unitPrice: Number(formData.get(`line-${i}-price`) ?? 0),
      productId: product?.id ?? null,
    });
    if (partNumber && !product) {
      redirect(
        // The sentence stays English in the address; the page translates it.
        // i18n-ignore
        `/settings/packages?${packageId ? `edit=${packageId}&` : ''}problem=${encodeURIComponent(`No part ${partNumber} on your books.`)}`,
      );
    }
  }
  const checks = [];
  for (let i = 0; i < CHECK_SLOTS; i += 1) {
    const title = String(formData.get(`check-${i}`) ?? '').trim();
    if (title) checks.push({ title });
  }

  try {
    await savePackage({
      orgId,
      userId: user.userId,
      packageId,
      code: String(formData.get('code') ?? ''),
      name: String(formData.get('name') ?? ''),
      description: String(formData.get('description') ?? ''),
      jobTypeId: String(formData.get('jobTypeId') ?? '') || null,
      durationMinutes: Number(formData.get('durationMinutes') ?? 60),
      price: price === '' ? null : Number(price),
      intervalMonths: months === '' ? null : Number(months),
      intervalKm: km === '' ? null : Number(km),
      bookable: formData.get('bookable') === 'on',
      lines,
      checks,
    });
  } catch (error) {
    if (error instanceof PackageError) {
      redirect(
        `/settings/packages?${packageId ? `edit=${packageId}&` : ''}problem=${encodeURIComponent(error.message)}`,
      );
    }
    throw error;
  }
  redirect('/settings/packages?saved=1');
}

async function toggle(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  await setPackageActive({
    orgId,
    userId: user.userId,
    packageId: String(formData.get('packageId') ?? ''),
    isActive: formData.get('isActive') === '1',
  });
  redirect('/settings/packages');
}

export default async function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; problem?: string; saved?: string }>;
}) {
  const { orgId, region } = await requireSession('settings:read');
  const params = await searchParams;
  const t = await tFor();
  const [packages, jobTypes] = await Promise.all([
    packagesFor(orgId),
    prisma.jobType.findMany({
      where: { orgId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
  ]);
  const editing = params.edit ? packages.find((p) => p.id === params.edit) : undefined;
  const money = (amount: number) =>
    formatMinor(Math.round(amount * 100), { currency: region.currency, locale: region.locale });

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">{t('Settings')}</BackLink>
      </div>
      <PageHeader
        eyebrow={t('Settings')}
        title={t('Service packages')}
        description={t(
          'Work priced and described as one thing, so a job starts with everything on it',
        )}
      />

      {params.problem ? (
        <Alert tone="danger" title={t('Not saved')} className="mb-5">
          {t(params.problem)}
        </Alert>
      ) : null}
      {params.saved ? (
        <Alert tone="success" className="mb-5">
          {t('Saved. It is offered on new jobs, bookings, and to customers booking online.')}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="overflow-hidden">
          <CardHeader title={t('Packages')} description={t('One press puts all of it on a job.')} />
          {packages.length === 0 ? (
            <EmptyState
              title={t('No packages yet')}
              description={t(
                'Start with the one you sell most: a full service, an MOT with a check, a brake job.',
              )}
            />
          ) : (
            <ul className="divide-y divide-(--border)">
              {packages.map((pkg) => (
                <li key={pkg.id} className="grid gap-1 px-4 py-3 text-[13px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      <span className="datum me-2 text-[11px] text-(--text-faint)">{pkg.code}</span>
                      {pkg.name}
                      {!pkg.isActive ? (
                        <Badge tone="neutral" size="sm" className="ms-2">
                          {t('retired')}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="font-display text-[15px] font-semibold">
                      {money(pkg.total.price)}
                      {pkg.total.fixed && pkg.total.saving > 0 ? (
                        <span className="ms-1.5 text-[11px] font-normal text-(--success)">
                          {t('saves {amount}', { amount: money(pkg.total.saving) })}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="text-(--text-soft)">
                    {[
                      t('{hours} h', { hours: pkg.hours }),
                      pkg.lines.length === 1
                        ? t('1 line')
                        : t('{count} lines', { count: pkg.lines.length }),
                      pkg.checks.length === 0
                        ? null
                        : pkg.checks.length === 1
                          ? t('1 check')
                          : t('{count} checks', { count: pkg.checks.length }),
                      pkg.jobType?.name ?? null,
                      pkg.intervalMonths && pkg.intervalKm
                        ? t('every {months} months or {km} km', {
                            months: pkg.intervalMonths,
                            km: pkg.intervalKm.toLocaleString(region.locale),
                          })
                        : pkg.intervalMonths
                          ? t('every {months} months', { months: pkg.intervalMonths })
                          : pkg.intervalKm
                            ? t('every {km} km', {
                                km: pkg.intervalKm.toLocaleString(region.locale),
                              })
                            : null,
                      pkg.bookable ? t('bookable online') : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <div className="flex gap-3 text-[12px]">
                    <Link href={`/settings/packages?edit=${pkg.id}#editor`} className="underline">
                      {t('Edit')}
                    </Link>
                    <form action={toggle}>
                      <input type="hidden" name="packageId" value={pkg.id} />
                      <input type="hidden" name="isActive" value={pkg.isActive ? '0' : '1'} />
                      <button type="submit" className="underline">
                        {pkg.isActive ? t('Retire') : t('Bring back')}
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card id="editor">
          <CardHeader
            title={editing ? t('Edit {name}', { name: editing.name }) : t('Add a package')}
            description={t(
              'Labour by the hour, parts by the unit, fees as an amount. A fixed price overrides what the lines add up to.',
            )}
          />
          <CardBody>
            <form action={save} className="grid gap-4">
              {editing ? <input type="hidden" name="packageId" value={editing.id} /> : null}
              <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <Field label={t('Code')}>
                  <Input
                    name="code"
                    defaultValue={editing?.code ?? ''}
                    // i18n-ignore
                    placeholder="FULL"
                    required
                  />
                </Field>
                <Field label={t('Name')}>
                  <Input
                    name="name"
                    defaultValue={editing?.name ?? ''}
                    placeholder={t('Full service')}
                    required
                  />
                </Field>
              </div>
              <Field
                label={t('What the customer reads')}
                hint={t('Optional. Shown when they book online.')}
              >
                <Input
                  name="description"
                  defaultValue={editing?.description ?? ''}
                  maxLength={240}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label={t('Minutes')}>
                  <Input
                    name="durationMinutes"
                    type="number"
                    min={5}
                    step={5}
                    defaultValue={editing?.durationMinutes ?? 60}
                  />
                </Field>
                <Field
                  label={t('Fixed price ({currency})', { currency: region.currency })}
                  hint={t('Blank: the lines add up.')}
                >
                  <Input
                    name="price"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={editing?.price ?? ''}
                  />
                </Field>
                <Field label={t('Every, months')}>
                  <Input
                    name="intervalMonths"
                    type="number"
                    min={1}
                    defaultValue={editing?.intervalMonths ?? ''}
                  />
                </Field>
                <Field label={t('Or every, km')}>
                  <Input
                    name="intervalKm"
                    type="number"
                    min={1}
                    step={1000}
                    defaultValue={editing?.intervalKm ?? ''}
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Kind of work')}>
                  <Select name="jobTypeId" defaultValue={editing?.jobType?.id ?? ''}>
                    <option value="">{t('Not set')}</option>
                    {jobTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
                  <input
                    type="checkbox"
                    name="bookable"
                    defaultChecked={editing?.bookable ?? true}
                    className="h-4 w-4 pointer-coarse:h-6 pointer-coarse:w-6"
                  />
                  {t('Customers can book this online')}
                </label>
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-medium">{t('Lines')}</p>
                <div className="grid gap-1.5">
                  {Array.from({ length: LINE_SLOTS }).map((_, i) => {
                    const line = editing?.lines[i];
                    return (
                      <div
                        key={i}
                        className="grid grid-cols-[6rem_minmax(0,1fr)_4.5rem_5.5rem_7rem] gap-1.5"
                      >
                        <select
                          name={`line-${i}-kind`}
                          defaultValue={line?.kind ?? 'LABOUR'}
                          className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 text-[12px]"
                        >
                          <option value="LABOUR">{t('Labour')}</option>
                          <option value="PART">{t('Part')}</option>
                          <option value="FEE">{t('Fee')}</option>
                        </select>
                        <input
                          name={`line-${i}-description`}
                          defaultValue={line?.description ?? ''}
                          placeholder={i === 0 ? t('Service labour') : ''}
                          className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                        />
                        <input
                          name={`line-${i}-quantity`}
                          type="number"
                          step="0.25"
                          min="0"
                          defaultValue={line?.quantity ?? ''}
                          placeholder={t('qty')}
                          className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                        />
                        <input
                          name={`line-${i}-price`}
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={line?.unitPrice ?? ''}
                          placeholder={t('each')}
                          className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                        />
                        <input
                          name={`line-${i}-part`}
                          defaultValue={line?.partNumber ?? ''}
                          placeholder={t('part no.')}
                          className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-(--text-faint)">
                  {t(
                    'Labour: hours and the rate. Part: units and the unit price; a part number reserves stock when the job is approved. Fee: 1 and the amount.',
                  )}
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-medium">{t('Checklist')}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {Array.from({ length: CHECK_SLOTS }).map((_, i) => (
                    <input
                      key={i}
                      name={`check-${i}`}
                      defaultValue={editing?.checks[i]?.title ?? ''}
                      placeholder={i === 0 ? t('Reset the service indicator') : ''}
                      className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary">
                  {editing ? t('Save the package') : t('Add the package')}
                </Button>
                {editing ? (
                  <Link href="/settings/packages" className="text-[13px] underline">
                    {t('Cancel')}
                  </Link>
                ) : null}
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
