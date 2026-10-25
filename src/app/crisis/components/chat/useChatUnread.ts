'use client';
// Gavelling Crisis chat: how many messages that reached this character are still unread.
// One listMessages per change; "read" is kept per thread in this browser (chatKit).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { listMessages } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { CrisisMessage } from '@/lib/crisis/types';
import { useCrisis } from '../../[conference]/[crisis]/CrisisContext';
import { isUnreadFor, useReadMarks } from './chatKit';

export function useChatUnread(): number {
  const { ref, characterId, memberId } = useCrisis();
  const [messages, setMessages] = useState<CrisisMessage[] | null>(null);
  const marks = useReadMarks(ref.id, memberId ?? characterId ?? 'me');

  const load = useCallback(async () => {
    try { setMessages(await listMessages(ref)); } catch { /* keep the last count; the next change retries */ }
  }, [ref]);

  useEffect(() => {
    if (!characterId) return;
    let cancelled = false;
    listMessages(ref).then((rows) => { if (!cancelled) setMessages(rows); }).catch(() => { /* see load */ });
    return () => { cancelled = true; };
  }, [ref, characterId]);

  useCrisisLive(characterId ? ref.id : null, ['crisis_messages'], () => { void load(); });

  return useMemo(() => {
    if (!characterId || !messages) return 0;
    return messages.reduce((n, m) => n + (isUnreadFor(m, characterId, marks) ? 1 : 0), 0);
  }, [messages, characterId, marks]);
}
