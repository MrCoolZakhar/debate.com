'use client';

// ── The Assignment page's shared kit ─────────────────────────────────────────
// The row types the page loads and the small pieces every assignment surface
// draws: avatars, round flags, committee logos, preference medals, reason
// chips, the delegate detail and the suggestion card. Lifted out of
// `assignment/page.tsx` unchanged (21 Oct 2026) so the classic board, the new
// seat board (`SeatBoard.tsx`) and the delegation views draw the same thing.
// The scoring itself lives in `src/lib/assignmentFit.ts`.

import { useState } from 'react';
import { UserRound, Users, Check, Globe2, Award, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { getCountryByName } from '@/lib/countries';
import { CircleFlag } from '@/components/CircleFlag';
import { FitTip, explainReason, missingSignals, type ReasonContext } from '@/app/manage/[slug]/assignment/fitReasons';
import { CountryName, StackedName, committeeShortName } from '@/app/manage/[slug]/assignment/displayNames';
import { effectiveSlotArt, parseGroups } from '@/lib/slotGroups';
import { ageAt } from '@/lib/age';
import { LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';
import { EXPERIENCE_BANDS } from '@/lib/munExperience';
import DelegationPopupLink from '@/app/manage/[slug]/DelegationPopupLink';
import { LogoDisc } from '@/components/LogoDisc';
import { committeeEmblemSrc } from '@/app/manage/[slug]/assignment/delegationSeatsGrid';
import ProfileLink from '@/components/ProfileLink';
import { NEU, NEU_GRADIENTS, NeuInset, NeuButton } from '@/components/neu';
import { SWAP_REASON, fitLight, fitPercent, type FitLight, type FitSuggestion, type ImportanceTier } from '@/lib/assignmentFit';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppPref {
  preference_order: number;
  country_code: string;
  country_name: string;
  conference_committee_id: string;
  conference_committees: { name: string; abbreviation: string | null } | null;
}

export interface AcceptedApp {
  id: string;
  submitted_at?: string | null;
  /** When the application was accepted (applications.decided_at): the seat
   *  board's default order, oldest first. Rewritten when someone is unseated. */
  decided_at?: string | null;
  role: string;
  experience_level: string | null;
  is_head_delegate: boolean;
  society_id: string | null;
  payment_status: string | null;
  attending: boolean;
  invited_email: string | null;
  invited_name: string | null;
  profiles: {
    id: string;
    display_name: string;
    email: string;
    nationality: string | null;
    date_of_birth: string | null;
    mun_experience_level: string | null;
    avatar_url: string | null;
  } | null;
  /** `city` is read when the page's query asks for it (societies.city); the
   *  seat board shows it as where the delegation's school is. */
  societies: { name: string; city?: string | null } | null;
  application_preferences: AppPref[];
}

export interface AllocationRow {
  id: string;
  user_id: string | null;
  country_code: string;
  country_name: string;
  // TRUE once this delegate has actually been queued their allocation email.
  // Written in exactly one place — queueAllocationEmails — and only for
  // recipients that really got an outbox row, so it is never a claim that
  // somebody was told when they were not.
  allocation_sent: boolean;
  allocation_sent_at?: string | null;
  application_id: string | null;
  // Which seat of the slot this row occupies (1 or 2). Uniqueness is now
  // (conference_committee_id, country_code, seat); a delegation_size 1 slot
  // only ever has a seat-1 row.
  seat: number;
  // A DELEGATION (block) seat: society_id set, user_id + application_id null.
  // The seat is owned by the delegation until it hands it to one of its
  // delegates. `delegation` carries the society name for display.
  society_id?: string | null;
  delegation?: { name: string } | null;
  // profiles/applications carry the extra fields the click-into list view and
  // its reused delegate detail need (delegation, level, DOB, preferences).
  // They stay optional so the optimistic temp row (applyLocalAllocation) can
  // omit them; the silent refetch fills them in.
  profiles: {
    id?: string;
    display_name: string;
    email?: string | null;
    nationality?: string | null;
    date_of_birth?: string | null;
    mun_experience_level?: string | null;
    avatar_url: string | null;
  } | null;
  applications: {
    invited_name: string | null;
    experience_level?: string | null;
    role?: string | null;
    is_head_delegate?: boolean;
    society_id?: string | null;
    payment_status?: string | null;
    attending?: boolean;
    invited_email?: string | null;
    societies?: { name: string } | null;
    application_preferences?: AppPref[];
  } | null;
}

export interface SlotRow {
  id: string;
  country_code: string;
  country_name: string;
  delegation_size: number;
  importance: ImportanceTier;
  /** A seat's own crest; see `src/lib/slotGroups.ts`. */
  logo_url?: string | null;
  /** The seat's group in `CommitteeData.groups` (parliamentary committees). */
  group_id?: string | null;
}

export interface DisplayChair {
  name: string;
  avatar_url: string | null;
}

export interface CommitteeData {
  id: string;
  name: string;
  abbreviation: string | null;
  difficulty: string;
  total_slots: number;
  logo_url: string | null;
  chair_user_ids: string[] | null;
  display_chairs: DisplayChair[] | null;
  committee_country_slots: SlotRow[];
  conference_allocations: AllocationRow[];
  committee_type?: string | null;
  /** `conference_committees.groups` jsonb, read through `parseGroups`. */
  groups?: unknown;
}

// ── Seat art ──────────────────────────────────────────────────────────────────
// A seat draws its own logo, then its group's logo, then the national flag
// (`effectiveSlotArt`). These two helpers resolve the logo half so every
// `CountryFlag` on the board can be handed a `logoUrl` in one line.
export function slotLogoUrl(committee: Pick<CommitteeData, 'groups'>, slot: SlotRow): string | null {
  const art = effectiveSlotArt(slot, parseGroups(committee.groups));
  return art.kind === 'logo' ? art.url : null;
}
export function committeeSeatLogo(committee: Pick<CommitteeData, 'groups' | 'committee_country_slots'>, countryCode: string): string | null {
  const slot = committee.committee_country_slots.find(s => s.country_code === countryCode);
  return slot ? slotLogoUrl(committee, slot) : null;
}

// Per-user MUN history (from mun_cv_entries + conference_awards)
export interface UserHistory {
  conferences: number;
  awards: number;
  awardLabels: string[];
}

/** Everything the fit tooltips need, from the same inputs the engine scored. */
export function reasonContext(app: AcceptedApp, committee: CommitteeData, slot: SlotRow): ReasonContext {
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
  const prefIndex = prefs.findIndex(p => p.conference_committee_id === committee.id);
  return {
    committeeName: committeeLabels(committee).big,
    difficulty: committee.difficulty ?? null,
    countryName: slot.country_name,
    importance: slot.importance,
    experienceLevel: app.experience_level ?? app.profiles?.mun_experience_level ?? null,
    prefIndex,
    prefCountryName: prefIndex >= 0 ? prefs[prefIndex].country_name : null,
    societyName: app.society_id == null ? null : (app.societies?.name ?? null),
  };
}

/** The score's traffic light as colours (owner, 22 Oct 2026): 80 to 100%
 *  green, 60 to 79% amber, under 60% red. `fg` is the text, `bg` / `ring` the
 *  disc or badge behind it. Takes the engine's raw score. */
export const FIT_LIGHT_COLORS: Record<FitLight, { fg: string; bg: string; ring: string; word: string }> = {
  green: { fg: '#23633A', bg: '#E3F1E6', ring: 'rgba(35,99,58,0.30)', word: 'Strong fit' },
  amber: { fg: '#8F5A0A', bg: '#FBEFD5', ring: 'rgba(170,110,15,0.32)', word: 'Fair fit' },
  red: { fg: '#A12A22', bg: '#FBE4E1', ring: 'rgba(161,42,34,0.28)', word: 'Weak fit' },
};
export function fitLightColors(score: number) {
  return FIT_LIGHT_COLORS[fitLight(score)];
}
export function fitColor(score: number) {
  return fitLightColors(score).fg;
}
/** "87%": what a person reads for a raw engine score. */
export function fitPctLabel(score: number): string {
  return `${fitPercent(score)}%`;
}

/** One suggested seat: the engine's FitSuggestion over this page's row types. */
export type Suggestion = FitSuggestion<AcceptedApp, CommitteeData>;

// ── Shared bits ───────────────────────────────────────────────────────────────

export const OUTFIT = "var(--font-brand), sans-serif";
// Typography rule: no monospace on the conferences side, MONO now resolves to Outfit
// so every stamp/eyebrow/code that referenced it renders in Outfit (family swap only).
export const MONO = "var(--font-brand), sans-serif";

// Depth normalisation: small flag images carried the full dual neu relief
// (NEU.outSm), which reads heavy and uneven on tiny rectangles/discs. One
// soft, single-direction drop keeps flag depth consistent and subtle.
export const FLAG_SHADOW = '0 1px 3px rgba(27,56,40,0.18)';

// ── PersonAvatar ───────────────────────────────────────────────────────────────
// Every participant avatar on the assignment page. Renders avatar_url when it
// loads; on a missing/blank url OR a load error it ALWAYS falls back to a
// neumorphic user silhouette (a lucide UserRound head-and-shoulders glyph in
// gold on a forest seat). Custom characters, unregistered invitees and broken
// image URLs therefore never surface a broken <img> anywhere.
export function PersonAvatar({ name, url, size = 28, userId, nested }: {
  name: string; url: string | null; size?: number;
  /**
   * profiles.id — OPT-IN ONLY. When passed, the avatar wraps itself in a
   * <ProfileLink> to that person's public MUN CV. When it is NOT passed the
   * markup below is byte-identical to what it has always been, and that is
   * load-bearing: several call sites render this avatar INSIDE a real
   * <button>, where an <a> would be invalid HTML and break both controls.
   * Only pass `userId` from a site you have verified has no <button>/<a>
   * ancestor.
   */
  userId?: string | null;
  /** Forwarded to ProfileLink — set when a clickable (onClick) ancestor exists. */
  nested?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const cleanUrl = typeof url === 'string' && url.trim() ? url.trim() : null;
  const showImage = !!cleanUrl && !failed;
  const inner = showImage ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={cleanUrl}
      alt={name}
      onError={() => setFailed(true)}
      draggable={false}
      className="rounded-full object-cover flex-shrink-0"
      style={{ width: size, height: size, boxShadow: NEU.outSm }}
    />
  ) : (
    <span
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
        boxShadow: NEU.outSm,
      }}
      aria-label={name || 'Participant'}
      title={name || undefined}
    >
      <UserRound size={Math.round(size * 0.56)} strokeWidth={2} style={{ color: NEU.gold }} />
    </span>
  );
  if (!userId) return inner;
  // inline-flex + flex-shrink:0 so the anchor occupies exactly the space the
  // avatar did as a flex item — the link must not change any layout.
  // draggable={false} always: an <a> is natively draggable, and this avatar
  // sits inside draggable cards on the unassigned rail. Opting the anchor out
  // hands the drag straight back to the nearest draggable ancestor (the card),
  // and costs nothing on the sites that are not drag sources.
  return (
    <ProfileLink userId={userId} name={name} nested={nested} draggable={false}
      style={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
      {inner}
    </ProfileLink>
  );
}

// A delegation-owned seat's avatar: a multi-person (Users) glyph on the forest
// disc, standing in for the individual PersonAvatar to signal "owned by the
// delegation, not yet handed to a delegate".
export function DelegationAvatar({ size = 30 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-full flex-shrink-0"
      style={{
        width: size, height: size,
        background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
        boxShadow: NEU.outSm,
      }}
      aria-label="Delegation seat"
      title="Owned by the delegation"
    >
      <Users size={Math.round(size * 0.54)} strokeWidth={2} style={{ color: NEU.gold }} />
    </span>
  );
}

// ── CountryFlag ────────────────────────────────────────────────────────────────
// Every country flag on the assignment page. A country seat renders its twemoji
// flag; a character/custom seat (JCC judges, cabinet posts, press) stores the
// role NAME in country_code — never a 2-letter ISO code — so we detect that and
// render a neutral USER placeholder (a person silhouette in a disc, matching the
// applications page) instead of building a broken flag URL — a character seat is
// a person, not a country. A genuine load failure (network, retired code) ALSO
// falls back to it, so a broken <img> never surfaces anywhere.
export function isIsoCode(code: string | null | undefined): boolean {
  return /^[A-Za-z]{2}$/.test((code ?? '').trim());
}
export function CountryFlag({
  code, w, h, shadow, dim, style, alt, title, logoUrl,
}: {
  code: string | null | undefined;
  w: number; h: number;
  /** Ignored: every flag on this page is round (owner, 23 Sep 2026). Kept so
   *  call sites written for rectangles still compile. */
  radius?: number;
  shadow?: string; dim?: number;
  style?: React.CSSProperties; alt?: string; title?: string;
  /** A seat's own or group crest (`slotLogoUrl`). Wins over the flag. */
  logoUrl?: string | null;
}) {
  const clean = (code ?? '').trim();
  const label = alt ?? title ?? '';
  // Every flag on the allocation portal is the shared ROUND flag (square
  // artwork that fills the disc; crest, then flag, then the person glyph for a
  // character seat). A rectangle-sized call site gets a disc about as tall as
  // the rectangle was, a touch larger so the flag still reads.
  const size = w === h ? w : Math.max(16, Math.round(h * 1.2));
  return (
    <CircleFlag
      code={isIsoCode(clean) ? clean : null}
      logoUrl={logoUrl}
      size={size}
      label={label}
      title={title ?? (label || undefined)}
      fallback={<UserRound size={Math.round(size * 0.6)} strokeWidth={2} style={{ color: NEU.forest }} />}
      style={{ boxShadow: shadow, opacity: dim, ...style }}
    />
  );
}

// ── Level + age + committee-name helpers ────────────────────────────────────────
// A delegate with no recorded MUN level is treated as the lowest tier
// ('beginner') everywhere — rail cards, detail and overview — never blank.
export function effectiveLevel(app: { experience_level?: string | null; profiles?: { mun_experience_level?: string | null } | null } | null | undefined): string {
  return app?.experience_level ?? app?.profiles?.mun_experience_level ?? 'beginner';
}

// Age is derived from a date of birth sourced robustly: the application row
// first (if it ever carries one), then the linked profile. Shows whenever a DOB
// exists anywhere.
export function ageOf(app: { date_of_birth?: string | null; profiles?: { date_of_birth?: string | null } | null } | null | undefined): number | null {
  const dob = app?.date_of_birth ?? app?.profiles?.date_of_birth ?? null;
  return ageAt(dob);
}

// Committee naming rule, one for the whole portal: the stored abbreviation,
// else committeeDisplayName of the full name (committeeShortName in
// displayNames.tsx). No acronym is ever DERIVED from the words: preference
// lines used to read only the name and auto-built "DISC" for DISEC. The
// subtitle is the full name, shown only when it differs from the big label.
export function committeeLabels(c: { name: string; abbreviation?: string | null }): { big: string; full: string | null } {
  const name = (c.name ?? '').trim();
  const big = committeeShortName(c);
  const full = big.toLowerCase() !== name.toLowerCase() ? name : null;
  return { big, full };
}

// ── CommitteeLogo ─────────────────────────────────────────────────────────────
// Every committee logo on this page: a fixed square, the artwork contained.
// A committee with no upload gets its preset emblem (ECOSOC, WHO...) or the UN
// mark, the same emblem the delegation grid and the leader views draw. The
// monogram only shows if that image fails, and is two or three letters so it
// fits the disc: the full acronym ("ECOSOC") in an 18 px disc was clipped to an
// unreadable smudge.
export function CommitteeLogo({ committee, size, alt = '' }: {
  committee: { name: string; abbreviation?: string | null; logo_url: string | null };
  size: number;
  alt?: string;
}) {
  const big = committeeShortName(committee);
  return (
    <LogoDisc
      bare
      src={committeeEmblemSrc({ logo_url: committee.logo_url, name: committee.name, abbreviation: committee.abbreviation ?? null })}
      size={size}
      fallbackText={big.replace(/[^A-Za-z0-9]/g, '').slice(0, size < 24 ? 2 : 3) || '?'}
      alt={alt}
    />
  );
}

// ── CommitteeDifficultyBadge ────────────────────────────────────────────────────
// The committee's difficulty, as the account rank insignia on a tinted disc plus
// the level word. Sized generously so every tier — the expert crowned star
// especially — reads clearly in the panel header.
export function CommitteeDifficultyBadge({ level, disc = 34, glyph = 22, showWord = true }: { level: string; disc?: number; glyph?: number; showWord?: boolean }) {
  const key = (level ?? '').toLowerCase();
  const accent = LEVEL_ACCENT[key] ?? '#9A8A78';
  return (
    <span
      className="inline-flex items-center gap-1.5 flex-shrink-0"
      aria-label={`Difficulty: ${level}`}
      title={`Difficulty: ${level}`}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{
          width: disc, height: disc, borderRadius: 9999,
          background: `linear-gradient(150deg, ${accent}26, ${accent}14)`,
          border: `1px solid ${accent}55`, boxShadow: NEU.outSm,
        }}
      >
        <LevelInsignia level={level} size={glyph} />
      </span>
      {showWord && (
        <span style={{ fontSize: 12, fontWeight: 700, color: accent, fontFamily: OUTFIT, textTransform: 'capitalize' }}>
          {key || 'beginner'}
        </span>
      )}
    </span>
  );
}

