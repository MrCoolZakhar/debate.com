'use client';

// ── The seat board's committee pop-up ────────────────────────────────────────
// Opened by a committee ring (a click, or a person dropped on it). One pop-up
// at a time; a second step ("Choose someone else") opens INSIDE its row, never
// as a second pop-up.
//   a) nobody open: every country A to Z with who holds it; each open seat
//      shows the best 2 or 3 waiting people for it, and a small searchable
//      list of everyone else.
//   b) a person open: "Seat <Name> in <Committee>", that committee's open
//      countries ranked by the person's fit, their preferences marked.
// Every Assign hands a suggestion to the page's own assign path
// (requestQuickAssign), so writes, emails and the first-assign pop-up are the
// board's. Nothing here writes.

import { useMemo, useState } from 'react';
import { Search, X, Users } from 'lucide-react';
import { NEU, NeuButton } from '@/components/neu';
import { ModalOverlay } from '@/components/ModalOverlay';
import { CountryName, StackedName } from '@/app/manage/[slug]/assignment/displayNames';
import { groupAllocationsByCountry, rankPeopleForSeat, rankSeatsForPerson } from '@/lib/assignmentFit';
import {
  type AcceptedApp, type AllocationRow, type CommitteeData, type SlotRow, type Suggestion,
  CountryFlag, PersonAvatar, DelegationAvatar, CommitteeLogo, committeeLabels, effectiveLevel, LevelTag,
  SuggestionReasons, fitColor, slotLogoUrl, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import {
  BigCount, GoldMarker, HAIRLINE, WELL, firstName, ordinal, personName, schoolName, seatCounts,
} from '@/app/manage/[slug]/assignment/seatBoardShared';

function holderName(a: AllocationRow): string {
  return a.profiles?.display_name?.trim() || a.applications?.invited_name?.trim() || a.profiles?.email?.trim() || 'Assigned';
}
function holderSchool(a: AllocationRow): string | null {
  if (a.society_id && !a.application_id) return null;
  const apps = a.applications;
  if (!apps) return null;
  if (apps.society_id == null) return 'Independent';
  return apps.societies?.name?.trim() || null;
}

function Score({ n, size = 20 }: { n: number; size?: number }) {
  return (
    <span style={{ fontSize: size, fontWeight: 700, color: fitColor(n), fontFamily: OUTFIT, fontVariantNumeric: 'tabular-nums', lineHeight: 1, flexShrink: 0 }}>
      {n}
    </span>
  );
}

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
  const counts = seatCounts(committee);
  const titleId = `seat-popup-${committee.id}`;

  return (
    <ModalOverlay onClose={onClose} labelledBy={titleId} paddingClassName="px-4 py-8">
      <div
        className="flex flex-col"
        style={{
          width: 'min(94vw, 680px)', maxHeight: '86dvh', backgroundColor: '#FFFFFF', borderRadius: 22,
          boxShadow: '0 24px 60px rgba(27,56,40,0.28), 0 2px 8px rgba(27,56,40,0.08)', fontFamily: OUTFIT, color: NEU.ink,
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-4" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
          <CommitteeLogo committee={committee} size={44} alt={labels.big} />
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>
              {person ? <>Seat {personName(person)} in {labels.big}</> : labels.big}
            </h2>
            {labels.full && <p className="[overflow-wrap:anywhere]" style={{ margin: '2px 0 0', fontSize: 13, color: NEU.inkSoft }}>{labels.full}</p>}
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
          ? <PersonMode committee={committee} person={person} spread={spread} needy={needy} locked={locked} onAssign={onAssign} counts={counts} />
          : <CommitteeMode committee={committee} waiting={waiting} spread={spread} needy={needy} locked={locked} onAssign={onAssign} counts={counts} />}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
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
function PersonMode({ committee, person, spread, needy, locked, onAssign, counts }: {
  committee: CommitteeData; person: AcceptedApp; spread: ReadonlySet<string>; needy: ReadonlySet<string>;
  locked: boolean; onAssign: (sug: Suggestion) => void; counts: { total: number; open: number };
}) {
  const ranked = useMemo(
    () => rankSeatsForPerson(person, committee, spread, needy, { includeDisallowed: true }),
    [person, committee, spread, needy],
  );
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
      <div className="flex items-center gap-3 px-5 py-3" style={{ background: WELL }}>
        <PersonAvatar name={name} url={person.profiles?.avatar_url ?? null} size={36} />
        <div className="flex-1 min-w-0">
          <StackedName name={name} size={14} weight={600} color={NEU.ink} restColor={NEU.inkSoft} />
          <span className="flex items-center gap-2 flex-wrap mt-0.5" style={{ fontSize: 12, color: NEU.inkSoft }}>
            <span className="[overflow-wrap:anywhere]">{schoolName(person)}</span>
            <LevelTag level={effectiveLevel(person)} />
          </span>
        </div>
        <span className="flex-shrink-0" style={{ fontSize: 13, color: NEU.inkSoft }}>
          <span style={{ fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{counts.open}</span> of {counts.total} open
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-2">
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Open Countries, Best Fit First</h3>
        <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>One click assigns</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3" style={{ overscrollBehavior: 'contain' }}>
        {ranked.length === 0 ? (
          <p className="px-2 py-8 text-center" style={{ fontSize: 14, color: NEU.inkSoft }}>Every seat in {committeeLabels(committee).big} is taken.</p>
        ) : ranked.map(r => {
          const order = prefs.get(r.slot.country_code);
          return (
            <div key={r.slot.id} className="flex items-center gap-3 px-2 py-2.5" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
              <CountryFlag code={r.slot.country_code} w={26} h={26} alt={r.slot.country_name} logoUrl={slotLogoUrl(committee, r.slot)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <CountryName name={r.slot.country_name} code={r.slot.country_code} style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
                  {order && order <= 3 && (
                    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, color: NEU.inkSoft }}>
                      <GoldMarker order={order} size={18} /> {ordinal(order)} choice
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {r.disallowed
                    ? <span style={{ fontSize: 12, color: NEU.inkSoft }}>The other seat of this country is another delegation&apos;s</span>
                    : <SuggestionReasons sug={r} />}
                </div>
              </div>
              <Score n={r.score} />
              <NeuButton onClick={() => onAssign(r)} disabled={locked} style={{ padding: '8px 16px', fontSize: 12.5, letterSpacing: 0 }}>Assign</NeuButton>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── a) nobody open ───────────────────────────────────────────────────────────
function CommitteeMode({ committee, waiting, spread, needy, locked, onAssign, counts }: {
  committee: CommitteeData; waiting: AcceptedApp[]; spread: ReadonlySet<string>; needy: ReadonlySet<string>;
  locked: boolean; onAssign: (sug: Suggestion) => void; counts: { total: number; filled: number; open: number };
}) {
  const [view, setView] = useState<'all' | 'open'>('all');
  const [chooser, setChooser] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const byCountry = useMemo(() => groupAllocationsByCountry(committee.conference_allocations), [committee]);
  const slots = useMemo(
    () => [...committee.committee_country_slots].sort((a, b) => a.country_name.localeCompare(b.country_name, undefined, { sensitivity: 'base' })),
    [committee],
  );
  // The best three waiting people for every open seat.
  const best = useMemo(() => {
    const m = new Map<string, Suggestion[]>();
    for (const s of slots) {
      const held = byCountry.get(s.country_code)?.length ?? 0;
      if (held >= s.delegation_size) continue;
      m.set(s.id, rankPeopleForSeat(waiting, committee, s, spread, needy).slice(0, 3));
    }
    return m;
  }, [slots, byCountry, waiting, committee, spread, needy]);

  const shown = view === 'open'
    ? slots.filter(s => (byCountry.get(s.country_code)?.length ?? 0) < s.delegation_size)
    : slots;

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

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3">
        <span className="flex items-center gap-5">
          <BigCount n={counts.filled} word="seated" size={20} />
          <BigCount n={counts.open} word="open" size={20} />
        </span>
        <span className="flex items-center gap-3">
          <span role="tablist" aria-label="Which seats" className="inline-flex" style={{ gap: 2, padding: 3, borderRadius: 12, background: '#F1ECE1' }}>
            {tab('all', 'All seats', counts.total)}
            {tab('open', 'Open', counts.open)}
          </span>
          <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>A to Z</span>
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3" style={{ overscrollBehavior: 'contain' }}>
        {shown.length === 0 && (
          <p className="px-2 py-8 text-center" style={{ fontSize: 14, color: NEU.inkSoft }}>
            {slots.length === 0 ? 'This committee has no countries yet.' : 'Every seat is taken.'}
          </p>
        )}
        {shown.map(s => {
          const holders = byCountry.get(s.country_code) ?? [];
          const openSeats = Math.max(0, s.delegation_size - holders.length);
          const picks = best.get(s.id) ?? [];
          const choosing = chooser === s.id;
          return (
            <div key={s.id} className="px-2 py-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
              <div className="flex items-start gap-3">
                <span style={{ paddingTop: 2 }}>
                  <CountryFlag code={s.country_code} w={26} h={26} alt={s.country_name} logoUrl={slotLogoUrl(committee, s)} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap" style={{ minHeight: 30 }}>
                    <CountryName name={s.country_name} code={s.country_code} style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
                    {openSeats > 0 && (
                      <span className="flex items-center gap-3">
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: NEU.forest }}>
                          {s.delegation_size > 1 ? `${openSeats} of ${s.delegation_size} open` : 'Open'}
                        </span>
                        <button
                          type="button"
                          onClick={() => { setChooser(choosing ? null : s.id); setQuery(''); }}
                          className="focus:outline-none"
                          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}
                        >
                          {choosing ? 'Back to the best fits' : 'Choose someone else'}
                        </button>
                      </span>
                    )}
                  </div>

                  {holders.map(h => {
                    const block = !!h.society_id && !h.application_id;
                    const name = block ? (h.delegation?.name ?? 'Delegation') : holderName(h);
                    const sub = block ? 'Delegation seat' : holderSchool(h);
                    return (
                      <div key={h.id} className="flex items-center gap-2.5 mt-1.5">
                        {block ? <DelegationAvatar size={26} /> : <PersonAvatar name={name} url={h.profiles?.avatar_url ?? null} size={26} />}
                        <span className="flex flex-col min-w-0" style={{ lineHeight: 1.2 }}>
                          <span className="[overflow-wrap:anywhere] inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 600 }}>
                            {block && <Users size={12} strokeWidth={1.5} style={{ flexShrink: 0 }} />}{name}
                          </span>
                          {sub && <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12, color: NEU.inkSoft }}>{sub}</span>}
                        </span>
                      </div>
                    );
                  })}

                  {openSeats > 0 && !choosing && (
                    picks.length === 0 ? (
                      <p className="mt-1.5" style={{ fontSize: 12.5, color: NEU.inkSoft }}>Nobody waiting fits this seat</p>
                    ) : (
                      <div className="flex flex-col gap-1 mt-2 p-1.5" style={{ background: WELL, borderRadius: 12 }}>
                        {picks.map(p => (
                          <PickRow key={p.app.id} sug={p} locked={locked} onAssign={onAssign} />
                        ))}
                      </div>
                    )
                  )}

                  {openSeats > 0 && choosing && (
                    <Chooser
                      committee={committee} slot={s} waiting={waiting} spread={spread} needy={needy}
                      query={query} onQuery={setQuery} locked={locked} onAssign={onAssign}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PickRow({ sug, locked, onAssign, note }: { sug: Suggestion; locked: boolean; onAssign: (s: Suggestion) => void; note?: string }) {
  const name = personName(sug.app);
  return (
    <div className="flex items-center gap-2.5 px-2 py-1.5" style={{ borderRadius: 10, background: '#FFFFFF' }}>
      <PersonAvatar name={name} url={sug.app.profiles?.avatar_url ?? null} size={28} />
      <span className="flex flex-col flex-1 min-w-0" style={{ lineHeight: 1.2 }}>
        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13, fontWeight: 600 }}>{name}</span>
        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12, color: NEU.inkSoft }}>{note ?? schoolName(sug.app)}</span>
      </span>
      <Score n={sug.score} size={17} />
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
    <div className="mt-2 p-2" style={{ background: WELL, borderRadius: 12 }}>
      <label className="flex items-center gap-2 px-3" style={{ height: 36, borderRadius: 10, background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.10)' }}>
        <Search size={15} strokeWidth={1.5} style={{ color: NEU.inkSoft, flexShrink: 0 }} />
        <input
          type="text"
          autoFocus
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Search a name or school"
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
