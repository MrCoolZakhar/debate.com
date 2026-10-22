'use client';

// ── The seat board's Delegations tab (owner, 21 Oct 2026) ────────────────────
// "Delegations often want to give out different allocations, not just the best
// seat in each room: 'I'm going to give Uganda to this one, France to this one,
// UK.' There needs to be: ONE COUNTRY, BEST SEAT IN EACH ROOM, and CUSTOM."
// Round two (owner, 21 Oct 2026): "There is way too much happening. It should
// show, as a priority, all the delegations that don't yet have all allocations
// given out, based on how many they paid for OR how many people are in the
// delegation, if accepted. BOTH must be met for a delegation to leave the left
// list ... It needs a unified flow. The pills of the already given allocations
// are way too big: show them like the allocations in the Applications tab."
//
//   LEFT    only the delegations that still need allocations: accepted (any
//           accepted member or leader) and given < its expected size (needOf:
//           src/lib/delegationExpected.ts, the biggest of delegate spots paid,
//           delegates joined and the leaders' pledge; owner, 22 Oct 2026). Oldest accepted first (the earliest decided_at of its
//           accepted members), with search: crest, name, place, "N more" big
//           and "of M" small. "Show all delegations" adds the rest, greyed
//           ("Complete", or "Not accepted yet"). The open one stays listed.
//   MIDDLE  one delegation opened, ONE card top to bottom. When the tab opens
//           the delegation that needs the most allocations is already open
//           (ties: the earliest accepted; owner, 21 Oct 2026). Giving never
//           makes the page jump (round 5): Give more sits right under who
//           they are, and the Given list grows BELOW it, so nothing above the
//           pointer moves and Give more stays in view.
//             1. who: crest, name, place, leaders; "N of M given", "needs K more"
//             2. Give more (below)
//             3. Given: a list view like the Applications pop-up's Allocations
//                tab (owner, 21 Oct 2026), A to Z, one row each (the committee
//                logo + acronym, the round flag + country, then the holders
//                with avatars, a double as two rows (holder, then Open), no seat
//                numbers); the Allocations tab's light red corner minus on a
//                row with an empty seat takes the empty seats back, asked in place
//             Give more: by clicking a committee only (owner, 22 Oct 2026:
//                the One country / Best seat per room / Custom choice is
//                gone): the committee rings on the right open the committee
//                pop-up in "Give to" mode (SeatBoardGivePopup.tsx): one tap
//                per country, the pop-up stays open.
//   RIGHT   the committee rings, as on the People tab.
// Every give is ONE giveExactSeats call (organiser_give_society_seats: all or
// nothing, verified, the conference's seat limit enforced) and every take back
// is one country's empty seats, read when the write runs and taken back one
// takeBackOneSeat each (organiser_take_back_society_seat). Both are optimistic:
// the change is laid over the board at once and dropped on a refusal, whose
// sentence shows through notifyErr. Taps in quick succession never race (owner,
// 21 Oct 2026: two gives at once showed loading, then one reverted and came
// back): writes queue on the delegation's lane (data.queueWrite: one at a time,
// in the order tapped, the live re-read waiting for the whole queue); once the
// lane drains the board and the delegations re-read once (settleRead +
// onRefresh), and a landed change stays laid over the board until the board's
// own read shows it (a give's seat is in the read, a take back's row is gone),
// so nothing flickers back. A take back drops every give of its country from
// the overlay and a give drops the country's take back, so Give, Undo, Give
// in quick succession ends where the last tap says (owner, 22 Oct 2026). Only mounted while the tab is open, so its reads (the
// delegations, their money and a 10 s live re-read) run only then.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Info, Minus, X } from 'lucide-react';
import { NEU } from '@/components/neu';
import DelegationCrest from '@/components/DelegationCrest';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { friendlyError } from '@/lib/friendlyError';
import { useManage } from '@/app/manage/[slug]/layout';
import { allocationSocietyId } from '@/lib/assignmentFit';
import { delegationExpected } from '@/lib/delegationExpected';
import { useDelegationsData, type DelegationView } from '@/app/manage/[slug]/applications/delegations/useDelegationsData';
import { giveExactSeats, takeBackOneSeat } from '@/app/manage/[slug]/applications/delegations/seatWrites';
import { readDelegationSettings, type GiveSeat, type SeatLimit } from '@/app/manage/[slug]/applications/delegations/v2';
import { foldForSearch } from '@/app/manage/[slug]/applications/delegations/societySeats';
import { LIVE, memberName } from '@/app/manage/[slug]/applications/delegationRows';
import { DelegationNameLines, PlaceLine, SkeletonRows } from '@/app/manage/[slug]/applications/delegations/kit';
import { memberRank, shownLeaders } from '@/app/manage/[slug]/applications/delegations/memberOrder';
import InPlaceConfirm from '@/app/conferences/[slug]/participant/delegation/seat/InPlaceConfirm';
import DelegationPopupLink from '@/app/manage/[slug]/DelegationPopupLink';
import { useBoardDrag, dropAttr } from '@/app/manage/[slug]/assignment/boardDrag';
import { CountryName } from '@/app/manage/[slug]/assignment/displayNames';
import {
  type AllocationRow, type CommitteeData, type SlotRow,
  CountryFlag, PersonAvatar, CommitteeLogo, committeeLabels, committeeSeatLogo, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import { SeatBoardGivePopup, holderOf } from '@/app/manage/[slug]/assignment/SeatBoardGivePopup';
import {
  BigCount, CARD_SHADOW, CommitteeRing, HAIRLINE, RingTally, SoftButton, WELL, seatCounts,
} from '@/app/manage/[slug]/assignment/seatBoardShared';

/** A change laid over the board until the board's own read shows it. Keyed
 *  `<committee>:<code>:<seat>` for a give and `undo:<committee>:<code>` for a
 *  take back. `op` is the press that owns the entry: a write that comes back
 *  only touches its own entry, so a later press on the same country (Undo
 *  right after Give, or Give again after Undo) is never overwritten by an
 *  earlier write landing late. */
type Pending = (
  | { kind: 'give'; societyId: string; societyName: string }
  | { kind: 'undo'; societyId: string; committeeId: string; code: string }
) & {
  op: number;
  /** The land stamp once the write landed (data.landStamp), else null. */
  landed: number | null;
};

const isBlockOf = (a: AllocationRow, societyId: string, code: string) =>
  a.country_code === code && allocationSocietyId(a) === societyId && !a.user_id && !a.application_id;

/** A landed change the board's own read already shows is done. */
function reflected(key: string, p: Pending, committees: CommitteeData[]): boolean {
  if (p.landed == null) return false;
  if (p.kind === 'undo') {
    const c = committees.find(x => x.id === p.committeeId);
    return !c || !c.conference_allocations.some(a => isBlockOf(a, p.societyId, p.code));
  }
  const [cid, code, seat] = key.split(':');
  const c = committees.find(x => x.id === cid);
  return !!c && c.conference_allocations.some(a => a.country_code === code && (a.seat ?? 1) === Number(seat) && allocationSocietyId(a) === p.societyId);
}

/** Takes back every empty seat a delegation holds in one country of one
 *  committee. The ids are read from the database when the write RUNS (it runs
 *  on the delegation's lane, after every earlier give has landed), so Undo
 *  right after Give takes back the rows that give really created, never a
 *  temporary row or a stale id. Nothing there is a clean no-op. */
async function takeBackCountryWrite(societyId: string, committeeId: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const fallback = 'That allocation was not taken back. Try again.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: 'Your session has expired. Refresh the page and sign in again.' };
    const { data, error } = await c.from('conference_allocations')
      .select('id')
      .eq('conference_committee_id', committeeId)
      .eq('country_code', code)
      .eq('society_id', societyId)
      .is('user_id', null)
      .is('application_id', null);
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    for (const row of (data ?? []) as { id: string }[]) {
      const r = await takeBackOneSeat(row.id);
      if (!r.ok) return r;
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** How long a landed change the board's read never showed is kept (someone else moved it). */
const LANDED_KEEP_MS = 8_000;

// The opened delegation must pop like the smart allocation cards (owner, 22
// Oct 2026): white, a gold top edge over the header, a thin gold ring and a
// deeper forest-tinted lift. Round 7 (owner, 22 Oct 2026: "raise it more, as
// if it literally stands out"): a light line on top of the gold edge, a
// deeper layered lift, and a gold plate behind the card, offset downward like
// the raised plate it stands on (DELEGATION_PLATE).
const DELEGATION_CARD_SHADOW = [
  'inset 0 1px 0 #F8EBBE',
  'inset 0 4px 0 #DFC164',
  'inset 0 0 0 1px rgba(182,135,31,0.24)',
  '0 1px 1px rgba(27,56,40,0.06)',
  '0 3px 6px -1px rgba(27,56,40,0.08)',
  '0 10px 20px -6px rgba(27,56,40,0.16)',
  '0 26px 48px -18px rgba(27,56,40,0.36)',
].join(', ');
const DELEGATION_PLATE: React.CSSProperties = {
  position: 'absolute', top: 14, left: 8, right: 8, bottom: -9, zIndex: -1, borderRadius: 22,
  background: 'linear-gradient(180deg, #F4E3A2 0%, #E6CB72 48%, #CDA94A 100%)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(138,102,20,0.35), 0 6px 14px -4px rgba(138,102,20,0.45), 0 18px 34px -14px rgba(27,56,40,0.32)',
};

function seatKey(committeeId: string, code: string, seat: number) {
  return `${committeeId}:${code}:${seat}`;
}

function byName(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

const NO_DATES: ReadonlyMap<string, string> = new Map();

/** When each delegation's first member was accepted (the list's order); null
 *  until the read has answered (a failed read answers with no dates). */
function useAcceptedDates(conferenceId: string): ReadonlyMap<string, string> | null {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [dates, setDates] = useState<ReadonlyMap<string, string> | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const c = await getFreshAuthedClient();
        if (!c) { if (!cancelled) setDates(NO_DATES); return; }
        const out = new Map<string, string>();
        for (let from = 0; from < 20_000; from += 1000) {
          const { data, error } = await c.from('applications')
            .select('id, society_id, decided_at')
            .eq('conference_id', conferenceId)
            .not('society_id', 'is', null)
            .in('status', ['accepted', 'assigned', 'checked-in'])
            .order('id', { ascending: true })
            .range(from, from + 999);
          if (cancelled) return;
          if (error) { setDates(NO_DATES); return; }
          const rows = (data ?? []) as { society_id: string; decided_at: string | null }[];
          for (const r of rows) {
            if (!r.decided_at) continue;
            const prev = out.get(r.society_id);
            if (!prev || r.decided_at < prev) out.set(r.society_id, r.decided_at);
          }
          if (rows.length < 1000) break;
        }
        if (!cancelled) setDates(out);
      } catch { if (!cancelled) setDates(NO_DATES); /* the list falls back to A to Z */ }
    })();
    return () => { cancelled = true; };
  }, [userId, conferenceId]);
  return dates;
}

