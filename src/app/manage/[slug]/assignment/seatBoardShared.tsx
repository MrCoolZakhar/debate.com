'use client';

// Small pieces the seat board (SeatBoard.tsx) and its committee pop-up
// share: names, dates, seat counts, the committee ring
// with its gold choice bubbles, the seat importance mark (the app's dashes),
// the reason badges (one per reason type, its own icon, tone and points, one
// row), the hover cards ("How this scores" on a score, "How smart allocations
// are scored" beside the title), the gold score disc and the seat "double
// pill" of the classic board. Presentation only; nothing here writes.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeftRight, CircleDashed, Flag, GraduationCap, Info, Link2, Minus, Plus, Star, StarHalf, ThumbsUp,
  TrendingDown, TrendingUp, UserPlus, Users, UsersRound, type LucideIcon,
} from 'lucide-react';
import { NEU } from '@/components/neu';
import Portal from '@/components/Portal';
import { getCountryByName } from '@/lib/countries';
import {
  CONCENTRATION_PENALTY, EXPERIENCE_GAP_STEP, EXPERIENCE_MATCH_BONUS, IMPORTANCE_NEED_WEIGHT, MEMBER_PICK_BONUS,
  NEEDS_DELEGATES_REASON, PAIR_BONUS, ROOM_FILL_MAX, SWAP_REASON, groupAllocationsByCountry, roomFill, type ImportanceTier,
} from '@/lib/assignmentFit';
import { FitTip, explainReason, missingSignals } from '@/app/manage/[slug]/assignment/fitReasons';
import { CountryName } from '@/app/manage/[slug]/assignment/displayNames';
import {
  type AcceptedApp, type AllocationRow, type CommitteeData, type SlotRow, type Suggestion,
  CommitteeLogo, CountryFlag, PersonAvatar, ageOf, committeeLabels, reasonContext, slotLogoUrl, OUTFIT,
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

/** The delegation line under a person's name; null for an independent
 *  applicant, who shows nothing there (owner, 21 Oct 2026). */
export function delegationOf(app: Pick<AcceptedApp, 'society_id' | 'societies'>): string | null {
  if (app.society_id == null) return null;
  return app.societies?.name?.trim() || 'Delegation';
}

/** The person's nationality with its ISO code, when we know both. */
export function nationalityOf(app: { profiles?: { nationality?: string | null } | null }): { name: string; code: string } | null {
  const name = app.profiles?.nationality?.trim() || null;
  if (!name) return null;
  const c = getCountryByName(name);
  return c ? { name, code: c.code } : null;
}

// ── A person's identity (owner, 21 Oct 2026) ────────────────────────────────
// Everywhere on the seat board: the avatar with the nationality's ROUND flag
// overlapping its border at the bottom right (its centre on the avatar's
// edge, so it sits half outside: CLAUDE.md §8 rule 19), then "Name, 17" with
// the name bold, and the delegation UNDER the name (nothing for an
// independent applicant).

export function AvatarWithFlag({ name, url, size, nationality, userId, nested }: {
  name: string;
  url: string | null;
  size: number;
  nationality: { name: string; code: string } | null;
  /** Opens the public MUN CV; only where no button or link wraps the avatar. */
  userId?: string | null;
  nested?: boolean;
}) {
  const f = Math.max(14, Math.round(size * 0.4));
  const r = size / 2;
  // The flag's centre on the avatar's edge at 45 degrees, bottom right.
  const off = Math.round(r + r * Math.SQRT1_2 - f / 2);
  return (
    <span className="relative inline-flex flex-shrink-0" style={{ width: size, height: size }}>
      <PersonAvatar name={name} url={url} size={size} userId={userId} nested={nested} />
      {nationality && (
        <span
          className="absolute inline-flex"
          title={nationality.name}
          style={{ left: off, top: off, lineHeight: 0, borderRadius: 999, boxShadow: '0 0 0 2px #FFFFFF, 0 1px 3px rgba(27,56,40,0.28)', pointerEvents: 'none' }}
        >
          <CountryFlag code={nationality.code} w={f} h={f} alt={nationality.name} />
        </span>
      )}
    </span>
  );
}

/** "Name, 17": the name bold, the age after a comma. Never cut, it wraps. */
export function NameAge({ name, app, size = 15, after }: {
  name: string;
  app: Parameters<typeof ageOf>[0];
  size?: number;
  /** Drawn right after the name (a "not registered" chip, say). */
  after?: ReactNode;
}) {
  const age = ageOf(app);
  return (
    <span className="[overflow-wrap:anywhere]" style={{ fontSize: size, fontWeight: 700, color: NEU.ink, lineHeight: 1.15 }}>
      {name}
      {age != null && (
        <span style={{ fontWeight: 500, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }} title={`${age} years old`}>, {age}</span>
      )}
      {after ? <span className="inline-flex align-middle" style={{ marginLeft: 6 }}>{after}</span> : null}
    </span>
  );
}

/** The avatar, then "Name, 17" with the delegation beneath. */
export function PersonIdentity({ app, avatar = 38, nameSize = 15, lineSize = 12.5, userId, after, delegation }: {
  app: AcceptedApp;
  avatar?: number;
  nameSize?: number;
  lineSize?: number;
  userId?: string | null;
  after?: ReactNode;
  /** Replaces the plain delegation line (a link, say). */
  delegation?: ReactNode;
}) {
  const name = personName(app);
  const soc = delegationOf(app);
  const gap = Math.max(8, Math.round(avatar * 0.26));
  return (
    <span className="flex items-center min-w-0" style={{ gap }}>
      <AvatarWithFlag name={name} url={app.profiles?.avatar_url ?? null} size={avatar} nationality={nationalityOf(app)} userId={userId} />
      <span className="flex flex-col min-w-0" style={{ gap: 2 }}>
        <NameAge name={name} app={app} size={nameSize} after={after} />
        {(delegation ?? soc) && (
          <span className="[overflow-wrap:anywhere]" style={{ fontSize: lineSize, color: NEU.inkSoft, lineHeight: 1.2 }}>{delegation ?? soc}</span>
        )}
      </span>
    </span>
  );
}

// ── The soft secondary button (owner, 21 Oct 2026) ──────────────────────────
// "I really don't like the dark green buttons, especially when there are
// multiple": at most ONE solid forest button per view; every repeated row
// action (Assign, Give, Cancel) is this white pill with forest text and a thin
// border, a tint on hover and a press scale.
export const SOFT_BTN_CLASS = [
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1B3828]/25',
  'inline-flex items-center justify-center gap-1.5 flex-shrink-0 whitespace-nowrap rounded-full',
  'bg-white text-[#1B3828] font-semibold border border-[#1B3828]/20',
  'shadow-[0_1px_2px_rgba(27,56,40,0.07)]',
  'transition-[background-color,border-color,box-shadow,transform] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)]',
  'enabled:hover:bg-[#F4F0E6] enabled:hover:border-[#1B3828]/45 enabled:hover:shadow-[0_2px_8px_rgba(27,56,40,0.12)]',
  'enabled:active:scale-[0.96] disabled:opacity-55 disabled:cursor-default',
].join(' ');

