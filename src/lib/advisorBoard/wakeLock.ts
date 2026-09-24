'use client';

// "Keep screen awake" for an advisor walking corridors with the board open. The Screen
// Wake Lock API releases the lock whenever the tab is hidden, so it is re-acquired when
// the page becomes visible again. Unsupported browsers get no toggle at all.

import { useEffect, useState, useSyncExternalStore } from 'react';

interface WakeLockSentinelLike { released: boolean; release: () => Promise<void>; addEventListener: (t: 'release', fn: () => void) => void }
interface WakeLockLike { request: (type: 'screen') => Promise<WakeLockSentinelLike> }

function wakeLockApi(): WakeLockLike | null {
  if (typeof navigator === 'undefined') return null;
  return (navigator as unknown as { wakeLock?: WakeLockLike }).wakeLock ?? null;
}

const noop = () => () => {};

/** Whether the browser supports it (false on the server, so the toggle never flashes). */
export function useWakeLockSupported(): boolean {
  return useSyncExternalStore(noop, () => !!wakeLockApi(), () => false);
}

/** Holds a screen wake lock while `on` is true and the page is visible. */
export function useWakeLock(on: boolean): boolean {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    const api = wakeLockApi();
    if (!on || !api) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return;
      try {
        const s = await api.request('screen');
        if (cancelled) { void s.release(); return; }
        sentinel = s;
        setHeld(true);
        s.addEventListener('release', () => { if (!cancelled) setHeld(false); });
      } catch {
        setHeld(false);   // refused (battery saver, not visible): the toggle stays, nothing breaks
      }
    };
    const onVis = () => { if (document.visibilityState === 'visible') void acquire(); };
    const first = window.setTimeout(() => { void acquire(); }, 0);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearTimeout(first);
      document.removeEventListener('visibilitychange', onVis);
      if (sentinel && !sentinel.released) void sentinel.release();
      setHeld(false);
    };
  }, [on]);
  return held && on;
}
