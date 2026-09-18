// ============================================================
// src/lib/serverClock.ts
// One clock for every device: the database's.
//
// Every session clock is an ANCHOR (a start timestamp plus a duration) that each device
// turns into "time left" with its own wall clock. That is only correct if every device
// agrees on what "now" is, and phones and laptops routinely do not: production scoring
// logs show devices 11 s, 40 s and almost 10 hours off (audit T-1). A laptop 40 s fast
// that stamps a speaker's `started_at` takes 40 s off every phone; a phone 60 s fast
// shows a caucus at 0:00 while debate continues.
//
// So each device measures its offset against `server_now()` (a one-line SQL function)
// once on load and again whenever it comes back online or the tab becomes visible, and
// every place that STAMPS or READS an anchor uses `serverNow()` instead of `Date.now()`.
//
//   offset = serverTime + rtt / 2 - receivedAt
//
// The best of up to three samples (lowest round trip) is kept, so one slow first request
// on a cold connection cannot skew it. Until the first measurement lands the offset is 0,
// which is exactly the old behaviour.
// ============================================================

import { supabase } from './supabase';

let offsetMs = 0;
let measured = false;
let inFlight: Promise<void> | null = null;
let installed = false;
const listeners = new Set<(offsetMs: number) => void>();

/** Milliseconds this device's clock is BEHIND the database (negative when it is ahead). */
export function serverClockOffsetMs(): number {
  return offsetMs;
}

/** True once at least one measurement has succeeded. */
export function serverClockMeasured(): boolean {
  return measured;
}

/** The database's "now", in epoch ms, as seen from this device. Use this, never Date.now(),
 *  wherever the value is compared with or written as a session timestamp. */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

/** `serverNow()` as an ISO string, for stamping anchors (`started_at`, `totalStartedAt`,
 *  `suspended_at`, `ended_at`, `expires_at`). */
export function serverNowIso(): string {
  return new Date(serverNow()).toISOString();
}

/** Subscribe to offset changes. Fires immediately with the current value. */
export function subscribeServerClock(fn: (offsetMs: number) => void): () => void {
  listeners.add(fn);
  fn(offsetMs);
  return () => { listeners.delete(fn); };
}

async function sampleOnce(): Promise<{ offset: number; rtt: number } | null> {
  const sentAt = Date.now();
  const { data, error } = await supabase.rpc('server_now');
  const receivedAt = Date.now();
  if (error || typeof data !== 'string') return null;
  const serverMs = new Date(data).getTime();
  if (!Number.isFinite(serverMs)) return null;
  const rtt = Math.max(0, receivedAt - sentAt);
  return { offset: serverMs + rtt / 2 - receivedAt, rtt };
}

/** Measure (or re-measure) the offset. Concurrent callers share one measurement. Never
 *  throws; a failed measurement keeps the previous offset. */
export function syncServerClock(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      let best: { offset: number; rtt: number } | null = null;
      for (let i = 0; i < 3; i++) {
        const s = await sampleOnce();
        if (s && (!best || s.rtt < best.rtt)) best = s;
        // A tight round trip is as good as it gets; stop early.
        if (best && best.rtt < 150) break;
      }
      // A round trip longer than 10 s says more about the network than the clock.
      if (best && best.rtt < 10_000) {
        const next = Math.round(best.offset);
        const changed = !measured || Math.abs(next - offsetMs) >= 250;
        offsetMs = next;
        measured = true;
        if (changed) listeners.forEach((fn) => { try { fn(offsetMs); } catch { /* listener bug must not break the clock */ } });
      }
    } catch {
      /* keep the previous offset */
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Install the load / online / visibility triggers once per page. Safe to call often. */
export function ensureServerClock(): void {
  if (typeof window === 'undefined' || installed) return;
  installed = true;
  void syncServerClock();
  window.addEventListener('online', () => { void syncServerClock(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncServerClock();
  });
}

// Every page that imports a session clock helper gets the measurement for free.
ensureServerClock();