export function SoftButton({ children, onClick, disabled, size = 'md', title, ariaLabel, style }: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  title?: string;
  ariaLabel?: string;
  style?: CSSProperties;
}) {
  const sm = size === 'sm';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={ariaLabel}
      className={SOFT_BTN_CLASS}
      style={{ height: sm ? 30 : 34, padding: sm ? '0 13px' : '0 16px', fontFamily: OUTFIT, fontSize: sm ? 12.5 : 13, cursor: disabled ? 'default' : 'pointer', ...style }}
    >
      {children}
    </button>
  );
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

/** Every one of the person's first `max` choices, by committee: committee id →
 *  the choice numbers it holds (a committee asked for twice gets two). */
export function prefOrdersByCommittee(app: Pick<AcceptedApp, 'application_preferences'> | null | undefined, max = 8): Map<string, number[]> {
  const out = new Map<string, number[]>();
  if (!app) return out;
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order).slice(0, max);
  prefs.forEach((p, i) => {
    const arr = out.get(p.conference_committee_id);
    if (arr) arr.push(i + 1); else out.set(p.conference_committee_id, [i + 1]);
  });
  return out;
}

export function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

/** "2nd choice", "2nd and 3rd choices", "1st, 2nd and 3rd choices". */
export function choicesPhrase(orders: readonly number[]): string {
  const words = orders.map(ordinal);
  if (words.length <= 1) return `${words[0] ?? ''} choice`;
  return `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]} choices`;
}

/** The gold choice number on a committee ring or a country row. */
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

/** A committee as a fill ring with its logo inside. With `markers` (the open
 *  person's choice numbers in this committee) the gold bubbles sit on the
 *  ring's edge, evenly spaced around it; `halo` reserves room for them so a
 *  bubble never reaches the label under the ring. */
