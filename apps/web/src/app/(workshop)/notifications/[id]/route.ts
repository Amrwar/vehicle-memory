import { NextResponse } from 'next/server';

import { requireSession } from '@/lib/guard';
import { openNotification } from '@/lib/search';

/**
 * Opens one notification: marks it read and goes to what it is about.
 * Phase 39. Only the person's own; anybody else's is the list.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { orgId, user } = await requireSession();
  const { id } = await params;
  const href = await openNotification(orgId, user.userId, id);
  return NextResponse.redirect(new URL(href ?? '/notifications', request.url), { status: 303 });
}
