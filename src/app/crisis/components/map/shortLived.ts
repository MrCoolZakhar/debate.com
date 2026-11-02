'use client';
// Gavelling Crisis map: something shown for a few seconds only. The map's "last change" line and the note that the team
// changed the unsent map disappear on their own, so they never sit there after they were useful. A new value (a new
// object, not an equal one) shows again for the same time. Nothing here writes anything.

import { useEffect, useState } from 'react';

/** How long a change note stays on screen. */
export const NOTE_MS = 3000;

/** `value` while it is fresh (for `ms` after it was set), then null until a different value arrives. */
export function useShortLived<T>(value: T | null, ms = NOTE_MS): T | null {
  const [expired, setExpired] = useState<T | null>(null);
  useEffect(() => {
    if (value === null) return;
    const t = window.setTimeout(() => setExpired(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return value !== null && value !== expired ? value : null;
}