export function CommitteeRing({ committee, size = 52, marker, markers, lit, halo = false }: {
  committee: CommitteeData;
  size?: number;
  /** One choice number (older callers). */
  marker?: number;
  /** Every choice number this committee holds, up to 8. */
  markers?: readonly number[];
  /** A drag is over it. */
  lit?: boolean;
  /** Reserve the bubbles' room around the ring. */
  halo?: boolean;
}) {
  const { total, filled } = seatCounts(committee);
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  const ring = Math.max(3, Math.round(size * 0.07));
  const list = (markers && markers.length > 0 ? markers : marker ? [marker] : []).slice(0, 8);
  const bubble = list.length > 4 ? Math.max(14, Math.round(size * 0.3)) : Math.max(16, Math.round(size * 0.34));
  const pad = halo ? Math.ceil(bubble / 2) : 0;
  const outer = size + pad * 2;
  const r = size / 2;
  const start = list.length === 1 ? -45 : -90;
  return (
    <span className="relative inline-flex flex-shrink-0" style={{ width: outer, height: outer }}>
      <span
        aria-hidden
        className="absolute inline-flex items-center justify-center"
        style={{
          left: pad, top: pad, width: size, height: size, borderRadius: 999, padding: ring, boxSizing: 'border-box',
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
      {list.map((n, i) => {
        const a = ((start + (360 / list.length) * i) * Math.PI) / 180;
        const cx = pad + r + Math.cos(a) * r;
        const cy = pad + r + Math.sin(a) * r;
        return (
          <span key={`${n}-${i}`} className="absolute" style={{ left: cx - bubble / 2, top: cy - bubble / 2, lineHeight: 0 }}>
            <GoldMarker order={n} size={bubble} />
          </span>
        );
      })}
    </span>
  );
}

/** Under a committee ring: seats given of all seats, "9/15" (owner, 22 Oct
 *  2026), a double country counting as two seats. */
export function RingTally({ committee }: { committee: CommitteeData }) {
  const { total, filled } = seatCounts(committee);
  return (
    <span title={`${filled} of ${total} seats given`} style={{ fontSize: 12, color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
      <span style={{ fontWeight: 700, color: NEU.ink }}>{filled}</span>/{total}
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

// ── Seat importance ──────────────────────────────────────────────────────────
// The app's one importance icon (ConferenceRosterPicker, the classic board's
// TierBadge): vertical dashes of one height whose count AND colour say the
// tier, 1 grey standard, 2 green low, 3 yellow medium, 4 red high. The seat
// board shows it exactly as the classic board does (owner, 21 Oct 2026: back
// to how it looked), the word only in the hover title.
const TIER: Record<ImportanceTier, { word: string; color: string; dashes: number }> = {
  high: { word: 'High', color: '#8B2020', dashes: 4 },
  medium: { word: 'Medium', color: '#D4A72C', dashes: 3 },
  low: { word: 'Low', color: '#3D7A52', dashes: 2 },
  standard: { word: 'Standard', color: '#9A8A78', dashes: 1 },
};

/** The bare dashes, for a badge or a chip. */
export function ImportanceDashes({ tier, barHeight = 11, barWidth = 2, gap = 2 }: { tier: ImportanceTier; barHeight?: number; barWidth?: number; gap?: number }) {
  const t = TIER[tier] ?? TIER.standard;
  return (
    <span className="inline-flex items-end flex-shrink-0" style={{ gap }} aria-hidden>
      {Array.from({ length: t.dashes }).map((_, i) => (
        <span key={i} style={{ width: barWidth, height: barHeight, borderRadius: barWidth / 2, backgroundColor: t.color, display: 'inline-block' }} />
      ))}
    </span>
  );
}

/** The dashes sized to sit inside a disc of `size`: the four red dashes of a
 *  high seat used to touch the disc's ring (owner, 21 Oct 2026). Every tier's
 *  dashes fill at most 56% of the disc's width, at the classic proportions. */
export function dashesForDisc(tier: ImportanceTier, size: number): { barHeight: number; barWidth: number; gap: number } {
  const n = (TIER[tier] ?? TIER.standard).dashes;
  const inner = size * 0.56;
  const w = Math.min(size * 0.1, inner / (n + 0.8 * (n - 1)));
  return { barHeight: Math.round(size * 0.46), barWidth: Math.round(w * 4) / 4, gap: Math.round(w * 0.8 * 4) / 4 };
}

/** A seat's importance as the classic board draws it: the dashes on a small
 *  raised chip. `showWord` is kept for older callers and draws nothing more. */
export function ImportanceMark({ tier }: { tier: ImportanceTier; showWord?: boolean }) {
  const t = TIER[tier] ?? TIER.standard;
  return (
    <span
      role="img"
      aria-label={`Importance: ${t.word}`}
      title={`Country importance: ${t.word}`}
      className="inline-flex items-center flex-shrink-0"
      style={{ padding: '4px 8px', borderRadius: 8, backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
    >
      <ImportanceDashes tier={tier} />
    </span>
  );
}

// ── Reason badges ────────────────────────────────────────────────────────────
// The engine's reasons are stable upper-case keys ("EXP MATCH +20",
// "1ST CHOICE"). Each reason TYPE is its own badge: its own icon on a solid
// disc in its tone, a short label and the points it adds (the same numbers
// src/lib/assignmentFit.ts scores with). The 1st choice is the strongest, a
// gold pill; seat importance carries the app's importance dashes. Labels are
// short so up to four sit on one row (owner, 21 Oct 2026); the tooltip keeps
// the full explanation.

interface BadgeSpec {
  label: string;
  /** The icon; omitted when `tier` draws the importance dashes instead. */
  Icon?: LucideIcon;
  /** Text and icon colour; the tint, ring and drop are mixed from it. */
  tone: string;
  /** Fill the icon (the stars). */
  filled?: boolean;
  /** The strongest treatment (the 1st choice). */
  strong?: boolean;
  /** Seat importance: drawn with the importance dashes. */
  tier?: ImportanceTier;
  /** The points this reason adds when its key carries none. */
  points?: number;
}

const TONE = {
  gold: '#8A6614',
  silver: '#59616B',
  bronze: '#8E5326',
  green: '#2C6B43',
  teal: '#1F6668',
  blue: '#335E86',
  red: '#8B2020',
  amber: '#9A5A12',
  ink: '#3D352C',
};

// Points for reasons whose key carries none: the engine's own constants where
// it exports them, and scorePrefAndExp's preference values (50 / 30 / 15, the
// exact country +25), mirrored here (SCORE_RULES below lists them all).
const BADGES: Record<string, BadgeSpec> = {
  '1ST CHOICE': { label: '1st choice', Icon: Star, tone: '#1B3828', filled: true, strong: true, points: 50 },
  '2ND CHOICE': { label: '2nd choice', Icon: Star, tone: TONE.silver, filled: true, points: 30 },
  '3RD CHOICE': { label: '3rd choice', Icon: StarHalf, tone: TONE.bronze, points: 15 },
  'COUNTRY PICK': { label: 'Country', Icon: Flag, tone: TONE.gold, points: 25 },
  'EXP MATCH': { label: 'Level fits', Icon: GraduationCap, tone: TONE.green },
  'EXP TOO LOW': { label: 'Low experience', Icon: TrendingDown, tone: TONE.red },
  'EXP TOO HIGH': { label: 'High experience', Icon: TrendingUp, tone: TONE.amber },
  'HIGH PRIORITY': { label: 'High seat', tone: TIER.high.color, tier: 'high', points: IMPORTANCE_NEED_WEIGHT.high },
  'PRIORITY SEAT': { label: 'Medium seat', tone: '#8A6A12', tier: 'medium', points: IMPORTANCE_NEED_WEIGHT.medium },
  'COMPLETES PAIR': { label: 'Pair', Icon: Link2, tone: TONE.teal, points: PAIR_BONUS },
  'DELEGATION CONCENTRATION': { label: 'Delegation here', Icon: UsersRound, tone: TONE.red, points: -CONCENTRATION_PENALTY },
  'MEMBER PICK': { label: 'Member pick', Icon: ThumbsUp, tone: TONE.green, points: MEMBER_PICK_BONUS },
  [NEEDS_DELEGATES_REASON]: { label: 'Needs people', Icon: UserPlus, tone: TONE.blue },
  [SWAP_REASON]: { label: 'Swapped', Icon: ArrowLeftRight, tone: TONE.ink },
};

/** How a badge looks, without its points. */
type BadgeLook = Omit<BadgeSpec, 'points'>;

const LOW_SEAT: BadgeSpec = { label: 'Low seat', tone: TIER.low.color, tier: 'low', points: IMPORTANCE_NEED_WEIGHT.low };
const ROOM_FILL: BadgeSpec = { label: 'Room fill', Icon: CircleDashed, tone: TONE.ink };

/** One reason as a badge spec plus its points (null when it adds none). */
export function reasonBadge(reason: string): BadgeLook & { points: number | null } {
  const m = reason.match(/^(.*?)\s*([+-]\d+)$/);
  const key = (m ? m[1] : reason).trim();
  const spec = BADGES[key];
  const fromKey = m ? Number(m[2]) : null;
  if (spec) return { ...spec, points: fromKey ?? spec.points ?? null };
  const label = key.charAt(0) + key.slice(1).toLowerCase();
  const neg = fromKey != null && fromKey < 0;
  return { label, Icon: neg ? Minus : Plus, tone: neg ? TONE.red : TONE.green, points: fromKey };
}

/** Kept for older callers: label, points and a three-way tone. */
export function reasonPill(reason: string): { label: string; points: number | null; tone: 'choice' | 'plus' | 'minus' } {
  const b = reasonBadge(reason);
  const key = reason.replace(/\s*[+-]\d+$/, '').trim();
  const choice = key === '1ST CHOICE' || key === '2ND CHOICE' || key === '3RD CHOICE' || key === 'COUNTRY PICK' || key === SWAP_REASON;
  return { label: b.label, points: b.points, tone: choice ? 'choice' : b.points != null && b.points < 0 ? 'minus' : 'plus' };
}

function fmtPoints(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

/** The reason's icon on a solid disc in its tone (badges and the score
 *  breakdown); seat importance draws its dashes on a white disc instead. */
export function BadgeIcon({ spec, size = 18 }: { spec: Pick<BadgeSpec, 'Icon' | 'tone' | 'filled' | 'strong' | 'tier'>; size?: number }) {
  const { Icon, tone, filled, strong, tier } = spec;
  if (tier) {
    return (
      <span
        aria-hidden
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{ width: size, height: size, borderRadius: 999, background: '#FFFFFF', boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 30%, transparent)` }}
      >
        <ImportanceDashes tier={tier} {...dashesForDisc(tier, size)} />
      </span>
    );
  }
  if (!Icon) return null;
  // The 1st choice sits on gold: its star is forest on a white disc (never a
  // gold icon on a forest tile).
  const bg = strong ? '#FFFFFF' : tone;
  const fg = strong ? '#1B3828' : '#FFFFFF';
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 999, background: bg,
        boxShadow: strong ? '0 1px 2px rgba(138,102,20,0.45)' : `inset 0 1px 0 rgba(255,255,255,0.25), 0 1px 2px color-mix(in srgb, ${tone} 40%, transparent)`,
      }}
    >
      <Icon size={Math.round(size * 0.62)} strokeWidth={2} style={{ color: fg }} fill={filled ? fg : 'none'} />
    </span>
  );
}

function BadgeBody({ spec, points, size, showPoints }: { spec: BadgeLook; points: number | null; size: 'sm' | 'md'; showPoints: boolean }) {
  const h = size === 'sm' ? 21 : 22;
  const strong = !!spec.strong;
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        height: h, gap: 4, padding: '0 7px 0 2.5px', borderRadius: 999, boxSizing: 'border-box',
        background: strong ? 'linear-gradient(180deg, #F7E6A6, #E8C863)' : `color-mix(in srgb, ${spec.tone} 13%, #FFFFFF)`,
        color: strong ? '#1B3828' : spec.tone,
        boxShadow: strong
          ? 'inset 0 0 0 1px rgba(160,118,22,0.55), inset 0 1px 0 rgba(255,255,255,0.65), 0 2px 7px -2px rgba(182,135,31,0.7)'
          : `inset 0 0 0 1px color-mix(in srgb, ${spec.tone} 32%, transparent), inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 5px -2px color-mix(in srgb, ${spec.tone} 45%, transparent)`,
        fontFamily: OUTFIT, fontSize: size === 'sm' ? 11 : 11.5, fontWeight: strong ? 700 : 600, lineHeight: 1, whiteSpace: 'nowrap',
      }}
    >
      <BadgeIcon spec={spec} size={h - 5} />
      {spec.label}
      {showPoints && points != null && points !== 0 && (
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtPoints(points)}</span>
      )}
    </span>
  );
}

export function FitPill({ reason, why, more, size = 'md', showPoints = true }: { reason: string; why?: string | null; more?: string[]; size?: 'sm' | 'md'; showPoints?: boolean }) {
  const b = reasonBadge(reason);
  const badge = <BadgeBody spec={b} points={b.points} size={size} showPoints={showPoints} />;
  return why || (more && more.length > 0) ? <FitTip text={why ?? null} lines={more}>{badge}</FitTip> : badge;
}

type SugLike = Pick<Suggestion, 'app' | 'committee' | 'slot' | 'reasons' | 'swap' | 'score'>;

/** A suggestion's first reasons as badges on ONE row (the first carries the
 *  signals the engine could not read), the swap badge counted inside `max`.
 *  When the row is too narrow the points step out first (they stay in the
 *  score's hover breakdown), then the last badges; the row never wraps. */
export function FitPills({ sug, max = 4, size = 'md', style }: {
  sug: Pick<Suggestion, 'app' | 'committee' | 'slot' | 'reasons' | 'swap'>;
  max?: number;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}) {
  const ctx = reasonContext(sug.app, sug.committee, sug.slot);
  const gaps = missingSignals(ctx, sug.reasons);
  const items: { key: string; reason: string; why: string | null; more?: string[] }[] = sug.reasons.map((r, i) => ({
    key: r, reason: r, why: explainReason(r, ctx), more: i === 0 ? gaps : undefined,
  }));
  if (sug.swap) {
    items.push({
      key: SWAP_REASON, reason: SWAP_REASON,
      why: `Swapped with ${sug.swap.partnerName}: a net gain of +${sug.swap.netGain} across both delegates. Their own best open seat scored ${sug.swap.ownBestScore}.`,
    });
  }
  // A swap badge keeps its place inside the cap.
  const capped = items.length > max && sug.swap ? [...items.slice(0, max - 1), items[items.length - 1]] : items.slice(0, max);
  const sig = capped.map(i => i.key).join('|');
  const ref = useRef<HTMLSpanElement | null>(null);
  // 0 everything, 1 no points, 2+ one badge fewer each step.
  const [fit, setFit] = useState<{ sig: string; step: number }>({ sig, step: 0 });
  const step = fit.sig === sig ? fit.step : 0;
  const count = capped.length;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // A DOM measurement before paint: one step at a time, at most `count` steps.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the row's width is only known once laid out; stepping here keeps the overflow from ever painting
    if (el.scrollWidth > el.clientWidth + 1 && step < count) setFit({ sig, step: step + 1 });
  }, [step, count, sig]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let w = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === w) return;
      w = el.clientWidth;
      setFit({ sig, step: 0 });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [sig]);
  const shown = step >= 2 ? capped.slice(0, Math.max(1, capped.length - (step - 1))) : capped;
  if (capped.length === 0) return null;
  return (
    <span ref={ref} className="flex items-center flex-nowrap min-w-0" style={{ gap: 4, overflow: 'hidden', padding: '2px 1px 4px', margin: '-2px -1px -4px', ...style }}>
      {shown.map(i => (
        <FitPill key={i.key} reason={i.reason} why={i.why} more={i.more} size={size} showPoints={step === 0} />
      ))}
    </span>
  );
}

// ── Hover cards ──────────────────────────────────────────────────────────────
// A white card on hover (and focus) of its trigger, through Portal at fixed
// coordinates, flipped above near the bottom edge and kept inside the
// viewport; a short close delay lets the pointer move onto it.
export function HoverCard({ children, card, width = 300, label, align = 'end' }: {
  children: ReactNode;
  card: ReactNode;
  width?: number;
  /** The trigger's accessible name. */
  label: string;
  /** Which edge of the trigger the card lines up with. */
  align?: 'start' | 'end' | 'center';
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const hideT = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const h = cardRef.current?.offsetHeight ?? 160;
    const w = Math.min(width, vw - 16);
    let left = align === 'start' ? r.left : align === 'center' ? r.left + r.width / 2 - w / 2 : r.right - w;
    left = Math.max(8, Math.min(left, vw - 8 - w));
    const below = r.bottom + 8;
    const top = below + h > vh - 8 && r.top - 8 - h > 8 ? r.top - 8 - h : Math.max(8, Math.min(below, vh - 8 - h));
    setPos({ top, left });
  }, [width, align]);

  const show = () => {
    if (hideT.current) { window.clearTimeout(hideT.current); hideT.current = null; }
    setOpen(true);
  };
  const hide = () => {
    if (hideT.current) window.clearTimeout(hideT.current);
    hideT.current = window.setTimeout(() => setOpen(false), 140);
  };

  useEffect(() => {
    if (!open) return;
    // Placed on the next frame, once the card has a measured height (it draws hidden until then).
    const raf = requestAnimationFrame(place);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, place]);
  useEffect(() => () => { if (hideT.current) window.clearTimeout(hideT.current); }, []);

  return (
    <span
      ref={ref}
      tabIndex={0}
      aria-label={label}
      className="inline-flex flex-shrink-0 focus:outline-none focus-visible:ring-2"
      style={{ cursor: 'help', borderRadius: 999 }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && (
        <Portal>
          <div
            ref={cardRef}
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{
              position: 'fixed', top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: `min(${width}px, calc(100vw - 16px))`, zIndex: 3000,
              padding: '12px 14px', borderRadius: 16, background: '#FFFFFF', color: NEU.ink,
              boxShadow: '0 18px 44px rgba(27,56,40,0.20), 0 2px 8px rgba(27,56,40,0.08), 0 0 0 1px rgba(27,56,40,0.06)',
              fontFamily: OUTFIT, textAlign: 'left', cursor: 'default', textTransform: 'none', letterSpacing: 0,
              visibility: pos ? 'visible' : 'hidden',
            }}
          >
            {card}
          </div>
        </Portal>
      )}
    </span>
  );
}

// ── How a suggestion scores ──────────────────────────────────────────────────
// Every part of the fit score with its points. The reasons carry the
// preference, country, experience, importance and delegation parts; a low
// importance seat (+4) adds points without a reason; what is left is the room
// fill (up to +ROOM_FILL_MAX, from the share of the committee's seats filled:
// roomFill in the engine), printed with how full the room is, so the lines
// always add up to the score the engine ranked by.

export interface ScorePart { key: string; spec: BadgeLook; points: number; note?: string }

export function scoreParts(sug: SugLike): ScorePart[] {
  const parts: ScorePart[] = [];
  for (const r of sug.reasons) {
    const b = reasonBadge(r);
    if (b.points == null || b.points === 0) continue;
    parts.push({ key: r, spec: b, points: b.points });
  }
  if (sug.slot.importance === 'low' && IMPORTANCE_NEED_WEIGHT.low) {
    parts.push({ key: 'LOW SEAT', spec: LOW_SEAT, points: IMPORTANCE_NEED_WEIGHT.low });
  }
  // The remainder IS the room fill (the engine adds nothing else without a
  // reason), so the total always adds up; the room's own share names it.
  const rest = sug.score - parts.reduce((n, p) => n + p.points, 0);
  if (rest !== 0) parts.push({ key: 'ROOM FILL', spec: ROOM_FILL, points: rest, note: `${roomFill(sug.committee).pctFull}% full` });
  return parts;
}

/** The "How this scores" list: one line per part, then the bold total. */
export function ScoreBreakdown({ sug }: { sug: SugLike }) {
  const parts = scoreParts(sug);
  return (
    <div className="flex flex-col" style={{ gap: 4, fontFamily: OUTFIT }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, color: NEU.ink, marginBottom: 2 }}>How this scores</span>
      {parts.length === 0 && <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>No part of the score applies to this seat</span>}
      {parts.map(p => (
        <div key={p.key} className="flex items-center gap-2" style={{ minHeight: 24 }}>
          <BadgeIcon spec={p.spec} size={20} />
          <span className="flex-1 min-w-0" style={{ fontSize: 13, color: NEU.ink, lineHeight: 1.2 }}>
            {p.spec.label}
            {p.note && <span style={{ color: NEU.inkSoft, fontVariantNumeric: 'tabular-nums' }}>, {p.note}</span>}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: p.points < 0 ? TONE.red : NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtPoints(p.points)}</span>
        </div>
      ))}
      <div className="flex items-center gap-2" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 6, marginTop: 2 }}>
        <span className="flex-1" style={{ fontSize: 13.5, fontWeight: 700, color: NEU.ink }}>Total</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums' }}>{sug.score}</span>
      </div>
      {sug.swap && (
        <span style={{ fontSize: 12, color: NEU.inkSoft, lineHeight: 1.35 }}>
          Swapped with {sug.swap.partnerName}: {fmtPoints(sug.swap.netGain)} across both. Their own best open seat scored {sug.swap.ownBestScore}
        </span>
      )}
    </div>
  );
}

