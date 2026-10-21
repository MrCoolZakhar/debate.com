'use client';

// Small pieces the seat board (SeatBoard.tsx) and its committee pop-up
// (SeatBoardPopup.tsx) share: names, dates, seat counts, the committee ring,
// the gold preference marker, the fit pills (one reason each, sentence case,
// a plus or minus tone) and the seat "double pill" of the classic board
// (flag and country, then each seat's holder or Open). Presentation only;
// nothing here writes.

import type { ReactNode } from 'react';
import { ArrowLeftRight, Minus, Plus, Star, Users } from 'lucide-react';
import { NEU } from '@/components/neu';
import { NEEDS_DELEGATES_REASON, SWAP_REASON, groupAllocationsByCountry } from '@/lib/assignmentFit';
import { FitTip, explainReason, missingSignals } from '@/app/manage/[slug]/assignment/fitReasons';
import { CountryName } from '@/app/manage/[slug]/assignment/displayNames';
import {
  type AcceptedApp, type AllocationRow, type CommitteeData, type SlotRow, type Suggestion,
  CommitteeLogo, CountryFlag, PersonAvatar, committeeLabels, reasonContext, slotLogoUrl, OUTFIT,
} from '@/app/manage/[slug]/assignment/assignmentKit';

export const CARD_SHADOW = '0 1px 2px rgba(27,56,40,0.06), 0 8px 24px rgba(27,56,40,0.08)';
export const HAIRLINE = '#EFEAE0';
export const WELL = '#F4F0E6';

export function personName(app: Pick<AcceptedApp, 'profiles' | 'invited_name'>): string {
  return app.profiles?.display_name?.trim() || app.invited_name?.trim() || 'Unknown';
}

export function schoolName(app: Pick<AcceptedApp, 'society_id' | 'societies'>): string {
  if (app.society_id == null) return 'Independent';
  return app.societies?.name?.trim() || 'Delegation';
}

/** When the application was accepted; the submission time for rows that
 *  predate the stamp. */
export function acceptedAt(app: Pick<AcceptedApp, 'decided_at' | 'submitted_at'>): string | null {
  return app.decided_at || app.submitted_at || null;
}

export function fmtDay(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('en-GB', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function firstName(name: string): string {
  const clean = name.trim();
  if (!clean || clean.includes('@')) return clean;
  return clean.split(/\s+/)[0];
}

/** Seats (not countries): a double country is two seats. */
export function seatCounts(c: CommitteeData): { total: number; filled: number; open: number } {
  const byCountry = groupAllocationsByCountry(c.conference_allocations);
  let total = 0;
  let open = 0;
  for (const s of c.committee_country_slots) {
    total += s.delegation_size;
    open += Math.max(0, s.delegation_size - (byCountry.get(s.country_code)?.length ?? 0));
  }
  return { total, filled: total - open, open };
}

/** The person's first three committee choices: committee id → 1, 2 or 3. */
export function prefOrderByCommittee(app: Pick<AcceptedApp, 'application_preferences'> | null | undefined): Map<string, number> {
  const out = new Map<string, number>();
  if (!app) return out;
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order).slice(0, 3);
  prefs.forEach((p, i) => { if (!out.has(p.conference_committee_id)) out.set(p.conference_committee_id, i + 1); });
  return out;
}

export function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

/** The gold 1 / 2 / 3 on a committee ring or a country row. */
export function GoldMarker({ order, size = 20 }: { order: number; size?: number }) {
  return (
    <span
      aria-label={`${ordinal(order)} choice`}
      title={`${ordinal(order)} choice`}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 999,
        background: '#EED98A', color: '#1B3828',
        boxShadow: '0 0 0 2px #FFFFFF, 0 2px 6px rgba(182,135,31,0.35)',
        fontFamily: OUTFIT, fontSize: Math.round(size * 0.55), fontWeight: 700,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}
    >
      {order}
    </span>
  );
}

/** A committee as a fill ring: logo inside, acronym and open seats beneath. */
export function CommitteeRing({ committee, size = 52, marker, lit }: {
  committee: CommitteeData;
  size?: number;
  /** The open person's 1st / 2nd / 3rd choice. */
  marker?: number;
  /** A drag is over it. */
  lit?: boolean;
}) {
  const { total, filled } = seatCounts(committee);
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const ring = Math.max(3, Math.round(size * 0.07));
  return (
    <span className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
      <span
        aria-hidden
        className="inline-flex items-center justify-center"
        style={{
          width: size, height: size, borderRadius: 999, padding: ring, boxSizing: 'border-box',
          background: `conic-gradient(${lit ? '#2A5039' : '#1B3828'} 0 ${pct}%, #E6DECB ${pct}% 100%)`,
        }}
      >
        <span
          className="inline-flex items-center justify-center"
          style={{
            width: '100%', height: '100%', borderRadius: 999, boxSizing: 'border-box',
            background: lit ? '#FFFFFF' : '#F7F3EA', border: '2px solid #FFFFFF',
          }}
        >
          <CommitteeLogo committee={committee} size={Math.round(size * 0.56)} alt={committeeLabels(committee).big} />
        </span>
      </span>
      {marker ? (
        <span className="absolute" style={{ top: -4, right: -4 }}>
          <GoldMarker order={marker} size={Math.max(18, Math.round(size * 0.38))} />
        </span>
      ) : null}
    </span>
  );
}

