import { EmptyState } from '@carnet/ui';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { EstimateReview } from '@/components/estimate-review';
import { PortalShell } from '@/components/portal-shell';
import { decisionPreview, DecisionError, estimateByToken, recordDecision } from '@/lib/portal';

export const metadata: Metadata = { title: 'Your quote' };
export const dynamic = 'force-dynamic';

/**
 * A quote reached by the link the workshop sent. FR-802.
 *
 * No account, no password, no app. Most people will meet Carnet here and
 * nowhere else, and asking them to register before they can answer a question
 * their garage asked them is how a quote goes unanswered for four days.
 *
 * The link is a capability: a random token whose digest alone is stored, with
 * an expiry and a revocation date. Nothing about the URL identifies the
 * customer, so a forwarded link grants exactly what the workshop chose to
 * grant and no more.
 *
 * A dead link gets a page saying the link is dead. Not a 404, which reads as a
 * broken system, and not an error, which reads as the customer's fault.
 */
async function answer(formData: FormData) {
  'use server';

  const token = String(formData.get('token') ?? '');
  const estimate = await estimateByToken(token);

  if (!estimate) redirect(`/e/${token}`);

  const headerList = await headers();

  try {
    await recordDecision({
      estimateId: estimate.id,
      approvedLineIds: formData.getAll('line').map(String),
      approvedByName: String(formData.get('approvedByName') ?? '').trim(),
      note: String(formData.get('note') ?? '').trim(),
      ip: headerList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
      userAgent: headerList.get('user-agent'),
    });
  } catch (error) {
    if (error instanceof DecisionError) {
      redirect(`/e/${token}?error=${encodeURIComponent(error.message)}`);
    }

    throw error;
  }

  redirect(`/e/${token}?answered=1`);
}

export default async function SharedEstimatePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string; answered?: string }>;
}) {
  const { token } = await params;
  const { error, answered } = await searchParams;

  const estimate = await estimateByToken(token);

  if (!estimate) {
    return (
      <PortalShell signedIn={false}>
        <EmptyState
          title="This link is no longer live"
          description="Quote links expire, and a workshop can withdraw one at any time. Ask them to send it again and it will work straight away."
        />
      </PortalShell>
    );
  }

  const preview = decisionPreview(estimate);

  return (
    <PortalShell signedIn={false}>
      {answered ? (
        <p className="mb-4 rounded-(--radius-sm) bg-(--success-soft) px-3.5 py-2.5 text-[13px] text-(--success)">
          Thank you. Your workshop has your answer and will get on with it.
        </p>
      ) : null}

      <EstimateReview
        estimate={estimate}
        preview={preview}
        action={answer}
        hiddenFields={{ token }}
        error={error}
      />
    </PortalShell>
  );
}
