import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { prisma } from '@carnet/db';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { READABLE } from '@/lib/provenance';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Audit log') };
}
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 60;

/** Actions that change money or history are worth marking out from the rest. */
const NOTABLE = /payment|invoice|passport|transfer|share|goods|approve|delete|void/i;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string }>;
}) {
  const { orgId, region } = await requireSession('audit:read');
  const params = await searchParams;
  const t = await tFor();
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const where = {
    orgId,
    ...(params.entity ? { entityType: params.entity } : {}),
  };

  const [entries, total, entityTypes] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['entityType'],
      where: { orgId },
      _count: { _all: true },
      orderBy: { _count: { entityType: 'desc' } },
      take: 12,
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        eyebrow={t('Admin')}
        title={t('Audit log')}
        description={
          total === 1
            ? t('1 recorded action')
            : t('{count} recorded actions', { count: total.toLocaleString(region.locale) })
        }
      />

      <Card className="mb-5 border-(--brand)">
        <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
          {t(
            'Every state-changing action is recorded here with who did it, when, and what changed. The table is immutable at the database level: a trigger refuses any update or delete, so these entries cannot be edited even from a direct database session. A log the operator can quietly amend would settle no dispute.',
          )}
        </CardBody>
      </Card>

      {entityTypes.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="eyebrow">{t('Filter')}</span>
          <Link href="/audit">
            <Button size="sm" variant={params.entity ? 'secondary' : 'primary'}>
              {t('Everything')}
            </Button>
          </Link>
          {entityTypes.map((row) => (
            <Link key={row.entityType} href={`/audit?entity=${encodeURIComponent(row.entityType)}`}>
              <Button
                size="sm"
                variant={params.entity === row.entityType ? 'primary' : 'secondary'}
              >
                {t(READABLE[row.entityType]?.label ?? row.entityType)}
                <span className="ms-1.5 opacity-60">{row._count._all}</span>
              </Button>
            </Link>
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            title={t('Nothing recorded yet')}
            description={t('Actions appear here as people use the system.')}
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('When')}</Th>
                  <Th>{t('Who')}</Th>
                  <Th>{t('Action')}</Th>
                  <Th>{t('Subject')}</Th>
                  <Th>{t('Source')}</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Tr key={entry.id}>
                    <Td className="datum text-(--text-faint)">
                      {entry.createdAt.toLocaleString(region.locale, {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </Td>
                    <Td>
                      {entry.actor ? (
                        <span className="font-medium">{entry.actor.name}</span>
                      ) : (
                        <span className="text-(--text-faint)">{t('System')}</span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={NOTABLE.test(entry.action) ? 'accent' : 'neutral'} size="sm">
                        {entry.action}
                      </Badge>
                    </Td>
                    <Td className="text-(--text-soft)">
                      {READABLE[entry.entityType] ? (
                        <Link
                          href={`/audit/${entry.entityType}/${entry.entityId}`}
                          className="hover:text-(--brand-text) hover:underline"
                        >
                          {t(READABLE[entry.entityType]!.label)}
                        </Link>
                      ) : (
                        entry.entityType
                      )}
                      <span className="datum ms-2 text-[11px] text-(--text-faint)">
                        {entry.entityId.slice(-8)}
                      </span>
                    </Td>
                    <Td className="datum text-(--text-faint)">{entry.ip ?? '—'}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        )}
      </Card>

      {pages > 1 ? (
        <nav className="mt-4 flex items-center justify-between" aria-label={t('Pagination')}>
          <p className="text-[12px] text-(--text-faint)">
            {t('Page {page} of {pages}', { page, pages })}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/audit?page=${page - 1}${params.entity ? `&entity=${params.entity}` : ''}`}
              >
                <Button size="sm">{t('Previous')}</Button>
              </Link>
            ) : null}
            {page < pages ? (
              <Link
                href={`/audit?page=${page + 1}${params.entity ? `&entity=${params.entity}` : ''}`}
              >
                <Button size="sm">{t('Next')}</Button>
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
