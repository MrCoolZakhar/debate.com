'use client';
// Gavelling Crisis: the current time, re-read every so often, so "waiting since" and "being written" stay true on screen.

import { useEffect, useState } from 'react';
import { serverNow } from '@/lib/serverClock';

export function useNow(everyMs = 30_000): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const t = window.setInterval(() => setNow(serverNow()), everyMs);
    return () => window.clearInterval(t);
  }, [everyMs]);
  return now;
}
