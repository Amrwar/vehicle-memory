import { LoadingCar } from '@/components/loading-car';
import { tFor } from '@/lib/i18n';

/**
 * Shown on the technician's own device while a page is still fetching.
 */
export default async function Loading() {
  const t = await tFor();
  return <LoadingCar label={t('Getting this from the workshop')} />;
}
