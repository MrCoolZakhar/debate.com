'use client';

// The submitted position papers of one committee, for the committee list
// (the delegate's Committee section and the leader card's committee pop-up):
// owner, 21 Oct 2026, "so the whole committee can read each other's papers".
//
// One read: position_papers of the committee whose status is submitted,
// reviewed or approved (a paper sent back is not shown), one row per country
// (a double delegation shares one paper). RLS decides what comes back:
//   today       the viewer's own country's paper (author and seatmates), and
//               for a delegation leader their members' papers
//               (pp_leader_of_member); chairs and organisers everything
//   with scratch-committee-position-papers.sql applied
//               every accepted participant seated in the committee reads every
//               submitted paper of that committee (rows and storage objects)
// COMMITTEE_PAPERS_DB stays false until the owners' chat applies that draft.
// While false, a paper link is drawn only for `allowedKeys` (the viewer's
// own seat and, for a leader, their delegation's), exactly where the viewer can
// already read it. Opening is openPositionPaper (a tab opened inside the click,
// then pointed at a signed URL).

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { openPositionPaper } from '@/lib/positionPapers';
import { notifyErr } from '@/lib/appNotify';

/** Flip to true once scratch-committee-position-papers.sql is applied. */
export const COMMITTEE_PAPERS_DB = false;

const SHOWN_STATUSES = ['submitted', 'reviewed', 'approved'];

/** A country's key in the paper map: the lowercased code, else the name. */
export function paperKey(code: string | null | undefined, name: string | null | undefined): string {
  const c = (code ?? '').trim().toLowerCase();
  return c ? `c:${c}` : `n:${(name ?? '').trim().toLowerCase()}`;
}

/** file_url per paperKey; null while the first read is out (or failed: then nothing is linked). */
export function useCommitteePapers(
  committeeId: string | null,
  allowedKeys: string[],
  refreshKey?: string | number | boolean | null,
): Map<string, string> | null {
  const allowed = COMMITTEE_PAPERS_DB ? '*' : [...new Set(allowedKeys)].sort().join('|');
  const key = committeeId && allowed ? `${committeeId}#${allowed}#${String(refreshKey ?? '')}` : null;
  const [loaded, setLoaded] = useState<{ key: string; map: Map<string, string> } | null>(null);

  useEffect(() => {
    if (!key || !committeeId) return;
    let cancelled = false;
    (async () => {
      const c = await getFreshAuthedClient();
      if (!c || cancelled) return;
      const { data, error } = await c.from('position_papers')
        .select('country_code, file_url, status')
        .eq('conference_committee_id', committeeId)
        .in('status', SHOWN_STATUSES);
      if (cancelled) return;
      const map = new Map<string, string>();
      if (!error) {
        const ok = allowed === '*' ? null : new Set(allowed.split('|'));
        for (const r of (data ?? []) as { country_code: string | null; file_url: string | null }[]) {
          if (!r.file_url) continue;
          const k = paperKey(r.country_code, null);
          if (ok && !ok.has(k)) continue;
          if (!map.has(k)) map.set(k, r.file_url);
        }
      }
      setLoaded({ key, map });
    })().catch(() => { /* nothing linked */ });
    return () => { cancelled = true; };
  }, [key, committeeId, allowed]);

  return key && loaded?.key === key ? loaded.map : null;
}

/** Opens a paper from a click; a refusal is one glass card. The tab opens
 *  INSIDE the click (openPositionPaper does that before any await), so the
 *  client is made synchronously: getAuthedClient sends the SDK's current token
 *  at request time, as useOpenStudyGuide does. */
export function useOpenCommitteePaper(): (fileUrl: string) => void {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  return useCallback((fileUrl: string) => {
    if (!token) { notifyErr('This paper could not be opened. Try again in a moment.'); return; }
    void openPositionPaper(getAuthedClient(token), fileUrl).then(ok => {
      if (!ok) notifyErr('This paper could not be opened. Try again in a moment.');
    });
  }, [token]);
}
