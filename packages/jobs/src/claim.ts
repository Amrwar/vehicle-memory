import { prisma } from '@carnet/db';

/**
 * Taking work off a queue so that only one worker has it. Phase 46.
 *
 * Both sweeps in this package used to read what was due and then start
 * working on it, which is fine exactly as long as there is one worker. There
 * is not. Locally a process polls every few seconds; in production a schedule
 * fires a request every minute; during a deploy both the old instance and the
 * new one are briefly alive. Two of them reading "what is due" a millisecond
 * apart both see the same row, and the customer gets the same email twice.
 *
 * The header of the outbox said each worker "claims what it is working on
 * before it works on it". It did not, and the comment was the reason nobody
 * looked. This is the claim it was describing.
 *
 * A claim is a lease rather than a lock: the row is pushed into the future by
 * a few minutes, so a worker that dies holding it does not hold it for ever —
 * the work comes back by itself once the lease runs out. SKIP LOCKED is what
 * makes two workers share a queue instead of queueing behind each other: the
 * second one steps over the rows the first has taken rather than waiting for
 * them.
 *
 * One clock throughout. Everything that writes an availableAt writes the
 * application's time, so asking the database for its own `now()` compares two
 * clocks that are only approximately the same — and a database a second or
 * two behind quietly refuses to hand out work that is due. It looks exactly
 * like an empty queue, which is the worst way for a queue to fail.
 */

/** How long a worker has to finish something before it comes back. */
export const LEASE_MINUTES = 5;

/**
 * Claims up to `take` due rows and returns their ids.
 *
 * The update and the select are one statement, which is the whole point: any
 * gap between deciding what to take and taking it is a gap another worker can
 * arrive in.
 */
export async function claimOutbox(
  take: number,
  leaseMinutes = LEASE_MINUTES,
  now = new Date(),
): Promise<string[]> {
  const until = new Date(now.getTime() + leaseMinutes * 60_000);

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "outbox_events"
    SET "availableAt" = ${until},
        "attempts" = "attempts" + 1
    WHERE "id" IN (
      SELECT "id" FROM "outbox_events"
      WHERE "processedAt" IS NULL AND "availableAt" <= ${now}
      ORDER BY "createdAt" ASC
      LIMIT ${take}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"
  `;

  return rows.map((row) => row.id);
}

/**
 * The same for messages waiting to go out.
 *
 * Counted at the claim rather than at the failure, deliberately. A message
 * whose provider call kills the process would otherwise be tried for ever by
 * whoever restarted it, and each attempt would be another chance at sending
 * the thing twice. Counting here means a message that keeps taking a worker
 * down with it runs out of attempts like anything else.
 */
export async function claimMessages(
  take: number,
  leaseMinutes = LEASE_MINUTES,
  now = new Date(),
): Promise<string[]> {
  const until = new Date(now.getTime() + leaseMinutes * 60_000);

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "message_logs"
    SET "availableAt" = ${until}
    WHERE "id" IN (
      SELECT "id" FROM "message_logs"
      WHERE "status" = 'QUEUED' AND "availableAt" <= ${now}
      ORDER BY "availableAt" ASC
      LIMIT ${take}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id"
  `;

  return rows.map((row) => row.id);
}
