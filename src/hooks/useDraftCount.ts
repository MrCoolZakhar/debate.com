'use client';

/**
 * useDraftCount — the half-finished applications the signed-in user has sitting
 * in `public.application_drafts`, both as a count and as listable rows.
 *
 * WHY IT IS ITS OWN QUERY
 * ProfileDropdown already fetches "YOUR CONFERENCES", but that query whitelists
 * `('accepted','assigned','checked-in')` on `applications` — a draft is not an
 * application at all, so it can never surface there. This is a separate read
 * against `application_drafts`, whose RLS ("Users manage own drafts",
 * `user_id = auth.uid()`) is the real scope; the explicit `.eq('user_id')` is
 * belt-and-braces, matching `loadApplyDraft` in `src/lib/applyDraft.ts`.
 *
 * ROWS, NOT JUST A NUMBER
 * Drafts are now rendered as the first ENTRIES of the profile menu's conference
 * list (marked unfinished) rather than as one aggregate "DRAFTS TO COMPLETE"
 * row, so the conference behind each draft has to come back with it. The join
 * mirrors `loadDrafts` in `MyConferencesClient.tsx:794` — including its rule
 * that a draft whose conference we can no longer read is not listed at all,
 * because "Continue" would have nowhere to go.
 *
 * `count` is therefore the number of LISTABLE drafts: the badge and the list
 * must never disagree.
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

/** One half-finished application, with the conference it belongs to. */
export interface DraftSummary {
  id: string;
  role: string;
  slug: string;
  acronym: string;
  fullName: string;
  logoUrl: string | null;
  updatedAt: string;
}

/** Where "continue this draft" goes: straight back into the apply wizard for
 *  that (conference, role). The draft is keyed on exactly those two, so the
 *  flow rehydrates itself from `loadApplyDraft` on arrival. */
export function draftResumeHref(d: DraftSummary): string {
  return `/conferences/${d.slug}/apply?role=${encodeURIComponent(d.role)}`;
}

/** Tell every mounted draft badge that the draft set changed. */
export function notifyDraftsChanged(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DRAFTS_CHANGED_EVENT));
}

export function useDraftCount(enabled: boolean = true) {
  const { user, session } = useAuth();
  const [count, setCount] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);
  const [loading, setLoading] = useState(false);
  // Whether the lazy first fetch has already been kicked off for this user.
  const fetched = useRef(false);

  const refresh = useCallback(async () => {
    if (!user || !session) {
      setCount(null);
      setDrafts([]);
      return;
    }
    setLoading(true);
    const supabase = getAuthedClient(session.access_token);
    const { data, error } = await supabase
      .from('application_drafts')
      .select('id, role, updated_at, conferences (slug, acronym, full_name, logo_url)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    type Conf = { slug: string; acronym: string; full_name: string; logo_url: string | null };
    const rows = ((data ?? []) as unknown as {
      id: string; role: string; updated_at: string; conferences: Conf | Conf[] | null;
    }[]).flatMap((r) => {
      const conf = Array.isArray(r.conferences) ? r.conferences[0] ?? null : r.conferences;
      if (!conf) return [];
      return [{
        id: r.id,
        role: r.role,
        slug: conf.slug,
        acronym: conf.acronym,
        fullName: conf.full_name,
        logoUrl: conf.logo_url,
        updatedAt: r.updated_at,
      }];
    });

    // A failed read must degrade to "no badge, no rows", never to a wrong number.
    setDrafts(error ? [] : rows);
    setCount(error ? 0 : rows.length);
    setLoading(false);
  }, [user, session]);

  // Reset the cache when the signed-in user changes (declared before the fetch
  // effect so it wins the first commit).
  useEffect(() => {
    fetched.current = false;
    setCount(null);
    setDrafts([]);
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

  return { count, drafts, loading, refresh };
}
