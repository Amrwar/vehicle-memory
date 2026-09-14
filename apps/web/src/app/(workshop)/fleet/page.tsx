import {
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
import Link from 'next/link';

import { fleets } from '@/lib/fleet';
import { requireSession } from '@/lib/guard';

export const metadata: Metadata = { title: 'Fleets' };
export const dynamic = 'force-dynamic';

/**
 * Companies with vehicles, rather than fifty unrelated customer records. FR-3010.
 *
 * A fleet is a company customer that happens to have several vehicles. There
 * is no separate entity, deliberately: inventing one would give a vehicle two
 * places to belong and an eventual argument about which is right.
 *
 * The threshold is two vehicles. A company with one van is a customer, and
 * listing every sole trader here would bury the two accounts that actually
 * need managing.
 */
export default async function FleetPage() {
  const { orgId, region } = await requireSession('customer:read');

  const accounts = await fleets(orgId);

  const vehicles = accounts.reduce((total, fleet) => total + fleet.vehicles, 0);
  const off = accounts.reduce((total, fleet) => total + fleet.offTheRoad, 0);
  const overdue = accounts.reduce((total, fleet) => total + fleet.overdue, 0);
  const spend = accounts.reduce((total, fleet) => total + fleet.spend, 0);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Fleets"
        description="Company accounts with more than one vehicle on the books"
      />

      <StatRow className="mb-5">
        <StatTile label="Accounts" value={accounts.length} note="Companies with a fleet" />
        <StatTile label="Vehicles" value={vehicles} note="Across all of them" />
        <StatTile
          label="Off the road"
          value={off}
          tone={off > 0 ? 'warning' : 'neutral'}
          note="In the workshop now"
        />
        <StatTile
          label="Last thirty days"
          value={<Money currency={region.currency} locale={region.locale} amount={spend} />}
          note="Invoiced to fleets"
        />
      </StatRow>

      {overdue > 0 ? (
        <Card className="mb-5 border-(--warning)">
          <CardBody className="text-[13px] leading-relaxed text-(--warning)">
            <strong className="font-semibold">{overdue} fleet vehicles are past a service.</strong>{' '}
            A fleet manager is measured on downtime, so an overdue van is their problem before it is
            yours. Telling them first is worth more than the service itself.
          </CardBody>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader
          title="The accounts"
          description="Most vehicles first. Open one to see what is wrong with which van."
        />
        {accounts.length === 0 ? (
          <EmptyState
            title="No fleets yet"
            description="A company customer with more than one vehicle appears here automatically. Nothing needs setting up."
          />
        ) : (
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th numeric>Vehicles</Th>
                  <Th numeric>Off the road</Th>
                  <Th numeric>Due soon</Th>
                  <Th numeric>Overdue</Th>
                  <Th numeric>Waiting on them</Th>
                  <Th numeric>30 days</Th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((fleet) => (
                  <Tr key={fleet.id}>
                    <Td>
                      <Link
                        href={`/fleet/${fleet.id}`}
                        className="font-medium hover:text-(--brand-text) hover:underline"
                      >
                        {fleet.name}
                      </Link>
                    </Td>
                    <Td numeric>{fleet.vehicles}</Td>
                    <Td numeric className={fleet.offTheRoad > 0 ? 'text-(--warning)' : ''}>
                      {fleet.offTheRoad}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {fleet.dueSoon}
                    </Td>
                    <Td numeric className={fleet.overdue > 0 ? 'font-medium text-(--danger)' : ''}>
                      {fleet.overdue}
                    </Td>
                    <Td numeric className={fleet.awaitingApproval > 0 ? 'text-(--warning)' : ''}>
                      {fleet.awaitingApproval}
                    </Td>
                    <Td numeric>
                      <Money
                        currency={region.currency}
                        locale={region.locale}
                        amount={fleet.spend}
                      />
                    </Td>
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