/** The score disc with its breakdown on hover only. */
export function ScoreHover({ sug, size = 34, title }: { sug: SugLike; size?: number; title?: string }) {
  return (
    <HoverCard label={title ?? `Fit score ${sug.score}. Hover for how it scores`} card={<ScoreBreakdown sug={sug} />} width={280}>
      <ScoreDisc score={sug.score} size={size} title="" />
    </HoverCard>
  );
}

// ── How smart allocations are scored, in general ─────────────────────────────
// The general rules beside the Smart Allocations title, the classic board's
// explainer brought back (owner, 21 Oct 2026): every factor and its weight, the
// engine's own constants where src/lib/assignmentFit.ts exports them.
const SCORE_RULES: { spec: BadgeLook; title: string; points: string; line: string }[] = [
  { spec: BADGES['1ST CHOICE'], title: 'Committee choice', points: '+50 / +30 / +15', line: 'Their 1st, 2nd or 3rd choice committee' },
  { spec: BADGES['COUNTRY PICK'], title: 'Exact country', points: '+25', line: 'The seat is the country they asked for' },
  { spec: BADGES['EXP MATCH'], title: 'Experience fit', points: `+${EXPERIENCE_MATCH_BONUS} / 0 / −${EXPERIENCE_GAP_STEP} per level`, line: 'Their level against the committee difficulty, either way round' },
  { spec: BADGES['HIGH PRIORITY'], title: 'Seat importance', points: `+${IMPORTANCE_NEED_WEIGHT.high} / +${IMPORTANCE_NEED_WEIGHT.medium} / +${IMPORTANCE_NEED_WEIGHT.low}`, line: 'High, medium and low importance seats fill first' },
  { spec: ROOM_FILL, title: 'Room fill', points: `up to +${ROOM_FILL_MAX}`, line: `Emptier committees score higher: ${ROOM_FILL_MAX} x the share of seats still open (a room 25% full adds ${Math.round(ROOM_FILL_MAX * 0.75)})` },
  { spec: BADGES['COMPLETES PAIR'], title: 'Completes a pair', points: `+${PAIR_BONUS}`, line: 'Their delegation holds the other seat of a double' },
  { spec: BADGES['DELEGATION CONCENTRATION'], title: 'Delegation already here', points: `−${CONCENTRATION_PENALTY}`, line: 'Spreads a delegation across the rooms' },
];

