// organiserVisits.ts — the "Go to the Communications page" and "Visit the
// Store" set-up steps (checklist v2, owner, 12 Oct 2026).
//
// Both steps are done once an organiser of the conference has opened the page.
// The truth is server-side: `mark_organiser_visit(p_conference, p_page)` stamps
// `conferences.comms_visited_at` / `store_visited_at` once, and
// `conference_setup_status()` reads them (scratch-checklist-v2.sql, NOT applied
// yet). Until that SQL lands the RPC is missing, and the call is a silent
// no-op: it is fire-and-forget and never reports or throws.
//
// localStorage keeps the instant tick on the dashboard (per conference, per
// browser), exactly like src/lib/emailsExplored.ts does for the old
// "Explore emails" row. It is never the source of truth for the checkmark.

import { useEffect } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

export type OrganiserVisitPage = 'communications' | 'store';

const PREFIX = 'gv-organiser-visit-';
const key = (conferenceId: string, page: OrganiserVisitPage) => `${PREFIX}${page}-${conferenceId}`;

/** One RPC per conference and page per page load, however often it re-renders. */
const sentThisLoad = new Set<string>();

/** Has this browser opened that page for this conference? Effects only. */
export function hasVisitedOrganiserPage(conferenceId: string, page: OrganiserVisitPage): boolean {
  if (typeof window === 'undefined' || !conferenceId) return false;
  try {
    return window.localStorage.getItem(key(conferenceId, page)) === '1';
  } catch {
    return false;
  }
}

/** Record the visit: localStorage at once, then the server stamp, fire-and-forget. */
export function markOrganiserVisit(conferenceId: string, page: OrganiserVisitPage): void {
  if (typeof window === 'undefined' || !conferenceId) return;
  try { window.localStorage.setItem(key(conferenceId, page), '1'); } catch { /* private mode */ }
  const k = key(conferenceId, page);
  if (sentThisLoad.has(k)) return;
  sentThisLoad.add(k);
  void (async () => {
    try {
      const client = await getFreshAuthedClient();
      if (!client) return;
      // A missing function (PGRST202, before the SQL is applied), a refusal or
      // a network error all end here silently. Nothing on screen depends on it.
      await client.rpc('mark_organiser_visit', { p_conference: conferenceId, p_page: page });
    } catch { /* silent by design */ }
  })();
}

/** Mount on the Communications or Store page: marks the visit once per load. */
export function useOrganiserVisit(conferenceId: string | null | undefined, page: OrganiserVisitPage): void {
  useEffect(() => {
    if (conferenceId) markOrganiserVisit(conferenceId, page);
  }, [conferenceId, page]);
}
