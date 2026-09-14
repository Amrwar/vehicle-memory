import { MIN_PASSWORD_LENGTH } from '@carnet/core';
import { Alert, Button, Card, CardBody, CardHeader, Field, Input } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PortalShell } from '@/components/portal-shell';
import { requireUser } from '@/lib/guard';
import {
  AccountError,
  accountOverview,
  changePassword,
  setConsent,
  updateProfile,
} from '@/lib/portal-account';

export const metadata: Metadata = { title: 'Account' };
export const dynamic = 'force-dynamic';

/**
 * The customer's account page. Phase 32.7.
 *
 * Who they are, how they sign in, what each workshop may send them, and
 * the door out. The things a customer asked for when they said "where are
 * the settings": one place, nothing hidden behind a vehicle.
 */
function problem(error: unknown, back: string): never {
  if (error instanceof AccountError) {
    redirect(`${back}?problem=${encodeURIComponent(error.message)}`);
  }
  throw error;
}

async function saveProfile(formData: FormData) {
  'use server';

  const user = await requireUser();
  try {
    await updateProfile({
      userId: user.userId,
      name: String(formData.get('name') ?? ''),
      phone: String(formData.get('phone') ?? ''),
    });
  } catch (error) {
    problem(error, '/portal/settings');
  }
  redirect('/portal/settings?saved=details');
}

async function savePassword(formData: FormData) {
  'use server';

  const user = await requireUser();
  try {
    await changePassword({
      userId: user.userId,
      current: String(formData.get('current') ?? ''),
      next: String(formData.get('next') ?? ''),
    });
  } catch (error) {
    problem(error, '/portal/settings');
  }
  redirect('/portal/settings?saved=password');
}

async function saveConsent(formData: FormData) {
  'use server';

  const user = await requireUser();
  const customerId = String(formData.get('customerId') ?? '');
  try {
    await setConsent({
      userId: user.userId,
      customerId,
      channel: 'EMAIL',
      granted: formData.get('email') === 'on',
    });
    await setConsent({
      userId: user.userId,
      customerId,
      channel: 'SMS',
      granted: formData.get('sms') === 'on',
    });
  } catch (error) {
    problem(error, '/portal/settings');
  }
  redirect('/portal/settings?saved=consent');
}

export default async function PortalSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; problem?: string }>;
}) {
  const user = await requireUser();
  const { saved, problem: failed } = await searchParams;
  const account = await accountOverview(user.userId);

  return (
    <PortalShell active="settings">
      <h1 className="font-display text-[24px] font-semibold leading-tight">Account</h1>
      <p className="mt-1 text-[14px] text-(--text-soft)">
        Your details, how you sign in, and what each workshop may send you.
      </p>

      {saved === 'details' ? (
        <Alert tone="success" className="mt-4">
          Saved. The workshops you use see the new details too.
        </Alert>
      ) : null}
      {saved === 'password' ? (
        <Alert tone="success" className="mt-4">
          Password changed.
        </Alert>
      ) : null}
      {saved === 'consent' ? (
        <Alert tone="success" className="mt-4">
          Saved, and recorded with the date, so nobody has to take your word for it.
        </Alert>
      ) : null}
      {failed ? (
        <Alert tone="danger" className="mt-4">
          {failed}
        </Alert>
      ) : null}

      <div className="mt-6 grid gap-5">
        <Card>
          <CardHeader
            title="Your details"
            description="Your email is how you sign in and where receipts and updates go."
          />
          <CardBody>
            <form action={saveProfile} className="grid gap-4">
              <Field label="Name">
                <Input name="name" defaultValue={account.name} required autoComplete="name" />
              </Field>
              <Field
                label="Email"
                hint={
                  account.emailVerifiedAt
                    ? 'Confirmed. To change it, get in touch with a workshop you use.'
                    : 'Not confirmed yet. Check your inbox for the link.'
                }
              >
                <Input value={account.email} readOnly />
              </Field>
              <Field
                label="Mobile"
                hint="For text messages about your car, if you allow them below"
              >
                <Input
                  name="phone"
                  defaultValue={account.phone ?? ''}
                  autoComplete="tel"
                  inputMode="tel"
                />
              </Field>
              <div>
                <Button type="submit" variant="primary">
                  Save details
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Password"
            description={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          />
          <CardBody>
            <form action={savePassword} className="grid gap-4">
              <Field label="Current password">
                <Input name="current" type="password" required autoComplete="current-password" />
              </Field>
              <Field label="New password">
                <Input
                  name="next"
                  type="password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </Field>
              <div>
                <Button type="submit" variant="secondary">
                  Change password
                </Button>
              </div>
            </form>
            <p className="mt-3 text-[12px] text-(--text-faint)">
              Forgotten it?{' '}
              <Link href="/forgot" className="underline">
                Reset it by email
              </Link>
              .
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="What each workshop may send you"
            description="Messages about your own car and its bookings always come. This is about offers and reminders beyond that."
          />
          <CardBody className="grid gap-4">
            {account.customers.length === 0 ? (
              <p className="text-[13px] text-(--text-soft)">
                No workshop knows you yet. Once one does, its preferences appear here.
              </p>
            ) : (
              account.customers.map((customer) => (
                <form
                  key={customer.id}
                  action={saveConsent}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-(--radius-md) border border-(--border) px-3.5 py-3"
                >
                  <input type="hidden" name="customerId" value={customer.id} />
                  <p className="text-[14px] font-medium">{customer.org.name}</p>
                  <div className="flex flex-wrap items-center gap-4 text-[13px]">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="email"
                        defaultChecked={customer.marketingEmailConsent}
                        className="h-4 w-4 accent-(--brand)"
                      />
                      Email offers and reminders
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="sms"
                        defaultChecked={customer.marketingSmsConsent}
                        className="h-4 w-4 accent-(--brand)"
                      />
                      Text messages
                    </label>
                    <Button type="submit" size="sm" variant="secondary">
                      Save
                    </Button>
                  </div>
                </form>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Money and rewards" />
          <CardBody className="flex flex-wrap gap-2">
            <Link href="/portal/invoices">
              <Button variant="secondary">Invoices and payments</Button>
            </Link>
            <Link href="/portal/rewards">
              <Button variant="secondary">Points and referral code</Button>
            </Link>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Sign out"
            description="On a shared phone or a garage's computer, sign out when you are done."
          />
          <CardBody>
            <form action="/api/sign-out" method="post">
              <Button type="submit" variant="secondary">
                Sign out
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </PortalShell>
  );
}
