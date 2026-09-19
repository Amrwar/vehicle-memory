import { LoadingCar } from '@/components/loading-car';
import { tFor } from '@/lib/i18n';

/**
 * Shown while any of the customer's own pages is still fetching.
 *
 * The workshop side has had one of these since the loading boundary was first
 * drawn; the customer's side had none, so twelve pages showed a blank screen
 * on mobile data outside a garage. That is exactly the place where a blank
 * screen reads as a broken link.
 */
export default async function Loading() {
  const t = await tFor();
  return <LoadingCar label={t('Getting your records')} />;
}
