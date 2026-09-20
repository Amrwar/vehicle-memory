import {
  describeErasure,
  describeExport,
  FORGOTTEN,
  humanise,
  toneFor,
  whatWasDone,
  type JobStatus,
} from '@carnet/core';
import { prisma } from '@carnet/db';
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
  KeyValue,
  Mileage,
  Money,
  PageHeader,
  Registration,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { CustomerError, setPreferredTechnician } from '@/lib/customers';
import { eraseCustomer, ErasureError, exportCustomer } from '@/lib/erasure';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { setCustomerExemption, TaxError } from '@/lib/tax';
import {
  awardByHand,
  HAND_AWARD_CEILING,
  loyaltyCardFor,
  LoyaltyError,
  methodLabel,
} from '@/lib/loyalty';
import { DepositError, heldFor, returnHeld, takeDeposit } from '@/lib/deposits';
import { redeemCode, referralCardFor } from '@/lib/referrals';
import { messagesFor, timelineFor } from '@/lib/timeline';
import { once, onceToken, StillGoingError } from '@/lib/once';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { db } = await requireSession('customer:read');
  const customer = await db.customer.findUnique({
    where: { id },
    select: { displayName: true },
  });
  const t = await tFor();
  return { title: customer?.displayName ?? t('Customer') };
}

/**
 * One screen answering every question about a customer, so Sara does not have
 * to navigate away while they are on the phone (story B2).
 */
