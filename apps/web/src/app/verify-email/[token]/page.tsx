import { Card, CardBody } from '@carnet/ui';
import type { Metadata } from 'next';
import Link from 'next/link';

import { redeemVerification, TokenError } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Confirming your address',
  robots: { index: false, follow: false },
};

/**
 * Proving the address. FR-3903.
 *
 * Redeemed on load rather than behind a button, because there is nothing to
 * decide: somebody opening this link is already doing the only thing it is
 * for. That does mean a mail scanner following the link confirms the address
 * on the owner's behalf, which is an acceptable trade here and would not be
 * for a password reset, where the same shortcut would spend the link before
 * the person saw it.
 */
export default async function VerifyEmailPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let address: string | null = null;
  let problem: string | null = null;

  try {
    address = await redeemVerification(token);
  } catch (error) {
    problem = error instanceof TokenError ? error.message : 'That link could not be read.';
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-12">
      <p className="text-[12px] font-medium tracking-wide text-(--brand-text) uppercase">Carnet</p>

      {address ? (
        <>
          <h1 className="font-display text-[24px] leading-tight font-semibold">
            That is confirmed.
          </h1>

          <Card>
            <CardBody className="text-[15px] leading-relaxed">
              <span className="datum">{address}</span> is now a proven address on your account.
            </CardBody>
          </Card>

          <p className="text-[14px] leading-relaxed text-(--text-soft)">
            Two things change. What you send to customers is less likely to be treated as spam, and
            when a message to one of them bounces we can tell you rather than leaving you to find
            out from the customer.
          </p>

          <Link
            href="/dashboard"
            className="text-[14px] font-medium text-(--brand-text) hover:underline"
          >
            Back to the workshop
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-[24px] leading-tight font-semibold">
            That link did not work
          </h1>

          <Card className="border-(--warning)">
            <CardBody className="text-[15px] leading-relaxed text-(--warning)">{problem}</CardBody>
          </Card>

          <p className="text-[14px] leading-relaxed text-(--text-soft)">
            Nothing is wrong with your account and you can still sign in. Ask for another link from
            the banner on the dashboard.
          </p>

          <Link
            href="/dashboard"
            className="text-[14px] font-medium text-(--brand-text) hover:underline"
          >
            Back to the workshop
          </Link>
        </>
      )}
    </main>
  );
}
