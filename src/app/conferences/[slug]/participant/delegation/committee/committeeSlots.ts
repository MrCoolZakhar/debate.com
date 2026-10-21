'use client';

// Every possible allocation of one committee, for the leader's committee
// pop-up (owner, 21 Oct 2026: "the FULL country matrix"). Reads only what any
// signed-in person may read today, nothing new on the database:
//   the slots        committee_country_slots (public SELECT): country, code,
//                    crest, delegation size (null = the committee's own
//                    conference_committees.delegation_size, else 1)
//   taken or not     get_committee_occupancy (allocations per country, any
//                    state, no names)
// Who holds a slot comes from my_committee_roster (committeeRoster.ts; only
// allocations already sent, with names but no photos) and the leader's own
// people and open allocations, which the card already knows.

import { useEffect, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';

export interface CommitteeSlot {
  country_code: string | null;
  country_name: string;
  logo_url: string | null;
  /** Seats in this country's delegation, at least 1. */
  size: number;
  /** Allocations made on this country, published or not. */
  taken: number;
}

export type CommitteeSlotsState = { kind: 'ok'; slots: CommitteeSlot[] } | { kind: 'error' };

export function useCommitteeSlots(conferenceCommitteeId: string | null): CommitteeSlotsState | null {
  const key = conferenceCommitteeId;
  const [loaded, setLoaded] = useState<{ key: string; state: CommitteeSlotsState } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    (async () => {
      const c = await getFreshAuthedClient();
      if (!c || cancelled) return;
      const [slotsRes, ccRes, occRes] = await Promise.all([
        c.from('committee_country_slots')
          .select('country_code, country_name, delegation_size, logo_url')
          .eq('conference_committee_id', key),
        c.from('conference_committees').select('delegation_size').eq('id', key).maybeSingle(),
        c.rpc('get_committee_occupancy', { p_committee_ids: [key] }),
      ]);
      if (cancelled) return;
      if (slotsRes.error) { setLoaded({ key, state: { kind: 'error' } }); return; }
      const fallbackSize = Math.max(1, Number((ccRes.data as { delegation_size?: number | null } | null)?.delegation_size ?? 1) || 1);
      const taken = new Map<string, number>();
      for (const r of (occRes.data ?? []) as { country_code: string | null; seats_taken: number }[]) {
        const k = (r.country_code ?? '').toLowerCase();
        if (k) taken.set(k, (taken.get(k) ?? 0) + (r.seats_taken ?? 0));
      }
      const slots = ((slotsRes.data ?? []) as { country_code: string | null; country_name: string | null; delegation_size: number | null; logo_url: string | null }[])
        .filter(s => !!(s.country_name ?? '').trim())
        .map(s => ({
          country_code: s.country_code,
          country_name: (s.country_name ?? '').trim(),
          logo_url: s.logo_url ?? null,
          size: Math.max(1, Number(s.delegation_size ?? fallbackSize) || 1),
          taken: taken.get((s.country_code ?? '').toLowerCase()) ?? 0,
        }));
      setLoaded({ key, state: { kind: 'ok', slots } });
    })().catch(() => { if (!cancelled) setLoaded({ key, state: { kind: 'error' } }); });
    return () => { cancelled = true; };
  }, [key]);

  return key && loaded?.key === key ? loaded.state : null;
}