const SEATED_ROLES = new Set(['delegate', 'head-delegate']);

/** Delegates and head delegates in the delegation who are not turned down or
 *  withdrawn, and the delegate spots the leaders pledged (Expected size). */
function joinedAndPledged(r: DelegationView): { joined: number; pledged: number } {
  let joined = 0;
  let pledged = 0;
  for (const m of r.members) {
    if (!LIVE.has(m.status)) continue;
    if (SEATED_ROLES.has(m.role)) joined += 1;
    if (m.pledge_type === 'delegation' && (m.spots_pledged ?? 0) > 0) pledged += m.spots_pledged ?? 0;
  }
  return { joined, pledged };
}

/** What a delegation must hold before it leaves the left list: its expected
 *  size, the biggest of delegate spots paid, delegates joined and the
 *  leaders' pledge (owner, 22 Oct 2026; src/lib/delegationExpected.ts). */
function needOf(r: DelegationView): number {
  const { joined, pledged } = joinedAndPledged(r);
  return delegationExpected({ paidDelegateSpots: r.paid, joinedDelegates: joined, pledged });
}

/** "12 delegate spots paid, 10 joined, 15 pledged": what the expected size is made of. */
function expectedWhy(r: DelegationView): string {
  const { joined, pledged } = joinedAndPledged(r);
  const parts = [`${plural(r.paid, 'delegate spot')} paid`, `${joined} joined`];
  if (pledged > 0) parts.push(`${pledged} pledged`);
  return `Expected size ${needOf(r)}: ${parts.join(', ')}`;
}

/** Accepted (any accepted member or leader) and short of what it needs. */
function needsMore(r: DelegationView, given: number): boolean {
  return r.accepted > 0 && given < needOf(r);
}


