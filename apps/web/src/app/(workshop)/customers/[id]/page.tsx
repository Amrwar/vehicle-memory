import { humanise, toneFor, type JobStatus } from '@carnet/core';
import { prisma } from '@carnet/db';
import {
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
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';

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
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, orgId } = await requireSession('customer:read');

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
          <Link href={`/jobs/new?customer=${customer.id}`}>
            <Button variant="primary">New job</Button>
          </Link>
        }
      />

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
    </>
  );
}
