'use client';

// useLiveRefresh: a quiet re-read for organiser screens whose data changes
// without a Realtime event (owner, 21 Oct 2026). conference_allocations is not
// in Supabase Realtime, so when a delegation's leader allocates, unallocates or
// swaps inside their delegation (delegation_place_member,
// delegation_unplace_member, perform_delegation_swap) the organiser's screens
// read again:
//   * every 10 s while the tab is visible (paused while hidden);
//   * when the window gains focus or the tab becomes visible again.
// The caller's refresh swaps data in place: never a loader or a skeleton, and
// it must keep what is on screen when a read fails. A tick is skipped while
// `paused()` says a local write, a drag or a confirm is open, and while the
// previous refresh is still running, so an optimistic change is never
// overwritten by a read that started before it. The refresh gets its client at
// call time (getFreshAuthedClient, CLAUDE.md "Auth clients").

import { useEffect, useRef } from 'react';

export const LIVE_REFRESH_MS = 10_000;
/** Focus and visibility often fire together: one read for both. */
const WAKE_GAP_MS = 2_000;

export function useLiveRefresh(
  refresh: () => Promise<unknown> | unknown,
  opts: { enabled?: boolean; paused?: () => boolean; intervalMs?: number } = {},
) {
  const { enabled = true, intervalMs = LIVE_REFRESH_MS } = opts;
  const refreshRef = useRef(refresh);
  const pausedRef = useRef(opts.paused);
  useEffect(() => {
    refreshRef.current = refresh;
    pausedRef.current = opts.paused;
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let running = false;
    let lastRun = 0;
    let stopped = false;

    const tick = async (wake: boolean) => {
      if (stopped || running) return;
      if (document.visibilityState !== 'visible') return;
      if (pausedRef.current?.()) return;
      const now = Date.now();
      if (wake && now - lastRun < WAKE_GAP_MS) return;
      running = true;
      lastRun = now;
      try {
        await refreshRef.current();
      } catch {
        /* a quiet read keeps what is on screen; the next tick tries again */
      } finally {
        running = false;
      }
    };

    const timer = window.setInterval(() => { void tick(false); }, intervalMs);
    const onFocus = () => { void tick(true); };
    const onVisible = () => { if (document.visibilityState === 'visible') void tick(true); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, intervalMs]);
}

/** The same value when nothing changed, so a quiet re-read re-renders nothing. */
export function keepIfSame<T>(prev: T, next: T): T {
  if (prev === next) return prev;
  try {
    return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
  } catch {
    return next;
  }
}
