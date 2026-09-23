import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  addToFleet,
  CourtesyError,
  fleetFor,
  lendableVehicles,
  retireFromFleet,
} from '@/lib/courtesy';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * The cars this workshop lends. Phase 67, FR-512.
 *
 * A short page on purpose. Which cars are ours to lend is a fact a workshop
 * states once and changes twice a year, so it belongs in settings beside the
 * other things of that shape — not on the diary, where it would be a decision
 * somebody has to make while a customer waits.
 *
 * Lending one and taking it back happen on the job, which is where the keys
 * actually change hands.
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Courtesy cars') };
}

async function add(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await addToFleet({
      orgId,
      userId: user.userId,
      vehicleId: String(formData.get('vehicleId') ?? ''),
      name: String(formData.get('name') ?? '') || null,
    });
  } catch (error) {
    if (!(error instanceof CourtesyError)) throw error;
    redirect(`/settings/courtesy?problem=${encodeURIComponent(error.message)}`);
  }

  redirect('/settings/courtesy?saved=1');
}

async function retire(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await retireFromFleet({
      orgId,
      userId: user.userId,
      courtesyVehicleId: String(formData.get('id') ?? ''),
    });
  } catch (error) {
    if (!(error instanceof CourtesyError)) throw error;
    redirect(`/settings/courtesy?problem=${encodeURIComponent(error.message)}`);
  }

  redirect('/settings/courtesy?saved=1');
}

export default async function CourtesySettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ problem?: string; saved?: string }>;
}) {
  const t = await tFor();
  const { orgId } = await requireSession('settings:read');
  const notice = await searchParams;

  const [fleet, addable] = await Promise.all([fleetFor(orgId, true), lendableVehicles(orgId)]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={t('Courtesy cars')}
        description={t('The cars this workshop lends while it has somebody’s own.')}
        actions={
          <Link href="/settings" className="text-[13px] underline underline-offset-2">
            {t('Settings')}
          </Link>
        }
      />

      {notice.problem ? (
        <div className="mb-4 rounded-(--radius-lg) border border-(--danger) bg-(--danger-soft) px-4 py-3">
          <p className="text-[14px] text-(--danger)">{notice.problem}</p>
        </div>
      ) : null}

      <Card className="mb-4 overflow-hidden">
        <CardHeader title={t('Courtesy cars')} />

        {fleet.length === 0 ? (
          <CardBody className="text-[13px] text-(--text-faint)">
            {t('This workshop lends no cars yet.')}
          </CardBody>
        ) : (
          <ul className="divide-y divide-(--border)">
            {fleet.map((car) => (
              <li
                key={car.id}
                className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-[13px]"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    <bdi>{car.name ?? car.description}</bdi>
                  </p>
                  <p className="text-[12px] text-(--text-faint)">
                    {car.registration ?? car.description}
                  </p>
                </div>

                {car.isActive ? (
                  <form action={retire}>
                    <input type="hidden" name="id" value={car.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      {t('Stop lending it')}
                    </Button>
                  </form>
                ) : (
                  <Badge tone="neutral" size="sm">
                    {t('No longer lent')}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title={t('Add one')}
          description={t(
            'A car already on this workshop’s records. Add it as a vehicle first if it is not there.',
          )}
        />
        <CardBody>
          {addable.length === 0 ? (
            <p className="text-[13px] text-(--text-faint)">
              {t('Every vehicle on record is already lent, or there are none.')}{' '}
              <Link href="/vehicles/new" className="underline underline-offset-2">
                {t('Add a vehicle')}
              </Link>
            </p>
          ) : (
            <form action={add} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
              <Field label={t('Which car')}>
                <Select name="vehicleId" required defaultValue="">
                  <option value="" disabled>
                    {t('Choose')}
                  </option>
                  {addable.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('What the desk calls it')} hint={t('Optional')}>
                <Input name="name" placeholder={t('The silver Fiesta')} />
              </Field>

              <Button type="submit" size="sm" variant="secondary">
                {t('Add it')}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
