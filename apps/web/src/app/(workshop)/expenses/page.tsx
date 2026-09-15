import { describeCategory, type ExpenseCategory, toNumber } from '@carnet/core';
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
import { redirect } from 'next/navigation';

import { PlanWall } from '@/components/plan-wall';
import { approveExpense, expensesFor, recordExpense } from '@/lib/banking';
import { planIncludes, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { periodFor } from '@/lib/reports';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Expenses') };
}
export const dynamic = 'force-dynamic';

const CATEGORIES: ExpenseCategory[] = [
  'PREMISES',
  'UTILITIES',
  'INSURANCE',
  'VEHICLE',
  'EQUIPMENT',
  'CONSUMABLES',
  'MARKETING',
  'PROFESSIONAL',
  'TRAINING',
  'SUBSCRIPTIONS',
  'OTHER',
];

/**
 * Money out that is not a supplier bill. FR-2101, FR-2102.
 *
 * Rent, insurance, the coffee, a part bought from a factor down the road on
 * somebody's own card. These were hand-written journal entries until now,
 * which works exactly as long as the person writing them knows double-entry.
 * Everybody else either guesses or stops recording them, and a profit figure
 * missing its overheads is worse than no profit figure.
 *
 * The posting happens on approval, not on entry: an expense nobody has agreed
 * to is not yet a cost.
 */

async function record(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('ledger:write');

  const result = await recordExpense({
    orgId,
    userId: user.userId,
    locationId: user.locationId,
    category: String(formData.get('category') ?? 'OTHER') as ExpenseCategory,
    supplier: String(formData.get('supplier') ?? ''),
    description: String(formData.get('description') ?? ''),
    net: Number(formData.get('net') ?? 0),
    tax: Number(formData.get('tax') ?? 0),
    incurredAt: new Date(String(formData.get('incurredAt') ?? new Date().toISOString())),
    paidFrom: String(formData.get('paidFrom') ?? 'BANK') as 'BANK' | 'CASH' | 'PERSONAL' | 'CARD',
    receiptUrl: formData.get('hasReceipt') === 'on' ? 'receipt-on-file' : null,
  });

  redirect(
    result.ok
      ? '/expenses?recorded=1'
      : `/expenses?error=${encodeURIComponent(result.error ?? 'That did not work.')}`,
  );
}

