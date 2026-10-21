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
//           accepted member or leader) and given < max(paid tickets, accepted
//           delegates), so a delegation leaves the list only once BOTH are met
//           (needOf). Oldest accepted first (the earliest decided_at of its
//           accepted members), with search: crest, name, place, "N more" big
//           and "of M" small. "Show all delegations" adds the rest, greyed
//           ("Complete", or "Not accepted yet"). The open one stays listed.
//   MIDDLE  one delegation opened, ONE card top to bottom:
//             1. who: crest, name, place, leaders; "N of M given", "needs K more"
//             2. Given: compact pills like the Applications allocation (the
//                committee logo + acronym, the round flag + country, the holder
//                small), wrapping in rows; a small red corner minus on an empty
//                one takes it back, asked in place
//             3. Give more: a segmented control
//                  One country        pick a country; every committee where it
//                                     is free, ticked; one button gives them.
//                  Best seat per room the engine's best free seat per committee
//                                     (assignmentFit.rankSeatsForSociety), each
//                                     row swappable or left out; one button.
//                  Custom (default)   the committee rings on the right open the
//                                     committee pop-up in "Give to" mode
//                                     (SeatBoardGivePopup.tsx): one tap per
//                                     country, the pop-up stays open.
//   RIGHT   the committee rings, as on the People tab.
// Every give is ONE giveExactSeats call (organiser_give_society_seats: all or
// nothing, verified, the conference's seat limit enforced) and every take back
// one takeBackOneSeat (organiser_take_back_society_seat). Both are optimistic:
// the change is laid over the board at once and dropped on a refusal, whose
// sentence shows through notifyErr. Taps in quick succession never race (owner,
// 21 Oct 2026: two gives at once showed loading, then one reverted and came
// back): writes queue on the delegation's lane (data.queueWrite: one at a time,
// in the order tapped, the live re-read waiting for the whole queue); once the
// lane drains the board and the delegations re-read once (settleRead +
// onRefresh), and a landed change stays laid over the board until the board's
// own read shows it (a give's seat is in the read, a take back's row is gone),
// so nothing flickers back. Only mounted while the tab is open, so its reads (the
// delegations, their money and a 10 s live re-read) run only then.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, Info, Minus, Plus, X } from 'lucide-react';
import GSelect, { type GSelectOption } from '@/components/GSelect';
import { NEU } from '@/components/neu';
import DelegationCrest from '@/components/DelegationCrest';
import { useAuth } from '@/components/AuthProvider';
import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { useManage } from '@/app/manage/[slug]/layout';
import {
  allocationSocietyId, groupAllocationsByCountry, openSeatsForSociety, rankSeatsForSociety, type SocietySeatOption,
} from '@/lib/assignmentFit';
import { useDelegationsData, type DelegationView } from '@/app/manage/[slug]/applications/delegations/useDelegationsData';
import { giveExactSeats, takeBackOneSeat } from '@/app/manage/[slug]/applications/delegations/seatWrites';
import { readDelegationSettings, type GiveSeat, type SeatLimit } from '@/app/manage/[slug]/applications/delegations/v2';
import { foldForSearch } from '@/app/manage/[slug]/applications/delegations/societySeats';
import { LIVE, memberName, type DelegationMemberLite } from '@/app/manage/[slug]/applications/delegationRows';
import { DelegationNameLines, PlaceLine, SkeletonRows } from '@/app/manage/[slug]/applications/delegations/kit';
import { sortMembers } from '@/app/manage/[slug]/applications/delegations/memberOrder';
import InPlaceConfirm from '@/app/conferences/[slug]/participant/delegation/seat/InPlaceConfirm';
import DelegationPopupLink from '@/app/manage/[slug]/DelegationPopupLink';
import { useBoardDrag, dropAttr } from '@/app/manage/[slug]/assignment/boardDrag';
import { CountryName } from '@/app/manage/[slug]/assignment/displayNames';
import {
  type AcceptedApp, type AllocationRow, type CommitteeData, type SlotRow,
  CountryFlag, PersonAvatar, CommitteeLogo, committeeLabels, committeeSeatLogo, fitColor, slotLogoUrl, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import { SeatBoardGivePopup, holderOf } from '@/app/manage/[slug]/assignment/SeatBoardGivePopup';
import {
  BigCount, CARD_SHADOW, CommitteeRing, HAIRLINE, WELL, seatCounts,
} from '@/app/manage/[slug]/assignment/seatBoardShared';

type Mode = 'one' | 'best' | 'custom';
type Pending = ({ kind: 'give'; societyId: string; societyName: string } | { kind: 'back'; allocationId: string }) & {
  /** The land stamp once the write landed (data.landStamp), else null. */
  landed: number | null;
};

/** A landed change the board's own read already shows is done. */
function reflected(key: string, p: Pending, committees: CommitteeData[]): boolean {
  if (p.landed == null) return false;
  if (p.kind === 'back') return !committees.some(c => c.conference_allocations.some(a => a.id === p.allocationId));
  const [cid, code, seat] = key.split(':');
  const c = committees.find(x => x.id === cid);
  return !!c && c.conference_allocations.some(a => a.country_code === code && (a.seat ?? 1) === Number(seat) && allocationSocietyId(a) === p.societyId);
}

/** How long a landed change the board's read never showed is kept (someone else moved it). */
const LANDED_KEEP_MS = 8_000;

const MODES: { key: Mode; label: string }[] = [
  { key: 'one', label: 'One country' },
  { key: 'best', label: 'Best seat per room' },
  { key: 'custom', label: 'Custom' },
];

const BTN_PRIMARY: React.CSSProperties = {
  height: 38, padding: '0 18px', borderRadius: 11, border: 'none', cursor: 'pointer',
  background: 'linear-gradient(180deg, #2A5039, #1B3828)', color: '#FFFFFF',
  fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, boxShadow: '0 2px 8px rgba(27,56,40,0.22)',
};
const BTN_DISABLED: React.CSSProperties = { ...BTN_PRIMARY, background: WELL, color: NEU.inkSoft, boxShadow: 'none', cursor: 'default' };

function seatKey(committeeId: string, code: string, seat: number) {
  return `${committeeId}:${code}:${seat}`;
}

function byName(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' });
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** The engine's reason codes as plain words. */
const REASON_WORDS: Record<string, string> = {
  'HIGH PRIORITY': 'high priority seat',
  'PRIORITY SEAT': 'priority seat',
  'MEMBER PICK': 'a member asked for it',
  'NEEDS DELEGATES': 'the room needs delegates',
};
function reasonLine(reasons: string[]): string {
  const words = reasons.map(r => {
    if (r.startsWith('COMPLETES PAIR')) return 'completes their double';
    if (r.startsWith('DELEGATION CONCENTRATION')) return 'they already sit in this room';
    return REASON_WORDS[r] ?? null;
  }).filter((w): w is string => !!w);
  if (words.length === 0) return 'An open seat';
  const s = words.join(', ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** When each delegation's first member was accepted (the list's order). */
function useAcceptedDates(conferenceId: string): Map<string, string> {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [dates, setDates] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const c = await getFreshAuthedClient();
        if (!c) return;
        const out = new Map<string, string>();
        for (let from = 0; from < 20_000; from += 1000) {
          const { data, error } = await c.from('applications')
            .select('id, society_id, decided_at')
            .eq('conference_id', conferenceId)
            .not('society_id', 'is', null)
            .in('status', ['accepted', 'assigned', 'checked-in'])
            .order('id', { ascending: true })
            .range(from, from + 999);
          if (error || cancelled) return;
          const rows = (data ?? []) as { society_id: string; decided_at: string | null }[];
          for (const r of rows) {
            if (!r.decided_at) continue;
            const prev = out.get(r.society_id);
            if (!prev || r.decided_at < prev) out.set(r.society_id, r.decided_at);
          }
          if (rows.length < 1000) break;
        }
        if (!cancelled) setDates(out);
      } catch { /* the list falls back to A to Z */ }
    })();
    return () => { cancelled = true; };
  }, [userId, conferenceId]);
  return dates;
}

