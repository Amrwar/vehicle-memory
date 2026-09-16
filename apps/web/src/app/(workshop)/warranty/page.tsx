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
  Money,
  PageHeader,
  Registration,
  Select,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { msg } from '@carnet/core';
import { prisma } from '@carnet/db';

import { can, requireSession } from '@/lib/guard';
import { once, onceToken, StillGoingError } from '@/lib/once';
import { SubmitOnce } from '@/components/submit-once';
import { tFor } from '@/lib/i18n';
import { periodFor } from '@/lib/reports';
import {
  attachRemedy,
  raiseClaim,
  recordCover,
  remedyCost,
  settleClaim,
  warrantyBook,
  warrantyCostFor,
  WarrantyError,
} from '@/lib/warranty';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Warranty') };
}
export const dynamic = 'force-dynamic';

/**
 * What the workshop is standing behind. FR-3001.
 *
 * The thing this page exists to stop is quiet and expensive. A workshop
 * replaces a part under its own warranty while the supplier's warranty on the
 * same part is still running, absorbs the cost, and never claims it back.
 * Nothing in an ordinary system points that out, because nothing holds both
 * dates in one place.
 *
 * So the figure at the top is not the value of the claims. It is the part of
 * them nobody else will cover, which is the only number that comes out of the
 * workshop's own pocket.
 */
