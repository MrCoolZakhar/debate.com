'use client';

// The People table of the leader card (taste board 1A): one row per member,
// person (photo or initials, name, role in plain words), seat (seat/SeatCell:
// the country's round flag big with its name under it, the committee's emblem
// smaller beside it with the acronym that opens the committee, owner 20 Oct
// 2026), position paper (V2 only), payment, and the row menu.
// From 760px of card width it is a table; below it (phones, owner 21 Oct
// 2026) every person is ONE compact row: avatar, name with a role icon, the
// allocation as a small round flag + committee acronym, the paper as an icon,
// and the three-dots menu (Allocate, Unallocate and the rest live there).
// Names wrap, never an ellipsis (CLAUDE.md §8).
// Order (CLAUDE.md §8): faculty advisors first, then head delegates, then
// delegates; inside each role you first, then the seated by committee
// acronym, country and name (seat/seatOrder, owner 20 Oct 2026), then everyone
// without a seat by name.
// The avatar opens the person's public MUN CV when their account is known
// (CLAUDE.md §8), else the member's pop-up; the name opens the member's pop-up
// (member/MemberDetailsPopup: details and application answers); a committee
// acronym opens the committee's
// pop-up (CommitteePopup: every allocation in the committee, A to Z). Both
// pop-ups are this table's own, so onOpenCommittee is no longer called.
//
// Seats move here (owner, 20 Oct 2026):
//   * Swap allocations (owner, 21 Oct 2026): the header button turns into
//     Cancel in the same place and nothing else moves; two seated people are
//     picked right in the table (anywhere on the row, the allocation cell
//     included) and the swap runs on the second pick, never asked first (it can
//     always be swapped back). While the conference wants to approve swaps the
//     second pick files the request instead. Escape or Cancel leaves the mode.
//   * Drag a seated member's seat onto another person's row (seat/useSeatDrag).
//     Onto a seated row: a switch, asked in place under that row, "Switch" while
//     the conference lets leaders reshuffle (allocation_swap_mode 'self_serve'),
//     "Request switch" while it is 'request' (seat/seatWrites switchSeats, the
//     same writes as Swap allocations; live today). Onto a
//     member with no seat: the seat moves to them (moveSeat, DELEGATIONS_V2_DB and
//     'self_serve' only). The keyboard way is "Switch with…" in the row menu.
//   * "Allocate" in the seat cell for a member with no seat opens the row
//     menu's place step (DELEGATIONS_V2_DB). Unallocate lives only in the
//     three-dots menu (owner, 21 Oct 2026: no icon in the seat cell).
//   * Position paper column (DELEGATIONS_V2_DB, owner 21 Oct 2026): empty for
//     a person with no allocation; for a person with an allocation and no
//     paper yet, the Upload action (thin icon, the word under it,
//     delegation_submit_member_paper through v2.uploadPaperForMember); a paper
//     that is in keeps its word.
// Every seat change shows at once (a patch over the rows, and the Open seats
// card through seat/pendingSeats), then the write; a refusal puts the rows
// back with the server's sentence. Afterwards the card re-reads in place
// (onChanged), never behind a loader.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Crown, FileCheck2, FileText, GraduationCap, Mail, Search, Upload, User, UserX, X } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { committeeDisplayName } from '@/lib/presetNames';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { DELEGATIONS_V2_DB, placeMember, unplaceMember, uploadPaperForMember, type OpenSeat, type Result } from './v2';
import MemberMenu, { type MemberMenuHandle, type MenuMember, type SeatOps, type SwitchTarget } from './MemberMenu';
import { BTN_CLASS, cardStyle, committeeEmblemSrc, CvAvatar, FONT, INK, INK_SOFT, LINE, OK_GREEN, OWE, roleRank, RoundAvatar, secondaryBtn, STROKE } from './leaderKit';
import SeatCell, { type Seat } from './seat/SeatCell';
import InPlaceConfirm from './seat/InPlaceConfirm';
import { useSeatDrag } from './seat/useSeatDrag';
import { useSwapMode } from './seat/useSwapMode';
import { moveSeat, switchSeats } from './seat/seatWrites';
import { addPendingSeats, dropPendingSeats, usePendingOpenSeats, type PendingOpenSeat } from './seat/pendingSeats';
import { compareSeatKeys, sortOpenSeats } from './seat/seatOrder';
import { ROLE_WORD, ToneWord, type PayTone } from './member/memberKit';
import MemberDetailsPopup from './member/MemberDetailsPopup';
import CommitteePopup from './CommitteePopup';

export type { PayTone };