async function approve(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('ledger:write');

  const result = await approveExpense({
    orgId,
    expenseId: String(formData.get('expenseId') ?? ''),
    approverUserId: user.userId,
  });

  redirect(
    result.ok
      ? '/expenses?approved=1'
      : `/expenses?error=${encodeURIComponent(result.error ?? '')}`,
  );
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId, plan, region } = await requireSession('report:financial');
  const t = await tFor();

  if (!planIncludes(plan, 'ledger')) {
    return <PlanWall feature="ledger" plan={plan} />;
  }

  const params = await searchParams;
  const period = periodFor(params.range ?? 'year', region.locale);
  const { rows, summary } = await expensesFor(orgId, period);

  const awaiting = rows.filter((row) => row.status === 'SUBMITTED');

  return (
    <>
      <PageHeader
        eyebrow={t('Finance')}
        title={t('Expenses')}
        description={t(period.label)}
        actions={(['month', 'quarter', 'year'] as const).map((option) => (
          <a key={option} href={`/expenses?range=${option}`}>
            <Button
              size="sm"
              variant={(params.range ?? 'year') === option ? 'primary' : 'secondary'}
            >
              {option === 'month' ? t('Month') : option === 'quarter' ? t('Quarter') : t('Year')}
            </Button>
          </a>
        ))}
      />

      {params.error ? (
        <Alert tone="danger" className="mb-5">
          {t(params.error)}
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label={t('Spent')}
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={toNumber(summary.total)}
            />
          }
          note={t('Excluding rejected claims')}
        />
        <StatTile
          label={t('Tax to reclaim')}
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={toNumber(summary.reclaimableTax)}
            />
          }
          note={t('Input tax, separated')}
        />
        <StatTile
          label={t('Owed to staff')}
          value={
            <Money
              currency={region.currency}
              locale={region.locale}
              amount={toNumber(summary.owedToStaff)}
            />
          }
          tone={summary.owedToStaff.minor > 0 ? 'warning' : 'neutral'}
          note={t('Paid personally, not yet repaid')}
        />
        <StatTile
          label={t('Awaiting approval')}
          value={summary.awaitingApproval}
          tone={summary.awaitingApproval > 0 ? 'warning' : 'neutral'}
          note={t('Not yet in the accounts')}
        />
      </StatRow>

      {summary.missingReceipts > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">
              {summary.missingReceipts === 1
                ? t('1 claim over the threshold with no receipt attached.')
                : t('{count} claims over the threshold with no receipt attached.', {
                    count: summary.missingReceipts,
                  })}
            </strong>{' '}
            {t(
              'An overhead figure built on remembered amounts cannot be defended to anybody, and the person who has to defend it is not the person who skipped the photograph.',
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          {awaiting.length > 0 ? (
            <Card className="overflow-hidden border-(--brand)">
              <CardHeader
                title={t('Waiting on approval')}
                description={t('Nothing here is in the accounts yet')}
              />
              <ul className="divide-y divide-(--border)">
                {awaiting.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">
                        <span className="datum text-(--text-faint)">{row.reference}</span>
                        <span className="px-1.5 text-(--text-faint)">·</span>
                        {row.supplier}
                      </p>
                      <p className="text-[11px] text-(--text-faint)">
                        {t(describeCategory(row.category as ExpenseCategory))}
                        {row.claimedBy
                          ? ` · ${t('claimed by {name}', { name: row.claimedBy.displayName })}`
                          : ''}
                        {row.receiptUrl ? '' : ` · ${t('no receipt')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={Number(row.net) + Number(row.tax)}
                        className="font-medium"
                      />
                      <form action={approve}>
                        <input type="hidden" name="expenseId" value={row.id} />
                        <Button type="submit" size="sm" variant="primary">
                          {t('Approve')}
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card className="overflow-hidden">
            <CardHeader title={t('Expenses')} description={t('Newest first')} />
            {rows.length === 0 ? (
              <EmptyState
                title={t('Nothing recorded')}
                description={t(
                  'Rent, insurance, subscriptions and anything else that is not a supplier bill.',
                )}
              />
            ) : (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('Reference')}</Th>
                      <Th>{t('Supplier')}</Th>
                      <Th>{t('Category')}</Th>
                      <Th>{t('Paid from')}</Th>
                      <Th>{t('Status')}</Th>
                      <Th numeric>{t('Total')}</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <Tr key={row.id}>
                        <Td className="datum font-medium">{row.reference}</Td>
                        <Td>{row.supplier}</Td>
                        <Td className="text-(--text-soft)">
                          {t(describeCategory(row.category as ExpenseCategory))}
                        </Td>
                        <Td className="text-(--text-soft) capitalize">
                          {t(row.paidFrom.toLowerCase())}
                        </Td>
                        <Td>
                          <Badge
                            tone={
                              row.status === 'APPROVED' || row.status === 'PAID'
                                ? 'success'
                                : row.status === 'REJECTED'
                                  ? 'danger'
                                  : 'warning'
                            }
                            size="sm"
                          >
                            {t(row.status.toLowerCase())}
                          </Badge>
                        </Td>
                        <Td numeric className="font-medium">
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={Number(row.net) + Number(row.tax)}
                          />
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}
          </Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card>
            <CardHeader title={t('Record an expense')} description={t('Posted once approved')} />
            <CardBody>
              <form action={record} className="grid gap-3.5">
                <Field label={t('Who was paid')}>
                  {/* i18n-ignore */}
                  <Input name="supplier" required placeholder="Hillside Estates" />
                </Field>

                <Field label={t('Category')}>
                  <Select name="category" defaultValue="OTHER">
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {t(describeCategory(category))}
                      </option>
                    ))}
                  </Select>
                </Field>

                <div className="grid grid-cols-2 gap-3.5">
                  <Field label={t('Amount')} hint={t('Before tax')}>
                    <Input name="net" type="number" min={0} step="0.01" required />
                  </Field>
                  <Field label={t('Tax')} hint={t('Reclaimable')}>
                    <Input name="tax" type="number" min={0} step="0.01" defaultValue="0" />
                  </Field>
                </div>

                <Field label={t('Date')}>
                  <Input
                    name="incurredAt"
                    type="date"
                    required
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                </Field>

                <Field label={t('Paid from')}>
                  <Select name="paidFrom" defaultValue="BANK">
                    <option value="BANK">{t('Bank')}</option>
                    <option value="CARD">{t('Company card')}</option>
                    <option value="CASH">{t('Cash')}</option>
                    <option value="PERSONAL">{t('Somebody’s own money')}</option>
                  </Select>
                </Field>

                <Field label={t('Note')} hint={t('Optional')}>
                  <Input name="description" placeholder={t('September rent')} />
                </Field>

                <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                  <input type="checkbox" name="hasReceipt" className="mt-0.5 h-4 w-4" />
                  <span className="text-(--text-soft)">{t('Receipt attached')}</span>
                </label>

                <Button type="submit" variant="primary" block>
                  {t('Record it')}
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('Where it went')} description={t(period.label)} />
            {summary.byCategory.length === 0 ? (
              <CardBody className="text-[13px] text-(--text-faint)">{t('Nothing yet.')}</CardBody>
            ) : (
              <CardBody className="grid gap-2.5">
                {summary.byCategory.map((row) => {
                  const share =
                    summary.total.minor === 0 ? 0 : (row.total.minor / summary.total.minor) * 100;

                  return (
                    <div key={row.category}>
                      <div className="flex items-baseline justify-between text-[12px]">
                        <span>{t(row.label)}</span>
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={toNumber(row.total)}
                          className="text-(--text-soft)"
                        />
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-(--surface-sunk)">
                        <div
                          className="h-full rounded-full bg-(--brand)"
                          style={{ width: `${Math.max(2, share)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardBody>
            )}
          </Card>

          <Card>
            <CardHeader title={t('Why tax is separate')} />
            <CardBody className="text-[12px] leading-relaxed text-(--text-soft)">
              {t(
                'Input tax is posted to its own account so it can be reclaimed. Putting the gross into overheads is the most common mistake in a small set of books, and it overstates costs by a fifth, every month, invisibly.',
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
