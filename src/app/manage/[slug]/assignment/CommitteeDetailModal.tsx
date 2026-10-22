'use client';

// ── The classic committee pop-up ─────────────────────────────────────────────
// Moved out of assignment/page.tsx unchanged (owner, 22 Oct 2026: "It needs to
// be similar to BEFORE in a committee, I liked it that way"). The classic
// board and the seat board both open THIS pop-up for a committee:
//   * no mode: the classic pop-up exactly (open seats "+ Assign" through the
//     page's classic assign flow, Change seat / Deallocate, expand a person);
//   * person mode (the seat board with a person open, or a person dropped on a
//     ring): the same pop-up, each open seat reads "Seat <First name>" and
//     seats that person in that exact seat, then closes;
//   * give mode (the seat board's Delegations tab): the same card, header,
//     seats-filled bar and rows by importance; an open seat the delegation can
//     take reads "Give" and the pop-up stays open for the next tap, with a
//     running tally; a row given here takes it back on a second tap. Nothing
//     here writes: the Delegations tab's queue does.
// The small pieces it is built from (the importance dashes, TierBadge, the
// modal card, the row menu) stay shared with page.tsx through this file.

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Check, ChevronDown, ChevronUp, Plus, Users, Trash2, Repeat, MoreVertical, CheckCircle2,
} from 'lucide-react';
import { NEU, NEU_GRADIENTS, NeuProgress } from '@/components/neu';
import { ModalOverlay as SharedModalOverlay } from '@/components/ModalOverlay';
import { CountryName, StackedName } from '@/app/manage/[slug]/assignment/displayNames';
import {
  type AcceptedApp, type AllocationRow, type SlotRow, type CommitteeData, type UserHistory,
  slotLogoUrl, OUTFIT, MONO, FLAG_SHADOW, PersonAvatar, DelegationAvatar, CountryFlag, effectiveLevel, ageOf,
  committeeLabels, CommitteeLogo, CommitteeDifficultyBadge, LevelTag, DelegationChip, DelegateDetail,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import {
  type ImportanceTier, allocationSocietyId, distinctCountryFilled, groupAllocationsByCountry, isSlotFull, openSeatsForSociety,
} from '@/lib/assignmentFit';

// Rebuild an AcceptedApp shape from an allocation row so the existing
// DelegateDetail / scoring paths can be reused for an already-assigned
// delegate (the click-into overview list).
export function allocationToApp(a: AllocationRow): AcceptedApp {
  return {
    id: a.application_id ?? a.id,
    role: a.applications?.role ?? 'delegate',
    experience_level: a.applications?.experience_level ?? null,
    is_head_delegate: a.applications?.is_head_delegate ?? false,
    society_id: a.applications?.society_id ?? null,
    payment_status: a.applications?.payment_status ?? null,
    attending: a.applications?.attending ?? true,
    invited_email: a.applications?.invited_email ?? null,
    invited_name: a.applications?.invited_name ?? null,
    profiles: a.profiles
      ? {
          id: a.profiles.id ?? a.user_id ?? '',
          display_name: a.profiles.display_name,
          email: a.profiles.email ?? '',
          nationality: a.profiles.nationality ?? null,
          date_of_birth: a.profiles.date_of_birth ?? null,
          mun_experience_level: a.profiles.mun_experience_level ?? null,
          avatar_url: a.profiles.avatar_url,
        }
      : null,
    societies: a.applications?.societies ?? null,
    application_preferences: a.applications?.application_preferences ?? [],
  };
}

// Urgency order for the drop popup: high > medium > low > standard
export const TIER_RANK: Record<ImportanceTier, number> = { high: 0, medium: 1, low: 2, standard: 3 };
// `dashes` + `color` both encode the tier, exactly mirroring the committee-setup
// editor (ConferenceRosterPicker): standard = 1 dash grey, low = 2 green,
// medium = 3 yellow, high = 4 red. `label` feeds title/aria text only.
export const TIER_META: Record<ImportanceTier, { label: string; color: string; bg: string; dashes: number }> = {
  high:     { label: 'HIGH', color: '#8B2020', bg: 'rgba(139,32,32,0.10)', dashes: 4 },
  medium:   { label: 'MED',  color: '#D4A72C', bg: 'rgba(212,167,44,0.14)', dashes: 3 },
  low:      { label: 'LOW',  color: '#3D7A52', bg: 'rgba(61,122,82,0.12)', dashes: 2 },
  standard: { label: 'STD',  color: '#9A8A78', bg: 'rgba(154,138,120,0.12)', dashes: 1 },
};



// The display NAME for an occupied (delegate) allocation row. A profile can
// carry a blank/whitespace display_name (a real occurrence when the row exists
// but the name was never set), and `??` would let that empty string through and
// render a nameless chip — so every source is trimmed and skipped when empty,
// falling back display_name → application invited_name → email → a neutral
// 'Assigned', never blank.
export function allocateeName(alloc: AllocationRow): string {
  const dn = alloc.profiles?.display_name?.trim();
  if (dn) return dn;
  const inv = alloc.applications?.invited_name?.trim();
  if (inv) return inv;
  const email = alloc.profiles?.email?.trim();
  if (email) return email;
  return 'Assigned';
}

// ── Importance dashes ──────────────────────────────────────────────────────────
// The canonical committee-setup indicator (ConferenceRosterPicker): a stack of
// vertical bars whose count AND colour encode the tier — 1 grey / 2 green /
// 3 yellow / 4 red. Replaces the old HIGH/MED/LOW/STD word chips everywhere.
export function ImportanceDashes({ tier, barHeight = 11 }: { tier: ImportanceTier; barHeight?: number }) {
  const meta = TIER_META[tier];
  return (
    <span className="inline-flex items-end" style={{ gap: 2 }} aria-hidden>
      {Array.from({ length: meta.dashes }).map((_, i) => (
        <span key={i} style={{ width: 2, height: barHeight, borderRadius: 1, backgroundColor: meta.color, display: 'inline-block' }} />
      ))}
    </span>
  );
}

export function TierBadge({ tier, onCycle }: { tier: ImportanceTier; onCycle?: () => void }) {
  const meta = TIER_META[tier];
  const title = `Country importance: ${meta.label}.${onCycle ? ' Click to cycle: standard, low, medium, high.' : ''}`;
  const style: React.CSSProperties = {
    padding: '4px 8px',
    borderRadius: 8,
    backgroundColor: NEU.surface,
    boxShadow: NEU.outSm,
    cursor: onCycle ? 'pointer' : 'default',
  };
  if (!onCycle) {
    return (
      <span title={title} aria-label={`Importance: ${meta.label}`} className="inline-flex items-center" style={style}>
        <ImportanceDashes tier={tier} />
      </span>
    );
  }
  return (
    <button
      onClick={e => { e.stopPropagation(); onCycle(); }}
      title={title}
      aria-label={`Importance: ${meta.label}`}
      className="focus:outline-none inline-flex items-center"
      style={style}
    >
      <ImportanceDashes tier={tier} />
    </button>
  );
}


export function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Thin wrapper over the shared house backdrop (@/components/ModalOverlay),
  // which owns the background scroll lock, Escape-to-close and the dialog ARIA.
  // `px-4` (no vertical padding) preserves this page's original spacing.
  return <SharedModalOverlay onClose={onClose} paddingClassName="px-4">{children}</SharedModalOverlay>;
}

