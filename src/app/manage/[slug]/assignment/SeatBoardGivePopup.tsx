'use client';

// ── The committee pop-up in "Give to <Delegation>" mode ──────────────────────
// Opened from the seat board's Delegations tab (SeatBoardDelegations.tsx) by a
// committee ring while a delegation is open, or by a delegation dropped on a
// ring (owner, 21 Oct 2026: "a way of clicking a committee and going 'give this
// allocation, give this allocation, give this allocation'").
// It looks like the people committee pop-up (SeatBoardPopup.tsx, owner, 21 Oct
// 2026: "almost the same"): the committee ring half outside the card's
// top-left edge, then every country A to Z in dense rows (the round flag and
// country, the seat's importance, each seat's holder with their delegation,
// side by side for a double, or Open), with an All seats / Open filter.
//   * A row open to this delegation is one tap: it gives the country (every
//     open seat of the slot, a double is both seats) and the pop-up STAYS OPEN
//     for the next tap. A country given here reads "Given" with Undo.
//   * The Open filter keeps the countries that were open when the pop-up
//     opened, so a row just given stays under the pointer with its Undo.
//   * The header keeps a running tally and what the delegation still needs;
//     Done closes it.
// One pop-up at a time: it replaces the board's committee pop-up, never sits
// on it. Nothing here writes: onGive / onUndo are the Delegations tab's writes.

import { useMemo, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { NEU } from '@/components/neu';
import { ModalOverlay } from '@/components/ModalOverlay';
import DelegationCrest from '@/components/DelegationCrest';
import { CountryName } from '@/app/manage/[slug]/assignment/displayNames';
import { allocationSocietyId, groupAllocationsByCountry, openSeatsForSociety } from '@/lib/assignmentFit';
import { foldForSearch } from '@/app/manage/[slug]/applications/delegations/societySeats';
import {
  type AllocationRow, type CommitteeData, type SlotRow,
  CountryFlag, committeeLabels, slotLogoUrl, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import {
  HAIRLINE, HolderLine, ImportanceMark, OpenChip, POPUP_RING_INSET, POPUP_RING_RISE, PopupRingBadge, WELL, seatCounts,
} from '@/app/manage/[slug]/assignment/seatBoardShared';

const ROW_DIVIDER = `1px solid ${HAIRLINE}`;
const FOREST_GRADIENT = 'linear-gradient(180deg, #2A5039, #1B3828)';

export interface GiveSociety {
  id: string;
  name: string;
  logoUrl: string | null;
}

/** Who holds an allocation: a delegation, or a person. */
export interface HolderView {
  kind: 'delegation' | 'person';
  name: string;
  avatarUrl: string | null;
  logoUrl: string | null;
}

export function holderOf(a: AllocationRow, societyName: (id: string) => { name: string; logoUrl: string | null } | null): HolderView {
  if (a.application_id || a.user_id) {
    const name = a.profiles?.display_name?.trim() || a.applications?.invited_name?.trim() || a.profiles?.email?.trim() || 'Someone';
    return { kind: 'person', name, avatarUrl: a.profiles?.avatar_url ?? null, logoUrl: null };
  }
  const sid = allocationSocietyId(a);
  const s = sid ? societyName(sid) : null;
  return { kind: 'delegation', name: s?.name ?? a.delegation?.name ?? 'A delegation', avatarUrl: null, logoUrl: s?.logoUrl ?? null };
}

/** A seat's holder: a person with their delegation (the shared HolderLine), or
 *  a delegation seat with the delegation's crest. */
function SeatHolder({ alloc, societyName }: {
  alloc: AllocationRow;
  societyName: (id: string) => { name: string; logoUrl: string | null } | null;
}) {
  const h = holderOf(alloc, societyName);
  if (h.kind === 'person') return <HolderLine alloc={alloc} />;
  return (
    <span className="inline-flex items-center gap-2 min-w-0" title={`${h.name}, a delegation seat`}>
      <DelegationCrest name={h.name} logoUrl={h.logoUrl} size={28} />
      <span className="flex flex-col min-w-0" style={{ lineHeight: 1.15 }}>
        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13.5, fontWeight: 700, color: NEU.ink }}>{h.name}</span>
        <span style={{ fontSize: 12, color: NEU.inkSoft }}>Delegation seat</span>
      </span>
    </span>
  );
}

