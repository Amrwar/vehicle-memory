import { toNumber, unaccountedFor, worstFirst } from '@carnet/core';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Money,
  PageHeader,
  StatRow,
  StatTile,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';

import { PlanWall } from '@/components/plan-wall';
import { auditBooks } from '@/lib/books';
import { planIncludes, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Do the books agree?') };
}
export const dynamic = 'force-dynamic';

/**
 * Whether the workshop's own figures still agree with each other. FR-8201, FR-8207, FR-8208.
 *
 * Every other finance page shows what the books say. This one asks whether
 * what they say is true: each figure is recomputed from the rows underneath it
 * and held against what is written down, so a total that has drifted from its
 * lines is named, with the difference, before an accountant finds it.
 *
 * It is deliberately the one page in the product that can say something is
 * wrong without offering a button to fix it. A difference here is not a
 * setting to change; it is something that happened, and the person who owns
 * the workshop should see it in the same words the script sees it in.
 */
export default async function BooksPage() {
  const { orgId, plan, region } = await requireSession('report:financial');
  const t = await tFor();

  if (!planIncludes(plan, 'ledger')) {
    return <PlanWall feature="ledger" plan={plan} />;
  }

  const audit = await auditBooks(orgId);
  const breaches = worstFirst(audit.breaches);
  const missing = unaccountedFor(audit, region.currency);
  const wrong = audit.breaches.length + audit.violations.length;

  const amount = (value: { minor: number; currency: string }) => (
    <Money currency={region.currency} locale={region.locale} amount={toNumber(value)} />
  );

  return (
    <>
      <PageHeader
        eyebrow={t('Finance')}
        title={t('Do the books agree?')}
        description={t('Every figure recomputed from the rows underneath it')}
      />

      <StatRow className="mb-5">
        <StatTile
          label={t('Checked')}
          value={audit.checked}
          note={t('Figures held against what they are made of')}
        />
        <StatTile
          label={t('Disagreements')}
          value={wrong}
          tone={wrong === 0 ? 'success' : 'danger'}
          note={wrong === 0 ? t('Everything agrees') : t('Each one is named below')}
        />
        <StatTile
          label={t('Unaccounted for')}
          value={amount(missing)}
          tone={missing.minor === 0 ? 'success' : 'danger'}
          note={t('The money nobody can explain')}
        />
      </StatRow>

      {wrong === 0 ? (
        <Card>
          <EmptyState
            title={t('Everything agrees')}
            description={t(
              'Every invoice adds up to its lines, every entry balances on its own, every shelf matches its movements, and the ledger agrees with the bills and the money held. Nothing here is taken on trust: all of it was recomputed just now.',
            )}
          />
        </Card>
      ) : null}

      {breaches.length > 0 ? (
        <Card className="mb-5 overflow-hidden border-(--danger)">
          <CardHeader
            title={t('Figures that do not add up')}
            description={t('Largest difference first, because that is where to start')}
          />
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('What')}</Th>
                  <Th>{t('Rule')}</Th>
                  <Th numeric>{t('It says')}</Th>
                  <Th numeric>{t('It comes to')}</Th>
                  <Th numeric>{t('Difference')}</Th>
                </tr>
              </thead>
              <tbody>
                {breaches.map((breach) => (
                  <Tr key={`${breach.rule}-${breach.document}`}>
                    <Td className="font-medium">
                      {t(breach.kind)}
                      {breach.name ? <span className="tabular"> {breach.name}</span> : null}
                    </Td>
                    <Td>
                      <span className="text-[12px] text-(--text-soft)">{t(breach.rule)}</span>
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {amount(breach.says)}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {amount(breach.adds)}
                    </Td>
                    <Td numeric className="font-medium text-(--danger)">
                      {amount(breach.difference)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>
      ) : null}

      {audit.violations.length > 0 ? (
        <Card className="overflow-hidden border-(--danger)">
          <CardHeader
            title={t('Rules that were broken')}
            description={t(
              'Not a difference in money, but something that should not have happened',
            )}
          />
          <CardBody className="flex flex-col gap-3">
            {audit.violations.map((violation) => (
              <div
                key={`${violation.rule}-${violation.document}-${violation.sentence}`}
                className="flex flex-col gap-1 border-b border-(--line) pb-3 last:border-0 last:pb-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="danger">{t(violation.rule)}</Badge>
                  <span className="text-[13px] font-medium">
                    {t(violation.kind)}
                    {violation.name ? <span className="tabular"> {violation.name}</span> : null}
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed text-(--text-soft)">
                  {t(violation.template, violation.values)}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