function date(value: Date, locale: string): string {
  return value.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

const number = (value: FormDataEntryValue | null): number | null => {
  const raw = String(value ?? '').trim();
  return raw === '' ? null : Number(raw.replace(',', '.'));
};

const back = (problem: string): never =>
  redirect(`/warranty?problem=${encodeURIComponent(problem)}#claims`);

/** Somebody brings the car back and the workshop stands behind the work. */
/**
 * Writing down what the workshop is standing behind. FR-3002.
 *
 * The beginning of the cycle, and the piece that was missing: every screen
 * here read a warranty book that nothing could write to. A workshop could see
 * what it was carrying, raise a claim against it and settle it, and had no way
 * to say "we stand behind this gearbox for two years" in the first place.
 *
 * Recorded against the job that did the work, because that is what fixes the
 * date it starts from and the mileage it counts from, and because a warranty
 * with no job behind it cannot be costed when somebody comes back.
 */
async function cover(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');
  const jobId = String(formData.get('jobId') ?? '');

  const job = await prisma.job.findFirst({
    where: { id: jobId, orgId },
    select: { vehicleId: true },
  });

  // `back` never returns, but TypeScript cannot see that through the
  // redirect, so the narrowing is written out.
  if (!job) {
    back(msg('Choose the job the work was done on.'));
    return;
  }

  try {
    await once({
      orgId,
      key: ['warranty-cover', jobId, String(formData.get('once') ?? '')],
      work: () =>
        recordCover({
          orgId,
          userId: user.userId,
          jobId,
          vehicleId: job.vehicleId,
          kind: String(formData.get('kind') ?? 'PART') === 'LABOUR' ? 'LABOUR' : 'PART',
          description: String(formData.get('description') ?? ''),
          months: Number(formData.get('months') ?? 12),
          km: formData.get('km') ? Number(formData.get('km')) : null,
          supplierId: String(formData.get('supplierId') ?? '') || null,
          supplierMonths: formData.get('supplierMonths')
            ? Number(formData.get('supplierMonths'))
            : null,
        }),
    });
  } catch (error) {
    if (error instanceof StillGoingError) back(error.message);
    if (!(error instanceof WarrantyError)) throw error;
    back(error.message);
  }

  redirect('/warranty?done=covered');
}

async function raise(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');

  try {
    await raiseClaim({
      orgId,
      userId: user.userId,
      warrantyId: String(formData.get('warrantyId') ?? ''),
      complaint: String(formData.get('complaint') ?? ''),
      goodwillReason: String(formData.get('goodwillReason') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof WarrantyError)) throw error;
    back(error.message);
  }

  redirect('/warranty?done=raised#claims');
}

/** The job that put it right, so the cost can be read from it rather than typed. */
async function attach(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');

  try {
    await attachRemedy({
      orgId,
      userId: user.userId,
      claimId: String(formData.get('claimId') ?? ''),
      jobId: String(formData.get('jobId') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof WarrantyError)) throw error;
    back(error.message);
  }

  redirect('/warranty?done=attached#claims');
}

/** Closes it with what it cost and what came back. Phase 44. */
async function settle(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('job:write');

  try {
    await settleClaim({
      orgId,
      userId: user.userId,
      claimId: String(formData.get('claimId') ?? ''),
      status: String(formData.get('status') ?? 'SETTLED') as 'SETTLED',
      outcome: String(formData.get('outcome') ?? ''),
      supplierRef: String(formData.get('supplierRef') ?? ''),
      partsCost: number(formData.get('partsCost')),
      labourCost: number(formData.get('labourCost')),
      recovered: number(formData.get('recovered')),
    });
  } catch (error) {
    if (!(error instanceof WarrantyError)) throw error;
    back(error.message);
  }

  redirect('/warranty?done=settled#claims');
}

export default async function WarrantyPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; problem?: string; done?: string }>;
}) {
  const { orgId, region, user } = await requireSession('job:read');
  const t = await tFor();
  const { range, problem, done } = await searchParams;

  const period = periodFor(range ?? 'year', region.locale);
  const [book, cost, coverable, suppliers] = await Promise.all([
    warrantyBook(orgId),
    warrantyCostFor(orgId, period),
    // Jobs finished recently enough that somebody might still be writing down
    // what the workshop stands behind on them.
    prisma.job.findMany({
      where: { orgId, status: { in: ['COMPLETED', 'INVOICED', 'PAID'] } },
      orderBy: { updatedAt: 'desc' },
      take: 40,
      select: {
        id: true,
        number: true,
        shortDescription: true,
        vehicle: { select: { registration: true } },
      },
    }),
    prisma.supplier.findMany({
      where: { orgId, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
      take: 60,
    }),
  ]);
  const mayWrite = can(user.role, 'job:write');
  const token = onceToken();

  // What each open claim's remedy has cost so far, so settling is a
  // confirmation rather than an arithmetic exercise at the counter.
  const measured = new Map<string, { partsCost: number; labourCost: number }>();
  for (const entry of book.openClaims) {
    const claim = entry.row.claims.find((row) => row.status === 'OPEN');
    if (claim?.remedyJobId) {
      measured.set(claim.id, await remedyCost(orgId, claim.remedyJobId));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('Warranty')}
        description={t('What is still covered, what is running out, and who should be paying')}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Under cover')}
          value={book.active.length}
          note={t('{count} on record', { count: book.all.length })}
        />
        <StatTile
          label={t('Running out')}
          value={book.expiring.length}
          tone={book.expiring.length > 0 ? 'warning' : 'neutral'}
          note={t('Inside the next month')}
        />
        <StatTile
          label={t('Open claims')}
          value={book.openClaims.length}
          tone={book.openClaims.length > 0 ? 'brand' : 'neutral'}
          note={t('Not yet settled')}
        />
        <StatTile
          label={t('Carrying')}
          value={<Money currency={region.currency} locale={region.locale} amount={book.exposure} />}
          tone={book.exposure > 0 ? 'danger' : 'neutral'}
          note={t('What nobody else will cover')}
        />
      </StatRow>

      {mayWrite ? (
        <Card className="mb-5">
          <CardHeader
            title={t('Stand behind a job')}
            description={t(
              'What the workshop is covering, for how long, and whether a supplier is behind it too',
            )}
          />
          <form action={cover}>
            <CardBody className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <input type="hidden" name="once" value={token} />

              <Field
                label={t('The job')}
                hint={t('Fixes the date and the mileage it counts from')}
                className="sm:col-span-2"
              >
                <Select name="jobId" required defaultValue="">
                  <option value="" disabled>
                    {t('Choose a finished job')}
                  </option>
                  {coverable.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.number} · {job.vehicle?.registration ?? ''} ·{' '}
                      {job.shortDescription ?? ''}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('What is covered')} className="sm:col-span-2">
                <Input name="description" required placeholder={t('Gearbox, reconditioned')} />
              </Field>

              <Field label={t('Part or labour')}>
                <Select name="kind" defaultValue="PART">
                  <option value="PART">{t('A part')}</option>
                  <option value="LABOUR">{t('The work')}</option>
                </Select>
              </Field>

              <Field label={t('Months')}>
                <Input name="months" type="number" min={1} max={120} defaultValue={12} required />
              </Field>

              <Field label={t('Mileage allowance')} hint={t('Optional')}>
                <Input name="km" type="number" min={0} placeholder="20000" />
              </Field>

              <Field label={t('Behind it')} hint={t('Optional. Whose warranty backs yours.')}>
                <Select name="supplierId" defaultValue="">
                  <option value="">{t('Nobody but us')}</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={t('Their months')}
                hint={t('Theirs often outlasts yours, which is the point of recording it.')}
              >
                <Input name="supplierMonths" type="number" min={0} max={240} placeholder="24" />
              </Field>

              <div className="sm:col-span-2 lg:col-span-4">
                <SubmitOnce>{t('Record the cover')}</SubmitOnce>
              </div>
            </CardBody>
          </form>
        </Card>
      ) : null}

      {book.expiring.length > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {book.expiring.length === 1
                ? t('1 warranty runs out within a month.')
                : t('{count} warranties run out within a month.', {
                    count: book.expiring.length,
                  })}
            </strong>{' '}
            {t(
              'A vehicle whose cover is about to lapse is a reason to get it in while the workshop is still the one who would put it right.',
            )}
          </CardBody>
        </Card>
      ) : null}

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      {done ? (
        <Alert tone="success" className="mb-5">
          {done === 'covered'
            ? t(
                'Recorded. It is on the vehicle and in what the workshop is carrying, and a claim can be raised against it.',
              )
            : done === 'raised'
              ? t(
                  'Raised. Put the job that fixes it against the claim and settle it when the supplier answers.',
                )
              : done === 'attached'
                ? t('Attached. What that job costs is now read from the job itself.')
                : t('Settled. It counts towards what warranty costs this workshop.')}
        </Alert>
      ) : null}

      <Card id="cost" className="mb-5 overflow-hidden">
        <CardHeader
          title={t('What warranty costs')}
          description={t(
            'Settled claims only, at what the work cost rather than what it would have been charged.',
          )}
          action={
            <span className="flex flex-wrap items-center gap-2 text-[12px]">
              {['month', 'quarter', 'year'].map((key) => (
                <Link
                  key={key}
                  href={`/warranty?range=${key}#cost`}
                  className={
                    (range ?? 'year') === key
                      ? 'font-medium text-(--brand-text)'
                      : 'text-(--text-faint) hover:text-(--text)'
                  }
                >
                  {key === 'month'
                    ? t('This month')
                    : key === 'quarter'
                      ? t('This quarter')
                      : t('This year')}
                </Link>
              ))}
              <a
                href={`/api/reports/warranty?range=${range ?? 'year'}`}
                className="text-(--brand-text) underline underline-offset-2"
              >
                {t('CSV')}
              </a>
            </span>
          }
        />
        <CardBody className="grid gap-3">
          <p className="text-[13px] leading-relaxed">{t(cost.summary)}</p>
          <StatRow>
            <StatTile
              label={t('The work cost')}
              value={
                <Money
                  currency={region.currency}
                  locale={region.locale}
                  amount={cost.cost.minor / 100}
                />
              }
              note={period.label}
            />
            <StatTile
              label={t('Came back')}
              value={
                <Money
                  currency={region.currency}
                  locale={region.locale}
                  amount={cost.recovered.minor / 100}
                />
              }
              note={
                cost.recoveryPct === null
                  ? t('Nothing spent')
                  : t('{pct}% of what was spent', { pct: cost.recoveryPct })
              }
              tone={cost.recovered.minor > 0 ? 'success' : 'neutral'}
            />
            <StatTile
              label={t('Carried')}
              value={
                <Money
                  currency={region.currency}
                  locale={region.locale}
                  amount={cost.net.minor / 100}
                />
              }
              note={
                cost.ofRevenuePct === null
                  ? t('No invoices in this period')
                  : t('{pct}% of turnover', { pct: cost.ofRevenuePct })
              }
              tone={cost.net.minor > 0 ? 'warning' : 'neutral'}
            />
            <StatTile
              label={t('Given as goodwill')}
              value={
                <Money
                  currency={region.currency}
                  locale={region.locale}
                  amount={cost.goodwill.minor / 100}
                />
              }
              note={t('Outside the cover, put right anyway')}
            />
          </StatRow>
        </CardBody>
        {cost.byProduct.length > 0 ? (
          <div className="grid border-t border-(--border) lg:grid-cols-2 lg:divide-x lg:divide-(--border)">
            <div>
              <CardHeader title={t('By what failed')} />
              <ul className="divide-y divide-(--border)">
                {cost.byProduct.map((group) => (
                  <li
                    key={group.name}
                    className="flex flex-wrap items-baseline gap-3 px-4 py-2 text-[13px]"
                  >
                    <bdi className="font-medium">{group.name}</bdi>
                    <span className="text-(--text-faint)">
                      {group.claims === 1
                        ? t('1 claim')
                        : t('{count} claims', { count: group.claims })}
                    </span>
                    <span className="ms-auto tabular-nums">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={group.net.minor / 100}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <CardHeader title={t('By who stood behind it')} />
              <ul className="divide-y divide-(--border)">
                {cost.bySupplier.map((group) => (
                  <li
                    key={group.name}
                    className="flex flex-wrap items-baseline gap-3 px-4 py-2 text-[13px]"
                  >
                    <bdi className="font-medium">{group.name}</bdi>
                    <span className="text-(--text-faint)">
                      {t('{pct}% back', {
                        pct:
                          group.cost.minor > 0
                            ? Math.round((group.recovered.minor / group.cost.minor) * 100)
                            : 0,
                      })}
                    </span>
                    <span className="ms-auto tabular-nums">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={group.net.minor / 100}
                      />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Card>

      {book.openClaims.length > 0 ? (
        <Card id="claims" className="mb-5 overflow-hidden">
          <CardHeader
            title={t('Claims nobody has settled')}
            description={t(
              'Each one is money sitting with a supplier who has not been chased, or a cost the workshop has already absorbed.',
            )}
          />
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('What failed')}</Th>
                  <Th>{t('Vehicle')}</Th>
                  <Th>{t('Complaint')}</Th>
                  <Th numeric>{t('Recoverable')}</Th>
                  <Th numeric>{t('On us')}</Th>
                </tr>
              </thead>
              <tbody>
                {book.openClaims.map((entry) => {
                  const claim = entry.row.claims.find((row) => row.status === 'OPEN')!;

                  return (
                    <Tr key={claim.id}>
                      <Td className="font-medium">{entry.row.description}</Td>
                      <Td>
                        <Link
                          href={`/vehicles/${entry.row.vehicle.id}`}
                          className="hover:text-(--brand-text) hover:underline"
                        >
                          {entry.row.vehicle.make} {entry.row.vehicle.model}
                        </Link>
                      </Td>
                      <Td className="text-[12px] text-(--text-soft)">
                        {claim.complaint}
                        {claim.outsideCover ? (
                          <Badge tone="warning" size="sm" className="ms-2">
                            {t('goodwill')}
                          </Badge>
                        ) : null}
                      </Td>
                      <Td numeric className="text-(--success)">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={Number(claim.recoverable)}
                        />
                      </Td>
                      <Td numeric className="font-medium">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={Number(claim.exposure)}
                        />
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>

          {mayWrite ? (
            <CardBody className="grid gap-4 border-t border-(--border)">
              {book.openClaims.map((entry) => {
                const claim = entry.row.claims.find((row) => row.status === 'OPEN')!;
                const seen = measured.get(claim.id);

                return (
                  <div key={claim.id} className="grid gap-2">
                    <p className="text-[13px] font-medium">
                      <bdi>{entry.row.description}</bdi>
                      <span className="ms-2 text-[12px] font-normal text-(--text-faint)">
                        {seen
                          ? t(
                              'The remedy job has cost {parts} in parts and {labour} in hours so far.',
                              {
                                parts: seen.partsCost.toFixed(2),
                                labour: seen.labourCost.toFixed(2),
                              },
                            )
                          : t('No job has been put against this claim yet.')}
                      </span>
                    </p>

                    <form action={attach} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="claimId" value={claim.id} />
                      <Field
                        label={t('The job that put it right')}
                        hint={t('Its cost is then read from the job, not typed.')}
                        className="min-w-[14rem] flex-1"
                      >
                        <Input name="jobId" required placeholder={t('Job id')} />
                      </Field>
                      <Button type="submit" size="sm" variant="ghost">
                        {t('Attach')}
                      </Button>
                    </form>

                    <form
                      action={settle}
                      className="grid gap-2 sm:grid-cols-[8rem_7rem_7rem_7rem_minmax(0,1fr)_auto] sm:items-end"
                    >
                      <input type="hidden" name="claimId" value={claim.id} />
                      <Field label={t('How it ended')}>
                        <Select name="status" defaultValue="SETTLED">
                          <option value="SETTLED">{t('Settled')}</option>
                          <option value="ACCEPTED">{t('Accepted')}</option>
                          <option value="REJECTED">{t('Rejected')}</option>
                        </Select>
                      </Field>
                      <Field label={t('Parts at cost')}>
                        <Input
                          name="partsCost"
                          inputMode="decimal"
                          defaultValue={seen ? seen.partsCost.toFixed(2) : ''}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field label={t('Hours at cost')}>
                        <Input
                          name="labourCost"
                          inputMode="decimal"
                          defaultValue={seen ? seen.labourCost.toFixed(2) : ''}
                          placeholder="0.00"
                        />
                      </Field>
                      <Field label={t('Recovered')}>
                        <Input name="recovered" inputMode="decimal" placeholder="0.00" />
                      </Field>
                      <Field label={t('What happened')}>
                        <Input
                          name="outcome"
                          required
                          placeholder={t('Credited in full against the next invoice')}
                        />
                      </Field>
                      <Button type="submit" size="sm" variant="secondary">
                        {t('Close it')}
                      </Button>
                    </form>
                  </div>
                );
              })}
            </CardBody>
          ) : null}
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title={t('Everything covered')}
          description={t(
            'Cover runs from the day the work was done, and ends on time or on mileage, whichever comes first.',
          )}
        />
        {book.all.length === 0 ? (
          <EmptyState
            title={t('Nothing recorded yet')}
            description={t(
              'Cover is recorded as a job closes, and appears here with the date and mileage it runs to.',
            )}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('What')}</Th>
                  <Th>{t('Vehicle')}</Th>
                  <Th>{t('From')}</Th>
                  <Th>{t('State')}</Th>
                  <Th>{t('Behind it')}</Th>
                  {mayWrite ? <Th>{t('It has failed')}</Th> : null}
                </tr>
              </thead>
              <tbody>
                {book.all.map((entry) => (
                  <Tr key={entry.row.id}>
                    <Td>
                      <span className="font-medium">{entry.row.description}</span>
                      <span className="block text-[11px] text-(--text-faint)">
                        {entry.row.kind === 'PART' ? t('Part') : t('Labour')} ·{' '}
                        {t('job {number}', { number: entry.row.job.number })}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/vehicles/${entry.row.vehicle.id}`}
                        className="hover:text-(--brand-text) hover:underline"
                      >
                        {entry.row.vehicle.make} {entry.row.vehicle.model}
                      </Link>
                      {entry.row.vehicle.registration ? (
                        <span className="ms-2 inline-block align-middle">
                          <Registration value={entry.row.vehicle.registration} />
                        </span>
                      ) : null}
                    </Td>
                    <Td className="text-(--text-soft)">
                      {date(entry.row.startedOn, region.locale)}
                    </Td>
                    <Td>
                      <Badge
                        tone={
                          entry.status.active
                            ? entry.status.daysLeft <= 30
                              ? 'warning'
                              : 'success'
                            : 'neutral'
                        }
                        size="sm"
                      >
                        {entry.status.active
                          ? t('{days}d left', { days: entry.status.daysLeft })
                          : t('expired')}
                      </Badge>
                      <span className="block text-[11px] text-(--text-faint)">
                        {t(entry.status.summary)}
                      </span>
                    </Td>
                    <Td className="text-[12px] text-(--text-soft)">
                      {entry.cover.supplierName
                        ? t('{supplier}, {months} months', {
                            supplier: entry.cover.supplierName,
                            months: entry.cover.supplierMonths ?? '—',
                          })
                        : t('Nobody. All of it falls on the workshop.')}
                    </Td>
                    {mayWrite ? (
                      <Td>
                        {entry.row.claims.some((claim) => claim.status === 'OPEN') ? (
                          <span className="text-[12px] text-(--text-faint)">
                            {t('A claim is open on this.')}
                          </span>
                        ) : (
                          <form action={raise} className="flex flex-wrap items-end gap-2">
                            <input type="hidden" name="warrantyId" value={entry.row.id} />
                            <Input
                              name="complaint"
                              required
                              minLength={3}
                              className="min-w-[10rem]"
                              placeholder={t('What has gone wrong')}
                            />
                            {entry.status.active ? null : (
                              <Input
                                name="goodwillReason"
                                required
                                className="min-w-[10rem]"
                                placeholder={t('Why entertain it, out of cover')}
                              />
                            )}
                            <Button type="submit" size="sm" variant="ghost">
                              {t('Raise a claim')}
                            </Button>
                          </form>
                        )}
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>
    </>
  );
}
