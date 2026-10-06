// ============================================================
// src/lib/pendingRollCall.ts
// Offline resilience: roll-call writes that have not landed yet (4 Oct 2026).
//
// A chair's status tap (absent / present / present-voting), a bulk roll call (Clear All,
// All Present, All P+V) and an observer placard are now parked like the other idempotent
// session writes (writeStatus.ts). This module is the ledger of what this device has
// pressed and not yet saved, per committee code and delegate row:
//   - `claimRollCall` records the newest value per (row, field) with a sequence number; a
//     newer press supersedes an older one (the older write sees it no longer owns the row
//     and ends 'skipped' without sending anything);
//   - `overlayPendingRollCall` lays the pending values over a fetched delegates array, so a
//     delegates refetch can never show the old value while the write waits;
//   - the ledger is kept in localStorage (one key per tab), so a reload while offline shows
//     the pressed values and re-issues them (`attachPendingRollCall`). A tab adopts its own
//     key at once (sessionStorage keeps the tab id over a reload) and another tab's key once
//     that tab has gone (it zeroes its heartbeat on pagehide; a crashed tab stops beating).
// Writes from a DELEGATE's own phone (no chair suffix) never come here: they are not parked.
// With OFFLINE_RESILIENCE off every function is a no-op (claim returns 0, owns is true,
// overlay returns its input), i.e. the behaviour before.
// ============================================================

import type { DelegateStatus } from './types';
import { OFFLINE_RESILIENCE } from './offlineResilience';

export type RollCallField = 'status' | 'observer';
type Value = DelegateStatus | boolean;
interface Entry { value: Value; seq: number; at: number }
interface RowEntries { status?: Entry; observer?: Entry }

export interface PendingRollCallItem { delegateId: string; field: RollCallField; value: Value; at: number }

const STORE_PREFIX = 'gavelling-pending-roll-call:';
const HEARTBEAT_MS = 4000;
/** Another tab's key is adopted once its heartbeat is this old (or zero: it said goodbye). */
const STALE_OWNER_MS = 15_000;
/** A pressed value older than this is not re-issued after a reload: the room has moved on. */
const MAX_AGE_MS = 3 * 60 * 60 * 1000;

const registry = new Map<string, Map<string, RowEntries>>();   // CODE -> delegateId -> entries
let seqCounter = 0;

const norm = (code: string) => (code || '').toUpperCase();

let tabIdCache: string | null = null;
function tabId(): string {
  if (tabIdCache) return tabIdCache;
  let id: string | null = null;
  try { id = sessionStorage.getItem('gavelling-tab-id'); } catch { /* storage blocked */ }
  if (!id) {
    id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    try { sessionStorage.setItem('gavelling-tab-id', id); } catch { /* storage blocked */ }
  }
  tabIdCache = id;
  return id;
}

const storeKey = (code: string, tab = tabId()) => `${STORE_PREFIX}${code}:${tab}`;

type Stored = { v: 1; beat: number; items: Record<string, { s?: [DelegateStatus, number]; o?: [boolean, number] }> };

function persist(code: string, beat = Date.now()) {
  if (typeof window === 'undefined') return;
  const rows = registry.get(code);
  try {
    if (!rows || rows.size === 0) { localStorage.removeItem(storeKey(code)); return; }
    const items: Stored['items'] = {};
    rows.forEach((e, id) => {
      const it: Stored['items'][string] = {};
      if (e.status) it.s = [e.status.value as DelegateStatus, e.status.at];
      if (e.observer) it.o = [e.observer.value as boolean, e.observer.at];
      items[id] = it;
    });
    localStorage.setItem(storeKey(code), JSON.stringify({ v: 1, beat, items } satisfies Stored));
  } catch { /* storage full or blocked: the in-memory ledger still holds */ }
}

// ── Heartbeat: only while something is pending ──
let beatTimer: ReturnType<typeof setInterval> | null = null;
let pagehideInstalled = false;
function syncHeartbeat() {
  if (typeof window === 'undefined') return;
  let any = false;
  registry.forEach((rows) => { if (rows.size > 0) any = true; });
  if (any && !beatTimer) {
    beatTimer = setInterval(() => registry.forEach((rows, code) => { if (rows.size > 0) persist(code); }), HEARTBEAT_MS);
  } else if (!any && beatTimer) {
    clearInterval(beatTimer);
    beatTimer = null;
  }
  if (any && !pagehideInstalled) {
    pagehideInstalled = true;
    // Say goodbye: another open tab may take the presses over at once.
    window.addEventListener('pagehide', () => registry.forEach((rows, code) => { if (rows.size > 0) persist(code, 0); }));
    // Restored from the bfcache: still here.
    window.addEventListener('pageshow', (e) => { if (e.persisted) registry.forEach((rows, code) => { if (rows.size > 0) persist(code); }); });
  }
}

/** Record a press. Returns its sequence number (0 with the switch off). */
export function claimRollCall(code: string, delegateId: string, field: RollCallField, value: Value, at = Date.now()): number {
  if (!OFFLINE_RESILIENCE) return 0;
  const c = norm(code);
  let rows = registry.get(c);
  if (!rows) { rows = new Map(); registry.set(c, rows); }
  const e = rows.get(delegateId) ?? {};
  const seq = ++seqCounter;
  e[field] = { value, seq, at };
  rows.set(delegateId, e);
  persist(c);
  syncHeartbeat();
  return seq;
}

/** Is this press still the newest for its row and field? Always true with the switch off. */
export function ownsRollCall(code: string, delegateId: string, field: RollCallField, seq: number): boolean {
  if (!OFFLINE_RESILIENCE) return true;
  return registry.get(norm(code))?.get(delegateId)?.[field]?.seq === seq;
}

