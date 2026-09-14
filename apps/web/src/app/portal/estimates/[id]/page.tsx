import { Alert } from '@carnet/ui';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { EstimateReview } from '@/components/estimate-review';
import { PortalShell } from '@/components/portal-shell';
import { requireUser } from '@/lib/guard';
import { decisionPreview, DecisionError, estimateForCustomer, recordDecision } from '@/lib/portal';
import { regionForUser } from '@/lib/region';

export const metadata: Metadata = { title: 'Your quote' };
export const dynamic = 'force-dynamic';

/**
 * A quote, for the customer it was written for. FR-802, FR-2301.
 *
 * Reached from the portal by somebody signed in. The same screen is reachable
 * without an account through the link the workshop sent, and both hand the
 * answer to the same service function, because a decision made by tapping a
 * link in a text has to carry exactly the same weight as one made here.
 */
async function answer(formData: FormData) {
  'use server';

  const user = await requireUser();
  const estimateId = String(formData.get('estimateId') ?? '');
  const headerList = await headers();

  try {
    await recordDecision({
      estimateId,
      approvedLineIds: formData.getAll('line').map(String),
      approvedByName: String(formData.get('approvedByName') ?? '').trim(),
      note: String(formData.get('note') ?? '').trim(),
      ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: headerList.get('user-agent'),
      userId: user.userId,
    });
  } catch (error) {
    if (error instanceof DecisionError) {
      redirect(`/portal/estimates/${estimateId}?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }

  redirect('/portal?answered=1');
}

export default async function PortalEstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const region = await regionForUser(user.userId);
  const { id } = await params;
  const { error } = await searchParams;

  const estimate = await estimateForCustomer(user.userId, id);

  // Not "forbidden": a customer who has followed a stale link should meet a
  // page that does not exist, not one that confirms somebody else's quote does.
  if (!estimate) notFound();

  const preview = decisionPreview(estimate);

  return (
    <PortalShell>
      <EstimateReview
        locale={region.locale}
        estimate={estimate}
        preview={preview}
        action={answer}
        hiddenFields={{ estimateId: estimate.id }}
        error={error}
      />

      {preview.blockedReason ? (
        <Alert tone="info" className="mt-4">
          Your workshop can send a fresh quote whenever you are ready.
        </Alert>
      ) : null}
    </PortalShell>
  );
}
