import { humaniseRole, type Role } from '@carnet/core';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  KeyValue,
  Money,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

/**
 * Settings, read-only for now.
 *
 * Showing the configuration is worth doing before editing it: most support
 * questions are "what is our approval threshold" or "who has access", and
 * those are answerable without a single form.
 */
export default async function SettingsPage() {
  const { db, user, orgId } = await requireSession('settings:read');

  const org = await db.organization.findFirstOrThrow({
    where: { id: orgId },
    include: {
      locations: { include: { bays: { orderBy: { sortOrder: 'asc' } } } },
      taxRates: { orderBy: { rate: 'desc' } },
      jobTypes: { orderBy: { name: 'asc' } },
      memberships: {
        where: { isActive: true },
        include: { user: { select: { name: true, email: true, lastLoginAt: true } } },
      },
      inspectionTemplates: {
        include: { sections: { include: { items: true } } },
      },
      sequences: true,
    },
  });

  const location = org.locations[0];

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description={org.name}
        actions={
          <Badge tone="brand" dot>
            {org.plan.toLowerCase()} plan
          </Badge>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Organisation" />
          <CardBody>
            <KeyValue
              columns={2}
              items={[
                { label: 'Trading name', value: org.name },
                { label: 'Legal name', value: org.legalName },
                { label: 'Tax number', value: org.taxNumber },
                { label: 'Email', value: org.email },
                { label: 'Telephone', value: org.phone },
                { label: 'Base currency', value: org.baseCurrency },
                { label: 'Timezone', value: org.timezone },
                {
                  label: 'Re-approval threshold',
                  value: `${Number(org.reapprovalThresholdPct)}%`,
                },
              ]}
            />
            <p className="mt-4 border-t border-(--border) pt-3 text-[12px] leading-relaxed text-(--text-faint)">
              Work exceeding an approved estimate by more than the threshold sends the job back for
              a fresh decision. That is the rule that prevents an argument at the collection desk.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Location and bays" description={location?.name ?? 'No location'} />
          <CardBody>
            {location ? (
              <>
                <KeyValue
                  columns={2}
                  items={[
                    {
                      label: 'Address',
                      value: [
                        location.addressLine1,
                        location.locality,
                        location.region,
                        location.postcode,
                      ]
                        .filter(Boolean)
                        .join(', '),
                    },
                    {
                      label: 'Daily capacity',
                      value: `${Number(location.dailyCapacityHours)} technician hours`,
                    },
                  ]}
                />
                <ul className="mt-4 grid gap-1.5 border-t border-(--border) pt-3">
                  {location.bays.map((bay) => (
                    <li key={bay.id} className="flex items-center justify-between text-[13px]">
                      <span className="font-medium">{bay.name}</span>
                      <span className="text-(--text-faint)">{bay.capability ?? '—'}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2 overflow-hidden">
          <CardHeader
            title="People"
            description={`${org.memberships.length} active ${org.memberships.length === 1 ? 'person' : 'people'}`}
          />
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Lands on</Th>
                  <Th numeric>Cost rate</Th>
                  <Th>Last signed in</Th>
                </tr>
              </thead>
              <tbody>
                {org.memberships.map((membership) => (
                  <Tr key={membership.id}>
                    <Td className="font-medium">
                      {membership.user.name}
                      {membership.userId === user.userId ? (
                        <span className="ml-2 text-[11px] text-(--text-faint)">you</span>
                      ) : null}
                    </Td>
                    <Td className="datum text-(--text-soft)">{membership.user.email}</Td>
                    <Td>
                      <Badge tone="neutral" size="sm">
                        {humaniseRole(membership.role as Role)}
                      </Badge>
                    </Td>
                    <Td className="text-(--text-faint)">
                      {membership.role === 'TECHNICIAN'
                        ? 'Shop floor'
                        : membership.role === 'CUSTOMER'
                          ? 'Portal'
                          : 'Workshop'}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {membership.costRate ? <Money amount={Number(membership.costRate)} /> : '—'}
                    </Td>
                    <Td className="datum text-(--text-faint)">
                      {membership.user.lastLoginAt?.toLocaleDateString('en-GB') ?? 'Never'}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader title="Tax rates" />
          <ul className="divide-y divide-(--border)">
            {org.taxRates.map((rate) => (
              <li key={rate.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[13px] font-medium">{rate.name}</span>
                <span className="flex items-center gap-2">
                  {rate.isDefault ? (
                    <Badge tone="brand" size="sm">
                      default
                    </Badge>
                  ) : null}
                  <span className="tabular text-[13px]">{Number(rate.rate)}%</span>
                </span>
              </li>
            ))}
          </ul>
          <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
            Tax is calculated per line and then summed, never by applying one rate to the subtotal.
            A document mixing rates gives a different answer each way, and only the per-line answer
            is correct.
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Job types" />
          <ul className="divide-y divide-(--border)">
            {org.jobTypes.map((type) => (
              <li key={type.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="flex items-center gap-2 text-[13px] font-medium">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: type.colour }}
                  />
                  {type.name}
                </span>
                <span className="flex items-center gap-2 text-[12px] text-(--text-faint)">
                  {type.requiresQualityCheck ? (
                    <Badge tone="warning" size="sm">
                      QC required
                    </Badge>
                  ) : null}
                  {type.defaultHours ? `${Number(type.defaultHours)}h` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Inspection templates" />
          <CardBody className="grid gap-4">
            {org.inspectionTemplates.map((template) => {
              const itemCount = template.sections.reduce(
                (sum, section) => sum + section.items.length,
                0,
              );
              return (
                <div key={template.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-medium">{template.name}</span>
                    {template.isDefault ? (
                      <Badge tone="brand" size="sm">
                        default
                      </Badge>
                    ) : null}
                    <span className="text-[12px] text-(--text-faint)">
                      {template.sections.length} sections, {itemCount} items
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {template.sections.map((section) => (
                      <span
                        key={section.id}
                        className="rounded-(--radius-xs) bg-(--surface-sunk) px-2 py-0.5 text-[12px] text-(--text-soft)"
                      >
                        {section.name}
                        <span className="ml-1.5 text-(--text-faint)">{section.items.length}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Document numbering"
            description="Sequential and gapless per organisation"
          />
          <CardBody className="flex flex-wrap gap-6">
            {org.sequences.map((sequence) => (
              <div key={sequence.id}>
                <p className="eyebrow mb-0.5">{sequence.kind.toLowerCase().replace('_', ' ')}</p>
                <p className="datum text-[14px]">
                  {sequence.prefix}
                  {sequence.next}
                </p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <p className="mt-6 text-[12px] text-(--text-faint)">
        Editing these is not built yet.{' '}
        <Link href="/audit" className="underline">
          The audit log
        </Link>{' '}
        records every change once it is.
      </p>
    </>
  );
}