export function ScoringHint() {
  return (
    <HoverCard
      label="How smart allocations are scored"
      align="center"
      width={340}
      card={(
        <div className="flex flex-col" style={{ gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: NEU.ink }}>How smart allocations are scored</span>
          {SCORE_RULES.map(r => (
            <div key={r.title} className="flex items-start gap-2.5">
              <span style={{ paddingTop: 1 }}><BadgeIcon spec={r.spec} size={20} /></span>
              <span className="flex flex-col flex-1 min-w-0" style={{ lineHeight: 1.25 }}>
                <span className="flex items-baseline justify-between gap-2">
                  <span style={{ fontSize: 13, fontWeight: 600, color: NEU.ink }}>{r.title}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.points}</span>
                </span>
                <span style={{ fontSize: 12, color: NEU.inkSoft }}>{r.line}</span>
              </span>
            </div>
          ))}
          <span style={{ fontSize: 12, color: NEU.inkSoft, lineHeight: 1.4, borderTop: `1px solid ${HAIRLINE}`, paddingTop: 8 }}>
            Two people may swap suggested seats when that raises their combined score. Hover a card&apos;s score for its own parts
          </span>
        </div>
      )}
    >
      <span className="inline-flex items-center justify-center" style={{ width: 24, height: 24, color: NEU.inkSoft }}>
        <Info size={17} strokeWidth={1.5} />
      </span>
    </HoverCard>
  );
}

