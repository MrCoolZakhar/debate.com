'use client';

// ── The seat board's committee pop-up ────────────────────────────────────────
// Opened by a committee ring (a click, or a person dropped on it). One pop-up
// at a time; a second step ("More people") opens INSIDE its row, never as a
// second pop-up.
//   a) nobody open: a dense list of every country, drawn like the classic
//      board's seat "double pill" (flag and country, then each seat's holder
//      or Open). Open seats come first, then taken ones, A to Z inside each.
//      An open row shows its best waiting person with Assign; More people
//      lists everyone else, ranked, with a search.
//   b) a person open: "Seat <Name> in <Committee>", the same dense rows for
//      the open countries, ranked by the person's fit, their choices marked.
// Every Assign hands a suggestion to the page's own assign path
// (requestQuickAssign), so writes, emails and the first-assign pop-up are the
// board's. Nothing here writes.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { NEU, NeuButton } from '@/components/neu';
import { ModalOverlay } from '@/components/ModalOverlay';
import { groupAllocationsByCountry, rankPeopleForSeat, rankSeatsForPerson } from '@/lib/assignmentFit';
import {
  type AcceptedApp, type CommitteeData, type SlotRow, type Suggestion,
  PersonAvatar, CommitteeLogo, committeeLabels, effectiveLevel, LevelTag, fitColor, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import {
  FitPills, GoldMarker, HAIRLINE, SeatDoublePill, WELL, firstName, personName, schoolName,
} from '@/app/manage/[slug]/assignment/seatBoardShared';

function Score({ n, size = 18 }: { n: number; size?: number }) {
  return (
    <span
      title="Fit score"
      style={{ fontSize: size, fontWeight: 700, color: fitColor(n), fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums', lineHeight: 1, flexShrink: 0, minWidth: 28, textAlign: 'right' }}
    >
      {n}
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

  return (
    <ModalOverlay onClose={onClose} labelledBy={titleId} paddingClassName="px-4 py-6">
      <div
        className="flex flex-col"
        style={{
          width: 'min(94vw, 820px)', maxHeight: '90dvh', backgroundColor: '#FFFFFF', borderRadius: 22,
          boxShadow: '0 24px 60px rgba(27,56,40,0.28), 0 2px 8px rgba(27,56,40,0.08)', fontFamily: OUTFIT, color: NEU.ink,
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-4 pb-3" style={{ borderBottom: ROW_DIVIDER }}>
          <CommitteeLogo committee={committee} size={40} alt={labels.big} />
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 19, fontWeight: 600, lineHeight: 1.2, textWrap: 'balance' }}>
              {person ? <>Seat {personName(person)} in {labels.big}</> : labels.big}
            </h2>
            {labels.full && <p className="[overflow-wrap:anywhere]" style={{ margin: '1px 0 0', fontSize: 13, color: NEU.inkSoft }}>{labels.full}</p>}
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
          <span className="[overflow-wrap:anywhere]" style={{ fontSize: 15, fontWeight: 600 }}>{name}</span>
          <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12.5, color: NEU.inkSoft }}>{schoolName(person)}</span>
        </span>
        <LevelTag level={effectiveLevel(person)} />
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
              <Score n={r.score} />
              <span className="min-w-0" style={{ flex: '1 1 300px' }}>
                <SeatDoublePill
                  committee={committee}
                  slot={r.slot}
                  holders={byCountry.get(r.slot.country_code) ?? []}
                  trailing={order && order <= 3 ? <span className="inline-flex items-center" style={{ padding: '0 6px' }}><GoldMarker order={order} size={20} /></span> : null}
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
  // Open seats first (a double with one seat left counts as open), then the
  // taken ones; A to Z inside each.
  const { openSlots, takenSlots } = useMemo(() => {
    const sorted = [...committee.committee_country_slots].sort((a, b) => a.country_name.localeCompare(b.country_name, undefined, { sensitivity: 'base' }));
    const isOpen = (s: SlotRow) => (byCountry.get(s.country_code)?.length ?? 0) < s.delegation_size;
    return { openSlots: sorted.filter(isOpen), takenSlots: sorted.filter(s => !isOpen(s)) };
  }, [committee, byCountry]);
  // The best waiting people for every open seat (the first shows in the row).
  const best = useMemo(() => {
    const m = new Map<string, Suggestion[]>();
    for (const s of openSlots) m.set(s.id, rankPeopleForSeat(waiting, committee, s, spread, needy).slice(0, 1));
    return m;
  }, [openSlots, waiting, committee, spread, needy]);

  const total = openSlots.length + takenSlots.length;
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
    const isOpen = holders.length < s.delegation_size;
    const pick = isOpen ? best.get(s.id)?.[0] ?? null : null;
    const choosing = chooser === s.id;
    return (
      <div key={s.id} className="px-2 py-1.5" style={{ borderTop: i === 0 ? 'none' : ROW_DIVIDER }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="min-w-0" style={{ flex: '1 1 320px' }}>
            <SeatDoublePill committee={committee} slot={s} holders={holders} />
          </span>
          {isOpen && (
            <span className="flex items-center gap-2 min-w-0" style={{ flex: '0 1 auto', marginLeft: 'auto' }}>
              {!choosing && (pick ? (
                <>
                  <span className="flex items-center gap-2 min-w-0" title={`Best fit: ${personName(pick.app)}, ${schoolName(pick.app)}`}>
                    <PersonAvatar name={personName(pick.app)} url={pick.app.profiles?.avatar_url ?? null} size={26} />
                    <span className="flex flex-col min-w-0" style={{ lineHeight: 1.15, maxWidth: 170 }}>
                      <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13, fontWeight: 600 }}>{personName(pick.app)}</span>
                      <span className="[overflow-wrap:anywhere]" style={{ fontSize: 11.5, color: NEU.inkSoft }}>{schoolName(pick.app)}</span>
                    </span>
                  </span>
                  <Score n={pick.score} size={16} />
                  <NeuButton onClick={() => onAssign(pick)} disabled={locked} style={{ padding: '7px 14px', fontSize: 12.5, letterSpacing: 0, flexShrink: 0 }}>Assign</NeuButton>
                </>
              ) : (
                <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>Nobody waiting fits</span>
              ))}
              {waiting.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setChooser(choosing ? null : s.id); setQuery(''); }}
                  aria-expanded={choosing}
                  aria-label={choosing ? `Close the list for ${s.country_name}` : `More people for ${s.country_name}`}
                  title={choosing ? 'Close' : 'More people'}
                  className="focus:outline-none inline-flex items-center justify-center flex-shrink-0"
                  style={{ height: 34, minWidth: 34, padding: choosing ? '0 12px' : 0, gap: 4, borderRadius: 10, border: '1px solid rgba(27,56,40,0.16)', background: '#FFFFFF', cursor: 'pointer', color: NEU.ink, fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600 }}
                >
                  {choosing ? <>Close <ChevronUp size={14} strokeWidth={1.75} /></> : <ChevronDown size={15} strokeWidth={1.75} />}
                </button>
              )}
            </span>
          )}
        </div>
        {isOpen && choosing && (
          <Chooser
            committee={committee} slot={s} waiting={waiting} spread={spread} needy={needy}
            query={query} onQuery={setQuery} locked={locked} onAssign={onAssign}
          />
        )}
      </div>
    );
  };

  const shownCount = view === 'open' ? openSlots.length : total;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-3 flex-wrap px-5 py-2.5">
        <span role="tablist" aria-label="Which seats" className="inline-flex" style={{ gap: 2, padding: 3, borderRadius: 12, background: '#F1ECE1' }}>
          {tab('all', 'All seats', total)}
          {tab('open', 'Open', openSlots.length)}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2" style={{ overscrollBehavior: 'contain' }}>
        {shownCount === 0 && (
          <p className="px-2 py-8 text-center" style={{ fontSize: 14, color: NEU.inkSoft }}>
            {total === 0 ? 'This committee has no countries yet' : 'Every seat is taken'}
          </p>
        )}
        {openSlots.map((s, i) => row(s, i))}
        {view === 'all' && takenSlots.length > 0 && (
          <>
            {openSlots.length > 0 && (
              <div className="px-2 pt-3 pb-1" style={{ borderTop: ROW_DIVIDER, fontSize: 12.5, fontWeight: 600, color: NEU.inkSoft }}>Taken</div>
            )}
            {takenSlots.map((s, i) => row(s, openSlots.length > 0 ? i + 1 : i))}
          </>
        )}
      </div>
    </div>
  );
}

