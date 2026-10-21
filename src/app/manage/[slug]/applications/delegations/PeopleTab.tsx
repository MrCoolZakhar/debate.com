'use client';

// The delegation pop-up's People tab (taste board 3B, owner feedback 20 and 21
// Oct 2026): every member coming or applying, with their role, their allocation
// and where their payment stands, then the delegation's open allocations.
// Organiser screens say "allocation" wherever a seat means an allocation.
//
// The seat column is the leader card's own SeatCell (participant/delegation/
// seat/SeatCell): the country's round flag big with its name under it, the
// committee's emblem smaller beside it with its acronym. Seats move by
// dragging, like the leader card (seat/useSeatDrag), each move asked in place
// (seat/InPlaceConfirm) and shown at once, put back if the write is refused,
// then a quiet re-read (never a loader):
//   * a seat onto a seated member: Switch (perform_delegation_swap; organisers
//     may always switch);
//   * a seat onto a member with no seat: Move, the first person keeps no seat;
//   * a seat onto the Open allocations area (or its Unallocate button, or the
//     row menu's Unallocate): Unallocate, the allocation stays with the
//     delegation as open;
//   * an open allocation onto a member with no seat (or "Allocate"): Allocate.
// Writes: seatWrites.ts (the organiser allocation writes the assignment page
// makes today). Seats only; no money is touched here.
//
// Payment words follow the payments ledger where it decides: "Owes ... fee"
// is an open invoice balance of an accepted member (delegationRows.ts, the
// same rule as conference_money_summary). "Paid" and "Paid by delegation" are
// the member's access flag (`payment_status`, `self_paid`), never a sum.
//
// Each person has a ··· menu (OrganiserMemberMenu, like the leader card's): Make
// head delegate / faculty advisor / delegate (organiser_set_member_role, Christian's,
// its sentence shown as given; a move to or from faculty advisor is asked in place,
// the ticket follows the person), Unallocate (seated people) and Remove from
// delegation (delegation_remove_member). Both wait for DELEGATIONS_MONEY_DB (v2.ts).
//
// "Add a person" in the header opens AddPersonStep as a second step: the
// conference's individual applicants, added through organiser_add_to_delegation
// (Christian's, not built yet: ORGANISER_ADD_TO_DELEGATION_DB in v2.ts, disabled
// with "Coming soon, waiting for Christian" while it is off).
//
// Live: every write runs through data.trackWrite and a drag, a confirm or an
// open menu holds the 10 s re-read back (data.holdLive), so a leader's change
// arrives in place without ever undoing a change made here.
//
// The avatar or the name opens the member's details (the leader card's
// member/MemberDetailsPopup content) as a second step in this pop-up.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { CircleFlag } from '@/components/CircleFlag';
import { friendlyError } from '@/lib/friendlyError';
import { notifyErr, notifyOk } from '@/lib/appNotify';
import { removeMember, type MemberRole } from '@/app/conferences/[slug]/participant/delegation/v2';
import OrganiserMemberMenu from './OrganiserMemberMenu';
import AddPersonStep from './AddPersonStep';
import SeatCell from '@/app/conferences/[slug]/participant/delegation/seat/SeatCell';
import InPlaceConfirm from '@/app/conferences/[slug]/participant/delegation/seat/InPlaceConfirm';
import { useSeatDrag } from '@/app/conferences/[slug]/participant/delegation/seat/useSeatDrag';
import { MemberDetailsBody, MemberDetailsHead } from '@/app/conferences/[slug]/participant/delegation/member/MemberDetailsPopup';
import type { PayTone, PersonRow } from '@/app/conferences/[slug]/participant/delegation/PeopleTable';
import { LIVE, ACCEPTED, memberName, type DelegationMemberLite } from '../delegationRows';
import type { DelegationsData, DelegationView } from './useDelegationsData';
import type { PopupStep } from './DelegationPopup';
import { heldSeats, seatWords, type HeldSeat } from './seatPeople';
import {
  organiserMoveSeat, organiserPlaceInSeat, organiserSwitchSeats, organiserTakeOutOfSeat,
  type PersonSeatResult, type SeatPerson,
} from './seatWrites';
import { ORGANISER_ADD_TO_DELEGATION_DB, WAITING_FOR_CHRISTIAN, organiserSetMemberRole } from './v2';
import {
  BTN_CLASS, CommitteeDisc, FONT, FOREST, HAIRLINE, INK, INK_SOFT, OK_GREEN, OWE, ROW_LINE, RoundAvatar, STROKE,
  smallSecondaryBtn,
} from './kit';