/** The extruded ivory card every assignment modal sits in. */
export function NeuModalCard({ children, width = 480 }: { children: React.ReactNode; width?: number }) {
  return (
    <div
      className="p-6"
      style={{
        width: `min(92vw, ${width}px)`,
        backgroundColor: NEU.surface,
        borderRadius: 24,
        maxHeight: '88dvh',
        overflowY: 'auto',
        boxShadow: `${NEU.out}, 0 24px 60px rgba(27,56,40,0.28)`,
      }}
    >
      {children}
    </div>
  );
}

/** One neu open-seat tier chip: the vertical-dash importance indicator + the
 *  open count for that tier (no words). */
export function OpenTierChip({ tier, count, onClick }: { tier: ImportanceTier; count: number; onClick?: () => void }) {
  const meta = TIER_META[tier];
  return (
    <span
      onClick={onClick ? e => { e.stopPropagation(); onClick(); } : undefined}
      title={`${count} open ${meta.label.toLowerCase()}-importance seat${count === 1 ? '' : 's'}`}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full"
      style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm, cursor: onClick ? 'pointer' : 'default' }}
    >
      <ImportanceDashes tier={tier} barHeight={10} />
      <span style={{ fontSize: 11, fontFamily: MONO, fontWeight: 800, color: meta.color, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>
        {count}
      </span>
    </span>
  );
}

