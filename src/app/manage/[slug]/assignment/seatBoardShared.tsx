'use client';

// Small pieces the seat board (SeatBoard.tsx) and its committee pop-up
// (SeatBoardPopup.tsx) share: names, dates, seat counts, the committee ring
// with its gold choice bubbles, the seat importance mark, the reason badges
// (one per reason type, its own icon, tone and points), the "How this scores"
// breakdown, the gold score disc and the seat "double pill" of the classic
// board. Presentation only; nothing here writes.

import type { ReactNode } from 'react';
import {
  ArrowLeftRight, CircleDashed, Flag, Gem, GraduationCap, Link2, Minus, Plus, Star, StarHalf, ThumbsUp,
  TrendingDown, TrendingUp, UserPlus, Users, UsersRound, type LucideIcon,
} from 'lucide-react';
import { NEU } from '@/components/neu';
import {
  CONCENTRATION_PENALTY, IMPORTANCE_NEED_WEIGHT, MEMBER_PICK_BONUS, NEEDS_DELEGATES_REASON, PAIR_BONUS, SWAP_REASON,
  groupAllocationsByCountry, type ImportanceTier,
} from '@/lib/assignmentFit';
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

export function BigCount({ n, word, size = 26 }: { n: number; word: string; size?: number }) {
  return (
    <span className="inline-flex items-baseline gap-1.5" style={{ fontFamily: OUTFIT }}>
      <span style={{ fontSize: size, fontWeight: 700, color: NEU.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{n}</span>
      <span style={{ fontSize: 13, color: NEU.inkSoft }}>{word}</span>
    </span>
  );
}

// ── Seat importance ──────────────────────────────────────────────────────────
// The committee-setup indicator (ConferenceRosterPicker): bars whose count and
// colour say the tier, 1 grey standard, 2 green low, 3 yellow medium, 4 red
// high, with the word beside it for every tier but standard.
const TIER: Record<ImportanceTier, { word: string; color: string; bars: number }> = {
  high: { word: 'High', color: '#8B2020', bars: 4 },
  medium: { word: 'Medium', color: '#B6871F', bars: 3 },
  low: { word: 'Low', color: '#3D7A52', bars: 2 },
  standard: { word: 'Standard', color: '#9A8A78', bars: 1 },
};

export function ImportanceMark({ tier, showWord = true }: { tier: ImportanceTier; showWord?: boolean }) {
  const t = TIER[tier] ?? TIER.standard;
  return (
    <span
      role="img"
      aria-label={`${t.word} importance`}
      title={`${t.word} importance`}
      className="inline-flex items-center flex-shrink-0"
      style={{ gap: 5, fontFamily: OUTFIT }}
    >
      <span className="inline-flex items-end" style={{ gap: 2 }} aria-hidden>
        {Array.from({ length: t.bars }).map((_, i) => (
          <span key={i} style={{ width: 2.5, height: 6 + i * 2, borderRadius: 1, backgroundColor: t.color, display: 'inline-block' }} />
        ))}
      </span>
      {showWord && tier !== 'standard' && (
        <span style={{ fontSize: 11.5, fontWeight: 600, color: t.color, lineHeight: 1 }}>{t.word}</span>
      )}
    </span>
  );
}

// ── Reason badges ────────────────────────────────────────────────────────────
// The engine's reasons are stable upper-case keys ("EXP MATCH +20",
// "1ST CHOICE"). Each reason TYPE is its own badge: its own fine-line icon on
// a small tinted disc, its own tone, one size, and the points it adds (the
// same numbers src/lib/assignmentFit.ts scores with). Raised in its own hue
// like the classic board's chips. The tooltip keeps the full explanation.

interface BadgeSpec {
  label: string;
  Icon: LucideIcon;
  /** Text and icon colour; the tint, ring and drop are mixed from it. */
  tone: string;
  /** Fill the icon (the 1st choice star). */
  filled?: boolean;
  /** The points this reason adds when its key carries none. */
  points?: number;
}

const TONE = {
  gold: '#8A6614',
  silver: '#5F666E',
  bronze: '#8E5326',
  green: '#2C6B43',
  teal: '#22686A',
  blue: '#335E86',
  plum: '#6B3F78',
  red: '#8B2020',
  amber: '#9A5A12',
  ink: '#3D352C',
};

// Points for reasons whose key carries none: the engine's own constants where
// it exports them, and scorePrefAndExp's preference values (50 / 30 / 15, the
// exact country +25), mirrored here.
const BADGES: Record<string, BadgeSpec> = {
  '1ST CHOICE': { label: '1st choice', Icon: Star, tone: TONE.gold, filled: true, points: 50 },
  '2ND CHOICE': { label: '2nd choice', Icon: Star, tone: TONE.silver, points: 30 },
  '3RD CHOICE': { label: '3rd choice', Icon: StarHalf, tone: TONE.bronze, points: 15 },
  'COUNTRY PICK': { label: 'Asked for this country', Icon: Flag, tone: TONE.gold, points: 25 },
  'EXP MATCH': { label: 'Experience fits', Icon: GraduationCap, tone: TONE.green },
  'EXP TOO LOW': { label: 'Less experience than the room', Icon: TrendingDown, tone: TONE.red },
  'EXP TOO HIGH': { label: 'More experience than the room', Icon: TrendingUp, tone: TONE.amber },
  'HIGH PRIORITY': { label: 'High importance seat', Icon: Gem, tone: TONE.plum, points: IMPORTANCE_NEED_WEIGHT.high },
  'PRIORITY SEAT': { label: 'Medium importance seat', Icon: Gem, tone: TONE.blue, points: IMPORTANCE_NEED_WEIGHT.medium },
  'COMPLETES PAIR': { label: 'Completes a pair', Icon: Link2, tone: TONE.teal, points: PAIR_BONUS },
  'DELEGATION CONCENTRATION': { label: 'Delegation already here', Icon: UsersRound, tone: TONE.red, points: -CONCENTRATION_PENALTY },
  'MEMBER PICK': { label: 'A member asked for it', Icon: ThumbsUp, tone: TONE.green, points: MEMBER_PICK_BONUS },
  [NEEDS_DELEGATES_REASON]: { label: 'Room needs people', Icon: UserPlus, tone: TONE.blue },
  [SWAP_REASON]: { label: 'Swapped for a better total', Icon: ArrowLeftRight, tone: TONE.ink },
};

/** How a badge looks, without its points. */
type BadgeLook = Omit<BadgeSpec, 'points'>;

const LOW_SEAT: BadgeSpec = { label: 'Low importance seat', Icon: Gem, tone: TONE.green, points: IMPORTANCE_NEED_WEIGHT.low };
const ROOM_FILL: BadgeSpec = { label: 'Room still filling', Icon: CircleDashed, tone: TONE.ink };

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

/** The tinted disc with the reason's icon (badges and the score breakdown). */
export function BadgeIcon({ spec, size = 18 }: { spec: Pick<BadgeSpec, 'Icon' | 'tone' | 'filled'>; size?: number }) {
  const { Icon, tone, filled } = spec;
  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 999,
        background: `color-mix(in srgb, ${tone} 16%, #FFFFFF)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${tone} 26%, transparent)`,
      }}
    >
      <Icon size={Math.round(size * 0.6)} strokeWidth={1.75} style={{ color: tone }} fill={filled ? tone : 'none'} />
    </span>
  );
}

