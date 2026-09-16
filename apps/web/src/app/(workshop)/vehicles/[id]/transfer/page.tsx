import { msg } from '@carnet/core';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  KeyValue,
  PageHeader,
  Registration,
  Select,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { prisma } from '@carnet/db';
import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import {
  cancelHandover,
  inviteHandover,
  OwnershipError,
  pendingHandover,
  transferOwnership,
} from '@/lib/handover';
import { tFor } from '@/lib/i18n';
import { orgCanReadVehicle } from '@/lib/passport';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Transfer') };
}
export const dynamic = 'force-dynamic';

/**
 * Selling a car, as a thing the product does. FR-3201.
 *
 * The history is the asset and it has to survive the sale. The previous owner
 * must not: their name, their address and the fact that they turned down a
 * repair in March belong to them, not to the car.
 *
 * The form is short on purpose. A workshop records this while the two people
 * are standing at the counter, and anything that cannot be answered in that
 * moment would be guessed.
 */
async function transfer(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('vehicle:write');

  const vehicleId = String(formData.get('vehicleId') ?? '');
  const toName = String(formData.get('toName') ?? '');
  const toKind = String(formData.get('toKind') ?? 'PRIVATE') as 'PRIVATE';
  const on = String(formData.get('on') ?? '');
  const reading = String(formData.get('odometerKm') ?? '').trim();
  const force = formData.get('force') === 'on';

  const back = (message: string) =>
    redirect(`/vehicles/${vehicleId}/transfer?error=${encodeURIComponent(message)}`);

  if (!on) back(msg('Say what day the vehicle changed hands.'));

  try {
    await transferOwnership({
      orgId,
      userId: user.userId,
      vehicleId,
      toName,
      toKind,
      // Nine in the morning rather than midnight: a bare date is midnight UTC,
      // which is the previous day for anybody west of London, and a sale
      // recorded a day early is a sale recorded wrongly.
      on: new Date(`${on}T09:00:00`),
      odometerKm: reading ? Number(reading) : undefined,
      force,
    });
  } catch (error) {
    if (error instanceof OwnershipError) back(error.message);
    throw error;
  }

  redirect(`/vehicles/${vehicleId}?transferred=1`);
}

/**
 * Invites the buyer instead of recording the sale. Phase 44.
 *
 * Nothing changes hands here. The buyer gets a link, sees the car and what
 * its history carries, and accepts it themselves; until they do, the seller
 * still owns it.
 */
async function invite(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('vehicle:write');

  const vehicleId = String(formData.get('vehicleId') ?? '');
  const on = String(formData.get('on') ?? '');
  const reading = String(formData.get('odometerKm') ?? '').trim();

  const back = (message: string) =>
    redirect(`/vehicles/${vehicleId}/transfer?error=${encodeURIComponent(message)}`);

  if (!on) back(msg('Say what day the vehicle changed hands.'));

  let token: string;

  try {
    const result = await inviteHandover({
      orgId,
      userId: user.userId,
      vehicleId,
      toName: String(formData.get('toName') ?? ''),
      toKind: String(formData.get('toKind') ?? 'PRIVATE') as 'PRIVATE',
      toEmail: String(formData.get('toEmail') ?? ''),
      toPhone: String(formData.get('toPhone') ?? ''),
      on: new Date(`${on}T09:00:00`),
      odometerKm: reading ? Number(reading) : undefined,
      force: formData.get('force') === 'on',
    });
    token = result.token;
  } catch (error) {
    if (error instanceof OwnershipError) back(error.message);
    throw error;
  }

  redirect(`/vehicles/${vehicleId}/transfer?invited=${encodeURIComponent(token)}`);
}

