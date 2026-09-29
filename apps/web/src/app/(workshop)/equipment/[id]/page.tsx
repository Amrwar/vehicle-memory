import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  KeyValue,
  PageHeader,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { can, requireSession } from '@/lib/guard';
import {
  EquipmentError,
  oneMachine,
  recordCertificate,
  recordServiced,
  setJobTypeNeeds,
  setOutOfService,
  setRetired,
} from '@/lib/equipment';
import { bookedOn } from '@/lib/equipment-diary';
import { tFor } from '@/lib/i18n';
import { prisma } from '@carnet/db';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Equipment') };
}
export const dynamic = 'force-dynamic';

/**
 * One machine: what is wrong with it, and the one press that puts it right.
 *
 * Recording a certificate is its own action rather than a field on an edit
 * form, because it is the press that takes a grounded machine back to work and
 * it should be possible with the certificate in your hand, not through a form
 * of a dozen boxes.
 *
 * Phase 89.
 */

function back(id: string, message?: string): never {
  redirect(
    message ? `/equipment/${id}?warning=${encodeURIComponent(message)}` : `/equipment/${id}`,
  );
}

async function certify(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const id = String(formData.get('equipmentId') ?? '');

  try {
    await recordCertificate({
      orgId,
      userId: user.userId,
      equipmentId: id,
      reference: String(formData.get('reference') ?? ''),
      certifiedAt: new Date(String(formData.get('certifiedAt') ?? '')),
      expiresAt: new Date(String(formData.get('expiresAt') ?? '')),
      by: String(formData.get('by') ?? ''),
    });
  } catch (error) {
    back(id, error instanceof EquipmentError ? error.message : undefined);
  }

  back(id);
}

async function serviced(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const id = String(formData.get('equipmentId') ?? '');

  try {
    await recordServiced({ orgId, userId: user.userId, equipmentId: id, at: new Date() });
  } catch (error) {
    back(id, error instanceof EquipmentError ? error.message : undefined);
  }

  back(id);
}

async function outOfService(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const id = String(formData.get('equipmentId') ?? '');

  try {
    await setOutOfService({
      orgId,
      userId: user.userId,
      equipmentId: id,
      out: String(formData.get('out') ?? '') === 'yes',
      reason: String(formData.get('reason') ?? ''),
    });
  } catch (error) {
    back(id, error instanceof EquipmentError ? error.message : undefined);
  }

  back(id);
}

async function retire(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const id = String(formData.get('equipmentId') ?? '');

  try {
    await setRetired({
      orgId,
      userId: user.userId,
      equipmentId: id,
      retired: String(formData.get('retired') ?? '') === 'yes',
    });
  } catch (error) {
    back(id, error instanceof EquipmentError ? error.message : undefined);
  }

  back(id);
}

async function needs(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const id = String(formData.get('equipmentId') ?? '');

  try {
    await setJobTypeNeeds({
      orgId,
      userId: user.userId,
      equipmentId: id,
      jobTypeId: String(formData.get('jobTypeId') ?? ''),
      needs: String(formData.get('needs') ?? '') === 'yes',
    });
  } catch (error) {
    back(id, error instanceof EquipmentError ? error.message : undefined);
  }

  back(id);
}

