import { Prisma } from '@carnet/db';

/**
 * Telling "somebody already did this" apart from "this failed". Phase 46.
 *
 * A write that is guarded by a unique index fails on the second attempt, and
 * that failure is the guard working. The trouble is that it arrives looking
 * exactly like every other database error, and the tempting fix — a try/catch
 * that shrugs at anything — turns the guard into a way of silently losing
 * writes that failed for real reasons.
 *
 * So the question is asked precisely: was this the unique constraint, and if
 * so, which one? A caller that expects a repeat to land on a particular index
 * can say so, and an unexpected clash on some other index still throws, which
 * is right, because it means something the caller has not thought about.
 */

/** Postgres's "that already exists", as Prisma reports it. */
const UNIQUE = 'P2002';

export function isAlreadyDone(error: unknown, index?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== UNIQUE) return false;
  if (!index) return true;

  return namesOf(error).some((named) => named.includes(index));
}

/**
 * Everywhere a constraint's name can be hiding.
 *
 * Prisma reports the fields in `meta.target` when it modelled the index
 * itself, and hands back the driver's own error when it did not — which is
 * the case for every partial unique index in this product, and partial
 * indexes are most of the guards here. Reading only one of the two is how a
 * guard appears to work in a unit test and throws in production.
 */
function namesOf(error: Prisma.PrismaClientKnownRequestError): string[] {
  const names: string[] = [];
  const target = error.meta?.target;

  if (Array.isArray(target)) names.push(target.join(','));
  else if (target) names.push(String(target));

  const adapter = (
    error.meta as
      | {
          driverAdapterError?: {
            cause?: {
              constraint?: { index?: string; fields?: string[] };
              originalMessage?: string;
            };
          };
        }
      | undefined
  )?.driverAdapterError?.cause;

  if (adapter?.constraint?.index) names.push(adapter.constraint.index);
  if (adapter?.constraint?.fields) names.push(adapter.constraint.fields.join(','));
  if (adapter?.originalMessage) names.push(adapter.originalMessage);

  return names;
}

/**
 * Runs something, and treats the guard firing as success rather than failure.
 *
 * For writes whose second attempt should be quietly absorbed: awarding the
 * same points, recording the same webhook, queueing the same message. Where
 * the second attempt should instead be refused out loud — a person pressing
 * "take the payment" twice deserves to be told the first one worked — catch
 * it at the caller and say so.
 */
export async function onlyOnce<T>(
  index: string,
  run: () => Promise<T>,
): Promise<{ done: boolean; result?: T }> {
  try {
    return { done: true, result: await run() };
  } catch (error) {
    if (isAlreadyDone(error, index)) return { done: false };
    throw error;
  }
}
