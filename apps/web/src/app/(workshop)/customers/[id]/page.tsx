import { humanise, toneFor, type JobStatus } from '@carnet/core';
import { prisma } from '@carnet/db';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
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
import { can, requireSession } from '@/lib/guard';
import { messagesFor, timelineFor } from '@/lib/timeline';

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
  return { title: customer?.displayName ?? 'Customer' };
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

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; problem?: string }>;
}) {
  const { id } = await params;
  const { saved, problem } = await searchParams;
  const { db, orgId, user } = await requireSession('customer:read');

  const { id: customerId } = await params;

  const [timeline, messages] = await Promise.all([
    timelineFor(orgId, customerId),
    messagesFor(orgId, customerId),
  ]);

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
        <BackLink href="/customers">All customers</BackLink>
      </div>

      <PageHeader
        eyebrow={customer.kind === 'COMPANY' ? 'Company' : 'Individual'}
        title={customer.displayName}
        description={customer.sourceOfBusiness ? `Source: ${customer.sourceOfBusiness}` : undefined}
        actions={
          <>
            <Link href={`/audit/Customer/${customer.id}`}>
              <Button variant="secondary">How this came to be</Button>
            </Link>
            <Link href={`/jobs/new?customer=${customer.id}`}>
              <Button variant="primary">New job</Button>
            </Link>
          </>
        }
      />

      {saved ? (
        <Alert tone="success" className="mb-5">
          Saved.
        </Alert>
      ) : null}
      {problem ? (
        <Alert tone="danger" className="mb-5">
          {problem}
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title="Contact" />
            <CardBody>
              <KeyValue
                columns={3}
                items={[
                  { label: 'Mobile', value: customer.mobile },
                  { label: 'Landline', value: customer.phone },
                  { label: 'Email', value: customer.email },
                  {
                    label: 'Address',
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
                  { label: 'Tax number', value: customer.taxNumber },
                  {
                    label: 'Marketing consent',
                    value: (
                      <span className="flex gap-1.5">
                        <Badge
                          tone={customer.marketingEmailConsent ? 'success' : 'neutral'}
                          size="sm"
                        >
                          Email {customer.marketingEmailConsent ? 'yes' : 'no'}
                        </Badge>
                        <Badge
                          tone={customer.marketingSmsConsent ? 'success' : 'neutral'}
                          size="sm"
                        >
                          SMS {customer.marketingSmsConsent ? 'yes' : 'no'}
                        </Badge>
                      </span>
                    ),
                  },
                ]}
              />
              {customer.notes ? (
                <div className="mt-5 border-t border-(--border) pt-4">
                  <p className="eyebrow mb-1">Notes</p>
                  <p className="text-[13px] leading-relaxed">{customer.notes}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Vehicles"
              description={`${vehicles.length} vehicle${vehicles.length === 1 ? '' : 's'}`}
            />
            {vehicles.length === 0 ? (
              <EmptyState
                title="No vehicles"
                description="Vehicles appear once a job is created."
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
                            Recall
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-(--text-faint)">
                        <Mileage km={vehicle.lastOdometerKm} /> · {vehicle._count.events} history
                        entries
                      </p>
                    </div>
                    <Link href={`/vehicles/${vehicle.id}`}>
                      <Button size="sm">Passport</Button>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Recent jobs" />
            {customer.jobs.length === 0 ? (
              <EmptyState title="No jobs yet" />
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
                      {job.createdAt.toLocaleDateString('en-GB')}
                    </time>
                    <Badge tone={toneFor(job.status as JobStatus)} size="sm">
                      {humanise(job.status as JobStatus)}
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
              title="Preferences"
              description="Preselected on a new job; the diary has the last word"
            />
            <CardBody>
              <form action={prefer} className="grid gap-2">
                <input type="hidden" name="customerId" value={customer.id} />
                <label
                  className="text-[12px] font-medium text-(--text-soft)"
                  htmlFor="preferred-technician"
                >
                  Asks for
                </label>
                <select
                  id="preferred-technician"
                  name="technicianUserId"
                  defaultValue={customer.preferredTechnicianUserId ?? ''}
                  disabled={!mayEditCustomer}
                  className="h-9 w-full rounded-(--radius-md) border border-(--border-strong) bg-(--surface) px-3 text-[13px]"
                >
                  <option value="">Nobody in particular</option>
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
                    Save preference
                  </Button>
                ) : null}
              </form>
            </CardBody>
          </Card>

          <Card className={outstanding > 0 ? 'border-(--warning)' : undefined}>
            <CardHeader title="Account" />
            <CardBody className="grid gap-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-(--text-faint)">Outstanding</span>
                <span className="font-display text-[16px] font-semibold">
                  <Money amount={outstanding} />
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-(--text-faint)">Invoices</span>
                <span className="tabular">{customer.invoices.length}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Recent payments" />
            {customer.payments.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">Nothing recorded.</CardBody>
            ) : (
              <ul className="divide-y divide-(--border)">
                {customer.payments.map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-[13px] font-medium">
                        <Money amount={Number(payment.amount)} />
                      </p>
                      <p className="datum text-[11px] text-(--text-faint)">
                        {payment.method.toLowerCase().replace('_', ' ')} ·{' '}
                        {payment.receivedAt.toLocaleDateString('en-GB')}
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
          title="The whole story"
          description="Every visit, quote, decision and payment, newest first."
        />
        {timeline.length === 0 ? (
          <CardBody className="text-[13px] text-(--text-soft)">
            Nothing has happened yet. The thread fills itself as this customer is dealt with.
          </CardBody>
        ) : (
          <ol className="divide-y divide-(--border-soft)">
            {timeline.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5"
              >
                <span className="w-24 shrink-0 text-[12px] tabular-nums text-(--text-faint)">
                  {entry.at.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: '2-digit',
                  })}
                </span>

                <span className="min-w-0 flex-1 text-[13px]">
                  {entry.href ? (
                    <Link href={entry.href} className="hover:text-(--brand-text) hover:underline">
                      {entry.title}
                    </Link>
                  ) : (
                    entry.title
                  )}
                  {entry.detail ? (
                    <span className="ml-2 text-[11px] text-(--text-faint)">{entry.detail}</span>
                  ) : null}
                </span>

                {entry.amount !== null && entry.amount !== undefined ? (
                  <span className="text-[13px] font-medium tabular-nums">
                    <Money amount={entry.amount} />
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
            title="What they were sent"
            description="Matched on the address on file, so it is a close record rather than a certain one."
          />
          <ul className="divide-y divide-(--border-soft)">
            {messages.map((message) => (
              <li key={message.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-[13px] font-medium">
                    {message.subject ?? message.body.slice(0, 60)}
                  </span>
                  <span className="text-[11px] text-(--text-faint)">
                    {message.channel.toLowerCase()} ·{' '}
                    {(message.sentAt ?? message.createdAt).toLocaleDateString('en-GB')}
                    {message.status === 'FAILED' ? ' · did not arrive' : ''}
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
    </>
  );
}
