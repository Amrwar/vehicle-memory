import { COUNTRIES, CURRENCIES } from '@carnet/core';
import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
} from '@carnet/ui';
import { prisma } from '@carnet/db';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { setPricesIncludeTax } from '@/lib/tax';
import { tFor } from '@/lib/i18n';
import {
  organisationSettings,
  setNumberingPrefix,
  SettingsError,
  updateOrganisation,
} from '@/lib/settings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Organisation') };
}
export const dynamic = 'force-dynamic';

/**
 * The workshop's own details. FR-4601, FR-4607.
 *
 * What goes on the invoice, who to ring, and the two numbers that shape
 * behaviour elsewhere: the re-approval threshold and the document prefixes.
 * Each save is audited with the before and after, so "who changed the VAT
 * number" has an answer.
 */

function back(problem: string): never {
  redirect(`/settings/organisation?problem=${encodeURIComponent(problem)}`);
}

async function save(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  const text = (name: string) => String(formData.get(name) ?? '');

  try {
    await updateOrganisation({
      orgId,
      userId: user.userId,
      name: text('name'),
      legalName: text('legalName'),
      taxNumber: text('taxNumber'),
      email: text('email'),
      phone: text('phone'),
      website: text('website'),
      reapprovalThresholdPct: Number(text('reapprovalThresholdPct')),
      country: text('country'),
      currency: text('currency'),
      locale: text('locale'),
      timezone: text('timezone'),
    });
  } catch (error) {
    if (error instanceof SettingsError) back(error.message);
    throw error;
  }

  redirect('/settings/organisation?saved=details');
}

async function savePrefix(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');

  try {
    await setNumberingPrefix({
      orgId,
      userId: user.userId,
      sequenceId: String(formData.get('sequenceId') ?? ''),
      prefix: String(formData.get('prefix') ?? ''),
    });
  } catch (error) {
    if (error instanceof SettingsError) back(error.message);
    throw error;
  }

  redirect('/settings/organisation?saved=numbering');
}

/** With tax in, or before tax. Phase 41. */
async function savePricing(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('settings:write');
  await setPricesIncludeTax({
    orgId,
    userId: user.userId,
    value: formData.get('pricesIncludeTax') === 'yes',
  });
  redirect('/settings/organisation?saved=1#pricing');
}