export function SeatBoardGivePopup({
  committee, society, skip, givenNow, stillNeeds, busyCodes, societyName, onGive, onUndo, onClose,
}: {
  /** The committee with this tab's writes laid over it. */
  committee: CommitteeData;
  society: GiveSociety;
  /** Country codes never given to a delegation here (observer seats). */
  skip: ReadonlySet<string>;
  /** Countries given while this pop-up is open. */
  givenNow: ReadonlySet<string>;
  /** Allocations the delegation still needs (paid tickets and accepted delegates). */
  stillNeeds?: number;
  /** Countries with a write still running. */
  busyCodes: ReadonlySet<string>;
  societyName: (id: string) => { name: string; logoUrl: string | null } | null;
  onGive: (slot: SlotRow, seats: number[]) => void;
  onUndo: (slot: SlotRow) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<'all' | 'open'>('all');
  const [query, setQuery] = useState('');
  const labels = committeeLabels(committee);
  const titleId = `seat-give-${committee.id}`;
  const { open: openSeats, total } = seatCounts(committee);
  const byCountry = useMemo(() => groupAllocationsByCountry(committee.conference_allocations), [committee]);
  // Every country A to Z, observer seats left out.
  const slots = useMemo(
    () => committee.committee_country_slots
      .filter(s => !skip.has(s.country_code))
      .sort((a, b) => a.country_name.localeCompare(b.country_name, undefined, { sensitivity: 'base' })),
    [committee, skip],
  );
  // The countries open to this delegation when the pop-up opened: the Open
  // filter keeps them once given, so the next tap never lands on a row that moved.
  const [openAtStart] = useState<ReadonlySet<string>>(() => {
    const m = groupAllocationsByCountry(committee.conference_allocations);
    return new Set(committee.committee_country_slots.filter(s => openSeatsForSociety(s, m, society.id).length > 0).map(s => s.country_code));
  });
  const inOpenView = (s: SlotRow) => openAtStart.has(s.country_code) || givenNow.has(s.country_code)
    || openSeatsForSociety(s, byCountry, society.id).length > 0;
  const openList = slots.filter(inOpenView);
  const base = view === 'open' ? openList : slots;
  const q = foldForSearch(query);
  const shown = q ? base.filter(s => foldForSearch(s.country_name).includes(q) || s.country_code.toLowerCase().includes(q)) : base;

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
    const free = openSeatsForSociety(s, byCountry, society.id);
    const busy = busyCodes.has(s.country_code);
    const theirs = holders.length > 0 && holders.every(r => allocationSocietyId(r) === society.id);
    const now = givenNow.has(s.country_code);
    const bySeat = new Map(holders.map(h => [h.seat, h]));
    const seats = Array.from({ length: Math.max(1, s.delegation_size) }, (_, k) => k + 1);
    const loose = holders.filter(h => !seats.includes(h.seat));

    const body = (
      <>
        <span className="flex items-center gap-2.5 min-w-0" style={{ flex: '1 1 220px' }}>
          <CountryFlag code={s.country_code} w={34} h={34} alt={s.country_name} logoUrl={slotLogoUrl(committee, s)} />
          <span className="flex flex-col min-w-0" style={{ gap: 3 }}>
            <CountryName name={s.country_name} code={s.country_code} style={{ fontSize: 14.5, fontWeight: 600, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }} />
            <ImportanceMark tier={s.importance} />
          </span>
        </span>
        {/* Every seat side by side: a double is one row with both holders */}
        <span className="flex items-center flex-wrap min-w-0" style={{ flex: '1 1 260px', gap: '6px 14px' }}>
          {seats.map(n => {
            const h = bySeat.get(n) ?? (n === 1 ? loose[0] : undefined);
            return h ? <SeatHolder key={n} alloc={h} societyName={societyName} /> : <OpenChip key={n} />;
          })}
        </span>
      </>
    );

    // Open to this delegation: the whole row gives it.
    if (free.length > 0) {
      return (
        <button
          key={s.id}
          type="button"
          disabled={busy}
          onClick={() => onGive(s, free)}
          aria-label={`Give ${s.country_name} to ${society.name}`}
          className="focus:outline-none focus-visible:ring-2 w-full flex items-center gap-3 flex-wrap text-left"
          style={{
            padding: '8px 8px', border: 'none', borderTop: i === 0 ? 'none' : ROW_DIVIDER, borderRadius: 0, background: 'transparent',
            cursor: busy ? 'default' : 'pointer', fontFamily: OUTFIT, color: NEU.ink, transition: 'background-color 140ms cubic-bezier(0.22,1,0.36,1)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAF8F3'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {body}
          <span
            className="flex-shrink-0 inline-flex items-center justify-center gap-1"
            style={{
              height: 30, minWidth: 76, padding: '0 12px 0 9px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, marginLeft: 'auto',
              background: busy ? WELL : FOREST_GRADIENT, color: busy ? NEU.inkSoft : '#FFFFFF',
            }}
          >
            {!busy && <Plus size={13} strokeWidth={2} aria-hidden />}
            {busy ? 'Saving' : 'Give'}
          </span>
        </button>
      );
    }

    return (
      <div
        key={s.id}
        className="flex items-center gap-3 flex-wrap"
        style={{ padding: '8px 8px', borderTop: i === 0 ? 'none' : ROW_DIVIDER, background: now ? WELL : 'transparent', borderRadius: now ? 12 : 0 }}
      >
        {body}
        {theirs && (
          <span className="flex-shrink-0 inline-flex items-center justify-end gap-2" style={{ minWidth: 76, marginLeft: 'auto' }}>
            <span className="inline-flex items-center gap-1" style={{ fontSize: 12.5, fontWeight: 600, color: NEU.forest }}>
              <Check size={14} strokeWidth={2} aria-hidden /> {now ? 'Given' : 'Theirs'}
            </span>
            {now && (
              <button
                type="button"
                onClick={() => onUndo(s)}
                disabled={busy}
                className="focus:outline-none"
                style={{ border: 'none', background: 'none', padding: '0 4px', cursor: busy ? 'default' : 'pointer', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, textDecoration: 'underline', textUnderlineOffset: 3, opacity: busy ? 0.5 : 1 }}
              >
                {busy ? 'Saving' : 'Undo'}
              </button>
            )}
          </span>
        )}
      </div>
    );
  };

  return (
    <ModalOverlay onClose={onClose} labelledBy={titleId} paddingClassName="px-4 py-6">
      <div
        className="relative flex flex-col"
        style={{
          width: 'min(94vw, 820px)', maxHeight: `calc(90dvh - ${POPUP_RING_RISE}px)`, marginTop: POPUP_RING_RISE, backgroundColor: '#FFFFFF', borderRadius: 22,
          boxShadow: '0 24px 60px rgba(27,56,40,0.28), 0 2px 8px rgba(27,56,40,0.08)', fontFamily: OUTFIT, color: NEU.ink,
        }}
      >
        {/* The committee ring, half outside the card's top-left edge */}
        <PopupRingBadge committee={committee} />

        {/* Header: where, who, and the tally */}
        <div className="flex items-start gap-3 pr-3 pt-3 pb-3" style={{ borderBottom: ROW_DIVIDER, paddingLeft: POPUP_RING_INSET }}>
          <div className="flex-1 min-w-0" style={{ paddingTop: 2 }}>
            <h2 id={titleId} className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 20, fontWeight: 600, lineHeight: 1.2, textWrap: 'balance' }}>
              Give to <strong style={{ fontWeight: 700 }}>{society.name}</strong> in {labels.big}
            </h2>
            <p className="[overflow-wrap:anywhere]" style={{ margin: '2px 0 0', fontSize: 13, color: NEU.inkSoft }}>
              {labels.full ? <>{labels.full}, </> : null}
              <span style={{ fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{openSeats}</span> of {total} seats open
            </p>
          </div>
          <span className="flex flex-col items-end flex-shrink-0" style={{ paddingTop: 2, lineHeight: 1.15 }} aria-live="polite">
            <span className="inline-flex items-baseline gap-1.5">
              <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{givenNow.size}</span>
              <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>given</span>
            </span>
            {stillNeeds != null && (
              <span style={{ fontSize: 12, color: stillNeeds > 0 ? NEU.inkSoft : NEU.forest, fontWeight: stillNeeds > 0 ? 400 : 600 }}>
                {stillNeeds > 0 ? `${stillNeeds} still needed` : 'All needed given'}
              </span>
            )}
          </span>
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

        {/* The filter, and a search for a long list */}
        <div className="flex items-center gap-3 flex-wrap px-5 py-2.5">
          <span role="tablist" aria-label="Which seats" className="inline-flex" style={{ gap: 2, padding: 3, borderRadius: 12, background: '#F1ECE1' }}>
            {tab('all', 'All seats', slots.length)}
            {tab('open', 'Open', openList.length)}
          </span>
          <label className="flex items-center gap-2 px-3" style={{ flex: '1 1 180px', maxWidth: 280, marginLeft: 'auto', height: 36, borderRadius: 10, background: '#FAF8F3', boxShadow: '0 0 0 1px rgba(27,56,40,0.10)' }}>
            <Search size={15} strokeWidth={1.5} style={{ color: NEU.inkSoft, flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search a country"
              aria-label="Search countries"
              className="flex-1 min-w-0 focus:outline-none"
              style={{ border: 'none', background: 'transparent', fontFamily: OUTFIT, fontSize: 13.5, color: NEU.ink }}
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="focus:outline-none" style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: NEU.inkSoft, lineHeight: 0 }}>
                <X size={14} strokeWidth={1.5} />
              </button>
            )}
          </label>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2" style={{ overscrollBehavior: 'contain' }}>
          {shown.length === 0 && (
            <p className="px-2 py-8 text-center" style={{ fontSize: 14, color: NEU.inkSoft }}>
              {slots.length === 0 ? 'This committee has no countries yet' : q ? 'No country matches' : 'Every seat is taken'}
            </p>
          )}
          {shown.map((s, i) => row(s, i))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-2.5" style={{ borderTop: ROW_DIVIDER }}>
          <span style={{ fontSize: 12.5, color: NEU.inkSoft, lineHeight: 1.4 }}>Each tap gives that country to {society.name}</span>
          <button
            type="button"
            onClick={onClose}
            className="focus:outline-none flex-shrink-0"
            style={{ height: 36, padding: '0 20px', borderRadius: 10, border: 'none', background: FOREST_GRADIENT, color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