export interface PersonRow {
  application_id: string;
  name: string;
  avatar_url: string | null;
  role: MenuMember['role'];
  is_me: boolean;
  claimed: boolean;
  user_id: string | null;
  attending: boolean;
  seat: {
    country_name: string | null;
    country_code: string | null;
    seatLogo: string | null;
    committee_id: string | null;
    committee_label: string;
    committee_full: string | null;
    emblem: string;
  } | null;
  /** V2 only: the position paper in words, with its tone. */
  paper: { word: string; tone: PayTone } | null;
  /** V2 only: has an allocation and no paper in yet (the cell offers Upload). */
  paperDue?: boolean;
  pay: { word: string; tone: PayTone } | null;
}

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

/** A seated row's place in the seat order. */
const seatKeyOf = (r: PersonRow) => ({ committee: r.seat?.committee_label ?? '', country: r.seat?.country_name ?? '' });

/** The seated in seat order (then name), then the rest by name: the "Switch with" list. */
function bySeat(rows: PersonRow[]): PersonRow[] {
  return [...rows].sort((a, b) => (a.seat ? 0 : 1) - (b.seat ? 0 : 1)
    || (a.seat && b.seat ? compareSeatKeys(seatKeyOf(a), seatKeyOf(b)) : 0)
    || collator.compare(a.name, b.name));
}

/** Faculty advisors, then head delegates, then delegates (CLAUDE.md §8); in
 *  each role you first, then the seated in seat order (then name), then the
 *  rest by name. */
function orderRows(rows: PersonRow[]): PersonRow[] {
  const bucket = (r: PersonRow) => (r.is_me ? 0 : r.seat ? 1 : 2);
  return [...rows].sort((a, b) => {
    const role = roleRank(a.role) - roleRank(b.role);
    if (role !== 0) return role;
    const d = bucket(a) - bucket(b);
    if (d !== 0) return d;
    if (bucket(a) === 1) return compareSeatKeys(seatKeyOf(a), seatKeyOf(b)) || collator.compare(a.name, b.name);
    return collator.compare(a.name, b.name);
  });
}

const ROLE_ICON = { 'faculty-advisor': GraduationCap, 'head-delegate': Crown, delegate: User } as const;

// The seat column is the widest: the 56px flag with its name under it, the
// committee beside it, the seat's icon buttons stacked at its end (V2).
/** Phones: avatar + name block, the paper icon, the menu. The two end
 *  columns have FIXED widths (owner, 22 Oct 2026), so a row never shifts
 *  sideways when the paper action, the swap pick or the menu swap places. */
const GRID_PHONE = DELEGATIONS_V2_DB
  ? 'grid grid-cols-[minmax(0,1fr)_44px_32px] items-center gap-x-2'
  : 'grid grid-cols-[minmax(0,1fr)_32px] items-center gap-x-2';
/** The allocation cell keeps the seated block's height on every seatable row,
 *  so allocating or unallocating never pushes the rows below. */
const SEAT_CELL_MIN_H = 78;
const GRID_V2 = '@[760px]:grid-cols-[minmax(0,1.25fr)_minmax(0,2.1fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_36px]';
const GRID = '@[760px]:grid-cols-[minmax(0,1.35fr)_minmax(0,1.75fr)_minmax(0,0.9fr)_36px]';

/** The position-papers bucket's own limit, checked before the row changes. */
const PAPER_MAX_BYTES = 5 * 1024 * 1024;

interface Patch { op: number; seat?: { v: Seat | null }; paper?: { v: PersonRow['paper'] } }

interface Ask {
  anchor: HTMLElement;
  align: 'start' | 'end';
  title: string;
  line: string | null;
  yes: string;
  danger: boolean;
  onYes: () => void;
}

const seatWords = (s: Seat) => `${s.country_name ?? 'Their allocation'} · ${s.committee_label}`;
const seatLabel = (s: Seat) => `${s.committee_label}: ${s.country_name ?? ''}`;

function seatFromOpen(s: OpenSeat | PendingOpenSeat): Seat {
  const label = (s.abbreviation ?? '').trim() || committeeDisplayName(s.committee, s.abbreviation);
  return {
    country_name: s.country_name,
    country_code: s.country_code,
    seatLogo: s.country_logo_url,
    committee_id: s.conference_committee_id,
    committee_label: label,
    committee_full: s.committee || null,
    emblem: ('emblem' in s && s.emblem) || committeeEmblemSrc(s.logo_url, s.committee, s.abbreviation),
  };
}

/** A seat that has just been emptied, drawn on the Open seats card until the re-read. */
function openFromSeat(s: Seat): PendingOpenSeat {
  return {
    allocation_id: null,
    conference_committee_id: s.committee_id ?? '',
    committee: s.committee_full ?? s.committee_label,
    abbreviation: s.committee_label,
    logo_url: null,
    country_code: s.country_code,
    country_name: s.country_name ?? '',
    country_logo_url: s.seatLogo,
    seat: 1,
    delegation_size: null,
    emblem: s.emblem,
  };
}

