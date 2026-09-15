import { humaniseRole, msg, type Role, PlanLimitError } from '@carnet/core';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
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
import { redirect } from 'next/navigation';

import { ApiKeyError, apiKeysFor, createApiKey, revokeApiKey } from '@/lib/api-keys';
import { AssistantError, assistantUsage, setAssistantBudget } from '@/lib/assistant';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { packagesFor } from '@/lib/packages';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Settings') };
}
export const dynamic = 'force-dynamic';

const PLAN_BADGES: Record<string, string> = {
  CORE: msg('Core plan'),
  COMPLETE: msg('Complete plan'),
  GROUP: msg('Group plan'),
};

/**
 * Settings, at a glance.
 *
 * Showing the configuration is worth doing before editing it: most support
 * questions are "what is our approval threshold" or "who has access", and
 * those are answerable without a single form. Since Phase 19 each card links
 * to the page that edits it, and every edit is in the audit log.
 */
/**
 * API keys. FR-4507.
 *
 * The token is shown once, on the page the mint returns to, and never again:
 * only its hash is kept. Somebody who loses it makes another and revokes the
 * old one, which is what the list is for.
 */
async function mint(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    const key = await createApiKey({
      orgId,
      userId: user.userId,
      name: String(formData.get('name') ?? ''),
    });
    redirect(`/settings?token=${encodeURIComponent(key.token)}#api`);
  } catch (error) {
    if (error instanceof ApiKeyError || error instanceof PlanLimitError) {
      redirect(`/settings?problem=${encodeURIComponent(error.message)}#api`);
    }
    throw error;
  }
}

async function budget(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await setAssistantBudget({
      orgId,
      userId: user.userId,
      tokens: Number(String(formData.get('tokens') ?? '').replace(/[^\d]/g, '')),
    });
  } catch (error) {
    if (error instanceof AssistantError) {
      redirect(`/settings?problem=${encodeURIComponent(error.message)}#assistant`);
    }
    throw error;
  }

  redirect('/settings?saved=assistant#assistant');
}

