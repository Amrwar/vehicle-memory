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
  Textarea,
} from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { createCustomer, CustomerError, possibleDuplicate } from '@/lib/customers';
import { requireSession } from '@/lib/guard';
import { checkCode, LoyaltyError, redeemCode } from '@/lib/referrals';

export const metadata: Metadata = { title: 'New customer' };
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

  const kind = params.kind === 'COMPANY' ? 'COMPANY' : 'INDIVIDUAL';
  const duplicate = params.code === 'DUPLICATE';

  // The record they are about to duplicate, so the warning can offer the way
  // out rather than only the obstacle.
  const match = duplicate
    ? await possibleDuplicate(orgId, { email: params.email, mobile: params.mobile })
    : null;

  return (
    <>
      <BackLink href="/customers">All customers</BackLink>

      <PageHeader
        eyebrow="Customers"
        title="New customer"
        description="A name and one way to reach them is enough. The rest can wait."
      />

      {params.problem ? (
        <Alert tone={duplicate ? 'warning' : 'danger'} className="mb-5">
          {params.problem}
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
              <Button variant="primary">Open them instead</Button>
            </Link>
          </CardBody>
        </Card>
      ) : null}

      <form action={save} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader title="Who they are" description="What goes on the invoice" />
            <CardBody className="grid gap-4">
              <Field label="Kind" hint="Changes which name is asked for">
                <Select name="kind" defaultValue={kind}>
                  <option value="INDIVIDUAL">A person</option>
                  <option value="COMPANY">A company</option>
                </Select>
              </Field>

              {/* Both sets are rendered and the unused one is ignored on save.
                  A form that needed JavaScript to show the right fields would
                  be a form that does nothing on the counter tablet when the
                  connection drops, which is when it is most needed. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="First name" hint="For a person">
                  <Input
                    name="firstName"
                    defaultValue={params.firstName ?? ''}
                    autoComplete="given-name"
                    placeholder="Maria"
                  />
                </Field>
                <Field label="Last name" hint="For a person">
                  <Input
                    name="lastName"
                    defaultValue={params.lastName ?? ''}
                    autoComplete="family-name"
                    placeholder="Okafor"
                  />
                </Field>
              </div>

              <Field label="Company name" hint="For a company or a fleet">
                <Input
                  name="companyName"
                  defaultValue={params.companyName ?? ''}
                  autoComplete="organization"
                  placeholder="Northgate Logistics Ltd"
                />
              </Field>

              <Field label="VAT number" hint="Optional. Goes on their invoices.">
                <Input
                  name="taxNumber"
                  defaultValue={params.taxNumber ?? ''}
                  placeholder="GB123456789"
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Where they are"
              description="Optional, and worth having before the first invoice"
            />
            <CardBody className="grid gap-4">
              <Field label="Address">
                <Input
                  name="addressLine1"
                  defaultValue={params.addressLine1 ?? ''}
                  autoComplete="address-line1"
                  placeholder="14 Hillside Road"
                />
              </Field>
              <Field label="Address, continued">
                <Input
                  name="addressLine2"
                  defaultValue={params.addressLine2 ?? ''}
                  autoComplete="address-line2"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Town">
                  <Input
                    name="locality"
                    defaultValue={params.locality ?? ''}
                    autoComplete="address-level2"
                    placeholder="Stockport"
                  />
                </Field>
                <Field label="County">
                  <Input
                    name="region"
                    defaultValue={params.region ?? ''}
                    autoComplete="address-level1"
                  />
                </Field>
                <Field label="Postcode">
                  <Input
                    name="postcode"
                    defaultValue={params.postcode ?? ''}
                    autoComplete="postal-code"
                    className="uppercase"
                    placeholder="SK4 2HL"
                  />
                </Field>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid content-start gap-5">
          <Card>
            <CardHeader
              title="How to reach them"
              description="At least one. Everything the workshop sends goes here."
            />
            <CardBody className="grid gap-4">
              <Field label="Email" hint="Quotes, invoices and the portal link">
                <Input
                  name="email"
                  type="email"
                  inputMode="email"
                  defaultValue={params.email ?? ''}
                  autoComplete="email"
                  placeholder="maria@example.com"
                />
              </Field>

              <Field label="Mobile" hint="Texts about the car">
                <Input
                  name="mobile"
                  type="tel"
                  inputMode="tel"
                  defaultValue={params.mobile ?? ''}
                  autoComplete="tel"
                  placeholder="07700 900123"
                />
              </Field>

              <Field label="Other telephone" hint="Landline or work number">
                <Input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  defaultValue={params.phone ?? ''}
                  placeholder="0161 496 0114"
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Marketing"
              description="Separate from anything about their own car"
            />
            <CardBody className="grid gap-3 text-[13px] leading-relaxed">
              {/* Off unless somebody ticks it, and never inferred from the fact
                  that an address was typed in. Reminders about their own
                  vehicle are not marketing and are never gated on this. */}
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="marketingEmailConsent"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--brand-solid)"
                />
                <span>They agreed to marketing emails</span>
              </label>
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  name="marketingSmsConsent"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-(--brand-solid)"
                />
                <span>They agreed to marketing texts</span>
              </label>
              <p className="text-(--text-faint)">
                Service reminders and messages about a job in progress are not marketing and go out
                either way.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Anything else" />
            <CardBody className="grid gap-4">
              <Field label="How they found you" hint="Optional">
                <Input
                  name="sourceOfBusiness"
                  defaultValue={params.sourceOfBusiness ?? ''}
                  placeholder="Recommended by a neighbour"
                />
              </Field>
              <Field
                label="Arrived with a code"
                hint="Optional. Another customer's referral code; both sides are paid once this one has had work done"
              >
                <Input
                  name="referralCode"
                  defaultValue={params.referralCode ?? ''}
                  maxLength={8}
                  autoCapitalize="characters"
                  className="datum uppercase tracking-[0.15em]"
                  placeholder="XXXXXX"
                />
              </Field>
              <Field label="Notes" hint="Anything whoever serves them next should know">
                <Textarea name="notes" rows={3} defaultValue={params.notes ?? ''} />
              </Field>
            </CardBody>
          </Card>

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
                    Add them anyway. I have checked, and this really is a different person.
                  </span>
                </label>
              </CardBody>
            </Card>
          ) : null}

          <Button type="submit" variant="primary" size="lg" block>
            Add the customer
          </Button>
        </div>
      </form>
    </>
  );
}
