'use client';
// Gavelling Crisis: the one source every meeting clock reads.
//
// 1. ONE ticking source. A single shared interval (started by the first clock on screen, stopped with the last) publishes
//    the DATABASE's "now" (serverNow, src/lib/serverClock.ts). Every clock on every card derives its seconds from that same
//    value plus the row's started_at / paused_at / paused_seconds / ended_at, so two cards, two devices and a re-read always
//    agree. There is no local counter: a clock never adds a second to a number of its own.
// 2. NO SNAP BACK after a press. Start, Pause, Resume, Stop and Reset lay an optimistic copy of the clock fields over the
//    row (stamped with the database clock). The copy is kept until the re-read brings the server's own answer (the row's clock
//    fields change) or six seconds pass, then it goes quietly. Nothing is written per second.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { serverNow, subscribeServerClock } from '@/lib/serverClock';
import type { MeetingClockAction } from './meetings';
import type { Meeting } from './types';

const TICK_MS = 250;

let tickValue = typeof window === 'undefined' ? 0 : serverNow();
const tickListeners = new Set<() => void>();
let timer: number | null = null;
let offUnsub: (() => void) | null = null;

function publish() {
  tickValue = serverNow();
  tickListeners.forEach((f) => f());
}

function subscribeTick(cb: () => void): () => void {
  tickListeners.add(cb);
  if (timer === null) {
    tickValue = serverNow();
    timer = window.setInterval(publish, TICK_MS);
    // A corrected offset moves everyone at once, from the same source.
    offUnsub = subscribeServerClock(() => { publish(); });
  }
  return () => {
    tickListeners.delete(cb);
    if (tickListeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
      offUnsub?.();
      offUnsub = null;
    }
  };
}

const noopSubscribe = () => () => {};

/** The database's "now" in epoch ms, refreshed four times a second while `active`. Inactive clocks do not tick. */
export function useMeetingNow(active: boolean): number {
  return useSyncExternalStore(
    active ? subscribeTick : noopSubscribe,
    () => (active ? tickValue : 0),
    () => 0,
  ) || serverNow();
}

// ───────── The optimistic copy ─────────

interface Overlay { sig: string; patch: Partial<Meeting> }
const overlays = new Map<string, Overlay>();
const overlayListeners = new Set<() => void>();
let overlayVersion = 0;
const HOLD_MS = 6000;

const sigOf = (m: Pick<Meeting, 'started_at' | 'ended_at' | 'paused_at' | 'paused_seconds' | 'status'>) =>
  [m.started_at, m.ended_at, m.paused_at ?? null, Number(m.paused_seconds ?? 0), m.status].join('|');

function bump() { overlayVersion += 1; overlayListeners.forEach((f) => f()); }

/** What the row will look like once the database has applied `action`, stamped with the database clock. */
function expected(m: Meeting, action: MeetingClockAction, nowMs: number): Partial<Meeting> {
  const now = new Date(nowMs).toISOString();
  const folded = Number(m.paused_seconds ?? 0) + (m.paused_at ? Math.max(0, (nowMs - Date.parse(m.paused_at)) / 1000) : 0);
  switch (action) {
    case 'start': return { started_at: now, ended_at: null, paused_at: null, paused_seconds: 0, status: 'approved' };
    case 'pause': return { paused_at: now };
    case 'resume': return { paused_at: null, paused_seconds: folded };
    case 'stop': return { ended_at: now, paused_at: null, paused_seconds: folded, status: 'held' };
    case 'reset': return { started_at: null, ended_at: null, paused_at: null, paused_seconds: 0 };
  }
}

/**
 * Keep the expected clock on screen until the re-read shows the server's own. Call right after the press succeeded, with
 * `pressedAt` (serverNow() just before the request): the database stamped the action about half a round trip after it.
 */
export function holdClockAction(m: Meeting, action: MeetingClockAction, pressedAt: number): void {
  const nowMs = serverNow();
  const stamp = pressedAt + Math.max(0, (nowMs - pressedAt) / 2);
  // A second press while a copy is held keeps the first copy's key: the server's row is what ends it.
  const sig = overlays.get(m.id)?.sig ?? sigOf(m);
  overlays.set(m.id, { sig, patch: expected(m, action, stamp) });
  bump();
  window.setTimeout(() => { if (overlays.delete(m.id)) bump(); }, HOLD_MS);
}

function subscribeOverlay(cb: () => void): () => void {
  overlayListeners.add(cb);
  return () => { overlayListeners.delete(cb); };
}

/** The meetings with any held optimistic clock laid over them. A row the server has since changed shows as the server has it. */
export function useClockOverlay(list: Meeting[] | null): Meeting[] | null {
  const version = useSyncExternalStore(subscribeOverlay, () => overlayVersion, () => 0);
  useEffect(() => {
    if (!list) return;
    // Forget the copies the server has answered.
    let changed = false;
    for (const m of list) {
      const o = overlays.get(m.id);
      if (o && o.sig !== sigOf(m)) { overlays.delete(m.id); changed = true; }
    }
    if (changed) bump();
  }, [list]);
  return useMemo(() => {
    void version;
    if (!list || overlays.size === 0) return list;
    return list.map((m) => {
      const o = overlays.get(m.id);
      return o && o.sig === sigOf(m) ? { ...m, ...o.patch } : m;
    });
  }, [list, version]);
}
