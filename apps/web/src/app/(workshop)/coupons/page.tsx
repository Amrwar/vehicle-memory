import { CouponError } from '@carnet/core';
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
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { couponHistory, couponResultsFor, coupons, retireCoupon, saveCoupon } from '@/lib/coupons';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { periodFor } from '@/lib/reports';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Coupons') };
}
export const dynamic = 'force-dynamic';

/**
 * Codes a workshop hands out. FR-7701.
 *
 * A coupon looks like a number and is actually a set of promises: when it
 * starts, when it ends, what the bill has to reach, how many times it can be
 * used at all and how many times by one person. All of them are on this page,
 * because a code whose rules live in somebody's head is a code that gets
 * argued about at the counter.
 *
 * What it gave away is on the same page as what it brought in. An offer that
 * cost four hundred pounds and was used on two thousand pounds of work is a
 * different thing from one used on four hundred and one.
 */
function back(problem: string): never {
  redirect(`/coupons?problem=${encodeURIComponent(problem)}`);
}

const date = (value: FormDataEntryValue | null): Date | null => {
  const raw = String(value ?? '').trim();
  // Midnight UTC: these are days rather than moments, and a day read back in
  // another timezone must not become the day before.
  return raw ? new Date(`${raw}T00:00:00.000Z`) : null;
};

const number = (value: FormDataEntryValue | null): number | null => {
  const raw = String(value ?? '').trim();
  return raw === '' ? null : Number(raw.replace(',', '.'));
};

async function save(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const kind = String(formData.get('kind') ?? 'PERCENT') as 'PERCENT' | 'AMOUNT';

  try {
    await saveCoupon({
      orgId,
      userId: user.userId,
      id: String(formData.get('id') ?? '') || null,
      code: String(formData.get('code') ?? ''),
      kind,
      percent: kind === 'PERCENT' ? (number(formData.get('percent')) ?? 0) : 0,
      amount: kind === 'AMOUNT' ? (number(formData.get('amount')) ?? 0) : 0,
      minSpend: number(formData.get('minSpend')),
      startsOn: date(formData.get('startsOn')),
      // The last day it works, read to the end of that day rather than to its
      // first moment: a code that says "until 30 June" works on 30 June.
      endsOn: (() => {
        const on = date(formData.get('endsOn'));
        return on ? new Date(on.getTime() + 86_399_999) : null;
      })(),
      maxRedemptions: number(formData.get('maxRedemptions')),
      perCustomer: number(formData.get('perCustomer')) ?? 1,
      note: String(formData.get('note') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof CouponError)) throw error;
    back(error.message);
  }

  redirect('/coupons?done=saved');
}

async function retire(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await retireCoupon({
      orgId,
      userId: user.userId,
      id: String(formData.get('id') ?? ''),
      // What to land on, rather than "the other one": pressed twice, the
      // code ends where the person meant it to. Phase 46.
      active: String(formData.get('active') ?? '') === 'yes',
    });
  } catch (error) {
    if (!(error instanceof CouponError)) throw error;
    back(error.message);
  }

  redirect('/coupons?done=retired');
}