async function callOff(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('vehicle:write');
  const vehicleId = String(formData.get('vehicleId') ?? '');

  try {
    await cancelHandover({
      invitationId: String(formData.get('invitationId') ?? ''),
      userId: user.userId,
      orgId,
    });
  } catch (error) {
    if (error instanceof OwnershipError) {
      redirect(`/vehicles/${vehicleId}/transfer?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }

  redirect(`/vehicles/${vehicleId}/transfer?cancelled=1`);
}

export default async function TransferPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; invited?: string; cancelled?: string }>;
}) {
  const { orgId, region } = await requireSession('vehicle:write');
  const { id } = await params;
  const { error, invited, cancelled } = await searchParams;
  const t = await tFor();

  const permitted = await orgCanReadVehicle(orgId, id);
  if (!permitted) notFound();

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: {
      make: true,
      model: true,
      year: true,
      registration: true,
      vin: true,
      lastOdometerKm: true,
      ownerships: {
        where: { endedAt: null },
        select: { ownerName: true, ownerKind: true, startedAt: true },
      },
    },
  });

  if (!vehicle) notFound();

  const current = vehicle.ownerships[0];
  const today = new Date().toISOString().slice(0, 10);
  const waiting = await pendingHandover(id);

  return (
    <>
      <div className="mb-3">
        <BackLink href={`/vehicles/${id}`}>{t('Back to the vehicle')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Transfer')}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {[vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')}
            {vehicle.registration ? <Registration value={vehicle.registration} /> : null}
          </span>
        }
        description={t('Record that this vehicle has changed hands')}
      />

      {error ? (
        <Alert tone="danger" title={t('That cannot be recorded')} className="mb-5">
          {t(error)}
        </Alert>
      ) : null}

      {cancelled ? (
        <Alert tone="info" className="mb-5">
          {t('The handover was called off. The vehicle stays where it was.')}
        </Alert>
      ) : null}

      {invited ? (
        <Alert tone="success" title={t('The buyer has been invited')} className="mb-5">
          <p>
            {t(
              'Nothing has changed hands yet. The buyer opens this link, sees the car and its history, and accepts it themselves.',
            )}
          </p>
          <p className="mt-2 font-mono text-[12px] break-all">
            {/* i18n-ignore: an address, not a sentence. */}
            <bdi>{`/handover/${invited}`}</bdi>
          </p>
        </Alert>
      ) : null}

      {waiting ? (
        <Card className="mb-5 border-(--brand)">
          <CardHeader
            title={t('Waiting for the buyer')}
            description={t(
              '{name} was invited on {date} and has until {expires} to accept. Until then the vehicle has not moved.',
              {
                name: waiting.toName,
                date: waiting.createdAt.toLocaleDateString(region.locale),
                expires: waiting.expiresAt.toLocaleDateString(region.locale),
              },
            )}
          />
          <CardBody>
            <form action={callOff}>
              <input type="hidden" name="vehicleId" value={id} />
              <input type="hidden" name="invitationId" value={waiting.id} />
              <Button type="submit" size="sm" variant="secondary">
                {t('Call it off')}
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader
            title={t('Who it is going to')}
            description={t(
              'The history goes with the vehicle. The previous owner’s details do not.',
            )}
          />
          <form action={transfer}>
            <input type="hidden" name="vehicleId" value={id} />

            <CardBody className="grid gap-4">
              <Field
                label={t('New owner')}
                hint={t('The name that will appear as the current owner.')}
              >
                <Input name="toName" required placeholder={t('Full name or company')} />
              </Field>

              <Field label={t('Kind')}>
                <Select name="toKind" defaultValue="PRIVATE">
                  <option value="PRIVATE">{t('Private owner')}</option>
                  <option value="COMPANY">{t('Company')}</option>
                  <option value="FLEET">{t('Fleet')}</option>
                  <option value="DEALER">{t('Dealer')}</option>
                  <option value="FINANCE">{t('Finance company')}</option>
                </Select>
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Day it changed hands')}>
                  <Input type="date" name="on" defaultValue={today} max={today} required />
                </Field>

                <Field
                  label={t('Reading at the sale')}
                  hint={t('Optional. Left blank, the last reading on record is used.')}
                >
                  <Input
                    type="number"
                    name="odometerKm"
                    min={0}
                    placeholder={vehicle.lastOdometerKm ? String(vehicle.lastOdometerKm) : 'km'}
                  />
                </Field>
              </div>

              <label className="flex items-start gap-2 text-[13px]">
                <input type="checkbox" name="force" className="mt-0.5" />
                <span>
                  {t('Record it even if work is still open on this vehicle.')}
                  <span className="block text-[12px] text-(--text-faint)">
                    {t('Any open job stays on the previous owner’s account.')}
                  </span>
                </span>
              </label>
            </CardBody>

            <CardBody className="grid gap-3 border-t border-(--border)">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('Buyer’s email')}
                  hint={t('Only needed to invite them. Blank means you pass on the link yourself.')}
                >
                  <Input type="email" name="toEmail" spellCheck={false} />
                </Field>
                <Field label={t('Buyer’s mobile')}>
                  <Input name="toPhone" spellCheck={false} />
                </Field>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="primary">
                  {t('Record the transfer')}
                </Button>
                <Button
                  type="submit"
                  formAction={invite}
                  variant="secondary"
                  disabled={Boolean(waiting)}
                >
                  {t('Invite the buyer to accept it')}
                </Button>
              </div>
              <p className="text-[12px] leading-relaxed text-(--text-faint)">
                {t(
                  'Recording it says the sale happened, on your word. Inviting the buyer waits for theirs, and the car lands on their own account when they accept.',
                )}
              </p>
            </CardBody>
          </form>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHeader title={t('Who has it now')} />
            <CardBody className="grid gap-2">
              {current ? (
                <KeyValue
                  t={t}
                  columns={1}
                  items={[
                    { label: t('Owner'), value: current.ownerName ?? t('Unnamed') },
                    {
                      label: t('Since'),
                      value: current.startedAt.toLocaleDateString(region.locale),
                    },
                  ]}
                />
              ) : (
                <p className="text-[13px] text-(--text-soft)">
                  {t(
                    'No current owner on record. Record one before transferring, or the history will have a gap nobody can explain later.',
                  )}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t('What happens')} />
            <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
              <p>
                {t(
                  'The current ownership closes on the day you give, a new one opens, and the vehicle record gains an entry saying it changed hands at that mileage.',
                )}
              </p>
              <p>
                {t(
                  'No name goes into that entry. Who owned the car lives in the ownership record, where an erasure request can reach it. A permanent chain with somebody’s name hashed into it is a chain that cannot honour one.',
                )}
              </p>
              <p>
                {t(
                  'Every service, inspection and reading stays with the vehicle, which is the entire point: the new owner inherits a history they can rely on.',
                )}
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