const GRID = 'minmax(0,1.15fr) 180px minmax(0,1.55fr) 150px 36px';

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'delegate', label: 'Delegate' },
  { value: 'head-delegate', label: 'Head delegate' },
  { value: 'faculty-advisor', label: 'Faculty advisor' },
];

const OTHER_ROLE_LABEL: Record<string, string> = {
  observer: 'Observer', chair: 'Chair', secretariat: 'Secretariat',
};

const OPEN_AREA = 'open-seats';
const openId = (allocationId: string) => `open:${allocationId}`;

function roleOf(m: DelegationMemberLite): MemberRole | null {
  if (m.role === 'faculty-advisor') return 'faculty-advisor';
  if (m.role === 'head-delegate' || (m.role === 'delegate' && m.is_head_delegate)) return 'head-delegate';
  if (m.role === 'delegate') return 'delegate';
  return null;
}

function roleLabel(m: DelegationMemberLite): string {
  const r = roleOf(m);
  return r ? ROLE_OPTIONS.find(o => o.value === r)!.label : (OTHER_ROLE_LABEL[m.role] ?? m.role);
}

function paymentOf(m: DelegationMemberLite, owes: boolean): { text: string; color: string; tone: PayTone } {
  if (m.status === 'submitted') return { text: 'Waiting on you', color: '#8A5A12', tone: 'soft' };
  if (owes) {
    const r = roleOf(m);
    const fee = r === 'faculty-advisor' ? 'faculty advisor' : r === 'head-delegate' ? 'head delegate' : 'delegate';
    return { text: `Owes ${fee} fee`, color: OWE, tone: 'owe' };
  }
  if (m.payment_status === 'paid') return { text: m.self_paid ? 'Paid' : 'Paid by delegation', color: OK_GREEN, tone: 'ok' };
  if (m.payment_status === 'waived') return { text: 'Waived', color: OK_GREEN, tone: 'ok' };
  return { text: ACCEPTED.has(m.status) ? 'Not paid yet' : 'Nothing due yet', color: INK_SOFT, tone: 'soft' };
}

interface Ask {
  anchor: HTMLElement;
  align: 'start' | 'end';
  title: string;
  line: string | null;
  yes: string;
  danger: boolean;
  onYes: () => void;
}

/** One optimistic seat change: who sits where until the write and the re-read land. */
interface SeatPatch {
  op: number;
  /** Application id -> the allocation they sit in now (null: no seat). */
  people: Record<string, string | null>;
}

/** Accepted delegates and head delegates take seats; advisors and observers never do. */
function seatable(m: DelegationMemberLite | undefined): boolean {
  return !!m && ACCEPTED.has(m.status) && m.role !== 'faculty-advisor' && m.role !== 'observer';
}

const personOf = (m: DelegationMemberLite): SeatPerson => ({ id: m.id, user_id: m.user_id, status: m.status });
const placeOf = (s: HeldSeat) => ({ allocationId: s.allocationId, committeeId: s.committeeId, countryCode: s.countryCode, countryName: s.countryName });

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