function BadgeBody({ spec, points, size }: { spec: BadgeLook; points: number | null; size: 'sm' | 'md' }) {
  const h = size === 'sm' ? 24 : 26;
  return (
    <span
      className="inline-flex items-center flex-shrink-0"
      style={{
        height: h, gap: 6, padding: '0 10px 0 3px', borderRadius: 999, boxSizing: 'border-box',
        background: `color-mix(in srgb, ${spec.tone} 7%, #FFFFFF)`,
        color: spec.tone,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${spec.tone} 20%, transparent), inset 0 1px 0 rgba(255,255,255,0.7), 0 2px 6px -2px color-mix(in srgb, ${spec.tone} 34%, transparent)`,
        fontFamily: OUTFIT, fontSize: size === 'sm' ? 11.5 : 12, fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap',
      }}
    >
      <BadgeIcon spec={spec} size={h - 6} />
      {spec.label}
      {points != null && points !== 0 && (
        <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtPoints(points)}</span>
      )}
    </span>
  );
}

export function FitPill({ reason, why, more, size = 'md' }: { reason: string; why?: string | null; more?: string[]; size?: 'sm' | 'md' }) {
  const b = reasonBadge(reason);
  const badge = <BadgeBody spec={b} points={b.points} size={size} />;
  return why || (more && more.length > 0) ? <FitTip text={why ?? null} lines={more}>{badge}</FitTip> : badge;
}

type SugLike = Pick<Suggestion, 'app' | 'committee' | 'slot' | 'reasons' | 'swap' | 'score'>;

/** A suggestion's first reasons as badges (the first carries the signals the
 *  engine could not read), then the swap badge. */
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

// ── How a suggestion scores ──────────────────────────────────────────────────
// Every part of the fit score with its points. The reasons carry the
// preference, country, experience, importance and delegation parts; a low
// importance seat (+4) adds points without a reason; what is left is the room
// fill nudge (up to +12 for an emptier committee), so the lines always add up
// to the score the engine ranked by.

export interface ScorePart { key: string; spec: BadgeLook; points: number }

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
  const rest = sug.score - parts.reduce((n, p) => n + p.points, 0);
  if (rest !== 0) parts.push({ key: 'ROOM FILL', spec: ROOM_FILL, points: rest });
  return parts;
}

/** The "How this scores" list: one line per part, then the bold total. */
export function ScoreBreakdown({ sug }: { sug: SugLike }) {
  const parts = scoreParts(sug);
  return (
    <div className="flex flex-col" style={{ gap: 4, padding: '10px 12px', borderRadius: 14, background: WELL, fontFamily: OUTFIT }}>
      {parts.length === 0 && <span style={{ fontSize: 12.5, color: NEU.inkSoft }}>No part of the score applies to this seat</span>}
      {parts.map(p => (
        <div key={p.key} className="flex items-center gap-2" style={{ minHeight: 24 }}>
          <BadgeIcon spec={p.spec} size={20} />
          <span className="flex-1 min-w-0" style={{ fontSize: 13, color: NEU.ink, lineHeight: 1.2 }}>{p.spec.label}</span>
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

/** Who holds a seat, with their delegation beneath: the committee pop-up's
 *  taken seats. A delegation seat shows the delegation itself. */
export function HolderLine({ alloc }: { alloc: AllocationRow }) {
  const block = !!alloc.society_id && !alloc.application_id && !alloc.user_id;
  const name = seatHolderName(alloc);
  const soc = alloc.applications?.societies?.name?.trim() || alloc.delegation?.name?.trim() || null;
  const indep = !block && !soc && (alloc.applications?.society_id == null);
  const second = block ? 'Delegation seat' : soc ?? (indep ? 'Independent' : null);
  return (
    <span className="inline-flex items-center gap-2 min-w-0" title={second ? `${name}, ${second}` : name}>
      {block
        ? <span className="inline-flex items-center justify-center flex-shrink-0" style={{ width: 28, height: 28, borderRadius: 999, background: WELL }}><Users size={15} strokeWidth={1.5} style={{ color: NEU.ink }} /></span>
        : <PersonAvatar name={name} url={alloc.profiles?.avatar_url ?? null} size={28} />}
      <span className="flex flex-col min-w-0" style={{ lineHeight: 1.15 }}>
        <span className="[overflow-wrap:anywhere]" style={{ fontSize: 13.5, fontWeight: 700, color: NEU.ink }}>{name}</span>
        {second && <span className="[overflow-wrap:anywhere]" style={{ fontSize: 12, color: NEU.inkSoft }}>{second}</span>}
      </span>
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

// ── A committee pop-up's header ring ─────────────────────────────────────────
// The committee ring on a white disc, half outside the pop-up card's top-left
// edge (CLAUDE.md §8, the signature detail). The card sets `position:
// relative` and `marginTop: POPUP_RING_RISE`; the header pads its left by
// POPUP_RING_INSET. Used by the "Give to" pop-up (SeatBoardGivePopup.tsx).
export const POPUP_RING = 76;
export const POPUP_RING_RISE = 34;
export const POPUP_RING_INSET = 22 + POPUP_RING + 10 + 16;

export function PopupRingBadge({ committee }: { committee: CommitteeData }) {
  return (
    <span
      aria-hidden
      className="absolute inline-flex items-center justify-center"
      style={{
        top: -POPUP_RING_RISE, left: 22, width: POPUP_RING + 10, height: POPUP_RING + 10, borderRadius: 999, background: '#FFFFFF',
        boxShadow: '0 8px 22px -8px rgba(27,56,40,0.35), 0 0 0 1px rgba(27,56,40,0.05)',
      }}
    >
      <CommitteeRing committee={committee} size={POPUP_RING} />
    </span>
  );
}
