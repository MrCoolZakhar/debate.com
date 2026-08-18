'use client';

// ── Session notifications ──────────────────────────────────────────────────
//
// The chair-facing notification bus. Headless on purpose: this file owns the
// queue, the dedupe rule, the TTLs and the suppression gate, and knows nothing
// about how any of it is drawn. `<NotificationStack/>` is the only renderer
// today, but the conferences side is expected to reuse this store directly —
// see "Reserved kinds" below.
//
// Why a module-level store and `useSyncExternalStore` rather than context or
// Zustand: it matches `Toast.tsx`, and it lets non-React code (a realtime
// subscription callback, a service helper) fire a notification without a
// provider threaded through props. Notifications originate from realtime
// events, which are exactly that kind of caller.
//
// ── The four rules this file enforces ──────────────────────────────────────
//
// 1. ONE LIVE NOTIFICATION PER KEY. `notify()` upserts on `key`. Re-notifying
//    an existing key refreshes its payload and restarts its TTL rather than
//    stacking a duplicate. Realtime is chatty and re-delivers; without this a
//    single GSL request would pile up a new card on every reconnect. Choose
//    keys that identify the THING, not the event: `gsl:<motionId>`, not a
//    timestamp.
//
// 2. SUPPRESSION HOLDS, IT DOES NOT DROP. While a delegate's speaking timer is
//    ticking the stack is hidden, but notifications keep arriving and keep
//    their place in the queue; they appear the moment the timer stops. A GSL
//    request must never be silently lost because it landed mid-speech — the
//    delegate is waiting on an answer. TTL is PAUSED while suppressed, so a
//    request cannot expire unseen behind a five-minute speech.
//
// 3. TTL IS PER-NOTIFICATION AND MAY BE NULL. `null` means sticky — it stays
//    until code dismisses it. Actionable notifications should generally not be
//    sticky; a chair who ignores a GSL card for a minute has effectively
//    declined to act on it, and the request survives in the motions list
//    regardless.
//
// 4. DISMISSAL IS IDEMPOTENT. `dismiss(key)` on an absent key is a no-op, so
//    an expiry racing a click cannot double-fire `onExpire`.
//
// ── Reserved kinds (not yet wired) ─────────────────────────────────────────
//
// `broadcast` — when the organisers' live status dashboard gains broadcast
// messages, they surface HERE, as a `broadcast` notification, rather than as a
// second parallel UI. That is the main reason this store is generic and lives
// in `lib/` rather than inside the chair page: the conferences layer owns that
// dashboard and will import this module. Keep the payload shape additive.
//
// `motion` — pending non-GSL motions could surface the same way. Deliberately
// not wired yet; motions already have a dedicated modal with its own badge,
// and duplicating them here would violate rule 1's spirit even though the keys
// would differ.

import { useSyncExternalStore } from 'react';

export type NotificationKind = 'gsl-request' | 'chat' | 'broadcast' | 'motion' | 'info';

export type NotificationTone = 'accept' | 'reject' | 'neutral';

export interface NotificationAction {
  id: string;
  label: string;
  tone: NotificationTone;
  /** Return a promise to keep the card in a pending state until it settles. */
  run: () => void | Promise<void>;
}

export interface SessionNotification {
  /** Dedupe identity. Identifies the subject, never the event instant. */
  key: string;
  kind: NotificationKind;
  title: string;
  /** Secondary line. For `chat` this must NOT contain message content. */
  body?: string;
  /** ISO 3166-1 alpha-2, drawn as a flag chip when present. */
  flagCode?: string;
  /** Milliseconds on screen, counting only unsuppressed time. `null` = sticky. */
  ttlMs: number | null;
  actions?: NotificationAction[];
  /** Fired when the TTL runs out — never when dismissed by code or by action. */
  onExpire?: () => void;
  /**
   * Shows even while suppressed. Rule 2 holds ordinary notifications back
   * during a speech so the dais is not distracted mid-speaker, and that is
   * right for a GSL request — it can wait a minute. It is wrong for an
   * organiser broadcast that pauses or ends the debate: the chair needs that
   * BEFORE the speech it interrupts, not after. Use sparingly; a stack that is
   * always urgent is a stack with no suppression at all.
   */
  urgent?: boolean;
}

interface LiveNotification extends SessionNotification {
  createdAt: number;
  /** Unsuppressed milliseconds consumed so far. */
  elapsedMs: number;
  pending?: string;
}

