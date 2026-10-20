'use client';

// The People table of the leader card (taste board 1A): one row per member,
// person (photo or initials, name, role in plain words), seat (seat/SeatCell:
// the country's round flag big with its name under it, the committee's emblem
// smaller beside it with the acronym that opens the committee, owner 20 Oct
// 2026), position paper (V2 only), payment, and the row menu.
// From 760px of card width it is a table; below it every row stacks.
// Names wrap, never an ellipsis (CLAUDE.md §8).
// Order (owner, 20 Oct 2026, "the committees should always be alphabetical
// within the allocations"): you first, then the seated by committee acronym,
// country and name (seat/seatOrder), then everyone without a seat as read.
// The avatar and the name open the member's pop-up (member/MemberDetailsPopup:
// details and application answers); a committee acronym opens the committee's
// pop-up (CommitteePopup, the whole committee under DELEGATIONS_V2_DB). Both
// pop-ups are this table's own, so onOpenCommittee is no longer called.
//
// Seats move here (owner, 20 Oct 2026):
//   * Drag a seated member's seat onto another person's row (seat/useSeatDrag).
//     Onto a seated row: a switch, asked in place under that row, "Switch" while
//     the conference lets leaders reshuffle (allocation_swap_mode 'self_serve'),
//     "Request switch" while it is 'request' (seat/seatWrites switchSeats, the
//     same writes as DelegationPanel's Swap allocations; live today). Onto a
//     member with no seat: the seat moves to them (moveSeat, DELEGATIONS_V2_DB and
//     'self_serve' only). The keyboard way is "Switch with…" in the row menu.
//   * The seat cell's icon buttons, DELEGATIONS_V2_DB only: Upload position paper
//     and Take out of seat (asked in place); "Place in a seat" for a member with
//     no seat opens the row menu's place step.
// Every seat change shows at once (a patch over the rows, and the Open seats
// card through seat/pendingSeats), then the write; a refusal puts the rows
// back with the server's sentence. Afterwards the card re-reads in place
// (onChanged), never behind a loader.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Mail, Search, UserX } from 'lucide-react';
import { committeeDisplayName } from '@/lib/presetNames';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { DELEGATIONS_V2_DB, placeMember, unplaceMember, uploadPaperForMember, type OpenSeat, type Result } from './v2';
import MemberMenu, { type MemberMenuHandle, type MenuMember, type SeatOps, type SwitchTarget } from './MemberMenu';
import { cardStyle, committeeEmblemSrc, FONT, FOREST, INK, INK_SOFT, LINE, RoundAvatar, STROKE } from './leaderKit';
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

/** You first, then the seated in seat order (then name), then the rest as read. */
function orderRows(rows: PersonRow[]): PersonRow[] {
  const index = new Map(rows.map((r, i) => [r.application_id, i] as const));
  const bucket = (r: PersonRow) => (r.is_me ? 0 : r.seat ? 1 : 2);
  return [...rows].sort((a, b) => {
    const d = bucket(a) - bucket(b);
    if (d !== 0) return d;
    if (bucket(a) === 1) return compareSeatKeys(seatKeyOf(a), seatKeyOf(b)) || collator.compare(a.name, b.name);
    return (index.get(a.application_id) ?? 0) - (index.get(b.application_id) ?? 0);
  });
}

// The seat column is the widest: the 56px flag with its name under it, the
// committee beside it, the seat's icon buttons stacked at its end (V2).
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

const seatWords = (s: Seat) => `${s.country_name ?? 'Their seat'} · ${s.committee_label}`;
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

