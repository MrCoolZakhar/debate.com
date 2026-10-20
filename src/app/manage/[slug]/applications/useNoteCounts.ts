'use client';

// ── How many team notes each applicant has (Job Board prompt 9) ────────────
//
// application_note_counts(p_conf) → { "<application_id>": count }, organizers
// only. Read once with the page's other reads, and again each time the
// applicant pop-up closes (a note may have been added or removed there).
// A failed read keeps the last counts and says nothing.

import { useEffect, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

export function useNoteCounts(conferenceId: string | null | undefined, userId: string | null | undefined, popupOpen: boolean): Map<string, number> {
  const [counts, setCounts] = useState<Map<string, number>>(() => new Map());
  const [reads, setReads] = useState(0);
  const [wasOpen, setWasOpen] = useState(popupOpen);
  // The pop-up closed: read again.
  if (wasOpen !== popupOpen) {
    setWasOpen(popupOpen);
    if (!popupOpen) setReads((n) => n + 1);
  }

  useEffect(() => {
    if (!conferenceId || !userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const supabase = await getFreshAuthedClient();
        if (!supabase || cancelled) return;
        const { data, error } = await supabase.rpc('application_note_counts', { p_conf: conferenceId });
        if (cancelled || error || !data || typeof data !== 'object') return;
        const next = new Map<string, number>();
        for (const [id, n] of Object.entries(data as Record<string, unknown>)) {
          const v = Number(n);
          if (Number.isFinite(v) && v > 0) next.set(id, v);
        }
        setCounts(next);
      } catch { /* keep the last counts */ }
    })();
    return () => { cancelled = true; };
  }, [conferenceId, userId, reads]);

  return counts;
}