async function prefer(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const customerId = String(formData.get('customerId') ?? '');

  try {
    await setPreferredTechnician({
      orgId,
      userId: user.userId,
      customerId,
      technicianUserId: String(formData.get('technicianUserId') ?? '') || null,
    });
  } catch (error) {
    if (error instanceof CustomerError) {
      redirect(`/customers/${customerId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/customers/${customerId}?saved=preference`);
}

/**
 * Everything the workshop holds about one person, handed over. NFR-502.
 *
 * Offered beside erasure rather than after it. Somebody asking to be forgotten
 * should be able to take their record with them first, and a product that
 * erases and then offers an export is offering nothing.
 *
 * The law allows thirty days. The product holds it all in one database and
 * answers while they are still on the telephone.
 */
async function takeEverything(formData: FormData) {
  'use server';

  const { orgId } = await requireSession('customer:read');
  const customerId = String(formData.get('customerId') ?? '');

  const taken = await exportCustomer(orgId, customerId);

  redirect(`/customers/${customerId}?exported=${encodeURIComponent(describeExport(taken))}`);
}

/**
 * Being forgotten. FR-209, NFR-503.
 *
 * Not reversible, and it does not pretend to be: no undo, no soft delete, no
 * thirty-day grace. A request to be forgotten that leaves the data behind a
 * flag has not been honoured.
 *
 * The reason is required because this is a thing the workshop did on somebody
 * else's instruction, and the audit record of it should say whose.
 */
async function forget(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const customerId = String(formData.get('customerId') ?? '');

  try {
    const done = await eraseCustomer({
      orgId,
      userId: user.userId,
      customerId,
      reason: String(formData.get('reason') ?? ''),
    });

    redirect(`/customers/${customerId}?erased=${encodeURIComponent(describeErasure(done))}`);
  } catch (error) {
    if (error instanceof ErasureError) {
      redirect(`/customers/${customerId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
}

/** Exempt from tax on the strength of a certificate, or charged as usual. Phase 41. */
async function exemption(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const customerId = String(formData.get('customerId') ?? '');
  try {
    await setCustomerExemption({
      orgId,
      userId: user.userId,
      customerId,
      exempt: formData.get('exempt') === 'yes',
      reference: String(formData.get('reference') ?? ''),
    });
  } catch (error) {
    if (error instanceof TaxError) {
      redirect(`/customers/${customerId}?problem=${encodeURIComponent(error.message)}#tax`);
    }
    throw error;
  }
  redirect(`/customers/${customerId}?saved=tax#tax`);
}

/**
 * A deposit before the work: money handed over now, a liability until the
 * invoice takes it. Tied to a job when there is one, so the job's page can
 * say what is already in hand.
 */
async function deposit(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const customerId = String(formData.get('customerId') ?? '');
  const typed = String(formData.get('amount') ?? '').replace(/[£,\s]/g, '');
  const pounds = Number(typed);

  try {
    await once({
      orgId,
      key: ['take-deposit', customerId, String(formData.get('once') ?? '')],
      work: () =>
        takeDeposit({
          orgId,
          userId: user.userId,
          customerId,
          jobId: String(formData.get('jobId') ?? '') || null,
          amountMinor: Number.isFinite(pounds) ? Math.round(pounds * 100) : 0,
          method: String(formData.get('method') ?? 'CARD'),
          reference: String(formData.get('reference') ?? ''),
          note: String(formData.get('note') ?? ''),
        }),
    });
  } catch (error) {
    if (error instanceof DepositError || error instanceof StillGoingError) {
      redirect(`/customers/${customerId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/customers/${customerId}?saved=deposit`);
}

/** Money held going back, with a reason. */
async function giveBack(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('payment:write');
  const customerId = String(formData.get('customerId') ?? '');
  const typed = String(formData.get('amount') ?? '').replace(/[£,\s]/g, '');
  const pounds = Number(typed);

  try {
    await once({
      orgId,
      key: ['return-held', customerId, String(formData.get('once') ?? '')],
      work: () =>
        returnHeld({
          orgId,
          userId: user.userId,
          depositId: String(formData.get('depositId') ?? ''),
          amountMinor: Number.isFinite(pounds) ? Math.round(pounds * 100) : 0,
          method: String(formData.get('method') ?? 'BANK_TRANSFER'),
          reason: String(formData.get('reason') ?? ''),
        }),
    });
  } catch (error) {
    if (error instanceof DepositError || error instanceof StillGoingError) {
      redirect(`/customers/${customerId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/customers/${customerId}?saved=returned`);
}

/**
 * Somebody arrived with a code. Recorded against them; paid at once if they
 * have already had enough work done here, otherwise when the bill that
 * crosses the line is paid.
 */
async function refer(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const customerId = String(formData.get('customerId') ?? '');

  let credited = false;
  try {
    ({ credited } = await redeemCode({
      orgId,
      userId: user.userId,
      customerId,
      code: String(formData.get('code') ?? ''),
    }));
  } catch (error) {
    if (error instanceof LoyaltyError) {
      redirect(`/customers/${customerId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/customers/${customerId}?saved=${credited ? 'referral-paid' : 'referral'}`);
}

/**
 * Points given by hand. A goodwill gesture after a bad week, a referral the
 * scheme could not see. The reason is required because it is what the
 * customer reads in their history, and "points" is not a reason.
 */
async function award(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const customerId = String(formData.get('customerId') ?? '');

  try {
    await awardByHand({
      orgId,
      userId: user.userId,
      customerId,
      points: Number(String(formData.get('points') ?? '').trim()),
      reason: String(formData.get('reason') ?? ''),
    });
  } catch (error) {
    if (error instanceof LoyaltyError) {
      redirect(`/customers/${customerId}?problem=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/customers/${customerId}?saved=points`);
}

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; problem?: string }>;
}) {
  const { id } = await params;
  const { saved, problem } = await searchParams;
  const { db, orgId, user, region } = await requireSession('customer:read');
  const t = await tFor();

  const { id: customerId } = await params;

  // A key for this drawing of the page, carried by the forms that move money
  // held for the customer. A second press is the same deposit. Phase 46.
  const token = onceToken();

  const [timeline, messages, points, referrals] = await Promise.all([
    timelineFor(orgId, customerId),
    messagesFor(orgId, customerId),
    loyaltyCardFor(orgId, customerId),
    referralCardFor(orgId, customerId, user.userId),
  ]);
  const held = await heldFor(orgId, customerId);

  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      jobs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          vehicle: { select: { id: true, make: true, model: true, registration: true } },
        },
      },
      invoices: { orderBy: { createdAt: 'desc' }, take: 10 },
      payments: { orderBy: { receivedAt: 'desc' }, take: 5 },
    },
  });

  if (!customer) notFound();

  const technicians = await prisma.user.findMany({
    where: { memberships: { some: { orgId, role: 'TECHNICIAN', isActive: true } } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  const mayEditCustomer = can(user.role, 'customer:write');

  // Vehicles reached through this customer's jobs at this workshop. A vehicle
  // is global, so it is fetched separately rather than joined off the tenant.
  const vehicles = await prisma.vehicle.findMany({
    where: { jobs: { some: { orgId, customerId: id } } },
    include: {
      _count: { select: { events: true } },
      recalls: { where: { status: 'OPEN' }, select: { id: true } },
    },
  });

  const outstanding = customer.invoices.reduce(
    (total, invoice) => total + Number(invoice.total) - Number(invoice.amountPaid),
    0,
  );

  return (
    <>
      <div className="mb-3">
        <BackLink href="/customers">{t('All customers')}</BackLink>
      </div>

      <PageHeader
        eyebrow={customer.kind === 'COMPANY' ? t('Company') : t('Individual')}
        title={customer.displayName}
        description={
          customer.sourceOfBusiness
            ? t('Source: {source}', { source: customer.sourceOfBusiness })
            : undefined
        }
        actions={
          <>
            {mayEditCustomer ? (
              <Link href={`/customers/${customer.id}/edit`}>
                <Button variant="secondary">{t('Correct their details')}</Button>
              </Link>
            ) : null}
            <Link href={`/audit/Customer/${customer.id}`}>
              <Button variant="secondary">{t('How this came to be')}</Button>
            </Link>
            <Link href={`/jobs/new?customer=${customer.id}`}>
              <Button variant="primary">{t('New job')}</Button>
            </Link>
          </>
        }
      />

      {saved ? (
        <Alert tone="success" className="mb-5">
          {saved === 'points'
            ? t('Points added. They can see them in the portal.')
            : saved === 'deposit'
              ? t(
                  'Deposit taken and booked as money held, not as revenue. It goes against the invoice when there is one.',
                )
              : saved === 'details'
                ? t('Saved. The same record, with their history still on it.')
                : saved === 'returned'
                  ? t('Money returned, with the reason kept.')
                  : saved === 'referral-paid'
                    ? t(
                        'Code used. They had already had enough work done here, so both sides have been paid.',
                      )
                    : saved === 'referral'
                      ? t(
                          'Code used. Both sides are paid once this customer has had enough work done.',
                        )
                      : t('Saved.')}
        </Alert>
      ) : null}
      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title={t('Contact')} />
            <CardBody>
              <KeyValue
                t={t}
                columns={3}
                items={[
                  { label: t('Mobile'), value: customer.mobile },
                  { label: t('Landline'), value: customer.phone },
                  { label: t('Email'), value: customer.email },
                  {
                    label: t('Address'),
                    value:
                      [
                        customer.addressLine1,
                        customer.addressLine2,
                        customer.locality,
                        customer.region,
                        customer.postcode,
                      ]
                        .filter(Boolean)
                        .join(', ') || null,
                  },
                  { label: t('Tax number'), value: customer.taxNumber },
                  {
                    label: t('Marketing consent'),
                    value: (
                      <span className="flex gap-1.5">
                        <Badge
                          tone={customer.marketingEmailConsent ? 'success' : 'neutral'}
                          size="sm"
                        >
                          {customer.marketingEmailConsent ? t('Email yes') : t('Email no')}
                        </Badge>
                        <Badge
                          tone={customer.marketingSmsConsent ? 'success' : 'neutral'}
                          size="sm"
                        >
                          {customer.marketingSmsConsent ? t('SMS yes') : t('SMS no')}
                        </Badge>
                      </span>
                    ),
                  },
                ]}
              />
              {customer.notes ? (
                <div className="mt-5 border-t border-(--border) pt-4">
                  <p className="eyebrow mb-1">{t('Notes')}</p>
                  <p className="text-[13px] leading-relaxed">{customer.notes}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t('Vehicles')}
              description={
                vehicles.length === 1
                  ? t('1 vehicle')
                  : t('{count} vehicles', { count: vehicles.length })
              }
            />
            {vehicles.length === 0 ? (
              <EmptyState
                title={t('No vehicles')}
                description={t('Vehicles appear once a job is created.')}
              />
            ) : (
              <ul className="divide-y divide-(--border)">
                {vehicles.map((vehicle) => (
                  <li key={vehicle.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/vehicles/${vehicle.id}`}
                          className="text-[14px] font-medium hover:underline"
                        >
                          {vehicle.year} {vehicle.make} {vehicle.model}
                        </Link>
                        {vehicle.registration ? (
                          <Registration value={vehicle.registration} />
                        ) : null}
                        {vehicle.recalls.length > 0 ? (
                          <Badge tone="danger" size="sm">
                            {t('Recall')}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-(--text-faint)">
                        <Mileage t={t} locale={region.locale} km={vehicle.lastOdometerKm} /> ·{' '}
                        {vehicle._count.events === 1
                          ? t('1 history entry')
                          : t('{count} history entries', { count: vehicle._count.events })}
                      </p>
                    </div>
                    <Link href={`/vehicles/${vehicle.id}`}>
                      <Button size="sm">{t('Passport')}</Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t('Recent jobs')} />
            {customer.jobs.length === 0 ? (
              <EmptyState title={t('No jobs yet')} />
            ) : (
              <ul className="divide-y divide-(--border)">
                {customer.jobs.map((job) => (
                  <li key={job.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="datum text-[12px] font-medium hover:underline"
                    >
                      #{job.number}
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {job.shortDescription}
                    </span>
                    <span className="text-[12px] text-(--text-faint)">
                      {job.vehicle.make} {job.vehicle.model}
                    </span>
                    <time className="datum text-[11px] text-(--text-faint)">
                      {job.createdAt.toLocaleDateString(region.locale)}
                    </time>
                    <Badge tone={toneFor(job.status as JobStatus)} size="sm">
                      {t(humanise(job.status as JobStatus))}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader
              title={t('Preferences')}
              description={t('Preselected on a new job; the diary has the last word')}
            />
            <CardBody>
              <form action={prefer} className="grid gap-2">
                <input type="hidden" name="customerId" value={customer.id} />
                <label
                  className="text-[12px] font-medium text-(--text-soft)"
                  htmlFor="preferred-technician"
                >
                  {t('Asks for')}
                </label>
                <select
                  id="preferred-technician"
                  name="technicianUserId"
                  defaultValue={customer.preferredTechnicianUserId ?? ''}
                  disabled={!mayEditCustomer}
                  className="h-9 w-full rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px]"
                >
                  <option value="">{t('Nobody in particular')}</option>
                  {technicians.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
                {mayEditCustomer ? (
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    className="justify-self-start"
                  >
                    {t('Save preference')}
                  </Button>
                ) : null}
              </form>
            </CardBody>
          </Card>

          <Card className={outstanding > 0 ? 'border-(--warning)' : undefined}>
            <CardHeader title={t('Account')} />
            <CardBody className="grid gap-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-(--text-faint)">{t('Outstanding')}</span>
                <span className="font-display text-[16px] font-semibold">
                  <Money currency={region.currency} locale={region.locale} amount={outstanding} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--text-faint)">{t('Invoices')}</span>
                <span className="tabular">{customer.invoices.length}</span>
              </div>
            </CardBody>
          </Card>

          <Card id="tax" className={customer.taxExempt ? 'border-(--brand)' : undefined}>
            <CardHeader
              title={t('Tax')}
              description={
                customer.taxExempt
                  ? t('Exempt. No tax is charged on their invoices.')
                  : t('Charged tax as usual.')
              }
            />
            {mayEditCustomer ? (
              <form action={exemption}>
                <input type="hidden" name="customerId" value={customer.id} />
                <CardBody className="grid gap-3 text-[13px]">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      name="exempt"
                      value="yes"
                      defaultChecked={customer.taxExempt}
                    />
                    {t('Exempt from tax')}
                  </label>
                  <Field
                    label={t('Certificate or registration number')}
                    hint={t('Required when exempt. It is printed on every invoice to them.')}
                  >
                    <Input
                      name="reference"
                      defaultValue={customer.taxExemptReference ?? ''}
                      maxLength={60}
                    />
                  </Field>
                  <div>
                    <Button type="submit" size="sm" variant="secondary">
                      {t('Save')}
                    </Button>
                  </div>
                </CardBody>
              </form>
            ) : customer.taxExemptReference ? (
              <CardBody className="text-[13px]">{customer.taxExemptReference}</CardBody>
            ) : null}
          </Card>

          {/* Money held. A deposit before the work or a credit from a refund,
              a liability until the invoice takes it. Led by the figure, then
              each row with what is left on it and a way to give it back. */}
          <Card className={held.heldMinor > 0 ? 'border-(--brand)' : undefined}>
            <CardHeader
              title={t('Money held')}
              description={
                held.heldMinor > 0
                  ? t('Deposits and credit, waiting for a bill')
                  : t('A deposit before the work, or credit kept from a refund')
              }
            />
            <CardBody className="grid gap-3 text-[13px]">
              <div className="flex items-baseline justify-between">
                <span className="text-(--text-faint)">{t('Held')}</span>
                <span className="font-display text-[22px] font-semibold tabular-nums">
                  <Money
                    currency={region.currency}
                    locale={region.locale}
                    amount={held.heldMinor / 100}
                  />
                </span>
              </div>

              {held.live.length > 0 ? (
                <ul className="divide-y divide-(--border-soft) border-t border-(--border-soft)">
                  {held.live.map((row) => (
                    <li key={row.id} className="grid gap-2 py-2 text-[12px]">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 flex-1 truncate">
                          {row.kind === 'CREDIT' ? t('Credit') : t('Deposit')}
                          {row.job ? (
                            <Link href={`/jobs/${row.job.id}`} className="ms-1 hover:underline">
                              {t('for job #{number}', { number: row.job.number })}
                            </Link>
                          ) : null}
                          <time className="datum ms-1.5 text-(--text-faint)">
                            {row.receivedAt.toLocaleDateString(region.locale)}
                          </time>
                        </span>
                        <span className="tabular-nums font-medium">
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={row.heldMinor / 100}
                          />
                        </span>
                      </div>
                      {mayEditCustomer ? (
                        <form
                          action={giveBack}
                          className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-1.5"
                        >
                          <input type="hidden" name="customerId" value={customer.id} />
                          <input type="hidden" name="depositId" value={row.id} />
                          <input type="hidden" name="once" value={`${token}:${row.id}`} />
                          <input type="hidden" name="method" value="BANK_TRANSFER" />
                          <Input
                            name="amount"
                            inputMode="decimal"
                            aria-label={t('Amount to return')}
                            className="tabular-nums"
                            defaultValue={(row.heldMinor / 100).toFixed(2)}
                            required
                          />
                          <div className="flex gap-1.5">
                            <Input
                              name="reason"
                              aria-label={t('Why it is going back')}
                              placeholder={t('Why it is going back')}
                              required
                              maxLength={120}
                            />
                            <Button type="submit" variant="secondary" size="sm">
                              {t('Return')}
                            </Button>
                          </div>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {mayEditCustomer ? (
                <form action={deposit} className="grid gap-2 border-t border-(--border-soft) pt-3">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <input type="hidden" name="once" value={token} />
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                    <Field label={t('Deposit')} htmlFor="deposit-amount">
                      <Input
                        id="deposit-amount"
                        name="amount"
                        inputMode="decimal"
                        className="tabular-nums"
                        placeholder="200.00"
                        required
                      />
                    </Field>
                    <Field label={t('How they paid')} htmlFor="deposit-method">
                      <select
                        id="deposit-method"
                        name="method"
                        defaultValue="CARD"
                        className="h-9 w-full rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px]"
                      >
                        <option value="CARD">{t('Card')}</option>
                        <option value="CASH">{t('Cash')}</option>
                        <option value="BANK_TRANSFER">{t('Bank transfer')}</option>
                        <option value="CHEQUE">{t('Cheque')}</option>
                      </select>
                    </Field>
                  </div>
                  <Field label={t('For which job')} hint={t('Optional')} htmlFor="deposit-job">
                    <select
                      id="deposit-job"
                      name="jobId"
                      defaultValue=""
                      className="h-9 w-full rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px]"
                    >
                      <option value="">{t('Not a particular job')}</option>
                      {customer.jobs
                        .filter((job) => !['PAID', 'CANCELLED', 'INVOICED'].includes(job.status))
                        .map((job) => (
                          <option key={job.id} value={job.id}>
                            #{job.number} · {job.shortDescription}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label={t('Reference')} hint={t('Optional')} htmlFor="deposit-reference">
                    <Input id="deposit-reference" name="reference" maxLength={60} />
                  </Field>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    className="justify-self-start"
                  >
                    {t('Take the deposit')}
                  </Button>
                </form>
              ) : null}
            </CardBody>
          </Card>

          {/* Points. The balance is the sum of the entries, never a stored
              figure, so what is shown here is what the history adds up to.
              A bill paid in full earns a point a pound on its own; this form
              is for the points a rule cannot see coming. */}
          <Card className={points.expiring.points > 0 ? 'border-(--warning)' : undefined}>
            <CardHeader
              title={t('Points')}
              description={
                points.balance > 0
                  ? t('Worth {amount} off a bill', {
                      amount: new Intl.NumberFormat(region.locale, {
                        style: 'currency',
                        currency: region.currency,
                      }).format(points.valueMinor / 100),
                    })
                  : t('{count} point a pound on every bill paid in full', {
                      count: points.perPound,
                    })
              }
            />
            <CardBody className="grid gap-3 text-[13px]">
              <div className="flex items-baseline justify-between">
                <span className="text-(--text-faint)">{t('Balance')}</span>
                <span className="font-display text-[22px] font-semibold tabular-nums">
                  {points.balance.toLocaleString(region.locale)}
                </span>
              </div>
              {points.expiring.points > 0 && points.expiring.on ? (
                <p className="rounded-(--radius-sm) bg-(--warning-soft) px-2.5 py-1.5 text-[12px] text-(--warning)">
                  {t('{points} lapse on {date}. Worth mentioning at the next visit.', {
                    points: points.expiring.points.toLocaleString(region.locale),
                    date: points.expiring.on.toLocaleDateString(region.locale, {
                      dateStyle: 'medium',
                    }),
                  })}
                </p>
              ) : null}

              {points.recent.length > 0 ? (
                <ul className="divide-y divide-(--border-soft) border-t border-(--border-soft)">
                  {points.recent.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {entry.job ? (
                          <Link href={`/jobs/${entry.job.id}`} className="hover:underline">
                            {t(entry.reason)}
                          </Link>
                        ) : (
                          t(entry.reason)
                        )}
                        <time className="datum ms-1.5 text-(--text-faint)">
                          {entry.createdAt.toLocaleDateString(region.locale)}
                        </time>
                      </span>
                      <span
                        className={
                          entry.points < 0
                            ? 'tabular-nums text-(--text-faint)'
                            : 'tabular-nums font-medium'
                        }
                      >
                        {entry.points > 0 ? '+' : ''}
                        {entry.points.toLocaleString(region.locale)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-(--text-faint)">
                  {t('Nothing earned yet. The first bill they pay in full starts it.')}
                </p>
              )}

              {mayEditCustomer ? (
                <form action={award} className="grid gap-2 border-t border-(--border-soft) pt-3">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                    <Field label={t('Points')} htmlFor="award-points">
                      <Input
                        id="award-points"
                        name="points"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={HAND_AWARD_CEILING}
                        step={1}
                        required
                        className="tabular-nums"
                      />
                    </Field>
                    <Field label={t('Why')} htmlFor="award-reason">
                      <Input
                        id="award-reason"
                        name="reason"
                        required
                        maxLength={120}
                        placeholder={t('Sorry about the wait on Tuesday')}
                      />
                    </Field>
                  </div>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    className="justify-self-start"
                  >
                    {t('Add points')}
                  </Button>
                </form>
              ) : null}
            </CardBody>
          </Card>

          {/* Referrals. The code is made once and shown plainly, because it
              is said out loud over a counter. The rule is stated next to it
              so nobody promises points on a sign-up. */}
          <Card>
            <CardHeader
              title={t('Referrals')}
              description={t(
                'Both sides get {points} points once the person brought in has had {amount} of work done',
                {
                  points: referrals.pointsEachSide,
                  amount: new Intl.NumberFormat(region.locale, {
                    style: 'currency',
                    currency: region.currency,
                    maximumFractionDigits: 0,
                  }).format(referrals.minimumMinor / 100),
                },
              )}
            />
            <CardBody className="grid gap-3 text-[13px]">
              <div>
                <p className="eyebrow">{t('Their code to hand out')}</p>
                <p className="datum mt-1 text-[22px] font-semibold tracking-[0.2em]">
                  {referrals.code}
                </p>
              </div>

              {referrals.introducedBy ? (
                <p className="text-[12px] text-(--text-soft)">
                  {t('Introduced by')}{' '}
                  <Link
                    href={`/customers/${referrals.introducedBy.referrer.id}`}
                    className="font-medium hover:underline"
                  >
                    {referrals.introducedBy.referrer.displayName}
                  </Link>
                  {' · '}
                  {referrals.introducedBy.creditedAt
                    ? t('both sides paid on {date}', {
                        date: referrals.introducedBy.creditedAt.toLocaleDateString(region.locale),
                      })
                    : t('waiting on their first bill')}
                </p>
              ) : null}

              {referrals.made.length > 0 ? (
                <ul className="divide-y divide-(--border-soft) border-t border-(--border-soft)">
                  {referrals.made.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-baseline justify-between gap-3 py-1.5 text-[12px]"
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {entry.referred ? (
                          <Link
                            href={`/customers/${entry.referred.id}`}
                            className="hover:underline"
                          >
                            {entry.referred.displayName}
                          </Link>
                        ) : (
                          t('A customer since removed')
                        )}
                        {entry.usedAt ? (
                          <time className="datum ms-1.5 text-(--text-faint)">
                            {entry.usedAt.toLocaleDateString(region.locale)}
                          </time>
                        ) : null}
                      </span>
                      {entry.creditedAt ? (
                        <Badge tone="success" size="sm">
                          {t('Paid')}
                        </Badge>
                      ) : (
                        <Badge tone="neutral" size="sm">
                          {t('Waiting on a bill')}
                        </Badge>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12px] text-(--text-faint)">{t('Nobody brought in yet.')}</p>
              )}

              {mayEditCustomer && !referrals.introducedBy ? (
                <form action={refer} className="grid gap-2 border-t border-(--border-soft) pt-3">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <Field
                    label={t('Arrived with a code')}
                    hint={t('Somebody else’s code, said at the counter')}
                    htmlFor="refer-code"
                  >
                    <Input
                      id="refer-code"
                      name="code"
                      required
                      maxLength={8}
                      autoCapitalize="characters"
                      className="datum uppercase tracking-[0.15em]"
                      // i18n-ignore
                      placeholder="XXXXXX"
                    />
                  </Field>
                  <Button
                    type="submit"
                    variant="secondary"
                    size="sm"
                    className="justify-self-start"
                  >
                    {t('Use the code')}
                  </Button>
                </form>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('Recent payments')} />
            {customer.payments.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">
                {t('Nothing recorded.')}
              </CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {customer.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={Number(payment.amount)}
                        />
                      </p>
                      <p className="datum text-[11px] text-(--text-faint)">
                        {t(methodLabel(payment.method))} ·{' '}
                        {payment.receivedAt.toLocaleDateString(region.locale)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>

      {/* Everything that has happened, as one thread.

          Each of these events was already in the database and each lived on
          its own screen: visits under jobs, quotes under estimates, money
          under payments. Somebody asking "what happened with this customer"
          had to open four pages and hold the dates in their head. */}
      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title={t('The whole story')}
          description={t('Every visit, quote, decision and payment, newest first.')}
        />
        {timeline.length === 0 ? (
          <CardBody className="text-[13px] text-(--text-soft)">
            {t('Nothing has happened yet. The thread fills itself as this customer is dealt with.')}
          </CardBody>
        ) : (
          <ol className="divide-y divide-(--border-soft)">
            {timeline.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
              >
                <span className="w-24 shrink-0 text-[12px] tabular-nums text-(--text-faint)">
                  {entry.at.toLocaleDateString(region.locale, {
                    day: 'numeric',
                    month: 'short',
                    year: '2-digit',
                  })}
                </span>

                <span className="min-w-0 flex-1 text-[13px]">
                  {entry.href ? (
                    <Link href={entry.href} className="hover:text-(--brand-text) hover:underline">
                      {t(entry.title)}
                    </Link>
                  ) : (
                    t(entry.title)
                  )}
                  {entry.detail ? (
                    <span className="ms-2 text-[11px] text-(--text-faint)">{t(entry.detail)}</span>
                  ) : null}
                </span>

                {entry.amount !== null && entry.amount !== undefined ? (
                  <span className="text-[13px] font-medium tabular-nums">
                    <Money
                      currency={region.currency}
                      locale={region.locale}
                      amount={entry.amount}
                    />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </Card>

      {/* Kept apart from the thread above on purpose. These are matched on the
          address rather than joined on an id, and mixing a certain record with
          a probable one would make both less trustworthy. */}
      {messages.length > 0 ? (
        <Card className="mt-6 overflow-hidden">
          <CardHeader
            title={t('What they were sent')}
            description={t(
              'Matched on the address on file, so it is a close record rather than a certain one.',
            )}
            action={
              <Link href={`/inbox?customer=${customer.id}`} className="text-[12px] underline">
                {t('The conversation')}
              </Link>
            }
          />
          <ul className="divide-y divide-(--border-soft)">
            {messages.map((message) => (
              <li key={message.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium">
                    {message.subject ?? message.body.slice(0, 60)}
                  </span>
                  <span className="text-[11px] text-(--text-faint)">
                    {t(message.channel.toLowerCase())} ·{' '}
                    {(message.sentAt ?? message.createdAt).toLocaleDateString(region.locale)}
                    {message.status === 'FAILED' ? ` · ${t('did not arrive')}` : ''}
                  </span>
                </div>
                {message.error ? (
                  <p className="mt-0.5 text-[11px] text-(--danger)">{message.error}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {mayEditCustomer ? (
        <Card className="mt-5 overflow-hidden border-(--danger)">
          <CardHeader
            title={t('What they can ask for')}
            description={t(
              'A person may take everything the workshop holds about them, and may ask to be forgotten. Both are theirs by right.',
            )}
          />
          <CardBody className="flex flex-col gap-5">
            <form action={takeEverything} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="customerId" value={customer.id} />
              <Button type="submit" variant="secondary">
                {t('Everything we hold about them')}
              </Button>
              <span className="text-[12px] text-(--text-soft)">
                {t('Machine-readable, and complete. Give it to them before anything else.')}
              </span>
            </form>

            {customer.displayName === FORGOTTEN ? (
              <p className="text-[13px] text-(--text-soft)">
                {t('This person has been forgotten. What is left is the workshop’s own record.')}
              </p>
            ) : (
              <div className="border-t border-(--line) pt-4">
                <p className="text-[13px] font-medium">{t('Forget this person')}</p>

                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[12px] font-medium text-(--danger)">{t('What goes')}</p>
                    <ul className="mt-1 text-[12px] text-(--text-soft)">
                      {whatWasDone().gone.map((one) => (
                        <li key={one}>{t(one)}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium">{t('What stays')}</p>
                    <ul className="mt-1 text-[12px] text-(--text-soft)">
                      {whatWasDone().kept.map((one) => (
                        <li key={one}>{t(one)}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <p className="mt-3 text-[12px] text-(--text-soft)">
                  {t(
                    'This cannot be undone. The invoices stay, because the law says seven years, and the car’s history stays, because it belongs to the car.',
                  )}
                </p>

                <form action={forget} className="mt-3 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="customerId" value={customer.id} />
                  <Field label={t('Why, and who asked')} className="min-w-[18rem] flex-1">
                    <Input name="reason" required placeholder={t('Asked by email on 3 March')} />
                  </Field>
                  <Button type="submit" variant="danger">
                    {t('Forget them')}
                  </Button>
                </form>
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
