import { Alert, Button, Card, CardBody, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { CustomerFields } from '@/components/customer-fields';
import { createCustomer, CustomerError, possibleDuplicate } from '@/lib/customers';
import { requireSession } from '@/lib/guard';
import { tFor } from '@/lib/i18n';
import { checkCode, LoyaltyError, redeemCode } from '@/lib/referrals';

export async function generateMetadata(): Promise<Metadata> {
  const t = await tFor();
  return { title: t('New customer') };
}
export const dynamic = 'force-dynamic';

/**
 * Taking down a new customer.
 *
 * Usually filled in with somebody on the telephone, so the order is the order
 * they say things: who they are, then how to reach them, then where they are
 * if it comes up. Only the first two are required, because a form that demands
 * a postcode while a caller waits gets a made-up postcode.
 *
 * The one thing it insists on is a way to reach them. A record with no address
 * and no number cannot be sent a quote, told the car is ready, or invoiced,
 * which means it is a note rather than a customer.
 */

async function save(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('customer:write');

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
    marketingEmailConsent: formData.get('marketingEmailConsent') === 'on',
    marketingSmsConsent: formData.get('marketingSmsConsent') === 'on',
  };

  // A code they arrived with is checked before the record exists, so a
  // mistyped code does not leave a customer half taken down.
  const referralCode = String(formData.get('referralCode') ?? '').trim();

  const back = (problem: string, code?: string) => {
    const params = new URLSearchParams({ problem });
    if (code) params.set('code', code);
    for (const [key, value] of Object.entries(details)) {
      if (typeof value === 'string' && value.trim()) params.set(key, value);
    }
    if (referralCode) params.set('referralCode', referralCode);
    redirect(`/customers/new?${params.toString()}`);
  };

  if (referralCode) {
    try {
      await checkCode(orgId, referralCode);
    } catch (error) {
      if (!(error instanceof LoyaltyError)) throw error;
      back(error.message);
    }
  }

  let id: string;

  try {
    id = await createCustomer({
      orgId,
      userId: user.userId,
      details,
      // The second submission carries the acknowledgement, so a shared
      // telephone number warns once and then gets out of the way.
      allowDuplicate: formData.get('allowDuplicate') === 'on',
    });
  } catch (error) {
    if (!(error instanceof CustomerError)) throw error;
    back(error.message, error.code);
    throw error;
  }

  if (referralCode) {
    try {
      await redeemCode({ orgId, userId: user.userId, customerId: id, code: referralCode });
    } catch (error) {
      if (!(error instanceof LoyaltyError)) throw error;
      // The customer exists; the code did not take. Say so on their page
      // rather than losing the record over it.
      redirect(`/customers/${id}?problem=${encodeURIComponent(error.message)}`);
    }
    redirect(`/customers/${id}?saved=referral`);
  }

  redirect(`/customers/${id}`);
}

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { orgId } = await requireSession('customer:write');
  const params = await searchParams;
  const t = await tFor();

  const duplicate = params.code === 'DUPLICATE';

  // The record they are about to duplicate, so the warning can offer the way
  // out rather than only the obstacle.
  const match = duplicate
    ? await possibleDuplicate(orgId, { email: params.email, mobile: params.mobile })
    : null;

  return (
    <>
      <BackLink href="/customers">{t('All customers')}</BackLink>

      <PageHeader
        eyebrow={t('Customers')}
        title={t('New customer')}
        description={t('A name and one way to reach them is enough. The rest can wait.')}
      />

      {params.problem ? (
        <Alert tone={duplicate ? 'warning' : 'danger'} className="mb-5">
          {t(params.problem)}
        </Alert>
      ) : null}

      {match ? (
        <Card className="mb-5">
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-display text-[15px] font-semibold">{match.displayName}</p>
              <p className="datum text-[13px] text-(--text-soft)">
                {match.email ?? match.mobile ?? ''}
              </p>
            </div>
            <Link href={`/customers/${match.id}`}>
              <Button variant="primary">{t('Open them instead')}</Button>
            </Link>
          </CardBody>
        </Card>
      ) : null}

      <form action={save} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <CustomerFields values={params} consent={{ email: false, sms: false }} showReferral>
          {duplicate ? (
            <Card className="border-(--warning)">
              <CardBody>
                <label className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                  <input
                    type="checkbox"
                    name="allowDuplicate"
                    className="mt-0.5 h-4 w-4 shrink-0 accent-(--warning)"
                  />
                  <span>
                    {t('Add them anyway. I have checked, and this really is a different person.')}
                  </span>
                </label>
              </CardBody>
            </Card>
          ) : null}

          <Button type="submit" variant="primary" size="lg" block>
            {t('Add the customer')}
          </Button>
        </CustomerFields>
      </form>
    </>
  );
}
