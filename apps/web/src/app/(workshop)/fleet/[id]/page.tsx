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
  Mileage,
  Money,
  PageHeader,
  Registration,
  Select,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import {
  consolidateMonth,
  fleetAgreementFor,
  fleetDetail,
  FleetError,
  saveFleetAgreement,
} from '@/lib/fleet';
import {
  clearFleetNumber,
  FleetNumberError,
  fleetNumbersFor,
  setFleetNumber,
} from '@/lib/fleet-numbers';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

/**
 * What this company calls one of its own vans. Phase 69, FR-303.
 *
 * On the fleet rather than on the vehicle, because the number belongs to the
 * relationship: "Van 17" is Northgate's name for a Transit, not a fact about
 * the Transit, and the van will outlive their ownership of it.
 */
async function nameVan(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('vehicle:write');
  const customerId = String(formData.get('customerId') ?? '');
  const number = String(formData.get('number') ?? '');

  try {
    if (number.trim().length === 0) {
      await clearFleetNumber({
        orgId,
        userId: user.userId,
        customerId,
        vehicleId: String(formData.get('vehicleId') ?? ''),
      });
    } else {
      await setFleetNumber({
        orgId,
        userId: user.userId,
        customerId,
        vehicleId: String(formData.get('vehicleId') ?? ''),
        number,
      });
    }
  } catch (error) {
    if (!(error instanceof FleetNumberError)) throw error;
    redirect(`/fleet/${customerId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/fleet/${customerId}`);
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Fleet') };
}
export const dynamic = 'force-dynamic';

/**
 * One fleet, vehicle by vehicle. FR-3011.
 *
 * Ordered by what is wrong rather than by registration: waiting on the
 * customer first, then in the workshop, then overdue, then due soon, then
 * everything healthy. A fleet manager opens this to find out what needs
 * deciding, not to admire the vans that are fine.
 */
function date(value: Date | null, locale: string): string {
  return value
    ? value.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}

/** Saves the fleet's terms. */
async function saveTerms(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const customerId = String(formData.get('customerId') ?? '');

  try {
    await saveFleetAgreement({
      orgId,
      userId: user.userId,
      customerId,
      agreement: {
        labourDiscountPct: Number(formData.get('labourDiscountPct') ?? 0) || 0,
        partsDiscountPct: Number(formData.get('partsDiscountPct') ?? 0) || 0,
        paymentTermsDays: Number(formData.get('paymentTermsDays') ?? 30) || 30,
        consolidateMonthly: formData.get('consolidateMonthly') === 'on',
        purchaseOrderRequired: formData.get('purchaseOrderRequired') === 'on',
        notes: String(formData.get('notes') ?? ''),
      },
    });
  } catch (error) {
    if (!(error instanceof FleetError)) throw error;
    redirect(`/fleet/${customerId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/fleet/${customerId}?done=terms`);
}

/** Issues one invoice for a month of the fleet's completed work. */
async function invoiceMonth(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('invoice:write');
  const customerId = String(formData.get('customerId') ?? '');
  const [year, month] = String(formData.get('month') ?? '')
    .split('-')
    .map((part) => Number(part));

  let invoiceId: string;

  try {
    invoiceId = await consolidateMonth({
      orgId,
      userId: user.userId,
      customerId,
      year: year || new Date().getFullYear(),
      month: month || new Date().getMonth() + 1,
    });
  } catch (error) {
    if (!(error instanceof FleetError)) throw error;
    redirect(`/fleet/${customerId}?problem=${encodeURIComponent(error.message)}`);
  }

  redirect(`/invoices/${invoiceId}`);
}

export default async function FleetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ problem?: string; done?: string }>;
}) {
  const { orgId, user, region } = await requireSession('customer:read');
  const { id } = await params;
  const notice = await searchParams;
  const t = await tFor();

  const [fleet, numbers, agreement] = await Promise.all([
    fleetDetail(orgId, id),
    fleetNumbersFor(orgId, id),
    fleetAgreementFor(orgId, id),
  ]);
  if (!fleet) notFound();

  // Last month by default: the month that has finished is the one to invoice.
  const lastMonth = new Date();
  lastMonth.setDate(1);
  lastMonth.setMonth(lastMonth.getMonth() - 1);
  const defaultMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;

  return (
    <>
      <div className="mb-3">
        <BackLink href="/fleet">{t('All fleets')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Fleet')}
        title={fleet.customer.displayName}
        description={
          fleet.totals.vehicles === 1
            ? t('1 vehicle on the books')
            : t('{count} vehicles on the books', { count: fleet.totals.vehicles })
        }
        actions={
          <Link href={`/customers/${fleet.customer.id}`}>
            <Button size="sm" variant="secondary">
              {t('The account')}
            </Button>
          </Link>
        }
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Vehicles')}
          value={fleet.totals.vehicles}
          note={t('Seen at least once')}
        />
        <StatTile
          label={t('Off the road')}
          value={fleet.totals.offTheRoad}
          tone={fleet.totals.offTheRoad > 0 ? 'warning' : 'neutral'}
          note={t('In the workshop now')}
        />
        <StatTile
          label={t('Waiting on them')}
          value={fleet.totals.awaiting}
          tone={fleet.totals.awaiting > 0 ? 'danger' : 'neutral'}
          note={t('Quotes nobody has answered')}
        />
        <StatTile
          label={t('Spent with you')}
          value={
            <Money currency={region.currency} locale={region.locale} amount={fleet.totals.spend} />
          }
          note={t('Across every vehicle')}
        />
      </StatRow>

      {fleet.totals.awaiting > 0 ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            <strong className="font-semibold">
              {fleet.totals.awaiting === 1
                ? t('1 vehicle waiting on a decision.')
                : t('{count} vehicles waiting on a decision.', { count: fleet.totals.awaiting })}
            </strong>{' '}
            {t(
              'A fleet quote usually sits with one person who has forty other things on. Nothing happens until they answer, and the van is off the road the whole time.',
            )}
          </CardBody>
        </Card>
      ) : null}

      {fleet.vehicles.length === 0 ? (
        <EmptyState
          title={t('No vehicles yet')}
          description={t('Vehicles appear here once this company has brought one in.')}
        />
      ) : (
        <div className="grid gap-3">
          {fleet.vehicles.map((row) => (
            <Card
              key={row.vehicle.id}
              className={
                row.awaiting ? 'border-(--danger)' : row.openJob ? 'border-(--warning)' : undefined
              }
            >
              <CardBody className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/vehicles/${row.vehicle.id}`}
                      className="font-display text-[15px] font-semibold hover:text-(--brand-text) hover:underline"
                    >
                      {[row.vehicle.year, row.vehicle.make, row.vehicle.model]
                        .filter(Boolean)
                        .join(' ')}
                    </Link>
                    {row.vehicle.registration ? (
                      <Registration value={row.vehicle.registration} />
                    ) : null}
                    {numbers.get(row.vehicle.id) ? (
                      <Badge tone="neutral" size="sm">
                        {numbers.get(row.vehicle.id)}
                      </Badge>
                    ) : null}
                  </div>

                  {/* What the driver says on the telephone. Typed here, found
                      from the search box. Phase 69. */}
                  {can(user.role, 'vehicle:write') ? (
                    <form action={nameVan} className="mt-1.5 flex items-end gap-2">
                      <input type="hidden" name="customerId" value={id} />
                      <input type="hidden" name="vehicleId" value={row.vehicle.id} />
                      <Field label={t('What they call it')} hint={t('Optional')}>
                        <Input
                          name="number"
                          defaultValue={numbers.get(row.vehicle.id) ?? ''}
                          placeholder={t('Van 17')}
                        />
                      </Field>
                      <Button type="submit" size="sm" variant="ghost">
                        {t('Save')}
                      </Button>
                    </form>
                  ) : null}
                  <p className="mt-1 text-[12px] text-(--text-faint)">
                    <Mileage t={t} locale={region.locale} km={row.vehicle.lastOdometerKm} /> ·{' '}
                    {t('last in {date}', { date: date(row.lastVisit, region.locale) })}
                  </p>
                </div>

                <div className="text-[13px]">
                  {row.awaiting ? (
                    <Link href={`/jobs/${row.awaiting.id}`}>
                      <Badge tone="danger" dot>
                        {t('Waiting on a decision')}
                      </Badge>
                    </Link>
                  ) : row.openJob ? (
                    <Link href={`/jobs/${row.openJob.id}`}>
                      <Badge tone="warning" dot>
                        {t('In the workshop')}
                      </Badge>
                    </Link>
                  ) : row.overdue ? (
                    <Badge tone="warning" size="sm">
                      {t('service overdue')}
                    </Badge>
                  ) : row.dueSoon ? (
                    <Badge tone="brand" size="sm">
                      {t('due')} {date(row.dueAt, region.locale)}
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm">
                      {t('nothing due')}
                    </Badge>
                  )}
                </div>

                <div className="text-[13px] sm:text-end">
                  <span className="text-(--text-faint)">{t('Spent')} </span>
                  <Money currency={region.currency} locale={region.locale} amount={row.spend} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {notice.problem ? (
        <Alert tone="danger" className="mt-6">
          {t(notice.problem)}
        </Alert>
      ) : null}

      {notice.done === 'terms' ? (
        <Alert tone="success" className="mt-6">
          {t('Terms saved. They apply to every invoice raised for this fleet from now on.')}
        </Alert>
      ) : null}

      {/* The two things a fleet negotiates and the one thing it cares about:
          a discount on labour, a discount on parts, and not receiving fifty
          invoices. Phase 9 named both as missing. */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('Agreed terms')}
            description={
              agreement
                ? t('Applied at invoice time, so the job keeps its list figures.')
                : t('None yet. Without terms this fleet pays list price like anybody else.')
            }
          />
          <form action={saveTerms}>
            <CardBody className="grid gap-3">
              <input type="hidden" name="customerId" value={fleet.customer.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t('Labour discount')} hint="%">
                  <Input
                    name="labourDiscountPct"
                    inputMode="decimal"
                    defaultValue={agreement ? Number(agreement.labourDiscountPct) : 0}
                    className="tabular-nums"
                  />
                </Field>
                <Field label={t('Parts discount')} hint="%">
                  <Input
                    name="partsDiscountPct"
                    inputMode="decimal"
                    defaultValue={agreement ? Number(agreement.partsDiscountPct) : 0}
                    className="tabular-nums"
                  />
                </Field>
                <Field label={t('Payment terms')} hint={t('days')}>
                  <Input
                    name="paymentTermsDays"
                    inputMode="numeric"
                    defaultValue={agreement?.paymentTermsDays ?? 30}
                    className="tabular-nums"
                  />
                </Field>
              </div>
              <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                <input
                  type="checkbox"
                  name="consolidateMonthly"
                  defaultChecked={agreement?.consolidateMonthly ?? true}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--brand-solid)"
                />
                <span>
                  {t('One invoice a month for everything completed, rather than one per job')}
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                <input
                  type="checkbox"
                  name="purchaseOrderRequired"
                  defaultChecked={agreement?.purchaseOrderRequired ?? false}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--brand-solid)"
                />
                <span>
                  {t('Their purchase order number must be on every job before it is invoiced')}
                </span>
              </label>
              <Field label={t('Notes')} hint={t('Optional')}>
                <Input name="notes" defaultValue={agreement?.notes ?? ''} />
              </Field>
              {can(user.role, 'customer:write') ? (
                <Button type="submit" variant="secondary">
                  {agreement ? t('Update the terms') : t('Save the terms')}
                </Button>
              ) : null}
            </CardBody>
          </form>
        </Card>

        <Card className={agreement ? 'border-(--brand)' : undefined}>
          <CardHeader
            title={t('Invoice a month')}
            description={t(
              'Every job completed in the month, on one invoice, at the agreed terms.',
            )}
          />
          <form action={invoiceMonth}>
            <CardBody className="grid gap-3">
              <input type="hidden" name="customerId" value={fleet.customer.id} />
              <Field label={t('Month')}>
                <Select name="month" defaultValue={defaultMonth}>
                  {Array.from({ length: 6 }, (_, offset) => {
                    const when = new Date();
                    when.setDate(1);
                    when.setMonth(when.getMonth() - offset);
                    const value = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, '0')}`;
                    return (
                      <option key={value} value={value}>
                        {when.toLocaleDateString(region.locale, { month: 'long', year: 'numeric' })}
                      </option>
                    );
                  })}
                </Select>
              </Field>
              <p className="text-[13px] leading-relaxed text-(--text-soft)">
                {t(
                  'Jobs already invoiced on their own are left alone. Each line on the invoice names the vehicle and the job it came from, so their accounts department can tie a line to a van.',
                )}
              </p>
              {can(user.role, 'invoice:write') ? (
                <Button type="submit" variant="primary" disabled={!agreement}>
                  {agreement ? t('Issue the month’s invoice') : t('Save the terms first')}
                </Button>
              ) : null}
            </CardBody>
          </form>
        </Card>
      </div>
    </>
  );
}
