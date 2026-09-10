import { Alert, Button, Card, CardBody, CardHeader, Field, Input, PageHeader } from '@carnet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { BackLink } from '@/components/back-link';
import { requireSession } from '@/lib/guard';
import { createSupplier, SupplierError } from '@/lib/suppliers';

export const metadata: Metadata = { title: 'Add a supplier' };
export const dynamic = 'force-dynamic';

/**
 * Adding a supplier. FR-2802.
 *
 * The suppliers list has linked here since Phase 2 and the page did not exist,
 * so the only way a supplier reached the database was the seed.
 *
 * One required field. Everything else about a supplier can be discovered on
 * the first order, and a form that demands an address and a payment reference
 * before it will accept a name is a form somebody abandons and goes back to
 * writing on a pad.
 */
async function create(formData: FormData) {
  'use server';

  const { orgId, user } = await requireSession('inventory:write');

  const name = String(formData.get('name') ?? '').trim();

  if (!name) {
    redirect('/suppliers/new?error=' + encodeURIComponent('A supplier needs a name.'));
  }

  let id = '';

  try {
    id = await createSupplier({
      orgId,
      userId: user.userId,
      name,
      accountRef: String(formData.get('accountRef') ?? ''),
      email: String(formData.get('email') ?? ''),
      phone: String(formData.get('phone') ?? ''),
      addressLine1: String(formData.get('addressLine1') ?? ''),
      locality: String(formData.get('locality') ?? ''),
      postcode: String(formData.get('postcode') ?? ''),
      paymentTermsDays: Number(formData.get('paymentTermsDays') ?? 30) || 30,
    });
  } catch (error) {
    if (error instanceof SupplierError) {
      redirect(`/suppliers/new?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }

  redirect(`/suppliers/${id}`);
}

export default async function NewSupplierPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireSession('inventory:write');
  const { error } = await searchParams;

  return (
    <>
      <div className="mb-3">
        <BackLink href="/suppliers">All suppliers</BackLink>
      </div>

      <PageHeader
        eyebrow="Suppliers"
        title="Add a supplier"
        description="A name is enough to start. The rest can wait for the first order."
      />

      {error ? (
        <Alert tone="danger" className="mb-5" title="Not added">
          {error}
        </Alert>
      ) : null}

      <Card className="max-w-2xl">
        <CardHeader title="Who they are" />
        <CardBody>
          <form action={create} className="grid gap-4">
            <Field label="Name" htmlFor="name" required>
              <Input id="name" name="name" required autoFocus placeholder="Euro Car Parts" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Your account with them"
                htmlFor="accountRef"
                hint="Goes on every order."
              >
                <Input id="accountRef" name="accountRef" />
              </Field>

              <Field
                label="Days to pay"
                htmlFor="paymentTermsDays"
                hint="Drives when a bill shows as overdue."
              >
                <Input
                  id="paymentTermsDays"
                  name="paymentTermsDays"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  defaultValue={30}
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Email" htmlFor="email">
                <Input id="email" name="email" type="email" autoComplete="off" />
              </Field>

              <Field label="Phone" htmlFor="phone">
                <Input id="phone" name="phone" autoComplete="off" />
              </Field>
            </div>

            <Field label="Address" htmlFor="addressLine1">
              <Input id="addressLine1" name="addressLine1" />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Town" htmlFor="locality">
                <Input id="locality" name="locality" />
              </Field>

              <Field label="Postcode" htmlFor="postcode">
                <Input id="postcode" name="postcode" />
              </Field>
            </div>

            <div>
              <Button type="submit" variant="primary">
                Add the supplier
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </>
  );
}
