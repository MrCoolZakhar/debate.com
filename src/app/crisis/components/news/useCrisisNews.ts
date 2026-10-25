'use client';
// Gavelling Crisis: the news list for one crisis, kept live. Shared by the news page, the pop-up and the chair home.
// What comes back is whatever RLS allows: staff see drafts too, everyone else only published news for their room.

import { useCallback, useEffect, useRef, useState } from 'react';
import { crisisError, listNews, type CrisisRef } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { News } from '@/lib/crisis/types';

export function useCrisisNews(ref: CrisisRef): { items: News[] | null; error: string | null; reload: () => Promise<void> } {
  const [items, setItems] = useState<News[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++seq.current;
    try {
      const rows = await listNews(ref);
      if (mine !== seq.current) return;
      setItems(rows);
      setError(null);
    } catch (e) {
      if (mine === seq.current) setError(crisisError(e, 'Could not load the news.'));
    }
  }, [ref]);

  useEffect(() => {
    const t = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(t);
  }, [reload]);
  useCrisisLive(ref.id, ['crisis_news'], () => { void reload(); });

  return { items, error, reload };
}