// ── Preference medals ──────────────────────────────────────────────────────────
// A delegate's preference rank is coloured like a podium: 1st = gold,
// 2nd = silver, 3rd = bronze, 4th and beyond a calm muted stone.
export type Medal = { fg: string; bg: string; ring: string; label: string };
export function prefMedal(order: number): Medal {
  switch (order) {
    case 1: return { fg: '#9A7B1E', bg: 'rgba(238,217,138,0.30)', ring: 'rgba(182,135,31,0.45)', label: 'GOLD' };
    case 2: return { fg: '#6E7278', bg: 'rgba(176,182,188,0.30)', ring: 'rgba(140,146,152,0.5)', label: 'SILVER' };
    case 3: return { fg: '#9A5B2C', bg: 'rgba(184,115,51,0.22)', ring: 'rgba(169,116,60,0.5)', label: 'BRONZE' };
    default: return { fg: NEU.muted, bg: 'rgba(154,138,120,0.16)', ring: 'rgba(154,138,120,0.4)', label: '' };
  }
}

/** Small round medal badge carrying the preference number. */
export function PrefRankBadge({ order, size = 18 }: { order: number; size?: number }) {
  const m = prefMedal(order);
  return (
    <span
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 999,
        backgroundColor: m.bg,
        border: `1px solid ${m.ring}`,
        color: m.fg,
        fontFamily: OUTFIT, fontWeight: 800, fontSize: Math.round(size * 0.55),
        fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        boxShadow: order <= 3 ? NEU.outSm : undefined,
      }}
      title={m.label ? `${order === 1 ? '1st' : order === 2 ? '2nd' : '3rd'} choice preference` : `Preference #${order}`}
    >
      {order}
    </span>
  );
}