function PickRow({ sug, locked, onAssign, note }: { sug: Suggestion; locked: boolean; onAssign: (s: Suggestion) => void; note?: string }) {
  const name = personName(sug.app);
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5" style={{ borderRadius: 10, background: '#FFFFFF' }}>
      <PersonAvatar name={name} url={sug.app.profiles?.avatar_url ?? null} size={26} />
      <span className="flex flex-col flex-1 min-w-0" style={{ lineHeight: 1.2 }}>
        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12, color: NEU.inkSoft }}>{note ?? schoolName(sug.app)}</span>
      </span>
      <Score n={sug.score} size={16} />
      <NeuButton onClick={() => onAssign(sug)} disabled={locked} style={{ padding: '6px 14px', fontSize: 12, letterSpacing: 0 }}>Assign</NeuButton>
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
    <div className="mt-1.5 p-2" style={{ background: WELL, borderRadius: 14 }}>
      <label className="flex items-center gap-2 px-3" style={{ height: 36, borderRadius: 10, background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.10)' }}>
        <Search size={15} strokeWidth={1.5} style={{ color: NEU.inkSoft, flexShrink: 0 }} />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Search a name or delegation"
          aria-label="Search people waiting"
          className="flex-1 min-w-0 focus:outline-none"
          style={{ border: 'none', background: 'transparent', fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink }}
        />
      </label>
      <div className="flex flex-col gap-1 mt-2 overflow-y-auto" style={{ maxHeight: 240, overscrollBehavior: 'contain' }}>
        {list.length === 0 && <p className="px-2 py-3" style={{ fontSize: 12.5, color: NEU.inkSoft }}>Nobody waiting matches</p>}
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
    </div>
  );
}
