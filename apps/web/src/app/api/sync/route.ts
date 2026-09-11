import { describeSync } from '@carnet/core';
import { NextResponse } from 'next/server';

import { currentUser } from '@/lib/auth';
import { briefcaseFor, flush, readActions } from '@/lib/sync';

export const dynamic = 'force-dynamic';

/**
 * Where a technician's device empties its pockets. FR-3501.
 *
 * One endpoint doing two things, because a device coming back into signal
 * wants both in the same breath: here is what I did while I was away, and
 * give me everything I need to carry on without you.
 *
 * Authenticated like every other route. A queue that accepted work on the
 * strength of an id in the body would be a write API with no door on it, and
 * the ids in question are job ids that appear in ordinary URLs.
 */
export async function POST(request: Request) {
  const user = await currentUser();

  if (!user?.orgId) {
    // 401 rather than a redirect. The caller is a script in a service worker
    // with no way to follow one, and a redirect here would be parsed as a
    // successful response containing a login page.
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'That was not readable.' }, { status: 400 });
  }

  const actions = readActions(body);

  const summary = await flush({ orgId: user.orgId, userId: user.userId, actions });

  // Every action comes back with its outcome, including the refusals. A
  // response carrying only successes would leave the device unable to tell
  // what it still holds, and the only safe thing for it to do then is send
  // everything again.
  return NextResponse.json({
    ...summary,
    message: describeSync(summary),
    briefcase: await briefcaseFor(user.orgId, user.userId),
  });
}

/**
 * Everything this technician needs to work with no signal.
 *
 * Deliberately narrow. Their own open jobs, the vehicles, and the inspection
 * they would be working through. Nothing about money and nothing about any
 * customer's address: a device that leaves the building holds only what the
 * person carrying it needs to do the work.
 */
export async function GET() {
  const user = await currentUser();

  if (!user?.orgId) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  return NextResponse.json(await briefcaseFor(user.orgId, user.userId));
}
