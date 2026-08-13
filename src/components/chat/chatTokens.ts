'use client';

import { useEffect, useState } from 'react';
import { NEU } from '@/components/neu';
import type { ChatMessage } from '@/lib/types';
import type { OutboxMsg } from '@/lib/chatOutbox';
import type { TranslationKey } from '@/lib/translations';

/** The app's translation function, shared by every chat component. */
export type TFn = (key: TranslationKey, vars?: Record<string, string | number>) => string;

// ─── Chat-local surfaces ────────────────────────────────────────────────────
// Everything else comes from NEU (neu.tsx). These two are the incoming-bubble surface and
// the hairline rule used across the chat, defined ONCE here so no component re-hardcodes
// them. They sit between NEU.surface and white in the same ivory family.
export const CHAT = {
  bubbleIn: '#FAF8F3',
  hairline: '#DDD4C0',
  // Failed-delivery accent. neu.tsx has no red — the forest/ivory system never needed one —
  // so it lives here rather than being re-typed inside a component.
  danger: '#B4432F',
} as const;

/** 3 minutes — consecutive messages from one sender inside this window form a group. */
export const GROUP_WINDOW_MS = 3 * 60 * 1000;

/** Strip the speech-comment prefix the DB encodes into content. */
export function displayContent(content: string): string {
  return content.startsWith('[🎙️] ') ? content.slice(5) : content;
}

export function formatTime(ts: Date | string): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayKey(ts: Date | string): number {
  return startOfDay(new Date(ts));
}

/** "Today" / "Yesterday" / a localised date. */
export function dayLabel(
  ts: Date | string,
  t: TFn,
  locale: string,
): string {
  const day = dayKey(ts);
  const today = startOfDay(new Date());
  const oneDay = 24 * 60 * 60 * 1000;
  if (day === today) return t('chat_today');
  if (day === today - oneDay) return t('chat_yesterday');
  return new Date(ts).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Rendered rows ──────────────────────────────────────────────────────────

export type DeliveryState = 'sent' | 'sending' | 'failed';

export interface ChatItem {
  id: string;
  content: string;
  timestamp: Date;
  delivery: DeliveryState;
  /** Present only for outbox items, so a failed bubble can be retried or dismissed. */
  outboxId?: string;
}

export interface ChatGroup {
  key: string;
  sender: string;
  isMe: boolean;
  items: ChatItem[];
}

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'unread'; key: string }
  | { kind: 'group'; key: string; group: ChatGroup };

/**
 * Fold a thread's confirmed messages plus its outbox into day separators, an optional
 * "New messages" divider, and sender groups.
 *
 * `unreadAnchor` is the incoming-message high-water mark captured when the thread was
 * OPENED — using the live value would clear the divider the instant markRead ran.
 */
export function buildChatRows(
  messages: ChatMessage[],
  outbox: OutboxMsg[],
  senderName: string,
  unreadAnchor: number,
  t: TFn,
  locale: string,
): ChatRow[] {
  const items: (ChatItem & { sender: string })[] = messages.map((m) => ({
    id: m.id,
    sender: m.sender,
    content: displayContent(m.content),
    timestamp: new Date(m.timestamp),
    delivery: 'sent' as DeliveryState,
  }));

  // Outbox entries are always the newest thing in the thread — they have not landed yet.
  for (const o of outbox) {
    items.push({
      id: o.id,
      sender: o.sender,
      content: displayContent(o.content),
      timestamp: new Date(o.timestamp),
      delivery: o.status,
      outboxId: o.id,
    });
  }

  // Index of the first unread INCOMING message, matching the high-water-mark model.
  let firstUnreadId: string | null = null;
  let incomingSeen = 0;
  for (const m of messages) {
    if (m.sender === senderName) continue;
    incomingSeen += 1;
    if (incomingSeen > unreadAnchor) { firstUnreadId = m.id; break; }
  }

  const rows: ChatRow[] = [];
  let lastDay: number | null = null;
  let current: ChatGroup | null = null;
  let lastTs = 0;

  const flush = () => { if (current) { rows.push({ kind: 'group', key: current.key, group: current }); current = null; } };

  for (const it of items) {
    const d = dayKey(it.timestamp);
    if (d !== lastDay) {
      flush();
      rows.push({ kind: 'day', key: `day-${d}`, label: dayLabel(it.timestamp, t, locale) });
      lastDay = d;
      lastTs = 0;
    }
    if (firstUnreadId && it.id === firstUnreadId) {
      flush();
      rows.push({ kind: 'unread', key: 'unread-divider' });
    }
    const ts = it.timestamp.getTime();
    const sameGroup = current && current.sender === it.sender && ts - lastTs <= GROUP_WINDOW_MS;
    if (!sameGroup) {
      flush();
      current = { key: `g-${it.id}`, sender: it.sender, isMe: it.sender === senderName, items: [] };
    }
    current!.items.push(it);
    lastTs = ts;
  }
  flush();
  return rows;
}

