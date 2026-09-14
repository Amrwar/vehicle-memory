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
import { can, requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Fleet' };
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

  const [fleet, agreement] = await Promise.all([
    fleetDetail(orgId, id),
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
        <BackLink href="/fleet">All fleets</BackLink>
      </div>

      <PageHeader
        eyebrow="Fleet"
        title={fleet.customer.displayName}
        description={`${fleet.totals.vehicles} vehicles on the books`}
        actions={
          <Link href={`/customers/${fleet.customer.id}`}>
            <Button size="sm" variant="secondary">
              The account
            </Button>
          </Link>
        }
      />

      <StatRow className="mb-5">
        <StatTile label="Vehicles" value={fleet.totals.vehicles} note="Seen at least once" />
        <StatTile
          label="Off the road"
          value={fleet.totals.offTheRoad}
          tone={fleet.totals.offTheRoad > 0 ? 'warning' : 'neutral'}
          note="In the workshop now"
        />
        <StatTile
          label="Waiting on them"
          value={fleet.totals.awaiting}
          tone={fleet.totals.awaiting > 0 ? 'danger' : 'neutral'}
          note="Quotes nobody has answered"
        />
        <StatTile
          label="Spent with you"
          value={
            <Money currency={region.currency} locale={region.locale} amount={fleet.totals.spend} />
          }
          note="Across every vehicle"
        />
      </StatRow>

      {fleet.totals.awaiting > 0 ? (
        <Card className="mb-5 border-(--danger)">
          <CardBody className="text-[13px] leading-relaxed text-(--danger)">
            <strong className="font-semibold">
              {fleet.totals.awaiting} vehicle{fleet.totals.awaiting === 1 ? '' : 's'} waiting on a
              decision.
            </strong>{' '}
            A fleet quote usually sits with one person who has forty other things on. Nothing
            happens until they answer, and the van is off the road the whole time.
          </CardBody>
        </Card>
      ) : null}

      {fleet.vehicles.length === 0 ? (
        <EmptyState
          title="No vehicles yet"
          description="Vehicles appear here once this company has brought one in."
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
                  </div>
                  <p className="mt-1 text-[12px] text-(--text-faint)">
                    <Mileage locale={region.locale} km={row.vehicle.lastOdometerKm} /> · last in{' '}
                    {date(row.lastVisit, region.locale)}
                  </p>
                </div>

                <div className="text-[13px]">
                  {row.awaiting ? (
                    <Link href={`/jobs/${row.awaiting.id}`}>
                      <Badge tone="danger" dot>
                        Waiting on a decision
                      </Badge>
                    </Link>
                  ) : row.openJob ? (
                    <Link href={`/jobs/${row.openJob.id}`}>
                      <Badge tone="warning" dot>
                        In the workshop
                      </Badge>
                    </Link>
                  ) : row.overdue ? (
                    <Badge tone="warning" size="sm">
                      service overdue
                    </Badge>
                  ) : row.dueSoon ? (
                    <Badge tone="brand" size="sm">
                      due {date(row.dueAt, region.locale)}
                    </Badge>
                  ) : (
                    <Badge tone="success" size="sm">
                      nothing due
                    </Badge>
                  )}
                </div>

                <div className="text-[13px] sm:text-right">
                  <span className="text-(--text-faint)">Spent </span>
                  <Money currency={region.currency} locale={region.locale} amount={row.spend} />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {notice.problem ? (
        <Alert tone="danger" className="mt-6">
          {notice.problem}
        </Alert>
      ) : null}

      {notice.done === 'terms' ? (
        <Alert tone="success" className="mt-6">
          Terms saved. They apply to every invoice raised for this fleet from now on.
        </Alert>
      ) : null}

      {/* The two things a fleet negotiates and the one thing it cares about:
          a discount on labour, a discount on parts, and not receiving fifty
          invoices. Phase 9 named both as missing. */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Agreed terms"
            description={
              agreement
                ? 'Applied at invoice time, so the job keeps its list figures.'
                : 'None yet. Without terms this fleet pays list price like anybody else.'
            }
          />
          <form action={saveTerms}>
            <CardBody className="grid gap-3">
              <input type="hidden" name="customerId" value={fleet.customer.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Labour discount" hint="%">
                  <Input
                    name="labourDiscountPct"
                    inputMode="decimal"
                    defaultValue={agreement ? Number(agreement.labourDiscountPct) : 0}
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Parts discount" hint="%">
                  <Input
                    name="partsDiscountPct"
                    inputMode="decimal"
                    defaultValue={agreement ? Number(agreement.partsDiscountPct) : 0}
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Payment terms" hint="days">
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
                <span>One invoice a month for everything completed, rather than one per job</span>
              </label>
              <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                <input
                  type="checkbox"
                  name="purchaseOrderRequired"
                  defaultChecked={agreement?.purchaseOrderRequired ?? false}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--brand-solid)"
                />
                <span>Their purchase order number must be on every job before it is invoiced</span>
              </label>
              <Field label="Notes" hint="Optional">
                <Input name="notes" defaultValue={agreement?.notes ?? ''} />
              </Field>
              {can(user.role, 'customer:write') ? (
                <Button type="submit" variant="secondary">
                  {agreement ? 'Update the terms' : 'Save the terms'}
                </Button>
              ) : null}
            </CardBody>
          </form>
        </Card>

        <Card className={agreement ? 'border-(--brand)' : undefined}>
          <CardHeader
            title="Invoice a month"
            description="Every job completed in the month, on one invoice, at the agreed terms."
          />
          <form action={invoiceMonth}>
            <CardBody className="grid gap-3">
              <input type="hidden" name="customerId" value={fleet.customer.id} />
              <Field label="Month">
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
                Jobs already invoiced on their own are left alone. Each line on the invoice names
                the vehicle and the job it came from, so their accounts department can tie a line to
                a van.
              </p>
              {can(user.role, 'invoice:write') ? (
                <Button type="submit" variant="primary" disabled={!agreement}>
                  {agreement ? 'Issue the month’s invoice' : 'Save the terms first'}
                </Button>
              ) : null}
            </CardBody>
          </form>
        </Card>
      </div>
    </>
  );
}
