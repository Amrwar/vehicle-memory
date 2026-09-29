import { CERTIFICATE_WARNING_DAYS } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { can, requireSession } from '@/lib/guard';
import { EquipmentError, saveMachine, theMachines } from '@/lib/equipment';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Equipment') };
}
export const dynamic = 'force-dynamic';

/**
 * The machines, worst first.
 *
 * What an owner needs from this screen is not an inventory, it is a list of
 * what to do something about. So it is ordered by what has already stopped
 * work — a lapsed certificate, then a machine somebody took out of service —
 * then by what will stop work soon, then by what is merely late for a service.
 * Anything retired sits at the bottom, because it is gone.
 *
 * The distinction the whole phase turns on is visible here: an expired
 * certificate is a state, shown as one, and it stops jobs. A machine a month
 * late for its own service carries a note and stops nothing.
 *
 * Phase 89.
 */

async function add(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  const date = (name: string) => {
    const raw = String(formData.get(name) ?? '').trim();
    return raw === '' ? null : new Date(raw);
  };
  const months = String(formData.get('serviceEveryMonths') ?? '').trim();

  try {
    await saveMachine({
      orgId,
      userId: user.userId,
      name: String(formData.get('name') ?? ''),
      code: String(formData.get('code') ?? ''),
      serialNumber: String(formData.get('serialNumber') ?? ''),
      certificateRef: String(formData.get('certificateRef') ?? ''),
      certifiedAt: date('certifiedAt'),
      certificateExpiresAt: date('certificateExpiresAt'),
      serviceEveryMonths: months === '' ? null : Number(months),
    });
  } catch (error) {
    const message =
      error instanceof EquipmentError ? error.message : 'That machine could not be saved.';
    redirect(`/equipment?warning=${encodeURIComponent(message)}`);
  }

  redirect('/equipment?saved=1');
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ warning?: string; saved?: string }>;
}) {
  const { orgId, user, region } = await requireSession('settings:read');
  const t = await tFor();

  const { warning, saved } = await searchParams;
  const machines = await theMachines(orgId);
  const mayWrite = can(user.role, 'settings:write');

  const stopping = machines.filter(
    (machine) => machine.state === 'OUT_OF_CALIBRATION' || machine.state === 'OUT_OF_SERVICE',
  );

  const tone = (state: string) => {
    if (state === 'OUT_OF_CALIBRATION' || state === 'OUT_OF_SERVICE') return 'danger' as const;
    if (state === 'RETIRED') return 'neutral' as const;
    if (state === 'IN_USE') return 'warning' as const;
    return 'success' as const;
  };

  const day = (date: Date | null) => (date ? date.toLocaleDateString(region.locale) : '—');

  return (
    <>
      <PageHeader
        eyebrow={t('Workshop')}
        title={t('Equipment')}
        description={t(
          'Lifts, scan tools, torque wrenches and rigs. A machine whose certificate has expired stops the jobs that need it; one late for its own service does not.',
        )}
      />

      {warning ? (
        <Alert tone="warning" className="mt-4">
          {warning}
        </Alert>
      ) : null}
      {saved ? (
        <Alert tone="success" className="mt-4">
          {t('Saved.')}
        </Alert>
      ) : null}

      {stopping.length > 0 ? (
        <Alert tone="danger" className="mt-4">
          <p className="font-medium">
            {t('{count} machines cannot be used', { count: stopping.length })}
          </p>
          <ul className="mt-1 grid gap-0.5">
            {stopping.map((machine) => (
              <li key={machine.id}>
                {machine.name} — {t(machine.stateSentence)}
                {machine.neededBy.length > 0
                  ? ` · ${t('needed by {what}', { what: machine.neededBy.join(', ') })}`
                  : ''}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title={t('Every machine')}
          description={t('{count} recorded, the ones needing attention first', {
            count: machines.length,
          })}
        />
        <CardBody className="p-0">
          {machines.length === 0 ? (
            <p className="p-4 text-[13px] text-(--text-faint)">
              {t('No machines recorded yet. Add the ones a job cannot be done without.')}
            </p>
          ) : (
            <TableWrap>
              <Table>
                <thead>
                  <Tr>
                    <Th>{t('Machine')}</Th>
                    <Th>{t('State')}</Th>
                    <Th>{t('Certificate')}</Th>
                    <Th>{t('Serviced')}</Th>
                    <Th>{t('Needed by')}</Th>
                  </Tr>
                </thead>
                <tbody>
                  {machines.map((machine) => (
                    <Tr key={machine.id}>
                      <Td>
                        <Link
                          href={`/equipment/${machine.id}`}
                          className="font-medium text-(--brand-text) hover:underline"
                        >
                          {machine.name}
                        </Link>
                        <span className="datum ms-2 text-[11px] text-(--text-faint)">
                          {machine.code}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={tone(machine.state)}>{t(machine.stateSentence)}</Badge>
                      </Td>
                      <Td>
                        {machine.certificateExpiresAt === null ? (
                          <span className="text-(--text-faint)">{t('None held')}</span>
                        ) : machine.dueSoon ? (
                          <span className="text-(--warning-text)">
                            {t('Expires in {count}d', { count: machine.daysLeft ?? 0 })}
                          </span>
                        ) : (
                          day(machine.certificateExpiresAt)
                        )}
                      </Td>
                      <Td>
                        {machine.serviceOverdue ? (
                          <span className="text-(--warning-text)">{t('Overdue')}</span>
                        ) : (
                          day(machine.servicedAt)
                        )}
                      </Td>
                      <Td className="text-(--text-faint)">
                        {machine.neededBy.length > 0 ? machine.neededBy.join(', ') : '—'}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      {mayWrite ? (
        <Card className="mt-5">
          <CardHeader
            title={t('Add a machine')}
            description={t(
              'A certificate warns {count} days before it lapses, which is long enough to book the engineer.',
              { count: CERTIFICATE_WARNING_DAYS },
            )}
          />
          <CardBody>
            <form action={add} className="grid gap-2 md:grid-cols-3">
              <Input name="name" required placeholder={t('Machine')} aria-label={t('Machine')} />
              <Input name="code" required placeholder={t('Code')} aria-label={t('Code')} />
              <Input
                name="serialNumber"
                placeholder={t('Serial number')}
                aria-label={t('Serial number')}
              />
              <Input
                name="certificateRef"
                placeholder={t('Certificate reference')}
                aria-label={t('Certificate reference')}
              />
              <Input
                name="certifiedAt"
                type="date"
                placeholder={t('Certified on')}
                aria-label={t('Certified on')}
              />
              <Input
                name="certificateExpiresAt"
                type="date"
                placeholder={t('Certificate expires')}
                aria-label={t('Certificate expires')}
              />
              <Input
                name="serviceEveryMonths"
                type="number"
                min="1"
                max="120"
                placeholder={t('Service every (months)')}
                aria-label={t('Service every (months)')}
              />
              <div className="md:col-span-3">
                <Button type="submit">{t('Add the machine')}</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
