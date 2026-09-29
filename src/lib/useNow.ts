'use client';

import { useEffect, useState } from 'react';

/** The current time, read once on mount and refreshed every `tickMs`
 *  (a minute by default), so a "released" or "expired" check drawn from it
 *  flips by itself while the page stays open. Replaces Date.now() during
 *  render, which React may call at any moment (react-hooks/purity). */
export function useNow(tickMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}
