'use client';
// Gavelling Crisis: the press releases waiting for the crisis staff, read ONCE per tab and shared by every screen that shows them
// (the live queue and bottom cards in ApprovalQueue.tsx, and the Press Releases card on the News page). One read every 30 s (jittered)
// while the tab is visible and somebody is watching, plus a read when the tab comes back. Deciding a release removes it from every
// screen at once, then re-reads. Press releases live outside the crisis tables, so there is no live ping: the poll is the only feed.

import { useCallback, useSyncExternalStore } from 'react';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { fetchReleasesBoard, reviewPressRelease, type PendingRelease, type ReleasesBoard } from '@/lib/press';

const POLL_MS = 30_000;
const KEEP_DECIDED = 5;
const jitter = (ms: number) => Math.round(ms * (0.85 + Math.random() * 0.3));

export type PressState = 'loading' | 'ok' | 'missing' | 'denied' | 'error';
export interface Decided { id: string; label: string; message: string; approved: boolean; at: string }
export interface PressSnap { state: PressState; board: ReleasesBoard | null; decided: Decided[] }

interface Entry { snap: PressSnap; subs: Set<() => void>; timer: number | null; seq: number; onVisible: (() => void) | null; busy: Set<string> }

const entries = new Map<string, Entry>();
const LOADING: PressSnap = { state: 'loading', board: null, decided: [] };

function entryFor(conferenceId: string): Entry {
  let e = entries.get(conferenceId);
  if (!e) { e = { snap: LOADING, subs: new Set(), timer: null, seq: 0, onVisible: null, busy: new Set() }; entries.set(conferenceId, e); }
  return e;
}

function emit(e: Entry, snap: PressSnap) {
  e.snap = snap;
  e.subs.forEach((f) => f());
}

export async function refreshPressQueue(conferenceId: string): Promise<void> {
  const e = entryFor(conferenceId);
  const mine = ++e.seq;
  const r = await fetchReleasesBoard(conferenceId);
  if (mine !== e.seq) return;
  if (r.kind === 'ok') emit(e, { ...e.snap, state: 'ok', board: r.value });
  else if (e.snap.state !== 'ok') emit(e, { ...e.snap, state: r.kind });
}

function schedule(conferenceId: string, e: Entry) {
  e.timer = window.setTimeout(() => {
    if (document.visibilityState === 'visible') void refreshPressQueue(conferenceId);
    if (e.subs.size > 0) schedule(conferenceId, e);
  }, jitter(POLL_MS));
}

function subscribe(conferenceId: string, enabled: boolean, f: () => void): () => void {
  if (!enabled || typeof window === 'undefined') return () => {};
  const e = entryFor(conferenceId);
  e.subs.add(f);
  if (e.subs.size === 1) {
    window.setTimeout(() => { void refreshPressQueue(conferenceId); }, 0);
    schedule(conferenceId, e);
    e.onVisible = () => { if (document.visibilityState === 'visible') void refreshPressQueue(conferenceId); };
    document.addEventListener('visibilitychange', e.onVisible);
  }
  return () => {
    e.subs.delete(f);
    if (e.subs.size === 0) {
      if (e.timer !== null) window.clearTimeout(e.timer);
      e.timer = null;
      if (e.onVisible) document.removeEventListener('visibilitychange', e.onVisible);
      e.onVisible = null;
    }
  };
}

/** The shared queue. `enabled` false (not signed in, not staff) reads nothing. */
export function usePressQueue(conferenceId: string, enabled: boolean): PressSnap {
  const sub = useCallback((f: () => void) => subscribe(conferenceId, enabled, f), [conferenceId, enabled]);
  return useSyncExternalStore(sub, () => entryFor(conferenceId).snap, () => LOADING);
}

/** Approve or reject one release, from any screen. The release leaves every list at once; the next read confirms it. Returns true when it was saved. */
export async function decidePressRelease(conferenceId: string, r: PendingRelease, approve: boolean): Promise<boolean> {
  const e = entryFor(conferenceId);
  if (e.busy.has(r.id)) return false;
  e.busy.add(r.id);
  try {
    const res = await reviewPressRelease(r.id, approve);
    if (!res.ok) {
      // Somebody else (the press chair, another director) may have decided it first: the next read shows where it stands.
      notifyErr(res.message, 'crisis-press');
      void refreshPressQueue(conferenceId);
      return false;
    }
    notifyOk(approve ? (res.sentTo === 1 ? 'Sent to 1 committee room' : `Sent to ${res.sentTo} committee rooms`) : 'Press release rejected', 'crisis-press');
    const board = e.snap.board ? { ...e.snap.board, pending: e.snap.board.pending.filter((x) => x.id !== r.id) } : e.snap.board;
    const decided = [{ id: r.id, label: r.authorLabel || 'Press', message: r.message, approved: approve, at: new Date().toISOString() }, ...e.snap.decided].slice(0, KEEP_DECIDED);
    emit(e, { ...e.snap, board, decided });
    void refreshPressQueue(conferenceId);
    return true;
  } finally {
    e.busy.delete(r.id);
  }
}
