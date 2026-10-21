'use client';

// ── The committee pop-up in "Give to <Delegation>" mode ──────────────────────
// Opened from the seat board's Delegations tab (SeatBoardDelegations.tsx) by a
// committee ring while a delegation is open, or by a delegation dropped on a
// ring (owner, 21 Oct 2026: "a way of clicking a committee and going 'give this
// allocation, give this allocation, give this allocation'").
//   * Compact rows, the round flag and the country, with search. The countries
//     open to this delegation come first (A to Z), then theirs, then the ones
//     someone else holds (greyed, who holds it on the row). The order is taken
//     when the pop-up opens, so a row just given stays under the pointer.
//   * A free row is one tap: it gives the country (every open seat of the slot,
//     a double is both seats) and the pop-up STAYS OPEN for the next tap. A
//     country given here reads "Given" with Undo.
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
  CountryFlag, PersonAvatar, CommitteeLogo, committeeLabels, slotLogoUrl, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import { HAIRLINE, WELL } from '@/app/manage/[slug]/assignment/seatBoardShared';

export interface GiveSociety {
  id: string;
  name: string;
  logoUrl: string | null;
}

/** Who holds an allocation, for a greyed row: a delegation, or a person. */
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
  const [query, setQuery] = useState('');
  const labels = committeeLabels(committee);
  const titleId = `seat-give-${committee.id}`;
  const byCountry = useMemo(() => groupAllocationsByCountry(committee.conference_allocations), [committee]);
  const slots = useMemo(
    () => committee.committee_country_slots
      .filter(s => !skip.has(s.country_code))
      .sort((a, b) => a.country_name.localeCompare(b.country_name, undefined, { sensitivity: 'base' })),
    [committee, skip],
  );
  // The countries open when the pop-up opened: they lead the list and keep their
  // place once given, so the next tap never lands on a row that moved.
  const [openAtStart] = useState<ReadonlySet<string>>(() => {
    const m = groupAllocationsByCountry(committee.conference_allocations);
    return new Set(committee.committee_country_slots.filter(s => openSeatsForSociety(s, m, society.id).length > 0).map(s => s.country_code));
  });
  const rank = (s: SlotRow): number => {
    if (openAtStart.has(s.country_code) || openSeatsForSociety(s, byCountry, society.id).length > 0) return 0;
    const rows = byCountry.get(s.country_code) ?? [];
    return rows.length > 0 && rows.every(r => allocationSocietyId(r) === society.id) ? 1 : 2;
  };
  const q = foldForSearch(query);
  const matched = q ? slots.filter(s => foldForSearch(s.country_name).includes(q) || s.country_code.toLowerCase().includes(q)) : slots;
  const shown = matched.map(s => ({ s, r: rank(s) })).sort((x, y) => x.r - y.r).map(x => x.s);
  const freeCount = slots.filter(s => openSeatsForSociety(s, byCountry, society.id).length > 0).length;

  const rowBase = 'w-full flex items-center gap-2.5 px-2 py-1.5';
  const rowStyle: React.CSSProperties = { minHeight: 44, borderTop: `1px solid ${HAIRLINE}` };

  return (
    <ModalOverlay onClose={onClose} labelledBy={titleId} paddingClassName="px-4 py-8">
      <div
        className="flex flex-col"
        style={{
          width: 'min(94vw, 540px)', maxHeight: '86dvh', backgroundColor: '#FFFFFF', borderRadius: 22,
          boxShadow: '0 24px 60px rgba(27,56,40,0.28), 0 2px 8px rgba(27,56,40,0.08)', fontFamily: OUTFIT, color: NEU.ink,
        }}
      >
        {/* Header: who, where, and the tally */}
        <div className="flex items-start gap-3 px-5 pt-5 pb-3">
          <CommitteeLogo committee={committee} size={38} alt={labels.big} />
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>
              Give to {society.name}
            </h2>
            <p className="[overflow-wrap:anywhere]" style={{ margin: '2px 0 0', fontSize: 12.5, color: NEU.inkSoft }}>
              {labels.big}{labels.full ? `, ${labels.full}` : ''}
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
            style={{ width: 32, height: 32, borderRadius: 10, border: 'none', background: 'transparent', color: NEU.inkSoft, cursor: 'pointer' }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center gap-3 px-5 pb-3">
          <label className="flex items-center gap-2 px-3 flex-1" style={{ minWidth: 0, height: 36, borderRadius: 10, background: '#FAF8F3', boxShadow: '0 0 0 1px rgba(27,56,40,0.10)' }}>
            <Search size={15} strokeWidth={1.5} style={{ color: NEU.inkSoft, flexShrink: 0 }} />
            <input
              type="text"
              autoFocus
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
          <span className="flex-shrink-0" style={{ fontSize: 12.5, color: NEU.inkSoft }}>
            <span style={{ fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{freeCount}</span> free
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-2" style={{ overscrollBehavior: 'contain' }}>
          {shown.length === 0 && (
            <p className="px-2 py-8 text-center" style={{ fontSize: 14, color: NEU.inkSoft }}>
              {slots.length === 0 ? 'This committee has no countries yet' : 'No country matches'}
            </p>
          )}
          {shown.map(s => {
            const rows = byCountry.get(s.country_code) ?? [];
            const open = openSeatsForSociety(s, byCountry, society.id);
            const busy = busyCodes.has(s.country_code);
            const theirs = rows.length > 0 && rows.every(r => allocationSocietyId(r) === society.id);
            const flag = <CountryFlag code={s.country_code} w={22} h={22} alt="" logoUrl={slotLogoUrl(committee, s)} />;
            const seatsNote = s.delegation_size > 1
              ? (open.length > 0 && open.length < s.delegation_size ? `${open.length} of ${s.delegation_size} seats left` : `${s.delegation_size} seats`)
              : null;
            const name = (
              <span className="flex-1 min-w-0 inline-flex items-baseline flex-wrap" style={{ gap: '0 8px', lineHeight: 1.25 }}>
                <CountryName name={s.country_name} code={s.country_code} style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'normal', overflowWrap: 'anywhere' }} />
                {seatsNote && <span style={{ fontSize: 11.5, color: NEU.inkSoft }}>{seatsNote}</span>}
              </span>
            );

            // Free for this delegation: the whole row is the button.
            if (open.length > 0) {
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onGive(s, open)}
                  aria-label={`Give ${s.country_name} to ${society.name}`}
                  className={`focus:outline-none focus-visible:ring-2 text-left ${rowBase}`}
                  style={{ ...rowStyle, border: 'none', borderTop: rowStyle.borderTop, background: 'transparent', cursor: busy ? 'default' : 'pointer', fontFamily: OUTFIT, color: NEU.ink, borderRadius: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#FAF8F3'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {flag}
                  {name}
                  <span
                    className="flex-shrink-0 inline-flex items-center gap-1"
                    style={{
                      height: 28, padding: '0 12px 0 9px', borderRadius: 9, fontSize: 12.5, fontWeight: 600,
                      background: busy ? WELL : 'linear-gradient(180deg, #2A5039, #1B3828)', color: busy ? NEU.inkSoft : '#FFFFFF',
                    }}
                  >
                    {!busy && <Plus size={13} strokeWidth={2} aria-hidden />}
                    {busy ? 'Saving' : 'Give'}
                  </span>
                </button>
              );
            }

            if (theirs) {
              const now = givenNow.has(s.country_code);
              return (
                <div key={s.id} className={rowBase} style={{ ...rowStyle, background: now ? WELL : 'transparent', borderRadius: now ? 10 : 0 }}>
                  {flag}
                  {name}
                  <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontSize: 12.5, fontWeight: 600, color: NEU.forest }}>
                    <Check size={14} strokeWidth={2} aria-hidden /> {now ? 'Given' : 'Theirs'}
                  </span>
                  {now && (
                    <button
                      type="button"
                      onClick={() => onUndo(s)}
                      disabled={busy}
                      className="focus:outline-none flex-shrink-0"
                      style={{ border: 'none', background: 'none', padding: '0 4px', cursor: busy ? 'default' : 'pointer', fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 700, color: NEU.ink, textDecoration: 'underline', textUnderlineOffset: 3, opacity: busy ? 0.5 : 1 }}
                    >
                      {busy ? 'Saving' : 'Undo'}
                    </button>
                  )}
                </div>
              );
            }

            // Held by someone else: greyed with who holds it.
            const holders = rows.filter(r => allocationSocietyId(r) !== society.id).map(r => holderOf(r, societyName));
            const seen = new Set<string>();
            const unique = holders.filter(h => (seen.has(`${h.kind}:${h.name}`) ? false : (seen.add(`${h.kind}:${h.name}`), true)));
            return (
              <div key={s.id} className={rowBase} style={{ ...rowStyle, opacity: 0.55 }} title={`Taken by ${unique.map(h => h.name).join(', ')}`}>
                {flag}
                {name}
                <span className="flex flex-col items-end flex-shrink-0" style={{ gap: 2, maxWidth: '50%' }}>
                  {unique.map(h => (
                    <span key={`${h.kind}:${h.name}`} className="inline-flex items-center gap-1.5 min-w-0" style={{ fontSize: 12, color: NEU.ink }}>
                      {h.kind === 'delegation'
                        ? <DelegationCrest name={h.name} logoUrl={h.logoUrl} size={16} />
                        : <PersonAvatar name={h.name} url={h.avatarUrl} size={16} />}
                      <span className="[overflow-wrap:anywhere] text-right">{h.name}</span>
                    </span>
                  ))}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3" style={{ borderTop: `1px solid ${HAIRLINE}` }}>
          <button
            type="button"
            onClick={onClose}
            className="focus:outline-none"
            style={{ height: 36, padding: '0 20px', borderRadius: 10, border: 'none', background: 'linear-gradient(180deg, #2A5039, #1B3828)', color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Done
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}