export default async function OrganisationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; problem?: string }>;
}) {
  const { orgId } = await requireSession('settings:write');
  const { saved, problem } = await searchParams;
  const [org, pricing] = await Promise.all([
    organisationSettings(orgId),
    prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      select: { pricesIncludeTax: true },
    }),
  ]);
  const t = await tFor();

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">{t('Settings')}</BackLink>
      </div>

      <PageHeader
        eyebrow={t('Settings')}
        title={t('Organisation')}
        description={t(
          'What goes on the paperwork, and the two numbers that change how the product behaves',
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

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title={t('Details')}
            description={t('As they appear on invoices and messages')}
          />
          <form action={save}>
            <CardBody className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Trading name')}>
                  <Input name="name" defaultValue={org.name} required maxLength={120} />
                </Field>
                <Field
                  label={t('Legal name')}
                  hint={t('If different. Goes on the invoice footer.')}
                >
                  <Input name="legalName" defaultValue={org.legalName ?? ''} maxLength={120} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Tax number')} hint={t('VAT or equivalent')}>
                  <Input name="taxNumber" defaultValue={org.taxNumber ?? ''} maxLength={40} />
                </Field>
                <Field label={t('Website')}>
                  <Input name="website" defaultValue={org.website ?? ''} maxLength={200} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Email')} hint={t('Where customers reply')}>
                  <Input name="email" type="email" defaultValue={org.email ?? ''} maxLength={200} />
                </Field>
                <Field label={t('Telephone')}>
                  <Input name="phone" defaultValue={org.phone ?? ''} maxLength={40} />
                </Field>
              </div>
              <Field
                label={t('Re-approval threshold, %')}
                hint={t(
                  'Work that grows past an approved estimate by more than this goes back to the customer before it continues. Zero means every increase does.',
                )}
              >
                <Input
                  name="reapprovalThresholdPct"
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  defaultValue={Number(org.reapprovalThresholdPct)}
                  required
                  className="max-w-[10rem]"
                />
              </Field>
              {/* The region. One currency per workshop, because a workshop
                  keeps one set of books; the rest follows the country unless
                  somebody has a reason to differ. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('Country')} hint={t('Where the workshop trades')}>
                  <Select name="country" defaultValue={org.country}>
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {t(country.name)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={t('Currency')}
                  hint={t(
                    'The books are kept in one currency. Changing it does not convert what is already recorded.',
                  )}
                >
                  <Select name="currency" defaultValue={org.baseCurrency}>
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t('Language and region')}
                  hint={t('How dates and figures are written, such as en-CA or fr-FR')}
                >
                  <Input name="locale" defaultValue={org.locale} maxLength={12} required />
                </Field>
                <Field label={t('Timezone')} hint={t('Such as America/Toronto')}>
                  <Input name="timezone" defaultValue={org.timezone} maxLength={64} required />
                </Field>
              </div>
            </CardBody>
            <CardBody className="border-t border-(--border)">
              <Button type="submit" variant="primary">
                {t('Save details')}
              </Button>
            </CardBody>
          </form>
        </Card>

        <Card id="pricing">
          <CardHeader
            title={t('How prices are entered')}
            description={t('Applies to labour rates, part prices, packages and the counter')}
          />
          <form action={savePricing}>
            <CardBody className="grid gap-3 text-[13px]">
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="pricesIncludeTax"
                  value="no"
                  defaultChecked={!pricing.pricesIncludeTax}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{t('Before tax')}</span>
                  <span className="block text-(--text-faint)">
                    {t('Tax is added on top, as a trade price list reads.')}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="pricesIncludeTax"
                  value="yes"
                  defaultChecked={pricing.pricesIncludeTax}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{t('With tax in')}</span>
                  <span className="block text-(--text-faint)">
                    {t('The price is what the customer pays; the tax is taken out of it.')}
                  </span>
                </span>
              </label>
              <p className="text-[12px] leading-relaxed text-(--text-faint)">
                {t(
                  'Open jobs and quotes are priced the new way from now on. Invoices already issued keep the way they were priced.',
                )}
              </p>
              <div>
                <Button type="submit" variant="secondary" size="sm">
                  {t('Save')}
                </Button>
              </div>
            </CardBody>
          </form>
        </Card>

        <Card>
          <CardHeader
            title={t('Document numbering')}
            description={t('Sequential and gapless. The prefix can change; the counter cannot.')}
          />
          <CardBody className="grid gap-4">
            {org.sequences.map((sequence) => (
              <form
                key={sequence.id}
                action={savePrefix}
                className="flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="sequenceId" value={sequence.id} />
                <Field
                  label={t(sequence.kind.toLowerCase().replace(/_/g, ' '))}
                  hint={t('Next: {number}', { number: `${sequence.prefix}${sequence.next}` })}
                  className="min-w-0 flex-1"
                >
                  <Input
                    name="prefix"
                    defaultValue={sequence.prefix}
                    maxLength={8}
                    // i18n-ignore
                    placeholder="INV-"
                    className="font-mono uppercase"
                    aria-label={t('Prefix for {kind}', {
                      kind: t(sequence.kind.toLowerCase().replace(/_/g, ' ')),
                    })}
                  />
                </Field>
                <Button type="submit" variant="secondary" size="sm">
                  {t('Save')}
                </Button>
              </form>
            ))}
            <p className="text-[12px] leading-relaxed text-(--text-faint)">
              {t(
                'Numbers already issued keep the prefix they were issued with. A new prefix applies from the next document.',
              )}
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
