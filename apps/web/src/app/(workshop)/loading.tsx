import { LoadingCar } from '@/components/loading-car';

/**
 * Shown while any workshop page is still fetching.
 *
 * One file covers the whole route group: every page under it that waits on the
 * database gets the same thing rather than each needing its own. Where a page
 * is slow enough to deserve a different message, it can add its own
 * `loading.tsx` beside it.
 */
export default function Loading() {
  return <LoadingCar label="Getting this from the workshop" />;
}