/** The gold score disc of a smart allocation. */
export function ScoreDisc({ score, size = 48, title }: { score: number; size?: number; title?: string }) {
  return (
    <span
      title={title ?? 'Fit score'}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 999,
        background: 'linear-gradient(160deg, #F7EAB8, #EED98A)',
        boxShadow: 'inset 0 0 0 1px rgba(182,135,31,0.35), inset 0 1px 0 rgba(255,255,255,0.7), 0 4px 12px -4px rgba(182,135,31,0.55)',
        color: '#1B3828', fontFamily: OUTFIT, fontSize: Math.round(size * 0.4), fontWeight: 700,
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
      }}
    >
      {score}
    </span>
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

/** Who holds a seat in the committee pop-ups: the avatar and the bold name,
 *  the delegation on a smaller second line (nothing for an independent
 *  applicant). A delegation seat shows the delegation itself, "Delegation
 *  seat" only on hover. Calm on purpose (owner, 21 Oct 2026: "far too much
 *  information at once"). */
export function HolderLine({ alloc }: { alloc: AllocationRow }) {
  const block = !!alloc.society_id && !alloc.application_id && !alloc.user_id;
  const name = seatHolderName(alloc);
  const soc = block ? null : alloc.applications?.societies?.name?.trim() || alloc.delegation?.name?.trim() || null;
  return (
    <span className="inline-flex items-center gap-2 min-w-0" title={block ? `${name}, a delegation seat` : soc ? `${name}, ${soc}` : name}>
      {block
        ? <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: 999, background: WELL }}><Users size={15} strokeWidth={1.5} style={{ color: NEU.ink }} /></span>
        : <PersonAvatar name={name} url={alloc.profiles?.avatar_url ?? null} size={28} />}
      <span className="flex flex-col min-w-0" style={{ lineHeight: 1.15 }}>
        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13.5, fontWeight: 700, color: NEU.ink }}>{name}</span>
        {soc && <span className="[overflow-wrap:anywhere]" style={{ fontSize: 11.5, color: NEU.inkSoft }}>{soc}</span>}
      </span>
    </span>
  );
}

