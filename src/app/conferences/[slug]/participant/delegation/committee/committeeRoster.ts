'use client';

// The whole committee's list for a delegate (5A): every seat with its country,
// the person in it and their delegation. Read through the NEW rpc
// `my_committee_roster(p_conference_committee)`, which does not exist yet
// (19 Oct 2026). It is called ONLY while DELEGATIONS_V2_DB is on; while it is
// false the hook returns null without touching the database and the card is
// not rendered.
//
// Expected rows: { country_code, country_name, seat, display_name,
// society_name, is_mine }, where is_mine marks the viewer's own delegation.

import { useEffect, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { DELEGATIONS_V2_DB } from '../v2';

export interface CommitteeRosterRow {
  country_code: string | null;
  country_name: string;
  seat: string | null;
  display_name: string | null;
  society_name: string | null;
  is_mine: boolean;
}

export type CommitteeRosterState = { kind: 'ok'; rows: CommitteeRosterRow[] } | { kind: 'error' };

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

export function useCommitteeRoster(conferenceCommitteeId: string | null): CommitteeRosterState | null {
  const key = DELEGATIONS_V2_DB ? conferenceCommitteeId : null;
  const [loaded, setLoaded] = useState<{ key: string; state: CommitteeRosterState } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    (async () => {
      const client = await getFreshAuthedClient();
      if (!client || cancelled) return;
      const { data, error } = await client.rpc('my_committee_roster', { p_conference_committee: key });
      if (cancelled) return;
      if (error || !Array.isArray(data)) { setLoaded({ key, state: { kind: 'error' } }); return; }
      const rows = (data as Record<string, unknown>[]).map(r => ({
        country_code: str(r.country_code),
        country_name: str(r.country_name) ?? str(r.country) ?? '',
        seat: r.seat == null ? null : String(r.seat),
        display_name: str(r.delegate_name),
        society_name: str(r.society_name),
        is_mine: r.is_mine === true,
      }));
      setLoaded({ key, state: { kind: 'ok', rows } });
    })().catch(() => { if (!cancelled) setLoaded({ key, state: { kind: 'error' } }); });
    return () => { cancelled = true; };
  }, [key]);

  return key && loaded?.key === key ? loaded.state : null;
}
