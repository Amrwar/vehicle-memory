import { LoadingCar } from '@/components/loading-car';
import { tFor } from '@/lib/i18n';

/**
 * Shown while the operator's own pages are being read.
 */
export default async function Loading() {
  const t = await tFor();
  return <LoadingCar label={t('One moment')} />;
}
