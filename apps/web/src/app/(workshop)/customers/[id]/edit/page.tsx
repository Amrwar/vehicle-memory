import { msg } from '@carnet/core';
import { Alert, Button, Card, CardBody, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { CustomerFields } from '@/components/customer-fields';
import { CustomerError, updateCustomer } from '@/lib/customers';
import { can, requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('Correct a customer') };
}
export const dynamic = 'force-dynamic';

/**
 * Correcting a customer.
 *
 * The plainest thing a workshop does, and it was the one thing missing: a
 * customer could be taken down and never corrected. A number written down
 * wrong on the telephone stayed wrong, a person who moved house kept their old
 * address on every invoice, and the only way round it was a second record for
 * the same person — which is how a customer's history ends up in two halves,
 * neither of which is their history.
 *
 * The same fields as the page that took them down, because they are the same
 * customer. Consent is shown as it stands and is changed here like anything
 * else; the trail of who changed it and when is written by the database and
 * read on their own page.
 */

async function save(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');
  const customerId = String(formData.get('customerId') ?? '');

  const details = {
    kind: (String(formData.get('kind') ?? 'INDIVIDUAL') === 'COMPANY'
      ? 'COMPANY'
      : 'INDIVIDUAL') as 'COMPANY' | 'INDIVIDUAL',
    firstName: String(formData.get('firstName') ?? ''),
    lastName: String(formData.get('lastName') ?? ''),
    companyName: String(formData.get('companyName') ?? ''),
    taxNumber: String(formData.get('taxNumber') ?? ''),
    email: String(formData.get('email') ?? ''),
    mobile: String(formData.get('mobile') ?? ''),
    phone: String(formData.get('phone') ?? ''),
    addressLine1: String(formData.get('addressLine1') ?? ''),
    addressLine2: String(formData.get('addressLine2') ?? ''),
    locality: String(formData.get('locality') ?? ''),
    region: String(formData.get('region') ?? ''),
    postcode: String(formData.get('postcode') ?? ''),
    sourceOfBusiness: String(formData.get('sourceOfBusiness') ?? ''),
    notes: String(formData.get('notes') ?? ''),
    // Left exactly as they are. Consent belongs to the customer and is
    // changed where a reason is recorded against it, so this form does not
    // offer it and does not send it.
    marketingEmailConsent: false,
    marketingSmsConsent: false,
  };

  try {
    await updateCustomer({ orgId, userId: user.userId, customerId, details });
  } catch (error) {
    if (!(error instanceof CustomerError)) throw error;

    // Back to the form with what they typed still in it. Losing an address
    // somebody has just read out because a field was refused is the reason
    // people stop correcting records at all.
    const params = new URLSearchParams({ problem: error.message });
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === 'string' && value.trim()) params.set(key, value);
    }
    redirect(`/customers/${customerId}/edit?${params.toString()}`);
  }

  redirect(`/customers/${customerId}?saved=details`);
}

export default async function EditCustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const { db, user } = await requireSession('customer:read');
  const t = await tFor();
  const typed = await searchParams;

  const customer = await db.customer.findFirst({
    where: { id },
    select: {
      id: true,
      kind: true,
      displayName: true,
      firstName: true,
      lastName: true,
      companyName: true,
      taxNumber: true,
      email: true,
      mobile: true,
      phone: true,
      addressLine1: true,
      addressLine2: true,
      locality: true,
      region: true,
      postcode: true,
      sourceOfBusiness: true,
      notes: true,
      marketingEmailConsent: true,
      marketingSmsConsent: true,
    },
  });

  if (!customer) notFound();

  if (!can(user.role, 'customer:write')) {
    redirect(
      `/customers/${customer.id}?problem=${encodeURIComponent(msg('You cannot change a customer.'))}`,
    );
  }

  // What they typed wins over what is stored, so a refusal does not throw
  // away the correction it refused.
  const held = (key: keyof typeof customer, fallback: string | null) =>
    typed[key as string] ?? fallback ?? '';

  const values: Record<string, string | undefined> = {
    kind: typed.kind ?? customer.kind,
    firstName: held('firstName', customer.firstName),
    lastName: held('lastName', customer.lastName),
    companyName: held('companyName', customer.companyName),
    taxNumber: held('taxNumber', customer.taxNumber),
    email: held('email', customer.email),
    mobile: held('mobile', customer.mobile),
    phone: held('phone', customer.phone),
    addressLine1: held('addressLine1', customer.addressLine1),
    addressLine2: held('addressLine2', customer.addressLine2),
    locality: held('locality', customer.locality),
    region: held('region', customer.region),
    postcode: held('postcode', customer.postcode),
    sourceOfBusiness: held('sourceOfBusiness', customer.sourceOfBusiness),
    notes: held('notes', customer.notes),
  };

  return (
    <>
      <BackLink href={`/customers/${customer.id}`}>{customer.displayName}</BackLink>
      <PageHeader
        eyebrow={t('Customers')}
        title={t('Correct their details')}
        description={t('The same record, not a second one. Their history stays with them.')}
      />

      {typed.problem ? (
        <Alert tone="danger" className="mb-5">
          {t(typed.problem)}
        </Alert>
      ) : null}

      <form action={save} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <input type="hidden" name="customerId" value={customer.id} />
        <CustomerFields
          values={values}
          consent={{
            email: customer.marketingEmailConsent,
            sms: customer.marketingSmsConsent,
          }}
          showConsent={false}
        >
          <Card>
            <CardBody className="grid gap-2 text-[13px] leading-relaxed text-(--text-soft)">
              <p className="font-medium text-(--text)">
                {customer.marketingEmailConsent
                  ? t('They have agreed to marketing emails.')
                  : t('They have not agreed to marketing emails.')}
              </p>
              <p>
                {t(
                  'Consent is theirs to give and is changed where a reason is recorded against it, not on this form. It is not asked for here so that nobody can put somebody back on a list by correcting their postcode.',
                )}
              </p>
            </CardBody>
          </Card>

          <Button type="submit" variant="primary" size="lg" block>
            {t('Save the corrections')}
          </Button>

          <Link href={`/customers/${customer.id}`} className="block">
            <Button variant="ghost" block>
              {t('Leave it as it was')}
            </Button>
          </Link>
        </CustomerFields>
      </form>
    </>
  );
}
