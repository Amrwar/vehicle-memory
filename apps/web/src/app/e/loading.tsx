import { LoadingCar } from '@/components/loading-car';
import { tFor } from '@/lib/i18n';

/**
 * Shown while a quote sent to a customer is being read.
 */
export default async function Loading() {
  const t = await tFor();
  return <LoadingCar label={t('Opening your quote')} />;
}