async function revoke(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  await revokeApiKey({ orgId, userId: user.userId, keyId: String(formData.get('keyId') ?? '') });
  redirect('/settings#api');
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; problem?: string; saved?: string }>;
}) {
  const { db, user, orgId, region } = await requireSession('settings:read');
  const { token, problem, saved } = await searchParams;
  const t = await tFor();
  const mayWrite = can(user.role, 'settings:write');
  const apiKeys = await apiKeysFor(orgId);
  const assistant = await assistantUsage(orgId);
  const packages = await packagesFor(orgId, { activeOnly: true });

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
        eyebrow={t('Admin')}
        title={t('Settings')}
        description={org.name}
        actions={
          <Badge tone="brand" dot>
            {t(PLAN_BADGES[org.plan] ?? org.plan)}
          </Badge>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('Subscription')}
            description={t('Where the workshop stands, and what its plan allows')}
            action={
              <Link href="/settings/subscription">
                <Button variant="secondary" size="sm">
                  {t('Open')}
                </Button>
              </Link>
            }
          />
        </Card>

        <Card>
          <CardHeader
            title={t('Data in and out')}
            description={t(
              'Import customers, vehicles, parts, suppliers and opening balances from a CSV; export everything',
            )}
            action={
              <Link href="/settings/data">
                <Button variant="secondary" size="sm">
                  {t('Open')}
                </Button>
              </Link>
            }
          />
        </Card>

        <Card>
          <CardHeader
            title={t('Organisation')}
            action={
              mayWrite ? (
                <Link
                  href="/settings/organisation"
                  className="text-[13px] text-(--brand-text) hover:underline"
                >
                  {t('Edit')}
                </Link>
              ) : undefined
            }
          />
          <CardBody>
            <KeyValue
              t={t}
              columns={2}
              items={[
                { label: t('Trading name'), value: org.name },
                { label: t('Legal name'), value: org.legalName },
                { label: t('Tax number'), value: org.taxNumber },
                { label: t('Email'), value: org.email },
                { label: t('Telephone'), value: org.phone },
                { label: t('Base currency'), value: org.baseCurrency },
                { label: t('Timezone'), value: org.timezone },
                {
                  label: t('Re-approval threshold'),
                  value: `${Number(org.reapprovalThresholdPct)}%`,
                },
              ]}
            />
            <p className="mt-4 border-t border-(--border) pt-3 text-[12px] leading-relaxed text-(--text-faint)">
              {t(
                'Work exceeding an approved estimate by more than the threshold sends the job back for a fresh decision. That is the rule that prevents an argument at the collection desk.',
              )}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('Location and bays')}
            description={location?.name ?? t('No location')}
            action={
              mayWrite ? (
                <Link
                  href="/settings/site"
                  className="text-[13px] text-(--brand-text) hover:underline"
                >
                  {t('Edit')}
                </Link>
              ) : undefined
            }
          />
          <CardBody>
            {location ? (
              <>
                <KeyValue
                  t={t}
                  columns={2}
                  items={[
                    {
                      label: t('Address'),
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
                      label: t('Daily capacity'),
                      value: t('{hours} technician hours', {
                        hours: Number(location.dailyCapacityHours),
                      }),
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
            title={t('People')}
            description={
              org.memberships.length === 1
                ? t('1 active person')
                : t('{count} active people', { count: org.memberships.length })
            }
          />
          <TableWrap className="rounded-none border-0">
            <Table>
              <thead>
                <tr>
                  <Th>{t('Name')}</Th>
                  <Th>{t('Email')}</Th>
                  <Th>{t('Role')}</Th>
                  <Th>{t('Lands on')}</Th>
                  <Th numeric>{t('Cost rate')}</Th>
                  <Th>{t('Last signed in')}</Th>
                </tr>
              </thead>
              <tbody>
                {org.memberships.map((membership) => (
                  <Tr key={membership.id}>
                    <Td className="font-medium">
                      {membership.user.name}
                      {membership.userId === user.userId ? (
                        <span className="ml-2 text-[11px] text-(--text-faint)">{t('you')}</span>
                      ) : null}
                    </Td>
                    <Td className="datum text-(--text-soft)">{membership.user.email}</Td>
                    <Td>
                      <Badge tone="neutral" size="sm">
                        {t(humaniseRole(membership.role as Role))}
                      </Badge>
                    </Td>
                    <Td className="text-(--text-faint)">
                      {membership.role === 'TECHNICIAN'
                        ? t('Shop floor')
                        : membership.role === 'CUSTOMER'
                          ? t('Portal')
                          : t('Workshop')}
                    </Td>
                    <Td numeric className="text-(--text-soft)">
                      {membership.costRate ? (
                        <Money
                          currency={region.currency}
                          locale={region.locale}
                          amount={Number(membership.costRate)}
                        />
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td className="datum text-(--text-faint)">
                      {membership.user.lastLoginAt?.toLocaleDateString(region.locale) ?? t('Never')}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </TableWrap>
        </Card>

        <Card>
          <CardHeader
            title={t('Tax rates')}
            action={
              mayWrite ? (
                <Link
                  href="/settings/catalogue"
                  className="text-[13px] text-(--brand-text) hover:underline"
                >
                  {t('Edit')}
                </Link>
              ) : undefined
            }
          />
          <ul className="divide-y divide-(--border)">
            {org.taxRates.map((rate) => (
              <li key={rate.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-[13px] font-medium">{rate.name}</span>
                <span className="flex items-center gap-2">
                  {rate.isDefault ? (
                    <Badge tone="brand" size="sm">
                      {t('default')}
                    </Badge>
                  ) : null}
                  <span className="tabular text-[13px]">{Number(rate.rate)}%</span>
                </span>
              </li>
            ))}
          </ul>
          <CardBody className="border-t border-(--border) text-[12px] leading-relaxed text-(--text-faint)">
            {t(
              'Tax is calculated per line and then summed, never by applying one rate to the subtotal. A document mixing rates gives a different answer each way, and only the per-line answer is correct.',
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title={t('Job types')}
            action={
              mayWrite ? (
                <Link
                  href="/settings/catalogue#type"
                  className="text-[13px] text-(--brand-text) hover:underline"
                >
                  {t('Edit')}
                </Link>
              ) : undefined
            }
          />
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
                      {t('QC required')}
                    </Badge>
                  ) : null}
                  {type.defaultHours ? `${Number(type.defaultHours)}h` : ''}
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title={t('Service packages')}
            action={
              mayWrite ? (
                <Link
                  href="/settings/packages"
                  className="text-[13px] text-(--brand-text) hover:underline"
                >
                  {t('Edit')}
                </Link>
              ) : undefined
            }
          />
          {packages.length === 0 ? (
            <CardBody className="text-[13px] text-(--text-soft)">
              {t(
                'None yet. A package puts the labour, the parts and the checklist on a job in one press.',
              )}{' '}
              <Link href="/settings/packages" className="underline">
                {t('Add one')}
              </Link>
            </CardBody>
          ) : (
            <ul className="divide-y divide-(--border)">
              {packages.map((pkg) => (
                <li key={pkg.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-[13px] font-medium">{pkg.name}</span>
                  <span className="text-[12px] text-(--text-faint)">
                    {t('{hours}h · {count} lines', { hours: pkg.hours, count: pkg.lines.length })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={t('Inspection templates')} />
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
                        {t('default')}
                      </Badge>
                    ) : null}
                    <span className="text-[12px] text-(--text-faint)">
                      {t('{sections} sections, {items} items', {
                        sections: template.sections.length,
                        items: itemCount,
                      })}
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

        <Card className="lg:col-span-2" id="assistant">
          <CardHeader
            title={t('Assistant')}
            description={
              assistant.transport === 'anthropic'
                ? t(
                    'A model ({model}) tidies drafts within the budget below; every figure is checked against the record first.',
                    { model: assistant.model },
                  )
                : t(
                    'No model is configured, so the assistant uses the plain text it composes from the record. That is a complete feature, not a degraded one.',
                  )
            }
          />
          <CardBody className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-start">
            <div className="grid gap-1 text-[13px]">
              <p>{t(assistant.budget.statement)}</p>
              <p className="text-(--text-soft)">
                {t(
                  'Exchanges this month: {exchanges}. Questions: {questions}, drafts: {drafts}, explanations: {explanations}.',
                  {
                    exchanges: assistant.exchanges,
                    questions: assistant.byKind.QUESTION,
                    drafts: assistant.byKind.DRAFT,
                    explanations: assistant.byKind.EXPLAIN,
                  },
                )}{' '}
                {assistant.costMinor > 0
                  ? t('Roughly {amount} at list prices.', {
                      amount: `$${(assistant.costMinor / 100).toFixed(2)}`,
                    })
                  : t('Nothing spent on a model.')}
              </p>
              {saved === 'assistant' ? (
                <p className="text-[12px] text-(--success)">{t('Budget saved.')}</p>
              ) : null}
            </div>
            {mayWrite ? (
              <form action={budget} className="flex flex-wrap items-end gap-2">
                <Field label={t('Monthly token budget')} hint={t('0 switches the model off')}>
                  <Input
                    name="tokens"
                    inputMode="numeric"
                    defaultValue={assistant.budget.used + assistant.budget.remaining}
                    className="w-40 font-mono"
                  />
                </Field>
                <Button type="submit" variant="secondary" size="sm">
                  {t('Save')}
                </Button>
              </form>
            ) : null}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2" id="api">
          <CardHeader
            title={t('API keys')}
            description={t(
              "For accounting software and anything else that reads this workshop's jobs, invoices and vehicles",
            )}
          />
          <CardBody className="grid gap-4">
            {token ? (
              <Alert tone="success" title={t('Your new key. Copy it now; it is not shown again.')}>
                <code className="mt-1 block break-all rounded-(--radius-xs) bg-(--surface-sunk) px-2 py-1 font-mono text-[13px] select-all">
                  {token}
                </code>
              </Alert>
            ) : null}
            {problem ? <Alert tone="danger">{t(problem)}</Alert> : null}

            {apiKeys.length === 0 ? (
              <p className="text-[13px] text-(--text-soft)">{t('No keys yet.')}</p>
            ) : (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th>{t('Name')}</Th>
                      <Th>{t('Starts with')}</Th>
                      <Th>{t('Made by')}</Th>
                      <Th>{t('Last used')}</Th>
                      <Th>{t('State')}</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map((key) => (
                      <Tr key={key.id}>
                        <Td>{key.name}</Td>
                        <Td className="font-mono text-[12px]">{key.prefix}…</Td>
                        <Td>{key.createdBy?.name ?? t('Somebody since removed')}</Td>
                        <Td>
                          {key.lastUsedAt
                            ? key.lastUsedAt.toLocaleDateString(region.locale)
                            : t('Never')}
                        </Td>
                        <Td>
                          {key.revokedAt ? (
                            <Badge tone="neutral">{t('Revoked')}</Badge>
                          ) : (
                            <Badge tone="success">{t('Live')}</Badge>
                          )}
                        </Td>
                        <Td className="text-right">
                          {mayWrite && !key.revokedAt ? (
                            <form action={revoke}>
                              <input type="hidden" name="keyId" value={key.id} />
                              <Button type="submit" variant="ghost" size="sm">
                                {t('Revoke')}
                              </Button>
                            </form>
                          ) : null}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </TableWrap>
            )}

            {mayWrite ? (
              <form action={mint} className="flex flex-wrap items-end gap-3">
                <Field label={t('Name for a new key')} className="min-w-0 flex-1">
                  <Input name="name" required maxLength={60} placeholder={t('Xero sync')} />
                </Field>
                <Button type="submit" variant="primary">
                  {t('Make a key')}
                </Button>
              </form>
            ) : null}

            <p className="text-[12px] leading-relaxed text-(--text-faint)">
              {t('Send the key in this header:')} {/* i18n-ignore */}
              <code className="font-mono">Authorization: Bearer cn_…</code>{' '}
              {t('It reads these addresses:')} {/* i18n-ignore */}
              <code className="font-mono">/api/v1/jobs</code>, {/* i18n-ignore */}
              <code className="font-mono">/api/v1/invoices</code>, {/* i18n-ignore */}
              <code className="font-mono">/api/v1/vehicles/&lt;vin&gt;</code>.{' '}
              {t('A key sees what this workshop sees and nothing beyond it.')}
            </p>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title={t('Document numbering')}
            description={t('Sequential and gapless per organisation')}
            action={
              mayWrite ? (
                <Link
                  href="/settings/organisation"
                  className="text-[13px] text-(--brand-text) hover:underline"
                >
                  {t('Edit prefixes')}
                </Link>
              ) : undefined
            }
          />
          <CardBody className="flex flex-wrap gap-6">
            {org.sequences.map((sequence) => (
              <div key={sequence.id}>
                <p className="eyebrow mb-0.5">{t(sequence.kind.toLowerCase().replace('_', ' '))}</p>
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
        {t('Every change made here is recorded in the audit log with what it was before.')}{' '}
        <Link href="/audit" className="underline">
          {t('Open the audit log')}
        </Link>
      </p>
    </>
  );
}