/** What a delegation must hold before it leaves the left list: its paid tickets
 *  AND its accepted delegates, so nobody misses out (owner, 21 Oct 2026). */
function needOf(r: DelegationView): number {
  return Math.max(r.paid, r.seatable);
}

/** Accepted (any accepted member or leader) and short of what it needs. */
function needsMore(r: DelegationView, given: number): boolean {
  return r.accepted > 0 && given < needOf(r);
}

function isLeader(m: DelegationMemberLite): boolean {
  return LIVE.has(m.status) && (m.is_head_delegate || m.role === 'head-delegate' || m.role === 'faculty-advisor');
}

type BoardProps = {
  /** The board's tab switcher and search, drawn at the top of the left column. */
  leftHeader: React.ReactNode;
  committees: CommitteeData[];
  /** Everyone waiting for a seat (their preferences nudge a delegation's best seats). */
  waiting: AcceptedApp[];
  search: string;
  spread: ReadonlySet<string>;
  needy: ReadonlySet<string>;
  /** Re-reads the board's committees quietly. */
  onRefresh: () => Promise<void> | void;
  onOpenDelegationsView: () => void;
  /** A ring pressed while no delegation is open: the board's own committee pop-up. */
  onOpenCommittee: (committeeId: string) => void;
  /** The board's committee pop-up, when open. */
  overlay: React.ReactNode;
};

