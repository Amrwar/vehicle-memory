import { LoadingCar } from '@/components/loading-car';
import { tFor } from '@/lib/i18n';

/**
 * Shown while a car being handed over is being read.
 */
export default async function Loading() {
  const t = await tFor();
  return <LoadingCar label={t('Opening this vehicle’s history')} />;
}
