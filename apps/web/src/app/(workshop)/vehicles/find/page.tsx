import { Alert, Button, Card, CardBody, CardHeader, Field, Input, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { adoptVehicle, findOnNetwork, NetworkError, registerVehicle } from '@/lib/network';
import { decodeVin, VinDecodeError } from '@/lib/providers';
import { PlanLimitError, type VinDecoding } from '@carnet/core';

import { networkSentence } from '../statements';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Find a vehicle') };
}
export const dynamic = 'force-dynamic';

/**
 * A car arrives that this workshop has never seen.
 *
 * Either it is on the network already, serviced somewhere else that uses
 * Carnet, in which case its history is here and what this workshop records
 * continues it. Or it is not, and its history starts today. Both paths end
 * on a job; the difference is whether the first entry is the first entry.
 *
 * What the workshop is told before it takes the car on is that history
 * exists and who kept it. Not the entries: those come once there is a reason
 * to read them, which is the car on the ramp.
 */

async function adopt(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('vehicle:write');
  const vehicleId = String(formData.get('vehicleId') ?? '');

  try {
    await adoptVehicle({ orgId, userId: user.userId, vehicleId });
  } catch (error) {
    if (!(error instanceof NetworkError) && !(error instanceof PlanLimitError)) throw error;
    redirect(
      `/vehicles/find?q=${encodeURIComponent(String(formData.get('q') ?? ''))}&problem=${encodeURIComponent(error.message)}`,
    );
  }

  redirect(`/vehicles/${vehicleId}?adopted=1`);
}

async function register(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('vehicle:write');

  let result: { id: string; warning: string | null };

  try {
    result = await registerVehicle({
      orgId,
      userId: user.userId,
      vin: String(formData.get('vin') ?? ''),
      registration: String(formData.get('registration') ?? ''),
      make: String(formData.get('make') ?? ''),
      model: String(formData.get('model') ?? ''),
      year: Number(formData.get('year') ?? '') || null,
    });
  } catch (error) {
    if (!(error instanceof NetworkError) && !(error instanceof PlanLimitError)) throw error;
    redirect(
      `/vehicles/find?q=${encodeURIComponent(String(formData.get('vin') ?? ''))}&problem=${encodeURIComponent(error.message)}`,
    );
  }

  redirect(
    `/vehicles/${result.id}?registered=1${result.warning ? `&warning=${encodeURIComponent(result.warning)}` : ''}`,
  );
}

/**
 * Reads the VIN before the car is added. Phase 43.
 *
 * The answer fills the form and nothing else; the person saving it has the
 * car in front of them and the decoder does not.
 */
async function decode(formData: FormData) {
  'use server';

  await requireSession('vehicle:write');
  const text = (name: string) => String(formData.get(name) ?? '').trim();
  const query = new URLSearchParams({
    q: text('q'),
    vin: text('vin'),
    registration: text('registration'),
    decode: '1',
  });

  redirect(`/vehicles/find?${query.toString()}`);
}