/** A committee pop-up row's country (owner, 21 Oct 2026: calmer, fewer rows
 *  per screen is fine): a bigger round flag, the country and the seat's
 *  importance, plus an optional gold choice marker. */
export function SeatCountry({ committee, slot, marker }: { committee: CommitteeData; slot: SlotRow; marker?: ReactNode }) {
  return (
    <span className="flex items-center min-w-0" style={{ gap: 10, flex: '1 1 200px' }}>
      <CountryFlag code={slot.country_code} w={36} h={36} alt={slot.country_name} logoUrl={slotLogoUrl(committee, slot)} />
      <CountryName name={slot.country_name} code={slot.country_code} style={{ fontSize: 15, fontWeight: 600, color: NEU.ink, whiteSpace: 'normal', overflowWrap: 'anywhere', lineHeight: 1.15 }} />
      <ImportanceMark tier={slot.importance} />
      {marker}
    </span>
  );
}

export function OpenChip({ label = 'Open', compact = false }: { label?: string; compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        minHeight: compact ? 22 : 30, padding: compact ? '0 9px' : '0 12px', borderRadius: 999, boxSizing: 'border-box',
        border: '1.5px dashed rgba(27,56,40,0.28)', color: NEU.forest,
        fontFamily: OUTFIT, fontSize: compact ? 11.5 : 12.5, fontWeight: 600,
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

// ── A committee pop-up's header ring ─────────────────────────────────────────
// The committee ring on a white disc, half outside the pop-up card's top-left
// edge (CLAUDE.md §8, the signature detail). The card sets `position:
// relative` and `marginTop: POPUP_RING_RISE`; the header pads its left by
// POPUP_RING_INSET. No pop-up uses it since Round 14 (both committee pop-ups
// are the classic one now); it was drawn at the slim width POPUP_WIDTH (owner, 21 Oct 2026:
// "too much empty space, like it was before").
export const POPUP_RING = 60;
export const POPUP_RING_RISE = 28;
export const POPUP_RING_INSET = 18 + POPUP_RING + 8 + 12;
export const POPUP_WIDTH = 'min(94vw, 600px)';

export function PopupRingBadge({ committee }: { committee: CommitteeData }) {
  return (
    <span
      aria-hidden
      className="absolute inline-flex items-center justify-center"
      style={{
        top: -POPUP_RING_RISE, left: 18, width: POPUP_RING + 8, height: POPUP_RING + 8, borderRadius: 999, background: '#FFFFFF',
        boxShadow: '0 8px 22px -8px rgba(27,56,40,0.35), 0 0 0 1px rgba(27,56,40,0.05)',
      }}
    >
      <CommitteeRing committee={committee} size={POPUP_RING} />
    </span>
  );
}
