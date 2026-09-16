import { formatClock, parseClock, PlanLimitError } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Select,
  Input,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import { prisma } from '@carnet/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { labourRates, PricingError, retireLabourRate, saveLabourRate } from '@/lib/pricing';
import { saveBay, setBayActive, SettingsError, siteSettings, updateSite } from '@/lib/settings';
import { setSiteTaxRate, TaxError } from '@/lib/tax';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Site and bays') };
}
export const dynamic = 'force-dynamic';

/**
 * The building. FR-4602, FR-4603.
 *
 * Address and telephone for the paperwork; opening hours and daily capacity
 * for the planner, which until this phase assumed eight to six. Bays are
 * added, renamed and retired here, never deleted: a bay that has had a car
 * on it is on that car's record.
 */

function back(problem: string): never {
  redirect(`/settings/site?problem=${encodeURIComponent(problem)}`);
}

async function saveSite(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const text = (name: string) => String(formData.get(name) ?? '');

  const opens = parseClock(text('opensAt'));
  const closes = parseClock(text('closesAt'));
  if (opens === null || closes === null) back('Opening hours are times like 08:00 and 17:30.');

  try {
    await updateSite({
      orgId,
      userId: user.userId,
      locationId: text('locationId'),
      name: text('name'),
      code: text('code'),
      addressLine1: text('addressLine1'),
      addressLine2: text('addressLine2'),
      locality: text('locality'),
      region: text('region'),
      postcode: text('postcode'),
      phone: text('phone'),
      dailyCapacityHours: Number(text('dailyCapacityHours')),
      opensAtMinute: opens,
      closesAtMinute: closes,
    });
  } catch (error) {
    if (error instanceof SettingsError || error instanceof PlanLimitError) back(error.message);
    throw error;
  }

  redirect('/settings/site?saved=site');
}

async function saveBayAction(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const text = (name: string) => String(formData.get(name) ?? '');

  try {
    await saveBay({
      orgId,
      userId: user.userId,
      locationId: text('locationId'),
      bayId: text('bayId') || null,
      name: text('name'),
      code: text('code'),
      capability: text('capability'),
    });
  } catch (error) {
    if (error instanceof SettingsError || error instanceof PlanLimitError) back(error.message);
    throw error;
  }

  redirect('/settings/site?saved=bay');
}

async function toggleBay(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await setBayActive({
      orgId,
      userId: user.userId,
      bayId: String(formData.get('bayId') ?? ''),
      active: String(formData.get('active') ?? '') === 'yes',
    });
  } catch (error) {
    if (error instanceof SettingsError || error instanceof PlanLimitError) back(error.message);
    throw error;
  }

  redirect('/settings/site?saved=bay');
}

/** This site's own tax rate, or the workshop's default. Phase 41. */
async function saveSiteTax(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  try {
    await setSiteTaxRate({
      orgId,
      userId: user.userId,
      locationId: String(formData.get('locationId') ?? ''),
      taxRateId: String(formData.get('taxRateId') ?? '') || null,
    });
  } catch (error) {
    if (error instanceof TaxError) {
      redirect(`/settings/site?problem=${encodeURIComponent(error.message)}#tax`);
    }
    throw error;
  }
  redirect('/settings/site?saved=1#tax');
}

/**
 * What an hour is charged at here, or at the workshop as a whole. Phase 44.
 *
 * A rate with this site against it wins at this site; one without belongs to
 * the workshop and is what every other site takes.
 */
async function saveRate(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await saveLabourRate({
      orgId,
      userId: user.userId,
      id: String(formData.get('id') ?? '') || null,
      locationId:
        formData.get('scope') === 'site' ? String(formData.get('locationId') ?? '') : null,
      name: String(formData.get('name') ?? ''),
      perHour: Number(String(formData.get('perHour') ?? '').replace(',', '.')),
      isDefault: formData.get('isDefault') === 'on',
    });
  } catch (error) {
    if (!(error instanceof PricingError)) throw error;
    back(error.message);
  }

  redirect('/settings/site?saved=rates#rates');
}

async function retireRate(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await retireLabourRate({ orgId, userId: user.userId, id: String(formData.get('id') ?? '') });
  } catch (error) {
    if (!(error instanceof PricingError)) throw error;
    back(error.message);
  }

  redirect('/settings/site?saved=rates#rates');
}

