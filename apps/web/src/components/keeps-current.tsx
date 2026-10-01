'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Re-reads the page it sits on, every few minutes, while somebody is looking.
 *
 * A screen left open all day is read all day, and a figure that was true at
 * eight is not evidence of anything at eleven. Nobody presses a key to find
 * out; the page asks the server again on its own.
 *
 * Only while visible. A tab behind three others refreshing every five minutes
 * is a database being asked questions nobody will read the answers to — so a
 * hidden tab waits, and catches up the moment it is looked at again if it has
 * been long enough. Phase 98.
 */
export function KeepsCurrent({ everyMinutes = 5 }: { everyMinutes?: number }) {
  const router = useRouter();

  useEffect(() => {
    const every = everyMinutes * 60_000;
    let last = Date.now();

    const again = () => {
      last = Date.now();
      router.refresh();
    };

    const tick = () => {
      if (document.visibilityState === 'visible') again();
    };
    const lookedAt = () => {
      if (document.visibilityState === 'visible' && Date.now() - last >= every) again();
    };

    const interval = setInterval(tick, every);
    document.addEventListener('visibilitychange', lookedAt);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', lookedAt);
    };
  }, [router, everyMinutes]);

  return null;
}
