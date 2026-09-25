import { LoadingCar } from '@/components/loading-car';
import { tFor } from '@/lib/i18n';

/**
 * Shown while one of the customer's own pages is still fetching.
 *
 * This used to be `portal/loading.tsx`, one boundary over the whole customer
 * side. That put a Suspense boundary above every page in it, including the
 * three that have to be able to say a record is not there -- and a boundary
 * flushes the response, so the 200 had gone before the lookup ran. A car that
 * was not yours answered 200. Phase 73.
 *
 * So the boundary is drawn per route instead, in the routes that have nothing
 * to decide, and the three detail pages hold their own response until they
 * know whether there is anything to show. Every page that had a loading
 * screen still has this one.
 */
export default async function PortalLoading() {
  const t = await tFor();
  return <LoadingCar label={t('Getting your records')} />;
}