/** The press landed, or was refused: forget it (only if it is still the newest one). */
export function settleRollCall(code: string, delegateId: string, field: RollCallField, seq: number): void {
  if (!OFFLINE_RESILIENCE) return;
  const c = norm(code);
  const rows = registry.get(c);
  const e = rows?.get(delegateId);
  if (!rows || !e || e[field]?.seq !== seq) return;
  delete e[field];
  if (!e.status && !e.observer) rows.delete(delegateId);
  persist(c);
  syncHeartbeat();
}

/** What this device pressed for a row and has not saved yet. */
export function pendingRollCallFor(code: string, delegateId: string): { status?: DelegateStatus; observer?: boolean } {
  if (!OFFLINE_RESILIENCE) return {};
  const e = registry.get(norm(code))?.get(delegateId);
  return e ? { status: e.status?.value as DelegateStatus | undefined, observer: e.observer?.value as boolean | undefined } : {};
}

export function hasPendingRollCall(code: string): boolean {
  if (!OFFLINE_RESILIENCE) return false;
  return (registry.get(norm(code))?.size ?? 0) > 0;
}

/** Lay every unsaved press over a delegates array. Returns the SAME array when nothing
 *  changes, so a memo keyed on it keeps its identity. */
export function overlayPendingRollCall<T extends { id: string; status: DelegateStatus; isObserver?: boolean }>(code: string, delegates: T[]): T[] {
  if (!OFFLINE_RESILIENCE) return delegates;
  const rows = registry.get(norm(code));
  if (!rows || rows.size === 0) return delegates;
  let changed = false;
  const out = delegates.map((d) => {
    const e = rows.get(d.id);
    if (!e) return d;
    const status = e.status ? (e.status.value as DelegateStatus) : d.status;
    const isObserver = e.observer ? (e.observer.value as boolean) : d.isObserver;
    if (status === d.status && isObserver === d.isObserver) return d;
    changed = true;
    return { ...d, status, isObserver };
  });
  return changed ? out : delegates;
}

// ── Adoption after a reload, or from a tab that has gone ──
type Attached = { reissue: (items: PendingRollCallItem[]) => void; onAdopted?: () => void };
const attached = new Map<string, Attached>();
let adoptListenersInstalled = false;

function readStored(key: string): Stored | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    return parsed && parsed.v === 1 && parsed.items ? parsed : null;
  } catch { return null; }
}

/** Take over the unsaved presses this browser left for `code`: this tab's own key (a reload)
 *  and any other tab's key whose tab has gone. Newer presses win per row and field. */
function adopt(code: string): PendingRollCallItem[] {
  if (typeof window === 'undefined') return [];
  const me = tabId();
  const now = Date.now();
  const keys: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(`${STORE_PREFIX}${code}:`)) keys.push(k);
    }
  } catch { return []; }
  const items: PendingRollCallItem[] = [];
  for (const k of keys) {
    const mine = k === storeKey(code, me);
    const stored = readStored(k);
    if (!stored) { if (!mine) { try { localStorage.removeItem(k); } catch { /* ignore */ } } continue; }
    if (!mine && now - stored.beat < STALE_OWNER_MS && stored.beat !== 0) continue;   // that tab is alive
    if (!mine) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
    const rows = registry.get(code);
    for (const [id, it] of Object.entries(stored.items)) {
      const pairs: [RollCallField, Value, number][] = [];
      if (it.s) pairs.push(['status', it.s[0], it.s[1]]);
      if (it.o) pairs.push(['observer', it.o[0], it.o[1]]);
      for (const [field, value, at] of pairs) {
        if (!(now - at < MAX_AGE_MS)) continue;
        const cur = rows?.get(id)?.[field];
        if (cur && cur.at >= at) continue;   // this tab already pressed something newer (or is sending it)
        if (cur && mine) continue;           // our own key: the in-memory entry IS this one
        items.push({ delegateId: id, field, value, at });
      }
    }
  }
  return items;
}

function tryAdopt(code: string) {
  const a = attached.get(code);
  if (!a) return;
  const items = adopt(code);
  // Nothing to take over: write nothing. A write here changes the stored beat, which fires a
  // storage event in every other tab, which would adopt and write back: an endless ping-pong.
  // The 4 s heartbeat keeps this tab's key fresh.
  if (items.length === 0) return;
  a.reissue(items);   // claims them anew (claimRollCall), which persists under this tab
  a.onAdopted?.();
}

/**
 * A chair page (chair or voting) for `code` is open on this tab: adopt and re-issue what
 * this browser left unsaved, now and whenever another tab goes away or the connection comes
 * back. `reissue` must write each item through the ordinary parkable writers (they claim it
 * again). `onAdopted` lets the page lay the values over its roster. Returns a detach function.
 */
export function attachPendingRollCall(code: string, reissue: Attached['reissue'], onAdopted?: () => void): () => void {
  if (!OFFLINE_RESILIENCE || typeof window === 'undefined' || !code) return () => {};
  const c = norm(code);
  const entry: Attached = { reissue, onAdopted };
  attached.set(c, entry);
  if (!adoptListenersInstalled) {
    adoptListenersInstalled = true;
    window.addEventListener('storage', (e) => {
      if (!e.key || !e.key.startsWith(STORE_PREFIX)) return;
      attached.forEach((_a, cc) => { if (e.key!.startsWith(`${STORE_PREFIX}${cc}:`)) tryAdopt(cc); });
    });
    window.addEventListener('online', () => attached.forEach((_a, cc) => tryAdopt(cc)));
  }
  tryAdopt(c);
  return () => { if (attached.get(c) === entry) attached.delete(c); };
}
