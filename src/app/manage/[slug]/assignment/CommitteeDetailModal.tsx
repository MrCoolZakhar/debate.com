'use client';

// ── The classic committee pop-up ─────────────────────────────────────────────
// Moved out of assignment/page.tsx (owner, 22 Oct 2026: "It needs to be
// similar to BEFORE in a committee, I liked it that way"), then restyled in
// the seat board's design with its structure and behaviour kept (owner, 22 Oct
// 2026): a white card, the committee ring half outside its top-left edge,
// round flags, avatars with the nationality flag, bold names, the light
// secondary pills and the importance dashes on a white disc. The classic
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
import { NEU } from '@/components/neu';
import { ModalOverlay as SharedModalOverlay } from '@/components/ModalOverlay';
import { CountryName } from '@/app/manage/[slug]/assignment/displayNames';
import {
  type AcceptedApp, type AllocationRow, type SlotRow, type CommitteeData, type UserHistory,
  slotLogoUrl, OUTFIT, MONO, CountryFlag, effectiveLevel,
  committeeLabels, CommitteeDifficultyBadge, DelegateDetail, LevelBadge,
} from '@/app/manage/[slug]/assignment/assignmentKit';
import {
  AvatarWithFlag, ImportanceDisc, NameAge, POPUP_RING_INSET, POPUP_RING_RISE, PopupRingBadge, WELL, nationalityOf,
} from '@/app/manage/[slug]/assignment/seatBoardShared';
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

// ── The seat board look (owner, 22 Oct 2026) ────────────────────────────────
// The committee pop-up and the "choose who" pop-up keep their structure but
// wear the seat board's design: a white card, the committee ring on a white
// disc half outside the card's top-left edge, round flags, avatars with the
// nationality flag on their border, bold names, the light secondary pills and
// the importance dashes on a small white disc.

const LIGHT_CARD_SHADOW = '0 1px 2px rgba(27,56,40,0.06), 0 10px 26px rgba(27,56,40,0.12), 0 30px 70px -20px rgba(27,56,40,0.38)';
/** A row inside a light pop-up. */
export const LIGHT_ROW: React.CSSProperties = { background: '#FAF8F3', borderRadius: 14, boxShadow: '0 0 0 1px rgba(27,56,40,0.06)' };
/** An open seat: white with a dashed edge, so it reads as free at a glance. */
export const LIGHT_OPEN_ROW: React.CSSProperties = { background: '#FFFFFF', borderRadius: 14, border: '1.5px dashed rgba(27,56,40,0.22)' };
/** The one solid button of a light pop-up: a calm forest, never the dark gradient. */
export const LIGHT_PRIMARY: React.CSSProperties = {
  height: 38, padding: '0 20px', borderRadius: 11, border: 'none', cursor: 'pointer',
  background: '#2C4A39', color: '#FFFFFF', fontFamily: OUTFIT, fontSize: 13.5, fontWeight: 600,
  boxShadow: '0 1px 2px rgba(27,56,40,0.14)',
};

/** The white card of a light pop-up. The committee ring rises out of its top
 *  edge, so the card never clips (the list inside scrolls on its own; the
 *  backdrop scrolls a card taller than the screen). */