/** A scoring-reason chip. Preference-rank reasons take the podium colours; a
 *  penalty (negative point value) reads as a calm red warning; the swap flag
 *  reads as gold, its own distinct tone since it's neither a bonus nor a
 *  penalty; everything else reads as a calm positive (green) neu chip. */
export function ReasonChip({ reason, why, more }: { reason: string; why?: string | null; more?: string[] }) {
  const medalFor = reason === '1ST CHOICE' ? 1 : reason === '2ND CHOICE' ? 2 : reason === '3RD CHOICE' ? 3 : 0;
  const m = medalFor ? prefMedal(medalFor) : null;
  const isSwap = reason === SWAP_REASON;
  const isPenalty = reason.includes('-');
  const bg = m ? m.bg : isSwap ? 'rgba(182,135,31,0.16)' : isPenalty ? 'rgba(139,32,32,0.1)' : 'rgba(61,122,82,0.12)';
  const fg = m ? m.fg : isSwap ? '#8A6614' : isPenalty ? '#8B2020' : NEU.green;
  const chip = (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full"
      style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', fontFamily: MONO,
        whiteSpace: 'nowrap', flexShrink: 0,
        backgroundColor: bg,
        color: fg,
        // Raised in its own hue: a coloured drop, an inner top highlight and
        // a ring of its own colour. Never a white halo.
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${fg} 20%, transparent), inset 0 1px 0 rgba(255,255,255,0.5), 0 2px 6px -1px color-mix(in srgb, ${fg} 30%, transparent)`,
      }}
    >
      {reason}
    </span>
  );
  // Hover or focus explains the tag at once, with the direction and the
  // actual values behind it (see fitReasons.tsx).
  return why || (more && more.length > 0) ? <FitTip text={why ?? null} lines={more}>{chip}</FitTip> : chip;
}

// ── LevelTag ───────────────────────────────────────────────────────────────────
// A delegate's MUN level as the account chevron insignia (on its tinted disc)
// plus the level word, for the unassigned rail. Nothing renders without a level.
export function LevelTag({ level }: { level: string | null | undefined }) {
  // No recorded level → treat as the lowest tier ('beginner'), never blank.
  const lvl = level && level.trim() ? level : 'beginner';
  const accent = LEVEL_ACCENT[lvl.toLowerCase()] ?? '#9A8A78';
  return (
    <span className="inline-flex items-center gap-1 flex-shrink-0">
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{ width: 16, height: 16, borderRadius: 9999, background: `linear-gradient(150deg, ${accent}22, ${accent}12)`, border: `1px solid ${accent}55` }}
        aria-hidden="true"
      >
        <LevelInsignia level={lvl} size={11} />
      </span>
      <span style={{ fontSize: 12, fontWeight: 700, color: accent, fontFamily: OUTFIT, textTransform: 'capitalize' }}>
        {lvl.toLowerCase()}
      </span>
    </span>
  );
}

// ── LevelDisc / LevelHero ─────────────────────────────────────────────────────
// A level is always its insignia on a tinted disc (CLAUDE.md §8): small in a
// list row, large where the person is the focus, with what it means beneath.
export function levelWord(level: string | null | undefined): string {
  const k = (level ?? '').trim().toLowerCase() || 'beginner';
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/** What a level means: the person's own conference count when known, else
 *  the band's range (src/lib/munExperience.ts). */
export function levelMeaning(level: string | null | undefined, conferences?: number | null): string {
  if (conferences != null) return `${conferences} ${conferences === 1 ? 'conference' : 'conferences'}`;
  const k = (level ?? '').trim().toLowerCase() || 'beginner';
  const i = EXPERIENCE_BANDS.findIndex(b => b.level === k);
  if (i < 0) return '';
  const band = EXPERIENCE_BANDS[i];
  const next = EXPERIENCE_BANDS[i + 1];
  if (!next) return `${band.min} or more conferences`;
  return `${band.min} to ${next.min - 1} conferences`;
}

export function LevelDisc({ level, size = 22 }: { level: string | null | undefined; size?: number }) {
  const lvl = level && level.trim() ? level : 'beginner';
  const accent = LEVEL_ACCENT[lvl.toLowerCase()] ?? '#9A8A78';
  return (
    <span
      role="img"
      aria-label={levelWord(lvl)}
      title={`${levelWord(lvl)}, ${levelMeaning(lvl)}`}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{
        width: size, height: size, borderRadius: 9999,
        background: `linear-gradient(150deg, ${accent}26, ${accent}12)`,
        boxShadow: `inset 0 0 0 ${size >= 40 ? 2 : 1}px ${accent}55${size >= 40 ? `, 0 6px 16px -6px ${accent}66` : ''}`,
      }}
    >
      <LevelInsignia level={lvl} size={Math.round(size * 0.58)} />
    </span>
  );
}

/** A level as its insignia disc with the word beside it, in the level's own
 *  colour (the seat board's smart allocation cards, owner 22 Oct 2026). */
export function LevelBadge({ level, size = 18, fontSize = 12.5 }: { level: string | null | undefined; size?: number; fontSize?: number }) {
  const lvl = level && level.trim() ? level : 'beginner';
  const accent = LEVEL_ACCENT[lvl.toLowerCase()] ?? '#9A8A78';
  return (
    <span className="inline-flex items-center flex-shrink-0" style={{ gap: 5, fontFamily: OUTFIT, whiteSpace: 'nowrap' }}>
      <LevelDisc level={lvl} size={size} />
      <span style={{ fontSize, fontWeight: 600, color: accent, lineHeight: 1 }}>{levelWord(lvl)}</span>
    </span>
  );
}

/** The big level for the person in focus: the disc, the word, what it means. */
export function LevelHero({ level, conferences, size = 64 }: { level: string | null | undefined; conferences?: number | null; size?: number }) {
  const lvl = level && level.trim() ? level : 'beginner';
  const accent = LEVEL_ACCENT[lvl.toLowerCase()] ?? '#9A8A78';
  const meaning = levelMeaning(lvl, conferences);
  return (
    <span className="inline-flex flex-col items-center flex-shrink-0 text-center" style={{ gap: 5, fontFamily: OUTFIT, minWidth: size + 16 }}>
      <LevelDisc level={lvl} size={size} />
      <span style={{ fontSize: 14, fontWeight: 700, color: accent, lineHeight: 1.1 }}>{levelWord(lvl)}</span>
      {meaning && <span style={{ fontSize: 12, color: NEU.inkSoft, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>{meaning}</span>}
    </span>
  );
}

export function DelegationChip({ app, openable = false }: { app: AcceptedApp; openable?: boolean }) {
  const indep = app.society_id == null;
  const label = indep ? 'Independent' : app.societies?.name ?? null;
  if (!label) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full"
      style={{
        maxWidth: 170,
        backgroundColor: NEU.surface,
        boxShadow: NEU.outSm,
        color: indep ? NEU.muted : NEU.forest,
      }}
    >
      {/* A delegation is a group brought by an advisor/head delegate — the
          multi-person glyph flags it as such at a glance. Independents stay plain. */}
      {!indep && <Users size={11} strokeWidth={2.2} style={{ flexShrink: 0 }} />}
      <span
        className="[overflow-wrap:anywhere]"
        style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, letterSpacing: '0.04em' }}
      >
        {openable && !indep ? <DelegationPopupLink societyId={app.society_id}>{label}</DelegationPopupLink> : label}
      </span>
    </span>
  );
}

// ── Delegate detail panel ─────────────────────────────────────────────────────

export function DelegateDetail({
  app, history, contextCommitteeId, contextCountryCode,
}: {
  app: AcceptedApp;
  history: UserHistory | undefined;
  /** The committee + country of the slot currently in view (a suggestion
   *  row, an already-allocated seat) — when both are set, the matching
   *  preference row (if the delegate ranked it) gets a match marker, so an
   *  organizer sees at a glance whether they're getting what they asked
   *  for. Omitted where there's no specific slot in context (e.g. the
   *  unassigned rail), in which case no row ever shows a marker. */
  contextCommitteeId?: string;
  contextCountryCode?: string;
}) {
  const nationality = app.profiles?.nationality ?? null;
  const natCountry = nationality ? getCountryByName(nationality) : undefined;
  const age = ageOf(app);
  const [showAllPrefs, setShowAllPrefs] = useState(false);

  // Same rank order scorePrefAndExp reads preferences in — 1st choice first.
  const sortedPrefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
  const topThree = sortedPrefs.slice(0, 3);
  const rest = sortedPrefs.slice(3);

  const prefRow = (p: AppPref) => {
    const isMatch = !!contextCommitteeId && !!contextCountryCode
      && p.conference_committee_id === contextCommitteeId && p.country_code === contextCountryCode;
    return (
      <div key={p.preference_order} className="flex items-center gap-2 min-w-0">
        <PrefRankBadge order={p.preference_order} />
        <CountryFlag code={p.country_code} w={18} h={13} radius={2} alt={p.country_name} />
        <span className="flex-1 min-w-0" style={{ fontSize: 12, color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.3 }} title={`${p.conference_committees?.name ?? 'Unknown committee'} · ${p.country_name}`}>
          <span style={{ fontWeight: 700 }}>{committeeShortName(p.conference_committees)}</span> · <CountryName name={p.country_name} code={p.country_code} />
        </span>
        {isMatch && (
          <span title="Matches the seat in view" style={{ flexShrink: 0, lineHeight: 0 }}>
            <Check size={13} strokeWidth={2.8} style={{ color: NEU.green }} />
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${NEU.base}` }}>
      {/* Nationality row */}
      <div className="flex items-center gap-2 mb-2.5">
        {natCountry ? (
          <CountryFlag code={natCountry.code} w={22} h={15} radius={2} shadow="0 1px 3px rgba(27,56,40,0.2)" alt={nationality ?? ''} />
        ) : (
          <Globe2 size={14} style={{ color: '#9A8A78' }} />
        )}
        <span className="flex-shrink-0" style={{ fontSize: 12, color: '#1C1410', fontFamily: OUTFIT, fontWeight: 600 }}>
          {nationality ?? 'Nationality not set'}
          {age != null && <span style={{ color: NEU.muted, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}> · {age}</span>}
        </span>
        <span className="[overflow-wrap:anywhere] min-w-0" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, marginLeft: 'auto' }}>
          {app.profiles?.email}
        </span>
      </div>

      {/* Top three preferences, rank order — the primary preference display */}
      {topThree.length > 0 && (
        <div className="mb-2.5">
          <p style={{ fontSize: 10, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 5 }}>PREFERENCES</p>
          <div className="flex flex-col gap-1">
            {topThree.map(prefRow)}
            {showAllPrefs && rest.map(prefRow)}
          </div>
          {rest.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllPrefs(v => !v)}
              className="focus:outline-none"
              style={{
                marginTop: 5, fontSize: 10, color: NEU.deepGold, fontFamily: MONO, fontWeight: 700,
                letterSpacing: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              {showAllPrefs ? 'Hide remaining preferences' : `Show all preferences (+${rest.length})`}
            </button>
          )}
        </div>
      )}

      {/* Award labels */}
      {history && history.awardLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          <Award size={12} style={{ color: '#B6871F', flexShrink: 0 }} />
          {history.awardLabels.slice(0, 4).map((lbl, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full" style={{ fontSize: 10, backgroundColor: 'rgba(182,135,31,0.12)', color: '#B6871F', fontFamily: MONO, border: '1px solid rgba(182,135,31,0.25)' }}>
              {lbl}
            </span>
          ))}
          {history.awardLabels.length > 4 && (
            <span style={{ fontSize: 10, color: '#9A8A78', fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>+{history.awardLabels.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── SuggestionCard ───────────────────────────────────────────────────────────
// One suggested seat: the person, the seat, the fit score and Assign, then the
// committee and the reason chips; the person opens their detail in place.
// The classic board's strip and the seat board's feed both draw this.
export function SuggestionCard({ sug, busy, locked, expanded, onToggle, history, onAssign }: {
  sug: Suggestion;
  /** This card's assignment is saving. */
  busy: boolean;
  /** Another assignment is waiting on the first-assign pop-up. */
  locked: boolean;
  expanded: boolean;
  onToggle: () => void;
  history: UserHistory | undefined;
  onAssign: () => void;
}) {
  return (
    <NeuInset small className="px-3 py-2.5">
      {/* Row 1 — identity + fit score + assign. Clicking the
          identity opens the applicant's full detail so the
          organizer can vet a pick before assigning. The score
          lives up here (next to ASSIGN) so Row 2 is reserved
          entirely for the committee + reason tags, keeping every
          card a consistent two rows with the tags side by side. */}
      <div className="flex items-center gap-2.5">
        <div
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
          className="flex items-center gap-2.5 flex-1 min-w-0 focus:outline-none"
          style={{ cursor: 'pointer' }}
          title={expanded ? 'Hide applicant detail' : 'View applicant detail'}
        >
          {/* role="button" <div>, not a real <button> — link is legal;
              nested keeps the expand/collapse toggle working. */}
          <PersonAvatar name={sug.app.profiles?.display_name ?? sug.app.invited_name ?? 'Unknown'} url={sug.app.profiles?.avatar_url ?? null} size={30} userId={sug.app.profiles?.id} nested />
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {/* The person keeps up to half the row and the seat name
                wraps: a long custom seat ("Curtis LeMay") used to
                squeeze the name column to one letter per line. */}
            <span className="min-w-0 flex-shrink-0" style={{ fontFamily: OUTFIT, maxWidth: '50%' }}>
              <StackedName name={sug.app.profiles?.display_name ?? sug.app.invited_name ?? 'Unknown'} size={14} weight={700} color={NEU.ink} restColor={NEU.inkSoft} />
            </span>
            <ArrowRight size={12} style={{ color: NEU.muted, flexShrink: 0 }} />
            <CountryFlag code={sug.slot.country_code} w={19} h={13} radius={2} alt={sug.slot.country_name} logoUrl={slotLogoUrl(sug.committee, sug.slot)} />
            <CountryName name={sug.slot.country_name} code={sug.slot.country_code} className="min-w-0" style={{ fontSize: 14, color: NEU.ink, fontFamily: OUTFIT, fontWeight: 600, whiteSpace: 'normal', lineHeight: 1.15, overflowWrap: 'anywhere' }} />
          </div>
          {expanded
            ? <ChevronUp size={14} style={{ color: NEU.muted, flexShrink: 0 }} />
            : <ChevronDown size={14} style={{ color: NEU.muted, flexShrink: 0 }} />}
        </div>
        {sug.swap ? (
          <span
            className="inline-flex items-baseline gap-1 flex-shrink-0"
            title={`Suggested here at ${fitPctLabel(sug.score)}; their own best available seat scored ${fitPctLabel(sug.swap.ownBestScore)}`}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: fitColor(sug.score), fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
              {fitPctLabel(sug.score)}
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, color: NEU.muted, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
              (best {fitPctLabel(sug.swap.ownBestScore)})
            </span>
          </span>
        ) : (
          <span className="flex-shrink-0" style={{ fontSize: 11, fontWeight: 800, color: fitColor(sug.score), fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
            {fitPctLabel(sug.score)}
          </span>
        )}
        <NeuButton onClick={onAssign} disabled={busy || locked} style={{ padding: '8px 16px', fontSize: 11, letterSpacing: 0 }}>
          {busy ? '…' : 'Assign'}
        </NeuButton>
      </div>
      {/* Row 2 — committee + reason tags. The committee chip keeps
          its natural width and the tags wrap beneath it when the
          card is narrow. It used to be the one shrinkable item on
          a nowrap row beside three fixed chips, so a long chip
          ("DELEGATION CONCENTRATION") squeezed "ECOSOC" to one
          letter per line (owner, 21 Oct 2026). */}
      <div className="flex items-center gap-1.5 mt-2 min-w-0 flex-wrap">
        <span className="inline-flex items-center gap-1.5 flex-shrink-0 max-w-full" style={{ fontSize: 10, fontWeight: 800, color: NEU.forest, fontFamily: MONO }}>
          <CommitteeLogo committee={sug.committee} size={18} />
          <span className="min-w-0" style={{ lineHeight: 1.2 }} title={sug.committee.name}>{committeeLabels(sug.committee).big}</span>
        </span>
        <span className="flex items-center gap-1.5 flex-wrap min-w-0">
          <SuggestionReasons sug={sug} />
        </span>
      </div>
      {expanded && <DelegateDetail app={sug.app} history={history} contextCommitteeId={sug.committee.id} contextCountryCode={sug.slot.country_code} />}
    </NeuInset>
  );
}

/** A suggestion's first three reason chips (the first carries the signals the
 *  engine could not read) and the swap chip, exactly as the strip draws them. */
export function SuggestionReasons({ sug, max = 3 }: { sug: Pick<Suggestion, 'app' | 'committee' | 'slot' | 'reasons' | 'swap'>; max?: number }) {
  const ctx = reasonContext(sug.app, sug.committee, sug.slot);
  const gaps = missingSignals(ctx, sug.reasons);
  return (
    <>
      {sug.reasons.slice(0, max).map((r, i) => (
        <ReasonChip key={r} reason={r} why={explainReason(r, ctx)} more={i === 0 ? gaps : undefined} />
      ))}
      {sug.swap && (
        <ReasonChip
          reason={SWAP_REASON}
          why={`Swapped with ${sug.swap.partnerName}: a net gain of +${sug.swap.netGain} across both delegates. Their own best open seat scored ${fitPctLabel(sug.swap.ownBestScore)}.`}
        />
      )}
    </>
  );
}