export function BigCount({ n, word, size = 26 }: { n: number; word: string; size?: number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5" style={{ fontFamily: OUTFIT }}>
      <span style={{ fontSize: size, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 13, color: NEU.inkSoft }}>{word}</span>
    </span>
  );
}

// ── Fit pills ────────────────────────────────────────────────────────────────
// The engine's reasons are stable upper-case keys ("EXP MATCH +20"); the
// board shows each as one pill in plain words with its points, in one of
// three tones: a choice the person made (gold), a plus (green) or a minus
// (red). The tooltip keeps the full explanation (fitReasons.tsx).

type PillTone = 'choice' | 'plus' | 'minus';

const REASON_WORDS: Record<string, string> = {
  '1ST CHOICE': '1st choice',
  '2ND CHOICE': '2nd choice',
  '3RD CHOICE': '3rd choice',
  'COUNTRY PICK': 'Asked for this country',
  'EXP MATCH': 'Experience fits',
  'EXP TOO LOW': 'Less experience than the room',
  'EXP TOO HIGH': 'More experience than the room',
  'HIGH PRIORITY': 'High priority seat',
  'PRIORITY SEAT': 'Priority seat',
  'COMPLETES PAIR': 'Completes a pair',
  'DELEGATION CONCENTRATION': 'Delegation already here',
  'MEMBER PICK': 'A member asked for it',
  [NEEDS_DELEGATES_REASON]: 'Room needs people',
  [SWAP_REASON]: 'Swapped for a better total',
};

export function reasonPill(reason: string): { label: string; points: number | null; tone: PillTone } {
  const m = reason.match(/^(.*?)\s*([+-]\d+)$/);
  const key = (m ? m[1] : reason).trim();
  const points = m ? Number(m[2]) : null;
  const fallback = key.charAt(0) + key.slice(1).toLowerCase();
  const label = REASON_WORDS[key] ?? fallback;
  const choice = key === '1ST CHOICE' || key === '2ND CHOICE' || key === '3RD CHOICE' || key === 'COUNTRY PICK' || key === SWAP_REASON;
  const tone: PillTone = choice ? 'choice' : points != null && points < 0 ? 'minus' : 'plus';
  return { label, points, tone };
}

const PILL_TONE: Record<PillTone, { bg: string; fg: string; ring: string; mark: string }> = {
  choice: { bg: 'rgba(238,217,138,0.42)', fg: '#6E5210', ring: 'rgba(182,135,31,0.30)', mark: '#B6871F' },
  plus: { bg: 'rgba(61,122,82,0.09)', fg: '#2C5E3E', ring: 'rgba(61,122,82,0.20)', mark: '#3D7A52' },
  minus: { bg: 'rgba(139,32,32,0.07)', fg: '#8B2020', ring: 'rgba(139,32,32,0.18)', mark: '#8B2020' },
};

export function FitPill({ reason, why, more, size = 'md' }: { reason: string; why?: string | null; more?: string[]; size?: 'sm' | 'md' }) {
  const { label, points, tone } = reasonPill(reason);
  const t = PILL_TONE[tone];
  const h = size === 'sm' ? 22 : 24;
  const icon = reason === SWAP_REASON ? ArrowLeftRight : tone === 'choice' ? Star : tone === 'minus' ? Minus : Plus;
  const Icon = icon;
  const pill = (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        height: h, gap: 5, padding: '0 9px 0 7px', borderRadius: 999, boxSizing: 'border-box',
        background: t.bg, color: t.fg, boxShadow: `inset 0 0 0 1px ${t.ring}`,
        fontFamily: OUTFIT, fontSize: size === 'sm' ? 11.5 : 12, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
      }}
    >
      <Icon size={size === 'sm' ? 11 : 12} strokeWidth={2} style={{ color: t.mark, flexShrink: 0 }} aria-hidden />
      {label}
      {points != null && (
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{points > 0 ? `+${points}` : `\u2212${Math.abs(points)}`}</span>
      )}
    </span>
  );
  return why || (more && more.length > 0) ? <FitTip text={why ?? null} lines={more}>{pill}</FitTip> : pill;
}

/** A suggestion's first reasons as pills (the first carries the signals the
 *  engine could not read), then the swap pill. */