export default function SeatBoardDelegations(props: BoardProps) {
  const { conference } = useManage();
  // The board mounts only once the conference has loaded.
  if (!conference) return null;
  return <DelegationsBoard {...props} conference={{ id: conference.id, fee_currency: conference.fee_currency }} />;
}

function DelegationsBoard({
  leftHeader, committees, waiting, search, spread, needy, onRefresh, onOpenDelegationsView, onOpenCommittee, overlay, conference,
}: BoardProps & { conference: { id: string; fee_currency: string } }) {
  const data = useDelegationsData({ conferenceId: conference.id, currency: conference.fee_currency });
  const { holdLive, queueWrite, laneBusy, landStamp, settleRead } = data;
  const acceptedDates = useAcceptedDates(conference.id);

  const [openId, setOpenId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('custom');
  const [pendingAll, setPendingAll] = useState<Map<string, Pending>>(() => new Map());
  /** The same map, read at tap time so quick taps never double-write a seat. */
  const pendingRef = useRef(pendingAll);
  const [give, setGive] = useState<{ committeeId: string; given: Set<string> } | null>(null);
  const [ask, setAsk] = useState<{ anchor: HTMLElement; alloc: AllocationRow; committee: CommitteeData } | null>(null);
  const [limit, setLimit] = useState<SeatLimit>('none');
  const [showAll, setShowAll] = useState(false);
  // One country
  const [oneCode, setOneCode] = useState<string | null>(null);
  const [oneUnticked, setOneUnticked] = useState<Set<string>>(() => new Set());
  // Best seat in each room
  const [bestLeftOut, setBestLeftOut] = useState<Set<string> | null>(null);
  const [bestSwap, setBestSwap] = useState<Map<string, string>>(() => new Map());
  const middleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void readDelegationSettings(conference.id).then(s => { if (!cancelled && s) setLimit(s.limit); });
    return () => { cancelled = true; };
  }, [conference.id]);

  // A fresh start for every delegation opened.
  const openDelegation = useCallback((id: string | null) => {
    setOpenId(id);
    setMode('custom');
    setOneCode(null);
    setOneUnticked(new Set());
    setBestLeftOut(null);
    setBestSwap(new Map());
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
      const backIds = new Set<string>();
      const adds: AllocationRow[] = [];
      const real = new Set(c.conference_allocations.map(a => seatKey(c.id, a.country_code, a.seat ?? 1)));
      for (const [key, p] of pending) {
        if (p.kind === 'back') { backIds.add(p.allocationId); continue; }
        const [cid, code, seat] = key.split(':');
        if (cid !== c.id || real.has(key)) continue;
        const slot = c.committee_country_slots.find(s => s.country_code === code);
        adds.push({
          id: `temp-${key}`, user_id: null, country_code: code, country_name: slot?.country_name ?? code,
          allocation_sent: false, application_id: null, seat: Number(seat), society_id: p.societyId,
          delegation: { name: p.societyName }, profiles: null, applications: null,
        });
      }
      if (backIds.size === 0 && adds.length === 0) return c;
      return { ...c, conference_allocations: [...c.conference_allocations.filter(a => !backIds.has(a.id)), ...adds] };
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

  /** Gives these slots (every open seat of each) in ONE verified write, queued on the delegation's lane. */
  async function giveSlots(society: DelegationView, items: { committee: CommitteeData; slot: SlotRow; seats: number[] }[], done?: () => void): Promise<boolean> {
    const seats: GiveSeat[] = items.flatMap(i => i.seats.map(seat => ({ conference_committee_id: i.committee.id, country_code: i.slot.country_code, seat })));
    if (seats.length === 0) return false;
    const keys = seats.map(s => seatKey(s.conference_committee_id, s.country_code, s.seat));
    if (keys.some(k => pendingRef.current.has(k) && !reflected(k, pendingRef.current.get(k)!, committees))) return false;
    const entry = { kind: 'give' as const, societyId: society.id, societyName: society.name };
    mark(keys.map(k => [k, { ...entry, landed: null }]));
    done?.();
    const r = await queueWrite(society.id, () => giveExactSeats(society.id, seats));
    if (r.ok) {
      const stamp = landStamp();
      mark(keys.map(k => [k, { ...entry, landed: stamp }]));
    } else {
      mark(keys.map(k => [k, null]));
    }
    void settle(society.id);
    if (!r.ok) { notifyErr(r.error, 'seat-board'); return false; }
    return true;
  }

  /** Takes these empty block seats back, one verified write each, queued on the delegation's lane. */
  async function takeBack(societyId: string, allocs: AllocationRow[]): Promise<boolean> {
    const real = allocs.filter(a => !a.id.startsWith('temp-') && !pendingRef.current.has(`back:${a.id}`));
    if (real.length === 0) return false;
    mark(real.map(a => [`back:${a.id}`, { kind: 'back', allocationId: a.id, landed: null }]));
    const results = await Promise.all(real.map(a => queueWrite(societyId, () => takeBackOneSeat(a.id))));
    const stamp = landStamp();
    mark(real.map((a, i) => [`back:${a.id}`, results[i].ok ? { kind: 'back', allocationId: a.id, landed: stamp } : null]));
    void settle(societyId);
    const failed = results.find(x => !x.ok);
    if (failed && !failed.ok) { notifyErr(failed.error, 'seat-board'); return false; }
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

  const members = useMemo(() => (openId ? waiting.filter(a => a.society_id === openId) : []), [waiting, openId]);

  // One country: every country with a committee it is free in for this delegation.
  const countryOptions = useMemo(() => {
    if (!openId) return [] as { code: string; name: string; free: number; logo: string | null }[];
    const m = new Map<string, { code: string; name: string; free: number; logo: string | null }>();
    for (const c of board) {
      const byCountry = groupAllocationsByCountry(c.conference_allocations);
      const skip = skipOf(c.id);
      for (const s of c.committee_country_slots) {
        if (skip.has(s.country_code)) continue;
        const e = m.get(s.country_code) ?? { code: s.country_code, name: s.country_name, free: 0, logo: slotLogoUrl(c, s) };
        if (openSeatsForSociety(s, byCountry, openId).length > 0) e.free += 1;
        m.set(s.country_code, e);
      }
    }
    return [...m.values()].filter(e => e.free > 0).sort((a, b) => byName(a.name, b.name));
  }, [board, openId, skipOf]);

  const oneRows = useMemo(() => {
    if (!openId || !oneCode) return [];
    return board.flatMap(c => {
      const slot = c.committee_country_slots.find(s => s.country_code === oneCode);
      if (!slot || skipOf(c.id).has(oneCode)) return [];
      const byCountry = groupAllocationsByCountry(c.conference_allocations);
      const rows = byCountry.get(oneCode) ?? [];
      const seats = openSeatsForSociety(slot, byCountry, openId);
      const theirs = rows.length > 0 && rows.every(r => allocationSocietyId(r) === openId);
      return [{ committee: c, slot, seats, theirs, holders: rows.filter(r => allocationSocietyId(r) !== openId) }];
    });
  }, [board, openId, oneCode, skipOf]);
  const oneFree = oneRows.filter(r => r.seats.length > 0);
  const oneTicked = oneFree.filter(r => !oneUnticked.has(r.committee.id));

  // Best seat in each room.
  const bestOptions = useMemo(() => {
    if (!openId) return [] as { committee: CommitteeData; options: SocietySeatOption<CommitteeData>[]; inRoom: boolean }[];
    return board.map(c => ({
      committee: c,
      options: rankSeatsForSociety(openId, c, spread, { needy, members, skip: skipOf(c.id) }),
      inRoom: c.conference_allocations.some(a => allocationSocietyId(a) === openId),
    })).filter(r => r.options.length > 0);
  }, [board, openId, spread, needy, members, skipOf]);

  const remaining = open ? Math.max(0, needOf(open) - (givenBySociety.get(open.id) ?? 0)) : 0;
  // Left out by default: rooms they already sit in, and the weakest rooms past what is still to give.
  const defaultLeftOut = useMemo(() => {
    const out = new Set<string>();
    const fresh = bestOptions.filter(r => !r.inRoom);
    for (const r of bestOptions) if (r.inRoom) out.add(r.committee.id);
    if (remaining > 0 && fresh.length > remaining) {
      const ranked = [...fresh].sort((a, b) => b.options[0].score - a.options[0].score);
      for (const r of ranked.slice(remaining)) out.add(r.committee.id);
    }
    return out;
  }, [bestOptions, remaining]);
  const leftOut = bestLeftOut ?? defaultLeftOut;
  const bestRows = bestOptions.map(r => {
    const code = bestSwap.get(r.committee.id);
    const chosen = (code ? r.options.find(o => o.slot.country_code === code) : undefined) ?? r.options[0];
    return { ...r, chosen };
  });
  const bestIn = bestRows.filter(r => !leftOut.has(r.committee.id));
  const bestOut = bestRows.filter(r => leftOut.has(r.committee.id));
  const setLeftOut = (fn: (s: Set<string>) => void) => {
    const next = new Set(leftOut);
    fn(next);
    setBestLeftOut(next);
  };

  // Rings lit for the mode's set.
  const highlight = new Set<string>();
  if (mode === 'one') for (const r of oneTicked) highlight.add(r.committee.id);
  if (mode === 'best') for (const r of bestIn) highlight.add(r.committee.id);

  // ── The give pop-up ────────────────────────────────────────────────────────
  const giveCommittee = give ? board.find(c => c.id === give.committeeId) ?? null : null;
  const busyCodes = useMemo(() => {
    const s = new Set<string>();
    if (!give) return s;
    for (const [k, p] of pending) {
      if (p.kind === 'give') { const [cid, code] = k.split(':'); if (cid === give.committeeId) s.add(code); }
      else {
        const a = giveCommittee?.conference_allocations.find(x => x.id === p.allocationId);
        if (a) s.add(a.country_code);
      }
    }
    // A taken-back row is gone from the overlay; its code is found on the board as read.
    const raw = committees.find(c => c.id === give.committeeId);
    for (const p of pending.values()) {
      if (p.kind !== 'back') continue;
      const a = raw?.conference_allocations.find(x => x.id === p.allocationId);
      if (a) s.add(a.country_code);
    }
    return s;
  }, [give, pending, giveCommittee, committees]);

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
        const on = highlight.has(c.id);
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
              background: lit || on ? '#FFFFFF' : '#FAF8F3',
              boxShadow: lit ? '0 0 0 2px #1B3828, 0 8px 20px rgba(27,56,40,0.18)' : on ? '0 0 0 2px #B6871F' : '0 0 0 1px rgba(27,56,40,0.06)',
              transform: lit ? 'scale(1.04)' : 'none',
              transition: 'box-shadow 160ms cubic-bezier(0.22,1,0.36,1), transform 160ms cubic-bezier(0.22,1,0.36,1)',
              fontFamily: OUTFIT, color: NEU.ink,
            }}
          >
            <CommitteeRing committee={c} lit={lit} />
            <span className="[overflow-wrap:anywhere] text-center" style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.15, padding: '0 2px' }}>{big}</span>
            <span style={{ fontSize: 11.5, color: NEU.inkSoft }}>
              <span style={{ fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{openN}</span> open
            </span>
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
    // Faculty advisors first, then head delegates, A to Z (memberOrder.ts).
    const leaders = sortMembers(open.members.filter(isLeader), memberName);
    const cap = limit === 'paid' ? open.paid : limit === 'expected' ? open.expected : null;
    const capLeft = cap == null ? null : Math.max(0, cap - given);
    const sectionTitle: React.CSSProperties = { margin: 0, fontSize: 15, fontWeight: 600, color: NEU.ink };

    const modeBody = mode === 'one' ? (
      <div className="flex flex-col gap-3">
        <GSelect<string>
          value={oneCode ?? ''}
          onChange={v => { setOneCode(v || null); setOneUnticked(new Set()); }}
          options={countryOptions.map<GSelectOption<string>>(o => ({
            value: o.code, label: o.name,
            hint: `Free in ${plural(o.free, 'committee')}`,
            icon: <CountryFlag code={o.code} w={18} h={18} alt="" logoUrl={o.logo} />,
          }))}
          placeholder={countryOptions.length === 0 ? 'No country is free for them' : 'Pick a country'}
          searchable
          searchPlaceholder="Search a country"
          aria-label="Pick a country"
          panelMinWidth={280}
          disabled={countryOptions.length === 0}
        />
        {oneCode && (
          <>
            <div className="flex flex-col">
              {oneRows.map(r => {
                const free = r.seats.length > 0;
                const ticked = free && !oneUnticked.has(r.committee.id);
                const holders = r.holders.map(h => holderOf(h, societyName));
                const lbl = committeeLabels(r.committee);
                return (
                  <label
                    key={r.committee.id}
                    className="flex items-center gap-3 px-2 py-2"
                    title={r.committee.name}
                    style={{ borderTop: `1px solid ${HAIRLINE}`, cursor: free ? 'pointer' : 'default', opacity: free || r.theirs ? 1 : 0.55 }}
                  >
                    <input
                      type="checkbox"
                      checked={ticked}
                      disabled={!free}
                      onChange={() => setOneUnticked(prev => {
                        const next = new Set(prev);
                        if (next.has(r.committee.id)) next.delete(r.committee.id); else next.add(r.committee.id);
                        return next;
                      })}
                      aria-label={`Give ${r.slot.country_name} in ${lbl.big}`}
                      style={{ width: 17, height: 17, accentColor: '#1B3828', visibility: free ? 'visible' : 'hidden', flexShrink: 0 }}
                    />
                    <CommitteeLogo committee={r.committee} size={22} alt={lbl.big} />
                    <span className="flex-1 min-w-0 [overflow-wrap:anywhere]" style={{ fontSize: 14, fontWeight: 600 }}>{lbl.big}</span>
                    <span className="flex-shrink-0 text-right [overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: free ? NEU.forest : NEU.inkSoft, maxWidth: '50%' }}>
                      {free
                        ? (r.slot.delegation_size > 1 ? `Free, ${plural(r.seats.length, 'seat')}` : 'Free')
                        : r.theirs ? 'Theirs already' : `Taken by ${holders.map(h => h.name).join(', ')}`}
                    </span>
                  </label>
                );
              })}
            </div>
            <div>
              <button
                type="button"
                disabled={oneTicked.length === 0}
                onClick={() => {
                  void giveSlots(open, oneTicked.map(r => ({ committee: r.committee, slot: r.slot, seats: r.seats })), () => setOneUnticked(new Set()))
                    .then(ok => { if (ok) notifyOk(`${oneRows[0]?.slot.country_name ?? 'The country'} given to ${open.name} in ${plural(oneTicked.length, 'committee')}`, 'seat-board'); });
                }}
                className="focus:outline-none"
                style={oneTicked.length === 0 ? BTN_DISABLED : BTN_PRIMARY}
              >
                {oneTicked.length === 0 ? 'Give' : `Give in ${plural(oneTicked.length, 'committee')}`}
              </button>
            </div>
          </>
        )}
      </div>
    ) : mode === 'best' ? (
      <div className="flex flex-col gap-3">
        {bestRows.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: NEU.inkSoft }}>No committee has a free country for them</p>}
        <div className="flex flex-col">
          {bestIn.map(r => {
            const lbl = committeeLabels(r.committee);
            const o = r.chosen;
            return (
              <div key={r.committee.id} className="flex items-center gap-3 px-2 py-2 flex-wrap" title={reasonLine(o.reasons)} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
                <span style={{ fontSize: 17, fontWeight: 700, color: fitColor(o.score), fontVariantNumeric: 'tabular-nums', lineHeight: 1, minWidth: 28 }}>{o.score}</span>
                <span className="inline-flex items-center gap-2 flex-shrink-0" style={{ minWidth: 88 }} title={r.committee.name}>
                  <CommitteeLogo committee={r.committee} size={22} alt={lbl.big} />
                  <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13.5, fontWeight: 600 }}>{lbl.big}</span>
                </span>
                <span className="flex-1 min-w-0" style={{ minWidth: 160 }}>
                  <GSelect<string>
                    value={o.slot.country_code}
                    onChange={v => setBestSwap(prev => new Map(prev).set(r.committee.id, v))}
                    options={r.options.map<GSelectOption<string>>(x => ({
                      value: x.slot.country_code, label: x.slot.country_name, hint: String(x.score),
                      icon: <CountryFlag code={x.slot.country_code} w={18} h={18} alt="" logoUrl={slotLogoUrl(r.committee, x.slot)} />,
                    }))}
                    size="sm"
                    searchable={r.options.length > 8}
                    searchPlaceholder="Search a country"
                    aria-label={`Country in ${lbl.big}`}
                    panelMinWidth={240}
                  />
                </span>
                <button
                  type="button"
                  onClick={() => setLeftOut(s => s.add(r.committee.id))}
                  aria-label={`Leave ${lbl.big} out`}
                  title="Leave this room out"
                  className="focus:outline-none flex-shrink-0 inline-flex items-center justify-center"
                  style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'transparent', color: NEU.inkSoft, cursor: 'pointer' }}
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            );
          })}
        </div>
        {bestOut.length > 0 && (
          <div className="flex items-center flex-wrap gap-2">
            <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>Left out</span>
            {bestOut.map(r => {
              const lbl = committeeLabels(r.committee);
              return (
                <button
                  key={r.committee.id}
                  type="button"
                  onClick={() => setLeftOut(s => s.delete(r.committee.id))}
                  title={r.inRoom ? `${open.name} already has an allocation in ${lbl.big}. Tap to put it back` : `${r.committee.name}. Tap to put it back`}
                  className="focus:outline-none inline-flex items-center gap-1.5"
                  style={{ height: 30, padding: '0 10px 0 6px', borderRadius: 999, border: '1px solid rgba(27,56,40,0.14)', background: '#FFFFFF', cursor: 'pointer', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, color: NEU.ink }}
                >
                  <Plus size={13} strokeWidth={1.5} aria-hidden />
                  <CommitteeLogo committee={r.committee} size={18} alt="" />
                  {lbl.big}
                </button>
              );
            })}
          </div>
        )}
        {bestIn.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => {
                const items = bestIn.map(r => ({ committee: r.committee, slot: r.chosen.slot, seats: r.chosen.seats }));
                const n = items.length;
                void giveSlots(open, items, () => { setBestLeftOut(null); setBestSwap(new Map()); })
                  .then(ok => { if (ok) notifyOk(`${plural(n, 'allocation')} given to ${open.name}`, 'seat-board'); });
              }}
              className="focus:outline-none"
              style={BTN_PRIMARY}
            >
              Give all {bestIn.length}
            </button>
          </div>
        )}
      </div>
    ) : (
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
          <button
            type="button"
            onClick={() => openDelegation(null)}
            className="focus:outline-none inline-flex items-center gap-2"
            style={{ height: 36, padding: '0 14px 0 10px', borderRadius: 12, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', cursor: 'pointer', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, color: NEU.ink }}
          >
            <ArrowLeft size={16} strokeWidth={1.5} /> Back to delegations
          </button>
        </div>

        <div className="flex flex-col" style={{ ...card, padding: 20, gap: 18 }}>
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
                      <span key={m.id} className="inline-flex items-center gap-1.5 min-w-0" title={m.role === 'faculty-advisor' ? 'Faculty Advisor' : 'Head Delegate'}>
                        <PersonAvatar name={name} url={m.profiles?.avatar_url ?? null} size={20} />
                        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12.5 }}>{name}</span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end flex-shrink-0" style={{ gap: 4 }} title={`${plural(open.paid, 'ticket')} paid, ${plural(open.seatable, 'accepted delegate')}`}>
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
              {left > 0 && capLeft === 0 && <span style={{ fontSize: 12, color: NEU.inkSoft }}>The seat limit allows no more</span>}
            </div>
          </div>

          {/* 2. Given: compact pills, like the Applications allocation */}
          <div className="flex flex-col gap-2.5" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16 }}>
            <h3 style={sectionTitle}>Given</h3>
            {held.length === 0 ? (
              <p style={{ margin: 0, fontSize: 13.5, color: NEU.inkSoft }}>None yet</p>
            ) : (
              <div className="flex flex-wrap" style={{ gap: '12px 10px', paddingTop: 6 }}>
                {held.map(({ committee: c, alloc: a }) => {
                  const lbl = committeeLabels(c);
                  const slot = c.committee_country_slots.find(s => s.country_code === a.country_code);
                  const double = !!slot && slot.delegation_size > 1;
                  const person = a.application_id || a.user_id ? holderOf(a, societyName) : null;
                  const temp = a.id.startsWith('temp-');
                  const canBack = !person && !temp && a.society_id === open.id;
                  const label = `${a.country_name} in ${lbl.big}${double ? `, seat ${a.seat}` : ''}`;
                  return (
                    <span
                      key={a.id}
                      className="relative inline-flex items-center flex-wrap max-w-full"
                      title={`${a.country_name}, ${c.name}${double ? `, seat ${a.seat}` : ''}${person ? `, ${person.name}` : person === null && !temp ? ', nobody in it yet' : ''}`}
                      style={{
                        gap: '4px 8px', minHeight: 34, padding: canBack ? '4px 14px 4px 6px' : '4px 12px 4px 6px', borderRadius: 999,
                        background: '#FAF8F3', boxShadow: '0 0 0 1px rgba(27,56,40,0.08)', opacity: temp ? 0.6 : 1, fontSize: 13,
                      }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <CommitteeLogo committee={c} size={20} alt="" />
                        <span className="[overflow-wrap:anywhere]" style={{ fontWeight: 600 }}>{lbl.big}</span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <CountryFlag code={a.country_code} w={20} h={20} alt="" logoUrl={committeeSeatLogo(c, a.country_code)} />
                        <CountryName name={a.country_name} code={a.country_code} style={{ fontWeight: 600, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
                        {double && <span style={{ fontSize: 11.5, color: NEU.inkSoft }}>Seat {a.seat}</span>}
                      </span>
                      {person && (
                        <span className="inline-flex items-center gap-1 min-w-0" style={{ fontSize: 11.5, color: NEU.inkSoft }}>
                          <PersonAvatar name={person.name} url={person.avatarUrl} size={16} />
                          <span className="[overflow-wrap:anywhere]">{person.name}</span>
                        </span>
                      )}
                      {canBack && (
                        <button
                          type="button"
                          onClick={e => setAsk({ anchor: e.currentTarget, alloc: a, committee: c })}
                          aria-label={`Take ${label} back from ${open.name}`}
                          title={`Take ${label} back`}
                          className="focus:outline-none"
                          style={{
                            position: 'absolute', top: -7, right: -7, width: 18, height: 18, padding: 0, borderRadius: '50%',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none',
                            background: 'linear-gradient(180deg, #C4503A, #A3361F)',
                            boxShadow: '0 0 0 2px #FFFFFF, 0 1px 3px rgba(27,56,40,0.18)',
                            color: '#FFFFFF', cursor: 'pointer',
                          }}
                        >
                          <Minus size={10} strokeWidth={2.5} aria-hidden />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Give more */}
          <div className="flex flex-col gap-3" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16 }}>
            <h3 style={sectionTitle}>Give more</h3>
            <div role="tablist" aria-label="How to give" className="flex flex-wrap" style={{ gap: 2, padding: 3, borderRadius: 12, background: '#F1ECE1' }}>
              {MODES.map(m => (
                <button
                  key={m.key}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.key}
                  onClick={() => setMode(m.key)}
                  className="focus:outline-none flex-1"
                  style={{
                    minHeight: 34, padding: '0 10px', borderRadius: 9, border: 'none', cursor: 'pointer',
                    background: mode === m.key ? '#FFFFFF' : 'transparent',
                    boxShadow: mode === m.key ? '0 1px 3px rgba(27,56,40,0.12)' : 'none',
                    fontFamily: OUTFIT, fontSize: 13.5, fontWeight: mode === m.key ? 600 : 500, color: mode === m.key ? NEU.ink : NEU.inkSoft,
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {modeBody}
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
                  title={needs ? `${g} of ${n} given: ${plural(r.paid, 'ticket')} paid, ${plural(r.seatable, 'accepted delegate')}` : undefined}
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
            <span title="The ring shows how full each committee is. The number is its open seats." style={{ display: 'inline-flex', color: NEU.inkSoft }}>
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
                {draggedRow ? 'You pick the countries next'
                  : mode === 'one' && oneCode ? 'Gold rings are where the country is ticked'
                    : mode === 'best' && bestIn.length > 0 ? 'Gold rings are in the suggested set'
                      : 'Click a committee to give its countries'}
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
          title={`Take ${ask.alloc.country_name} in ${committeeLabels(ask.committee).big} back from ${open.name}?`}
          line="It goes back to the open seats"
          yes="Take back"
          danger
          onCancel={() => setAsk(null)}
          onYes={() => {
            const a = ask.alloc;
            setAsk(null);
            void takeBack(open.id, [a]).then(ok => { if (ok) notifyOk(`${a.country_name} taken back from ${open.name}`, 'seat-board'); });
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
            const allocs = giveCommittee.conference_allocations.filter(a => a.country_code === code && a.society_id === open.id && !a.application_id && !a.user_id);
            if (allocs.some(a => a.id.startsWith('temp-'))) return;
            void takeBack(open.id, allocs).then(ok => {
              if (ok) setGive(g => { if (!g) return g; const next = new Set(g.given); next.delete(code); return { ...g, given: next }; });
            });
          }}
          onClose={() => setGive(null)}
        />
      )}
      {!give && overlay}
      {ghost}
    </div>
  );
}
