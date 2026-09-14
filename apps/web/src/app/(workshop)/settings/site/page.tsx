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
  Input,
  PageHeader,
  Table,
  TableWrap,
  Td,
  Th,
  Tr,
} from '@carnet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { saveBay, setBayActive, SettingsError, siteSettings, updateSite } from '@/lib/settings';

export const metadata: Metadata = { title: 'Site and bays' };
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

export default async function SiteSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; problem?: string; edit?: string }>;
}) {
  const { orgId, user } = await requireSession('settings:write');
  const { saved, problem, edit } = await searchParams;
  const site = await siteSettings(orgId, user.locationId);

  const editing = site?.bays.find((bay) => bay.id === edit) ?? null;

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">Settings</BackLink>
      </div>

      <PageHeader
        eyebrow="Settings"
        title="Site and bays"
        description="Where the work happens, when the doors are open, and what each bay can take"
      />

      {saved ? (
        <Alert tone="success" className="mb-5">
          Saved. The change is in the audit log with what it was before.
        </Alert>
      ) : null}
      {problem ? (
        <Alert tone="danger" title="Not saved" className="mb-5">
          {problem}
        </Alert>
      ) : null}

      {!site ? (
        <EmptyState
          title="No site yet"
          description="A workshop has at least one site, and sign-up creates it. If you are seeing this, something went wrong at sign-up; get in touch."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader
              title={site.name}
              description={site.isDefault ? 'Default site' : undefined}
            />
            <form action={saveSite}>
              <input type="hidden" name="locationId" value={site.id} />
              <CardBody className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                  <Field label="Name">
                    <Input name="name" defaultValue={site.name} required maxLength={80} />
                  </Field>
                  <Field label="Code" hint="On the diary">
                    <Input
                      name="code"
                      defaultValue={site.code}
                      required
                      maxLength={12}
                      className="font-mono uppercase"
                    />
                  </Field>
                </div>
                <Field label="Address">
                  <Input
                    name="addressLine1"
                    defaultValue={site.addressLine1 ?? ''}
                    maxLength={120}
                    placeholder="Line 1"
                  />
                </Field>
                <Input
                  name="addressLine2"
                  defaultValue={site.addressLine2 ?? ''}
                  maxLength={120}
                  placeholder="Line 2"
                  aria-label="Address line 2"
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Town">
                    <Input name="locality" defaultValue={site.locality ?? ''} maxLength={80} />
                  </Field>
                  <Field label="County or region">
                    <Input name="region" defaultValue={site.region ?? ''} maxLength={80} />
                  </Field>
                  <Field label="Postcode">
                    <Input
                      name="postcode"
                      defaultValue={site.postcode ?? ''}
                      maxLength={20}
                      className="uppercase"
                    />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Telephone">
                    <Input name="phone" defaultValue={site.phone ?? ''} maxLength={40} />
                  </Field>
                  <Field label="Opens at" hint="24-hour clock">
                    <Input
                      name="opensAt"
                      defaultValue={formatClock(site.opensAtMinute)}
                      required
                      className="font-mono"
                      placeholder="08:00"
                    />
                  </Field>
                  <Field label="Closes at">
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
                  label="Daily capacity, technician hours"
                  hint="What the site can absorb in a day across everybody. The capacity page compares bookings against it."
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
                  Save site
                </Button>
              </CardBody>
            </form>
          </Card>

          <div className="grid gap-5 content-start">
            <Card className="overflow-hidden">
              <CardHeader
                title="Bays"
                description="Retired bays keep their history and take no new work"
              />
              {site.bays.length === 0 ? (
                <EmptyState
                  title="No bays yet"
                  description="Add the first bay below. The planner places work on bays, so a site with none cannot be planned."
                />
              ) : (
                <TableWrap className="rounded-none border-0">
                  <Table>
                    <thead>
                      <tr>
                        <Th>Bay</Th>
                        <Th>Code</Th>
                        <Th>Can take</Th>
                        <Th />
                      </tr>
                    </thead>
                    <tbody>
                      {site.bays.map((bay) => (
                        <Tr key={bay.id}>
                          <Td>
                            {bay.name}
                            {!bay.isActive ? (
                              <Badge tone="neutral" size="sm" className="ml-2">
                                retired
                              </Badge>
                            ) : null}
                          </Td>
                          <Td className="font-mono text-[12px]">{bay.code}</Td>
                          <Td className="text-(--text-soft)">{bay.capability ?? '—'}</Td>
                          <Td className="text-right whitespace-nowrap">
                            {bay.isActive ? (
                              <a
                                href={`/settings/site?edit=${bay.id}#bay`}
                                className="mr-2 text-[13px] text-(--brand-text) hover:underline"
                              >
                                Edit
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
                                {bay.isActive ? 'Retire' : 'Restore'}
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
                title={editing ? `Edit ${editing.name}` : 'Add a bay'}
                description={editing ? undefined : 'Name it what the floor calls it'}
              />
              <form action={saveBayAction}>
                <input type="hidden" name="locationId" value={site.id} />
                {editing ? <input type="hidden" name="bayId" value={editing.id} /> : null}
                <CardBody className="grid gap-4">
                  <div className="grid gap-4 sm:grid-cols-[1fr_7rem]">
                    <Field label="Name">
                      <Input
                        name="name"
                        defaultValue={editing?.name ?? ''}
                        required
                        maxLength={60}
                        placeholder="Bay 5 — Ramp"
                      />
                    </Field>
                    <Field label="Code">
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
                    label="Can take"
                    hint="Optional. What the bay has that others do not: two-post lift, four-post lift, tyre machine, scan tool."
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
                    {editing ? 'Save bay' : 'Add bay'}
                  </Button>
                  {editing ? (
                    <a
                      href="/settings/site"
                      className="self-center text-[13px] text-(--text-soft) hover:underline"
                    >
                      Cancel
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