export default async function MachinePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ warning?: string }>;
}) {
  const { id } = await params;
  const { orgId, user, region } = await requireSession('settings:read');
  const t = await tFor();
  const { warning } = await searchParams;

  const machine = await oneMachine(orgId, id).catch(() => null);
  if (!machine) notFound();

  const mayWrite = can(user.role, 'settings:write');

  // What this machine has been promised to, so taking it out of service is a
  // decision made with the diary in front of you rather than a surprise on
  // the morning. Phase 91.
  const promised = await bookedOn(orgId, id);

  const jobTypes = await prisma.jobType.findMany({
    where: { orgId, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  const needed = new Set(machine.neededBy.map((one) => one.id));
  const day = (date: Date | null) => (date ? date.toLocaleDateString(region.locale) : '—');

  const tone =
    machine.state === 'OUT_OF_CALIBRATION' || machine.state === 'OUT_OF_SERVICE'
      ? ('danger' as const)
      : machine.state === 'RETIRED'
        ? ('neutral' as const)
        : machine.state === 'IN_USE'
          ? ('warning' as const)
          : ('success' as const);

  return (
    <>
      <div className="mb-3">
        <BackLink href="/equipment">{t('Equipment')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Equipment')}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {machine.name}
            <Badge tone={tone} dot>
              {t(machine.stateSentence)}
            </Badge>
          </span>
        }
        description={machine.code}
      />

      {warning ? (
        <Alert tone="warning" className="mt-4">
          {warning}
        </Alert>
      ) : null}

      {machine.outOfServiceReason ? (
        <Alert tone="danger" className="mt-4">
          {t('Out of service since {when}: {why}', {
            when: day(machine.outOfServiceSince),
            why: machine.outOfServiceReason,
          })}
        </Alert>
      ) : null}

      {machine.state === 'OUT_OF_CALIBRATION' ? (
        <Alert tone="danger" className="mt-4">
          {t(
            'Its certificate expired on {when}. Jobs that need this machine cannot start until a new one is recorded.',
            { when: day(machine.certificateExpiresAt) },
          )}
        </Alert>
      ) : null}

      {machine.dueSoon ? (
        <Alert tone="warning" className="mt-4">
          {t('Its certificate expires in {count} days. Book the engineer now.', {
            count: machine.daysLeft ?? 0,
          })}
        </Alert>
      ) : null}

      {machine.serviceOverdue ? (
        <Alert tone="warning" className="mt-4">
          {t('It is overdue its own service. That is worth doing, and it does not stop any job.')}
        </Alert>
      ) : null}

      <Card className="mt-5">
        <CardHeader title={t('What is known about it')} />
        <CardBody>
          <KeyValue
            columns={2}
            items={[
              { label: t('Serial number'), value: machine.serialNumber ?? '—' },
              { label: t('Where it is'), value: machine.location?.name ?? '—' },
              { label: t('Certificate reference'), value: machine.certificateRef ?? '—' },
              { label: t('Certified on'), value: day(machine.certifiedAt) },
              { label: t('Certificate expires'), value: day(machine.certificateExpiresAt) },
              { label: t('Certified by'), value: machine.certifiedBy ?? '—' },
              { label: t('Last serviced'), value: day(machine.servicedAt) },
              {
                label: t('Next service due'),
                value: machine.serviceDueAt ? day(machine.serviceDueAt) : '—',
              },
              { label: t('Jobs on the bench needing it'), value: String(machine.busyOn) },
            ]}
          />
        </CardBody>
      </Card>

      {promised.length > 0 ? (
        <Card className="mt-5">
          <CardHeader
            title={t('Booked work that needs it')}
            description={t(
              'Taking it out of service, or letting its certificate lapse, breaks these promises.',
            )}
          />
          <CardBody className="grid gap-1 text-[13px]">
            {promised.map((one) => (
              <div key={one.bookingId} className="flex flex-wrap items-baseline gap-x-2">
                <span className="datum text-(--text-faint)">
                  {one.startAt.toLocaleDateString(region.locale)}
                </span>
                <bdi>{one.label}</bdi>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : null}

      {mayWrite ? (
        <>
          <Card className="mt-5">
            <CardHeader
              title={t('Record a certificate')}
              description={t('The one press that puts a grounded machine back to work.')}
            />
            <CardBody>
              <form action={certify} className="grid gap-2 md:grid-cols-4">
                <input type="hidden" name="equipmentId" value={machine.id} />
                <Input
                  name="reference"
                  required
                  placeholder={t('Certificate reference')}
                  aria-label={t('Certificate reference')}
                />
                <Input name="certifiedAt" type="date" required aria-label={t('Certified on')} />
                <Input
                  name="expiresAt"
                  type="date"
                  required
                  aria-label={t('Certificate expires')}
                />
                <Input name="by" placeholder={t('Certified by')} aria-label={t('Certified by')} />
                <div className="md:col-span-4">
                  <Button type="submit">{t('Record it#certificate')}</Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card className="mt-5">
            <CardHeader title={t('Its condition')} />
            <CardBody className="grid gap-3">
              {machine.outOfServiceSince ? (
                <form action={outOfService}>
                  <input type="hidden" name="equipmentId" value={machine.id} />
                  <input type="hidden" name="out" value="no" />
                  <Button type="submit" variant="secondary">
                    {t('Put it back in service')}
                  </Button>
                </form>
              ) : (
                <form action={outOfService} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="equipmentId" value={machine.id} />
                  <input type="hidden" name="out" value="yes" />
                  <Input
                    name="reason"
                    required
                    className="w-80"
                    placeholder={t('What is wrong with it?')}
                    aria-label={t('What is wrong with it?')}
                  />
                  <Button type="submit" variant="secondary">
                    {t('Take it out of service')}
                  </Button>
                </form>
              )}

              <form action={serviced}>
                <input type="hidden" name="equipmentId" value={machine.id} />
                <Button type="submit" variant="secondary">
                  {t('It has been serviced today')}
                </Button>
              </form>

              <form action={retire}>
                <input type="hidden" name="equipmentId" value={machine.id} />
                <input type="hidden" name="retired" value={machine.isActive ? 'yes' : 'no'} />
                <Button type="submit" variant="ghost">
                  {machine.isActive ? t('Retire it') : t('Bring it back')}
                </Button>
              </form>
            </CardBody>
          </Card>

          <Card className="mt-5">
            <CardHeader
              title={t('Work that needs it')}
              description={t(
                'A job of one of these kinds cannot start while this machine cannot be used.',
              )}
            />
            <CardBody className="grid gap-1.5 text-[13px]">
              {jobTypes.length === 0 ? (
                <p className="text-(--text-faint)">{t('No kinds of work yet.')}</p>
              ) : (
                jobTypes.map((jobType) => (
                  <form
                    key={jobType.id}
                    action={needs}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="equipmentId" value={machine.id} />
                    <input type="hidden" name="jobTypeId" value={jobType.id} />
                    <input
                      type="hidden"
                      name="needs"
                      value={needed.has(jobType.id) ? 'no' : 'yes'}
                    />
                    <span className="min-w-40">{jobType.name}</span>
                    {needed.has(jobType.id) ? <Badge tone="warning">{t('Needs it')}</Badge> : null}
                    <Button type="submit" variant="ghost" className="text-[12px]">
                      {needed.has(jobType.id) ? t('It does not need it') : t('It needs it')}
                    </Button>
                  </form>
                ))
              )}
            </CardBody>
          </Card>
        </>
      ) : null}
    </>
  );
}