export default async function CouponsPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; done?: string; show?: string }>;
}) {
  const { orgId, user, region } = await requireSession('customer:read');
  const t = await tFor();
  const { problem, done, show } = await searchParams;

  // The year so far. The reporting labels are built in English, so the
  // note beside each figure is said here instead.
  const period = periodFor('year', region.locale);
  const thisYear = t('This year so far');
  const [rows, results] = await Promise.all([coupons(orgId), couponResultsFor(orgId, period)]);
  const history = show ? await couponHistory(orgId, show) : [];

  const mayWrite = can(user.role, 'settings:write');
  const live = rows.filter((row) => row.state === 'ACTIVE');
  const givenAway = results.reduce((total, result) => total + result.given.minor, 0);
  const brought = results.reduce((total, result) => total + result.billed.minor, 0);
  const today = new Date().toISOString().slice(0, 10);

  // A comma is not the same mark in every script, and a list that reads
  // "20% off, bills over" with a Latin comma in Arabic looks like a mistake.
  const separator = region.locale.startsWith('ar') ? '، ' : ', ';
  const format = (amount: number) =>
    new Intl.NumberFormat(region.locale, {
      style: 'currency',
      currency: region.currency,
    }).format(amount);
  const trim = (value: number) => String(Math.round(value * 100) / 100);

  return (
    <>
      <PageHeader
        eyebrow={t('Customers')}
        title={t('Coupons')}
        description={t('Codes a customer hands over, and what each one has cost and brought in')}
        actions={
          <Link href="/reputation">
            <Button>{t('Reputation')}</Button>
          </Link>
        }
      />

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      {done ? (
        <Alert tone="success" className="mb-5">
          {done === 'retired'
            ? t('Saved. Codes already used keep what they gave away.')
            : t('Saved. The code works from now on, within whatever it says.')}
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile label={t('Codes running')} value={live.length} note={t('Usable today')} />
        <StatTile
          label={t('Given away')}
          value={
            <Money currency={region.currency} locale={region.locale} amount={givenAway / 100} />
          }
          note={thisYear}
          tone={givenAway > 0 ? 'warning' : 'neutral'}
        />
        <StatTile
          label={t('Billed on those visits')}
          value={<Money currency={region.currency} locale={region.locale} amount={brought / 100} />}
          note={t('What the offers brought in')}
          tone={brought > 0 ? 'success' : 'neutral'}
        />
        <StatTile
          label={t('Times used')}
          value={results.reduce((total, result) => total + result.redemptions, 0)}
          note={thisYear}
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="overflow-hidden">
          <CardHeader
            title={t('The codes')}
            description={t('A retired code is refused at the counter and keeps its history.')}
          />
          {rows.length === 0 ? (
            <EmptyState
              title={t('No codes yet')}
              description={t(
                'A code is worth a percentage or an amount, and can be limited by date, by bill, by how many times it is used and by how many times one customer uses it.',
              )}
            />
          ) : (
            <ul className="divide-y divide-(--border)">
              {rows.map((row) => (
                <li key={row.id} className="grid gap-1.5 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="datum text-[14px] font-semibold">{row.code}</span>
                    <Badge
                      tone={
                        row.state === 'ACTIVE'
                          ? 'success'
                          : row.state === 'NOT_YET'
                            ? 'info'
                            : row.state === 'RETIRED'
                              ? 'neutral'
                              : 'warning'
                      }
                      size="sm"
                    >
                      {row.state === 'ACTIVE'
                        ? t('running')
                        : row.state === 'NOT_YET'
                          ? t('not started')
                          : row.state === 'ENDED'
                            ? t('finished')
                            : row.state === 'USED_UP'
                              ? t('all used')
                              : t('retired')}
                    </Badge>
                    <span className="text-[13px] text-(--text-soft)">
                      {/* Composed here rather than taken as one sentence from
                          the rules, because a poster line assembled in English
                          and handed to a translator arrives half translated. */}
                      {[
                        row.kind === 'PERCENT'
                          ? t('{percent}% off', { percent: trim(Number(row.percent)) })
                          : t('{amount} off', { amount: format(Number(row.amount)) }),
                        row.minSpend && Number(row.minSpend) > 0
                          ? t('bills over {amount}', { amount: format(Number(row.minSpend)) })
                          : null,
                        row.endsOn
                          ? t('until {date}', {
                              date: row.endsOn.toLocaleDateString(region.locale, {
                                day: 'numeric',
                                month: 'long',
                                timeZone: 'UTC',
                              }),
                            })
                          : null,
                        row.maxRedemptions === null
                          ? null
                          : Math.max(0, row.maxRedemptions - row.redeemed) === 1
                            ? t('1 use left')
                            : t('{count} uses left', {
                                count: Math.max(0, row.maxRedemptions - row.redeemed),
                              }),
                      ]
                        .filter(Boolean)
                        .join(separator)}
                    </span>
                    <span className="ms-auto flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="text-(--text-faint)">
                        {row.redeemed === 0
                          ? t('not used yet')
                          : row.redeemed === 1
                            ? t('used once')
                            : t('used {count} times', { count: row.redeemed })}
                      </span>
                      <span className="tabular-nums">
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={row.given}
                        />
                      </span>
                      <Link
                        href={`/coupons?show=${row.id}`}
                        className="text-(--brand-text) underline underline-offset-2"
                      >
                        {t('Who used it')}
                      </Link>
                      {mayWrite ? (
                        <form action={retire}>
                          <input type="hidden" name="id" value={row.id} />
                          <input type="hidden" name="active" value={row.isActive ? 'no' : 'yes'} />
                          <Button type="submit" size="sm" variant="ghost">
                            {row.isActive ? t('Retire') : t('Restore')}
                          </Button>
                        </form>
                      ) : null}
                    </span>
                  </div>

                  {show === row.id ? (
                    history.length === 0 ? (
                      <p className="text-[12px] text-(--text-faint)">
                        {t('Nobody has used this code yet.')}
                      </p>
                    ) : (
                      <ul className="grid gap-1 border-s-2 border-(--border) ps-3">
                        {history.map((use) => (
                          <li
                            key={use.id}
                            className="flex flex-wrap items-baseline gap-2 text-[12px]"
                          >
                            <span className="text-(--text-faint)">
                              {use.redeemedAt.toLocaleDateString(region.locale)}
                            </span>
                            <bdi>{use.customer?.displayName ?? t('Counter sale')}</bdi>
                            {use.invoice ? (
                              <Link
                                href={`/invoices/${use.invoice.id}`}
                                className="datum text-(--brand-text) hover:underline"
                              >
                                {use.invoice.number}
                              </Link>
                            ) : null}
                            <span className="ms-auto tabular-nums">
                              <Money
                                currency={region.currency}
                                locale={region.locale}
                                amount={Number(use.amount)}
                              />{' '}
                              {t('of')}{' '}
                              <Money
                                currency={region.currency}
                                locale={region.locale}
                                amount={Number(use.billed)}
                              />
                            </span>
                          </li>
                        ))}
                      </ul>
                    )
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="grid content-start gap-5">
          {mayWrite ? (
            <Card>
              <CardHeader
                title={t('A new code')}
                description={t('Everything it promises is set here, and checked at the counter')}
              />
              <form action={save}>
                <CardBody className="grid gap-3">
                  <Field
                    label={t('Code')}
                    hint={t('Letters and digits. Spaces and dashes are ignored.')}
                  >
                    {/* i18n-ignore */}
                    <Input name="code" required placeholder="SPRING20" className="uppercase" />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('Worth')}>
                      <Select name="kind" defaultValue="PERCENT">
                        <option value="PERCENT">{t('A percentage off')}</option>
                        <option value="AMOUNT">{t('An amount off')}</option>
                      </Select>
                    </Field>
                    <Field label={t('Per cent')} hint={t('For a percentage code.')}>
                      <Input name="percent" inputMode="decimal" placeholder="20" />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('Amount off')} hint={t('For an amount code.')}>
                      <Input name="amount" inputMode="decimal" placeholder="25.00" />
                    </Field>
                    <Field label={t('Least bill')} hint={t('Blank for any bill.')}>
                      <Input name="minSpend" inputMode="decimal" placeholder="150.00" />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('From')}>
                      <Input type="date" name="startsOn" defaultValue={today} />
                    </Field>
                    <Field label={t('Until')} hint={t('The last day it works.')}>
                      <Input type="date" name="endsOn" />
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t('Uses in total')} hint={t('Blank for no limit.')}>
                      <Input name="maxRedemptions" inputMode="numeric" placeholder="100" />
                    </Field>
                    <Field label={t('Uses per customer')}>
                      <Input name="perCustomer" inputMode="numeric" defaultValue={1} />
                    </Field>
                  </div>
                  <Field label={t('What it is for')} hint={t('Only the workshop sees this.')}>
                    <Input name="note" placeholder={t('Spring postcard')} />
                  </Field>
                  <Button type="submit" variant="primary">
                    {t('Add the code')}
                  </Button>
                </CardBody>
              </form>
            </Card>
          ) : null}

          <Card>
            <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
              <p className="font-medium text-(--text)">{t('How a code is taken')}</p>
              <p>
                {t(
                  'At the counter it comes off before the sale is taken. On an invoice it is settled like loyalty points: the invoice keeps the total it was issued at, and what the code took off is posted to what the offers cost rather than to the bank.',
                )}
              </p>
              <p>
                {t(
                  'A code is refused with the reason: out of date, not started, all used, already used by this customer, or the bill being too small. Whoever is standing at the counter can then decide what to do about it.',
                )}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