export default function PeopleTab<M extends DelegationMemberLite>({ conferenceId, row, data, onChanged, onStep }: {
  conferenceId: string;
  row: DelegationView<M>;
  data: DelegationsData<M>;
  onChanged?: () => void;
  onStep: (step: PopupStep | null) => void;
}) {
  const { trackWrite, holdLive } = data;
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [patches, setPatches] = useState<SeatPatch[]>([]);
  const [seatBusy, setSeatBusy] = useState<Set<string>>(() => new Set());
  const [ask, setAsk] = useState<Ask | null>(null);
  const opSeq = useRef(0);

  const live = useMemo(() => row.members.filter(m => LIVE.has(m.status)), [row.members]);
  const gone = row.members.length - live.length;
  const memberIds = useMemo(() => new Set(row.members.map(m => m.id)), [row.members]);
  const seats = useMemo(() => heldSeats(data.committees, row.id, memberIds), [data.committees, row.id, memberIds]);
  const seatById = useMemo(() => new Map(seats.map(s => [s.allocationId, s] as const)), [seats]);

  // Who sits where: the read, with this tab's own changes laid over it.
  const seatOfApp = useMemo(() => {
    const map = new Map<string, HeldSeat>();
    for (const s of seats) if (s.applicationId) map.set(s.applicationId, s);
    for (const p of patches) {
      for (const [appId, allocId] of Object.entries(p.people)) {
        if (allocId) {
          const s = seatById.get(allocId);
          if (s) map.set(appId, s);
        } else {
          map.delete(appId);
        }
      }
    }
    return map;
  }, [seats, seatById, patches]);

  // Open: nobody sits in it once this tab's own changes are laid over the read.
  // A seat held by an account with no application row is never offered.
  const openSeats = useMemo(() => {
    const occupied = new Set(Array.from(seatOfApp.values()).map(s => s.allocationId));
    return seats.filter(s => !occupied.has(s.allocationId) && !(s.filled && !s.applicationId));
  }, [seats, seatOfApp]);

  const memberById = useMemo(() => new Map(live.map(m => [m.id, m] as const)), [live]);

  const ordered = useMemo(() => [...live].sort((a, b) => {
    const sa = seatOfApp.get(a.id);
    const sb = seatOfApp.get(b.id);
    if (sa && sb) {
      return collator.compare(sa.seat.committee_label, sb.seat.committee_label)
        || collator.compare(sa.countryName, sb.countryName) || sa.seatNo - sb.seatNo;
    }
    if (sa || sb) return sa ? -1 : 1;
    return collator.compare(memberName(a), memberName(b));
  }), [live, seatOfApp]);

  // Read at event time by the drag rules.
  const stateRef = useRef({ seatOfApp, memberById, openSeats, seatBusy, seatById });
  useEffect(() => { stateRef.current = { seatOfApp, memberById, openSeats, seatBusy, seatById }; }, [seatOfApp, memberById, openSeats, seatBusy, seatById]);

  const canDragFrom = useCallback((id: string) => {
    const st = stateRef.current;
    if (id.startsWith('open:')) {
      const allocId = id.slice(5);
      return !st.seatBusy.has(allocId) && st.openSeats.some(s => s.allocationId === allocId);
    }
    const s = st.seatOfApp.get(id);
    return !!s && !st.seatBusy.has(id) && !st.seatBusy.has(s.allocationId) && seatable(st.memberById.get(id));
  }, []);

  const canDropOn = useCallback((from: string, to: string) => {
    const st = stateRef.current;
    if (from === to) return false;
    if (from.startsWith('open:')) {
      if (to === OPEN_AREA || to.startsWith('open:')) return false;
      return seatable(st.memberById.get(to)) && !st.seatOfApp.has(to) && !st.seatBusy.has(to);
    }
    if (to === OPEN_AREA) return true;
    if (to.startsWith('open:')) return false;
    return seatable(st.memberById.get(to)) && !st.seatBusy.has(to);
  }, []);

  /** One seat change: the rows change now, the write runs, a refusal puts them back. */
  const runSeatOp = useCallback(async (o: { people: Record<string, string | null>; busy: string[]; work: () => Promise<PersonSeatResult>; ok: string }) => {
    const op = ++opSeq.current;
    setSeatBusy(prev => new Set([...prev, ...o.busy]));
    setPatches(prev => [...prev, { op, people: o.people }]);
    let r: PersonSeatResult;
    try {
      r = await trackWrite(o.work);
    } catch (e) {
      r = { ok: false, error: friendlyError(e, 'That change was not saved. Try again.') };
    }
    if (r.ok) {
      notifyOk(o.ok, 'applications');
      // A quiet re-read in place; the patch stays until it has landed.
      onChanged?.();
      try { await data.reload(); } catch { /* the next read corrects it */ }
    } else {
      notifyErr(r.error, 'applications');
    }
    setPatches(prev => prev.filter(p => p.op !== op));
    setSeatBusy(prev => {
      const next = new Set(prev);
      for (const id of o.busy) next.delete(id);
      return next;
    });
  }, [data, onChanged, trackWrite]);

  const doSeatChange = useCallback((from: string, to: string) => {
    const st = stateRef.current;
    // An open seat onto a member with no seat: Place.
    if (from.startsWith('open:')) {
      const seat = st.seatById.get(from.slice(5));
      const m = st.memberById.get(to);
      if (!seat || !m) return;
      void runSeatOp({
        people: { [m.id]: seat.allocationId },
        busy: [m.id, seat.allocationId],
        work: () => organiserPlaceInSeat({ conferenceId, societyId: row.id, seat: placeOf(seat), person: personOf(m) }),
        ok: `${memberName(m)} is now in ${seat.countryName}.`,
      });
      return;
    }
    const a = st.memberById.get(from);
    const aSeat = st.seatOfApp.get(from);
    if (!a || !aSeat) return;
    // A seat onto the open seats: Take out.
    if (to === OPEN_AREA) {
      void runSeatOp({
        people: { [a.id]: null },
        busy: [a.id, aSeat.allocationId],
        work: () => organiserTakeOutOfSeat({ conferenceId, societyId: row.id, seat: placeOf(aSeat), person: personOf(a) }),
        ok: `${memberName(a)} is unallocated from ${aSeat.countryName}. The allocation stays open for ${row.name}.`,
      });
      return;
    }
    const b = st.memberById.get(to);
    if (!b) return;
    const bSeat = st.seatOfApp.get(to);
    if (bSeat) {
      void runSeatOp({
        people: { [a.id]: bSeat.allocationId, [b.id]: aSeat.allocationId },
        busy: [a.id, b.id, aSeat.allocationId, bSeat.allocationId],
        work: () => organiserSwitchSeats(a.id, b.id),
        ok: `${memberName(a)} and ${memberName(b)} switched allocations.`,
      });
      return;
    }
    void runSeatOp({
      people: { [a.id]: null, [b.id]: aSeat.allocationId },
      busy: [a.id, b.id, aSeat.allocationId],
      work: () => organiserMoveSeat({ conferenceId, societyId: row.id, seat: placeOf(aSeat), from: personOf(a), to: personOf(b) }),
      ok: `${memberName(b)} is now in ${aSeat.countryName}.`,
    });
  }, [runSeatOp, conferenceId, row.id, row.name]);

  const askSeatChange = useCallback((from: string, to: string, anchor: HTMLElement) => {
    const st = stateRef.current;
    const go = () => { setAsk(null); doSeatChange(from, to); };
    if (from.startsWith('open:')) {
      const seat = st.seatById.get(from.slice(5));
      const m = st.memberById.get(to);
      if (!seat || !m) return;
      setAsk({ anchor, align: 'start', title: `Allocate ${memberName(m)} to ${seatWords(seat)}?`, line: null, yes: 'Allocate', danger: false, onYes: go });
      return;
    }
    const a = st.memberById.get(from);
    const aSeat = st.seatOfApp.get(from);
    if (!a || !aSeat) return;
    if (to === OPEN_AREA) {
      setAsk({ anchor, align: 'start', title: `Unallocate ${memberName(a)} from ${seatWords(aSeat)}?`, line: 'The allocation stays with the delegation as an open allocation.', yes: 'Unallocate', danger: true, onYes: go });
      return;
    }
    const b = st.memberById.get(to);
    if (!b) return;
    const bSeat = st.seatOfApp.get(to);
    if (bSeat) {
      setAsk({ anchor, align: 'start', title: `Switch ${seatWords(aSeat)} (${memberName(a)}) and ${seatWords(bSeat)} (${memberName(b)})?`, line: null, yes: 'Switch', danger: false, onYes: go });
      return;
    }
    setAsk({ anchor, align: 'start', title: `Move ${seatWords(aSeat)} from ${memberName(a)} to ${memberName(b)}?`, line: `${memberName(a)} stays in the delegation with no allocation.`, yes: 'Move', danger: false, onYes: go });
  }, [doSeatChange]);

  const { drag, start, ghost, wasJustDragged } = useSeatDrag({ canDragFrom, canDropOn, onDrop: askSeatChange });
  const closeAsk = useCallback(() => setAsk(null), []);

  // A drag, a confirm or an open menu holds the live re-read back.
  const holding = !!drag || !!ask || menuOpenId !== null;
  useEffect(() => {
    holdLive('people-tab', holding);
  }, [holdLive, holding]);
  useEffect(() => () => holdLive('people-tab', false), [holdLive]);

  async function changeRole(m: M, role: MemberRole) {
    const r = await trackWrite(() => organiserSetMemberRole(m.id, role));
    if (!r.ok) return r;
    notifyOk(`${memberName(m)} is now a ${ROLE_OPTIONS.find(o => o.value === role)!.label.toLowerCase()}.`, 'applications');
    onChanged?.();
    void data.reload();
    return r;
  }

  async function remove(m: M) {
    const r = await trackWrite(() => removeMember(m.id));
    if (!r.ok) return r;
    notifyOk(`${memberName(m)} left ${row.name}.`, 'applications');
    onChanged?.();
    void data.reload();
    return r;
  }

  function openAddStep() {
    if (!ORGANISER_ADD_TO_DELEGATION_DB) return;
    onStep({
      title: `Add a person to ${row.name}`,
      body: (
        <AddPersonStep
          conferenceId={conferenceId}
          societyId={row.id}
          delegationName={row.name}
          trackWrite={trackWrite}
          onAdded={() => { onStep(null); onChanged?.(); void data.reload(); }}
        />
      ),
    });
  }

  function personRowOf(m: M): PersonRow {
    const held = seatOfApp.get(m.id);
    const pay = paymentOf(m, row.owingMemberIds.includes(m.id));
    return {
      application_id: m.id,
      name: memberName(m),
      avatar_url: m.profiles?.avatar_url ?? null,
      role: roleOf(m) ?? 'delegate',
      is_me: false,
      claimed: !!m.user_id,
      user_id: m.user_id,
      attending: m.attending,
      seat: held?.seat ?? null,
      paper: null,
      pay: { word: pay.text, tone: pay.tone },
    };
  }

  function openDetails(m: M) {
    const person = personRowOf(m);
    onStep({
      title: '',
      body: (
        <div style={{ maxWidth: 640 }}>
          <MemberDetailsHead person={person} />
          <MemberDetailsBody person={person} />
        </div>
      ),
    });
  }

  function openPlaceStep(m: M) {
    const name = memberName(m);
    onStep({
      title: `Allocate ${name}`,
      body: (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {openSeats.map(s => (
            <button
              key={s.allocationId}
              type="button"
              onClick={() => { onStep(null); doSeatChange(openId(s.allocationId), m.id); }}
              className={`${BTN_CLASS} flex items-center gap-3 text-left`}
              style={{ padding: '12px 14px', borderRadius: 14, border: `1px solid ${HAIRLINE}`, background: '#FFFFFF', cursor: 'pointer' }}
            >
              <CircleFlag code={s.countryCode} logoUrl={s.seat.seatLogo} label={s.countryName} size={36} decorative />
              <span className="flex flex-col min-w-0" style={{ gap: 3 }}>
                <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{s.countryName}</span>
                <span className="inline-flex items-center gap-1.5" title={s.seat.committee_full ?? undefined}>
                  <CommitteeDisc src={s.seat.emblem} size={18} />
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>{s.seat.committee_label}</span>
                </span>
              </span>
            </button>
          ))}
        </div>
      ),
    });
  }

  const addButton = (
    <button
      type="button"
      onClick={ORGANISER_ADD_TO_DELEGATION_DB ? openAddStep : (e) => e.preventDefault()}
      aria-disabled={ORGANISER_ADD_TO_DELEGATION_DB ? undefined : true}
      title={ORGANISER_ADD_TO_DELEGATION_DB ? undefined : WAITING_FOR_CHRISTIAN}
      className={BTN_CLASS}
      style={{ ...smallSecondaryBtn, opacity: ORGANISER_ADD_TO_DELEGATION_DB ? 1 : 0.45, cursor: ORGANISER_ADD_TO_DELEGATION_DB ? 'pointer' : 'default' }}
    >
      <Plus size={16} strokeWidth={STROKE} aria-hidden /> Add a person
    </button>
  );

  if (live.length === 0 && openSeats.length === 0) {
    return (
      <div style={{ padding: '24px 28px' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>Nobody has joined yet</p>
            <p style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, marginTop: 4 }}>People appear here once they apply with this delegation or join through its invite link.</p>
          </div>
          {addButton}
        </div>
      </div>
    );
  }
  const openAreaTarget = !!drag && !drag.from.startsWith('open:');
  const openAreaOver = !!drag && drag.over === OPEN_AREA;

  return (
    <div className="flex-1 min-h-0 overflow-auto" style={{ padding: '6px 0 16px' }}>
      <div style={{ minWidth: 900 }}>
        <div className="flex items-center justify-between gap-4" style={{ padding: '10px 28px 2px' }}>
          <span style={{ fontFamily: FONT, fontSize: 14, color: INK_SOFT, fontVariantNumeric: 'tabular-nums' }}>
            {live.length === 1 ? '1 person' : `${live.length} people`}
          </span>
          {addButton}
        </div>
        <div className="grid" style={{ gridTemplateColumns: GRID, gap: 16, padding: '10px 28px' }}>
          {['Person', 'Role', 'Allocation', 'Payment', ''].map((h, i) => (
            <span key={i} style={{ fontFamily: FONT, fontSize: 12, fontWeight: 500, color: INK_SOFT }}>{h}</span>
          ))}
        </div>
        {live.length === 0 && (
          <p style={{ borderTop: `1px solid ${ROW_LINE}`, padding: '16px 28px', fontFamily: FONT, fontSize: 14, color: INK_SOFT }}>Nobody has joined yet.</p>
        )}
        {ordered.map(m => {
          const name = memberName(m);
          const email = m.profiles?.email || m.invited_email || '';
          const held = seatOfApp.get(m.id) ?? null;
          const pay = paymentOf(m, row.owingMemberIds.includes(m.id));
          const role = roleOf(m);
          const canSeat = seatable(m);
          const rowBusy = seatBusy.has(m.id) || (!!held && seatBusy.has(held.allocationId));
          const draggable = !!held && canSeat && !rowBusy;
          const isTarget = !!drag && drag.over === m.id;
          return (
            <div
              key={m.id}
              data-seat-target={m.id}
              style={{
                borderTop: `1px solid ${ROW_LINE}`,
                background: isTarget ? 'rgba(27,56,40,0.06)' : menuOpenId === m.id ? '#FAF7F0' : 'transparent',
                boxShadow: isTarget ? `inset 0 0 0 2px ${FOREST}` : 'none',
                opacity: m.attending ? 1 : 0.6,
                transition: 'background-color 120ms ease, box-shadow 120ms ease',
              }}
            >
              <div className="grid items-center" style={{ gridTemplateColumns: GRID, gap: 16, padding: '12px 28px' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => openDetails(m)}
                    aria-label={`See ${name}'s details`}
                    title="See details and application"
                    className="flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] focus-visible:ring-offset-2"
                    style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', lineHeight: 0 }}
                  >
                    <RoundAvatar name={name} url={m.profiles?.avatar_url ?? null} size={50} seed={m.id} />
                  </button>
                  <div className="flex flex-col min-w-0" style={{ gap: 1 }}>
                    <button
                      type="button"
                      onClick={() => openDetails(m)}
                      className="text-left [overflow-wrap:anywhere] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gv-main)] hover:underline"
                      style={{ padding: 0, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK, textUnderlineOffset: 3 }}
                    >
                      {name}
                    </button>
                    {email && email !== name && (
                      <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12, color: INK_SOFT }}>{email}</span>
                    )}
                  </div>
                </div>

                <span style={{ fontFamily: FONT, fontSize: 14, color: INK }}>{roleLabel(m)}</span>

                <div className="min-w-0">
                  <SeatCell
                    seat={held?.seat ?? null}
                    role={role ?? 'delegate'}
                    draggable={draggable}
                    dragging={!!drag && drag.from === m.id}
                    onDragStart={(e, fromGrip) => {
                      if (!held) return;
                      start(e, m.id, { code: held.countryCode, logoUrl: held.seat.seatLogo, label: held.countryName, committee: held.seat.committee_label }, fromGrip);
                    }}
                    wasJustDragged={wasJustDragged}
                    busy={rowBusy}
                    onTakeOut={held && canSeat ? (el) => {
                      setAsk({
                        anchor: el, align: 'end',
                        title: `Unallocate ${name} from ${seatWords(held)}?`,
                        line: 'The allocation stays with the delegation as an open allocation.',
                        yes: 'Unallocate', danger: true,
                        onYes: () => { setAsk(null); doSeatChange(m.id, OPEN_AREA); },
                      });
                    } : undefined}
                    onPlace={!held && canSeat && openSeats.length > 0 ? () => openPlaceStep(m) : undefined}
                  />
                </div>

                <span style={{ fontFamily: FONT, fontSize: 14, color: pay.color }}>{pay.text}</span>

                <div className="flex justify-end">
                  <OrganiserMemberMenu
                    name={name}
                    role={role}
                    canChangeRole={ACCEPTED.has(m.status)}
                    allocationWords={held && canSeat && !rowBusy ? seatWords(held) : null}
                    delegationName={row.name}
                    onRole={next => changeRole(m, next)}
                    onRemove={() => remove(m)}
                    onUnallocate={() => doSeatChange(m.id, OPEN_AREA)}
                    onOpenChange={o => setMenuOpenId(prev => (o ? m.id : prev === m.id ? null : prev))}
                    disabled={rowBusy}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {gone > 0 && (
          <p style={{ borderTop: `1px solid ${HAIRLINE}`, padding: '14px 28px', fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
            {gone === 1 ? '1 more person was turned down or withdrew.' : `${gone} more people were turned down or withdrew.`}
          </p>
        )}

        {/* Open allocations: drag one onto a person to allocate them, or a person's allocation here to unallocate them. */}
        {(seats.length > 0 || openAreaTarget) && (
          <div
            data-seat-target={OPEN_AREA}
            style={{
              margin: '14px 28px 0', padding: '16px 18px', borderRadius: 16,
              background: openAreaOver ? 'rgba(27,56,40,0.06)' : '#FCFAF6',
              boxShadow: openAreaOver ? `inset 0 0 0 2px ${FOREST}` : openAreaTarget ? `inset 0 0 0 1.5px rgba(27,56,40,0.35)` : `inset 0 0 0 1px ${HAIRLINE}`,
              transition: 'background-color 120ms ease, box-shadow 120ms ease',
            }}
          >
            <div className="flex items-baseline gap-2 flex-wrap" style={{ marginBottom: openSeats.length > 0 ? 12 : 4 }}>
              <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>Open allocations</span>
              <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>
                {openSeats.length > 0 ? 'Drag one onto a person to allocate them' : 'None. Drag an allocation here to unallocate someone'}
              </span>
            </div>
            {openSeats.length > 0 && (
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
                {openSeats.map(s => {
                  const id = openId(s.allocationId);
                  const busy = seatBusy.has(s.allocationId);
                  return (
                    <div
                      key={s.allocationId}
                      onPointerDown={busy ? undefined : (e) => start(e, id, { code: s.countryCode, logoUrl: s.seat.seatLogo, label: s.countryName, committee: s.seat.committee_label }, e.pointerType === 'touch')}
                      title="Drag onto a person to allocate them"
                      className="flex items-center gap-3 min-w-0"
                      style={{
                        padding: '10px 12px', borderRadius: 12, background: '#FFFFFF', border: '1.5px dashed rgba(27,56,40,0.28)',
                        cursor: busy ? 'progress' : 'grab', touchAction: 'none', opacity: drag?.from === id || busy ? 0.45 : 1,
                      }}
                    >
                      <CircleFlag code={s.countryCode} logoUrl={s.seat.seatLogo} label={s.countryName} size={36} decorative />
                      <span className="flex flex-col min-w-0" style={{ gap: 3 }}>
                        <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: INK }}>{s.countryName}</span>
                        <span className="inline-flex items-center gap-1.5 min-w-0" title={s.seat.committee_full ?? undefined}>
                          <CommitteeDisc src={s.seat.emblem} size={18} />
                          <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 12.5, color: INK_SOFT }}>{s.seat.committee_label}</span>
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

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
    </div>
  );
}
