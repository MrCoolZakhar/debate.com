'use client';

import { useSyncExternalStore, useCallback } from 'react';
import type { ChatMessage } from './types';
import type { ChatConvKey } from './chatConversations';

// ─── Chat outbox ────────────────────────────────────────────────────────────
//
// ChatPanel is conditionally mounted ({showChat && …} on the chair page, {tab === 'chat' && …}
// on the delegate page), so any optimistic state held in its own useState is destroyed the
// moment chat closes or the delegate switches tab. A message still in flight then vanishes
// from the sender's screen with no record that it ever existed (RC4).
//
// The outbox lives at module scope, keyed by committee id, so it survives unmount. It is a
// tiny external store read through useSyncExternalStore.

export type OutboxStatus = 'sending' | 'failed';

export interface OutboxMsg {
  /** Client-generated id. Also the reconcile key — see matchOutboxEcho below. */
  id: string;
  convKey: ChatConvKey;
  sender: string;
  content: string;
  isPrivate: boolean;
  recipient?: string;
  timestamp: Date;
  status: OutboxStatus;
}

const outboxes = new Map<string, OutboxMsg[]>();
const listeners = new Map<string, Set<() => void>>();

// Stable identity for the empty case — useSyncExternalStore requires the snapshot to be
// referentially stable between notifications or React loops forever.
const EMPTY: OutboxMsg[] = [];

function emit(committeeId: string) {
  listeners.get(committeeId)?.forEach((fn) => fn());
}

function setOutbox(committeeId: string, next: OutboxMsg[]) {
  if (next.length === 0) outboxes.delete(committeeId);
  else outboxes.set(committeeId, next);
  emit(committeeId);
}

export function getOutbox(committeeId: string): OutboxMsg[] {
  return outboxes.get(committeeId) ?? EMPTY;
}

export function subscribeOutbox(committeeId: string, fn: () => void): () => void {
  let set = listeners.get(committeeId);
  if (!set) { set = new Set(); listeners.set(committeeId, set); }
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) listeners.delete(committeeId);
  };
}

export function newOutboxId(): string {
  return `out-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function addOutbox(committeeId: string, msg: OutboxMsg) {
  setOutbox(committeeId, [...getOutbox(committeeId), msg]);
}

export function markOutboxFailed(committeeId: string, id: string) {
  const cur = getOutbox(committeeId);
  if (!cur.some((m) => m.id === id)) return;
  setOutbox(committeeId, cur.map((m) => (m.id === id ? { ...m, status: 'failed' as const } : m)));
}

export function markOutboxSending(committeeId: string, id: string) {
  const cur = getOutbox(committeeId);
  if (!cur.some((m) => m.id === id)) return;
  setOutbox(committeeId, cur.map((m) => (m.id === id ? { ...m, status: 'sending' as const } : m)));
}

export function removeOutbox(committeeId: string, id: string) {
  const cur = getOutbox(committeeId);
  if (!cur.some((m) => m.id === id)) return;
  setOutbox(committeeId, cur.filter((m) => m.id !== id));
}

// Ids already accounted for, per committee. Module-level like the outbox itself, so it is NOT
// rebuilt when ChatPanel remounts — a per-mount Set would treat the entire backlog as "new"
// every time chat is reopened, and a months-old identical message would retire a live bubble.
const seenIds = new Map<string, Set<string>>();

/**
 * Ids in `rows` that this committee has never been shown before.
 *
 * The first call for a committee only seeds the set and returns nothing: it happens on page
 * load / first chat mount, strictly before any send can exist, so there is never an outbox
 * entry that a historical row should be allowed to retire.
 */
function takeFreshRows(committeeId: string, rows: ChatMessage[]): ChatMessage[] {
  const existing = seenIds.get(committeeId);
  const set = existing ?? new Set<string>();
  if (!existing) seenIds.set(committeeId, set);
  const fresh: ChatMessage[] = [];
  for (const r of rows) {
    if (set.has(r.id)) continue;
    set.add(r.id);
    if (existing) fresh.push(r);
  }
  return fresh;
}

/**
 * Reconcile arrived server rows against the outbox (RC5).
 *
 * The old reconcile removed EVERY pending entry matching (sender, content, isPrivate,
 * recipient) — so sending "ok" twice quickly meant the first echo cleared both bubbles and
 * the second message looked delivered before it was.
 *
 * Two guards now:
 *  1. only rows whose id is NEW to this committee are considered, so replaying the backlog
 *     (every catch-up fetch hands over the FULL list) can never retire a live bubble;
 *  2. each such row clears AT MOST ONE entry. Two "ok" sends produce two rows and two
 *     echoes, and each echo retires exactly one bubble.
 *
 * A 'sending' entry is preferred; a fresh row falls back to retiring a 'failed' one, which is
 * the write-succeeded-but-response-lost case. An unrelated identical message can no longer
 * mask a failure, because it is never fresh.
 */
export function reconcileOutbox(committeeId: string, rows: ChatMessage[]) {
  if (rows.length === 0) return;
  const fresh = takeFreshRows(committeeId, rows);

  const cur = getOutbox(committeeId);
  if (cur.length === 0 || fresh.length === 0) return;

  const remaining = cur.slice();
  let changed = false;

  for (const row of fresh) {
    const matches = (p: OutboxMsg) =>
      row.sender === p.sender &&
      row.content === p.content &&
      !!row.isPrivate === !!p.isPrivate &&
      (row.recipient ?? undefined) === (p.recipient ?? undefined);

    let idx = remaining.findIndex((p) => p.status === 'sending' && matches(p));
    if (idx === -1) idx = remaining.findIndex((p) => p.status === 'failed' && matches(p));
    if (idx !== -1) { remaining.splice(idx, 1); changed = true; }
  }

  if (changed) setOutbox(committeeId, remaining);
}

/** Live outbox for a committee. */
export function useOutbox(committeeId: string): OutboxMsg[] {
  const subscribe = useCallback((fn: () => void) => subscribeOutbox(committeeId, fn), [committeeId]);
  const snapshot = useCallback(() => getOutbox(committeeId), [committeeId]);
  // Server render has no outbox.
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