// ─── iOS keyboard inset inside FitToScreen ──────────────────────────────────
/**
 * The delegate chat renders inside FitToScreen, a fixed 820px-tall root scaled to the
 * window. On iOS the software keyboard shrinks the VISUAL viewport but leaves
 * window.innerHeight alone, so the composer would sit underneath the keyboard.
 *
 * Returns the keyboard overlap converted into the scaled root's local units, for the
 * composer to absorb as bottom padding. 0 when there is no keyboard (or no visualViewport).
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const compute = () => {
      const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      let scale = 1;
      const root = document.getElementById('fit-root');
      if (root) {
        const tr = getComputedStyle(root).transform;
        if (tr && tr !== 'none') {
          try {
            const m = new DOMMatrixReadOnly(tr);
            if (m.a > 0.01) scale = m.a;
          } catch { /* keep scale 1 */ }
        }
      }
      // Ignore small deltas (URL-bar collapse), only a real keyboard matters.
      setInset(overlap > 60 ? Math.round(overlap / scale) : 0);
    };
    compute();
    vv.addEventListener('resize', compute);
    vv.addEventListener('scroll', compute);
    return () => {
      vv.removeEventListener('resize', compute);
      vv.removeEventListener('scroll', compute);
    };
  }, []);

  return inset;
}

// ─── Portal coordinate frame ────────────────────────────────────────────────
/**
 * Portal mounts into `#fit-root` when it exists, and FitToScreen gives that element a
 * `transform: scale(...)`. A transformed ancestor becomes the containing block for
 * `position: fixed`, so fixed coordinates inside the portal are in the ROOT's local units,
 * not viewport pixels — feeding raw getBoundingClientRect() values straight through would
 * place the popover in the wrong spot (and flip against the wrong edges).
 *
 * Returns the mapping needed to convert viewport px → portal-local px, plus the visible
 * viewport expressed in those local units so edge-flipping stays correct.
 */
export function portalFrame(): {
  scale: number;
  toLocalX: (x: number) => number;
  toLocalY: (y: number) => number;
  minX: number; minY: number; maxX: number; maxY: number;
} {
  const root = typeof document !== 'undefined' ? document.getElementById('fit-root') : null;
  let scale = 1;
  let originX = 0;
  let originY = 0;
  if (root) {
    const rr = root.getBoundingClientRect();
    const s = root.offsetWidth ? rr.width / root.offsetWidth : 1;
    if (s > 0.01 && Number.isFinite(s)) scale = s;
    originX = rr.left;
    originY = rr.top;
  }
  const toLocalX = (x: number) => (x - originX) / scale;
  const toLocalY = (y: number) => (y - originY) / scale;
  return {
    scale,
    toLocalX,
    toLocalY,
    minX: toLocalX(0),
    minY: toLocalY(0),
    maxX: toLocalX(typeof window !== 'undefined' ? window.innerWidth : 0),
    maxY: toLocalY(typeof window !== 'undefined' ? window.innerHeight : 0),
  };
}

/** Shared muted-label style used by list rows, separators and empty states. */
export const mutedLabel = {
  color: NEU.muted,
  fontVariantNumeric: 'tabular-nums' as const,
};