export default async function FindVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    problem?: string;
    vin?: string;
    registration?: string;
    decode?: string;
  }>;
}) {
  const { orgId, user, region } = await requireSession('vehicle:read');
  const params = await searchParams;
  const q = params.q?.trim() ?? '';

  let found: Awaited<ReturnType<typeof findOnNetwork>> | null = null;
  let problem = params.problem ?? null;

  if (q) {
    try {
      found = await findOnNetwork(orgId, q);
    } catch (error) {
      if (!(error instanceof NetworkError) && !(error instanceof PlanLimitError)) throw error;
      problem = error.message;
    }
  }

  const mayWrite = can(user.role, 'vehicle:write');
  const t = await tFor();

  let decoded: VinDecoding | null = null;
  let decodeProblem: string | null = null;
  if (params.decode && params.vin && mayWrite) {
    try {
      decoded = await decodeVin(params.vin);
    } catch (error) {
      if (!(error instanceof VinDecodeError)) throw error;
      decodeProblem = error.message;
    }
  }

  return (
    <>
      <div className="mb-3">
        <BackLink href="/vehicles">{t('All vehicles')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Vehicles')}
        title={t('Find a vehicle')}
        description={t(
          'By registration or VIN. If another Carnet workshop has seen it, its history is already here.',
        )}
      />

      <Card className="mb-5">
        <form action="/vehicles/find" method="get">
          <CardBody className="flex flex-wrap items-end gap-3">
            <Field label={t('Registration or VIN')} className="min-w-0 flex-1">
              <Input
                name="q"
                defaultValue={q}
                autoFocus
                autoCapitalize="characters"
                spellCheck={false}
                placeholder={t('AB12 CDE or WVWZZZ1JZ3W386752')}
                className="font-mono uppercase"
              />
            </Field>
            <Button type="submit" variant="primary">
              {t('Look it up')}
            </Button>
          </CardBody>
        </form>
      </Card>

      {problem ? (
        <Alert tone="danger" className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      {found?.vehicle ? (
        <Card className="mb-5 border-(--brand)">
          <CardHeader
            title={
              [found.vehicle.year, found.vehicle.make, found.vehicle.model]
                .filter(Boolean)
                .join(' ') || t('Vehicle')
            }
            description={`${found.vehicle.registration ?? t('No plate on record')} · ${t('VIN {vin}', { vin: found.vehicle.vin })}`}
          />
          <CardBody className="grid gap-3">
            {/* The point of the network, in one sentence. */}
            <p className="text-[15px] leading-relaxed">
              {found.summary ? networkSentence(t, found.summary, region.locale) : null}
            </p>

            {found.summary && found.summary.otherEntries > 0 ? (
              <p className="text-[13px] leading-relaxed text-(--text-soft)">
                {t(
                  'What you will see: every service, part, inspection and mileage reading, with the verification each carries. What you will not see: what they charged, their job numbers, or who did the work. The car’s history is the car’s; their margins are theirs.',
                )}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {found.servicedHere ? (
                <>
                  <Link href={`/vehicles/${found.vehicle.id}`}>
                    <Button>{t('Open the vehicle')}</Button>
                  </Link>
                  <Link href={`/jobs/new?vehicle=${found.vehicle.id}`}>
                    <Button variant="primary">{t('New job')}</Button>
                  </Link>
                </>
              ) : mayWrite ? (
                <form action={adopt}>
                  <input type="hidden" name="vehicleId" value={found.vehicle.id} />
                  <input type="hidden" name="q" value={q} />
                  <Button type="submit" variant="primary">
                    {t('Take it on and see the history')}
                  </Button>
                </form>
              ) : (
                <p className="text-[13px] text-(--text-faint)">
                  {t('Somebody with vehicle access can take this car on.')}
                </p>
              )}
            </div>
          </CardBody>
        </Card>
      ) : null}

      {found && !found.vehicle ? (
        <Card className="mb-5">
          <CardHeader
            title={t('Not on the network')}
            description={t(
              'No Carnet workshop has recorded {identifier}. Its history starts with you.',
              { identifier: found.identifier },
            )}
          />
          <form action={register}>
            <input type="hidden" name="q" value={q} />
            <CardBody className="grid gap-4">
              {decoded ? (
                <Alert tone={decoded.make ? 'info' : 'warning'}>
                  <span className="block font-medium">
                    {decoded.make
                      ? t('Read from the VIN by {decoder}:', { decoder: t(decoded.decoder) })
                      : t('{decoder} could not name the maker from this VIN.', {
                          decoder: t(decoded.decoder),
                        })}{' '}
                    <bdi>
                      {[decoded.year, decoded.make, decoded.model].filter(Boolean).join(' ')}
                    </bdi>
                  </span>
                  {decoded.engine || decoded.fuel || decoded.body ? (
                    <span className="block text-[12px]">
                      <bdi>
                        {[decoded.engine, decoded.fuel, decoded.body].filter(Boolean).join(' · ')}
                      </bdi>
                    </span>
                  ) : null}
                  <span className="block text-[12px]">
                    {decoded.complete
                      ? t('Check it against the car before adding it.')
                      : t(
                          'The VIN itself names only the maker and sometimes the year. Type the model from the car.',
                        )}
                  </span>
                </Alert>
              ) : null}
              {decodeProblem ? <Alert tone="danger">{t(decodeProblem)}</Alert> : null}
              <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                <Field
                  label={t('VIN')}
                  hint={t('17 characters, from the windscreen or the door frame')}
                >
                  <Input
                    name="vin"
                    defaultValue={params.vin ?? (found.kind === 'VIN' ? found.identifier : '')}
                    required
                    minLength={17}
                    maxLength={17}
                    spellCheck={false}
                    className="font-mono uppercase"
                  />
                </Field>
                <Field label={t('Registration')}>
                  <Input
                    name="registration"
                    defaultValue={
                      params.registration ?? (found.kind === 'REGISTRATION' ? found.identifier : '')
                    }
                    spellCheck={false}
                    className="font-mono uppercase"
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label={t('Make')}>
                  {/* i18n-ignore */}
                  <Input name="make" placeholder="Volkswagen" defaultValue={decoded?.make ?? ''} />
                </Field>
                <Field label={t('Model')}>
                  {/* i18n-ignore */}
                  <Input name="model" placeholder="Golf" defaultValue={decoded?.model ?? ''} />
                </Field>
                <Field label={t('Year')}>
                  <Input
                    name="year"
                    inputMode="numeric"
                    placeholder="2019"
                    defaultValue={decoded?.year ?? ''}
                  />
                </Field>
              </div>
              <p className="text-[13px] leading-relaxed text-(--text-soft)">
                {t(
                  'A VIN whose check digit does not add up is recorded as typed and flagged, not refused. You have the car in front of you; the algorithm does not.',
                )}
              </p>
              {mayWrite ? (
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="primary">
                    {t('Add the vehicle')}
                  </Button>
                  <Button type="submit" formAction={decode} formNoValidate variant="secondary">
                    {t('Read the VIN')}
                  </Button>
                </div>
              ) : null}
            </CardBody>
          </form>
        </Card>
      ) : null}

      {!q ? (
        <Card>
          <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
            <p className="font-medium text-(--text)">{t('Why look first')}</p>
            <p>
              {t(
                'A vehicle is one record wherever it is serviced. Adding a car that another workshop already keeps would start a second history for the same VIN, so the network refuses that and offers the existing one instead.',
              )}
            </p>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
