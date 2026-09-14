import { toNumber } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
  StatRow,
  StatTile,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PlanWall } from '@/components/plan-wall';
import {
  acceptMatch,
  bankAccountsFor,
  closePeriod,
  periodReadiness,
  periodsFor,
  reconciliation,
} from '@/lib/banking';
import { planIncludes, requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Banking' };
export const dynamic = 'force-dynamic';

/**
 * The bank, and closing a period. FR-2103, FR-2104, FR-2105.
 *
 * The ledger balances against itself, which proves the arithmetic was
 * consistent, not that it was right. Reconciliation is what makes it balance
 * against reality, and it is the reason a period can be closed with any
 * confidence at all.
 *
 * Every suggested match carries the reasoning behind it. A rule that pairs
 * things too eagerly does more damage than one that matches nothing, because
 * a wrong match is invisible: both sides tick and the balance agrees.
 */

async function accept(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('ledger:write');

  await acceptMatch({
    orgId,
    statementLineId: String(formData.get('lineId') ?? ''),
    entryId: String(formData.get('entryId') ?? ''),
    reason: String(formData.get('reason') ?? ''),
    userId: user.userId,
  });

  redirect(`/banking?account=${String(formData.get('accountId') ?? '')}&matched=1`);
}

async function close(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('ledger:write');

  const result = await closePeriod({
    orgId,
    periodId: String(formData.get('periodId') ?? ''),
    userId: user.userId,
  });

  redirect(
    result.ok ? '/banking?closed=1' : `/banking?error=${encodeURIComponent(result.error ?? '')}`,
  );
}

export default async function BankingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId, plan, region } = await requireSession('ledger:read');

  if (!planIncludes(plan, 'ledger')) {
    return <PlanWall feature="ledger" plan={plan} />;
  }

  const params = await searchParams;
  const [accounts, periods] = await Promise.all([bankAccountsFor(orgId), periodsFor(orgId)]);

  const accountId = params.account ?? accounts[0]?.id ?? null;
  const view = accountId ? await reconciliation(orgId, accountId) : null;

  const openPeriod = periods.find((period) => !period.isClosed);
  const readiness = openPeriod ? await periodReadiness(orgId, openPeriod.id) : null;

  const blocking = readiness?.checks.filter((check) => check.blocking && !check.passed) ?? [];
  const warnings = readiness?.checks.filter((check) => !check.blocking && !check.passed) ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Banking and close"
        description="What the bank says, against what the ledger says"
        actions={
          <Link href="/financials">
            <Button size="sm" variant="ghost">
              Statements
            </Button>
          </Link>
        }
      />

      {params.error ? (
        <Alert tone="danger" className="mb-5">
          {params.error}
        </Alert>
      ) : null}

      <StatRow className="mb-5">
        <StatTile
          label="On the statement"
          value={
            view ? (
              <Money
                currency={region.currency}
                locale={region.locale}
                amount={toNumber(view.state.statementBalance)}
              />
            ) : (
              '—'
            )
          }
          note={view?.statement ? 'Closing balance' : 'No statement imported'}
        />
        <StatTile
          label="In the ledger"
          value={
            view ? (
              <Money
                currency={region.currency}
                locale={region.locale}
                amount={toNumber(view.state.ledgerBalance)}
              />
            ) : (
              '—'
            )
          }
          note="From postings to this account"
        />
        <StatTile
          label="Difference"
          value={
            view ? (
              <Money
                currency={region.currency}
                locale={region.locale}
                amount={toNumber(view.state.difference)}
              />
            ) : (
              '—'
            )
          }
          tone={view?.state.reconciled ? 'success' : 'warning'}
          note={view?.state.reconciled ? 'Agreed' : 'Explained below'}
        />
        <StatTile
          label="Unmatched"
          value={view?.state.unmatchedOnStatement.length ?? 0}
          note="Statement lines with nothing against them"
        />
      </StatRow>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader
              title="Where this stands"
              description={view?.account.name ?? 'No bank account set up'}
            />
            <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
              {view ? view.state.explanation : 'Add a bank account to reconcile against.'}
            </CardBody>
          </Card>

          {view && view.matches.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader
                title="Suggested matches"
                description="Each one says why it was suggested"
              />
              <ul className="divide-y divide-(--border)">
                {view.matches.map((match) => {
                  const line = view.state.unmatchedOnStatement.find(
                    (candidate) => candidate.id === match.statementLineId,
                  );
                  const entry = view.candidates.find(
                    (candidate) => candidate.id === match.candidateId,
                  );

                  if (!line || !entry) return null;

                  return (
                    <li key={match.statementLineId} className="px-4 py-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium">{line.description}</p>
                          <p className="mt-0.5 text-[12px] text-(--text-soft)">
                            against {entry.description}
                          </p>
                          <p className="mt-1 text-[12px] leading-relaxed text-(--text-faint)">
                            {match.reason}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Badge
                            tone={
                              match.confidence === 'EXACT'
                                ? 'success'
                                : match.confidence === 'LIKELY'
                                  ? 'info'
                                  : 'warning'
                            }
                            size="sm"
                          >
                            {match.confidence.toLowerCase()}
                          </Badge>
                          <Money
                            currency={region.currency}
                            locale={region.locale}
                            amount={toNumber(line.amount)}
                            className="font-medium"
                          />
                          <form action={accept}>
                            <input type="hidden" name="lineId" value={line.id} />
                            <input type="hidden" name="entryId" value={entry.id} />
                            <input type="hidden" name="reason" value={match.reason} />
                            <input type="hidden" name="accountId" value={view.account.id} />
                            <Button
                              type="submit"
                              size="sm"
                              variant={match.confidence === 'EXACT' ? 'primary' : 'secondary'}
                            >
                              Match
                            </Button>
                          </form>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
                Only the exact ones are safe to accept without reading. A likely match is usually
                right, and usually is not a standard to reconcile a bank account to.
              </CardBody>
            </Card>
          ) : null}

          {view && view.state.unmatchedOnStatement.length > 0 ? (
            <Card className="overflow-hidden">
              <CardHeader
                title="Nothing recorded against these"
                description="Usually a bank charge, a direct debit, or a payment nobody entered"
              />
              <ul className="divide-y divide-(--border)">
                {view.state.unmatchedOnStatement.map((line) => (
                  <li
                    key={line.id}
                    className="flex items-baseline justify-between gap-3 px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px]">{line.description}</p>
                      <p className="text-[11px] text-(--text-faint)">
                        {line.at.toLocaleDateString(region.locale, {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                    </div>
                    <Money
                      currency={region.currency}
                      locale={region.locale}
                      amount={toNumber(line.amount)}
                      signed
                      className="shrink-0"
                    />
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {!view ? (
            <Card>
              <EmptyState
                title="No bank account yet"
                description="A bank account maps to a ledger account, so a statement has something to be compared against."
              />
            </Card>
          ) : null}
        </div>

        <aside className="grid content-start gap-5">
          {accounts.length > 1 ? (
            <Card>
              <CardHeader title="Accounts" />
              <ul className="divide-y divide-(--border)">
                {accounts.map((account) => (
                  <li key={account.id}>
                    <Link
                      href={`/banking?account=${account.id}`}
                      className={`block px-4 py-2.5 text-[13px] transition-colors ${
                        account.id === accountId
                          ? 'bg-(--brand-soft) font-medium text-(--brand-text)'
                          : 'hover:bg-(--surface-sunk)'
                      }`}
                    >
                      {account.name}
                      {account.last4 ? (
                        <span className="ml-2 text-[11px] text-(--text-faint)">
                          ····{account.last4}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {readiness ? (
            <Card className={blocking.length > 0 ? 'border-(--warning)' : 'border-(--success)'}>
              <CardHeader title="Closing the period" description={readiness.period.name} />
              <CardBody className="grid gap-2.5">
                {readiness.checks.map((check) => (
                  <div key={check.label} className="flex items-start gap-2.5">
                    <span
                      aria-hidden
                      className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                        check.passed
                          ? 'bg-(--success)'
                          : check.blocking
                            ? 'bg-(--danger)'
                            : 'bg-(--warning)'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium">{check.label}</p>
                      <p className="text-[11px] leading-relaxed text-(--text-faint)">
                        {check.detail}
                      </p>
                    </div>
                  </div>
                ))}

                <form action={close} className="mt-2">
                  <input type="hidden" name="periodId" value={readiness.period.id} />
                  <Button
                    type="submit"
                    variant={blocking.length > 0 ? 'secondary' : 'primary'}
                    block
                    disabled={blocking.length > 0}
                  >
                    {blocking.length > 0 ? 'Not ready to close' : `Close ${readiness.period.name}`}
                  </Button>
                </form>

                <p className="text-[11px] leading-relaxed text-(--text-faint)">
                  {warnings.length > 0
                    ? 'The amber items are advice. A workshop that always has one stray bank charge should still be able to close its quarter.'
                    : 'Closing stops the figures moving. Anything posted afterwards has to go into the next period.'}
                </p>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader title="Why this matters" />
            <CardBody className="text-[12px] leading-relaxed text-(--text-soft)">
              A trial balance that balances proves the arithmetic was consistent. It does not prove
              it was right. Until the bank agrees, a set of books is a well-formed opinion.
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
