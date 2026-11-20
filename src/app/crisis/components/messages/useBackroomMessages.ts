'use client';
// Gavelling Crisis: the backroom messages this viewer may read (every thread for the crisis team, their own for a
// delegate) and their read marks, kept fresh by the live ping on crisis_backroom_messages (docs/crisis/sql/052).
// `unread` per thread counts the other side's messages after this member's read mark.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { listBackroomMessages, listBackroomReads, type BackroomMessage, type BackroomRead, type CrisisRef } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import { serverNowIso } from '@/lib/serverClock';

export interface BackroomThread { characterId: string; messages: BackroomMessage[]; last: BackroomMessage; unread: number; toMe: boolean }

export function useBackroomMessages(ref: CrisisRef, opts: { enabled: boolean; staff: boolean; memberId: string | null }) {
  const { enabled, staff, memberId } = opts;
  const [messages, setMessages] = useState<BackroomMessage[] | null>(null);
  const [reads, setReads] = useState<BackroomRead[]>([]);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const mine = ++seq.current;
    try {
      const [m, r] = await Promise.all([listBackroomMessages(ref), listBackroomReads(ref)]);
      if (mine === seq.current) { setMessages(m); setReads(r); }
    } catch {
      // A failed re-read keeps what is on screen; the next ping or poll tries again.
    }
  }, [ref, enabled]);
  useEffect(() => {
    const t = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(t);
  }, [reload]);
  useCrisisLive(enabled ? ref.id : null, ['crisis_backroom_messages'], () => { void reload(); });

  /** Marks a thread read on screen at once (the database write is the caller's). */
  const markLocal = useCallback((characterId: string) => {
    if (!memberId) return;
    const at = serverNowIso();
    setReads((prev) => [...prev.filter((x) => x.character_id !== characterId), { member_id: memberId, character_id: characterId, read_at: at }]);
  }, [memberId]);

  const threads = useMemo<BackroomThread[]>(() => {
    if (!messages) return [];
    const readAt = new Map(reads.filter((r) => r.member_id === memberId).map((r) => [r.character_id, r.read_at]));
    const by = new Map<string, BackroomMessage[]>();
    for (const m of messages) { const l = by.get(m.character_id); if (l) l.push(m); else by.set(m.character_id, [m]); }
    const out: BackroomThread[] = [];
    for (const [characterId, list] of by) {
      const seen = Date.parse(readAt.get(characterId) ?? '') || 0;
      const unread = list.filter((m) => m.from_staff !== staff && m.author_member_id !== memberId && Date.parse(m.created_at) > seen).length;
      const toMe = !!memberId && list.some((m) => !m.from_staff && m.to_member_id === memberId);
      out.push({ characterId, messages: list, last: list[list.length - 1], unread, toMe });
    }
    return out.sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
  }, [messages, reads, memberId, staff]);

  const unreadTotal = useMemo(() => threads.reduce((n, t) => n + t.unread, 0), [threads]);
  return { messages, threads, unreadTotal, reload, markLocal, loaded: messages !== null };
}