// ── RowMenu ─────────────────────────────────────────────────────────────────
// A portaled, edge-flipped action dropdown for one overview list row. Rendered
// in a Portal at fixed viewport coords computed from the trigger and flipped
// above / against the right edge so the modal's own overflow never clips it.
export function RowMenu({ items }: { items: { label: string; icon: React.ReactNode; danger?: boolean; onClick: () => void }[] }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const MENU_W = 188;
  const menuH = items.length * 40 + 12;

  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = r.right - MENU_W;
    if (left + MENU_W > vw - 10) left = vw - 10 - MENU_W;
    if (left < 10) left = 10;
    const below = r.bottom + 6;
    const flipUp = below + menuH > vh - 10 && r.top - menuH - 6 > 10;
    setPos({ top: flipUp ? r.top - menuH - 6 : below, left });
  }, [menuH]);

  useEffect(() => {
    if (!open) return;
    // Measured on the next frame, from a callback rather than the effect body.
    const raf = requestAnimationFrame(place);
    const handler = () => place();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, place]);

  return (
    <>
      <button
        ref={btnRef}
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title="Allocation options"
        aria-label="Allocation options"
        className="focus:outline-none inline-flex items-center justify-center flex-shrink-0"
        style={{ width: 28, height: 28, borderRadius: 9999, backgroundColor: NEU.surface, boxShadow: open ? NEU.outSmHover : NEU.outSm, color: NEU.muted }}
      >
        <MoreVertical size={15} />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 60 }} onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <div
            className="fixed"
            style={{
              top: pos.top, left: pos.left, width: MENU_W, zIndex: 61,
              backgroundColor: NEU.surface, borderRadius: 14, padding: 6,
              boxShadow: `${NEU.out}, 0 14px 34px rgba(27,56,40,0.22)`,
            }}
            onClick={e => e.stopPropagation()}
          >
            {items.map((it, i) => (
              <button
                key={i}
                onClick={() => { setOpen(false); it.onClick(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg focus:outline-none"
                style={{ fontSize: 12.5, fontWeight: 700, fontFamily: OUTFIT, color: it.danger ? '#8B2020' : NEU.ink, background: 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = NEU.base; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >
                {it.icon}
                {it.label}
              </button>
            ))}
          </div>
        </>,
        document.getElementById('fit-root') ?? document.body,
      )}
    </>
  );
}

// ── CommitteeOverviewModal ────────────────────────────────────────────────────
// Click-into overview of a single committee: the whole roster as a simple
// alphabetical LIST — one row per seat with the country flag, the delegate's
// photo, name (+ age), their delegation and their level, plus a per-row
// allocation dropdown (deallocate / change). Clicking an allocated row expands
// that delegate's full application detail (reusing DelegateDetail). Empty seats
// read as open and assign on click.
/** What the pop-up is opened for besides the classic overview (see the top
 *  of this file). */
export type CommitteeModalMode =
  | {
      kind: 'person';
      /** "Seat <First name>" on every open seat. */
      firstName: string;
      /** Seats the person in this exact seat; the pop-up closes after it. */
      onSeat: (slot: SlotRow, seat: number) => void;
    }
  | {
      kind: 'give';
      societyId: string;
      societyName: string;
      /** Country codes never given to a delegation here (observer seats). */
      skip: ReadonlySet<string>;
      /** Countries given while this pop-up is open. */
      givenNow: ReadonlySet<string>;
      /** Allocations the delegation still needs. */
      stillNeeds?: number;
      /** Countries with a write still running. */
      busyCodes: ReadonlySet<string>;
      /** A delegation's name by id (rows laid over by the tab's own writes). */
      delegationName?: (societyId: string) => string | null;
      onGive: (slot: SlotRow, seats: number[]) => void;
      onUndo: (slot: SlotRow) => void;
    };

const NO_HISTORY: Record<string, UserHistory> = {};

export function CommitteeOverviewModal({
  committee, history = NO_HISTORY, onClose, onRemoveAllocation, onAssignSlot, onChangeAllocation, mode,
}: {
  committee: CommitteeData;
  history?: Record<string, UserHistory>;
  onClose: () => void;
  /** Absent in give mode: a seat's row menu is not offered there. */
  onRemoveAllocation?: (a: AllocationRow) => void;
  onAssignSlot?: (slot: SlotRow, seat: number) => void;
  onChangeAllocation?: (a: AllocationRow) => void;
  mode?: CommitteeModalMode;
}) {
  // Keyed by `${slot.id}-${seat}` since a double slot now shows up to two rows.
  const [expandedSeatKey, setExpandedSeatKey] = useState<string | null>(null);
  const give = mode?.kind === 'give' ? mode : null;
  const person = mode?.kind === 'person' ? mode : null;
  const filled = distinctCountryFilled(committee.conference_allocations);
  const total = committee.total_slots;
  const hasDoubleSlot = committee.committee_country_slots.some(s => s.delegation_size >= 2);
  const seatsFilled = committee.conference_allocations.length;
  const seatsTotal = committee.committee_country_slots.reduce((sum, s) => sum + s.delegation_size, 0);
  const labels = committeeLabels(committee);
  const byCountry = groupAllocationsByCountry(committee.conference_allocations);
  const openSlots = committee.committee_country_slots.filter(s => !isSlotFull(s, byCountry));
  const openTierCounts: Record<ImportanceTier, number> = { high: 0, medium: 0, low: 0, standard: 0 };
  for (const s of openSlots) openTierCounts[s.importance] += 1;
  // Always alphabetical by country/character name.
  // Ordered by importance tier first (high first), then alphabetical within tier.
  const slots = [...committee.committee_country_slots].filter(s => !give || !give.skip.has(s.country_code)).sort(
    (a, b) => TIER_RANK[a.importance] - TIER_RANK[b.importance] || a.country_name.localeCompare(b.country_name)
  );

  return (
    <ModalOverlay onClose={onClose}>
      <NeuModalCard width={620}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <CommitteeLogo committee={committee} size={54} alt={committee.name} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 title={committee.name} className="[overflow-wrap:anywhere]" style={{ fontSize: 24, fontWeight: 900, color: NEU.forest, fontFamily: OUTFIT, letterSpacing: '0.01em', lineHeight: 1.05 }}>
                  {labels.big}
                </h2>
                <CommitteeDifficultyBadge level={committee.difficulty} disc={30} glyph={20} />
              </div>
              {labels.full && (
                <p className="[overflow-wrap:anywhere]" style={{ fontSize: 12, color: NEU.muted, fontFamily: OUTFIT, marginTop: 1 }}>{labels.full}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="focus:outline-none flex-shrink-0 mt-1" style={{ color: NEU.muted }}><X size={18} /></button>
        </div>

        {/* Give mode: who the seats go to, and the running tally */}
        {give && (
          <div
            className="flex items-center justify-between gap-3 flex-wrap mb-4 px-3 py-2.5"
            style={{ backgroundColor: NEU.base, borderRadius: 14, boxShadow: NEU.inSm, fontFamily: OUTFIT }}
            aria-live="polite"
          >
            <span className="[overflow-wrap:anywhere] min-w-0" style={{ fontSize: 13.5, color: NEU.ink }}>
              Giving to <strong style={{ fontWeight: 800 }}>{give.societyName}</strong>
            </span>
            <span className="inline-flex items-baseline gap-2 flex-shrink-0">
              <span style={{ fontSize: 13, fontWeight: 900, color: NEU.ink, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                {give.givenNow.size} <span style={{ fontWeight: 600, color: NEU.inkSoft }}>given</span>
              </span>
              {give.stillNeeds != null && (
                <span style={{ fontSize: 12, fontWeight: give.stillNeeds > 0 ? 600 : 700, color: give.stillNeeds > 0 ? NEU.inkSoft : NEU.forest }}>
                  {give.stillNeeds > 0 ? `${give.stillNeeds} still needed` : 'All needed given'}
                </span>
              )}
            </span>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: 11, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 700 }}>SEATS FILLED</span>
            <span className="flex items-baseline gap-1.5">
              <span style={{ fontSize: 13, fontWeight: 900, color: NEU.ink, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                {filled}<span style={{ color: NEU.muted, fontWeight: 600 }}>/{total}</span>
              </span>
              {hasDoubleSlot && (
                <span style={{ fontSize: 10.5, color: NEU.muted, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                  {seatsFilled}/{seatsTotal} seats
                </span>
              )}
            </span>
          </div>
          <NeuProgress value={filled} max={total} height={8} gradient={filled >= total ? NEU_GRADIENTS.green : NEU_GRADIENTS.forest} />
        </div>

        {/* Open-seat importance summary: dash indicator + count, no words. */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {openSlots.length === 0 ? (
            <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 700, color: NEU.forest, fontFamily: OUTFIT }}>
              <CheckCircle2 size={14} strokeWidth={2.4} aria-hidden="true" /> Fully allocated
            </span>
          ) : (
            (['high', 'medium', 'low', 'standard'] as ImportanceTier[]).map(t =>
              openTierCounts[t] === 0 ? null : <OpenTierChip key={t} tier={t} count={openTierCounts[t]} />
            )
          )}
        </div>

        <p style={{ fontSize: 10, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 8 }}>
          ALLOCATION OVERVIEW
        </p>

        <div className="flex flex-col gap-1.5" style={{ maxHeight: 420, overflowY: 'auto' }}>
          {slots.flatMap(slot => {
            const rows = byCountry.get(slot.country_code) ?? [];
            const bySeat = new Map(rows.map(r => [r.seat, r]));
            const seatLabel = (seatNum: number) => (slot.delegation_size >= 2 ? `, seat ${seatNum}` : '');

            return Array.from({ length: slot.delegation_size }, (_, i) => i + 1).map(seatNum => {
              const alloc = bySeat.get(seatNum) ?? null;
              const seatKey = `${slot.id}-${seatNum}`;

              if (!alloc && give) {
                // Give mode: an open seat this delegation can take gives the
                // country (every seat of it still open to them, as the
                // Delegations tab always has) and the pop-up stays open.
                const free = openSeatsForSociety(slot, byCountry, give.societyId);
                const busy = give.busyCodes.has(slot.country_code);
                const inner = (
                  <>
                    <CountryFlag code={slot.country_code} w={30} h={30} radius={9999} shadow={FLAG_SHADOW} dim={0.5} alt={slot.country_name} logoUrl={slotLogoUrl(committee, slot)} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: NEU.ink, fontFamily: OUTFIT }}><CountryName name={slot.country_name} code={slot.country_code} /></p>
                      <p style={{ fontSize: 11.5, color: NEU.inkSoft, fontFamily: OUTFIT, marginTop: 1 }}>Open seat{seatLabel(seatNum)}</p>
                    </div>
                    <TierBadge tier={slot.importance} />
                  </>
                );
                if (!free.includes(seatNum)) {
                  return (
                    <div key={seatKey} className="w-full flex items-center gap-3 px-3 py-2.5" style={{ backgroundColor: NEU.base, borderRadius: 14, boxShadow: NEU.inSm }}>
                      {inner}
                    </div>
                  );
                }
                return (
                  <button
                    key={seatKey}
                    onClick={() => give.onGive(slot, free)}
                    aria-label={`Give ${slot.country_name} to ${give.societyName}`}
                    className="w-full flex items-center gap-3 px-3 py-2.5 focus:outline-none text-left"
                    style={{ backgroundColor: NEU.base, borderRadius: 14, boxShadow: NEU.inSm }}
                  >
                    {inner}
                    <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontSize: 10.5, fontWeight: 800, color: NEU.forest, fontFamily: MONO, letterSpacing: 0 }}>
                      {busy ? 'Saving' : <><Plus size={12} strokeWidth={2.6} /> Give</>}
                    </span>
                  </button>
                );
              }

              if (!alloc) {
                // Open seat — clicking assigns this exact seat. With a person
                // open on the seat board it seats THAT person here instead.
                return (
                  <button
                    key={seatKey}
                    onClick={() => {
                      if (person) person.onSeat(slot, seatNum);
                      else onAssignSlot?.(slot, seatNum);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 focus:outline-none text-left"
                    style={{ backgroundColor: NEU.base, borderRadius: 14, boxShadow: NEU.inSm }}
                  >
                    <CountryFlag code={slot.country_code} w={30} h={30} radius={9999} shadow={FLAG_SHADOW} dim={0.5} alt={slot.country_name} logoUrl={slotLogoUrl(committee, slot)} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13.5, fontWeight: 700, color: NEU.ink, fontFamily: OUTFIT }}><CountryName name={slot.country_name} code={slot.country_code} /></p>
                      <p style={{ fontSize: 11.5, color: NEU.inkSoft, fontFamily: OUTFIT, marginTop: 1 }}>Open seat{seatLabel(seatNum)}</p>
                    </div>
                    <TierBadge tier={slot.importance} />
                    <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontSize: 10.5, fontWeight: 800, color: NEU.forest, fontFamily: MONO, letterSpacing: 0 }}>
                      <Plus size={12} strokeWidth={2.6} /> {person ? `Seat ${person.firstName}` : 'Assign'}
                    </span>
                  </button>
                );
              }

              // A delegation-owned seat has no delegate to expand into; it reads
              // as "held by the delegation, not yet distributed" with a Users
              // glyph and a Deallocate action.
              const isSociety = !!alloc.society_id && !alloc.user_id;
              if (isSociety) {
                const removableSoc = !alloc.id.startsWith('temp-');
                const socId = allocationSocietyId(alloc);
                const socName = (give && socId ? give.delegationName?.(socId) : null) ?? alloc.delegation?.name ?? 'Delegation';
                const theirs = !!give && socId === give.societyId;
                const inner = (
                  <>
                    <CountryFlag code={slot.country_code} w={30} h={30} radius={9999} shadow={FLAG_SHADOW} alt={slot.country_name} title={slot.country_name} logoUrl={slotLogoUrl(committee, slot)} />
                    <DelegationAvatar size={30} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 14, fontWeight: 800, color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
                        {socName}
                      </p>
                      <p style={{ fontSize: 11, color: NEU.inkSoft, fontFamily: OUTFIT, marginTop: 1 }}><CountryName name={slot.country_name} code={slot.country_code} suffix={seatLabel(seatNum)} /></p>
                    </div>
                  </>
                );
                // Give mode: a country given in this pop-up takes it back on a
                // second tap (only its empty seats go back).
                if (give && theirs && give.givenNow.has(slot.country_code)) {
                  const busy = give.busyCodes.has(slot.country_code);
                  return (
                    <button
                      key={seatKey}
                      onClick={() => give.onUndo(slot)}
                      aria-label={`Take ${slot.country_name} back from ${give.societyName}`}
                      title="Tap again to take it back"
                      className="w-full flex items-center gap-3 px-3 py-2.5 focus:outline-none text-left"
                      style={{ backgroundColor: NEU.surface, borderRadius: 14, boxShadow: NEU.outSm }}
                    >
                      {inner}
                      <span className="inline-flex items-center gap-2 flex-shrink-0" style={{ fontFamily: OUTFIT, whiteSpace: 'nowrap' }}>
                        <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 700, color: NEU.forest }}>
                          <Check size={14} strokeWidth={2.4} aria-hidden="true" /> {busy ? 'Saving' : 'Given'}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: NEU.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>Undo</span>
                      </span>
                    </button>
                  );
                }
                return (
                  <div
                    key={seatKey}
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{ backgroundColor: NEU.surface, borderRadius: 14, boxShadow: NEU.outSm }}
                  >
                    {inner}
                    {theirs ? (
                      <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontSize: 12, fontWeight: 700, color: NEU.forest, fontFamily: OUTFIT, whiteSpace: 'nowrap' }}>
                        <Check size={14} strokeWidth={2.4} aria-hidden="true" /> Theirs
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 flex-shrink-0"
                        style={{ fontSize: 12, fontWeight: 700, color: '#8A6614', fontFamily: OUTFIT, whiteSpace: 'nowrap' }}
                      >
                        <Users size={14} strokeWidth={2.4} aria-hidden="true" /> Delegation
                      </span>
                    )}
                    {removableSoc && onRemoveAllocation && (
                      <RowMenu
                        items={[{ label: 'Deallocate', icon: <Trash2 size={14} />, danger: true, onClick: () => onRemoveAllocation(alloc) }]}
                      />
                    )}
                  </div>
                );
              }

              const app = allocationToApp(alloc);
              const name = allocateeName(alloc);
              const age = ageOf(app);
              const userHistory = alloc.user_id ? history[alloc.user_id] : undefined;
              const expanded = expandedSeatKey === seatKey;
              const removable = !alloc.id.startsWith('temp-');

              return (
                <div
                  key={seatKey}
                  className="flex flex-col"
                  style={{ backgroundColor: NEU.surface, borderRadius: 14, boxShadow: expanded ? NEU.outSmHover : NEU.outSm }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedSeatKey(expanded ? null : seatKey)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedSeatKey(expanded ? null : seatKey); } }}
                    className="flex items-center gap-3 px-3 py-2.5 focus:outline-none"
                    style={{ cursor: 'pointer' }}
                    title="Open application detail"
                  >
                    <CountryFlag code={slot.country_code} w={30} h={30} radius={9999} shadow={FLAG_SHADOW} alt={slot.country_name} title={slot.country_name} logoUrl={slotLogoUrl(committee, slot)} />
                    {/* Seat row is a role="button" <div> (not a real <button>), so the
                        link is legal; nested keeps the expand/collapse toggle intact. */}
                    <PersonAvatar name={name} url={alloc.profiles?.avatar_url ?? null} size={30} userId={alloc.user_id} nested />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontFamily: OUTFIT }}>
                        <StackedName
                          name={name} size={14} color={NEU.ink} restColor={NEU.inkSoft}
                          after={age != null ? <span style={{ fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>, {age}</span> : undefined}
                        />
                      </div>
                      <p style={{ fontSize: 11, color: NEU.inkSoft, fontFamily: OUTFIT, marginTop: 1 }}><CountryName name={slot.country_name} code={slot.country_code} suffix={seatLabel(seatNum)} /></p>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                      <DelegationChip app={app} />
                      <LevelTag level={effectiveLevel(app)} />
                    </div>
                    {onChangeAllocation && onRemoveAllocation && (
                      <RowMenu
                        items={[
                          { label: 'Change seat', icon: <Repeat size={14} />, onClick: () => onChangeAllocation(alloc) },
                          ...(removable ? [{ label: 'Deallocate', icon: <Trash2 size={14} />, danger: true, onClick: () => onRemoveAllocation(alloc) }] : []),
                        ]}
                      />
                    )}
                    {expanded ? <ChevronUp size={15} style={{ color: NEU.muted, flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: NEU.muted, flexShrink: 0 }} />}
                  </div>
                  {/* Compact delegation/level row for narrow widths */}
                  <div className="sm:hidden flex items-center gap-1.5 flex-wrap px-3 pb-2.5">
                    <DelegationChip app={app} />
                    <LevelTag level={effectiveLevel(app)} />
                  </div>
                  {expanded && (
                    <div className="px-3 pb-3">
                      <DelegateDetail app={app} history={userHistory} contextCommitteeId={committee.id} contextCountryCode={slot.country_code} />
                    </div>
                  )}
                </div>
              );
            });
          })}
          {slots.length === 0 && (
            <p className="text-xs py-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No country slots in this committee.</p>
          )}
        </div>

        {/* Give mode: many taps, then one way out */}
        {give && (
          <div className="flex items-center justify-between gap-3 mt-4">
            <span style={{ fontSize: 12, color: NEU.inkSoft, fontFamily: OUTFIT, lineHeight: 1.35 }}>
              Tap an open seat to give it to {give.societyName}, tap again to take it back
            </span>
            <button
              type="button"
              onClick={onClose}
              className="focus:outline-none flex-shrink-0 transition-transform duration-150 active:scale-[0.96]"
              style={{ height: 34, padding: '0 18px', borderRadius: 10, border: 'none', background: NEU.forest, color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}
            >
              Done
            </button>
          </div>
        )}
      </NeuModalCard>
    </ModalOverlay>
  );
}
