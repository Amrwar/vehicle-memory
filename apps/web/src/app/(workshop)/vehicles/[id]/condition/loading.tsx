import { msg } from '@carnet/core';

import { LoadingCar } from '@/components/loading-car';

/**
 * The condition page reads five sets of records and derives from all of them,
 * so it is the one most likely to be waited on. It says what it is doing.
 */
export default function Loading() {
  return <LoadingCar label={msg('Working out the condition of this vehicle')} />;
}