export default function PeopleTable({ rows, societyId, societyName, conferenceId, openSeats, onChanged, allocationSwapMode }: {
  rows: PersonRow[];
  societyId: string;
  /** For the swap request's subject; "this delegation" until LeaderCard passes it. */
  societyName?: string;
  conferenceId: string;
  openSeats: OpenSeat[] | null;
  /** No longer called: the committee pop-up is the table's own (it needs the committee id). */
  onOpenCommittee?: (committeeId: string) => void;
  onChanged: () => Promise<void> | void;
  /** conferences.allocation_swap_mode; read here once when not passed. */
  allocationSwapMode?: string;
}) {
  const [query, setQuery] = useState('');
  const mode = useSwapMode(conferenceId, allocationSwapMode);
  const [patches, setPatches] = useState<Map<string, Patch>>(() => new Map());
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const [ask, setAsk] = useState<Ask | null>(null);
  const opSeq = useRef(0);
  const menus = useRef(new Map<string, MemberMenuHandle | null>());
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);
  const pendingOpenSeats = usePendingOpenSeats(societyId, openSeats);
  const shownOpenSeats = useMemo(() => sortOpenSeats(pendingOpenSeats), [pendingOpenSeats]);
  // The member pop-up (application id) and the committee pop-up (conference committee id).
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const [committeeOpen, setCommitteeOpen] = useState<string | null>(null);
  // Swap allocations (owner, 21 Oct 2026): the button turns into Cancel in the
  // same place, nothing else on the card moves; two people are picked right in
  // the table and the swap runs on the second pick, never asked first.
  const [swapOn, setSwapOn] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const swap = useMemo(() => ({ on: swapOn, selected: picked ? [picked] : [] }), [swapOn, picked]);

  // The rows with this table's own changes laid over them.
  const live = useMemo(() => rows.map(r => {
    const p = patches.get(r.application_id);
    if (!p) return r;
    return { ...r, ...(p.seat ? { seat: p.seat.v } : {}), ...(p.paper ? { paper: p.paper.v } : {}) };
  }), [rows, patches]);
  const liveRef = useRef(live);
  useEffect(() => { liveRef.current = live; }, [live]);
  const busyRef = useRef(busy);
  useEffect(() => { busyRef.current = busy; }, [busy]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const ordered = orderRows(live);
    if (!q) return ordered;
    return ordered.filter(r => [r.name, r.seat?.country_name, r.seat?.committee_label, r.seat?.committee_full, ROLE_WORD[r.role]]
      .some(v => (v ?? '').toLowerCase().includes(q)));
  }, [live, query]);

  const canSwitchSeated = mode === 'self_serve' || mode === 'request';
  const canMoveToEmpty = DELEGATIONS_V2_DB && mode === 'self_serve';

  const rowOf = useCallback((id: string) => liveRef.current.find(r => r.application_id === id) ?? null, []);
  const canDragFrom = useCallback((id: string) => {
    const r = rowOf(id);
    return !!r && !swap.on && !busyRef.current.has(id) && r.role !== 'faculty-advisor' && !!r.seat?.committee_id
      && (canSwitchSeated || canMoveToEmpty);
  }, [rowOf, swap.on, canSwitchSeated, canMoveToEmpty]);
  // Whether a seat can be dropped on this person's row (pure, for render too).
  const targetOk = useCallback((t: PersonRow | null, busyNow: Set<string>) => {
    if (!t || t.role === 'faculty-advisor' || busyNow.has(t.application_id)) return false;
    if (t.seat) return canSwitchSeated && !!t.seat.committee_id;
    return canMoveToEmpty;
  }, [canSwitchSeated, canMoveToEmpty]);
  const canDropOn = useCallback((from: string, to: string) => from !== to && targetOk(rowOf(to), busyRef.current), [rowOf, targetOk]);

  /** One seat change: the rows change now, the write runs, a refusal puts them back. */
  const runOp = useCallback(async (o: {
    patch: Record<string, Omit<Patch, 'op'>>;
    pending?: { hide?: string | null; show?: PendingOpenSeat | null };
    work: () => Promise<Result>;
    ok: string;
  }) => {
    const op = ++opSeq.current;
    const ids = Object.keys(o.patch);
    setBusy(prev => new Set([...prev, ...ids]));
    setPatches(prev => {
      const next = new Map(prev);
      for (const id of ids) next.set(id, { ...o.patch[id], op });
      return next;
    });
    if (o.pending) addPendingSeats(op, societyId, o.pending);
    let r: Result;
    try {
      r = await o.work();
    } catch (e) {
      r = { ok: false, error: friendlyError(e, 'That change was not saved. Try again.') };
    }
    if (r.ok) {
      notifyOk(o.ok);
      // A quiet re-read in place; the patch stays until it has landed.
      try { await onChanged(); } catch { /* the patch is dropped; the next read corrects it */ }
    } else {
      notifyErr(r.error);
    }
    setPatches(prev => {
      const next = new Map(prev);
      for (const id of ids) if (next.get(id)?.op === op) next.delete(id);
      return next;
    });
    dropPendingSeats(op);
    setBusy(prev => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  }, [onChanged, societyId]);

  const switchCopy = useCallback((fromId: string, toId: string) => {
    const a = rowOf(fromId);
    const b = rowOf(toId);
    if (!a?.seat || !b) return { title: 'Switch these allocations?', line: null, yes: 'Switch' };
    if (b.seat) {
      return {
        title: `Switch ${seatWords(a.seat)} (${a.name}) and ${seatWords(b.seat)} (${b.name})?`,
        line: mode === 'request' ? 'The organising team gets the request and makes the switch.' : null,
        yes: mode === 'request' ? 'Request switch' : 'Switch',
      };
    }
    return { title: `Move ${seatWords(a.seat)} from ${a.name} to ${b.name}?`, line: `${a.name} stays in the delegation with no allocation.`, yes: 'Move' };
  }, [rowOf, mode]);

  const doSwitch = useCallback((fromId: string, toId: string) => {
    const a = rowOf(fromId);
    const b = rowOf(toId);
    if (!a?.seat || !b || !canDropOn(fromId, toId)) return;
    const aSeat = a.seat;
    if (b.seat) {
      const bSeat = b.seat;
      const sides = {
        a: { applicationId: a.application_id, name: a.name, label: seatLabel(aSeat) },
        b: { applicationId: b.application_id, name: b.name, label: seatLabel(bSeat) },
      };
      if (mode === 'request') {
        // A request moves nothing until the organisers act on it.
        void runOp({
          patch: {},
          work: () => switchSeats({ conferenceId, societyId, societyName: societyName ?? null, mode: 'request', ...sides }),
          ok: 'Switch requested. The organising team will make it.',
        });
        return;
      }
      void runOp({
        patch: { [a.application_id]: { seat: { v: bSeat } }, [b.application_id]: { seat: { v: aSeat } } },
        work: () => switchSeats({ conferenceId, societyId, societyName: societyName ?? null, mode: 'self_serve', ...sides }),
        ok: `${a.name} and ${b.name} switched allocations.`,
      });
      return;
    }
    void runOp({
      patch: { [a.application_id]: { seat: { v: null } }, [b.application_id]: { seat: { v: aSeat } } },
      work: () => moveSeat(a.application_id, b.application_id),
      ok: `${b.name} is now in ${aSeat.country_name ?? 'that allocation'}.`,
    });
  }, [rowOf, canDropOn, mode, runOp, conferenceId, societyId, societyName]);

  // Swap mode: the first pick is held, the second runs the swap at once (the
  // same doSwitch as a drag: perform_delegation_swap while leaders reshuffle,
  // a swap request to the organisers while the conference wants to approve).
  const stopSwap = useCallback(() => { setSwapOn(false); setPicked(null); }, []);
  const pickForSwap = useCallback((id: string) => {
    if (!picked) { setPicked(id); return; }
    if (picked === id) { setPicked(null); return; }
    const from = picked;
    setSwapOn(false);
    setPicked(null);
    doSwitch(from, id);
  }, [picked, doSwitch]);
  useEffect(() => {
    if (!swapOn) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stopSwap(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [swapOn, stopSwap]);

  const askSwitch = useCallback((fromId: string, toId: string, anchor: HTMLElement) => {
    const c = switchCopy(fromId, toId);
    setAsk({ anchor, align: 'start', ...c, danger: false, onYes: () => { setAsk(null); doSwitch(fromId, toId); } });
  }, [switchCopy, doSwitch]);

  const { drag, start, ghost, wasJustDragged } = useSeatDrag({ canDragFrom, canDropOn, onDrop: askSwitch });

  const doPlace = useCallback((id: string, s: OpenSeat) => {
    const r = rowOf(id);
    if (!r || !s.allocation_id) return;
    const allocationId = s.allocation_id;
    void runOp({
      patch: { [id]: { seat: { v: seatFromOpen(s) } } },
      pending: { hide: allocationId, show: r.seat ? openFromSeat(r.seat) : null },
      work: () => placeMember(id, allocationId),
      ok: `${r.name} is now in ${s.country_name}.`,
    });
  }, [rowOf, runOp]);

  const doUnplace = useCallback((id: string) => {
    const r = rowOf(id);
    if (!r?.seat) return;
    void runOp({
      patch: { [id]: { seat: { v: null } } },
      pending: { show: openFromSeat(r.seat) },
      work: () => unplaceMember(id),
      ok: r.is_me ? 'You are unallocated. Your allocation stays with the delegation as an open allocation.' : `${r.name} is unallocated. Their allocation stays with the delegation as an open allocation.`,
    });
  }, [rowOf, runOp]);


  const doUpload = useCallback((id: string, file: File) => {
    const r = rowOf(id);
    if (!r?.seat?.committee_id || !r.user_id) return;
    if (file.type !== 'application/pdf') { notifyErr('Choose a PDF file.'); return; }
    if (file.size > PAPER_MAX_BYTES) { notifyErr('The file is over 5 MB. Choose a smaller PDF.'); return; }
    const committeeId = r.seat.committee_id;
    const userId = r.user_id;
    void runOp({
      patch: { [id]: { paper: { v: { word: 'Submitted', tone: 'ok' } } } },
      work: () => uploadPaperForMember({ conferenceId, committeeId, applicationId: id, memberUserId: userId, file }),
      ok: `Position paper uploaded for ${r.name}.`,
    });
  }, [rowOf, runOp, conferenceId]);

  const pickPaper = useCallback((id: string) => {
    uploadFor.current = id;
    fileRef.current?.click();
  }, []);

  const onPaperPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const id = uploadFor.current;
    uploadFor.current = null;
    if (file && id) doUpload(id, file);
  };

  const closeAsk = useCallback(() => setAsk(null), []);
  const closeDetails = useCallback(() => setDetailsFor(null), []);
  const closeCommittee = useCallback(() => setCommitteeOpen(null), []);
  const openDetails = (e: React.MouseEvent, id: string) => {
    // While picking seats to swap, a press on the person picks the row instead.
    if (swap.on) return;
    e.stopPropagation();
    setDetailsFor(id);
  };

  const detailsRow = detailsFor ? live.find(r => r.application_id === detailsFor) ?? null : null;
  const committeeInfo = committeeOpen ? live.find(r => r.seat?.committee_id === committeeOpen)?.seat ?? null : null;
  const committeePeople = committeeOpen
    ? live.filter(r => r.seat?.committee_id === committeeOpen).map(r => ({
        application_id: r.application_id, name: r.name, avatar_url: r.avatar_url, user_id: r.user_id,
        country_name: r.seat?.country_name ?? null, country_code: r.seat?.country_code ?? null, seatLogo: r.seat?.seatLogo ?? null,
        is_me: r.is_me,
      }))
    : [];
  const committeeOpenSeats = committeeOpen
    ? (shownOpenSeats ?? []).filter(s => s.conference_committee_id === committeeOpen && !!s.country_name)
      .map(s => ({ country_code: s.country_code, country_name: s.country_name }))
    : [];
  const switchOffReason = canSwitchSeated || canMoveToEmpty
    ? 'Nobody to switch with right now'
    : 'Your conference does not let leaders switch allocations';

  const grid = DELEGATIONS_V2_DB ? GRID_V2 : GRID;
  const heads = DELEGATIONS_V2_DB ? ['Person', 'Allocation', 'Position paper', 'Payment'] : ['Person', 'Allocation', 'Payment'];
  const hasOpenSeats = (shownOpenSeats?.length ?? 0) > 0;
  const seatToolsOn = DELEGATIONS_V2_DB && !swap.on;
  const swapHint = !swapOn ? '' : picked ? 'Pick one more' : mode === 'request' ? 'Pick two people to ask for a swap' : 'Pick two people to swap';
  // Both states keep one width, so the search beside them never moves.
  const swapButton = !canSwitchSeated ? null : !swapOn ? (
    <button
      type="button"
      onClick={() => { setSwapOn(true); setPicked(null); setAsk(null); }}
      className={BTN_CLASS}
      style={{ ...secondaryBtn, minHeight: 40, minWidth: 176 }}
    >
      <ArrowLeftRight size={17} strokeWidth={STROKE} aria-hidden /> Swap allocations
    </button>
  ) : (
    <button
      type="button"
      onClick={stopSwap}
      className={BTN_CLASS}
      style={{ ...secondaryBtn, minHeight: 40, minWidth: 176 }}
      title="Leave swap mode"
    >
      <X size={17} strokeWidth={STROKE} aria-hidden /> Cancel
    </button>
  );

  return (
    <section className="@container min-w-0" style={{ ...cardStyle, padding: '8px 0 12px' }} aria-label="People">
      <div className="flex items-center justify-between gap-3 flex-wrap px-4 pt-3.5 pb-3 @[760px]:px-6 @[760px]:pt-4">
        <div className="flex items-baseline gap-3 min-w-0">
          <h2 style={{ fontFamily: FONT, fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>People</h2>
          {/* Swap mode's one hint, on the title's line so nothing below moves;
              read aloud on every width, drawn where the header has room. */}
          <span aria-live="polite" className={swapHint ? 'sr-only @[720px]:not-sr-only' : 'sr-only'} style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>
            {swapHint}
          </span>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
        {rows.length > 4 && (
          <label className="inline-flex items-center gap-2" style={{ height: 40, padding: '0 12px', borderRadius: 10, background: '#F6F2EA', color: INK_SOFT, width: 240, maxWidth: '100%' }}>
            <Search size={17} strokeWidth={STROKE} aria-hidden style={{ flexShrink: 0 }} />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="focus:outline-none"
              style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', fontFamily: FONT, fontSize: 16, color: INK }}
            />
          </label>
        )}
        {swapButton}
        </div>
      </div>

      <div aria-hidden className={`hidden @[760px]:grid ${grid} gap-3`} style={{ padding: '8px 24px', borderBottom: `1px solid ${LINE}` }}>
        {heads.map(h => <span key={h} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: INK_SOFT }}>{h}</span>)}
        <span />
      </div>

      {shown.length === 0 ? (
        <p className="px-4 py-4 @[760px]:px-6" style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0 }}>
          {rows.length === 0 ? 'Nobody has joined yet. Share the invite link to bring your people in.' : 'Nobody matches that search.'}
        </p>
      ) : shown.map(r => {
        const rowBusy = busy.has(r.application_id);
        const selectable = swap.on && !!r.seat?.committee_id && !rowBusy && r.role !== 'faculty-advisor';
        const selected = swap.selected.includes(r.application_id);
        const isTarget = !!drag && drag.over === r.application_id;
        const draggable = !swap.on && !rowBusy && r.role !== 'faculty-advisor' && !!r.seat?.committee_id && (canSwitchSeated || canMoveToEmpty);
        const seatable = r.role !== 'faculty-advisor';
        const switchTargets: SwitchTarget[] = draggable
          ? bySeat(live).filter(o => o.application_id !== r.application_id && targetOk(o, busy)).map(o => ({
              application_id: o.application_id, name: o.name, avatar_url: o.avatar_url,
              seat: o.seat ? { country_name: o.seat.country_name, country_code: o.seat.country_code, seatLogo: o.seat.seatLogo, committee_label: o.seat.committee_label } : null,
            }))
          : [];
        const ops: SeatOps = {
          place: (s) => doPlace(r.application_id, s),
          unplace: () => doUnplace(r.application_id),
          upload: (file) => doUpload(r.application_id, file),
          switchTargets,
          switchCopy: (to) => switchCopy(r.application_id, to),
          switchWith: (to) => doSwitch(r.application_id, to),
          switchOffReason,
        };
        return (
          <div
            key={r.application_id}
            data-seat-target={r.application_id}
            onClick={() => { if (selectable) pickForSwap(r.application_id); }}
            onKeyDown={(e) => { if (selectable && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pickForSwap(r.application_id); } }}
            role={selectable ? 'button' : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-pressed={selectable ? selected : undefined}
            aria-label={selectable ? `${selected ? 'Picked' : 'Pick'} ${r.name}, ${r.seat?.country_name ?? ''} ${r.seat?.committee_label ?? ''}` : undefined}
            className={`relative ${GRID_PHONE} @[760px]:grid ${grid} @[760px]:gap-3 @[760px]:items-center px-4 py-2.5 @[760px]:px-6 @[760px]:py-3`}
            style={{
              borderBottom: `1px solid ${LINE}`,
              background: isTarget ? 'color-mix(in srgb, var(--gv-main) 7%, transparent)' : selected ? 'color-mix(in srgb, var(--gv-main) 6%, transparent)' : r.is_me ? 'color-mix(in srgb, var(--gv-accent-light) 14%, transparent)' : 'transparent',
              boxShadow: isTarget ? 'inset 0 0 0 2px var(--gv-main)' : 'none',
              opacity: !r.attending ? 0.6 : swap.on && !selectable ? 0.45 : 1,
              cursor: selectable ? 'pointer' : 'default',
              transition: 'background-color 120ms ease, box-shadow 120ms ease',
            }}
          >
            {/* Person */}
            <div className="flex items-center gap-3 min-w-0">
              {/* The avatar opens their public MUN CV when the account is known
                  (CLAUDE.md §8), else their details. While swapping, a press
                  anywhere on the row picks it. */}
              {r.user_id && !swap.on ? (
                <>
                  <span className="flex-shrink-0 @[760px]:hidden" style={{ lineHeight: 0 }}>
                    <CvAvatar userId={r.user_id} name={r.name} url={r.avatar_url} size={40} seed={r.application_id} />
                  </span>
                  <span className="flex-shrink-0 hidden @[760px]:inline-flex" style={{ lineHeight: 0 }}>
                    <CvAvatar userId={r.user_id} name={r.name} url={r.avatar_url} size={54} seed={r.application_id} />
                  </span>
                </>
              ) : (
                <button
                  type="button"
                  onClick={(e) => openDetails(e, r.application_id)}
                  aria-label={`See ${r.name}'s details`}
                  title={swap.on ? undefined : 'See details and application'}
                  tabIndex={swap.on ? -1 : 0}
                  className="flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] focus-visible:ring-offset-2"
                  style={{ padding: 0, border: 'none', background: 'transparent', cursor: swap.on ? 'inherit' : 'pointer', lineHeight: 0 }}
                >
                  <span className="@[760px]:hidden"><RoundAvatar name={r.name} url={r.avatar_url} size={40} seed={r.application_id} /></span>
                  <span className="hidden @[760px]:inline"><RoundAvatar name={r.name} url={r.avatar_url} size={54} seed={r.application_id} /></span>
                </button>
              )}
              <div className="min-w-0 flex flex-col gap-0.5">
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK, lineHeight: 1.3 }}>
                  <button
                    type="button"
                    onClick={(e) => openDetails(e, r.application_id)}
                    tabIndex={swap.on ? -1 : 0}
                    className="text-left [overflow-wrap:anywhere] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] hover:underline"
                    style={{ padding: 0, border: 'none', background: 'transparent', font: 'inherit', color: 'inherit', cursor: swap.on ? 'inherit' : 'pointer', textUnderlineOffset: 3 }}
                  >
                    {r.name}
                  </button>
                  {r.is_me && <span style={{ fontSize: 12.5, fontWeight: 600, color: 'color-mix(in srgb, var(--gv-accent) 72%, #1C1410)', marginLeft: 6 }}>You</span>}
                </span>
                <span className="flex items-center flex-wrap gap-x-2.5 gap-y-0.5" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
                  <RoleMark role={r.role} />
                  {/* Phones: the allocation in one line, a small round flag and the committee acronym. */}
                  {r.seat && (
                    <span className="inline-flex items-center gap-1.5 min-w-0 @[760px]:hidden" style={{ color: INK }}>
                      <CircleFlag code={r.seat.country_code} logoUrl={r.seat.seatLogo} label={r.seat.country_name} size={18} decorative />
                      <span className="[overflow-wrap:anywhere]">{r.seat.country_name}</span>
                      {r.seat.committee_id && !swap.on ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); if (r.seat?.committee_id) setCommitteeOpen(r.seat.committee_id); }}
                          className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)]"
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: 'var(--gv-main)', textDecoration: 'underline', textUnderlineOffset: 3 }}
                        >
                          {r.seat.committee_label}
                        </button>
                      ) : (
                        <span style={{ fontWeight: 600 }}>{r.seat.committee_label}</span>
                      )}
                    </span>
                  )}
                  {!r.claimed && (
                    <span className="inline-flex items-center gap-1"><Mail size={14} strokeWidth={STROKE} aria-hidden />Invited</span>
                  )}
                  {!r.attending && (
                    <span className="inline-flex items-center gap-1"><UserX size={14} strokeWidth={STROKE} aria-hidden />Not attending</span>
                  )}
                </span>
              </div>
            </div>

            {/* Seat */}
            <div className="hidden @[760px]:flex items-center min-w-0" style={{ minHeight: seatable ? SEAT_CELL_MIN_H : undefined }}>
              <div className="w-full min-w-0">
              <SeatCell
                seat={r.seat}
                role={r.role}
                draggable={draggable}
                dragging={!!drag && drag.from === r.application_id}
                onDragStart={(e, fromGrip) => {
                  if (!r.seat) return;
                  start(e, r.application_id, {
                    code: r.seat.country_code, logoUrl: r.seat.seatLogo,
                    label: r.seat.country_name ?? r.name, committee: r.seat.committee_label,
                  }, fromGrip);
                }}
                // While swapping, the whole allocation cell picks the row.
                onOpenCommittee={swap.on ? undefined : setCommitteeOpen}
                wasJustDragged={wasJustDragged}
                busy={rowBusy}
                onPlace={seatToolsOn && seatable && !r.seat && hasOpenSeats
                  ? (el) => menus.current.get(r.application_id)?.openAt('place', el)
                  : undefined}
              />
              </div>
            </div>

            {/* Position paper (V2) */}
            {DELEGATIONS_V2_DB && (
              <div className="flex justify-end @[760px]:block">
                {r.paper ? (
                  <>
                    <span className="hidden @[760px]:inline-flex"><ToneWord word={r.paper.word} tone={r.paper.tone} /></span>
                    {r.role !== 'faculty-advisor' && <PaperIcon word={r.paper.word} tone={r.paper.tone} />}
                  </>
                ) : r.paperDue && seatable && r.seat?.committee_id && !swap.on ? (
                  <PaperUpload
                    onPress={() => pickPaper(r.application_id)}
                    disabled={rowBusy || !r.user_id}
                    title={r.user_id ? `Upload a position paper for ${r.name}` : 'They have not joined yet'}
                  />
                ) : null}
              </div>
            )}

            {/* Payment */}
            <div className="hidden @[760px]:block">
              {r.pay && <ToneWord word={r.pay.word} tone={r.pay.tone} />}
            </div>

            {/* Menu, or the swap pick */}
            <div className="flex justify-end">
              {swap.on ? (
                selectable ? (
                  <span aria-hidden className="inline-flex items-center justify-center" style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${selected ? 'var(--gv-main)' : 'color-mix(in srgb, var(--gv-main) 30%, transparent)'}`, background: selected ? 'var(--gv-main)' : 'transparent' }}>
                    {selected && <Check size={12} strokeWidth={2} color="#FFFFFF" aria-hidden />}
                  </span>
                ) : null
              ) : (
                <MemberMenu
                  handleRef={(h) => { if (h) menus.current.set(r.application_id, h); else menus.current.delete(r.application_id); }}
                  member={{
                    application_id: r.application_id, name: r.name, role: r.role, is_me: r.is_me, user_id: r.user_id,
                    seat: r.seat?.committee_id && r.seat.country_code ? { committee_id: r.seat.committee_id, country_code: r.seat.country_code } : null,
                  }}
                  societyId={societyId}
                  conferenceId={conferenceId}
                  openSeats={shownOpenSeats}
                  onDone={onChanged}
                  ops={ops}
                />
              )}
            </div>
          </div>
        );
      })}

      {DELEGATIONS_V2_DB && (
        <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onPaperPicked} />
      )}
      {ghost}
      {ask && (
        <InPlaceConfirm
          anchor={ask.anchor}
          align={ask.align}
          title={ask.title}
          line={ask.line}
          yes={ask.yes}
          danger={ask.danger}
          onYes={ask.onYes}
          onCancel={closeAsk}
        />
      )}
      {detailsRow && <MemberDetailsPopup person={detailsRow} onClose={closeDetails} />}
      {committeeOpen && committeeInfo && (
        <CommitteePopup
          committeeId={committeeOpen}
          name={committeeInfo.committee_full ?? committeeInfo.committee_label}
          abbreviation={committeeInfo.committee_label}
          emblem={committeeInfo.emblem}
          people={committeePeople}
          openSeats={committeeOpenSeats}
          onClose={closeCommittee}
        />
      )}
    </section>
  );
}

/** The Upload action in the position paper column: a thin icon with the word
 *  right under it. */
function PaperUpload({ onPress, disabled, title }: { onPress: () => void; disabled: boolean; title: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (!disabled) onPress(); }}
      aria-disabled={disabled}
      title={title}
      aria-label={title}
      className="inline-flex flex-col items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] hover:bg-[#F1ECE1]"
      style={{ minWidth: 44, minHeight: 44, padding: '4px 8px', gap: 2, borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--gv-main)', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.45 : 1 }}
    >
      <Upload size={20} strokeWidth={STROKE} aria-hidden />
      <span className="hidden @[760px]:inline" style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 600, lineHeight: 1.1 }}>Upload</span>
    </button>
  );
}

/** The role as a thin icon with its word beside it from 760px (phones: the icon alone). */
function RoleMark({ role }: { role: PersonRow['role'] }) {
  const Icon = ROLE_ICON[role] ?? User;
  return (
    <span className="inline-flex items-center gap-1" title={ROLE_WORD[role]}>
      <Icon size={15} strokeWidth={STROKE} aria-hidden style={{ flexShrink: 0 }} />
      <span className="sr-only @[760px]:not-sr-only">{ROLE_WORD[role]}</span>
    </span>
  );
}

/** Phones: the paper's word as one icon in its tone (the word is its title). */
function PaperIcon({ word, tone }: { word: string; tone: 'ok' | 'owe' | 'soft' }) {
  const Icon = tone === 'ok' ? FileCheck2 : FileText;
  return (
    <span className="inline-flex items-center justify-center @[760px]:hidden" title={word} style={{ width: 36, height: 36, color: tone === 'ok' ? OK_GREEN : tone === 'owe' ? OWE : INK_SOFT }}>
      <Icon size={20} strokeWidth={STROKE} aria-hidden />
      <span className="sr-only">Position paper: {word}</span>
    </span>
  );
}
