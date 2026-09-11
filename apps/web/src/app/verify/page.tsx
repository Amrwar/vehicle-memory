import { Button, Card, CardBody, Field, Input } from '@carnet/ui';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Check a vehicle',
  description:
    'Enter the code on a Carnet vehicle report to read the history it refers to, and see whether it has been altered.',
};

/**
 * Where a buyer arrives. FR-3204.
 *
 * Somebody is standing in a stranger's driveway with a phone and a piece of
 * paper. They have no account, they will not make one, and they have about
 * three minutes before it becomes awkward.
 *
 * So: one field, no sign-up, and a page that says what it can and cannot tell
 * them before they type anything. The code is the same capability token the
 * seller's share produces, which means there is one mechanism to reason about
 * rather than two, and revoking the share revokes the check.
 */
async function check(formData: FormData) {
  'use server';

  const code = String(formData.get('code') ?? '')
    .trim()
    // People retype these from paper. Spaces and the dashes they add to keep
    // their place should not be the reason a real code is refused.
    .replace(/[\s]/g, '');

  if (!code) redirect('/verify?error=1');

  redirect(`/p/${encodeURIComponent(code)}`);
}

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-12">
      <p className="text-[12px] font-medium tracking-wide text-(--brand-text) uppercase">Carnet</p>
      <h1 className="font-display mt-1 text-[26px] leading-tight font-semibold text-balance">
        Check a vehicle&rsquo;s history
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-(--text-soft)">
        If a seller has given you a Carnet code, enter it here. You will see what workshops recorded
        about the vehicle, and whether any of it has been altered since it was written.
      </p>

      <Card className="mt-6">
        <form action={check}>
          <CardBody className="grid gap-4">
            <Field
              label="Code from the report"
              hint="Spaces do not matter."
              error={error ? 'Enter the code the seller gave you.' : undefined}
            >
              <Input name="code" required autoFocus autoComplete="off" spellCheck={false} />
            </Field>

            <Button type="submit" variant="primary">
              Check this vehicle
            </Button>
          </CardBody>
        </form>
      </Card>

      <div className="mt-6 grid gap-2 text-[13px] leading-relaxed text-(--text-faint)">
        <p>
          <strong className="font-semibold text-(--text-soft)">What you will see.</strong> Services,
          repairs and inspections recorded by workshops using Carnet, the mileage at each, how many
          owners the vehicle has had and for how long, and anything outstanding on it.
        </p>
        <p>
          <strong className="font-semibold text-(--text-soft)">What you will not see.</strong>{' '}
          Nothing about any owner, past or present. Not their name, not where they live, not what
          they chose to spend.
        </p>
        <p>
          <strong className="font-semibold text-(--text-soft)">What it cannot tell you.</strong>{' '}
          Work done outside Carnet does not appear. An empty record is not proof a car was
          neglected, and a full one is not a substitute for an inspection before you buy.
        </p>
      </div>
    </main>
  );
}
