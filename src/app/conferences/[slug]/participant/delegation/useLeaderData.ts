'use client';

// The leader card's own reads, beside what DelegationPanel already loads
// (my_delegation_roster, the leaders' applications read, the credit cover):
//   the delegation's crest and home      societies (city, country_code, logo_url)
//   the members' committees' emblems     conference_committees (logo_url)
//   what the leader pays                 my_pay_overview (readPayOverview, the /pay read)
// and, only while DELEGATIONS_V2_DB is on, the open seats, the reshuffle
// deadline and the members' position paper statuses (v2.ts).
// Every effect is keyed on ids, never on a token.

import { useCallback, useEffect, useState } from 'react';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import { readPayOverview, type PayOverview } from '../../pay/payApi';
import { DELEGATIONS_V2_DB, readOpenSeats, readPaperStatuses, readReshuffleUntil, type OpenSeat } from './v2';

export interface SocietyHome {
  name: string | null;
  city: string | null;
  country_code: string | null;
  logo_url: string | null;
}

export interface CommitteeInfo {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
}

export function useLeaderData({ conferenceId, societyId, committeeIds, memberUserIds }: {
  conferenceId: string;
  societyId: string;
  committeeIds: string[];
  memberUserIds: string[];
}) {
  const [society, setSociety] = useState<SocietyHome | null>(null);
  const [committees, setCommittees] = useState<Map<string, CommitteeInfo>>(() => new Map());
  const [pay, setPay] = useState<PayOverview | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [openSeats, setOpenSeats] = useState<OpenSeat[] | null>(null);
  const [reshuffleUntil, setReshuffleUntil] = useState<string | null>(null);
  const [papers, setPapers] = useState<Map<string, string> | null>(null);

  const committeeKey = [...new Set(committeeIds)].sort().join(',');
  const userKey = [...new Set(memberUserIds)].sort().join(',');

  useEffect(() => {
    let alive = true;
    void (async () => {
      const c = await getFreshAuthedClient();
      if (!c || !alive) return;
      const { data } = await c.from('societies').select('name, city, country_code, logo_url').eq('id', societyId).maybeSingle();
      if (alive && data) setSociety(data as SocietyHome);
    })();
    return () => { alive = false; };
  }, [societyId]);

  useEffect(() => {
    const ids = committeeKey ? committeeKey.split(',') : [];
    if (ids.length === 0) return;
    let alive = true;
    void (async () => {
      const c = await getFreshAuthedClient();
      if (!c || !alive) return;
      const { data } = await c.from('conference_committees').select('id, name, abbreviation, logo_url').in('id', ids);
      if (!alive || !data) return;
      setCommittees(new Map((data as CommitteeInfo[]).map(r => [r.id, r] as const)));
    })();
    return () => { alive = false; };
  }, [committeeKey]);

  // Swaps the overview in place (never back to null, never a loader) and
  // returns it, so a caller can act on the fresh read; null when it failed.
  const reloadPay = useCallback(async (): Promise<PayOverview | null> => {
    try {
      const o = await readPayOverview(conferenceId);
      setPay(o);
      setPayError(null);
      return o;
    } catch (e) {
      setPayError(friendlyError(e, 'Your delegation’s payments could not be read. Refresh the page to try again.'));
      return null;
    }
  }, [conferenceId]);

  useEffect(() => { void Promise.resolve().then(reloadPay); }, [reloadPay]);

  const reloadV2 = useCallback(async () => {
    if (!DELEGATIONS_V2_DB) return;
    const [seats, until] = await Promise.all([readOpenSeats(societyId), readReshuffleUntil(conferenceId)]);
    setOpenSeats(seats);
    setReshuffleUntil(until);
  }, [societyId, conferenceId]);

  useEffect(() => { void Promise.resolve().then(reloadV2); }, [reloadV2]);

  useEffect(() => {
    if (!DELEGATIONS_V2_DB) return;
    let alive = true;
    const users = userKey ? userKey.split(',') : [];
    const ids = committeeKey ? committeeKey.split(',') : [];
    void readPaperStatuses(users, ids).then(m => { if (alive) setPapers(m); });
    return () => { alive = false; };
  }, [userKey, committeeKey]);

  return { society, committees, pay, payError, openSeats, reshuffleUntil, papers, reloadPay, reloadV2 };
}