export default function PeopleTable({ rows, societyId, societyName, conferenceId, openSeats, onChanged, swap, allocationSwapMode }: {
  rows: PersonRow[];
  societyId: string;
  /** For the swap request's subject; "this delegation" until LeaderCard passes it. */
  societyName?: string;
  conferenceId: string;
  openSeats: OpenSeat[] | null;
  /** No longer called: the committee pop-up is the table's own (it needs the committee id). */
  onOpenCommittee?: (committeeId: string) => void;
  onChanged: () => Promise<void> | void;
  /** The existing allocation swap: while on, seated rows are picked instead of the menu. */
  swap: { on: boolean; selected: string[]; toggle: (applicationId: string) => void };
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
    if (!a?.seat || !b) return { title: 'Switch these seats?', line: null, yes: 'Switch' };
    if (b.seat) {
      return {
        title: `Switch ${seatWords(a.seat)} (${a.name}) and ${seatWords(b.seat)} (${b.name})?`,
        line: mode === 'request' ? 'The organising team gets the request and makes the switch.' : null,
        yes: mode === 'request' ? 'Request switch' : 'Switch',
      };
    }
    return { title: `Move ${seatWords(a.seat)} from ${a.name} to ${b.name}?`, line: `${a.name} stays in the delegation with no seat.`, yes: 'Move' };
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
        ok: `${a.name} and ${b.name} switched seats.`,
      });
      return;
    }
    void runOp({
      patch: { [a.application_id]: { seat: { v: null } }, [b.application_id]: { seat: { v: aSeat } } },
      work: () => moveSeat(a.application_id, b.application_id),
      ok: `${b.name} is now in ${aSeat.country_name ?? 'that seat'}.`,
    });
  }, [rowOf, canDropOn, mode, runOp, conferenceId, societyId, societyName]);

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
      ok: r.is_me ? 'You are out of your seat. It stays open for the delegation.' : `${r.name} is out of their seat. It stays open for the delegation.`,
    });
  }, [rowOf, runOp]);

  const askUnplace = useCallback((id: string, anchor: HTMLElement) => {
    const r = rowOf(id);
    if (!r?.seat) return;
    setAsk({
      anchor, align: 'end',
      title: r.is_me ? 'Take yourself out of your seat?' : `Take ${r.name} out of their seat?`,
      line: 'The seat stays with the delegation as an open seat.',
      yes: 'Take out of seat', danger: true,
      onYes: () => { setAsk(null); doUnplace(id); },
    });
  }, [rowOf, doUnplace]);

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
        application_id: r.application_id, name: r.name, avatar_url: r.avatar_url,
        country_name: r.seat?.country_name ?? null, country_code: r.seat?.country_code ?? null, seatLogo: r.seat?.seatLogo ?? null,
      }))
    : [];
  const switchOffReason = canSwitchSeated || canMoveToEmpty
    ? 'Nobody to switch with right now'
    : 'Your conference does not let leaders switch seats';

  const grid = DELEGATIONS_V2_DB ? GRID_V2 : GRID;
  const heads = DELEGATIONS_V2_DB ? ['Person', 'Seat', 'Position paper', 'Payment'] : ['Person', 'Seat', 'Payment'];
  const hasOpenSeats = (shownOpenSeats?.length ?? 0) > 0;
  const seatToolsOn = DELEGATIONS_V2_DB && !swap.on;

  return (
    <section className="@container min-w-0" style={{ ...cardStyle, padding: '8px 0 12px' }} aria-label="People">
      <div className="flex items-center justify-between gap-3 flex-wrap" style={{ padding: '16px 24px 12px' }}>
        <h2 style={{ fontFamily: FONT, fontSize: 19, fontWeight: 600, color: INK, margin: 0 }}>People</h2>
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
      </div>

      <div aria-hidden className={`hidden @[760px]:grid ${grid} gap-3`} style={{ padding: '8px 24px', borderBottom: `1px solid ${LINE}` }}>
        {heads.map(h => <span key={h} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: INK_SOFT }}>{h}</span>)}
        <span />
      </div>

      {shown.length === 0 ? (
        <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, margin: 0, padding: '18px 24px' }}>
          {rows.length === 0 ? 'Nobody has joined yet. Share the invite link to bring your people in.' : 'Nobody matches that search.'}
        </p>
      ) : shown.map(r => {
        const selectable = swap.on && !!r.seat?.committee_id;
        const selected = swap.selected.includes(r.application_id);
        const rowBusy = busy.has(r.application_id);
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
            onClick={() => { if (selectable) swap.toggle(r.application_id); }}
            className={`relative flex flex-col gap-3 @[760px]:grid ${grid} @[760px]:gap-3 @[760px]:items-center`}
            style={{
              padding: '12px 24px', borderBottom: `1px solid ${LINE}`,
              background: isTarget ? 'color-mix(in srgb, var(--gv-main) 7%, transparent)' : selected ? 'color-mix(in srgb, var(--gv-main) 6%, transparent)' : r.is_me ? 'color-mix(in srgb, var(--gv-accent-light) 14%, transparent)' : 'transparent',
              boxShadow: isTarget ? `inset 0 0 0 2px ${FOREST}` : 'none',
              opacity: !r.attending ? 0.6 : swap.on && !selectable ? 0.45 : 1,
              cursor: selectable ? 'pointer' : 'default',
              transition: 'background-color 120ms ease, box-shadow 120ms ease',
            }}
          >
            {/* Person */}
            <div className="flex items-center gap-3 min-w-0 pr-10 @[760px]:pr-0">
              <button
                type="button"
                onClick={(e) => openDetails(e, r.application_id)}
                aria-label={`See ${r.name}'s details`}
                title={swap.on ? undefined : 'See details and application'}
                tabIndex={swap.on ? -1 : 0}
                className="flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] focus-visible:ring-offset-2"
                style={{ padding: 0, border: 'none', background: 'transparent', cursor: swap.on ? 'inherit' : 'pointer', lineHeight: 0 }}
              >
                <RoundAvatar name={r.name} url={r.avatar_url} size={54} seed={r.application_id} />
              </button>
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
                  {ROLE_WORD[r.role]}
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
            <div className="min-w-0 pl-[54px] @[760px]:pl-0">
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
                onOpenCommittee={setCommitteeOpen}
                wasJustDragged={wasJustDragged}
                busy={rowBusy}
                onTakeOut={seatToolsOn && seatable && r.seat && mode === 'self_serve' ? (el) => askUnplace(r.application_id, el) : undefined}
                onUpload={seatToolsOn && seatable && r.seat?.committee_id && r.user_id ? () => pickPaper(r.application_id) : undefined}
                onPlace={seatToolsOn && seatable && !r.seat && hasOpenSeats
                  ? (el) => menus.current.get(r.application_id)?.openAt('place', el)
                  : undefined}
              />
            </div>

            {/* Position paper (V2) */}
            {DELEGATIONS_V2_DB && (
              <div className="pl-[66px] @[760px]:pl-0">
                {r.paper && <ToneWord word={r.paper.word} tone={r.paper.tone} />}
              </div>
            )}

            {/* Payment */}
            <div className="pl-[66px] @[760px]:pl-0">
              {r.pay && <ToneWord word={r.pay.word} tone={r.pay.tone} />}
            </div>

            {/* Menu, or the swap pick */}
            <div className="absolute right-6 top-[23px] @[760px]:static flex justify-end">
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
          onClose={closeCommittee}
        />
      )}
    </section>
  );
}