export function LightModalCard({ children, width = 620 }: { children: React.ReactNode; width?: number }) {
  return (
    <div
      className="relative"
      style={{
        width: `min(94vw, ${width}px)`, marginTop: POPUP_RING_RISE + 8, marginBottom: 16,
        padding: '16px 20px 20px', borderRadius: 24, background: '#FFFFFF', boxShadow: LIGHT_CARD_SHADOW,
        fontFamily: OUTFIT, color: NEU.ink, boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}

/** The header of a light pop-up: the ring badge, the committee's short name
 *  with its difficulty, the full name beneath, a title above when given, and
 *  the close button. */
export function LightModalHeader({ committee, eyebrow, onClose }: { committee: CommitteeData; eyebrow?: string; onClose: () => void }) {
  const labels = committeeLabels(committee);
  return (
    <>
      <PopupRingBadge committee={committee} />
      <div className="flex items-start justify-between gap-3" style={{ marginLeft: POPUP_RING_INSET - 20, minHeight: 50 }}>
        <div className="min-w-0 flex flex-col" style={{ gap: 2 }}>
          {eyebrow && <span style={{ fontSize: 12.5, fontWeight: 600, color: NEU.inkSoft }}>{eyebrow}</span>}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <h2 title={committee.name} className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 22, fontWeight: 700, color: NEU.ink, letterSpacing: '-0.01em', lineHeight: 1.1 }}>
              {labels.big}
            </h2>
            <CommitteeDifficultyBadge level={committee.difficulty} disc={26} glyph={17} />
          </div>
          {labels.full && (
            <p className="[overflow-wrap:anywhere]" style={{ margin: 0, fontSize: 13, color: NEU.inkSoft, lineHeight: 1.25 }}>{labels.full}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="focus:outline-none focus-visible:ring-2 flex-shrink-0 inline-flex items-center justify-center transition-[background-color,transform] duration-150 hover:bg-[#F4F0E6] active:scale-[0.94]"
          style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.10)', color: NEU.ink, cursor: 'pointer' }}
        >
          <X size={17} strokeWidth={1.5} />
        </button>
      </div>
    </>
  );
}

/** The soft pill's look on a span (inside a row that is itself the button). */
export function PillLook({ children, tone = 'forest' }: { children: React.ReactNode; tone?: 'forest' | 'quiet' }) {
  return (
    <span
      className="inline-flex items-center justify-center gap-1 flex-shrink-0 whitespace-nowrap"
      style={{
        height: 30, padding: '0 13px', borderRadius: 999, boxSizing: 'border-box',
        background: '#FFFFFF', color: tone === 'forest' ? '#1B3828' : NEU.inkSoft,
        border: '1px solid rgba(27,56,40,0.20)', boxShadow: '0 1px 2px rgba(27,56,40,0.07)',
        fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600, lineHeight: 1,
      }}
    >
      {children}
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
        type="button"
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        title="Allocation options"
        aria-label="Allocation options"
        className="focus:outline-none focus-visible:ring-2 inline-flex items-center justify-center flex-shrink-0 transition-[background-color,transform] duration-150 hover:bg-[#F4F0E6] active:scale-[0.94]"
        style={{ width: 30, height: 30, borderRadius: 9999, border: 'none', backgroundColor: open ? '#F4F0E6' : '#FFFFFF', boxShadow: '0 0 0 1px rgba(27,56,40,0.12)', color: NEU.ink, cursor: 'pointer' }}
      >
        <MoreVertical size={15} strokeWidth={1.5} />
      </button>
      {open && pos && createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: 60 }} onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <div
            className="fixed"
            style={{
              top: pos.top, left: pos.left, width: MENU_W, zIndex: 61,
              backgroundColor: '#FFFFFF', borderRadius: 14, padding: 6,
              boxShadow: '0 18px 44px rgba(27,56,40,0.20), 0 2px 8px rgba(27,56,40,0.08), 0 0 0 1px rgba(27,56,40,0.06)',
            }}
            onClick={e => e.stopPropagation()}
          >
            {items.map((it, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { setOpen(false); it.onClick(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg focus:outline-none hover:bg-[#F4F0E6]"
                style={{ fontSize: 13, fontWeight: 600, fontFamily: OUTFIT, color: it.danger ? '#8B2020' : NEU.ink, background: 'transparent', border: 'none', cursor: 'pointer' }}
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
// Click-into overview of a single committee: the whole roster as a list, one
// row per seat (high importance first, then A to Z) with the round flag, the
// delegate's avatar with their nationality flag, the bold name (+ age), their
// delegation and their level, plus a per-row allocation menu (deallocate /
// change). Clicking an allocated row expands that delegate's full application
// detail (DelegateDetail). Empty seats read as open and assign on click.
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

function DelegationDisc({ size = 36 }: { size?: number }) {
  return (
    <span aria-hidden className="inline-flex items-center justify-center flex-shrink-0" style={{ width: size, height: size, borderRadius: 999, background: WELL }}>
      <Users size={Math.round(size * 0.5)} strokeWidth={1.5} style={{ color: NEU.ink }} />
    </span>
  );
}

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
  const byCountry = groupAllocationsByCountry(committee.conference_allocations);
  const openSlots = committee.committee_country_slots.filter(s => !isSlotFull(s, byCountry));
  const openTierCounts: Record<ImportanceTier, number> = { high: 0, medium: 0, low: 0, standard: 0 };
  for (const s of openSlots) openTierCounts[s.importance] += 1;
  // Ordered by importance tier first (high first), then alphabetical within tier.
  const slots = [...committee.committee_country_slots].filter(s => !give || !give.skip.has(s.country_code)).sort(
    (a, b) => TIER_RANK[a.importance] - TIER_RANK[b.importance] || a.country_name.localeCompare(b.country_name)
  );
  const fillPct = total > 0 ? Math.min(100, Math.round((filled / total) * 100)) : 0;
  const rowPad = '9px 10px 9px 12px';

  return (
    <ModalOverlay onClose={onClose}>
      <LightModalCard width={640}>
        <LightModalHeader committee={committee} onClose={onClose} />

        {/* Give mode: who the allocations go to, and the running tally */}
        {give && (
          <div
            className="flex items-center justify-between gap-3 flex-wrap mt-4 px-3.5 py-2.5"
            style={{ background: WELL, borderRadius: 14 }}
            aria-live="polite"
          >
            <span className="[overflow-wrap:anywhere] min-w-0" style={{ fontSize: 14, color: NEU.ink }}>
              Giving to <strong style={{ fontWeight: 700 }}>{give.societyName}</strong>
            </span>
            <span className="inline-flex items-baseline gap-2 flex-shrink-0">
              <span className="inline-flex items-baseline gap-1">
                <span style={{ fontSize: 17, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{give.givenNow.size}</span>
                <span style={{ fontSize: 13, color: NEU.inkSoft }}>given</span>
              </span>
              {give.stillNeeds != null && (
                <span style={{ fontSize: 13, fontWeight: give.stillNeeds > 0 ? 500 : 600, color: give.stillNeeds > 0 ? NEU.inkSoft : NEU.forest }}>
                  {give.stillNeeds > 0 ? `${give.stillNeeds} still needed` : 'All needed given'}
                </span>
              )}
            </span>
          </div>
        )}

        {/* Allocations filled */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between gap-3 mb-2">
            <span style={{ fontSize: 13.5, fontWeight: 600, color: NEU.ink }}>Allocations filled</span>
            <span className="inline-flex items-baseline gap-2">
              <span style={{ fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                <span style={{ fontSize: 19, fontWeight: 700, color: NEU.ink }}>{filled}</span>
                <span style={{ fontSize: 14, color: NEU.inkSoft }}>/{total}</span>
              </span>
              {hasDoubleSlot && (
                <span style={{ fontSize: 12, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>{seatsFilled}/{seatsTotal} seats</span>
              )}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Allocations filled"
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={filled}
            style={{ height: 8, borderRadius: 999, background: '#ECE5D6', overflow: 'hidden' }}
          >
            <div style={{ width: `${fillPct}%`, height: '100%', borderRadius: 999, background: filled >= total && total > 0 ? '#2C6B43' : '#1B3828', transition: 'width 320ms cubic-bezier(0.22,1,0.36,1)' }} />
          </div>
        </div>

        {/* Open allocations by importance: the dashes and a count */}
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 mt-3">
          {openSlots.length === 0 ? (
            <span className="inline-flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 600, color: NEU.forest }}>
              <CheckCircle2 size={15} strokeWidth={1.75} aria-hidden="true" /> Fully allocated
            </span>
          ) : (
            (['high', 'medium', 'low', 'standard'] as ImportanceTier[]).map(t =>
              openTierCounts[t] === 0 ? null : (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5"
                  title={`${openTierCounts[t]} open ${TIER_META[t].label.toLowerCase()}-importance allocation${openTierCounts[t] === 1 ? '' : 's'}`}
                >
                  <ImportanceDisc tier={t} size={22} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{openTierCounts[t]}</span>
                </span>
              )
            )
          )}
        </div>

        <h3 style={{ margin: '18px 0 8px', fontSize: 15, fontWeight: 600, color: NEU.ink }}>Allocation Overview</h3>

        <div className="flex flex-col" style={{ gap: 6, maxHeight: 'min(440px, 52dvh)', overflowY: 'auto', padding: 2, margin: -2, overscrollBehavior: 'contain' }}>
          {slots.flatMap(slot => {
            const rows = byCountry.get(slot.country_code) ?? [];
            const bySeat = new Map(rows.map(r => [r.seat, r]));
            const seatLabel = (seatNum: number) => (slot.delegation_size >= 2 ? `, seat ${seatNum}` : '');
            const openLine = (seatNum: number) => (slot.delegation_size >= 2 ? `Open, seat ${seatNum}` : 'Open');
            const flag = (dim?: number) => (
              <CountryFlag code={slot.country_code} w={34} h={34} dim={dim} alt={slot.country_name} title={slot.country_name} logoUrl={slotLogoUrl(committee, slot)} />
            );
            const countryLine = (seatNum: number) => (
              <span className="flex flex-col min-w-0 flex-1" style={{ gap: 1 }}>
                <CountryName name={slot.country_name} code={slot.country_code} style={{ fontSize: 15, fontWeight: 700, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }} />
                <span style={{ fontSize: 12, color: NEU.inkSoft }}>{openLine(seatNum)}</span>
              </span>
            );

            return Array.from({ length: slot.delegation_size }, (_, i) => i + 1).map(seatNum => {
              const alloc = bySeat.get(seatNum) ?? null;
              const seatKey = `${slot.id}-${seatNum}`;

              if (!alloc && give) {
                // Give mode: an open seat this delegation can take gives the
                // country (every seat of it still open to them, as the
                // Delegations tab always has) and the pop-up stays open.
                const free = openSeatsForSociety(slot, byCountry, give.societyId);
                const busy = give.busyCodes.has(slot.country_code);
                if (!free.includes(seatNum)) {
                  return (
                    <div key={seatKey} className="w-full flex items-center gap-3" style={{ ...LIGHT_OPEN_ROW, padding: rowPad, opacity: 0.6 }}>
                      {flag(0.6)}
                      {countryLine(seatNum)}
                      <ImportanceDisc tier={slot.importance} />
                    </div>
                  );
                }
                return (
                  <button
                    key={seatKey}
                    type="button"
                    onClick={() => give.onGive(slot, free)}
                    aria-label={`Give ${slot.country_name} to ${give.societyName}`}
                    className="w-full flex items-center gap-3 focus:outline-none focus-visible:ring-2 text-left transition-colors duration-150 hover:!bg-[#FAF8F3]"
                    style={{ ...LIGHT_OPEN_ROW, padding: rowPad, cursor: 'pointer' }}
                  >
                    {flag(0.6)}
                    {countryLine(seatNum)}
                    <ImportanceDisc tier={slot.importance} />
                    <PillLook>{busy ? 'Saving' : <><Plus size={13} strokeWidth={1.75} aria-hidden /> Give</>}</PillLook>
                  </button>
                );
              }

              if (!alloc) {
                // Open seat — clicking assigns this exact seat. With a person
                // open on the seat board it seats THAT person here instead.
                return (
                  <button
                    key={seatKey}
                    type="button"
                    onClick={() => {
                      if (person) person.onSeat(slot, seatNum);
                      else onAssignSlot?.(slot, seatNum);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 focus:outline-none focus-visible:ring-2 text-left transition-colors duration-150 hover:!bg-[#FAF8F3]"
                    style={{ ...LIGHT_OPEN_ROW, padding: rowPad, cursor: 'pointer' }}
                  >
                    {flag(0.6)}
                    {countryLine(seatNum)}
                    <ImportanceDisc tier={slot.importance} />
                    <PillLook><Plus size={13} strokeWidth={1.75} aria-hidden /> {person ? `Seat ${person.firstName}` : 'Assign'}</PillLook>
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
                    {flag()}
                    <DelegationDisc />
                    <span className="flex flex-col flex-1 min-w-0" style={{ gap: 1 }}>
                      <span className="[overflow-wrap:anywhere]" style={{ fontSize: 15, fontWeight: 700, color: NEU.ink, lineHeight: 1.15 }}>{socName}</span>
                      <span style={{ fontSize: 12, color: NEU.inkSoft }}><CountryName name={slot.country_name} code={slot.country_code} suffix={seatLabel(seatNum)} /></span>
                    </span>
                  </>
                );
                // Give mode: a country given in this pop-up takes it back on a
                // second tap (only its empty seats go back).
                if (give && theirs && give.givenNow.has(slot.country_code)) {
                  const busy = give.busyCodes.has(slot.country_code);
                  return (
                    <button
                      key={seatKey}
                      type="button"
                      onClick={() => give.onUndo(slot)}
                      aria-label={`Take ${slot.country_name} back from ${give.societyName}`}
                      title="Tap again to take it back"
                      className="w-full flex items-center gap-3 focus:outline-none focus-visible:ring-2 text-left"
                      style={{ ...LIGHT_ROW, background: '#FFFFFF', boxShadow: '0 0 0 1.5px #1B3828, 0 4px 12px -6px rgba(27,56,40,0.35)', padding: rowPad, cursor: 'pointer' }}
                    >
                      {inner}
                      <span className="inline-flex items-center gap-2.5 flex-shrink-0" style={{ whiteSpace: 'nowrap' }}>
                        <span className="inline-flex items-center gap-1" style={{ fontSize: 13, fontWeight: 600, color: NEU.forest }}>
                          <Check size={15} strokeWidth={1.75} aria-hidden="true" /> {busy ? 'Saving' : 'Given'}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: NEU.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>Undo</span>
                      </span>
                    </button>
                  );
                }
                return (
                  <div key={seatKey} className="flex items-center gap-3" style={{ ...LIGHT_ROW, padding: rowPad }}>
                    {inner}
                    {theirs ? (
                      <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontSize: 13, fontWeight: 600, color: NEU.forest, whiteSpace: 'nowrap' }}>
                        <Check size={15} strokeWidth={1.75} aria-hidden="true" /> Theirs
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontSize: 13, fontWeight: 600, color: '#8A6614', whiteSpace: 'nowrap' }}>
                        <Users size={15} strokeWidth={1.5} aria-hidden="true" /> Delegation
                      </span>
                    )}
                    {removableSoc && onRemoveAllocation && (
                      <RowMenu
                        items={[{ label: 'Deallocate', icon: <Trash2 size={14} strokeWidth={1.5} />, danger: true, onClick: () => onRemoveAllocation(alloc) }]}
                      />
                    )}
                  </div>
                );
              }

              const app = allocationToApp(alloc);
              const name = allocateeName(alloc);
              const soc = app.societies?.name?.trim() || alloc.delegation?.name?.trim() || null;
              const userHistory = alloc.user_id ? history[alloc.user_id] : undefined;
              const expanded = expandedSeatKey === seatKey;
              const removable = !alloc.id.startsWith('temp-');

              return (
                <div
                  key={seatKey}
                  className="flex flex-col"
                  style={{ ...LIGHT_ROW, background: expanded ? '#FFFFFF' : LIGHT_ROW.background, boxShadow: expanded ? '0 0 0 1px rgba(27,56,40,0.10), 0 10px 24px -12px rgba(27,56,40,0.30)' : LIGHT_ROW.boxShadow }}
                >
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedSeatKey(expanded ? null : seatKey)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedSeatKey(expanded ? null : seatKey); } }}
                    className="flex items-center gap-3 focus:outline-none focus-visible:ring-2 rounded-[14px]"
                    style={{ cursor: 'pointer', padding: rowPad }}
                    title="Open application detail"
                    aria-expanded={expanded}
                  >
                    {flag()}
                    {/* The row is a role="button" <div> (not a real <button>), so the
                        avatar's CV link is legal; nested keeps the toggle intact. */}
                    <AvatarWithFlag name={name} url={alloc.profiles?.avatar_url ?? null} size={36} nationality={nationalityOf(app)} userId={alloc.user_id} nested />
                    <span className="flex flex-col flex-1 min-w-0" style={{ gap: 2 }}>
                      <NameAge name={name} app={app} size={15} />
                      <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12, color: NEU.inkSoft, lineHeight: 1.25 }}>
                        <CountryName name={slot.country_name} code={slot.country_code} suffix={seatLabel(seatNum)} />
                        {soc ? <> · {soc}</> : null}
                      </span>
                    </span>
                    <span className="hidden sm:inline-flex flex-shrink-0"><LevelBadge level={effectiveLevel(app)} /></span>
                    {onChangeAllocation && onRemoveAllocation && (
                      <RowMenu
                        items={[
                          { label: 'Change seat', icon: <Repeat size={14} strokeWidth={1.5} />, onClick: () => onChangeAllocation(alloc) },
                          ...(removable ? [{ label: 'Deallocate', icon: <Trash2 size={14} strokeWidth={1.5} />, danger: true, onClick: () => onRemoveAllocation(alloc) }] : []),
                        ]}
                      />
                    )}
                    {expanded
                      ? <ChevronUp size={16} strokeWidth={1.5} style={{ color: NEU.inkSoft, flexShrink: 0 }} />
                      : <ChevronDown size={16} strokeWidth={1.5} style={{ color: NEU.inkSoft, flexShrink: 0 }} />}
                  </div>
                  {/* The level on narrow widths */}
                  <div className="sm:hidden flex items-center gap-1.5 flex-wrap" style={{ padding: '0 12px 9px 59px' }}>
                    <LevelBadge level={effectiveLevel(app)} />
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
            <p className="py-2" style={{ margin: 0, fontSize: 13.5, color: NEU.inkSoft }}>No countries in this committee yet</p>
          )}
        </div>

        {/* Give mode: many taps, then one way out */}
        {give && (
          <div className="flex items-center justify-between gap-3 mt-4 flex-wrap">
            <span className="flex-1" style={{ fontSize: 12.5, color: NEU.inkSoft, lineHeight: 1.4, minWidth: 200 }}>
              Tap an open seat to give it to {give.societyName}, tap again to take it back
            </span>
            <button
              type="button"
              onClick={onClose}
              className="focus:outline-none focus-visible:ring-2 flex-shrink-0 transition-transform duration-150 active:scale-[0.96]"
              style={LIGHT_PRIMARY}
            >
              Done
            </button>
          </div>
        )}
      </LightModalCard>
    </ModalOverlay>
  );
}
