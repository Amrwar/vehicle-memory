import { prisma } from '@carnet/db';

import { log } from './log';

/**
 * Shifts nobody closed.
 *
 * A tablet left logged in books fourteen hours of labour cost against a job,
 * and the figure looks real until somebody reads the job's profit.
 */

const SHIFT_END_HOUR = Number(process.env.WORKER_SHIFT_END_HOUR ?? 19);

/* ---------------------------------------------------------------------------
   Open time entries
   --------------------------------------------------------------------------- */

export async function closeAbandonedTimeEntries(): Promise<number> {
  const cutoff = new Date();
  cutoff.setHours(SHIFT_END_HOUR, 0, 0, 0);

  if (new Date() < cutoff) return 0;

  const open = await prisma.timeEntry.findMany({
    where: { endedAt: null, startedAt: { lt: cutoff } },
    select: { id: true, startedAt: true },
  });

  for (const entry of open) {
    const minutes = Math.max(
      0,
      Math.round((cutoff.getTime() - entry.startedAt.getTime()) / 60_000),
    );

    // Flagged rather than silently accepted: an auto-closed entry is a guess
    // about how long the work took, and a manager should see that.
    await prisma.timeEntry.update({
      where: { id: entry.id },
      data: { endedAt: cutoff, minutes, autoClosed: true },
    });
  }

  if (open.length > 0) log('timeentries.autoclosed', { count: open.length });
  return open.length;
}
