'use client';

// ── The seat board's committee pop-up ────────────────────────────────────────
// Opened by a committee ring (a click, or a person dropped on it). One pop-up
// at a time; a second step (the people for one seat) opens INSIDE its row,
// never as a second pop-up. The header's committee ring sits half outside the
// card's top-left edge (CLAUDE.md §8, the signature detail).
//   a) nobody open: the committee's allocations A to Z, nothing suggested on
//      open (owner, 21 Oct 2026). Each row is the round flag and country, the
//      seat's importance, and each seat's holder with their delegation, or
//      Open. An "Open" filter keeps only the open seats. Clicking an open row
//      expands the best-fit waiting delegates for that seat, with Assign.
//   b) a person open: "Seat <Name> in <Committee>", the open countries ranked
//      by the person's fit, their choices marked, the badges with points.
// Every Assign hands a suggestion to the page's own assign path
// (requestQuickAssign), so writes, emails and the first-assign pop-up are the
// board's. Nothing here writes.

import { useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { NEU, NeuButton } from '@/components/neu';
import { ModalOverlay } from '@/components/ModalOverlay';
import { groupAllocationsByCountry, rankPeopleForSeat, rankSeatsForPerson } from '@/lib/assignmentFit';
import { CountryName } from '@/app/manage/[slug]/assignment/displayNames';
import {
  type AcceptedApp, type CommitteeData, type SlotRow, type Suggestion,
  CountryFlag, PersonAvatar, committeeLabels, effectiveLevel, LevelDisc, slotLogoUrl, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import {
  CommitteeRing, FitPills, GoldMarker, HAIRLINE, HolderLine, ImportanceMark, OpenChip, ScoreDisc, SeatDoublePill, WELL,
  firstName, personName, schoolName, seatCounts,
} from '@/app/manage/[slug]/assignment/seatBoardShared';

const ROW_DIVIDER = `1px solid ${HAIRLINE}`;
/** The header ring, and how far it rises above the card. */
const RING = 76;
const RISE = 34;

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
          width: 'min(94vw, 820px)', maxHeight: `calc(90dvh - ${RISE}px)`, marginTop: RISE, backgroundColor: '#FFFFFF', borderRadius: 22,
          boxShadow: '0 24px 60px rgba(27,56,40,0.28), 0 2px 8px rgba(27,56,40,0.08)', fontFamily: OUTFIT, color: NEU.ink,
        }}
      >
        {/* The committee ring, half outside the card's top-left edge */}
        <span
          aria-hidden
          className="absolute inline-flex items-center justify-center"
          style={{
            top: -RISE, left: 22, width: RING + 10, height: RING + 10, borderRadius: 999, background: '#FFFFFF',
            boxShadow: '0 8px 22px -8px rgba(27,56,40,0.35), 0 0 0 1px rgba(27,56,40,0.05)',
          }}
        >
          <CommitteeRing committee={committee} size={RING} />
        </span>

        {/* Header */}
        <div className="flex items-start gap-3 pr-3 pt-3 pb-3" style={{ borderBottom: ROW_DIVIDER, paddingLeft: 22 + RING + 10 + 16 }}>
          <div className="flex-1 min-w-0" style={{ paddingTop: 2 }}>
            <h2 id={titleId} className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.2, textWrap: 'balance' }}>
              {person ? <>Seat <strong style={{ fontWeight: 700 }}>{personName(person)}</strong> in {labels.big}</> : labels.big}
            </h2>
            <p className="[overflow-wrap:anywhere]" style={{ margin: '2px 0 0', fontSize: 13, color: NEU.inkSoft }}>
              {labels.full ? <>{labels.full}, </> : null}
              <span style={{ fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{open}</span> of {total} seats open
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="focus:outline-none flex-shrink-0 inline-flex items-center justify-center"
            style={{ width: 40, height: 40, borderRadius: 12, border: 'none', background: 'transparent', color: NEU.inkSoft, cursor: 'pointer' }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {person
          ? <PersonMode committee={committee} person={person} spread={spread} needy={needy} locked={locked} onAssign={onAssign} />
          : <CommitteeMode committee={committee} waiting={waiting} spread={spread} needy={needy} locked={locked} onAssign={onAssign} />}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-2.5" style={{ borderTop: ROW_DIVIDER }}>
          <span style={{ fontSize: 12.5, color: NEU.inkSoft, lineHeight: 1.4 }}>
            {emailsOnAssign
              ? (person ? `${firstName(personName(person))} gets the allocation email when you assign` : 'Each person gets the allocation email when you assign')
              : 'Nobody is emailed until you release allocations'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="focus:outline-none flex-shrink-0"
            style={{ height: 36, padding: '0 16px', borderRadius: 10, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', color: NEU.ink, fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
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
  const name = personName(person);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-3 px-5 py-2.5" style={{ background: WELL }}>
        <PersonAvatar name={name} url={person.profiles?.avatar_url ?? null} size={36} />
        <span className="flex flex-col flex-1 min-w-0" style={{ lineHeight: 1.2 }}>
          <span className="[overflow-wrap:anywhere]" style={{ fontSize: 15, fontWeight: 700 }}>{name}</span>
          <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: NEU.inkSoft }}>{schoolName(person)}</span>
        </span>
        <LevelDisc level={effectiveLevel(person)} size={30} />
      </div>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-3 pb-1.5">
        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 600 }}>Best Fit First</h3>
        <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>One click assigns</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2" style={{ overscrollBehavior: 'contain' }}>
        {ranked.length === 0 ? (
          <p className="px-2 py-8 text-center" style={{ fontSize: 14, color: NEU.inkSoft }}>Every seat in {committeeLabels(committee).big} is taken</p>
        ) : ranked.map((r, i) => {
          const order = prefs.get(r.slot.country_code);
          return (
            <div key={r.slot.id} className="flex items-center gap-3 flex-wrap px-2 py-1.5" style={{ borderTop: i === 0 ? 'none' : ROW_DIVIDER }}>
              <ScoreDisc score={r.score} size={34} />
              <span className="min-w-0" style={{ flex: '1 1 300px' }}>
                <SeatDoublePill
                  committee={committee}
                  slot={r.slot}
                  holders={byCountry.get(r.slot.country_code) ?? []}
                  trailing={order ? <span className="inline-flex items-center" style={{ padding: '0 6px' }}><GoldMarker order={order} size={20} /></span> : null}
                />
              </span>
              <span className="flex items-center gap-1 flex-wrap min-w-0" style={{ flex: '1 1 180px' }}>
                {r.disallowed
                  ? <span style={{ fontSize: 12, color: NEU.inkSoft }}>The other seat of this country is another delegation&apos;s</span>
                  : <FitPills sug={r} max={2} size="sm" />}
              </span>
              <NeuButton onClick={() => onAssign(r)} disabled={locked} style={{ padding: '8px 16px', fontSize: 12.5, letterSpacing: 0, flexShrink: 0, marginLeft: 'auto' }}>Assign</NeuButton>
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
        height: 32, padding: '0 14px', borderRadius: 9, border: 'none', cursor: 'pointer',
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
    const bySeat = new Map(holders.map(h => [h.seat, h]));
    const seats = Array.from({ length: Math.max(1, s.delegation_size) }, (_, k) => k + 1);
    const loose = holders.filter(h => !seats.includes(h.seat));
    const toggle = () => { setChooser(choosing ? null : s.id); setQuery(''); };
    const body = (
      <>
        <span className="flex items-center gap-2.5 min-w-0" style={{ flex: '1 1 220px' }}>
          <CountryFlag code={s.country_code} w={34} h={34} alt={s.country_name} logoUrl={slotLogoUrl(committee, s)} />
          <span className="flex flex-col min-w-0" style={{ gap: 3 }}>
            <CountryName name={s.country_name} code={s.country_code} style={{ fontSize: 14.5, fontWeight: 600, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }} />
            <ImportanceMark tier={s.importance} />
          </span>
        </span>
        <span className="flex items-center flex-wrap min-w-0" style={{ flex: '1 1 260px', gap: '6px 14px' }}>
          {seats.map(n => {
            const h = bySeat.get(n) ?? (n === 1 ? loose[0] : undefined);
            return h ? <HolderLine key={n} alloc={h} /> : <OpenChip key={n} label={s.delegation_size > 1 ? `Seat ${n} open` : 'Open'} />;
          })}
        </span>
        {open && (
          <span
            aria-hidden
            className="inline-flex items-center justify-center flex-shrink-0"
            style={{ width: 30, height: 30, borderRadius: 10, color: NEU.ink }}
          >
            <ChevronDown size={16} strokeWidth={1.75} style={{ transform: choosing ? 'rotate(180deg)' : 'none', transition: 'transform 160ms cubic-bezier(0.22,1,0.36,1)' }} />
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
            style={{ padding: '8px 8px', border: 'none', borderRadius: 12, background: choosing ? WELL : 'transparent', cursor: 'pointer', fontFamily: OUTFIT, transition: 'background-color 140ms cubic-bezier(0.22,1,0.36,1)' }}
            onMouseEnter={e => { if (!choosing) (e.currentTarget as HTMLElement).style.background = '#FAF8F3'; }}
            onMouseLeave={e => { if (!choosing) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            {body}
          </button>
        ) : (
          <div className="flex items-center gap-3 flex-wrap" style={{ padding: '8px 8px' }}>{body}</div>
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
      <div className="flex items-center gap-3 flex-wrap px-5 py-2.5">
        <span role="tablist" aria-label="Which seats" className="inline-flex" style={{ gap: 2, padding: 3, borderRadius: 12, background: '#F1ECE1' }}>
          {tab('all', 'All seats', slots.length)}
          {tab('open', 'Open', openCount)}
        </span>
        {openCount > 0 && <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>Click an open seat to see who fits it best</span>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2" style={{ overscrollBehavior: 'contain' }}>
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
  const name = personName(sug.app);
  return (
    <div className="flex items-center gap-2.5 flex-wrap px-2 py-1.5" style={{ borderRadius: 12, background: '#FFFFFF' }}>
      <span className="flex items-center gap-2.5 min-w-0" style={{ flex: '1 1 200px' }}>
        <PersonAvatar name={name} url={sug.app.profiles?.avatar_url ?? null} size={30} />
        <span className="flex flex-col min-w-0" style={{ lineHeight: 1.2 }}>
          <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13.5, fontWeight: 700 }}>{name}</span>
          <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12, color: NEU.inkSoft }}>{note ?? schoolName(sug.app)}</span>
        </span>
        <LevelDisc level={effectiveLevel(sug.app)} size={20} />
      </span>
      {!note && (
        <span className="flex items-center gap-1 flex-wrap min-w-0" style={{ flex: '1 1 200px' }}>
          <FitPills sug={sug} max={2} size="sm" />
        </span>
      )}
      <span className="flex items-center gap-2.5 flex-shrink-0" style={{ marginLeft: 'auto' }}>
        <ScoreDisc score={sug.score} size={32} />
        <NeuButton onClick={() => onAssign(sug)} disabled={locked} style={{ padding: '7px 14px', fontSize: 12.5, letterSpacing: 0 }}>Assign</NeuButton>
      </span>
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
    <div className="mt-1 mb-2 p-2" style={{ background: WELL, borderRadius: 14 }}>
      {waiting.length === 0 ? (
        <p className="px-2 py-3" style={{ margin: 0, fontSize: 12.5, color: NEU.inkSoft }}>Nobody is waiting for a seat</p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 13, fontWeight: 600, paddingLeft: 4 }}>Best fit first</span>
            <label className="flex items-center gap-2 px-3 flex-1" style={{ minWidth: 200, height: 34, borderRadius: 10, background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.10)' }}>
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
          <div className="flex flex-col gap-1 mt-2 overflow-y-auto" style={{ maxHeight: 260, overscrollBehavior: 'contain' }}>
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
