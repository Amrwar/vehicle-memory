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
import { READABLE } from '@/lib/provenance';

export const metadata: Metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

const PAGE_SIZE = 60;

/** Actions that change money or history are worth marking out from the rest. */
const NOTABLE = /payment|invoice|passport|transfer|share|goods|approve|delete|void/i;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; entity?: string }>;
}) {
  const { orgId } = await requireSession('audit:read');
  const params = await searchParams;
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
        eyebrow="Admin"
        title="Audit log"
        description={`${total.toLocaleString('en-GB')} recorded action${total === 1 ? '' : 's'}`}
      />

      <Card className="mb-5 border-(--brand)">
        <CardBody className="text-[13px] leading-relaxed text-(--text-soft)">
          Every state-changing action is recorded here with who did it, when, and what changed. The
          table is immutable at the database level: a trigger refuses any update or delete, so these
          entries cannot be edited even from a direct database session. A log the operator can
          quietly amend would settle no dispute.
        </CardBody>
      </Card>

      {entityTypes.length > 0 ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="eyebrow">Filter</span>
          <Link href="/audit">
            <Button size="sm" variant={params.entity ? 'secondary' : 'primary'}>
              Everything
            </Button>
          </Link>
          {entityTypes.map((row) => (
            <Link key={row.entityType} href={`/audit?entity=${encodeURIComponent(row.entityType)}`}>
              <Button
                size="sm"
                variant={params.entity === row.entityType ? 'primary' : 'secondary'}
              >
                {row.entityType}
                <span className="ml-1.5 opacity-60">{row._count._all}</span>
              </Button>
            </Link>
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        {entries.length === 0 ? (
          <EmptyState
            title="Nothing recorded yet"
            description="Actions appear here as people use the system."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>Action</Th>
                  <Th>Subject</Th>
                  <Th>Source</Th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <Tr key={entry.id}>
                    <Td className="datum text-(--text-faint)">
                      {entry.createdAt.toLocaleString('en-GB', {
                        dateStyle: 'short',
                        timeStyle: 'medium',
                      })}
                    </Td>
                    <Td>
                      {entry.actor ? (
                        <span className="font-medium">{entry.actor.name}</span>
                      ) : (
                        <span className="text-(--text-faint)">System</span>
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
                          {entry.entityType}
                        </Link>
                      ) : (
                        entry.entityType
                      )}
                      <span className="datum ml-2 text-[11px] text-(--text-faint)">
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
        <nav className="mt-4 flex items-center justify-between" aria-label="Pagination">
          <p className="text-[12px] text-(--text-faint)">
            Page {page} of {pages}
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/audit?page=${page - 1}${params.entity ? `&entity=${params.entity}` : ''}`}
              >
                <Button size="sm">Previous</Button>
              </Link>
            ) : null}
            {page < pages ? (
              <Link
                href={`/audit?page=${page + 1}${params.entity ? `&entity=${params.entity}` : ''}`}
              >
                <Button size="sm">Next</Button>
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
