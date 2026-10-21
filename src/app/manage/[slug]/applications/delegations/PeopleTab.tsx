'use client';

// The delegation pop-up's People tab (taste board 3B, owner feedback 20 and 21
// Oct 2026): every member coming or applying, with their role, their allocation
// and where their payment stands. Open allocations live only in the
// Allocations tab (owner, 21 Oct 2026); here an empty allocation is reached
// through a person's "Allocate" (a second step listing them).
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
//   * the row menu's Unallocate (the seat cell has no button of its own):
//     Unallocate, the allocation stays with the delegation as open;
//   * "Allocate" on a member with no seat: Allocate, from a second step that
//     lists the delegation's open allocations.
// Writes: seatWrites.ts (the organiser allocation writes the assignment page
// makes today). Seats only; no money is touched here.
//
// Payment words: one vocabulary from the person's own invoices (paymentOf below
// explains the rule): Owes <role> fee, Paid by delegation, Delegation hasn't
// paid yet, Paid, Waived, Nothing due yet. Never a sum.
//
// Each person has a ··· menu (OrganiserMemberMenu, like the leader card's): Make
// head delegate / faculty advisor / delegate (organiser_set_member_role, Christian's,
// its sentence shown as given; a move to or from faculty advisor is asked in place,
// the ticket follows the person), Unallocate (seated people) and Remove from
// delegation (delegation_remove_member). Both wait for DELEGATIONS_MONEY_DB (v2.ts).
//
// "Add a person" in the header opens AddPersonStep as a second step: the
// conference's accepted individual delegates, added through
// organiser_add_to_delegation (Christian's, live 21 Oct 2026:
// ORGANISER_ADD_TO_DELEGATION_DB in v2.ts); after a success the step closes
// and the delegation and the page's applications are re-read.
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
import type { DelegationsData, DelegationView, InvoiceRow } from './useDelegationsData';
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

/** The person's own invoices: everything in their name except what they hold for
 *  the delegation (the tickets a leader buys, `pledge_spot` / `advisor_spot`, and
 *  any other item carrying the delegation's society_id, such as a per-delegation
 *  registration fee), which lives in the Payments tab. */
const TICKET_KINDS = new Set(['pledge_spot', 'advisor_spot']);
const OPEN_STATUSES = new Set(['open', 'partial']);

type OwnInvoice = Pick<InvoiceRow, 'kind' | 'status' | 'amount_cents' | 'amount_paid_cents'>;

interface PayWord { text: string; color: string; tone: PayTone }

/** Amber: a delegation ticket covers the person but the delegation has not paid it yet. */
const AMBER = '#A8670A';

