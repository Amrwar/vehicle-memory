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
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import {
  organisationSettings,
  setNumberingPrefix,
  SettingsError,
  updateOrganisation,
} from '@/lib/settings';

export const metadata: Metadata = { title: 'Organisation' };
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

export default async function OrganisationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; problem?: string }>;
}) {
  const { orgId } = await requireSession('settings:write');
  const { saved, problem } = await searchParams;
  const org = await organisationSettings(orgId);

  return (
    <>
      <div className="mb-3">
        <BackLink href="/settings">Settings</BackLink>
      </div>

      <PageHeader
        eyebrow="Settings"
        title="Organisation"
        description="What goes on the paperwork, and the two numbers that change how the product behaves"
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

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Details" description="As they appear on invoices and messages" />
          <form action={save}>
            <CardBody className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Trading name">
                  <Input name="name" defaultValue={org.name} required maxLength={120} />
                </Field>
                <Field label="Legal name" hint="If different. Goes on the invoice footer.">
                  <Input name="legalName" defaultValue={org.legalName ?? ''} maxLength={120} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tax number" hint="VAT or equivalent">
                  <Input name="taxNumber" defaultValue={org.taxNumber ?? ''} maxLength={40} />
                </Field>
                <Field label="Website">
                  <Input name="website" defaultValue={org.website ?? ''} maxLength={200} />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Email" hint="Where customers reply">
                  <Input name="email" type="email" defaultValue={org.email ?? ''} maxLength={200} />
                </Field>
                <Field label="Telephone">
                  <Input name="phone" defaultValue={org.phone ?? ''} maxLength={40} />
                </Field>
              </div>
              <Field
                label="Re-approval threshold, %"
                hint="Work that grows past an approved estimate by more than this goes back to the customer before it continues. Zero means every increase does."
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
                <Field label="Country" hint="Where the workshop trades">
                  <Select name="country" defaultValue={org.country}>
                    {COUNTRIES.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label="Currency"
                  hint="The books are kept in one currency. Changing it does not convert what is already recorded."
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
                  label="Language and region"
                  hint="How dates and figures are written, such as en-CA or fr-FR"
                >
                  <Input name="locale" defaultValue={org.locale} maxLength={12} required />
                </Field>
                <Field label="Timezone" hint="Such as America/Toronto">
                  <Input name="timezone" defaultValue={org.timezone} maxLength={64} required />
                </Field>
              </div>
            </CardBody>
            <CardBody className="border-t border-(--border)">
              <Button type="submit" variant="primary">
                Save details
              </Button>
            </CardBody>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Document numbering"
            description="Sequential and gapless. The prefix can change; the counter cannot."
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
                  label={sequence.kind.toLowerCase().replace(/_/g, ' ')}
                  hint={`Next: ${sequence.prefix}${sequence.next}`}
                  className="min-w-0 flex-1"
                >
                  <Input
                    name="prefix"
                    defaultValue={sequence.prefix}
                    maxLength={8}
                    placeholder="INV-"
                    className="font-mono uppercase"
                    aria-label={`Prefix for ${sequence.kind.toLowerCase().replace(/_/g, ' ')}`}
                  />
                </Field>
                <Button type="submit" variant="secondary" size="sm">
                  Save
                </Button>
              </form>
            ))}
            <p className="text-[12px] leading-relaxed text-(--text-faint)">
              Numbers already issued keep the prefix they were issued with. A new prefix applies
              from the next document.
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