export default async function SiteSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; problem?: string; edit?: string }>;
}) {
  const { orgId, user } = await requireSession('settings:write');
  const { saved, problem, edit } = await searchParams;
  const [site, rates, hourly] = await Promise.all([
    siteSettings(orgId, user.locationId),
    prisma.taxRate.findMany({
      where: { orgId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      select: { id: true, name: true, isDefault: true },
    }),
    labourRates(orgId),
  ]);
  const siteTax = site
    ? await prisma.location.findUnique({ where: { id: site.id }, select: { taxRateId: true } })
    : null;
  const t = await tFor();

  const editing = site?.bays.find((bay) => bay.id === edit) ?? null;

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">{t('Settings')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Settings')}
        title={t('Site and bays')}
        description={t(
          'Where the work happens, when the doors are open, and what each bay can take',
        )}
      />

      {saved ? (
        <Alert tone="success" className="mb-5">
          {t('Saved. The change is in the audit log with what it was before.')}
        </Alert>
      ) : null}
      {problem ? (
        <Alert tone="danger" title={t('Not saved')} className="mb-5">
          {t(problem)}
        </Alert>
      ) : null}

      {!site ? (
        <EmptyState
          title={t('No site yet')}
          description={t(
            'A workshop has at least one site, and sign-up creates it. If you are seeing this, something went wrong at sign-up; get in touch.',
          )}
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader
              title={site.name}
              description={site.isDefault ? t('Default site') : undefined}
            />
            <form action={saveSite}>
              <input type="hidden" name="locationId" value={site.id} />
              <CardBody className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                  <Field label={t('Name')}>
                    <Input name="name" defaultValue={site.name} required maxLength={80} />
                  </Field>
                  <Field label={t('Code')} hint={t('On the diary')}>
                    <Input
                      name="code"
                      defaultValue={site.code}
                      required
                      maxLength={12}
                      className="font-mono uppercase"
                    />
                  </Field>
                </div>
                <Field label={t('Address')}>
                  <Input
                    name="addressLine1"
                    defaultValue={site.addressLine1 ?? ''}
                    maxLength={120}
                    placeholder={t('Line 1')}
                  />
                </Field>
                <Input
                  name="addressLine2"
                  defaultValue={site.addressLine2 ?? ''}
                  maxLength={120}
                  placeholder={t('Line 2')}
                  aria-label={t('Address line 2')}
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t('Town')}>
                    <Input name="locality" defaultValue={site.locality ?? ''} maxLength={80} />
                  </Field>
                  <Field label={t('County or region')}>
                    <Input name="region" defaultValue={site.region ?? ''} maxLength={80} />
                  </Field>
                  <Field label={t('Postcode')}>
                    <Input
                      name="postcode"
                      defaultValue={site.postcode ?? ''}
                      maxLength={20}
                      className="uppercase"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t('Telephone')}>
                    <Input name="phone" defaultValue={site.phone ?? ''} maxLength={40} />
                  </Field>
                  <Field label={t('Opens at')} hint={t('24-hour clock')}>
                    <Input
                      name="opensAt"
                      defaultValue={formatClock(site.opensAtMinute)}
                      required
                      className="font-mono"
                      placeholder="08:00"
                    />
                  </Field>
                  <Field label={t('Closes at')}>
                    <Input
                      name="closesAt"
                      defaultValue={formatClock(site.closesAtMinute)}
                      required
                      className="font-mono"
                      placeholder="18:00"
                    />
                  </Field>
                </div>
                <Field
                  label={t('Daily capacity, technician hours')}
                  hint={t(
                    'What the site can absorb in a day across everybody. The capacity page compares bookings against it.',
                  )}
                >
                  <Input
                    name="dailyCapacityHours"
                    type="number"
                    min={0}
                    max={1000}
                    step="0.5"
                    defaultValue={Number(site.dailyCapacityHours)}
                    required
                    className="max-w-[10rem]"
                  />
                </Field>
              </CardBody>
              <CardBody className="border-t border-(--border)">
                <Button type="submit" variant="primary">
                  {t('Save site')}
                </Button>
              </CardBody>
            </form>
          </Card>

          <div className="grid gap-5 content-start">
            <Card id="tax">
              <CardHeader
                title={t('Tax at this site')}
                description={t(
                  'New lines here take this rate. Leave it on the default where the site charges what the workshop does.',
                )}
              />
              <form action={saveSiteTax}>
                <input type="hidden" name="locationId" value={site.id} />
                <CardBody className="flex flex-wrap items-end gap-3">
                  <Field label={t('Rate')} className="min-w-[14rem] flex-1">
                    <Select name="taxRateId" defaultValue={siteTax?.taxRateId ?? ''}>
                      <option value="">{t('The workshop’s default')}</option>
                      {rates.map((rate) => (
                        <option key={rate.id} value={rate.id}>
                          {rate.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Button type="submit" variant="secondary" size="sm">
                    {t('Save')}
                  </Button>
                </CardBody>
              </form>
            </Card>

            <Card id="rates" className="overflow-hidden">
              <CardHeader
                title={t('Labour rates')}
                description={t(
                  'What an hour is charged at. A rate against this site is what new lines take here; the rest are the workshop’s.',
                )}
              />
              {hourly.length === 0 ? (
                <CardBody className="text-[13px] text-(--text-soft)">
                  {t('No rate has been set, so a quote asks for a figure every time.')}
                </CardBody>
              ) : (
                <ul className="divide-y divide-(--border)">
                  {hourly.map((rate) => (
                    <li
                      key={rate.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px]"
                    >
                      <span className={rate.isActive ? 'font-medium' : 'text-(--text-faint)'}>
                        <bdi>{rate.name}</bdi>
                      </span>
                      <Badge tone={rate.locationId ? 'brand' : 'neutral'} size="sm">
                        {rate.location?.name ?? t('The whole workshop')}
                      </Badge>
                      {rate.isDefault ? (
                        <Badge tone="success" size="sm">
                          {t('what new lines take')}
                        </Badge>
                      ) : null}
                      {rate.isActive ? null : (
                        <Badge tone="neutral" size="sm">
                          {t('retired')}
                        </Badge>
                      )}
                      <span className="ms-auto tabular-nums">
                        {rate.perHourNumber.toFixed(2)} {t('an hour')}
                      </span>
                      <form action={retireRate}>
                        <input type="hidden" name="id" value={rate.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          {rate.isActive ? t('Retire') : t('Restore')}
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <form action={saveRate} className="border-t border-(--border)">
                <input type="hidden" name="locationId" value={site.id} />
                <CardBody className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-end">
                  <Field label={t('Name')} hint={t('What the quote will call it.')}>
                    {/* i18n-ignore */}
                    <Input name="name" required minLength={2} placeholder="Standard" />
                  </Field>
                  <Field label={t('An hour')}>
                    <Input name="perHour" required inputMode="decimal" placeholder="95.00" />
                  </Field>
                  <Button type="submit" variant="secondary" size="sm">
                    {t('Add the rate')}
                  </Button>
                  <label className="flex items-center gap-2 text-[13px] sm:col-span-3">
                    <input type="checkbox" name="scope" value="site" />
                    <span>{t('Only at this site ({name})', { name: site.name })}</span>
                  </label>
                  <label className="flex items-center gap-2 text-[13px] sm:col-span-3">
                    <input type="checkbox" name="isDefault" />
                    <span>{t('New lines take this rate')}</span>
                  </label>
                </CardBody>
              </form>
            </Card>

            <Card className="overflow-hidden">
              <CardHeader
                title={t('Bays')}
                description={t('Retired bays keep their history and take no new work')}
              />
              {site.bays.length === 0 ? (
                <EmptyState
                  title={t('No bays yet')}
                  description={t(
                    'Add the first bay below. The planner places work on bays, so a site with none cannot be planned.',
                  )}
                />
              ) : (
                <TableWrap className="rounded-none border-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th>{t('Bay')}</Th>
                        <Th>{t('Code')}</Th>
                        <Th>{t('Can take')}</Th>
                        <Th />
                      </tr>
                    </thead>
                    <tbody>
                      {site.bays.map((bay) => (
                        <Tr key={bay.id}>
                          <Td>
                            {bay.name}
                            {!bay.isActive ? (
                              <Badge tone="neutral" size="sm" className="ms-2">
                                {t('retired')}
                              </Badge>
                            ) : null}
                          </Td>
                          <Td className="font-mono text-[12px]">{bay.code}</Td>
                          <Td className="text-(--text-soft)">{bay.capability ?? '—'}</Td>
                          <Td className="text-end whitespace-nowrap">
                            {bay.isActive ? (
                              <a
                                href={`/settings/site?edit=${bay.id}#bay`}
                                className="me-2 text-[13px] text-(--brand-text) hover:underline"
                              >
                                {t('Edit')}
                              </a>
                            ) : null}
                            <form action={toggleBay} className="inline">
                              <input type="hidden" name="bayId" value={bay.id} />
                              <input
                                type="hidden"
                                name="active"
                                value={bay.isActive ? 'no' : 'yes'}
                              />
                              <Button type="submit" variant="ghost" size="sm">
                                {bay.isActive ? t('Retire') : t('Restore')}
                              </Button>
                            </form>
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                </TableWrap>
              )}
            </Card>

            <Card id="bay">
              <CardHeader
                title={editing ? t('Edit {name}', { name: editing.name }) : t('Add a bay')}
                description={editing ? undefined : t('Name it what the floor calls it')}
              />
              <form action={saveBayAction}>
                <input type="hidden" name="locationId" value={site.id} />
                {editing ? <input type="hidden" name="bayId" value={editing.id} /> : null}
                <CardBody className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                    <Field label={t('Name')}>
                      <Input
                        name="name"
                        defaultValue={editing?.name ?? ''}
                        required
                        maxLength={60}
                        placeholder={t('Bay 5 — Ramp')}
                      />
                    </Field>
                    <Field label={t('Code')}>
                      <Input
                        name="code"
                        defaultValue={editing?.code ?? ''}
                        required
                        maxLength={12}
                        className="font-mono uppercase"
                        placeholder="B5"
                      />
                    </Field>
                  </div>
                  <Field
                    label={t('Can take')}
                    hint={t(
                      'Optional. What the bay has that others do not: two-post lift, four-post lift, tyre machine, scan tool.',
                    )}
                  >
                    <Input
                      name="capability"
                      defaultValue={editing?.capability ?? ''}
                      maxLength={80}
                    />
                  </Field>
                </CardBody>
                <CardBody className="flex gap-2 border-t border-(--border)">
                  <Button type="submit" variant="primary">
                    {editing ? t('Save bay') : t('Add bay')}
                  </Button>
                  {editing ? (
                    <a
                      href="/settings/site"
                      className="self-center text-[13px] text-(--text-soft) hover:underline"
                    >
                      {t('Cancel')}
                    </a>
                  ) : null}
                </CardBody>
              </form>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