type BoardProps = {
  /** The board's tab switcher and search, drawn at the top of the left column. */
  leftHeader: React.ReactNode;
  committees: CommitteeData[];
  search: string;
  /** Re-reads the board's committees quietly. */
  onRefresh: () => Promise<void> | void;
  onOpenDelegationsView: () => void;
  /** A ring pressed while no delegation is open: the classic committee pop-up (the page's). */
  onOpenCommittee: (committeeId: string) => void;
};

export default function SeatBoardDelegations(props: BoardProps) {
  const { conference } = useManage();
  // The board mounts only once the conference has loaded.
  if (!conference) return null;
  return <DelegationsBoard {...props} conference={{ id: conference.id, fee_currency: conference.fee_currency }} />;
}

function DelegationsBoard({
  leftHeader, committees, search, onRefresh, onOpenDelegationsView, onOpenCommittee, conference,
}: BoardProps & { conference: { id: string; fee_currency: string } }) {
  const data = useDelegationsData({ conferenceId: conference.id, currency: conference.fee_currency });
  const { holdLive, queueWrite, laneBusy, landStamp, settleRead } = data;
  const acceptedRead = useAcceptedDates(conference.id);
  const acceptedDates = acceptedRead ?? NO_DATES;

  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingAll, setPendingAll] = useState<Map<string, Pending>>(() => new Map());
  /** The same map, read at tap time so quick taps never double-write a seat. */
  const pendingRef = useRef(pendingAll);
  /** Numbers each press, so a late write never overwrites a newer press's entry. */
  const opSeq = useRef(0);
  const [give, setGive] = useState<{ committeeId: string; given: Set<string> } | null>(null);
  /** The corner minus asked in place: the row's empty seats, taken back together. */
  const [ask, setAsk] = useState<{ anchor: HTMLElement; allocs: AllocationRow[]; committee: CommitteeData; code: string; country: string; keepsPeople: boolean } | null>(null);
  const [limit, setLimit] = useState<SeatLimit>('none');
  const [showAll, setShowAll] = useState(false);
  const middleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readDelegationSettings(conference.id).then(s => { if (!cancelled && s) setLimit(s.limit); });
    return () => { cancelled = true; };
  }, [conference.id]);

  // A fresh start for every delegation opened.
  const openDelegation = useCallback((id: string | null) => {
    setOpenId(id);
    setAsk(null);
  }, [setAsk]);
  useEffect(() => { middleRef.current?.scrollTo({ top: 0 }); }, [openId]);

  // An open pop-up or confirm holds the 10 s live re-read back.
  useEffect(() => { holdLive('seat-board-delegations', !!give || !!ask); }, [holdLive, give, ask]);
  useEffect(() => () => holdLive('seat-board-delegations', false), [holdLive]);

  useEffect(() => {
    if (!openId || give || ask) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') openDelegation(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, give, ask, openDelegation]);

  const rowById = useMemo(() => new Map(data.rows.map(r => [r.id, r] as const)), [data.rows]);
  const societyName = useCallback((id: string) => {
    const r = rowById.get(id);
    return r ? { name: r.name, logoUrl: r.logoUrl } : null;
  }, [rowById]);

  // Observer seats are never given to a delegation: by committee, country codes.
  const skipByCommittee = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const c of data.committees ?? []) {
      const s = new Set(c.committee_country_slots.filter(x => x.is_observer).map(x => x.country_code));
      if (s.size > 0) m.set(c.id, s);
    }
    return m;
  }, [data.committees]);
  const EMPTY = useMemo(() => new Set<string>(), []);
  const skipOf = useCallback((id: string) => skipByCommittee.get(id) ?? EMPTY, [skipByCommittee, EMPTY]);

  // The changes still to lay over the board: a landed one the read shows is done.
  const pending = useMemo(() => {
    const m = new Map<string, Pending>();
    for (const [k, p] of pendingAll) if (!reflected(k, p, committees)) m.set(k, p);
    return m;
  }, [pendingAll, committees]);

  // The board with this tab's writes laid over it until they land.
  const board = useMemo<CommitteeData[]>(() => {
    if (pending.size === 0) return committees;
    return committees.map(c => {
      const adds: AllocationRow[] = [];
      const real = new Set(c.conference_allocations.map(a => seatKey(c.id, a.country_code, a.seat ?? 1)));
      const undone: { societyId: string; code: string }[] = [];
      for (const [key, p] of pending) {
        if (p.kind === 'undo') { if (p.committeeId === c.id) undone.push(p); continue; }
        const [cid, code, seat] = key.split(':');
        if (cid !== c.id || real.has(key)) continue;
        const slot = c.committee_country_slots.find(s => s.country_code === code);
        adds.push({
          id: `temp-${key}`, user_id: null, country_code: code, country_name: slot?.country_name ?? code,
          allocation_sent: false, application_id: null, seat: Number(seat), society_id: p.societyId,
          delegation: { name: p.societyName }, profiles: null, applications: null,
        });
      }
      if (undone.length === 0 && adds.length === 0) return c;
      const kept = c.conference_allocations.filter(a => !undone.some(u => isBlockOf(a, u.societyId, u.code)));
      return { ...c, conference_allocations: [...kept, ...adds] };
    });
  }, [committees, pending]);

  const givenBySociety = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of board) for (const a of c.conference_allocations) {
      const s = allocationSocietyId(a);
      if (s) m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  }, [board]);

  // ── Left list ──────────────────────────────────────────────────────────────
  // Needing first, oldest accepted first; "Show all" adds the rest, greyed. The
  // open delegation stays listed after its last allocation, so it never vanishes
  // from under the pointer.
  const list = useMemo(() => {
    const q = foldForSearch(search);
    const rows = q
      ? data.rows.filter(r => foldForSearch(r.name).includes(q) || foldForSearch(r.city ?? '').includes(q))
      : data.rows.slice();
    const byAccepted = (a: DelegationView, b: DelegationView) => {
      const ta = acceptedDates.get(a.id) ?? '';
      const tb = acceptedDates.get(b.id) ?? '';
      if (ta !== tb) return !ta ? 1 : !tb ? -1 : ta.localeCompare(tb);
      return byName(a.name, b.name);
    };
    const needs = (r: DelegationView) => needsMore(r, givenBySociety.get(r.id) ?? 0);
    const needing = rows.filter(r => needs(r) || (!showAll && r.id === openId)).sort(byAccepted);
    if (!showAll) return needing;
    return [...needing, ...rows.filter(r => !needs(r)).sort(byAccepted)];
  }, [data.rows, search, acceptedDates, givenBySociety, showAll, openId]);

  const needingRows = useMemo(
    () => data.rows.filter(r => needsMore(r, givenBySociety.get(r.id) ?? 0)),
    [data.rows, givenBySociety],
  );

  // When the tab opens, the delegation that needs the most allocations is
  // already open (ties: the earliest accepted, then A to Z), once the
  // delegations and their accepted dates have been read. Decided once, during
  // render (React's adjust-state-while-rendering pattern), so it never
  // switches under the pointer as allocations are given.
  const [autoOpened, setAutoOpened] = useState(false);
  if (!autoOpened && !data.loading && acceptedRead) {
    setAutoOpened(true);
    // On a phone the opened delegation covers the screen, so it is not opened unasked there.
    const wide = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches;
    if (openId == null && wide) {
      const first = [...needingRows].sort((a, b) => {
        const la = needOf(a) - (givenBySociety.get(a.id) ?? 0);
        const lb = needOf(b) - (givenBySociety.get(b.id) ?? 0);
        if (la !== lb) return lb - la;
        const ta = acceptedRead.get(a.id) ?? '';
        const tb = acceptedRead.get(b.id) ?? '';
        if (ta !== tb) return !ta ? 1 : !tb ? -1 : ta.localeCompare(tb);
        return byName(a.name, b.name);
      })[0];
      if (first) openDelegation(first.id);
    }
  }

  const open = openId ? rowById.get(openId) ?? null : null;

  // ── Writes ─────────────────────────────────────────────────────────────────
  const refreshAll = useCallback(async (): Promise<number> => {
    // settleRead never rejects; the board's own read failing keeps what is shown.
    const stamp = settleRead();
    try { await onRefresh(); } catch { /* the next read corrects it */ }
    return stamp;
  }, [settleRead, onRefresh]);

  const mark = (entries: [string, Pending | null][]) => {
    const next = new Map(pendingRef.current);
    for (const [k, p] of entries) { if (p) next.set(k, p); else next.delete(k); }
    pendingRef.current = next;
    setPendingAll(next);
  };

  /** After a delegation's lane drains: one re-read of everything; landed changes
   *  the board's read never shows are let go a little later. */
  async function settle(societyId: string) {
    if (laneBusy(societyId)) return;
    const upTo = await refreshAll();
    window.setTimeout(() => {
      const next = new Map(pendingRef.current);
      let changed = false;
      for (const [k, p] of next) if (p.landed != null && p.landed <= upTo) { next.delete(k); changed = true; }
      if (changed) { pendingRef.current = next; setPendingAll(next); }
    }, LANDED_KEEP_MS);
  }

  /** Sets entries only while they still belong to this press (see Pending.op). */
  const markOwn = (keys: string[], op: number, landed: number | null) => {
    const next = new Map(pendingRef.current);
    let changed = false;
    for (const k of keys) {
      const cur = next.get(k);
      if (!cur || cur.op !== op) continue;
      if (landed == null) next.delete(k); else next.set(k, { ...cur, landed });
      changed = true;
    }
    if (changed) { pendingRef.current = next; setPendingAll(next); }
  };

  /** Gives these slots (every open seat of each) in ONE verified write, queued on the delegation's lane. */
  async function giveSlots(society: DelegationView, items: { committee: CommitteeData; slot: SlotRow; seats: number[] }[], done?: () => void): Promise<boolean> {
    const seats: GiveSeat[] = items.flatMap(i => i.seats.map(seat => ({ conference_committee_id: i.committee.id, country_code: i.slot.country_code, seat })));
    if (seats.length === 0) return false;
    const keys = seats.map(s => seatKey(s.conference_committee_id, s.country_code, s.seat));
    if (keys.some(k => { const cur = pendingRef.current.get(k); return cur?.kind === 'give' && !reflected(k, cur, committees); })) return false;
    const op = ++opSeq.current;
    // A give supersedes a take back of the same country still laid over the
    // board: the lane runs the two in the order pressed, so the server ends
    // where the last press says.
    mark([
      ...items.map(i => [`undo:${i.committee.id}:${i.slot.country_code}`, null] as [string, null]),
      ...keys.map(k => [k, { kind: 'give', societyId: society.id, societyName: society.name, op, landed: null }] as [string, Pending]),
    ]);
    done?.();
    const r = await queueWrite(society.id, () => giveExactSeats(society.id, seats));
    markOwn(keys, op, r.ok ? landStamp() : null);
    void settle(society.id);
    if (!r.ok) { notifyErr(r.error, 'seat-board'); return false; }
    return true;
  }

  /** Takes back the delegation's empty seats in one country of one committee
   *  (Undo in the give pop-up, and the corner minus on a Given row). Queued
   *  on the delegation's lane, so it runs after any give still in flight; the
   *  ids are read when it runs (takeBackCountryWrite).
   *
   *  Why Undo used to misbehave (owner, 22 Oct 2026): a landed give stayed in
   *  the pending map until a timer let it go, merely hidden while the board's
   *  read showed its seat. The take back removed the seat, so that give was no
   *  longer "shown" and its temporary row came back: the row read as theirs
   *  again, Undo found only that temporary row and did nothing, and a new Give
   *  was refused as a duplicate. Now the take back drops every give of that
   *  country (landed or not) and stands in its place until the read shows the
   *  seats are gone. */
  async function takeBackCountry(societyId: string, committeeId: string, code: string): Promise<boolean> {
    const key = `undo:${committeeId}:${code}`;
    const op = ++opSeq.current;
    const prefix = `${committeeId}:${code}:`;
    const gives = [...pendingRef.current.entries()]
      .filter(([k, p]) => p.kind === 'give' && p.societyId === societyId && k.startsWith(prefix))
      .map(([k]) => [k, null] as [string, null]);
    mark([...gives, [key, { kind: 'undo', societyId, committeeId, code, op, landed: null }]]);
    const r = await queueWrite(societyId, () => takeBackCountryWrite(societyId, committeeId, code));
    markOwn([key], op, r.ok ? landStamp() : null);
    void settle(societyId);
    if (!r.ok) { notifyErr(r.error, 'seat-board'); return false; }
    return true;
  }

  // ── The open delegation ────────────────────────────────────────────────────
  const held = useMemo(() => {
    if (!openId) return [];
    const out: { committee: CommitteeData; alloc: AllocationRow }[] = [];
    for (const c of board) for (const a of c.conference_allocations) if (allocationSocietyId(a) === openId) out.push({ committee: c, alloc: a });
    return out.sort((x, y) => byName(x.alloc.country_name, y.alloc.country_name)
      || byName(committeeLabels(x.committee).big, committeeLabels(y.committee).big)
      || (x.alloc.seat ?? 1) - (y.alloc.seat ?? 1));
  }, [board, openId]);

  // The Given grid: one row per committee and country, so a double is one row
  // with both of its seats (drawn as two rows: holders, then open seats).
  const heldRows = useMemo(() => {
    const m = new Map<string, { key: string; committee: CommitteeData; code: string; country: string; allocs: AllocationRow[] }>();
    for (const { committee: c, alloc: a } of held) {
      const key = `${c.id}:${a.country_code}`;
      const r = m.get(key);
      if (r) r.allocs.push(a);
      else m.set(key, { key, committee: c, code: a.country_code, country: a.country_name, allocs: [a] });
    }
    return [...m.values()];
  }, [held]);


  // ── The give pop-up ────────────────────────────────────────────────────────
  const giveCommittee = give ? board.find(c => c.id === give.committeeId) ?? null : null;
  // Countries of the open give pop-up with a write still running: shown as
  // "Saving", never disabled (the lane keeps the order of the presses).
  const busyCodes = useMemo(() => {
    const s = new Set<string>();
    if (!give) return s;
    for (const [k, p] of pending) {
      if (p.landed != null) continue;
      if (p.kind === 'give') { const [cid, code] = k.split(':'); if (cid === give.committeeId) s.add(code); }
      else if (p.committeeId === give.committeeId) s.add(p.code);
    }
    return s;
  }, [give, pending]);

  /** Done (or the X): close, and re-read once the lane is quiet so the board
   *  shows the true state. */
  function closeGive() {
    setGive(null);
    if (openId) void settle(openId);
  }

  function openGive(committeeId: string, societyId?: string) {
    if (societyId && societyId !== openId) openDelegation(societyId);
    setAsk(null);
    setGive({ committeeId, given: new Set() });
  }

  function ringClick(c: CommitteeData) {
    if (open) openGive(c.id);
    else onOpenCommittee(c.id);
  }

  // Drag a delegation onto a ring: open it and that committee's give pop-up.
  const { drag, sourceProps, ghost } = useBoardDrag({
    canDrop: (payload, target) => target.kind === 'committee' && payload.kind === 'society',
    onDrop: (payload, target) => {
      if (target.kind === 'committee' && payload.kind === 'society') openGive(target.committeeId, payload.id);
    },
  });
  const overCommitteeId = drag?.over?.startsWith('committee:') ? drag.over.slice('committee:'.length) : null;
  const draggedRow = drag?.payload.kind === 'society' ? rowById.get(drag.payload.id) ?? null : null;

  const totalOpen = committees.reduce((n, c) => n + seatCounts(c).open, 0);

  const ringGrid = (inPanel: boolean) => (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${inPanel ? 72 : 70}px, 1fr))` }}>
      {committees.map(c => {
        const lit = overCommitteeId === c.id;
        const { open: openN } = seatCounts(c);
        const big = committeeLabels(c).big;
        return (
          <button
            key={c.id}
            type="button"
            data-drop={inPanel ? undefined : dropAttr({ kind: 'committee', committeeId: c.id })}
            onClick={() => ringClick(c)}
            aria-label={open ? `Give ${open.name} countries in ${big}` : `Open ${big}, ${openN} open`}
            title={c.name}
            className="focus:outline-none flex flex-col items-center"
            style={{
              gap: 5, padding: '12px 2px 10px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: lit ? '#FFFFFF' : '#FAF8F3',
              boxShadow: lit ? '0 0 0 2px #1B3828, 0 8px 20px rgba(27,56,40,0.18)' : '0 0 0 1px rgba(27,56,40,0.06)',
              transform: lit ? 'scale(1.04)' : 'none',
              transition: 'box-shadow 160ms cubic-bezier(0.22,1,0.36,1), transform 160ms cubic-bezier(0.22,1,0.36,1)',
              fontFamily: OUTFIT, color: NEU.ink,
            }}
          >
            <CommitteeRing committee={c} lit={lit} />
            <span className="[overflow-wrap:anywhere] text-center" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.15, padding: '0 2px' }}>{big}</span>
            <RingTally committee={c} />
          </button>
        );
      })}
    </div>
  );

  const card: React.CSSProperties = { background: '#FFFFFF', borderRadius: 20, boxShadow: CARD_SHADOW };

  // ── Middle: one delegation ─────────────────────────────────────────────────
  let middle: React.ReactNode;
  if (!open) {
    const toGive = needingRows.reduce((n, r) => n + Math.max(0, needOf(r) - (givenBySociety.get(r.id) ?? 0)), 0);
    middle = (
      <div className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6" style={{ ...card, fontFamily: OUTFIT }}>
        {needingRows.length > 0 ? (
          <span className="flex items-center gap-6 flex-wrap justify-center">
            <BigCount n={needingRows.length} word={needingRows.length === 1 ? 'delegation needs allocations' : 'delegations need allocations'} />
            <BigCount n={toGive} word="still to give" />
          </span>
        ) : !data.loading && data.rows.length > 0 ? (
          <span className="inline-flex items-center gap-2" style={{ fontSize: 16, fontWeight: 600, color: NEU.forest }}>
            <Check size={18} strokeWidth={2} aria-hidden /> Every accepted delegation has its allocations
          </span>
        ) : null}
        <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: NEU.ink }}>
          {data.rows.length === 0 && !data.loading ? 'No delegations yet' : 'Open a delegation on the left to give it allocations'}
        </p>
        {data.rows.length > 0 && <p style={{ margin: 0, fontSize: 13.5, color: NEU.inkSoft }}>Or drag one onto a committee on the right</p>}
      </div>
    );
  } else {
    const need = needOf(open);
    const given = givenBySociety.get(open.id) ?? 0;
    const left = Math.max(0, need - given);
    // At most two: the creator always, then advisors, then head delegates (memberOrder.shownLeaders).
    const leaders = shownLeaders(open.members.filter(m => LIVE.has(m.status)), open.createdBy, memberName);
    const cap = limit === 'paid' ? open.paid : limit === 'expected' ? open.expected : null;
    const capLeft = cap == null ? null : Math.max(0, cap - given);
    const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 600, color: NEU.ink };

    // Giving is by clicking a committee only (owner, 22 Oct 2026).
    const giveBody = (
      <div className="flex flex-col gap-3">
        <p style={{ margin: 0, fontSize: 13.5, color: NEU.inkSoft }}>
          <span className="max-lg:hidden">Click a committee on the right to give its countries</span>
          <span className="lg:hidden">Tap a committee below to give its countries</span>
        </p>
        <div className="lg:hidden">{ringGrid(true)}</div>
      </div>
    );

    middle = (
      <div className="flex flex-col gap-3">
        <div>
          <SoftButton onClick={() => openDelegation(null)} size="sm" style={{ paddingLeft: 9 }}>
            <ArrowLeft size={15} strokeWidth={1.5} /> Back to delegations
          </SoftButton>
        </div>

        {/* The card on its gold plate: the plate sits behind, offset down */}
        <div className="relative isolate" style={{ marginBottom: 12 }}>
        <div aria-hidden style={DELEGATION_PLATE} />
        <div className="flex flex-col" style={{ ...card, boxShadow: DELEGATION_CARD_SHADOW, padding: '22px 20px 20px', gap: 18 }}>
          {/* 1. Who they are, and where they stand */}
          <div className="flex items-start gap-4 flex-wrap">
            <DelegationCrest name={open.name} logoUrl={open.logoUrl} size={52} />
            <div className="flex-1 min-w-0" style={{ minWidth: 200 }}>
              <DelegationPopupLink societyId={open.id} societyName={open.name} className="text-left">
                <DelegationNameLines name={open.name} size={21} restSize={13.5} weight={600} color={NEU.ink} restColor={NEU.inkSoft} />
              </DelegationPopupLink>
              <div className="mt-1"><PlaceLine city={open.city} countryCode={open.countryCode} size={15} fontSize={12.5} short /></div>
              {leaders.length > 0 && (
                <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap mt-2">
                  {leaders.map(m => {
                    const name = memberName(m);
                    return (
                      <span key={m.id} className="inline-flex items-center gap-1.5 min-w-0" title={memberRank(m) === 0 ? 'Faculty Advisor' : memberRank(m) === 1 ? 'Head Delegate' : 'Created the delegation'}>
                        <PersonAvatar name={name} url={m.profiles?.avatar_url ?? null} size={20} />
                        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12.5 }}>{name}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end flex-shrink-0" style={{ gap: 4 }} title={expectedWhy(open)}>
              <span className="inline-flex items-baseline gap-1.5">
                <span style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{given}</span>
                <span style={{ fontSize: 13.5, color: NEU.inkSoft }}>{need > 0 ? `of ${need} given` : 'given'}</span>
              </span>
              {left > 0 ? (
                <span style={{ fontSize: 13, color: NEU.inkSoft }}>
                  needs <span style={{ fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{left}</span> more
                </span>
              ) : need > 0 ? (
                <span className="inline-flex items-center gap-1" style={{ fontSize: 13, fontWeight: 600, color: NEU.forest }}>
                  <Check size={14} strokeWidth={2} aria-hidden /> Complete
                </span>
              ) : null}
              {/* The target is the expected size (owner, 22 Oct 2026): the biggest of
                  delegate spots paid (advisor tickets never count), delegates
                  joined and the leaders' pledge */}
              <span style={{ fontSize: 12.5, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>
                Expected <span style={{ fontWeight: 700, color: NEU.ink }}>{need}</span>
                {' · '}
                {open.paid > 0
                  ? <><span style={{ fontWeight: 700, color: NEU.ink }}>{open.paid}</span> delegate {open.paid === 1 ? 'spot' : 'spots'} paid</>
                  : <>No delegate spots paid yet</>}
              </span>
              {left > 0 && capLeft === 0 && <span style={{ fontSize: 12, color: NEU.inkSoft }}>The seat limit allows no more</span>}
            </div>
          </div>

          {/* 2. Give more, right under who they are: the Given list grows below it,
              so a give never moves what is under the pointer */}
          <div className="flex flex-col gap-3" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16 }}>
            <h3 style={sectionTitle}>Give more</h3>
            {giveBody}
          </div>
          {/* 3. Given: a list view like the Applications pop-up's Allocations tab,
              A to Z, one row per committee and country, a double in ONE row */}
          <div className="flex flex-col gap-2" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 14 }}>
            <h3 style={sectionTitle}>Given</h3>
            {heldRows.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13.5, color: NEU.inkSoft }}>None yet</p>
            ) : (
              <div className="flex flex-col" style={{ gap: 7, paddingTop: 4 }}>
                {heldRows.map(({ key, committee: c, code, country, allocs }) => {
                  const lbl = committeeLabels(c);
                  const people = allocs.map(a => (a.application_id || a.user_id ? holderOf(a, societyName) : null));
                  const empties = allocs.filter((a, i) => !people[i] && !a.id.startsWith('temp-') && a.society_id === open.id);
                  const allTemp = allocs.every(a => a.id.startsWith('temp-'));
                  const named = people.filter((p): p is NonNullable<typeof p> => !!p).map(p => p.name);
                  // A double always reads as two rows (owner, 22 Oct 2026): the
                  // holders first, each open seat on its own row beneath them.
                  const double = allocs.length > 1;
                  const seatOrder = allocs.map((a, i) => i).sort((x, y) => Number(!people[x]) - Number(!people[y]) || x - y);
                  return (
                    <div
                      key={key}
                      className="relative flex items-center flex-wrap min-w-0"
                      title={`${country}, ${c.name}${named.length > 0 ? `, ${named.join(' and ')}` : allTemp ? '' : ', nobody in it yet'}`}
                      style={{
                        gap: '4px 12px', minHeight: 44, padding: '6px 12px', borderRadius: 12, boxSizing: 'border-box',
                        background: '#FAF8F3', boxShadow: '0 0 0 1px rgba(27,56,40,0.06)', opacity: allTemp ? 0.6 : 1,
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5 flex-shrink-0" style={{ minWidth: 84 }} title={c.name}>
                        <CommitteeLogo committee={c} size={20} alt="" />
                        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13, fontWeight: 600 }}>{lbl.big}</span>
                      </span>
                      <span className="inline-flex items-center gap-2 min-w-0" style={{ flex: '1 1 150px' }}>
                        <CountryFlag code={code} w={24} h={24} alt="" logoUrl={committeeSeatLogo(c, code)} />
                        <CountryName name={country} code={code} style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }} />
                      </span>
                      {/* One seat: its holder or Open. A double: two rows, the holder
                          first and an open seat on its own row under it, never beside */}
                      <span
                        className={double ? 'flex flex-col items-start min-w-0' : 'flex items-center justify-end flex-wrap min-w-0'}
                        style={{ gap: double ? 5 : '4px 12px', marginLeft: 'auto', paddingRight: empties.length > 0 ? 4 : 0 }}
                      >
                        {seatOrder.map(i => {
                          const a = allocs[i];
                          const p = people[i];
                          return p ? (
                            <span key={a.id} className="inline-flex items-center gap-1.5 min-w-0" style={{ fontSize: 13, color: NEU.ink }}>
                              <PersonAvatar name={p.name} url={p.avatarUrl} size={22} />
                              <span className="[overflow-wrap:anywhere]" style={{ fontWeight: 500 }}>{p.name}</span>
                            </span>
                          ) : (
                            <span
                              key={a.id}
                              className="inline-flex items-center flex-shrink-0"
                              style={{ height: 22, padding: '0 9px', borderRadius: 999, border: '1.5px dashed rgba(27,56,40,0.24)', fontSize: 11.5, fontWeight: 600, color: NEU.inkSoft, boxSizing: 'border-box' }}
                            >
                              Open
                            </span>
                          );
                        })}
                      </span>
                      {empties.length > 0 && (
                        <button
                          type="button"
                          onClick={e => setAsk({ anchor: e.currentTarget, allocs: empties, committee: c, code, country, keepsPeople: named.length > 0 })}
                          aria-label={`Take ${country} in ${lbl.big} back from ${open.name}`}
                          title={`Take ${country} in ${lbl.big} back`}
                          className="focus:outline-none sbdMinus"
                          style={{
                            // The Allocations tab's corner minus: small, light red, a thin
                            // white ring, centred on the row's top-right corner.
                            position: 'absolute', top: -9, right: -9, width: 18, height: 18, padding: 0, borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none',
                            background: 'linear-gradient(180deg, #E8907F, #DA6E59)',
                            boxShadow: '0 0 0 1.5px #FFFFFF, 0 1px 2px rgba(27,56,40,0.14)',
                            color: '#FFFFFF', cursor: 'pointer',
                          }}
                        >
                          <Minus size={10} strokeWidth={2.4} aria-hidden />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
        </div>
      </div>
    );
  }

  const bannerRow = draggedRow ?? open;

  return (
    <div
      className="flex flex-col gap-4 lg:grid lg:flex-1 lg:min-h-0 lg:grid-cols-[296px_minmax(0,1fr)_312px] 2xl:grid-cols-[340px_minmax(0,1fr)_380px]"
      style={{ fontFamily: OUTFIT, color: NEU.ink }}
    >
      {/* ── LEFT: the delegations ────────────────────────────────────────── */}
      <section className="order-1 flex flex-col overflow-hidden max-lg:max-h-[70dvh] lg:min-h-0" style={{ background: '#FFFFFF', borderRadius: 20, boxShadow: CARD_SHADOW }}>
        {leftHeader}
        <div className="flex items-center gap-2 flex-none" style={{ margin: '0 8px', padding: '0 8px', minHeight: 36, borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}`, fontSize: 12, color: NEU.inkSoft }}>
          <span className="flex-1 inline-flex items-baseline gap-1.5">
            <span style={{ fontSize: 15, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{needingRows.length}</span>
            <span>need allocations</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={showAll}
            onClick={() => setShowAll(v => !v)}
            className="focus:outline-none inline-flex items-center gap-1.5"
            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 12, color: NEU.inkSoft }}
          >
            <span aria-hidden className="relative inline-block" style={{ width: 26, height: 15, borderRadius: 999, background: showAll ? '#1B3828' : 'rgba(27,56,40,0.18)', transition: 'background 160ms cubic-bezier(0.22,1,0.36,1)' }}>
              <span className="absolute" style={{ top: 2, left: showAll ? 13 : 2, width: 11, height: 11, borderRadius: '50%', background: '#FFFFFF', boxShadow: '0 1px 2px rgba(27,56,40,0.25)', transition: 'left 160ms cubic-bezier(0.22,1,0.36,1)' }} />
            </span>
            Show all delegations
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col" style={{ padding: '4px 8px 8px', overscrollBehavior: 'contain' }}>
          {data.loading && <div className="p-2"><SkeletonRows rows={6} height={52} /></div>}
          {data.loadFailed && <p className="text-center py-8" style={{ fontSize: 13.5, color: NEU.inkSoft }}>The delegations could not be loaded. Refresh the page.</p>}
          {!data.loading && !data.loadFailed && list.length === 0 && (
            <p className="text-center py-8 px-4" style={{ fontSize: 13.5, color: NEU.inkSoft }}>
              {data.rows.length === 0 ? 'No delegations yet' : search.trim() ? 'No delegation matches' : 'Every accepted delegation has its allocations'}
            </p>
          )}
          {list.map(r => {
            const selected = openId === r.id;
            const g = givenBySociety.get(r.id) ?? 0;
            const n = needOf(r);
            const needs = needsMore(r, g);
            const dragged = drag?.payload.kind === 'society' && drag.payload.id === r.id;
            const toggle = () => { setGive(null); openDelegation(selected ? null : r.id); };
            return (
              <div
                key={r.id}
                {...sourceProps({ kind: 'society', id: r.id }, r.name)}
                role="button"
                tabIndex={0}
                aria-pressed={selected}
                aria-label={`${r.name}. ${needs ? `Needs ${n - g} more of ${n}` : r.accepted === 0 ? 'Not accepted yet' : 'Complete'}. Open to give allocations, or drag onto a committee`}
                onClick={toggle}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                className="flex items-center gap-2.5 focus:outline-none focus-visible:ring-2"
                style={{ padding: '8px', borderRadius: 11, cursor: 'grab', background: selected ? WELL : 'transparent', boxShadow: selected ? 'inset 0 0 0 1.5px #1B3828' : 'none', opacity: dragged ? 0.45 : needs || selected ? 1 : 0.6 }}
                onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = '#FAF8F3'; }}
                onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <DelegationCrest name={r.name} logoUrl={r.logoUrl} size={34} />
                <span className="flex flex-col flex-1 min-w-0" style={{ lineHeight: 1.25, gap: 2 }}>
                  <DelegationNameLines name={r.name} size={13.5} restSize={11.5} weight={600} color={NEU.ink} restColor={NEU.inkSoft} />
                  <PlaceLine city={r.city} countryCode={r.countryCode} size={13} fontSize={11.5} short oneLine />
                </span>
                <span
                  className="flex flex-col items-end flex-shrink-0 text-right"
                  style={{ minWidth: 60, lineHeight: 1.15 }}
                  title={needs ? `${g} of ${n} given. ${expectedWhy(r)}` : undefined}
                >
                  {needs ? (
                    <>
                      <span className="inline-flex items-baseline gap-1">
                        <span style={{ fontSize: 17, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{n - g}</span>
                        <span style={{ fontSize: 12, color: NEU.inkSoft }}>more</span>
                      </span>
                      <span style={{ fontSize: 11.5, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>of {n}</span>
                    </>
                  ) : r.accepted === 0 ? (
                    <span style={{ fontSize: 12, color: NEU.inkSoft }}>Not accepted yet</span>
                  ) : (
                    <span className="inline-flex items-center gap-1" style={{ fontSize: 12.5, fontWeight: 600, color: NEU.forest }}><Check size={14} strokeWidth={2} aria-hidden /> Complete</span>
                  )}
                </span>
              </div>
            );
          })}
          <div className="mt-auto pt-3 px-2 pb-1">
            <button
              type="button"
              onClick={onOpenDelegationsView}
              className="focus:outline-none"
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 13, fontWeight: 700, color: NEU.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}
            >
              Open the Delegations view
            </button>
          </div>
        </div>
      </section>

      {/* ── MIDDLE ───────────────────────────────────────────────────────── */}
      <section
        ref={middleRef}
        className={`order-3 lg:order-2 flex flex-col gap-3 min-w-0 lg:min-h-0 lg:overflow-y-auto lg:pt-2.5 lg:pr-2.5 lg:pb-3 lg:pl-0.5 ${open ? 'max-lg:fixed max-lg:left-0 max-lg:right-0 md:max-lg:left-[96px] max-lg:bottom-0 max-lg:top-14 max-lg:z-40 max-lg:overflow-y-auto max-lg:p-4' : ''}`}
        style={{ overscrollBehavior: 'contain', ...(open ? { backgroundColor: 'var(--gv-bg, #EDE7D8)' } : null) }}
      >
        {middle}
      </section>

      {/* ── RIGHT: committees ────────────────────────────────────────────── */}
      <section className="order-2 lg:order-3 flex flex-col lg:min-h-0" style={{ background: '#FFFFFF', borderRadius: 20, padding: '16px 12px 14px', gap: 14, boxShadow: CARD_SHADOW }}>
        <div className="flex items-center justify-between flex-none" style={{ padding: '0 4px' }}>
          <span className="inline-flex items-center gap-2">
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>Committees</h2>
            <span title="The ring shows how full each committee is. Beneath it, allocations given of all allocations" style={{ display: 'inline-flex', color: NEU.inkSoft }}>
              <Info size={15} strokeWidth={1.5} />
            </span>
          </span>
          <BigCount n={totalOpen} word="open" size={17} />
        </div>

        {bannerRow && (
          <div className="flex items-center gap-2.5 flex-none" style={{ padding: '10px 12px', borderRadius: 14, background: WELL }}>
            <DelegationCrest name={bannerRow.name} logoUrl={bannerRow.logoUrl} size={30} />
            <span className="flex flex-col min-w-0 flex-1" style={{ lineHeight: 1.25 }}>
              <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13, fontWeight: 600 }}>
                {draggedRow ? <>Drop {draggedRow.name} on a committee</> : <>Giving to {bannerRow.name}</>}
              </span>
              <span style={{ fontSize: 12, color: NEU.inkSoft }}>
                {draggedRow ? 'You pick the countries next' : 'Click a committee to give its countries'}
              </span>
            </span>
            {!draggedRow && (
              <button type="button" onClick={() => openDelegation(null)} aria-label="Close the delegation" className="focus:outline-none" style={{ border: 'none', background: 'none', cursor: 'pointer', color: NEU.inkSoft, lineHeight: 0 }}>
                <X size={15} strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto" style={{ padding: 4, margin: -4, overscrollBehavior: 'contain' }}>
          {committees.length === 0
            ? <p className="text-center py-6" style={{ fontSize: 13.5, color: NEU.inkSoft }}>No committees yet</p>
            : ringGrid(false)}
        </div>

      </section>

      {ask && open && (
        <InPlaceConfirm
          anchor={ask.anchor}
          align="end"
          title={`Take ${ask.country} in ${committeeLabels(ask.committee).big} back from ${open.name}?`}
          line={ask.keepsPeople ? 'The empty seat goes back to the open seats' : ask.allocs.length > 1 ? 'Both seats go back to the open seats' : 'It goes back to the open seats'}
          yes="Take back"
          danger
          onCancel={() => setAsk(null)}
          onYes={() => {
            const { committee: c, code, country } = ask;
            setAsk(null);
            void takeBackCountry(open.id, c.id, code).then(ok => { if (ok) notifyOk(`${country} taken back from ${open.name}`, 'seat-board'); });
          }}
        />
      )}

      {give && giveCommittee && open && (
        <SeatBoardGivePopup
          committee={giveCommittee}
          society={{ id: open.id, name: open.name, logoUrl: open.logoUrl }}
          skip={skipOf(giveCommittee.id)}
          givenNow={give.given}
          stillNeeds={Math.max(0, needOf(open) - (givenBySociety.get(open.id) ?? 0))}
          busyCodes={busyCodes}
          societyName={societyName}
          onGive={(slot, seats) => {
            const code = slot.country_code;
            void giveSlots(open, [{ committee: giveCommittee, slot, seats }], () => setGive(g => (g ? { ...g, given: new Set(g.given).add(code) } : g)))
              .then(ok => {
                if (!ok) setGive(g => { if (!g) return g; const next = new Set(g.given); next.delete(code); return { ...g, given: next }; });
              });
          }}
          onUndo={slot => {
            const code = slot.country_code;
            // Optimistic: the tally and the row change at once; a refusal puts them back.
            setGive(g => { if (!g) return g; const next = new Set(g.given); next.delete(code); return { ...g, given: next }; });
            void takeBackCountry(open.id, giveCommittee.id, code).then(ok => {
              if (!ok) setGive(g => (g ? { ...g, given: new Set(g.given).add(code) } : g));
            });
          }}
          onClose={closeGive}
        />
      )}
            {ghost}
      <style>{`
        .sbdMinus { transition: transform 120ms cubic-bezier(0.22,1,0.36,1), filter 120ms; }
        .sbdMinus::before { content: ''; position: absolute; inset: -6px; border-radius: 50%; }
        .sbdMinus:hover { filter: saturate(1.25) brightness(0.95); }
        .sbdMinus:active { transform: scale(0.88); }
      `}</style>
    </div>
  );
}
