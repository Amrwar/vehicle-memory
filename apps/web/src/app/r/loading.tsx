import { LoadingCar } from '@/components/loading-car';
import { tFor } from '@/lib/i18n';

/**
 * Shown while the page that asks a customer what they thought is loading.
 */
export default async function Loading() {
  const t = await tFor();
  return <LoadingCar label={t('One moment')} />;
}
