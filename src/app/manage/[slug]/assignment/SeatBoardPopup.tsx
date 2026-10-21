'use client';

// ── The seat board's committee pop-up ────────────────────────────────────────
// Opened by a committee ring (a click, or a person dropped on it). One pop-up
// at a time; a second step (the people for one seat) opens INSIDE its row,
// never as a second pop-up. The header's committee ring sits half outside the
// card's top-left edge (CLAUDE.md §8, the signature detail).
//   a) nobody open: the committee's allocations A to Z, nothing suggested on
//      open (owner, 21 Oct 2026). Calm rows (round 5: "far too much
//      information at once"): a bigger round flag, the country and the seat's
//      importance, then each seat's holder (avatar and bold name, their
//      delegation small beneath) or Open. An "Open" filter keeps only the
//      open seats. Clicking an open row expands the best-fit waiting
//      delegates for that seat, each with a soft Assign.
//   b) a person open: "Seat <Name> in <Committee>", the open countries ranked
//      by the person's fit, their choices marked, a few badges beneath.
// Every Assign hands a suggestion to the page's own assign path
// (requestQuickAssign), so writes, emails and the first-assign pop-up are the
// board's. Nothing here writes.

import { useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { NEU } from '@/components/neu';
import { ModalOverlay } from '@/components/ModalOverlay';
import { groupAllocationsByCountry, rankPeopleForSeat, rankSeatsForPerson } from '@/lib/assignmentFit';
import {
  type AcceptedApp, type AllocationRow, type CommitteeData, type SlotRow, type Suggestion,
  committeeLabels, effectiveLevel, LevelDisc, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import {
  FitPills, GoldMarker, HAIRLINE, HolderLine, OpenChip, POPUP_RING_INSET, POPUP_RING_RISE, POPUP_WIDTH,
  PersonIdentity, PopupRingBadge, ScoreHover, SeatCountry, SoftButton, WELL, firstName, personName, schoolName, seatCounts,
} from '@/app/manage/[slug]/assignment/seatBoardShared';

/** Each seat of a country: its holder, or Open; a double side by side. */
function SeatHolders({ slot, holders }: { slot: SlotRow; holders: readonly AllocationRow[] }) {
  const bySeat = new Map(holders.map(h => [h.seat, h]));
  const seats = Array.from({ length: Math.max(1, slot.delegation_size) }, (_, k) => k + 1);
  const loose = holders.filter(h => !seats.includes(h.seat));
  return (
    <span className="flex items-center flex-wrap min-w-0" style={{ flex: '1 1 200px', gap: '6px 14px' }}>
      {seats.map(n => {
        const h = bySeat.get(n) ?? (n === 1 ? loose[0] : undefined);
        return h ? <HolderLine key={n} alloc={h} /> : <OpenChip key={n} compact label={slot.delegation_size > 1 ? `Seat ${n} open` : 'Open'} />;
      })}
    </span>
  );
}

const ROW_DIVIDER = `1px solid ${HAIRLINE}`;

export function SeatBoardPopup({
  committee, person, waiting, spread, needy, emailsOnAssign, locked, onAssign, onClose,
}: {
  committee: CommitteeData;
  /** Mode b when set. */
  person: AcceptedApp | null;
  /** Everyone still waiting for a seat. */
  waiting: AcceptedApp[];
  spread: ReadonlySet<string>;
  needy: ReadonlySet<string>;
  emailsOnAssign: boolean;
  locked: boolean;
  onAssign: (sug: Suggestion) => void;
  onClose: () => void;
}) {
  const labels = committeeLabels(committee);
  const titleId = `seat-popup-${committee.id}`;
  const { open, total } = seatCounts(committee);

  return (
    <ModalOverlay onClose={onClose} labelledBy={titleId} paddingClassName="px-4 py-6">
      <div
        className="relative flex flex-col"
        style={{
          width: POPUP_WIDTH, maxHeight: `calc(90dvh - ${POPUP_RING_RISE}px)`, marginTop: POPUP_RING_RISE, backgroundColor: '#FFFFFF', borderRadius: 20,
          boxShadow: '0 24px 60px rgba(27,56,40,0.28), 0 2px 8px rgba(27,56,40,0.08)', fontFamily: OUTFIT, color: NEU.ink,
        }}
      >
        {/* The committee ring, half outside the card's top-left edge */}
        <PopupRingBadge committee={committee} />

        {/* Header */}
        <div className="flex items-start gap-2 pr-2 pt-2.5 pb-2.5" style={{ borderBottom: ROW_DIVIDER, paddingLeft: POPUP_RING_INSET }}>
          <div className="flex-1 min-w-0" style={{ paddingTop: 1 }}>
            <h2 id={titleId} className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.2, textWrap: 'balance' }}>
              {person ? <>Seat <strong style={{ fontWeight: 700 }}>{personName(person)}</strong> in {labels.big}</> : labels.big}
            </h2>
            <p className="[overflow-wrap:anywhere]" style={{ margin: '1px 0 0', fontSize: 12.5, color: NEU.inkSoft }}>
              {labels.full ? <>{labels.full}, </> : null}
              <span style={{ fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{open}</span> of {total} seats open
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus:outline-none flex-shrink-0 inline-flex items-center justify-center"
            style={{ width: 34, height: 34, borderRadius: 10, border: 'none', background: 'transparent', color: NEU.inkSoft, cursor: 'pointer' }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {person
          ? <PersonMode committee={committee} person={person} spread={spread} needy={needy} locked={locked} onAssign={onAssign} />
          : <CommitteeMode committee={committee} waiting={waiting} spread={spread} needy={needy} locked={locked} onAssign={onAssign} />}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 py-2" style={{ borderTop: ROW_DIVIDER }}>
          <span style={{ fontSize: 12, color: NEU.inkSoft, lineHeight: 1.35 }}>
            {emailsOnAssign
              ? (person ? `${firstName(personName(person))} gets the allocation email when you assign` : 'Each person gets the allocation email when you assign')
              : 'Nobody is emailed until you release allocations'}
          </span>
          <SoftButton onClick={onClose} size="sm">Cancel</SoftButton>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ── b) a person open ─────────────────────────────────────────────────────────
function PersonMode({ committee, person, spread, needy, locked, onAssign }: {
  committee: CommitteeData; person: AcceptedApp; spread: ReadonlySet<string>; needy: ReadonlySet<string>;
  locked: boolean; onAssign: (sug: Suggestion) => void;
}) {
  const ranked = useMemo(
    () => rankSeatsForPerson(person, committee, spread, needy, { includeDisallowed: true }),
    [person, committee, spread, needy],
  );
  const byCountry = useMemo(() => groupAllocationsByCountry(committee.conference_allocations), [committee]);
  const prefs = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of person.application_preferences ?? []) {
      if (p.conference_committee_id === committee.id && !m.has(p.country_code)) m.set(p.country_code, p.preference_order);
    }
    return m;
  }, [person, committee.id]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: WELL }}>
        <span className="flex-1 min-w-0"><PersonIdentity app={person} avatar={34} nameSize={14.5} lineSize={12} /></span>
        <LevelDisc level={effectiveLevel(person)} size={26} />
      </div>
      <h3 className="px-4 pt-2.5 pb-1" style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Best Fit First</h3>
      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-1.5" style={{ overscrollBehavior: 'contain' }}>
        {ranked.length === 0 ? (
          <p className="px-2 py-8 text-center" style={{ fontSize: 14, color: NEU.inkSoft }}>Every seat in {committeeLabels(committee).big} is taken</p>
        ) : ranked.map((r, i) => {
          const order = prefs.get(r.slot.country_code);
          const holders = byCountry.get(r.slot.country_code) ?? [];
          return (
            <div key={r.slot.id} className="flex flex-col" style={{ padding: '9px 8px', borderTop: i === 0 ? 'none' : ROW_DIVIDER, gap: 5 }}>
              <div className="flex items-center gap-3 flex-wrap">
                <ScoreHover sug={r} size={32} />
                <SeatCountry committee={committee} slot={r.slot} marker={order ? <GoldMarker order={order} size={20} /> : null} />
                {holders.length > 0 && <SeatHolders slot={r.slot} holders={holders} />}
                <SoftButton onClick={() => onAssign(r)} disabled={locked} size="sm" style={{ marginLeft: 'auto' }}>Assign</SoftButton>
              </div>
              <span className="flex items-center min-w-0" style={{ paddingLeft: 44 }}>
                {r.disallowed
                  ? <span style={{ fontSize: 12, color: NEU.inkSoft }}>The other seat of this country is another delegation&apos;s</span>
                  : <FitPills sug={r} max={3} size="sm" />}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── a) nobody open ───────────────────────────────────────────────────────────
function CommitteeMode({ committee, waiting, spread, needy, locked, onAssign }: {
  committee: CommitteeData; waiting: AcceptedApp[]; spread: ReadonlySet<string>; needy: ReadonlySet<string>;
  locked: boolean; onAssign: (sug: Suggestion) => void;
}) {
  const [view, setView] = useState<'all' | 'open'>('all');
  const [chooser, setChooser] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const byCountry = useMemo(() => groupAllocationsByCountry(committee.conference_allocations), [committee]);
  // Every allocation A to Z, taken ones included; a double with one seat
  // left counts as open.
  const slots = useMemo(
    () => [...committee.committee_country_slots].sort((a, b) => a.country_name.localeCompare(b.country_name, undefined, { sensitivity: 'base' })),
    [committee],
  );
  const isOpen = (s: SlotRow) => (byCountry.get(s.country_code)?.length ?? 0) < s.delegation_size;
  const openCount = slots.filter(isOpen).length;
  const shown = view === 'open' ? slots.filter(isOpen) : slots;

  const tab = (key: 'all' | 'open', label: string, n: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={view === key}
      onClick={() => setView(key)}
      className="focus:outline-none"
      style={{
        height: 28, padding: '0 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
        background: view === key ? '#FFFFFF' : 'transparent',
        boxShadow: view === key ? '0 1px 3px rgba(27,56,40,0.12)' : 'none',
        fontFamily: OUTFIT, fontSize: 13, fontWeight: view === key ? 600 : 500, color: view === key ? NEU.ink : NEU.inkSoft,
      }}
    >
      {label} <span style={{ color: NEU.inkSoft, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
    </button>
  );

  const row = (s: SlotRow, i: number) => {
    const holders = byCountry.get(s.country_code) ?? [];
    const open = isOpen(s);
    const choosing = open && chooser === s.id;
    const toggle = () => { setChooser(choosing ? null : s.id); setQuery(''); };
    const body = (
      <>
        <SeatCountry committee={committee} slot={s} />
        <SeatHolders slot={s} holders={holders} />
        {open && (
          <span
            aria-hidden
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{ width: 22, height: 22, borderRadius: 8, color: NEU.inkSoft }}
          >
            <ChevronDown size={16} strokeWidth={1.5} style={{ transform: choosing ? 'rotate(180deg)' : 'none', transition: 'transform 160ms cubic-bezier(0.22,1,0.36,1)' }} />
          </span>
        )}
      </>
    );
    return (
      <div key={s.id} style={{ borderTop: i === 0 ? 'none' : ROW_DIVIDER }}>
        {open ? (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={choosing}
            aria-label={choosing ? `Close the people for ${s.country_name}` : `Best people for ${s.country_name}`}
            className="focus:outline-none focus-visible:ring-2 w-full flex items-center gap-3 flex-wrap text-left"
            style={{ padding: '9px 8px', border: 'none', borderRadius: 12, background: choosing ? WELL : 'transparent', cursor: 'pointer', fontFamily: OUTFIT, transition: 'background-color 140ms cubic-bezier(0.22,1,0.36,1)' }}
            onMouseEnter={e => { if (!choosing) (e.currentTarget as HTMLElement).style.background = '#FAF8F3'; }}
            onMouseLeave={e => { if (!choosing) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {body}
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap" style={{ padding: '9px 8px' }}>{body}</div>
        )}
        {choosing && (
          <Chooser
            committee={committee} slot={s} waiting={waiting} spread={spread} needy={needy}
            query={query} onQuery={setQuery} locked={locked} onAssign={onAssign}
          />
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-3 flex-wrap px-4 py-2">
        <span role="tablist" aria-label="Which seats" className="inline-flex" style={{ gap: 2, padding: 2.5, borderRadius: 10, background: '#F1ECE1' }}>
          {tab('all', 'All seats', slots.length)}
          {tab('open', 'Open', openCount)}
        </span>
        {openCount > 0 && <span style={{ fontSize: 12, color: NEU.inkSoft }}>Click an open seat to see who fits</span>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-1.5" style={{ overscrollBehavior: 'contain' }}>
        {shown.length === 0 && (
          <p className="px-2 py-8 text-center" style={{ fontSize: 14, color: NEU.inkSoft }}>
            {slots.length === 0 ? 'This committee has no countries yet' : 'Every seat is taken'}
          </p>
        )}
        {shown.map((s, i) => row(s, i))}
      </div>
    </div>
  );
}

function PickRow({ sug, locked, onAssign, note }: { sug: Suggestion; locked: boolean; onAssign: (s: Suggestion) => void; note?: string }) {
  return (
    <div className="flex flex-col" style={{ padding: '8px 8px 8px 10px', borderRadius: 12, background: '#FFFFFF', gap: 5 }}>
      <div className="flex items-center gap-2.5">
        <span className="flex-1 min-w-0"><PersonIdentity app={sug.app} avatar={30} nameSize={13.5} lineSize={11.5} /></span>
        <LevelDisc level={effectiveLevel(sug.app)} size={20} />
        <ScoreHover sug={sug} size={30} />
        <SoftButton onClick={() => onAssign(sug)} disabled={locked} size="sm">Assign</SoftButton>
      </div>
      {note
        ? <span style={{ fontSize: 12, color: NEU.inkSoft, paddingLeft: 40 }}>{note}</span>
        : <span className="flex min-w-0" style={{ paddingLeft: 40 }}><FitPills sug={sug} max={3} size="sm" /></span>}
    </div>
  );
}

function Chooser({ committee, slot, waiting, spread, needy, query, onQuery, locked, onAssign }: {
  committee: CommitteeData; slot: SlotRow; waiting: AcceptedApp[]; spread: ReadonlySet<string>; needy: ReadonlySet<string>;
  query: string; onQuery: (q: string) => void; locked: boolean; onAssign: (s: Suggestion) => void;
}) {
  const ranked = useMemo(
    () => rankPeopleForSeat(waiting, committee, slot, spread, needy, { includeDisallowed: true }),
    [waiting, committee, slot, spread, needy],
  );
  const q = query.trim().toLowerCase();
  const list = q
    ? ranked.filter(r => personName(r.app).toLowerCase().includes(q) || schoolName(r.app).toLowerCase().includes(q))
    : ranked;
  return (
    <div className="mt-0.5 mb-1.5 p-1.5" style={{ background: WELL, borderRadius: 12 }}>
      {waiting.length === 0 ? (
        <p className="px-2 py-3" style={{ margin: 0, fontSize: 12.5, color: NEU.inkSoft }}>Nobody is waiting for a seat</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 13, fontWeight: 600, paddingLeft: 4 }}>Best fit first</span>
            <label className="flex items-center gap-2 px-3 flex-1" style={{ minWidth: 200, height: 32, borderRadius: 10, background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.10)' }}>
              <Search size={15} strokeWidth={1.5} style={{ color: NEU.inkSoft, flexShrink: 0 }} />
              <input
                type="text"
                value={query}
                onChange={e => onQuery(e.target.value)}
                placeholder="Search a name or delegation"
                aria-label="Search people waiting"
                className="flex-1 min-w-0 focus:outline-none"
                style={{ border: 'none', background: 'transparent', fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink }}
              />
            </label>
          </div>
          <div className="flex flex-col gap-1 mt-1.5 overflow-y-auto" style={{ maxHeight: 260, overscrollBehavior: 'contain' }}>
            {list.length === 0 && <p className="px-2 py-3" style={{ margin: 0, fontSize: 12.5, color: NEU.inkSoft }}>Nobody waiting matches</p>}
            {list.map(r => (
              <PickRow
                key={r.app.id}
                sug={r}
                locked={locked}
                onAssign={onAssign}
                note={r.disallowed ? 'The other seat is another delegation\'s' : undefined}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
