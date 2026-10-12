'use client';

/**
 * Every organiser broadcast of a committee, for the chat (src/lib/broadcastMessages.ts turns
 * them into messages from the Secretariat in the Everyone thread).
 *
 * Owner, 11 Oct 2026: broadcasts "do not actually stay, meaning once it's gone, it's gone",
 * then the same day: "the announcement should now live in the everyone chat as a message from
 * secretariat". A broadcast reaches the dais as a sticky glass card (NotificationStack); the
 * rows themselves stay in `session_broadcasts` (nothing deletes them on expiry; only an
 * organiser's Withdraw / Cancel and the committee's own deletion do), so the chat simply reads
 * every row of the committee again.
 *
 * WHO READS IT: the chair page, the delegate page and the voting page, each on mount, on
 * every `session_broadcasts` realtime event and on every session-sync catch-up that ends
 * 'done' (they bump `version`). NOTHING HERE WRITES THE DATABASE and nothing runs per second;
 * the list lives in its own state, never in the committee (RULES 3 to 5).
 */

import { useEffect, useState } from 'react';
import { getBroadcastHistory, type SessionBroadcast } from './committeeService';

// ── Card dismissal memory (moved here from the chair page, same key) ─────────
// A broadcast lives in the DB, and the chair page refetches the active set on every reload
// and realtime event. Without a record of what this device has already dealt with, one
// refresh would re-raise a card the chair dismissed ten minutes ago. Keyed per committee AND
// per broadcast id: the same dais laptop can host two committees in a day.
const broadcastSeenStorageKey = (code: string) => `gavelling-broadcast-seen-${code}`;

export function loadSeenBroadcasts(code: string): Set<string> {
  try {
    const raw = localStorage.getItem(broadcastSeenStorageKey(code));
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? (parsed as string[]) : []);
  } catch { return new Set(); }
}

export function markBroadcastSeen(code: string, id: string): void {
  try {
    const seen = loadSeenBroadcasts(code);
    if (seen.has(id)) return;
    seen.add(id);
    // Capped: only recent ids matter for re-raising cards.
    localStorage.setItem(broadcastSeenStorageKey(code), JSON.stringify(Array.from(seen).slice(-120)));
  } catch {}
}

// ── The history itself ───────────────────────────────────────────────────────

/**
 * Every broadcast of the committee, oldest first. Re-read when `version` changes. A failed
 * read keeps what was already shown (getBroadcastHistory answers null, never []).
 */
export function useBroadcastHistory(committeeId: string | undefined, version: number, enabled = true): SessionBroadcast[] {
  const [items, setItems] = useState<SessionBroadcast[]>([]);
  useEffect(() => {
    if (!committeeId || !enabled) return;
    let cancelled = false;
    void getBroadcastHistory(committeeId).then((rows) => {
      if (cancelled || !rows) return;
      setItems((prev) => (sameList(prev, rows) ? prev : rows));
    });
    return () => { cancelled = true; };
  }, [committeeId, version, enabled]);
  return items;
}

function sameList(a: SessionBroadcast[], b: SessionBroadcast[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]; const y = b[i];
    if (x.id !== y.id || x.message !== y.message || x.imageUrl !== y.imageUrl
      || x.action !== y.action || x.actionAt !== y.actionAt || x.expiresAt !== y.expiresAt) return false;
  }
  return true;
}