export function FitPills({ sug, max = 3, size = 'md' }: { sug: Pick<Suggestion, 'app' | 'committee' | 'slot' | 'reasons' | 'swap'>; max?: number; size?: 'sm' | 'md' }) {
  const ctx = reasonContext(sug.app, sug.committee, sug.slot);
  const gaps = missingSignals(ctx, sug.reasons);
  return (
    <>
      {sug.reasons.slice(0, max).map((r, i) => (
        <FitPill key={r} reason={r} why={explainReason(r, ctx)} more={i === 0 ? gaps : undefined} size={size} />
      ))}
      {sug.swap && (
        <FitPill
          reason={SWAP_REASON}
          size={size}
          why={`Swapped with ${sug.swap.partnerName}: a net gain of +${sug.swap.netGain} across both delegates. Their own best open seat scored ${sug.swap.ownBestScore}.`}
        />
      )}
    </>
  );
}

// ── The seat double pill (the classic board's look) ─────────────────────────
// One country: its flag and name in the outer pill, then one inner chip per
// seat, the holder (avatar and name, or the delegation) or Open.

export function seatHolderName(a: AllocationRow): string {
  if (a.society_id && !a.application_id && !a.user_id) return a.delegation?.name?.trim() || 'Delegation';
  return a.profiles?.display_name?.trim() || a.applications?.invited_name?.trim() || a.profiles?.email?.trim() || 'Assigned';
}

const CHIP_SHADOW = '0 1px 2px rgba(27,56,40,0.10), 0 0 0 1px rgba(27,56,40,0.06)';

export function HolderChip({ alloc }: { alloc: AllocationRow }) {
  const block = !!alloc.society_id && !alloc.application_id && !alloc.user_id;
  const name = seatHolderName(alloc);
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={block ? `${name}, a delegation seat` : name}
      style={{ minHeight: 30, padding: '3px 11px 3px 4px', borderRadius: 999, background: '#FFFFFF', boxShadow: CHIP_SHADOW, maxWidth: '100%', boxSizing: 'border-box' }}
    >
      {block
        ? <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, borderRadius: 999, background: WELL }}><Users size={13} strokeWidth={1.5} style={{ color: NEU.ink }} /></span>
        : <PersonAvatar name={name} url={alloc.profiles?.avatar_url ?? null} size={22} />}
      <span className="[overflow-wrap:anywhere] min-w-0" style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.15, color: NEU.ink }}>{name}</span>
    </span>
  );
}

export function OpenChip({ label = 'Open' }: { label?: string }) {
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        minHeight: 30, padding: '0 12px', borderRadius: 999, boxSizing: 'border-box',
        border: '1.5px dashed rgba(27,56,40,0.28)', color: NEU.forest,
        fontFamily: OUTFIT, fontSize: 12.5, fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

export function SeatDoublePill({ committee, slot, holders, trailing }: {
  committee: CommitteeData;
  slot: SlotRow;
  holders: readonly AllocationRow[];
  /** Drawn inside the pill after the seats (a choice marker, say). */
  trailing?: ReactNode;
}) {
  const bySeat = new Map(holders.map(h => [h.seat, h]));
  const seats = Array.from({ length: Math.max(1, slot.delegation_size) }, (_, i) => i + 1);
  // Holders without a matching seat number still show (older rows).
  const loose = holders.filter(h => !seats.includes(h.seat));
  return (
    <span
      className="flex items-center flex-wrap min-w-0"
      style={{ gap: 4, padding: 3, borderRadius: 22, background: WELL, boxShadow: 'inset 0 0 0 1px rgba(27,56,40,0.05)' }}
    >
      <span className="flex items-center gap-2 min-w-0" style={{ flex: '0 1 200px', padding: '0 8px 0 0' }}>
        <CountryFlag code={slot.country_code} w={30} h={30} alt={slot.country_name} logoUrl={slotLogoUrl(committee, slot)} />
        <CountryName name={slot.country_name} code={slot.country_code} style={{ fontSize: 14, fontWeight: 600, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }} />
      </span>
      {seats.map(n => {
        const h = bySeat.get(n) ?? (n === 1 ? loose[0] : undefined);
        return h ? <HolderChip key={n} alloc={h} /> : <OpenChip key={n} label={slot.delegation_size > 1 ? `Seat ${n} open` : 'Open'} />;
      })}
      {trailing}
    </span>
  );
}

/** A preference's rank: gold for the first three, stone after. */
export function RankNumber({ order, size = 20 }: { order: number; size?: number }) {
  if (order <= 3) return <GoldMarker order={order} size={size} />;
  return (
    <span
      aria-label={`${ordinal(order)} choice`}
      title={`${ordinal(order)} choice`}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 999, background: '#ECE6D8', color: NEU.ink,
        fontFamily: OUTFIT, fontSize: Math.round(size * 0.55), fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}
    >
      {order}
    </span>
  );
}
