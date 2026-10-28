'use client';

// The delegate phone's glass cards for messages from the Secretariat and press releases
// (owner, 23 Oct 2026: with chat off, delegates "should still" see them "as notifications
// like any broadcast"). The phone had no notification stack of its own; this mounts the one
// renderer (NotificationStack) and raises ONE card per broadcast that arrived recently and
// this device has not dismissed. It reads only the list the page already holds
// (useBroadcastHistory); nothing here writes the database or the committee, nothing runs per
// second, and the chat (on or off) still holds every message.

import { useEffect, useMemo, useRef } from 'react';
import NotificationStack, { type NotificationExtra } from '@/components/notifications/NotificationStack';
import { notify, dismiss, notifyKey } from '@/lib/sessionNotifications';
import type { SessionBroadcast } from '@/lib/committeeService';
import { serverNow } from '@/lib/serverClock';
import { useT } from '@/contexts/LanguageContext';

/** Only what arrived in this window raises a card; older messages wait in the chat. */
const RECENT_MS = 30 * 60 * 1000;
/** A press release leaves on its own; a Secretariat message stays until dismissed. */
const PRESS_TTL_MS = 20_000;

const seenKey = (code: string) => `gavelling-delegate-broadcast-seen-${code}`;

function loadSeen(code: string): Set<string> {
  try {
    const raw = localStorage.getItem(seenKey(code));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch { return new Set(); }
}

function markSeen(code: string, id: string): void {
  try {
    const seen = loadSeen(code);
    if (seen.has(id)) return;
    seen.add(id);
    localStorage.setItem(seenKey(code), JSON.stringify(Array.from(seen).slice(-120)));
  } catch {}
}

export default function DelegateBroadcastCards({ code, broadcasts, enabled, topPx }: {
  code: string;
  broadcasts: SessionBroadcast[];
  /** False while the seat is not confirmed or the room has ended. */
  enabled: boolean;
  topPx: number;
}) {
  const t = useT();
  const raised = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !code) return;
    const seen = loadSeen(code);
    const now = serverNow();
    const live = new Set<string>();
    for (const b of broadcasts) {
      const key = notifyKey.broadcast(b.id);
      live.add(key);
      if (seen.has(b.id) || raised.current.has(key)) continue;
      const at = Date.parse(b.createdAt);
      if (!Number.isFinite(at) || now - at > RECENT_MS) continue;
      raised.current.add(key);
      const press = b.source === 'press';
      const id = b.id;
      notify({
        key,
        kind: 'broadcast',
        title: press
          ? t('bc_press_from').replace('{name}', b.authorLabel || t('bc_press'))
          : t('notif_broadcast_title'),
        body: b.message,
        ttlMs: press ? PRESS_TTL_MS : null,
        onExpire: () => markSeen(code, id),
        actions: [{ id: 'dismiss', label: t('notif_broadcast_dismiss'), tone: 'neutral', run: () => markSeen(code, id) }],
      });
    }
    // Withdrawn upstream: pull its card.
    for (const key of Array.from(raised.current)) {
      if (live.has(key)) continue;
      raised.current.delete(key);
      dismiss(key);
    }
  }, [broadcasts, code, enabled, t]);

  // Leaving the room (or the seat) takes the cards with it.
  useEffect(() => {
    if (enabled) return;
    for (const key of Array.from(raised.current)) dismiss(key);
    raised.current.clear();
  }, [enabled]);

  const extras = useMemo(() => {
    const map: Record<string, NotificationExtra> = {};
    for (const b of broadcasts) if (b.imageUrl) map[notifyKey.broadcast(b.id)] = { imageUrl: b.imageUrl };
    return map;
  }, [broadcasts]);

  return <NotificationStack extras={extras} topPx={topPx} />;
}
