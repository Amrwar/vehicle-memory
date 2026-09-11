import {
  calculateTotals,
  humanise,
  type JobStatus,
  jobProfit,
  money,
  progressFor,
  summarise,
  toneFor,
  toNumber,
  type PriceableLine,
} from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  KeyValue,
  Mileage,
  Money,
  PageHeader,
  ProgressTrail,
  Registration,
  SeverityBadge,
  SeveritySummary,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
  Vin,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { can, requireSession } from '@/lib/guard';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { db } = await requireSession('job:read');
  const job = await db.job.findUnique({ where: { id }, select: { number: true } });
  return { title: job ? `Job #${job.number}` : 'Job' };
}

/**
 * The job screen.
 *
 * The product thesis in one page: a manager opens a job and sees the customer,
 * the vehicle, the inspection, the estimate, the approval, the labour, the
 * parts, the photographs, the invoice and the passport entries without
 * navigating between ten modules (story E1).
 */
export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, user } = await requireSession('job:read');

  const job = await db.job.findUnique({
    where: { id },
    include: {
      customer: true,
      vehicle: true,
      bay: { select: { name: true } },
      location: { select: { name: true } },
      technicians: { include: { user: { select: { id: true, name: true } } } },
      jobTypes: { include: { jobType: { select: { name: true, colour: true } } } },
      statusEvents: {
        orderBy: { createdAt: 'asc' },
        include: { actor: { select: { name: true } } },
      },
      tasks: { orderBy: { sortOrder: 'asc' } },
      labourLines: { orderBy: { sortOrder: 'asc' }, include: { taxRate: true } },
      partLines: { orderBy: { sortOrder: 'asc' }, include: { taxRate: true } },
      feeLines: { orderBy: { sortOrder: 'asc' }, include: { taxRate: true } },
      notes: { orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } },
      attachments: { orderBy: { createdAt: 'desc' } },
      timeEntries: { include: { user: { select: { name: true } } } },
      qualityChecks: { include: { checkedBy: { select: { name: true } } } },
      inspections: {
        orderBy: { startedAt: 'desc' },
        include: {
          performedBy: { select: { name: true } },
          results: { orderBy: { sortOrder: 'asc' }, include: { photos: true } },
        },
      },
      estimates: {
        orderBy: { version: 'desc' },
        include: {
          lines: { orderBy: { sortOrder: 'asc' } },
          approvals: { orderBy: { createdAt: 'desc' } },
          shares: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
      invoices: { orderBy: { createdAt: 'desc' }, include: { payments: true } },
    },
  });

  if (!job) notFound();

  const reached = job.statusEvents.map((event) => event.toStatus as JobStatus);
  const stages = progressFor(job.status as JobStatus, reached);

  const lines: PriceableLine[] = [
    ...job.labourLines.map((line) => ({
      kind: 'LABOUR' as const,
      quantity: Number(line.hours),
      unitPrice: line.rate.toString(),
      discountPct: Number(line.discountPct),
      taxRatePct: line.taxRate ? Number(line.taxRate.rate) : 0,
    })),
    ...job.partLines.map((line) => ({
      kind: 'PART' as const,
      quantity: Number(line.quantity),
      unitPrice: line.unitPrice.toString(),
      unitCost: line.unitCost.toString(),
      discountPct: Number(line.discountPct),
      taxRatePct: line.taxRate ? Number(line.taxRate.rate) : 0,
    })),
    ...job.feeLines.map((line) => ({
      kind: 'FEE' as const,
      quantity: 1,
      unitPrice: line.amount.toString(),
      taxRatePct: line.taxRate ? Number(line.taxRate.rate) : 0,
    })),
  ];

  const totals = calculateTotals(lines);
  // The most recent one that actually has something in it. Taking the newest
  // regardless meant an inspection somebody opened and abandoned hid the
  // completed one underneath it, so the job page showed nothing was found on a
  // vehicle where ten things were.
  const inspection =
    job.inspections.find((entry) => entry.results.length > 0) ?? job.inspections[0];
  const estimate = job.estimates[0];
  const invoice = job.invoices[0];

  const clockedMinutes = job.timeEntries.reduce((total, entry) => total + (entry.minutes ?? 0), 0);

  // Profitability. FR-613.
  //
  // Labour cost comes from clocked time at each technician's own rate, not
  // from an average: the whole point of the figure is to show when a job was
  // quoted at one skill level and done at another. Parts cost is the weighted
  // average carried on the line, which is what the stock was actually worth.
  const labourCostMinor = job.timeEntries.reduce(
    (total, entry) =>
      total + Math.round(((entry.minutes ?? 0) / 60) * Number(entry.costRate ?? 0) * 100),
    0,
  );

  const netOf = (kind: 'LABOUR' | 'PART' | 'FEE') =>
    lines.reduce(
      (total, line, index) => (line.kind === kind ? total + totals.lines[index]!.net.minor : total),
      0,
    );

  const partsCostMinor = job.partLines.reduce(
    (total, line) => total + Math.round(Number(line.quantity) * Number(line.unitCost) * 100),
    0,
  );

  const profit = jobProfit({
    labourRevenue: money(netOf('LABOUR')),
    partsRevenue: money(netOf('PART')),
    feeRevenue: money(netOf('FEE')),
    partsCost: money(partsCostMinor),
    labourCost: money(labourCostMinor),
  });

  // A service advisor discussing price with a customer should not have the
  // margin on screen. It is the owner's number, not the counter's.
  const showsProfit = can(user.role, 'report:financial');

  const findings = inspection
    ? summarise(
        inspection.results.map((result) => ({
          id: result.id,
          sectionName: result.sectionName,
          itemName: result.itemName,
          severity: result.severity,
        })),
      )
    : null;

  return (
    <>
      <div className="mb-3">
        <BackLink href="/jobs">All jobs</BackLink>
      </div>

      <PageHeader
        eyebrow={`Job #${job.number} · ${job.location.name}`}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {job.vehicle.make} {job.vehicle.model}
            {job.vehicle.registration ? (
              <Registration value={job.vehicle.registration} className="text-[15px]" />
            ) : null}
            <Badge tone={toneFor(job.status as JobStatus)} dot>
              {humanise(job.status as JobStatus)}
            </Badge>
          </span>
        }
        description={job.shortDescription}
        actions={
          <>
            <Link href={`/vehicles/${job.vehicle.id}`}>
              <Button>Vehicle passport</Button>
            </Link>
            {estimate && job.status === 'ESTIMATED' ? (
              <Button variant="primary">Send estimate</Button>
            ) : null}
          </>
        }
      />

      {job.status === 'AWAITING_APPROVAL' ? (
        <Alert tone="warning" title="Waiting on the customer" className="mb-5">
          Work cannot proceed until the estimate is approved. Sent
          {estimate?.sentAt
            ? ` ${estimate.sentAt.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`
            : ' but not yet delivered'}
          .
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ---------------- main column ---------------- */}
        <div className="grid gap-5">
          <Card>
            <CardHeader title="Vehicle and customer" />
            <CardBody>
              <KeyValue
                columns={3}
                items={[
                  {
                    label: 'Customer',
                    value: (
                      <Link href={`/customers/${job.customer.id}`} className="hover:underline">
                        {job.customer.displayName}
                      </Link>
                    ),
                  },
                  { label: 'Contact', value: job.customer.mobile ?? job.customer.phone },
                  { label: 'Email', value: job.customer.email },
                  {
                    label: 'Vehicle',
                    value: (
                      <Link href={`/vehicles/${job.vehicle.id}`} className="hover:underline">
                        {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
                      </Link>
                    ),
                  },
                  { label: 'VIN', value: <Vin value={job.vehicle.vin} /> },
                  {
                    label: 'Odometer in',
                    value: <Mileage km={job.odometerInKm} />,
                  },
                  {
                    label: 'Technician',
                    value: job.technicians.map((t) => t.user.name).join(', ') || 'Unassigned',
                  },
                  { label: 'Bay', value: job.bay?.name },
                  {
                    label: 'Promised',
                    value: job.promisedAt
                      ? job.promisedAt.toLocaleString('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : null,
                  },
                  { label: 'Customer order number', value: job.customerOrderNumber },
                  {
                    label: 'Job types',
                    value: job.jobTypes.map((t) => t.jobType.name).join(', ') || null,
                  },
                  {
                    label: 'Clocked time',
                    value:
                      clockedMinutes > 0 ? `${(clockedMinutes / 60).toFixed(1)} h actual` : null,
                  },
                ]}
              />

              {job.diagnosis ? (
                <div className="mt-5 border-t border-(--border) pt-4">
                  <p className="eyebrow mb-1">Diagnosis</p>
                  <p className="text-[13px] leading-relaxed">{job.diagnosis}</p>
                </div>
              ) : null}
            </CardBody>
          </Card>

          {inspection && findings ? (
            <Card>
              <CardHeader
                title="Inspection"
                description={
                  inspection.performedBy
                    ? `${inspection.performedBy.name} · ${inspection.status === 'COMPLETED' ? 'completed' : 'in progress'}`
                    : undefined
                }
                action={
                  <SeveritySummary
                    pass={findings.pass}
                    advisory={findings.advisory}
                    critical={findings.critical}
                  />
                }
              />
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>Section</Th>
                      <Th>Item</Th>
                      <Th>Measurement</Th>
                      <Th>Finding</Th>
                      <Th>Recommended</Th>
                      <Th numeric>Estimate</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspection.results
                      .filter((result) => result.severity !== 'PASS')
                      .map((result) => (
                        <Tr key={result.id}>
                          <Td className="text-(--text-faint)">{result.sectionName}</Td>
                          <Td className="font-medium">{result.itemName}</Td>
                          <Td className="datum text-(--text-soft)">
                            {result.measurementValue !== null
                              ? `${result.measurementValue} ${measurementUnit(result.measurementType)}`
                              : '—'}
                          </Td>
                          <Td>
                            <SeverityBadge severity={result.severity} />
                          </Td>
                          <Td className="max-w-[16rem] text-(--text-soft)">
                            {result.recommendedAction ?? result.note ?? '—'}
                            {result.photos.length > 0 ? (
                              <span className="ml-1.5 text-[11px] text-(--text-faint)">
                                ({result.photos.length} photo
                                {result.photos.length === 1 ? '' : 's'})
                              </span>
                            ) : null}
                          </Td>
                          <Td numeric>
                            {result.estimatedCost ? (
                              <Money amount={Number(result.estimatedCost)} />
                            ) : (
                              '—'
                            )}
                          </Td>
                        </Tr>
                      ))}
                  </tbody>
                </Table>
              </TableWrap>
              {findings.allClear ? (
                <CardBody className="text-[13px] text-(--text-soft)">
                  Everything checked passed. {findings.pass} items inspected.
                </CardBody>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Labour and parts"
              description="Charged at book time; costed at clocked time."
            />
            <TableWrap className="rounded-none border-0">
              <Table>
                <thead>
                  <tr>
                    <Th>Description</Th>
                    <Th numeric>Qty</Th>
                    <Th numeric>Unit</Th>
                    <Th numeric>Net</Th>
                    <Th numeric>Tax</Th>
                    <Th numeric>Total</Th>
                  </tr>
                </thead>
                <tbody>
                  {job.labourLines.map((line, index) => (
                    <Tr key={line.id}>
                      <Td>
                        <span className="eyebrow mr-2">Labour</span>
                        {line.description}
                      </Td>
                      <Td numeric>{Number(line.hours).toFixed(2)} h</Td>
                      <Td numeric>
                        <Money amount={Number(line.rate)} />
                      </Td>
                      <Td numeric>
                        <Money amount={toNumber(totals.lines[index]!.net)} />
                      </Td>
                      <Td numeric>
                        <Money amount={toNumber(totals.lines[index]!.tax)} />
                      </Td>
                      <Td numeric className="font-medium">
                        <Money amount={toNumber(totals.lines[index]!.total)} />
                      </Td>
                    </Tr>
                  ))}
                  {job.partLines.map((line, index) => {
                    const computed = totals.lines[job.labourLines.length + index]!;
                    return (
                      <Tr key={line.id}>
                        <Td>
                          <span className="eyebrow mr-2">Part</span>
                          {line.description}
                          {line.partNumber ? (
                            <span className="datum ml-2 text-[11px] text-(--text-faint)">
                              {line.partNumber}
                            </span>
                          ) : null}
                        </Td>
                        <Td numeric>{Number(line.quantity)}</Td>
                        <Td numeric>
                          <Money amount={Number(line.unitPrice)} />
                        </Td>
                        <Td numeric>
                          <Money amount={toNumber(computed.net)} />
                        </Td>
                        <Td numeric>
                          <Money amount={toNumber(computed.tax)} />
                        </Td>
                        <Td numeric className="font-medium">
                          <Money amount={toNumber(computed.total)} />
                        </Td>
                      </Tr>
                    );
                  })}
                  {job.feeLines.map((line, index) => {
                    const computed =
                      totals.lines[job.labourLines.length + job.partLines.length + index]!;
                    return (
                      <Tr key={line.id}>
                        <Td>
                          <span className="eyebrow mr-2">Fee</span>
                          {line.description}
                        </Td>
                        <Td numeric>1</Td>
                        <Td numeric>
                          <Money amount={Number(line.amount)} />
                        </Td>
                        <Td numeric>
                          <Money amount={toNumber(computed.net)} />
                        </Td>
                        <Td numeric>
                          <Money amount={toNumber(computed.tax)} />
                        </Td>
                        <Td numeric className="font-medium">
                          <Money amount={toNumber(computed.total)} />
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-(--surface-sunk)">
                    <Td colSpan={3} className="font-medium">
                      Total
                    </Td>
                    <Td numeric className="font-medium">
                      <Money amount={toNumber(totals.subtotal)} />
                    </Td>
                    <Td numeric className="font-medium">
                      <Money amount={toNumber(totals.taxTotal)} />
                    </Td>
                    <Td numeric className="font-display text-[15px] font-semibold">
                      <Money amount={toNumber(totals.total)} />
                    </Td>
                  </tr>
                </tfoot>
              </Table>
            </TableWrap>
          </Card>

          {job.tasks.length > 0 ? (
            <Card>
              <CardHeader
                title="Tasks"
                description={`${job.tasks.filter((t) => t.isDone).length} of ${job.tasks.length} complete`}
              />
              <ul className="divide-y divide-(--border)">
                {job.tasks.map((task) => (
                  <li key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span
                      aria-hidden
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border text-[10px] font-bold ${
                        task.isDone
                          ? 'border-(--success) bg-(--success) text-white'
                          : 'border-(--border-strong)'
                      }`}
                    >
                      {task.isDone ? '✓' : ''}
                    </span>
                    <span
                      className={`text-[13px] ${task.isDone ? 'text-(--text-faint) line-through' : ''}`}
                    >
                      {task.title}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {job.notes.length > 0 ? (
            <Card>
              <CardHeader title="Notes" />
              <ul className="divide-y divide-(--border)">
                {job.notes.map((note) => (
                  <li key={note.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-medium">
                        {note.author?.name ?? 'System'}
                      </span>
                      <time className="datum text-[11px] text-(--text-faint)">
                        {note.createdAt.toLocaleString('en-GB', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </time>
                      {note.isCustomerVisible ? (
                        <Badge tone="info" size="sm">
                          Customer sees this
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-[13px] leading-relaxed">{note.body}</p>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>

        {/* ---------------- side column ---------------- */}
        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader title="Progress" />
            <CardBody>
              <ProgressTrail stages={stages} />
            </CardBody>
          </Card>

          {estimate ? (
            <Card>
              <CardHeader
                title={`Estimate v${estimate.version}`}
                action={
                  <Badge
                    tone={
                      estimate.status === 'APPROVED'
                        ? 'success'
                        : estimate.status === 'DECLINED'
                          ? 'danger'
                          : estimate.status === 'SENT'
                            ? 'warning'
                            : 'neutral'
                    }
                    dot
                  >
                    {estimate.status.replace('_', ' ').toLowerCase()}
                  </Badge>
                }
              />
              <CardBody className="grid gap-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Subtotal</span>
                  <Money amount={Number(estimate.subtotal)} currency={estimate.currency} />
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Tax</span>
                  <Money amount={Number(estimate.taxTotal)} currency={estimate.currency} />
                </div>
                <div className="flex justify-between border-t border-(--border) pt-2 font-display text-[16px] font-semibold">
                  <span>Total</span>
                  <Money amount={Number(estimate.total)} currency={estimate.currency} />
                </div>

                {estimate.approvals[0] ? (
                  <div className="mt-2 rounded-(--radius-sm) bg-(--success-soft) px-2.5 py-2 text-[12px] text-(--success)">
                    <p className="font-semibold">
                      {estimate.approvals[0].decision === 'APPROVED'
                        ? 'Approved'
                        : estimate.approvals[0].decision === 'DECLINED'
                          ? 'Declined'
                          : 'Partly approved'}
                      {estimate.approvals[0].approvedByName
                        ? ` by ${estimate.approvals[0].approvedByName}`
                        : ''}
                    </p>
                    <p className="datum mt-0.5 text-[11px]">
                      {estimate.approvals[0].createdAt.toLocaleString('en-GB', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </p>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          {invoice ? (
            <Card>
              <CardHeader
                title={`Invoice ${invoice.number}`}
                action={
                  <Badge tone={invoice.status === 'PAID' ? 'success' : 'warning'} dot>
                    {invoice.status.replace('_', ' ').toLowerCase()}
                  </Badge>
                }
              />
              <CardBody className="grid gap-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Total</span>
                  <Money amount={Number(invoice.total)} currency={invoice.currency} />
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Paid</span>
                  <Money amount={Number(invoice.amountPaid)} currency={invoice.currency} />
                </div>
                <div className="flex justify-between border-t border-(--border) pt-2 font-medium">
                  <span>Outstanding</span>
                  <Money
                    amount={Number(invoice.total) - Number(invoice.amountPaid)}
                    currency={invoice.currency}
                  />
                </div>
              </CardBody>
            </Card>
          ) : null}

          {job.qualityChecks.length > 0 ? (
            <Card>
              <CardHeader title="Quality control" />
              <CardBody className="text-[13px]">
                {job.qualityChecks.map((check) => (
                  <div key={check.id} className="flex items-center gap-2">
                    <Badge tone={check.passed ? 'success' : 'danger'} dot>
                      {check.passed ? 'Passed' : 'Failed'}
                    </Badge>
                    <span className="text-(--text-soft)">{check.checkedBy.name}</span>
                  </div>
                ))}
              </CardBody>
            </Card>
          ) : null}

          {showsProfit ? (
            <Card>
              <CardHeader
                title="Profitability"
                description="Clocked time at cost, parts at what the stock was worth"
              />
              <CardBody className="grid gap-2 text-[13px]">
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Revenue, net of tax</span>
                  <Money amount={toNumber(profit.revenue)} />
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">Parts at cost</span>
                  <span className="tabular text-(--text-soft)">
                    &minus;
                    <Money amount={toNumber(profit.partsCost)} />
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-(--text-faint)">
                    Labour at cost
                    <span className="ml-1 text-[11px]">
                      {(clockedMinutes / 60).toFixed(1)}h clocked
                    </span>
                  </span>
                  <span className="tabular text-(--text-soft)">
                    &minus;
                    <Money amount={toNumber(profit.labourCost)} />
                  </span>
                </div>

                <div className="mt-1 flex items-baseline justify-between border-t border-(--border) pt-2">
                  <span className="font-medium">Gross profit</span>
                  <span className="text-right">
                    <Money
                      amount={toNumber(profit.grossProfit)}
                      className={`font-display text-[20px] font-semibold ${
                        profit.grossProfit.minor < 0 ? 'text-(--danger)' : 'text-(--brand-text)'
                      }`}
                    />
                    {profit.marginPct === null ? null : (
                      <span className="tabular block text-[11px] text-(--text-faint)">
                        {profit.marginPct}% margin
                      </span>
                    )}
                  </span>
                </div>

                {profit.partsMarginPct !== null ? (
                  <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                    Parts alone returned {profit.partsMarginPct}%. This is where margin leaks
                    quietly: a discount given at the counter never shows up in the labour figure.
                  </p>
                ) : null}

                {clockedMinutes === 0 ? (
                  <p className="rounded-(--radius-sm) bg-(--warning-soft) px-2.5 py-2 text-[12px] leading-relaxed text-(--warning)">
                    No time has been clocked against this job, so labour cost is zero and this
                    margin is flattering. Treat it as revenue less parts, nothing more.
                  </p>
                ) : null}
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="History" />
            <ul className="divide-y divide-(--border) text-[12px]">
              {job.statusEvents
                .slice()
                .reverse()
                .map((event) => (
                  <li key={event.id} className="px-4 py-2">
                    <p className="font-medium">{humanise(event.toStatus as JobStatus)}</p>
                    <p className="text-(--text-faint)">
                      {event.actor?.name ?? 'System'} ·{' '}
                      <time className="datum">
                        {event.createdAt.toLocaleString('en-GB', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </time>
                    </p>
                  </li>
                ))}
            </ul>
          </Card>
        </aside>
      </div>
    </>
  );
}

function measurementUnit(type: string): string {
  switch (type) {
    case 'TREAD_DEPTH_MM':
    case 'PAD_THICKNESS_MM':
    case 'DISC_THICKNESS_MM':
    case 'MM':
      return 'mm';
    case 'PERCENT':
      return '%';
    case 'VOLTAGE':
      return 'V';
    case 'PRESSURE_BAR':
      return 'bar';
    case 'TEMPERATURE_C':
      return 'C';
    default:
      return '';
  }
}
