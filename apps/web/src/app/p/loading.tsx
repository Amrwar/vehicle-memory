import { LoadingCar } from '@/components/loading-car';
import { tFor } from '@/lib/i18n';

/**
 * Shown while a shared passport is being read.
 *
 * Somebody who has been sent a link, opening it on a telephone, with no idea
 * what Carnet is. A blank screen here is a link that did not work.
 */
export default async function Loading() {
  const t = await tFor();
  return <LoadingCar label={t('Opening this vehicle’s history')} />;
}