// ONE payment vocabulary for the People tab (owner, 21 Oct 2026: "Not paid yet"
// and "Owes head delegate fee" side by side made no sense). What separated them:
// "Owes ... fee" was any open ledger balance in the person's name, including a
// leader's unpaid delegation tickets, and "Not paid yet" was everyone else whose
// access flag was not paid, which in practice was a delegate COVERED by one of
// the delegation's tickets (their own fee is a 0 "Covered by your delegation"
// invoice, status waived) while that ticket is still unpaid. The words now:
//   1. Owes <role> fee        their OWN fee invoice (role_fee) has an open or
//                             partial balance; other own items left open are
//                             named after it ("and registration fee", "and
//                             extras"). Delegation tickets and other items
//                             carrying the delegation never count here.
//      Owes registration fee  / Owes extras: only those are open.
//   2. Waived                 the organiser waived their fee (payment_status
//                             'waived', written only by the fee-waiver RPCs).
//   3. A delegation ticket covers them: their own fee invoice is waived because
//      a delegation ticket covers it (or there is none and the access flag says
//      paid by someone else). fin_pledge_covers covers the earliest delegates
//      whether or not the ticket is paid, and the flag turns paid only when
//      that ticket settles, so (owner, 21 Oct 2026: "Covered by delegation" +
//      "Ticket not paid yet" confused him) it reads as ONE plain line:
//        Paid by delegation          the covering ticket is paid (flag 'paid')
//        Delegation hasn't paid yet  the covering ticket is not paid yet (amber)
//   4. Paid                   their own fee invoice is settled, or no invoice and
//                             the flag says they paid it themselves.
//   5. Nothing due yet        no fee invoice yet (payments not set up, or not
//                             accepted); "Waiting on you" while the application
//                             waits for the organiser.
// Money is never computed from payment_status: it only picks between words the
// ledger leaves open (covered ticket paid or not, a waiver, an old row with no
// invoice), as it did before.
function paymentOf(m: DelegationMemberLite, own: OwnInvoice[]): PayWord {
  if (m.status === 'submitted') return { text: 'Waiting on you', color: '#8A5A12', tone: 'soft' };
  const accepted = ACCEPTED.has(m.status);
  const open = accepted ? own.filter(i => OPEN_STATUSES.has(i.status) && i.amount_cents - i.amount_paid_cents > 0) : [];
  if (open.length > 0) {
    const r = roleOf(m);
    const parts: string[] = [];
    if (open.some(i => i.kind === 'role_fee')) {
      parts.push(`${r === 'faculty-advisor' ? 'faculty advisor' : r === 'head-delegate' ? 'head delegate' : 'delegate'} fee`);
    }
    if (open.some(i => i.kind === 'app_fee')) parts.push('registration fee');
    if (open.some(i => i.kind !== 'role_fee' && i.kind !== 'app_fee')) parts.push('extras');
    return { text: `Owes ${parts.join(' and ')}`, color: OWE, tone: 'owe' };
  }
  if (m.payment_status === 'waived') return { text: 'Waived', color: OK_GREEN, tone: 'ok' };
  const fee = own.filter(i => i.kind === 'role_fee' && i.status !== 'void');
  const covered = fee.some(i => i.status === 'waived')
    || (fee.length === 0 && m.payment_status === 'paid' && !m.self_paid);
  if (covered) {
    return m.payment_status === 'paid'
      ? { text: 'Paid by delegation', color: OK_GREEN, tone: 'ok' }
      : { text: "Delegation hasn't paid yet", color: AMBER, tone: 'owe' };
  }
  if (fee.some(i => i.status === 'settled') || (fee.length === 0 && m.payment_status === 'paid')) {
    return { text: 'Paid', color: OK_GREEN, tone: 'ok' };
  }
  return { text: 'Nothing due yet', color: INK_SOFT, tone: 'soft' };
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

  // Each member's own invoices (paymentOf), from the ledger the tab already reads.
  const ownInvoices = useMemo(() => {
    const map = new Map<string, OwnInvoice[]>();
    for (const inv of data.invoices) {
      if (!inv.application_id || !memberIds.has(inv.application_id) || TICKET_KINDS.has(inv.kind)) continue;
      if (inv.society_id && inv.kind !== 'role_fee') continue;
      const list = map.get(inv.application_id);
      if (list) list.push(inv); else map.set(inv.application_id, [inv]);
    }
    return map;
  }, [data.invoices, memberIds]);

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
    const pay = paymentOf(m, ownInvoices.get(m.id) ?? []);
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

  // "Allocate" on a person (owner, 21 Oct 2026): a LIST of every allocation the
  // delegation was given, A to Z by country (then committee, then seat), each
  // its own row, so two Germanys are two rows: the round flag and country, the
  // committee emblem and acronym, and who holds it (avatar and name). An open
  // one is pressed to allocate the person; a held one is shown, not pressable
  // (move people between allocations by dragging on the People tab).
  function openPlaceStep(m: M) {
    const name = memberName(m);
    const holderOf = new Map<string, string>();
    for (const [appId, s] of seatOfApp) holderOf.set(s.allocationId, appId);
    const openIds = new Set(openSeats.map(s => s.allocationId));
    const list = [...seats].sort((x, y) =>
      x.countryName.localeCompare(y.countryName, undefined, { sensitivity: 'base' })
      || x.seat.committee_label.localeCompare(y.seat.committee_label, undefined, { sensitivity: 'base' })
      || x.seatNo - y.seatNo);
    onStep({
      title: `Allocate ${name}`,
      body: (
        <div className="flex flex-col" style={{ borderRadius: 14, border: `1px solid ${HAIRLINE}`, background: '#FFFFFF', overflow: 'hidden' }}>
          {list.map((s, i) => {
            const isOpen = openIds.has(s.allocationId);
            const holderId = holderOf.get(s.allocationId);
            const holder = holderId ? memberById.get(holderId) : undefined;
            const holderName = holder ? memberName(holder) : null;
            const cells = (
              <>
                <span className="flex items-center gap-3 min-w-0">
                  <CircleFlag code={s.countryCode} logoUrl={s.seat.seatLogo} label={s.countryName} size={34} decorative />
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: INK }}>{s.countryName}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 min-w-0" title={s.seat.committee_full ?? undefined}>
                  <CommitteeDisc src={s.seat.emblem} size={20} />
                  <span className="[overflow-wrap:anywhere]" style={{ fontFamily: FONT, fontSize: 13.5, color: INK }}>{s.seat.committee_label}</span>
                </span>
                <span className="flex items-center justify-end gap-2 min-w-0">
                  {isOpen ? (
                    <span style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 600, color: FOREST }}>Allocate here</span>
                  ) : holder && holderName ? (
                    <>
                      <RoundAvatar name={holderName} url={holder.profiles?.avatar_url ?? null} size={26} seed={holder.id} />
                      <span className="[overflow-wrap:anywhere] text-right" style={{ fontFamily: FONT, fontSize: 13.5, fontWeight: 500, color: INK }}>{holderName}</span>
                    </>
                  ) : (
                    <span style={{ fontFamily: FONT, fontSize: 13, color: INK_SOFT }}>Someone is in it</span>
                  )}
                </span>
              </>
            );
            const rowStyle: React.CSSProperties = {
              display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1.2fr)', alignItems: 'center', gap: 14,
              minHeight: 58, padding: '10px 16px', width: '100%', textAlign: 'left', background: 'transparent', border: 'none',
              borderTop: i === 0 ? 'none' : `1px solid ${ROW_LINE}`,
            };
            return isOpen ? (
              <button key={s.allocationId} type="button"
                onClick={() => { onStep(null); doSeatChange(openId(s.allocationId), m.id); }}
                aria-label={`Allocate ${name} to ${seatWords(s)}`}
                className={`${BTN_CLASS} hover:bg-[#F7F4EC]`}
                style={{ ...rowStyle, cursor: 'pointer' }}>
                {cells}
              </button>
            ) : (
              <div key={s.allocationId} style={{ ...rowStyle, opacity: 0.75 }}
                title={holderName ? `${holderName} holds this allocation` : 'Someone holds this allocation'}>
                {cells}
              </div>
            );
          })}
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

  if (live.length === 0) {
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
        {ordered.map(m => {
          const name = memberName(m);
          const email = m.profiles?.email || m.invited_email || '';
          const held = seatOfApp.get(m.id) ?? null;
          const pay = paymentOf(m, ownInvoices.get(m.id) ?? []);
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
