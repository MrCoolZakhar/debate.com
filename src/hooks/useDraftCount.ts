'use client';

/**
 * useDraftCount — how many half-finished applications the signed-in user has
 * sitting in `public.application_drafts`.
 *
 * WHY IT IS ITS OWN QUERY
 * ProfileDropdown already fetches "YOUR CONFERENCES", but that query whitelists
 * `('accepted','assigned','checked-in')` on `applications` — a draft is not an
 * application at all, so it can never surface there. This is a separate count
 * against `application_drafts`, whose RLS ("Users manage own drafts",
 * `user_id = auth.uid()`) is the real scope; the explicit `.eq('user_id')` is
 * belt-and-braces, matching `loadApplyDraft` in `src/lib/applyDraft.ts`.
 *
 * LAZY, LIKE THE CONFERENCE LIST
 * `enabled` is the caller's "the menu is open" flag. Nothing is fetched until
 * the menu is first opened, so an unopened nav costs no round trip, and the
 * result is then cached for the life of the mount.
 *
 * REFRESH
 * A `gv-drafts-changed` window event forces a refetch, mirroring the
 * `gv-inbox-read-changed` pattern the organiser sidebar badge uses
 * (`src/app/manage/[slug]/layout.tsx:625`). Deleting a draft from
 * /my-conferences fires it, so the badge drops without a reload.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';

export const DRAFTS_CHANGED_EVENT = 'gv-drafts-changed';

/** Tell every mounted draft badge that the draft set changed. */
export function notifyDraftsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DRAFTS_CHANGED_EVENT));
}

export function useDraftCount(enabled: boolean = true) {
  const { user, session } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  // Whether the lazy first fetch has already been kicked off for this user.
  const fetched = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || !session) {
      setCount(null);
      return;
    }
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { count: n, error } = await supabase
      .from('application_drafts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    // A failed count must degrade to "no badge", never to a wrong number.
    setCount(error ? 0 : n ?? 0);
    setLoading(false);
  }, [user, session]);

  // Reset the cache when the signed-in user changes (declared before the fetch
  // effect so it wins the first commit).
  useEffect(() => {
    fetched.current = false;
    setCount(null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (!enabled || fetched.current) return;
    if (!user || !session) return;
    fetched.current = true;
    void refresh();
  }, [enabled, user, session, refresh]);

  useEffect(() => {
    function onChanged() {
      // Already-fetched menus refetch now; an untouched one just drops its
      // "fetched" latch so the next open picks up the new truth.
      if (fetched.current) void refresh();
    }
    window.addEventListener(DRAFTS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(DRAFTS_CHANGED_EVENT, onChanged);
  }, [refresh]);

  return { count, loading, refresh };
}