const EMPTY: LiveNotification[] = [];
let items: LiveNotification[] = [];
let suppressed = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

function snapshot(): LiveNotification[] {
  return items;
}

/* Server render has no notifications; a stable empty array keeps
   useSyncExternalStore from looping on a fresh reference each call. */
function serverSnapshot(): LiveNotification[] {
  return EMPTY;
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Upsert by key. Restarts the TTL and refreshes the payload if it exists. */
export function notify(n: SessionNotification): void {
  const now = Date.now();
  const existing = items.find((i) => i.key === n.key);
  if (existing) {
    items = items.map((i) =>
      i.key === n.key ? { ...i, ...n, createdAt: now, elapsedMs: 0, pending: undefined } : i,
    );
  } else {
    items = [...items, { ...n, createdAt: now, elapsedMs: 0 }];
  }
  emit();
}

/** Idempotent. Does NOT fire `onExpire` — that is reserved for real timeouts. */
export function dismiss(key: string): void {
  if (!items.some((i) => i.key === key)) return;
  items = items.filter((i) => i.key !== key);
  emit();
}

/** Drop every notification whose key starts with `prefix` (e.g. `gsl:`). */
export function dismissWhere(prefix: string): void {
  const next = items.filter((i) => !i.key.startsWith(prefix));
  if (next.length === items.length) return;
  items = next;
  emit();
}

export function clearAll(): void {
  if (items.length === 0) return;
  items = [];
  emit();
}

/**
 * Hide the stack without losing anything. TTLs stop counting while suppressed,
 * so nothing expires unseen behind a long speech. See rule 2.
 */
export function setNotificationsSuppressed(next: boolean): void {
  if (suppressed === next) return;
  suppressed = next;
  emit();
}

export function isSuppressed(): boolean {
  return suppressed;
}

/** Marks a card busy while its action's promise settles. */
export function setPending(key: string, actionId: string | undefined): void {
  if (!items.some((i) => i.key === key)) return;
  items = items.map((i) => (i.key === key ? { ...i, pending: actionId } : i));
  emit();
}

/**
 * Advance every TTL by `deltaMs` and drop what has run out. Called by the
 * renderer's single interval — the store owns no timers of its own, so it
 * stays testable and does not leak intervals when no host is mounted.
 * No-ops while suppressed.
 */
export function tickNotifications(deltaMs: number): void {
  /* Urgent notifications are on screen while suppressed, so their TTLs must
     keep running — otherwise a broadcast would sit there frozen after the
     chair has already read and actioned it. Non-urgent ones stay paused, per
     rule 2, so nothing expires unseen behind a long speech. */
  if (items.length === 0) return;
  if (suppressed && !items.some((i) => i.urgent)) return;
  const expired: LiveNotification[] = [];
  const next: LiveNotification[] = [];
  for (const i of items) {
    if (i.ttlMs == null) { next.push(i); continue; }
    /* Paused while hidden. Only what is actually on screen ages. */
    if (suppressed && !i.urgent) { next.push(i); continue; }
    const elapsedMs = i.elapsedMs + deltaMs;
    if (elapsedMs >= i.ttlMs) expired.push(i);
    else next.push({ ...i, elapsedMs });
  }
  if (expired.length === 0) return;
  items = next;
  emit();
  /* After the state settles, so a handler that re-notifies cannot be clobbered
     by this same pass. */
  for (const e of expired) e.onExpire?.();
}

export function useNotifications(): { items: LiveNotification[]; suppressed: boolean } {
  const list = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const hidden = useSyncExternalStore(subscribe, isSuppressed, () => false);
  /* While suppressed the renderer still gets the urgent ones — the stack is
     hidden, not emptied, and an organiser broadcast that ends debate must not
     wait for the current speaker to finish. */
  return { items: hidden ? list.filter((i) => i.urgent) : list, suppressed: hidden && !list.some((i) => i.urgent) };
}

// ── Conventional keys and durations ────────────────────────────────────────
// Centralised so producers and any cleanup code agree on the same strings.

export const NOTIFY_TTL = {
  /** A minute to accept or reject, matching the delegate's re-request window. */
  gslRequest: 60_000,
  /** Long enough to register, short enough not to become clutter. */
  chat: 10_000,
} as const;

export const notifyKey = {
  gsl: (motionId: string) => `gsl:${motionId}`,
  chat: (sender: string) => `chat:${sender}`,
  broadcast: (id: string) => `broadcast:${id}`,
} as const;
