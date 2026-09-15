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
import { PackageError, packagesFor, savePackage, setPackageActive } from '@/lib/packages';
import { prisma } from '@carnet/db';

export const metadata: Metadata = { title: 'Service packages' };
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
        <BackLink href="/settings">Settings</BackLink>
      </div>
      <PageHeader
        eyebrow="Settings"
        title="Service packages"
        description="Work priced and described as one thing, so a job starts with everything on it"
      />

      {params.problem ? (
        <Alert tone="danger" title="Not saved" className="mb-5">
          {params.problem}
        </Alert>
      ) : null}
      {params.saved ? (
        <Alert tone="success" className="mb-5">
          Saved. It is offered on new jobs, bookings, and to customers booking online.
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="overflow-hidden">
          <CardHeader title="Packages" description="One press puts all of it on a job." />
          {packages.length === 0 ? (
            <EmptyState
              title="No packages yet"
              description="Start with the one you sell most: a full service, an MOT with a check, a brake job."
            />
          ) : (
            <ul className="divide-y divide-(--border)">
              {packages.map((pkg) => (
                <li key={pkg.id} className="grid gap-1 px-4 py-3 text-[13px]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">
                      <span className="datum mr-2 text-[11px] text-(--text-faint)">{pkg.code}</span>
                      {pkg.name}
                      {!pkg.isActive ? (
                        <Badge tone="neutral" size="sm" className="ml-2">
                          retired
                        </Badge>
                      ) : null}
                    </span>
                    <span className="font-display text-[15px] font-semibold">
                      {money(pkg.total.price)}
                      {pkg.total.fixed && pkg.total.saving > 0 ? (
                        <span className="ml-1.5 text-[11px] font-normal text-(--success)">
                          saves {money(pkg.total.saving)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <p className="text-(--text-soft)">
                    {pkg.hours} h · {pkg.lines.length} line{pkg.lines.length === 1 ? '' : 's'}
                    {pkg.checks.length ? ` · ${pkg.checks.length} checks` : ''}
                    {pkg.jobType ? ` · ${pkg.jobType.name}` : ''}
                    {pkg.intervalMonths || pkg.intervalKm
                      ? ` · every ${[pkg.intervalMonths ? `${pkg.intervalMonths} months` : null, pkg.intervalKm ? `${pkg.intervalKm.toLocaleString(region.locale)} km` : null].filter(Boolean).join(' or ')}`
                      : ''}
                    {pkg.bookable ? ' · bookable online' : ''}
                  </p>
                  <div className="flex gap-3 text-[12px]">
                    <Link href={`/settings/packages?edit=${pkg.id}#editor`} className="underline">
                      Edit
                    </Link>
                    <form action={toggle}>
                      <input type="hidden" name="packageId" value={pkg.id} />
                      <input type="hidden" name="isActive" value={pkg.isActive ? '0' : '1'} />
                      <button type="submit" className="underline">
                        {pkg.isActive ? 'Retire' : 'Bring back'}
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
            title={editing ? `Edit ${editing.name}` : 'Add a package'}
            description="Labour by the hour, parts by the unit, fees as an amount. A fixed price overrides what the lines add up to."
          />
          <CardBody>
            <form action={save} className="grid gap-4">
              {editing ? <input type="hidden" name="packageId" value={editing.id} /> : null}
              <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)]">
                <Field label="Code">
                  <Input
                    name="code"
                    defaultValue={editing?.code ?? ''}
                    placeholder="FULL"
                    required
                  />
                </Field>
                <Field label="Name">
                  <Input
                    name="name"
                    defaultValue={editing?.name ?? ''}
                    placeholder="Full service"
                    required
                  />
                </Field>
              </div>
              <Field label="What the customer reads" hint="Optional. Shown when they book online.">
                <Input
                  name="description"
                  defaultValue={editing?.description ?? ''}
                  maxLength={240}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-4">
                <Field label="Minutes">
                  <Input
                    name="durationMinutes"
                    type="number"
                    min={5}
                    step={5}
                    defaultValue={editing?.durationMinutes ?? 60}
                  />
                </Field>
                <Field label={`Fixed price (${region.currency})`} hint="Blank: the lines add up.">
                  <Input
                    name="price"
                    type="number"
                    step="0.01"
                    min={0}
                    defaultValue={editing?.price ?? ''}
                  />
                </Field>
                <Field label="Every, months">
                  <Input
                    name="intervalMonths"
                    type="number"
                    min={1}
                    defaultValue={editing?.intervalMonths ?? ''}
                  />
                </Field>
                <Field label="Or every, km">
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
                <Field label="Kind of work">
                  <Select name="jobTypeId" defaultValue={editing?.jobType?.id ?? ''}>
                    <option value="">Not set</option>
                    {jobTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <label className="flex items-center gap-2 self-end pb-2 text-[13px]">
                  <input
                    type="checkbox"
                    name="bookable"
                    defaultChecked={editing?.bookable ?? true}
                    className="h-4 w-4"
                  />
                  Customers can book this online
                </label>
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-medium">Lines</p>
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
                          <option value="LABOUR">Labour</option>
                          <option value="PART">Part</option>
                          <option value="FEE">Fee</option>
                        </select>
                        <input
                          name={`line-${i}-description`}
                          defaultValue={line?.description ?? ''}
                          placeholder={i === 0 ? 'Service labour' : ''}
                          className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                        />
                        <input
                          name={`line-${i}-quantity`}
                          type="number"
                          step="0.25"
                          min="0"
                          defaultValue={line?.quantity ?? ''}
                          placeholder="qty"
                          className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                        />
                        <input
                          name={`line-${i}-price`}
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={line?.unitPrice ?? ''}
                          placeholder="each"
                          className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                        />
                        <input
                          name={`line-${i}-part`}
                          defaultValue={line?.partNumber ?? ''}
                          placeholder="part no."
                          className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-[11px] text-(--text-faint)">
                  Labour: hours and the rate. Part: units and the unit price; a part number reserves
                  stock when the job is approved. Fee: 1 and the amount.
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[13px] font-medium">Checklist</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {Array.from({ length: CHECK_SLOTS }).map((_, i) => (
                    <input
                      key={i}
                      name={`check-${i}`}
                      defaultValue={editing?.checks[i]?.title ?? ''}
                      placeholder={i === 0 ? 'Reset the service indicator' : ''}
                      className="rounded-(--radius-sm) border border-(--border-strong) bg-(--surface) px-2 py-1 text-[13px]"
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" variant="primary">
                  {editing ? 'Save the package' : 'Add the package'}
                </Button>
                {editing ? (
                  <Link href="/settings/packages" className="text-[13px] underline">
                    Cancel
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
