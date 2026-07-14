'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X, Check, Sparkles, ChevronDown, ChevronUp, Award, Globe2, ArrowRight, GripVertical,
  MousePointerClick, Plus, Info, Layers, Gavel, UserRound, Users, Trash2, Repeat, MoreVertical,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { useAuth } from '@/components/AuthProvider';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { ageAt } from '@/lib/age';
import { LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';
import DelegationsView from '@/app/manage/[slug]/assignment/DelegationsView';
import IndependentsView from '@/app/manage/[slug]/assignment/IndependentsView';
import { queueEventEmail, notifyIfNeeded, turnOnDefaultEmail } from '@/lib/emailEvents';
import { sendChairInvite } from '@/lib/chairInvites';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { useConfirmModal } from '@/components/ConfirmModal';
import { NotRegisteredChip } from '@/app/manage/[slug]/assignment/delegationShared';
import { LogoDisc } from '@/components/LogoDisc';
import {
  NEU, NEU_GRADIENTS, NeuCard, NeuInset, NeuButton, NeuIconDisc, NeuProgress,
} from '@/components/neu';
import Portal from '@/components/Portal';
import { useToast, ToastHost } from '@/components/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AppPref {
  preference_order: number;
  country_code: string;
  country_name: string;
  conference_committee_id: string;
  conference_committees: { name: string } | null;
}

interface AcceptedApp {
  id: string;
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
  societies: { name: string } | null;
  application_preferences: AppPref[];
}

interface AllocationRow {
  id: string;
  user_id: string | null;
  country_code: string;
  country_name: string;
  allocation_sent: boolean;
  application_id: string | null;
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

// Rebuild an AcceptedApp shape from an allocation row so the existing
// DelegateDetail / scoring paths can be reused for an already-assigned
// delegate (the click-into overview list).
function allocationToApp(a: AllocationRow): AcceptedApp {
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

// Importance tiers. Mapping: green = LOW importance to the committee,
// yellow/gold = MEDIUM, red = HIGH. 'standard' = unrated (neutral). This
// matches the setup editor's canonical mapping (ConferenceRosterPicker.tsx).
type ImportanceTier = 'standard' | 'high' | 'medium' | 'low';
// Urgency order for the drop popup: high > medium > low > standard
const TIER_RANK: Record<ImportanceTier, number> = { high: 0, medium: 1, low: 2, standard: 3 };
// `dashes` + `color` both encode the tier, exactly mirroring the committee-setup
// editor (ConferenceRosterPicker): standard = 1 dash grey, low = 2 green,
// medium = 3 yellow, high = 4 red. `label` feeds title/aria text only.
const TIER_META: Record<ImportanceTier, { label: string; color: string; bg: string; dashes: number }> = {
  high:     { label: 'HIGH', color: '#8B2020', bg: 'rgba(139,32,32,0.10)', dashes: 4 },
  medium:   { label: 'MED',  color: '#D4A72C', bg: 'rgba(212,167,44,0.14)', dashes: 3 },
  low:      { label: 'LOW',  color: '#3D7A52', bg: 'rgba(61,122,82,0.12)', dashes: 2 },
  standard: { label: 'STD',  color: '#9A8A78', bg: 'rgba(154,138,120,0.12)', dashes: 1 },
};

interface SlotRow {
  id: string;
  country_code: string;
  country_name: string;
  delegation_size: number;
  importance: ImportanceTier;
}

interface DisplayChair {
  name: string;
  avatar_url: string | null;
}

interface CommitteeData {
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
}

interface ChairApp {
  id: string;
  user_id: string;
  status: string;
  assigned_committee_id: string | null;
  experience_level: string | null;
  attending: boolean;
  profiles: { id: string; display_name: string; email: string; avatar_url: string | null } | null;
}

interface PendingChairInvite {
  id: string;
  committee_id: string;
  email: string;
  token: string;
  profiles: { display_name: string } | null;
}

// Per-user MUN history (from mun_cv_entries + conference_awards)
interface UserHistory {
  conferences: number;
  awards: number;
  awardLabels: string[];
}

// ── Scoring ───────────────────────────────────────────────────────────────────
// score(applicant, committee, slot) =
//   preference:  1st choice committee +50, 2nd +30, 3rd +15
//                +25 more if the slot is the exact country they asked for in that preference
//   experience:  15 - 6 * |experience level - committee difficulty|  (floor 0)
//   fullness:    12 * (1 - filled/total) , nudges suggestions toward emptier committees
//   importance:  +18 / +10 / +4 / 0 for an open high / medium / low / standard
//                seat, so the algorithm fills seats — and the committees that
//                still hold them — in order of importance.

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
function levelIdx(s: string | null | undefined): number {
  const i = LEVELS.indexOf((s ?? '').toLowerCase());
  return i === -1 ? 1 : i;
}

// Importance-weighted need: an open high/medium-importance seat is a higher
// priority to fill than a standard one, so a committee still missing its
// high/medium seats scores higher as a target than one only missing standard
// seats. Mirrors the TIER_RANK urgency order (high > medium > low > standard).
const IMPORTANCE_NEED_WEIGHT: Record<ImportanceTier, number> = { high: 18, medium: 10, low: 4, standard: 0 };

// Committee difficulty ordering for the default board sort (ascending): the
// gentlest committees first, hardest last. Mirrors the canonical DIFF_ORDER in
// the committees page; 'general-assembly' committees are entry level, so they
// sort alongside beginner.
const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 0, 'general-assembly': 0, 'general assembly': 0,
  intermediate: 1, advanced: 2, expert: 3,
};
function difficultyRank(d: string | null | undefined): number {
  return DIFFICULTY_RANK[(d ?? '').toLowerCase()] ?? 1;
}

interface ScoreResult {
  score: number;
  reasons: string[];
}

function scorePrefAndExp(app: AcceptedApp, committee: CommitteeData, slot: SlotRow | null): ScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
  const matchIdx = prefs.findIndex(p => p.conference_committee_id === committee.id);
  if (matchIdx === 0) { score += 50; reasons.push('1ST CHOICE'); }
  else if (matchIdx === 1) { score += 30; reasons.push('2ND CHOICE'); }
  else if (matchIdx === 2) { score += 15; reasons.push('3RD CHOICE'); }
  if (slot && matchIdx >= 0 && prefs[matchIdx].country_code === slot.country_code) {
    score += 25;
    reasons.push('COUNTRY PICK');
  }
  const gap = Math.abs(levelIdx(app.experience_level) - levelIdx(committee.difficulty));
  const expScore = Math.max(0, 15 - 6 * gap);
  score += expScore;
  if (gap === 0) reasons.push('EXP MATCH');
  return { score, reasons };
}

function scoreSlot(app: AcceptedApp, committee: CommitteeData, slot: SlotRow, filled: number, total: number): ScoreResult {
  const base = scorePrefAndExp(app, committee, slot);
  const fullness = Math.round(12 * (1 - filled / Math.max(total, 1)));
  base.score += fullness;
  if (total > 0 && filled / total < 0.34 && fullness > 0) base.reasons.push('NEEDS DELEGATES');
  // Importance-weighted need signal: filling a higher-importance open seat
  // matters more, so it lifts the fit score and the algorithm works through
  // the priority seats — and the committees still holding them — first.
  base.score += IMPORTANCE_NEED_WEIGHT[slot.importance];
  if (slot.importance === 'high') base.reasons.push('HIGH PRIORITY');
  else if (slot.importance === 'medium') base.reasons.push('PRIORITY SEAT');
  return base;
}

function fitColor(score: number) {
  if (score >= 50) return '#3D7A52';
  if (score >= 20) return '#B6871F';
  return '#9A8A78';
}

interface Suggestion {
  app: AcceptedApp;
  committee: CommitteeData;
  slot: SlotRow;
  score: number;
  reasons: string[];
}

// ── Shared bits ───────────────────────────────────────────────────────────────

const OUTFIT = "'Outfit', sans-serif";
// Typography rule: no monospace on the conferences side, MONO now resolves to Outfit
// so every stamp/eyebrow/code that referenced it renders in Outfit (family swap only).
const MONO = "'Outfit', sans-serif";

// Depth normalisation: small flag images carried the full dual neu relief
// (NEU.outSm), which reads heavy and uneven on tiny rectangles/discs. One
// soft, single-direction drop keeps flag depth consistent and subtle.
const FLAG_SHADOW = '0 1px 3px rgba(27,56,40,0.18)';

// ── PersonAvatar ───────────────────────────────────────────────────────────────
// Every participant avatar on the assignment page. Renders avatar_url when it
// loads; on a missing/blank url OR a load error it ALWAYS falls back to a
// neumorphic user silhouette (a lucide UserRound head-and-shoulders glyph in
// gold on a forest seat). Custom characters, unregistered invitees and broken
// image URLs therefore never surface a broken <img> anywhere.
export function PersonAvatar({ name, url, size = 28 }: { name: string; url: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  const cleanUrl = typeof url === 'string' && url.trim() ? url.trim() : null;
  const showImage = !!cleanUrl && !failed;
  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cleanUrl}
        alt={name}
        onError={() => setFailed(true)}
        draggable={false}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size, boxShadow: NEU.outSm }}
      />
    );
  }
  return (
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
}

// ── CountryFlag ────────────────────────────────────────────────────────────────
// Every country flag on the assignment page. A country seat renders its twemoji
// flag; a character/custom seat (JCC judges, cabinet posts, press) stores the
// role NAME in country_code — never a 2-letter ISO code — so we detect that and
// render a neutral globe glyph instead of building a broken flag URL. A genuine
// load failure (network, retired code) ALSO falls back to the globe, so a broken
// <img> never surfaces anywhere.
function isIsoCode(code: string | null | undefined): boolean {
  return /^[A-Za-z]{2}$/.test((code ?? '').trim());
}
function CountryFlag({
  code, w, h, radius = 2, shadow, dim, style, alt, title,
}: {
  code: string | null | undefined;
  w: number; h: number; radius?: number;
  shadow?: string; dim?: number;
  style?: React.CSSProperties; alt?: string; title?: string;
}) {
  const [failed, setFailed] = useState(false);
  const clean = (code ?? '').trim();
  const label = alt ?? title ?? '';
  if (!isIsoCode(clean) || failed) {
    return (
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        aria-label={label || 'No country'}
        title={title}
        style={{
          width: w, height: h, borderRadius: radius,
          backgroundColor: NEU.base, color: NEU.muted,
          boxShadow: shadow, opacity: dim, ...style,
        }}
      >
        <Globe2 size={Math.round(Math.min(w, h) * 0.72)} strokeWidth={2} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={getFlagUrl(clean)}
      alt={label}
      title={title}
      draggable={false}
      onError={() => setFailed(true)}
      className="flex-shrink-0"
      style={{ width: w, height: h, borderRadius: radius, objectFit: 'cover', boxShadow: shadow, opacity: dim, ...style }}
    />
  );
}

// ── Level + age + committee-name helpers ────────────────────────────────────────
// A delegate with no recorded MUN level is treated as the lowest tier
// ('beginner') everywhere — rail cards, detail and overview — never blank.
function effectiveLevel(app: { experience_level?: string | null; profiles?: { mun_experience_level?: string | null } | null } | null | undefined): string {
  return app?.experience_level ?? app?.profiles?.mun_experience_level ?? 'beginner';
}

// Age is derived from a date of birth sourced robustly: the application row
// first (if it ever carries one), then the linked profile. Shows whenever a DOB
// exists anywhere.
function ageOf(app: { date_of_birth?: string | null; profiles?: { date_of_birth?: string | null } | null } | null | undefined): number | null {
  const dob = app?.date_of_birth ?? app?.profiles?.date_of_birth ?? null;
  return ageAt(dob);
}

// Committee naming rule: a long full name collapses to an ACRONYM as the big
// primary label, with the full name shown small beneath. Prefer an explicit
// abbreviation; otherwise auto-derive initials from a >4-word name (dropping
// connective stop-words). The subtitle is the full name, shown only when it
// actually differs from the big label.
const ACRONYM_STOP = new Set(['and', 'of', 'the', 'for', 'a', 'an', 'on', 'in', 'to', 'de', 'du', 'des', 'la', 'le']);
function autoAcronym(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .filter(w => !ACRONYM_STOP.has(w.toLowerCase()))
    .map(w => (/[A-Za-z0-9]/.test(w[0]) ? w[0].toUpperCase() : ''))
    .join('');
}
function committeeLabels(c: { name: string; abbreviation: string | null }): { big: string; full: string | null } {
  const name = (c.name ?? '').trim();
  const ab = (c.abbreviation ?? '').trim();
  const words = name.split(/\s+/).filter(Boolean);
  let big = ab;
  if (!big && words.length > 4) big = autoAcronym(name);
  if (!big) big = name;
  const full = big.toLowerCase() !== name.toLowerCase() ? name : null;
  return { big, full };
}

// ── CommitteeDifficultyBadge ────────────────────────────────────────────────────
// The committee's difficulty, as the account rank insignia on a tinted disc plus
// the level word. Sized generously so every tier — the expert crowned star
// especially — reads clearly in the panel header.
function CommitteeDifficultyBadge({ level, disc = 34, glyph = 22, showWord = true }: { level: string; disc?: number; glyph?: number; showWord?: boolean }) {
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
        <span style={{ fontSize: 9.5, fontWeight: 800, color: accent, fontFamily: MONO, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {key || 'beginner'}
        </span>
      )}
    </span>
  );
}

// ── Preference medals ──────────────────────────────────────────────────────────
// A delegate's preference rank is coloured like a podium: 1st = gold,
// 2nd = silver, 3rd = bronze, 4th and beyond a calm muted stone.
type Medal = { fg: string; bg: string; ring: string; label: string };
function prefMedal(order: number): Medal {
  switch (order) {
    case 1: return { fg: '#9A7B1E', bg: 'rgba(238,217,138,0.30)', ring: 'rgba(182,135,31,0.45)', label: 'GOLD' };
    case 2: return { fg: '#6E7278', bg: 'rgba(176,182,188,0.30)', ring: 'rgba(140,146,152,0.5)', label: 'SILVER' };
    case 3: return { fg: '#9A5B2C', bg: 'rgba(184,115,51,0.22)', ring: 'rgba(169,116,60,0.5)', label: 'BRONZE' };
    default: return { fg: NEU.muted, bg: 'rgba(154,138,120,0.16)', ring: 'rgba(154,138,120,0.4)', label: '' };
  }
}

/** Small round medal badge carrying the preference number. */
function PrefRankBadge({ order, size = 18 }: { order: number; size?: number }) {
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

/** A scoring-reason chip. Preference-rank reasons take the podium colours;
 *  everything else reads as a calm positive (green) neu chip. */
function ReasonChip({ reason }: { reason: string }) {
  const medalFor = reason === '1ST CHOICE' ? 1 : reason === '2ND CHOICE' ? 2 : reason === '3RD CHOICE' ? 3 : 0;
  const m = medalFor ? prefMedal(medalFor) : null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full"
      style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', fontFamily: MONO,
        backgroundColor: m ? m.bg : 'rgba(61,122,82,0.12)',
        color: m ? m.fg : NEU.green,
        boxShadow: NEU.outSm,
      }}
    >
      {reason}
    </span>
  );
}

// ── PointsInfo ───────────────────────────────────────────────────────────────
// Hover-only neumorphic info affordance next to "Suggested Assignments". The
// copy mirrors the real scoring in scorePrefAndExp + scoreSlot exactly.
function PointsInfo() {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLSpanElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const WIDTH = 300;

  // The suggestions surface clips an in-flow absolute tooltip, so render it in a
  // Portal at fixed viewport coords computed from the trigger, clamped to the
  // viewport and flipped above when there is not enough room below.
  const place = useCallback(() => {
    const b = btnRef.current;
    if (!b) return;
    const r = b.getBoundingClientRect();
    const vw = window.innerWidth;
    let left = r.left + r.width / 2 - WIDTH / 2;
    if (left + WIDTH > vw - 10) left = vw - 10 - WIDTH;
    if (left < 10) left = 10;
    const flipUp = r.bottom + 8 + 260 > window.innerHeight - 10 && r.top - 8 - 260 > 10;
    setPos({ top: flipUp ? r.top - 8 : r.bottom + 8, left });
  }, []);

  const show = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); };
  const scheduleHide = () => { closeTimer.current = setTimeout(() => setOpen(false), 140); };

  useEffect(() => {
    if (!open) return;
    place();
    const handler = () => place();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
      window.removeEventListener('scroll', handler, true);
      window.removeEventListener('resize', handler);
    };
  }, [open, place]);

  const row = (head: string, body: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span style={{ fontFamily: OUTFIT, fontSize: 11.5, fontWeight: 800, color: NEU.forest }}>{head}</span>
      <span style={{ fontFamily: OUTFIT, fontSize: 11, color: NEU.muted, lineHeight: 1.4 }}>{body}</span>
    </div>
  );

  return (
    <span
      ref={btnRef}
      className="inline-flex items-center justify-center"
      style={{
        width: 18, height: 18, borderRadius: 999,
        backgroundColor: NEU.surface, boxShadow: open ? NEU.outSmHover : NEU.outSm,
        color: NEU.deepGold, cursor: 'help',
        transition: `box-shadow 200ms cubic-bezier(0.22,1,0.36,1)`,
      }}
      tabIndex={0}
      onMouseEnter={show}
      onMouseLeave={scheduleHide}
      onFocus={show}
      onBlur={() => setOpen(false)}
      aria-label="How suggestion scores are calculated"
    >
      <Info size={11} strokeWidth={2.6} />
      {open && pos && (
        <Portal>
          <span
            role="tooltip"
            onMouseEnter={show}
            onMouseLeave={scheduleHide}
            style={{
              position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999,
              width: WIDTH, padding: 14, borderRadius: 16,
              backgroundColor: NEU.surface, boxShadow: `${NEU.out}, 0 14px 34px rgba(27,56,40,0.16)`,
              display: 'flex', flexDirection: 'column', gap: 9,
              textAlign: 'left', cursor: 'default',
            }}
          >
            <span style={{ fontFamily: OUTFIT, fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: NEU.deepGold }}>
              HOW THE FIT SCORE IS BUILT
            </span>
            {row('Committee preference  +50 / +30 / +15', 'Their 1st choice committee scores 50, 2nd choice 30, 3rd choice 15.')}
            {row('Exact country pick  +25', 'Added when the open seat is the exact country they asked for in that preference.')}
            {row('Experience fit  up to +15', 'Full 15 when their level matches the committee difficulty, minus 6 for each level of gap, floored at 0.')}
            {row('Committee fill  up to +12', 'Emptier committees score higher (12 x share still open), nudging suggestions to where seats are needed.')}
            {row('Seat importance  up to +18', 'An open high-importance seat adds 18, medium 10, low 4, standard 0, so higher-priority seats fill first and delegates with no preferences still slot into where they are most needed.')}
            <span style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, lineHeight: 1.4, paddingTop: 2, borderTop: `1px solid ${NEU.base}` }}>
              Seat importance also orders the seats inside a committee overview, most urgent first.
            </span>
          </span>
        </Portal>
      )}
    </span>
  );
}

// ── Left-rail chrome ───────────────────────────────────────────────────────────
/** "UNASSIGNED [n]   DRAG ONTO A COMMITTEE" header for both board rails. */
function RailHeader({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p style={{ fontSize: 11, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 800 }}>
        UNASSIGNED
      </p>
      <span
        className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full"
        style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm, color: NEU.forest, fontFamily: MONO, fontWeight: 800, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}
      >
        {count}
      </span>
      <span style={{ fontSize: 10, color: NEU.muted, fontFamily: MONO, marginLeft: 'auto', letterSpacing: '0.06em' }}>
        DRAG ONTO A COMMITTEE
      </span>
    </div>
  );
}

/** Pressed-in search field for the board rails. */
function RailSearch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <NeuInset className="flex items-center gap-2 px-3.5 py-2.5 mb-3" style={{ borderRadius: 999 }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search applicants..."
        className="flex-1 text-sm outline-none"
        style={{ backgroundColor: 'transparent', color: NEU.ink, fontFamily: OUTFIT }}
      />
    </NeuInset>
  );
}

// Single write path for every allocation on this page: insert into
// conference_allocations (incl. conference_id), friendly duplicate errors,
// then round-trip the application status to 'assigned'.
// Returns an error message, or null on success.
async function insertAllocation(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  committee: CommitteeData,
  app: AcceptedApp,
  slot: SlotRow,
): Promise<string | null> {
  const userId = app.profiles?.id;
  if (!userId) return 'Applicant profile not found.';

  const { error: insertErr } = await supabase.from('conference_allocations').insert({
    conference_id: conferenceId,
    conference_committee_id: committee.id,
    user_id: userId,
    country_code: slot.country_code,
    country_name: slot.country_name,
    application_id: app.id,
    allocation_sent: false,
  });
  if (insertErr) {
    if (insertErr.code === '23505') {
      return insertErr.message.includes('user_id')
        ? 'This delegate already has an allocation in this committee.'
        : insertErr.message.includes('country_code')
        ? 'This country is already allocated to another delegate.'
        : 'This allocation already exists.';
    }
    return insertErr.message;
  }

  await supabase.from('applications').update({
    status: 'assigned',
    assigned_committee_id: committee.id,
    assigned_country_code: slot.country_code,
    assigned_country_name: slot.country_name,
  }).eq('id', app.id);

  return null;
}

// ── Importance dashes ──────────────────────────────────────────────────────────
// The canonical committee-setup indicator (ConferenceRosterPicker): a stack of
// vertical bars whose count AND colour encode the tier — 1 grey / 2 green /
// 3 yellow / 4 red. Replaces the old HIGH/MED/LOW/STD word chips everywhere.
function ImportanceDashes({ tier, barHeight = 11 }: { tier: ImportanceTier; barHeight?: number }) {
  const meta = TIER_META[tier];
  return (
    <span className="inline-flex items-end" style={{ gap: 2 }} aria-hidden>
      {Array.from({ length: meta.dashes }).map((_, i) => (
        <span key={i} style={{ width: 2, height: barHeight, borderRadius: 1, backgroundColor: meta.color, display: 'inline-block' }} />
      ))}
    </span>
  );
}

function TierBadge({ tier, onCycle }: { tier: ImportanceTier; onCycle?: () => void }) {
  const meta = TIER_META[tier];
  return (
    <button
      onClick={e => { e.stopPropagation(); onCycle?.(); }}
      title={`Country importance: ${meta.label}.${onCycle ? ' Click to cycle: standard, low, medium, high.' : ''}`}
      aria-label={`Importance: ${meta.label}`}
      className="focus:outline-none inline-flex items-center"
      style={{
        padding: '4px 8px',
        borderRadius: 8,
        backgroundColor: NEU.surface,
        boxShadow: NEU.outSm,
        cursor: onCycle ? 'pointer' : 'default',
      }}
    >
      <ImportanceDashes tier={tier} />
    </button>
  );
}

// ── LevelTag ───────────────────────────────────────────────────────────────────
// A delegate's MUN level as the account chevron insignia (on its tinted disc)
// plus the level word, for the unassigned rail. Nothing renders without a level.
function LevelTag({ level }: { level: string | null | undefined }) {
  // No recorded level → treat as the lowest tier ('beginner'), never blank.
  const lvl = level && level.trim() ? level : 'beginner';
  const accent = LEVEL_ACCENT[lvl.toLowerCase()] ?? '#9A8A78';
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm }}
    >
      <span
        className="inline-flex items-center justify-center flex-shrink-0"
        style={{ width: 16, height: 16, borderRadius: 9999, background: `linear-gradient(150deg, ${accent}22, ${accent}12)`, border: `1px solid ${accent}55` }}
      >
        <LevelInsignia level={lvl} size={11} />
      </span>
      <span style={{ fontSize: 10, fontWeight: 800, color: accent, fontFamily: MONO, letterSpacing: '0.04em' }}>
        {lvl.toUpperCase()}
      </span>
    </span>
  );
}

function DelegationChip({ app }: { app: AcceptedApp }) {
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
        className="truncate"
        style={{ fontSize: 10, fontWeight: 700, fontFamily: MONO, letterSpacing: '0.04em' }}
      >
        {label}
      </span>
    </span>
  );
}

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // Portal'd so the dim backdrop escapes the manage layout's `relative z-10`
  // content wrapper and covers the header/sidebar too.
  return (
    <Portal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
        onClick={onClose}
      >
        <div onClick={e => e.stopPropagation()}>{children}</div>
      </div>
    </Portal>
  );
}

/** The extruded ivory card every assignment modal sits in. */
function NeuModalCard({ children, width = 480 }: { children: React.ReactNode; width?: number }) {
  return (
    <div
      className="p-6"
      style={{
        width: `min(92vw, ${width}px)`,
        backgroundColor: NEU.surface,
        borderRadius: 24,
        maxHeight: '88vh',
        overflowY: 'auto',
        boxShadow: `${NEU.out}, 0 24px 60px rgba(27,56,40,0.28)`,
      }}
    >
      {children}
    </div>
  );
}

/** Pressed-in error strip, consistent across the modals. */
function ModalError({ msg }: { msg: string }) {
  return (
    <NeuInset small className="text-xs mb-3 px-3 py-2" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
      {msg}
    </NeuInset>
  );
}

// ── Delegate detail panel ─────────────────────────────────────────────────────

function DelegateDetail({ app, history }: { app: AcceptedApp; history: UserHistory | undefined }) {
  const nationality = app.profiles?.nationality ?? null;
  const natCountry = nationality ? getCountryByName(nationality) : undefined;
  const exp = effectiveLevel(app);
  const age = ageOf(app);

  const stat = (label: string, value: React.ReactNode) => (
    <NeuInset small className="flex-1 min-w-0 px-2.5 py-2">
      <p style={{ fontSize: 10, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 700 }}>{label}</p>
      <p className="truncate" style={{ fontSize: 13, fontWeight: 800, color: NEU.ink, fontFamily: MONO, marginTop: 2 }}>{value}</p>
    </NeuInset>
  );

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
        <span className="truncate min-w-0" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, marginLeft: 'auto' }}>
          {app.profiles?.email}
        </span>
      </div>

      {/* Stats */}
      <div className="flex gap-2 mb-2.5">
        {stat('EXPERIENCE', (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-flex items-center justify-center flex-shrink-0"
              style={{
                width: 18, height: 18, borderRadius: 9999,
                background: `linear-gradient(150deg, ${LEVEL_ACCENT[exp.toLowerCase()] ?? '#9A8A78'}22, ${LEVEL_ACCENT[exp.toLowerCase()] ?? '#9A8A78'}12)`,
                border: `1px solid ${LEVEL_ACCENT[exp.toLowerCase()] ?? '#9A8A78'}55`,
              }}
            >
              <LevelInsignia level={exp} size={12} />
            </span>
            {exp.toUpperCase()}
          </span>
        ))}
        {stat('CONFERENCES', history?.conferences ?? 0)}
        {stat('AWARDS', history?.awards ?? 0)}
      </div>

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

      {/* Full preference list */}
      {(app.application_preferences ?? []).length > 0 && (
        <div>
          <p style={{ fontSize: 10, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 5 }}>PREFERENCES</p>
          <div className="flex flex-col gap-1">
            {[...(app.application_preferences ?? [])]
              .sort((a, b) => a.preference_order - b.preference_order)
              .map(p => (
                <div key={p.preference_order} className="flex items-center gap-2 min-w-0">
                  <PrefRankBadge order={p.preference_order} />
                  <CountryFlag code={p.country_code} w={18} h={13} radius={2} alt={p.country_name} />
                  <span className="truncate flex-1 min-w-0" style={{ fontSize: 12, color: NEU.ink, fontFamily: OUTFIT }}>
                    {p.conference_committees?.name ?? 'Unknown'} · {p.country_name}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── DropAllocateModal ─────────────────────────────────────────────────────────
// Opens when an applicant is dropped on (or click-targeted at) a committee.
// Lists that committee's OPEN slots, most urgent first: importance tier order
// high > medium > low > standard, then suggestion score for this applicant.

interface DropAllocateModalProps {
  committee: CommitteeData;
  app: AcceptedApp;
  onClose: () => void;
  onAssigned: (slot: SlotRow, msg: string) => void;
}

function DropAllocateModal({ committee, app, onClose, onAssigned }: DropAllocateModalProps) {
  const { session } = useAuth();
  const { conference } = useManage();
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const allocatedCodes = new Set(committee.conference_allocations.map(a => a.country_code));
  const filled = committee.conference_allocations.length;
  const rows = committee.committee_country_slots
    .filter(s => !allocatedCodes.has(s.country_code))
    .map(slot => ({ slot, ...scoreSlot(app, committee, slot, filled, committee.total_slots) }))
    .sort((a, b) =>
      TIER_RANK[a.slot.importance] - TIER_RANK[b.slot.importance] || b.score - a.score
    );

  async function handleAllocate(slot: SlotRow) {
    if (!session) return;
    if (!conference) { setError('Conference not loaded. Please refresh.'); return; }
    setBusySlotId(slot.id);
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const err = await insertAllocation(supabase, conference.id, committee, app, slot);
    setBusySlotId(null);
    if (err) { setError(err); return; }
    onAssigned(slot, `${app.profiles?.display_name ?? app.invited_name} allocated to ${slot.country_name} in ${committee.abbreviation ?? committee.name}.`);
    onClose();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <NeuModalCard width={560}>
        <div className="flex items-start justify-between mb-1">
          <div className="min-w-0">
            <p style={{ fontSize: 9, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 700, marginBottom: 6 }}>
              ALLOCATE
            </p>
            <h2 className="font-black text-base flex items-center gap-2 flex-wrap" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
              <PersonAvatar name={app.profiles?.display_name ?? app.invited_name ?? 'Unknown'} url={app.profiles?.avatar_url ?? null} size={28} />
              <span>{app.profiles?.display_name ?? app.invited_name}</span>
              <ArrowRight size={14} style={{ color: NEU.muted }} />
              <LogoDisc bare src={committee.logo_url} size={30} fallbackText={committeeLabels(committee).big} alt={committee.name} />
              <span>{committeeLabels(committee).big}</span>
            </h2>
          </div>
          <button onClick={onClose} className="focus:outline-none flex-shrink-0 mt-1" style={{ color: NEU.muted }}><X size={18} /></button>
        </div>
        <p className="text-xs mb-4" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
          Open seats, most urgent first: importance tier, then fit for this delegate.
        </p>

        {error && <ModalError msg={error} />}

        {rows.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            All seats in this committee are filled.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map(({ slot, score, reasons }) => {
              const busy = busySlotId === slot.id;
              return (
                <NeuInset key={slot.id} small className="flex items-center gap-3 px-3 py-2.5">
                  <CountryFlag code={slot.country_code} w={24} h={17} radius={3} shadow={FLAG_SHADOW} alt={slot.country_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{slot.country_name}</p>
                      <TierBadge tier={slot.importance} />
                    </div>
                    {reasons.length > 0 && (
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {reasons.slice(0, 3).map(r => <ReasonChip key={r} reason={r} />)}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: fitColor(score), fontFamily: MONO, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
                  <NeuButton
                    onClick={() => handleAllocate(slot)}
                    disabled={busySlotId !== null}
                    style={{ padding: '8px 16px', fontSize: 11 }}
                  >
                    {busy ? '...' : 'ALLOCATE'}
                  </NeuButton>
                </NeuInset>
              );
            })}
          </div>
        )}
      </NeuModalCard>
    </ModalOverlay>
  );
}

// ── AssignModal ───────────────────────────────────────────────────────────────
// Kept for the slot-first path: pick a specific open country, then choose the
// applicant (with fit scores). Reached from a panel's expanded slot list.

interface AssignModalProps {
  committee: CommitteeData;
  unassigned: AcceptedApp[];
  preSelectedSlot?: SlotRow;
  preSelectedApp?: AcceptedApp;
  onClose: () => void;
  onAssigned: (app: AcceptedApp, slot: SlotRow, sentEmail: boolean) => void;
}

function AssignModal({ committee, unassigned, preSelectedSlot, preSelectedApp, onClose, onAssigned }: AssignModalProps) {
  const { session } = useAuth();
  const { conference } = useManage();
  const [selectedApp, setSelectedApp] = useState<AcceptedApp | null>(preSelectedApp ?? null);
  const [selectedSlot, setSelectedSlot] = useState<SlotRow | null>(preSelectedSlot ?? null);
  const [sendEmail, setSendEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Empty slots = slots with no allocation
  const allocatedCodes = new Set(committee.conference_allocations.map(a => a.country_code));
  const emptySlots = committee.committee_country_slots.filter(s => !allocatedCodes.has(s.country_code));
  const filled = committee.conference_allocations.length;

  // Sort unassigned by score against the selected slot (or committee-level score)
  const scored = unassigned.map(app => ({
    app,
    score: selectedSlot
      ? scoreSlot(app, committee, selectedSlot, filled, committee.total_slots).score
      : scorePrefAndExp(app, committee, null).score,
  }));
  scored.sort((a, b) => b.score - a.score);

  async function handleAssign() {
    if (!selectedApp || !selectedSlot) { setError('Select an applicant and a country.'); return; }
    const userId = selectedApp.profiles?.id;
    if (!userId) { setError('Applicant profile not found.'); return; }
    setSaving(true);
    setError('');
    if (!session) return;
    if (!conference) { setError('Conference not loaded. Please refresh.'); setSaving(false); return; }
    const supabase = getAuthedClient(session.access_token);

    const insertErr = await insertAllocation(supabase, conference.id, committee, selectedApp, selectedSlot);
    if (insertErr) {
      setError(insertErr);
      setSaving(false);
      return;
    }

    if (sendEmail) {
      await supabase
        .from('conference_allocations')
        .update({ allocation_sent: true, allocation_sent_at: new Date().toISOString() })
        .eq('conference_committee_id', committee.id)
        .eq('user_id', userId);
    }

    setSaving(false);
    onAssigned(selectedApp, selectedSlot, sendEmail);
    onClose();
  }

  const appScore = selectedApp ? scorePrefAndExp(selectedApp, committee, selectedSlot).score : null;
  const appPrefs = selectedApp
    ? [...(selectedApp.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order)
    : [];

  return (
    <ModalOverlay onClose={onClose}>
      <NeuModalCard width={460}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-base" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Assign Delegate
          </h2>
          <button onClick={onClose} className="focus:outline-none" style={{ color: NEU.muted }}><X size={18} /></button>
        </div>

        <div className="flex items-center gap-2.5 mb-4">
          <LogoDisc bare src={committee.logo_url} size={40} fallbackText={committeeLabels(committee).big} alt={committee.name} />
          <div className="min-w-0">
            <p style={{ fontSize: 18, fontWeight: 900, color: NEU.forest, fontFamily: OUTFIT, letterSpacing: '0.01em' }}>
              {committeeLabels(committee).big}
            </p>
            {committeeLabels(committee).full && (
              <p className="truncate" style={{ fontSize: 11.5, color: NEU.muted, fontFamily: OUTFIT }}>{committeeLabels(committee).full}</p>
            )}
          </div>
        </div>

        {/* Applicant picker (if not pre-selected) */}
        <div className="mb-4">
          <p className="mb-2" style={{ color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontSize: 10, fontWeight: 700 }}>APPLICANT</p>
          {preSelectedApp ? (
            <NeuInset small className="flex items-center gap-3 p-3">
              <PersonAvatar name={preSelectedApp.profiles?.display_name ?? preSelectedApp.invited_name ?? 'Unknown'} url={preSelectedApp.profiles?.avatar_url ?? null} size={34} />
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{preSelectedApp.profiles?.display_name ?? preSelectedApp.invited_name}</p>
                <p className="text-xs mt-0.5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{preSelectedApp.role} · {effectiveLevel(preSelectedApp)}</p>
              </div>
            </NeuInset>
          ) : (
            <NeuInset small style={{ maxHeight: 200, overflowY: 'auto', padding: 5 }}>
              {scored.length === 0 ? (
                <p className="text-sm p-3" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No unassigned applicants.</p>
              ) : scored.map(({ app, score }, idx) => {
                const selected = selectedApp?.id === app.id;
                return (
                  <div
                    key={app.id}
                    className="flex items-center gap-3 px-2.5 py-2 rounded-xl transition-colors"
                    style={{
                      backgroundColor: selected ? NEU.surface : 'transparent',
                      boxShadow: selected ? NEU.outSm : 'none',
                      cursor: 'pointer',
                    }}
                    onClick={() => setSelectedApp(app)}
                  >
                    <PersonAvatar name={app.profiles?.display_name ?? app.invited_name ?? 'Unknown'} url={app.profiles?.avatar_url ?? null} size={30} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{app.profiles?.display_name ?? app.invited_name}</p>
                      <p className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>{app.role} · {effectiveLevel(app)}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {idx === 0 && score >= 20 && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.04em' }}>BEST</span>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 800, color: fitColor(score), fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>{score}</span>
                    </div>
                  </div>
                );
              })}
            </NeuInset>
          )}
        </div>

        {/* Show selected applicant preferences */}
        {selectedApp && appPrefs.length > 0 && (
          <div className="mb-4">
            <p className="mb-1.5" style={{ color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontSize: 10, fontWeight: 700 }}>PREFERENCES</p>
            <div className="flex flex-col gap-1.5">
              {appPrefs.slice(0, 3).map(p => {
                const here = p.conference_committee_id === committee.id;
                return (
                  <div key={p.preference_order} className="flex items-center gap-2">
                    <PrefRankBadge order={p.preference_order} />
                    <span className="text-xs truncate" style={{ color: here ? NEU.forest : NEU.muted, fontWeight: here ? 700 : 400, fontFamily: OUTFIT }}>
                      {p.conference_committees?.name ?? 'Unknown'} · {p.country_name}
                    </span>
                  </div>
                );
              })}
            </div>
            {appScore !== null && (
              <p className="text-xs mt-2 font-bold" style={{ color: fitColor(appScore), fontFamily: MONO }}>
                FIT SCORE: {appScore}
              </p>
            )}
          </div>
        )}

        {/* Country picker */}
        <div className="mb-5">
          <p className="mb-2" style={{ color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontSize: 10, fontWeight: 700 }}>COUNTRY</p>
          {preSelectedSlot ? (
            <NeuInset small className="flex items-center gap-3 p-3">
              <CountryFlag code={preSelectedSlot.country_code} w={24} h={17} radius={3} alt={preSelectedSlot.country_name} />
              <p className="text-sm font-semibold" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{preSelectedSlot.country_name}</p>
              <div style={{ marginLeft: 'auto' }}><TierBadge tier={preSelectedSlot.importance} /></div>
            </NeuInset>
          ) : (
            <NeuInset small style={{ maxHeight: 160, overflowY: 'auto', padding: 5 }}>
              {emptySlots.length === 0 ? (
                <p className="text-sm p-3" style={{ color: NEU.muted, fontFamily: OUTFIT }}>All seats filled.</p>
              ) : emptySlots.map(slot => {
                const selected = selectedSlot?.id === slot.id;
                return (
                  <div
                    key={slot.id}
                    className="flex items-center gap-3 px-2.5 py-2 rounded-xl cursor-pointer transition-colors"
                    style={{ backgroundColor: selected ? NEU.surface : 'transparent', boxShadow: selected ? NEU.outSm : 'none' }}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    <CountryFlag code={slot.country_code} w={20} h={14} radius={2} alt={slot.country_name} />
                    <p className="text-sm" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{slot.country_name}</p>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TierBadge tier={slot.importance} />
                      {selected && <Check size={13} style={{ color: NEU.green }} />}
                    </div>
                  </div>
                );
              })}
            </NeuInset>
          )}
        </div>

        {/* Send email toggle */}
        <label className="flex items-center gap-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={sendEmail}
            onChange={e => setSendEmail(e.target.checked)}
            className="rounded"
            style={{ accentColor: NEU.forest, width: 16, height: 16 }}
          />
          <span className="text-xs" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            Send allocation email immediately after assigning
          </span>
        </label>

        {error && <ModalError msg={error} />}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-full py-2.5 font-bold text-sm focus:outline-none" style={{ border: 'none', color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontFamily: OUTFIT, letterSpacing: '0.04em' }}>
            CANCEL
          </button>
          <NeuButton
            onClick={handleAssign}
            disabled={saving || !selectedApp || !selectedSlot}
            style={{ flex: 1, padding: '11px 22px' }}
          >
            {saving ? 'ASSIGNING...' : 'ASSIGN'}
          </NeuButton>
        </div>
      </NeuModalCard>
    </ModalOverlay>
  );
}

// ── CommitteeBoardPanel ───────────────────────────────────────────────────────
// One compact panel per committee, all committees visible at once. Acts as a
// drag-and-drop target for applicant cards and a click target when an
// applicant is selected.

interface CommitteeBoardPanelProps {
  committee: CommitteeData;
  dragging: boolean;
  isDropTarget: boolean;
  selectable: boolean;
  onDragOverPanel: () => void;
  onDragLeavePanel: () => void;
  onDropPanel: (appId: string) => void;
  onClickPanel: () => void;
  onRemoveAllocation: (a: AllocationRow) => void;
  onOpenOverview: () => void;
}

/** One neu open-seat tier chip: the vertical-dash importance indicator + the
 *  open count for that tier (no words). */
function OpenTierChip({ tier, count, onClick }: { tier: ImportanceTier; count: number; onClick?: () => void }) {
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

// ── CountrySlotGrid ─────────────────────────────────────────────────────────────
// The at-a-glance committee overview: every country slot as a circular flag,
// never any country-name text. Ordered by IMPORTANCE tier first (high before
// medium before low before standard), then alphabetically within a tier. An
// allocated country shows its delegate's name beside the flag; an unallocated
// one shows just the (dimmed) flag. Filled vs open therefore reads instantly.
// Optional callbacks make the modal copy interactive (click an empty flag to
// assign, hover an allocated one to deallocate); the panel copy passes none.
function CountrySlotGrid({
  committee, flagSize = 28, maxHeight, onAssignSlot, onRemoveAllocation,
}: {
  committee: CommitteeData;
  flagSize?: number;
  maxHeight?: number;
  onAssignSlot?: (slot: SlotRow) => void;
  onRemoveAllocation?: (a: AllocationRow) => void;
}) {
  const allocByCode = new Map(committee.conference_allocations.map(a => [a.country_code, a]));
  const slots = [...committee.committee_country_slots].sort(
    (a, b) => TIER_RANK[a.importance] - TIER_RANK[b.importance] || a.country_name.localeCompare(b.country_name)
  );
  if (slots.length === 0) {
    return <p className="text-xs py-1" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No country slots in this committee.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      {slots.map(slot => {
        const alloc = allocByCode.get(slot.country_code) ?? null;
        const flag = (
          <CountryFlag
            code={slot.country_code}
            w={flagSize}
            h={flagSize}
            radius={9999}
            shadow={FLAG_SHADOW}
            dim={alloc ? undefined : 0.42}
            alt={slot.country_name}
            title={slot.country_name}
          />
        );
        if (alloc) {
          const name = alloc.profiles?.display_name ?? alloc.applications?.invited_name ?? 'Assigned';
          const removable = !!onRemoveAllocation && !alloc.id.startsWith('temp-');
          return (
            <span
              key={slot.id}
              className="inline-flex items-center gap-1.5 rounded-full"
              style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm, padding: 2, paddingRight: removable ? 4 : 9 }}
            >
              {flag}
              <span className="truncate" style={{ fontSize: 12, fontWeight: 700, color: NEU.ink, fontFamily: OUTFIT, maxWidth: 120 }}>
                {name}
              </span>
              {removable && (
                <button
                  onClick={e => { e.stopPropagation(); onRemoveAllocation!(alloc); }}
                  title={`Deallocate ${name}`}
                  className="focus:outline-none flex-shrink-0"
                  style={{ color: NEU.muted, lineHeight: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          );
        }
        if (onAssignSlot) {
          return (
            <button
              key={slot.id}
              onClick={e => { e.stopPropagation(); onAssignSlot(slot); }}
              title={`Assign ${slot.country_name}`}
              className="focus:outline-none"
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', lineHeight: 0, borderRadius: 9999 }}
            >
              {flag}
            </button>
          );
        }
        return <span key={slot.id} style={{ lineHeight: 0 }}>{flag}</span>;
      })}
    </div>
  );
}

function CommitteeBoardPanel({
  committee, dragging, isDropTarget, selectable,
  onDragOverPanel, onDragLeavePanel, onDropPanel, onClickPanel,
  onRemoveAllocation, onOpenOverview,
}: CommitteeBoardPanelProps) {
  const filled = committee.conference_allocations.length;
  const total = committee.total_slots;
  const primed = dragging || selectable;
  const labels = committeeLabels(committee);

  return (
    <div
      onDragOver={e => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverPanel();
      }}
      onDragLeave={e => {
        if (dragging && !e.currentTarget.contains(e.relatedTarget as Node | null)) onDragLeavePanel();
      }}
      onDrop={e => {
        e.preventDefault();
        onDropPanel(e.dataTransfer.getData('text/plain'));
      }}
      onClick={() => { if (selectable) onClickPanel(); else onOpenOverview(); }}
      className="p-4 flex flex-col"
      style={{
        backgroundColor: NEU.surface,
        borderRadius: 22,
        boxShadow: isDropTarget
          ? `0 0 0 2px ${NEU.forest}, ${NEU.outHover}`
          : primed
          ? `0 0 0 1.5px ${NEU.deepGold}66, ${NEU.out}`
          : NEU.out,
        transform: isDropTarget ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 220ms cubic-bezier(0.22,1,0.36,1), transform 220ms cubic-bezier(0.22,1,0.36,1)`,
        cursor: 'pointer',
      }}
    >
      {/* Header: big free-floating logo + strong acronym + fill count. Clicking
          anywhere on the panel opens the committee overview (or assigns the
          selected delegate when one is picked). */}
      <div
        role="button"
        tabIndex={0}
        onClick={e => { e.stopPropagation(); if (selectable) onClickPanel(); else onOpenOverview(); }}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (selectable) onClickPanel(); else onOpenOverview(); } }}
        className="flex items-center gap-3 focus:outline-none"
        style={{ cursor: 'pointer' }}
        title="Open committee overview"
      >
        <LogoDisc bare src={committee.logo_url} size={54} fallbackText={labels.big} alt={committee.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontSize: 22, fontWeight: 900, color: NEU.forest, fontFamily: OUTFIT, letterSpacing: '0.01em', lineHeight: 1.05 }}>
            {labels.big}
          </p>
          {labels.full && (
            <p className="truncate" style={{ fontSize: 11.5, color: NEU.muted, fontFamily: OUTFIT, marginTop: 1 }}>{labels.full}</p>
          )}
        </div>
        <span className="flex-shrink-0" style={{ fontSize: 15, fontWeight: 900, color: NEU.ink, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
          {filled}<span style={{ color: NEU.muted, fontWeight: 600 }}>/{total}</span>
        </span>
        {/* Committee difficulty — rank insignia on a tinted disc + word, sized
            for legibility (the expert crowned star especially). */}
        <CommitteeDifficultyBadge level={committee.difficulty} disc={34} glyph={22} showWord={false} />
      </div>

      {/* Fill bar */}
      <div className="mt-3">
        <NeuProgress value={filled} max={total} height={7} gradient={filled >= total ? NEU_GRADIENTS.green : NEU_GRADIENTS.forest} />
      </div>

      {/* At-a-glance allocation overview: every country slot as a circular flag,
          ordered by importance then alphabetical; allocated flags carry their
          delegate's name (with deallocate). Click the panel to open the full
          committee overview. */}
      <div className="mt-3.5">
        <p style={{ fontSize: 10, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 7 }}>ALLOCATION OVERVIEW</p>
        <CountrySlotGrid committee={committee} flagSize={24} maxHeight={210} onRemoveAllocation={onRemoveAllocation} />
      </div>

    </div>
  );
}

// ── RowMenu ─────────────────────────────────────────────────────────────────
// A portaled, edge-flipped action dropdown for one overview list row. Rendered
// in a Portal at fixed viewport coords computed from the trigger and flipped
// above / against the right edge so the modal's own overflow never clips it.
function RowMenu({ items }: { items: { label: string; icon: React.ReactNode; danger?: boolean; onClick: () => void }[] }) {
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
    place();
    const handler = () => place();
    window.addEventListener('scroll', handler, true);
    window.addEventListener('resize', handler);
    return () => {
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
function CommitteeOverviewModal({
  committee, history, onClose, onRemoveAllocation, onAssignSlot, onChangeAllocation,
}: {
  committee: CommitteeData;
  history: Record<string, UserHistory>;
  onClose: () => void;
  onRemoveAllocation: (a: AllocationRow) => void;
  onAssignSlot: (slot: SlotRow) => void;
  onChangeAllocation: (a: AllocationRow, slot: SlotRow) => void;
}) {
  const [expandedSeatId, setExpandedSeatId] = useState<string | null>(null);
  const filled = committee.conference_allocations.length;
  const total = committee.total_slots;
  const labels = committeeLabels(committee);
  const allocByCode = new Map(committee.conference_allocations.map(a => [a.country_code, a]));
  const openSlots = committee.committee_country_slots.filter(s => !allocByCode.has(s.country_code));
  const openTierCounts: Record<ImportanceTier, number> = { high: 0, medium: 0, low: 0, standard: 0 };
  for (const s of openSlots) openTierCounts[s.importance] += 1;
  // Always alphabetical by country/character name.
  // Ordered by importance tier first (high first), then alphabetical within tier.
  const slots = [...committee.committee_country_slots].sort(
    (a, b) => TIER_RANK[a.importance] - TIER_RANK[b.importance] || a.country_name.localeCompare(b.country_name)
  );

  return (
    <ModalOverlay onClose={onClose}>
      <NeuModalCard width={620}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <LogoDisc bare src={committee.logo_url} size={54} fallbackText={labels.big} alt={committee.name} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <h2 className="truncate" style={{ fontSize: 24, fontWeight: 900, color: NEU.forest, fontFamily: OUTFIT, letterSpacing: '0.01em', lineHeight: 1.05 }}>
                  {labels.big}
                </h2>
                <CommitteeDifficultyBadge level={committee.difficulty} disc={30} glyph={20} />
              </div>
              {labels.full && (
                <p className="truncate" style={{ fontSize: 12, color: NEU.muted, fontFamily: OUTFIT, marginTop: 1 }}>{labels.full}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="focus:outline-none flex-shrink-0 mt-1" style={{ color: NEU.muted }}><X size={18} /></button>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span style={{ fontSize: 11, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 700 }}>SEATS FILLED</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: NEU.ink, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
              {filled}<span style={{ color: NEU.muted, fontWeight: 600 }}>/{total}</span>
            </span>
          </div>
          <NeuProgress value={filled} max={total} height={8} gradient={filled >= total ? NEU_GRADIENTS.green : NEU_GRADIENTS.forest} />
        </div>

        {/* Open-seat importance summary: dash indicator + count, no words. */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {openSlots.length === 0 ? (
            <span className="inline-flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 800, color: NEU.green, fontFamily: MONO, letterSpacing: '0.06em' }}>
              <Check size={12} strokeWidth={3} /> FULLY ALLOCATED
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
          {slots.map(slot => {
            const alloc = allocByCode.get(slot.country_code) ?? null;

            if (!alloc) {
              // Open seat — clicking assigns.
              return (
                <button
                  key={slot.id}
                  onClick={() => { onAssignSlot(slot); onClose(); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 focus:outline-none text-left"
                  style={{ backgroundColor: NEU.base, borderRadius: 14, boxShadow: NEU.inSm }}
                >
                  <CountryFlag code={slot.country_code} w={30} h={30} radius={9999} shadow={FLAG_SHADOW} dim={0.5} alt={slot.country_name} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: NEU.ink, fontFamily: OUTFIT }}>{slot.country_name}</p>
                    <p style={{ fontSize: 10.5, color: NEU.muted, fontFamily: MONO, letterSpacing: '0.06em', marginTop: 1 }}>OPEN SEAT</p>
                  </div>
                  <TierBadge tier={slot.importance} />
                  <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontSize: 10.5, fontWeight: 800, color: NEU.forest, fontFamily: MONO, letterSpacing: '0.04em' }}>
                    <Plus size={12} strokeWidth={2.6} /> ASSIGN
                  </span>
                </button>
              );
            }

            const app = allocationToApp(alloc);
            const name = alloc.profiles?.display_name ?? alloc.applications?.invited_name ?? 'Assigned';
            const age = ageOf(app);
            const userHistory = alloc.user_id ? history[alloc.user_id] : undefined;
            const expanded = expandedSeatId === slot.id;
            const removable = !alloc.id.startsWith('temp-');

            return (
              <div
                key={slot.id}
                className="flex flex-col"
                style={{ backgroundColor: NEU.surface, borderRadius: 14, boxShadow: expanded ? NEU.outSmHover : NEU.outSm }}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedSeatId(expanded ? null : slot.id)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedSeatId(expanded ? null : slot.id); } }}
                  className="flex items-center gap-3 px-3 py-2.5 focus:outline-none"
                  style={{ cursor: 'pointer' }}
                  title="Open application detail"
                >
                  <CountryFlag code={slot.country_code} w={30} h={30} radius={9999} shadow={FLAG_SHADOW} alt={slot.country_name} title={slot.country_name} />
                  <PersonAvatar name={name} url={alloc.profiles?.avatar_url ?? null} size={30} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: 14, fontWeight: 800, color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.15 }}>
                      {name}
                      {age != null && <span style={{ fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>, {age}</span>}
                    </p>
                    <p className="truncate" style={{ fontSize: 11, color: NEU.muted, fontFamily: OUTFIT, marginTop: 1 }}>{slot.country_name}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                    <DelegationChip app={app} />
                    <LevelTag level={effectiveLevel(app)} />
                  </div>
                  <RowMenu
                    items={[
                      { label: 'Change seat', icon: <Repeat size={14} />, onClick: () => onChangeAllocation(alloc, slot) },
                      ...(removable ? [{ label: 'Deallocate', icon: <Trash2 size={14} />, danger: true, onClick: () => onRemoveAllocation(alloc) }] : []),
                    ]}
                  />
                  {expanded ? <ChevronUp size={15} style={{ color: NEU.muted, flexShrink: 0 }} /> : <ChevronDown size={15} style={{ color: NEU.muted, flexShrink: 0 }} />}
                </div>
                {/* Compact delegation/level row for narrow widths */}
                <div className="sm:hidden flex items-center gap-1.5 flex-wrap px-3 pb-2.5">
                  <DelegationChip app={app} />
                  <LevelTag level={effectiveLevel(app)} />
                </div>
                {expanded && (
                  <div className="px-3 pb-3">
                    <DelegateDetail app={app} history={userHistory} />
                  </div>
                )}
              </div>
            );
          })}
          {slots.length === 0 && (
            <p className="text-xs py-2" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No country slots in this committee.</p>
          )}
        </div>
      </NeuModalCard>
    </ModalOverlay>
  );
}

// ── InviteChairModal ──────────────────────────────────────────────────────────

function InviteChairModal({ conferenceId, committee, onClose, onInvited }: {
  conferenceId: string;
  committee: CommitteeData;
  onClose: () => void;
  onInvited: (name: string) => void;
}) {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');

  async function handleInvite() {
    const em = email.trim();
    if (!em || !session) return;
    setInviting(true);
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const result = await sendChairInvite(supabase, {
      conferenceId,
      committeeId: committee.id,
      committeeName: committee.name,
      email: em,
    });
    setInviting(false);
    if (!result.ok) {
      setError(result.error ?? 'Could not invite that chair.');
      return;
    }
    onInvited(result.invitedName ?? em);
  }

  return (
    <ModalOverlay onClose={onClose}>
      <NeuModalCard width={400}>
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoDisc bare src={committee.logo_url} size={34} fallbackText={committeeLabels(committee).big} alt={committee.name} />
            <div className="min-w-0">
              <p style={{ margin: 0, fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', color: NEU.deepGold }}>
                INVITE CHAIR
              </p>
              <p className="font-bold text-[15px] mt-0.5 truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                {committeeLabels(committee).big}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="focus:outline-none flex-shrink-0" style={{ color: NEU.muted }}><X size={18} /></button>
        </div>

        <p className="text-xs mb-3" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.45 }}>
          They must already have a Gavelling account. They&apos;ll get an email to accept before joining this dais.
        </p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
            placeholder="chair@example.com"
            autoFocus
            style={{
              flex: 1, border: 'none', borderRadius: 999, padding: '10px 14px',
              fontSize: 13, color: NEU.ink, backgroundColor: NEU.base, boxShadow: NEU.inSm, outline: 'none',
              fontFamily: OUTFIT,
            }}
          />
          <NeuButton onClick={handleInvite} disabled={inviting || !email.trim()} style={{ padding: '10px 18px', fontSize: 11 }}>
            {inviting ? 'INVITING…' : 'INVITE'}
          </NeuButton>
        </div>
        {error && <div className="mt-2"><ModalError msg={error} /></div>}
      </NeuModalCard>
    </ModalOverlay>
  );
}

// ── ChairBoardPanel ───────────────────────────────────────────────────────────
// Chairs' mirror of CommitteeBoardPanel: same drag/drop + click-to-select
// target semantics, but the payload is a dais (no country slots) plus the
// committee's pending invites.

interface ChairBoardPanelProps {
  committee: CommitteeData;
  invites: PendingChairInvite[];
  dragging: boolean;
  isDropTarget: boolean;
  selectable: boolean;
  onDragOverPanel: () => void;
  onDragLeavePanel: () => void;
  onDropPanel: (chairAppId: string) => void;
  onClickPanel: () => void;
  onRemoveChair: (userId: string, name: string) => void;
  onRevokeInvite: (invite: PendingChairInvite) => void;
  onInvite: () => void;
}

function ChairBoardPanel({
  committee, invites, dragging, isDropTarget, selectable,
  onDragOverPanel, onDragLeavePanel, onDropPanel, onClickPanel,
  onRemoveChair, onRevokeInvite, onInvite,
}: ChairBoardPanelProps) {
  const dais = committee.display_chairs ?? [];
  const chairIds = committee.chair_user_ids ?? [];
  const idAligned = chairIds.length === dais.length;
  const labels = committeeLabels(committee);

  return (
    <div
      onDragOver={e => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOverPanel();
      }}
      onDragLeave={e => {
        if (dragging && !e.currentTarget.contains(e.relatedTarget as Node | null)) onDragLeavePanel();
      }}
      onDrop={e => {
        e.preventDefault();
        onDropPanel(e.dataTransfer.getData('text/plain'));
      }}
      onClick={() => { if (selectable) onClickPanel(); }}
      className="p-4 flex flex-col"
      style={{
        backgroundColor: NEU.surface,
        borderRadius: 22,
        boxShadow: isDropTarget
          ? `0 0 0 2px ${NEU.forest}, ${NEU.outHover}`
          : (dragging || selectable)
          ? `0 0 0 1.5px ${NEU.deepGold}66, ${NEU.out}`
          : NEU.out,
        transform: isDropTarget ? 'translateY(-2px)' : 'translateY(0)',
        transition: `box-shadow 220ms cubic-bezier(0.22,1,0.36,1), transform 220ms cubic-bezier(0.22,1,0.36,1)`,
        cursor: selectable ? 'pointer' : 'default',
      }}
    >
      {/* Header: big free-floating logo + strong acronym */}
      <div className="flex items-center gap-3">
        <LogoDisc bare src={committee.logo_url} size={54} fallbackText={labels.big} alt={committee.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontSize: 22, fontWeight: 900, color: NEU.forest, fontFamily: OUTFIT, letterSpacing: '0.01em', lineHeight: 1.05 }}>
            {labels.big}
          </p>
          {labels.full && (
            <p className="truncate" style={{ fontSize: 11.5, color: NEU.muted, fontFamily: OUTFIT, marginTop: 1 }}>{labels.full}</p>
          )}
        </div>
        <span className="flex items-center gap-1 flex-shrink-0" style={{ fontSize: 13, fontWeight: 900, color: NEU.ink, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
          <Gavel size={13} strokeWidth={2.4} style={{ color: NEU.deepGold }} />
          {chairIds.length}
        </span>
      </div>

      {/* Dais */}
      <div className="mt-3.5">
        <p style={{ fontSize: 10, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 6 }}>DAIS</p>
        {dais.length === 0 ? (
          <p style={{ fontSize: 11, color: NEU.muted, fontFamily: OUTFIT }}>No chairs assigned yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5 pr-0.5">
            {dais.map((ch, i) => {
              const userId = idAligned ? chairIds[i] : undefined;
              return (
                <NeuInset key={`${ch.name}-${i}`} small className="flex items-center gap-2 px-2.5 py-1.5">
                  <PersonAvatar name={ch.name} url={ch.avatar_url} size={24} />
                  <span className="truncate flex-1" style={{ fontSize: 12, color: NEU.ink, fontFamily: OUTFIT, fontWeight: 700 }}>
                    {ch.name}
                  </span>
                  {userId && (
                    <button
                      onClick={e => { e.stopPropagation(); onRemoveChair(userId, ch.name); }}
                      title={`Remove ${ch.name} from the dais`}
                      className="focus:outline-none flex-shrink-0"
                      style={{ color: NEU.muted, lineHeight: 0 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </NeuInset>
              );
            })}
          </div>
        )}
      </div>

      {/* Pending invites */}
      {invites.length > 0 && (
        <div className="mt-3.5">
          <p style={{ fontSize: 10, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 700, marginBottom: 6 }}>PENDING</p>
          <div className="flex flex-col gap-1.5">
            {invites.map(inv => (
              <NeuInset key={inv.id} small className="flex items-center gap-2 px-2.5 py-1.5">
                <span
                  className="px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.06em', fontFamily: MONO, backgroundColor: 'rgba(238,217,138,0.4)', color: '#8A6614' }}
                >
                  INVITED
                </span>
                <span className="truncate flex-1" style={{ fontSize: 12, color: NEU.ink, fontFamily: OUTFIT }}>
                  {inv.profiles?.display_name ?? inv.email}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); onRevokeInvite(inv); }}
                  title="Revoke invite"
                  className="focus:outline-none flex-shrink-0"
                  style={{ color: NEU.muted, lineHeight: 0 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#8B2020'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = NEU.muted; }}
                >
                  <X size={12} />
                </button>
              </NeuInset>
            ))}
          </div>
        </div>
      )}

      {/* Invite */}
      <button
        onClick={e => { e.stopPropagation(); onInvite(); }}
        className="mt-3.5 rounded-full py-2 text-xs font-bold focus:outline-none flex items-center justify-center gap-1.5"
        style={{ color: NEU.forest, backgroundColor: NEU.surface, boxShadow: NEU.outSm, border: 'none', fontFamily: OUTFIT, letterSpacing: '0.06em', cursor: 'pointer' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
      >
        <Plus size={12} strokeWidth={2.6} /> INVITE CHAIR
      </button>
    </div>
  );
}

// ── AssignmentPage ────────────────────────────────────────────────────────────

export default function AssignmentPage() {
  const { conference } = useManage();
  const { session, loading: authLoading } = useAuth();
  const [accepted, setAccepted] = useState<AcceptedApp[]>([]);
  const [committees, setCommittees] = useState<CommitteeData[]>([]);
  const [chairApps, setChairApps] = useState<ChairApp[]>([]);
  const [chairInvites, setChairInvites] = useState<PendingChairInvite[]>([]);
  const [history, setHistory] = useState<Record<string, UserHistory>>({});
  const [mode, setMode] = useState<'delegates' | 'chairs' | 'delegations' | 'independents'>('delegates');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
  // Delegates board interactions
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [dragAppId, setDragAppId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropModal, setDropModal] = useState<{ committeeId: string; appId: string } | null>(null);
  const [assignModal, setAssignModal] = useState<{ committeeId: string; preSlot?: SlotRow } | null>(null);
  const [overviewCommitteeId, setOverviewCommitteeId] = useState<string | null>(null);
  // Chairs board interactions
  const [selectedChairAppId, setSelectedChairAppId] = useState<string | null>(null);
  const [dragChairAppId, setDragChairAppId] = useState<string | null>(null);
  const [chairDropTargetId, setChairDropTargetId] = useState<string | null>(null);
  const [inviteModalCommitteeId, setInviteModalCommitteeId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingAllocationEmails, setSendingAllocationEmails] = useState(false);
  const [quickAssigning, setQuickAssigning] = useState<string | null>(null); // suggestion key in flight
  // Which suggestion card is expanded to show the delegate's full detail.
  const [expandedSuggestionKey, setExpandedSuggestionKey] = useState<string | null>(null);
  const { draftNotices, pushDraftNotice, dismissDraftNotice } = useDraftNotices();
  const { confirm, modal: confirmModal } = useConfirmModal();
  const toast = useToast();

  // Organizer action feedback now lands as a floating toast (does not shift
  // page layout). Same (kind, msg) signature the whole page — and the
  // Delegations/Independents views — already call.
  const showFlash = useCallback((kind: 'ok' | 'err', msg: string) => {
    toast(kind, msg);
  }, [toast]);

  // Monotonic sequence for loads, a slow older response never overwrites a
  // newer one (silent background refetches can race with each other and with
  // full loads).
  const loadSeq = useRef(0);

  const loadData = useCallback(async (opts?: { silent?: boolean }) => {
    if (!conference) return;
    if (!session) return;
    const seq = ++loadSeq.current;
    // silent: background refresh, never flips the page-level loading flag,
    // so the board stays mounted and interactive while fresh data arrives.
    if (!opts?.silent) setLoading(true);
    const supabase = getAuthedClient(session.access_token);

    const [appRes, commRes, chairRes, inviteRes] = await Promise.all([
      supabase
        .from('applications')
        .select(`
          id, role, experience_level, is_head_delegate, society_id, payment_status,
          attending, invited_email, invited_name,
          profiles (id, display_name, email, nationality, date_of_birth, mun_experience_level, avatar_url),
          societies (name),
          application_preferences (
            preference_order, country_code, country_name, conference_committee_id,
            conference_committees (name)
          )
        `)
        .eq('conference_id', conference.id)
        .eq('status', 'accepted')
        .in('role', ['delegate', 'head-delegate']),
      supabase
        .from('conference_committees')
        .select(`
          id, name, abbreviation, difficulty, total_slots, logo_url, chair_user_ids, display_chairs,
          committee_country_slots (id, country_code, country_name, delegation_size, importance),
          conference_allocations (
            id, user_id, country_code, country_name, allocation_sent, application_id,
            profiles (id, display_name, email, nationality, date_of_birth, mun_experience_level, avatar_url),
            applications:application_id (
              invited_name, experience_level, role, is_head_delegate, society_id, payment_status, attending, invited_email,
              societies (name),
              application_preferences (preference_order, country_code, country_name, conference_committee_id, conference_committees (name))
            )
          )
        `)
        .eq('conference_id', conference.id)
        .order('name', { ascending: true }),
      supabase
        .from('applications')
        .select(`
          id, user_id, status, assigned_committee_id, experience_level, attending,
          profiles (id, display_name, email, avatar_url)
        `)
        .eq('conference_id', conference.id)
        .eq('role', 'chair')
        .in('status', ['accepted', 'assigned']),
      supabase
        .from('conference_chair_invites')
        .select('id, committee_id, email, token, profiles (display_name)')
        .eq('conference_id', conference.id)
        .eq('status', 'pending'),
    ]);

    if (seq !== loadSeq.current) return; // stale response, a newer load superseded this one

    const apps = ((appRes.data ?? []) as unknown as AcceptedApp[]).filter(a => a.attending !== false);
    const comms = (commRes.data ?? []) as unknown as CommitteeData[];

    setAccepted(apps);
    setCommittees(comms);
    setChairApps((chairRes.data ?? []) as unknown as ChairApp[]);
    setChairInvites((inviteRes.data ?? []) as unknown as PendingChairInvite[]);
    setLoading(false);

    // Enrich with MUN history (CV entries + platform awards), non-blocking
    const userIds = Array.from(new Set(apps.map(a => a.profiles?.id).filter(Boolean))) as string[];
    if (userIds.length > 0) {
      const [cvRes, awRes] = await Promise.all([
        supabase.from('mun_cv_entries').select('user_id, award').in('user_id', userIds),
        supabase.from('conference_awards').select('user_id, award_label').in('user_id', userIds),
      ]);
      if (seq !== loadSeq.current) return; // stale response
      const map: Record<string, UserHistory> = {};
      const ensure = (uid: string) => (map[uid] ??= { conferences: 0, awards: 0, awardLabels: [] });
      for (const row of (cvRes.data ?? []) as { user_id: string; award: string }[]) {
        const h = ensure(row.user_id);
        h.conferences += 1;
        if (row.award && row.award !== 'None') {
          h.awards += 1;
          h.awardLabels.push(row.award);
        }
      }
      for (const row of (awRes.data ?? []) as { user_id: string; award_label: string }[]) {
        const h = ensure(row.user_id);
        h.awards += 1;
        if (row.award_label) h.awardLabels.push(row.award_label);
      }
      setHistory(map);
    } else {
      setHistory({});
    }
  }, [conference, session?.access_token]);

  useEffect(() => {
    if (authLoading) return;
    loadData();
  }, [authLoading, loadData]);

  // F1: the delegates/chairs board lives inline in this component (unlike
  // DelegationsView/IndependentsView, which remount and refetch on every
  // switch into them), so without this it keeps rendering data loaded at
  // page mount even after mutations made in the other two modes. Refetch
  // whenever a switch lands on delegates or chairs; the effect above already
  // covers the very first render.
  const modeMounted = useRef(false);
  useEffect(() => {
    if (!modeMounted.current) { modeMounted.current = true; return; }
    if (authLoading) return;
    // silent: keep showing the (possibly stale) board while fresh data loads
    // instead of wiping the whole page behind a spinner on every tab switch.
    if (mode === 'delegates' || mode === 'chairs') loadData({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // ── Optimistic allocation commit ────────────────────────────────────────────
  // Applies exactly the change the user made, the allocation appears in the
  // committee panel and the applicant leaves the unassigned rail, with a temp
  // row id. The real UUID arrives via a silent background refetch.
  function applyLocalAllocation(committee: CommitteeData, app: AcceptedApp, slot: SlotRow, sent = false): AllocationRow {
    const row: AllocationRow = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      user_id: app.profiles?.id ?? '',
      country_code: slot.country_code,
      country_name: slot.country_name,
      allocation_sent: sent,
      application_id: app.id,
      profiles: app.profiles ? { display_name: app.profiles.display_name, avatar_url: app.profiles.avatar_url } : null,
      applications: { invited_name: app.invited_name ?? null },
    };
    setCommittees(prev => prev.map(c =>
      c.id === committee.id ? { ...c, conference_allocations: [...c.conference_allocations, row] } : c
    ));
    setAccepted(prev => prev.filter(a => a.id !== app.id));
    return row;
  }

  // Restores exactly what applyLocalAllocation changed: drops the temp row and
  // puts the applicant back in the unassigned rail.
  function rollbackLocalAllocation(committeeId: string, app: AcceptedApp, tempRowId: string) {
    setCommittees(prev => prev.map(c =>
      c.id === committeeId ? { ...c, conference_allocations: c.conference_allocations.filter(a => a.id !== tempRowId) } : c
    ));
    setAccepted(prev => (prev.some(a => a.id === app.id) ? prev : [...prev, app]));
  }

  // ── One-click assign (used by suggestion cards) ─────────────────────────────
  // Optimistic: the suggestion card disappears and the allocation shows in the
  // committee panel immediately; the insert persists in the background.
  const inFlightAssignKeys = useRef(new Set<string>());
  function quickAssign(sug: Suggestion) {
    if (!session || !conference) return;
    const key = `${sug.app.id}-${sug.slot.id}`;
    if (inFlightAssignKeys.current.has(key)) return;
    inFlightAssignKeys.current.add(key);
    setQuickAssigning(key);
    const supabase = getAuthedClient(session.access_token);
    const conferenceId = conference.id;

    const tempRow = applyLocalAllocation(sug.committee, sug.app, sug.slot);
    showFlash('ok', `${sug.app.profiles?.display_name ?? sug.app.invited_name} assigned to ${sug.slot.country_name} in ${sug.committee.abbreviation ?? sug.committee.name}.`);

    (async () => {
      const err = await insertAllocation(supabase, conferenceId, sug.committee, sug.app, sug.slot);
      if (err) {
        rollbackLocalAllocation(sug.committee.id, sug.app, tempRow.id);
        showFlash('err', err);
        return;
      }
      loadData({ silent: true }); // swap the temp row for the real UUID
    })().catch(() => {
      rollbackLocalAllocation(sug.committee.id, sug.app, tempRow.id);
      showFlash('err', 'Could not save this assignment.');
    }).finally(() => {
      inFlightAssignKeys.current.delete(key);
      setQuickAssigning(prev => (prev === key ? null : prev));
    });
  }

  function handleSendAllAllocations() {
    if (!committees.length || sendingAll) return;
    if (!session) return;
    setSendingAll(true);
    const supabase = getAuthedClient(session.access_token);
    const committeeIds = committees.map(c => c.id);
    // Optimistic: flip every unsent allocation locally; remember which ones so
    // a failed write restores exactly those rows.
    const flippedIds = new Set(
      committees.flatMap(c => c.conference_allocations.filter(a => !a.allocation_sent).map(a => a.id))
    );
    setCommittees(prev => prev.map(c => ({
      ...c,
      conference_allocations: c.conference_allocations.map(a => (a.allocation_sent ? a : { ...a, allocation_sent: true })),
    })));

    (async () => {
      const { error } = await supabase
        .from('conference_allocations')
        .update({ allocation_sent: true, allocation_sent_at: new Date().toISOString() })
        .in('conference_committee_id', committeeIds)
        .eq('allocation_sent', false);
      if (error) {
        setCommittees(prev => prev.map(c => ({
          ...c,
          conference_allocations: c.conference_allocations.map(a => (flippedIds.has(a.id) ? { ...a, allocation_sent: false } : a)),
        })));
        showFlash('err', 'Could not send allocations.');
      }
    })().catch(() => {
      setCommittees(prev => prev.map(c => ({
        ...c,
        conference_allocations: c.conference_allocations.map(a => (flippedIds.has(a.id) ? { ...a, allocation_sent: false } : a)),
      })));
      showFlash('err', 'Could not send allocations.');
    }).finally(() => setSendingAll(false));
  }

  const inFlightRemoveIds = useRef(new Set<string>());
  // Double-click guards for chair-dais mutations (assign/remove share a
  // committee-id key; revoke uses the invite's own id).
  const inFlightChairIds = useRef(new Set<string>());
  const inFlightInviteIds = useRef(new Set<string>());
  function handleRemoveAllocation(allocation: AllocationRow) {
    if (!session || !conference) return;
    if (allocation.id.startsWith('temp-')) {
      showFlash('err', 'This allocation is still saving. Try again in a moment.');
      return;
    }
    if (inFlightRemoveIds.current.has(allocation.id)) return;
    inFlightRemoveIds.current.add(allocation.id);
    const supabase = getAuthedClient(session.access_token);
    const conferenceId = conference.id;
    const committeeId = committees.find(c => c.conference_allocations.some(a => a.id === allocation.id))?.id ?? null;

    // Optimistic: the row leaves the committee panel immediately.
    setCommittees(prev => prev.map(c => ({
      ...c,
      conference_allocations: c.conference_allocations.filter(a => a.id !== allocation.id),
    })));

    const rollback = () => {
      if (!committeeId) return;
      setCommittees(prev => prev.map(c =>
        c.id === committeeId ? { ...c, conference_allocations: [...c.conference_allocations, allocation] } : c
      ));
    };

    (async () => {
      // Same ordering as before: delete first (awaited), then the application
      // status reset, then the email queue.
      const { error: delErr } = await supabase.from('conference_allocations').delete().eq('id', allocation.id);
      if (delErr) {
        rollback();
        showFlash('err', 'Could not remove this allocation.');
        return;
      }
      if (allocation.application_id) {
        await supabase.from('applications').update({
          status: 'accepted',
          assigned_committee_id: null,
          assigned_country_code: null,
          assigned_country_name: null,
        }).eq('id', allocation.application_id);

        try {
          const result = await queueEventEmail(supabase, conferenceId, 'allocation_removed', [allocation.application_id]);
          notifyIfNeeded(result, pushDraftNotice);
        } catch {
          // Email queueing is secondary, the removal stands.
          showFlash('err', 'Allocation removed, but the notification email could not be queued.');
        }
      }
      loadData({ silent: true }); // brings the delegate back into the unassigned rail
    })().catch(() => {
      rollback();
      showFlash('err', 'Could not remove this allocation.');
    }).finally(() => inFlightRemoveIds.current.delete(allocation.id));
  }

  // Batch-queue allocation_assigned (delivery: manual) for every currently
  // assigned application, derived from the committees already loaded here —
  // conference_allocations rows are only ever created for delegate/head-delegate
  // committee assignments, so this never includes chairs.
  async function handleSendAllocationEmails() {
    if (!session || !conference) return;
    const applicationIds = Array.from(new Set(
      committees.flatMap(c => c.conference_allocations.map(a => a.application_id)).filter((id): id is string => !!id)
    ));
    if (applicationIds.length === 0) {
      showFlash('err', 'No assigned delegates to email.');
      return;
    }
    const { confirmed } = await confirm({
      title: 'Queue allocation emails?',
      body: `Queue allocation emails for ${applicationIds.length} assigned delegate${applicationIds.length === 1 ? '' : 's'}?`,
      confirmLabel: 'Queue Emails',
    });
    if (!confirmed) return;

    setSendingAllocationEmails(true);
    const supabase = getAuthedClient(session.access_token);
    const result = await queueEventEmail(supabase, conference.id, 'allocation_assigned', applicationIds);
    setSendingAllocationEmails(false);
    notifyIfNeeded(result, pushDraftNotice);
    if (result.outcome === 'sent-custom' || result.outcome === 'sent-default') {
      showFlash('ok', `Queued ${result.queued ?? 0} allocation email${(result.queued ?? 0) === 1 ? '' : 's'}.`);
    }
  }

  async function handleAssignChair(chairApp: ChairApp, committee: CommitteeData) {
    const name = chairApp.profiles?.display_name ?? 'this applicant';
    const label = committee.abbreviation ?? committee.name;
    const { confirmed } = await confirm({
      title: 'Assign as chair?',
      body: `Assign ${name} as chair of ${label}?`,
      confirmLabel: 'Assign',
    });
    if (!confirmed) return;
    if (!session || inFlightChairIds.current.has(committee.id)) return;
    inFlightChairIds.current.add(committee.id);
    const supabase = getAuthedClient(session.access_token);
    const nextIds = Array.from(new Set([...(committee.chair_user_ids ?? []), chairApp.user_id]));

    // Optimistic: the chair appears on the dais (and leaves the unassigned
    // rail, which derives from chair_user_ids) immediately. avatar_url comes
    // in with the silent refetch.
    const prevIds = committee.chair_user_ids;
    const prevDisplay = committee.display_chairs;
    const prevStatus = chairApp.status;
    const prevAssignedCommitteeId = chairApp.assigned_committee_id;
    const alreadyOnDais = (committee.chair_user_ids ?? []).includes(chairApp.user_id);
    setCommittees(prev => prev.map(c =>
      c.id === committee.id
        ? {
            ...c,
            chair_user_ids: nextIds,
            display_chairs: alreadyOnDais
              ? c.display_chairs
              : [...(c.display_chairs ?? []), { name: chairApp.profiles?.display_name ?? 'Chair', avatar_url: null }],
          }
        : c
    ));
    if (chairApp.status === 'accepted') {
      setChairApps(prev => prev.map(ca =>
        ca.id === chairApp.id ? { ...ca, status: 'assigned', assigned_committee_id: committee.id } : ca
      ));
    }
    setSelectedChairAppId(null);
    showFlash('ok', `${name} assigned as chair of ${label}.`);

    const rollback = () => {
      setCommittees(prev => prev.map(c =>
        c.id === committee.id ? { ...c, chair_user_ids: prevIds, display_chairs: prevDisplay } : c
      ));
      setChairApps(prev => prev.map(ca =>
        ca.id === chairApp.id ? { ...ca, status: prevStatus, assigned_committee_id: prevAssignedCommitteeId } : ca
      ));
    };

    (async () => {
      const { error } = await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', committee.id);
      if (error) {
        rollback();
        showFlash('err', `Could not assign ${name} to ${label}.`);
        return;
      }
      if (chairApp.status === 'accepted') {
        await supabase.from('applications').update({ status: 'assigned', assigned_committee_id: committee.id }).eq('id', chairApp.id);
      }
      loadData({ silent: true });
    })().catch(() => {
      rollback();
      showFlash('err', `Could not assign ${name} to ${label}.`);
    }).finally(() => inFlightChairIds.current.delete(committee.id));
  }

  // Reverts the removed chair's application to 'accepted' only if they don't
  // chair any other committee, a chair on two daises stays 'assigned' after
  // losing one of them.
  async function handleRemoveChair(userId: string, committee: CommitteeData, name: string) {
    const label = committee.abbreviation ?? committee.name;
    const { confirmed } = await confirm({
      title: 'Remove chair?',
      body: `Remove ${name} from the ${label} dais?`,
      confirmLabel: 'Remove',
      danger: true,
    });
    if (!confirmed) return;
    if (!session || !conference || inFlightChairIds.current.has(committee.id)) return;
    inFlightChairIds.current.add(committee.id);
    const supabase = getAuthedClient(session.access_token);
    const conferenceId = conference.id;
    const nextIds = (committee.chair_user_ids ?? []).filter(id => id !== userId);
    const chairsElsewhere = committees.some(c => c.id !== committee.id && (c.chair_user_ids ?? []).includes(userId));

    // Optimistic: drop the chair from the dais (display_chairs stays aligned
    // with chair_user_ids by removing the matching index) and, if they chair
    // nowhere else, put their application back in the unassigned rail.
    const prevIds = committee.chair_user_ids;
    const prevDisplay = committee.display_chairs;
    const prevChairApps = chairApps;
    setCommittees(prev => prev.map(c => {
      if (c.id !== committee.id) return c;
      const ids = c.chair_user_ids ?? [];
      const dais = c.display_chairs ?? [];
      const idx = ids.indexOf(userId);
      const nextDisplay = ids.length === dais.length && idx >= 0 ? dais.filter((_, i) => i !== idx) : c.display_chairs;
      return { ...c, chair_user_ids: ids.filter(id => id !== userId), display_chairs: nextDisplay };
    }));
    if (!chairsElsewhere) {
      setChairApps(prev => prev.map(ca =>
        ca.user_id === userId ? { ...ca, status: 'accepted', assigned_committee_id: null } : ca
      ));
    }
    showFlash('ok', `${name} removed from ${label}.`);

    const rollback = () => {
      setCommittees(prev => prev.map(c =>
        c.id === committee.id ? { ...c, chair_user_ids: prevIds, display_chairs: prevDisplay } : c
      ));
      setChairApps(prevChairApps);
    };

    (async () => {
      const { error } = await supabase.from('conference_committees').update({ chair_user_ids: nextIds }).eq('id', committee.id);
      if (error) {
        rollback();
        showFlash('err', `Could not remove ${name} from ${label}.`);
        return;
      }
      if (!chairsElsewhere) {
        await supabase.from('applications')
          .update({ status: 'accepted', assigned_committee_id: null })
          .eq('conference_id', conferenceId)
          .eq('user_id', userId)
          .eq('role', 'chair');
      }
      loadData({ silent: true });
    })().catch(() => {
      rollback();
      showFlash('err', `Could not remove ${name} from ${label}.`);
    }).finally(() => inFlightChairIds.current.delete(committee.id));
  }

  async function handleRevokeInvite(invite: PendingChairInvite, committee: CommitteeData) {
    const label = invite.profiles?.display_name ?? invite.email;
    const { confirmed } = await confirm({
      title: 'Revoke invite?',
      body: `Revoke the chair invite sent to ${label} for ${committee.abbreviation ?? committee.name}?`,
      confirmLabel: 'Revoke',
      danger: true,
    });
    if (!confirmed) return;
    if (!session || inFlightInviteIds.current.has(invite.id)) return;
    inFlightInviteIds.current.add(invite.id);
    const supabase = getAuthedClient(session.access_token);

    // Optimistic: the pending chip disappears immediately.
    setChairInvites(prev => prev.filter(i => i.id !== invite.id));
    showFlash('ok', `Invite to ${label} revoked.`);

    (async () => {
      const { error } = await supabase.from('conference_chair_invites').update({ status: 'revoked' }).eq('id', invite.id);
      if (error) {
        setChairInvites(prev => (prev.some(i => i.id === invite.id) ? prev : [...prev, invite]));
        showFlash('err', `Could not revoke the invite to ${label}.`);
      }
    })().catch(() => {
      setChairInvites(prev => (prev.some(i => i.id === invite.id) ? prev : [...prev, invite]));
      showFlash('err', `Could not revoke the invite to ${label}.`);
    }).finally(() => inFlightInviteIds.current.delete(invite.id));
  }

  function handleChairDropOnCommittee(committeeId: string, droppedChairAppId: string) {
    const chairAppId = droppedChairAppId || dragChairAppId;
    setDragChairAppId(null);
    setChairDropTargetId(null);
    if (!chairAppId) return;
    const chairApp = chairApps.find(ca => ca.id === chairAppId);
    const committee = committees.find(c => c.id === committeeId);
    if (!chairApp || !committee) return;
    handleAssignChair(chairApp, committee);
  }

  function handleChairClickOnCommittee(committee: CommitteeData) {
    if (!selectedChairAppId) return;
    const chairApp = chairApps.find(ca => ca.id === selectedChairAppId);
    if (!chairApp) return;
    handleAssignChair(chairApp, committee);
  }

  // Board panels default to difficulty ascending: the gentlest committees
  // (beginner / general assembly) first, hardest (expert) last, name as the
  // tiebreak. Used only for display order; lookups by id read `committees`.
  const sortedCommittees = useMemo(
    () => [...committees].sort(
      (a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty) || a.name.localeCompare(b.name)
    ),
    [committees],
  );

  // ── Suggestions (global, across all committees) ─────────────────────────────
  // Every accepted, attending applicant is a candidate — INCLUDING those with
  // no committee preferences (common in real data). A preference-less delegate
  // simply scores 0 on the preference terms; their suggestion is then driven
  // by committee fill-need, the seat-importance signal and their experience /
  // difficulty skill match, so they are never skipped here.
  const suggestions = useMemo<Suggestion[]>(() => {
    const candidates: Suggestion[] = [];
    for (const app of accepted) {
      let best: Suggestion | null = null;
      for (const c of committees) {
        const allocatedCodes = new Set(c.conference_allocations.map(a => a.country_code));
        const filled = c.conference_allocations.length;
        for (const slot of c.committee_country_slots) {
          if (allocatedCodes.has(slot.country_code)) continue;
          const r = scoreSlot(app, c, slot, filled, c.total_slots);
          if (!best || r.score > best.score) {
            best = { app, committee: c, slot, score: r.score, reasons: r.reasons };
          }
        }
      }
      if (best) candidates.push(best);
    }
    candidates.sort((a, b) => b.score - a.score);
    // Greedy dedupe: never suggest the same slot twice
    const takenSlots = new Set<string>();
    const out: Suggestion[] = [];
    for (const s of candidates) {
      if (takenSlots.has(s.slot.id)) continue;
      takenSlots.add(s.slot.id);
      out.push(s);
      if (out.length >= 6) break;
    }
    return out;
  }, [accepted, committees]);

  if (!conference) return null;

  const selectedApp = accepted.find(a => a.id === selectedAppId) ?? null;
  const dropModalCommittee = dropModal ? committees.find(c => c.id === dropModal.committeeId) ?? null : null;
  const dropModalApp = dropModal ? accepted.find(a => a.id === dropModal.appId) ?? null : null;
  const assignModalCommittee = assignModal ? committees.find(c => c.id === assignModal.committeeId) ?? null : null;
  const overviewCommittee = overviewCommitteeId ? committees.find(c => c.id === overviewCommitteeId) ?? null : null;

  // Board: open the drop popup for a committee + applicant (drag or click path)
  function openDropModal(committeeId: string, appId: string) {
    const app = accepted.find(a => a.id === appId);
    if (!app) return;
    setDropModal({ committeeId, appId });
  }

  function handleDropOnCommittee(committeeId: string, droppedAppId: string) {
    const appId = droppedAppId || dragAppId;
    setDragAppId(null);
    setDropTargetId(null);
    if (!appId) return;
    openDropModal(committeeId, appId);
  }

  // Left rail: search, alphabetical
  const filteredApps = [...accepted]
    .filter(app => (app.profiles?.display_name ?? app.invited_name ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.profiles?.display_name ?? a.invited_name ?? '').localeCompare(b.profiles?.display_name ?? b.invited_name ?? ''));

  // Chairs mode, unassigned pool is anyone not currently on any committee's
  // dais (chair_user_ids), mirroring how the delegates pool is everyone not
  // yet allocated a slot.
  const allChairIdsOnDais = new Set(committees.flatMap(c => c.chair_user_ids ?? []));
  const unassignedChairs = [...chairApps]
    .filter(ca => !allChairIdsOnDais.has(ca.user_id))
    .filter(ca => (ca.profiles?.display_name ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.profiles?.display_name ?? '').localeCompare(b.profiles?.display_name ?? ''));
  const invitesByCommittee = new Map<string, PendingChairInvite[]>();
  for (const inv of chairInvites) {
    const list = invitesByCommittee.get(inv.committee_id) ?? [];
    list.push(inv);
    invitesByCommittee.set(inv.committee_id, list);
  }
  const inviteModalCommittee = inviteModalCommitteeId ? committees.find(c => c.id === inviteModalCommitteeId) ?? null : null;

  return (
    <div className="px-6 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
        <div>
          <p className="text-xs mb-1" style={{ color: NEU.muted, fontFamily: MONO, letterSpacing: '0.04em' }}>
            {conference.acronym} / Assignment
          </p>
          <h1 className="font-black text-2xl" style={{ color: NEU.ink, fontFamily: OUTFIT }}>Assignment</h1>
        </div>
        {mode === 'delegates' && (
          <div className="flex gap-2.5 flex-wrap">
            <NeuButton
              onClick={handleSendAllocationEmails}
              disabled={sendingAllocationEmails}
              gradient={NEU_GRADIENTS.gold}
            >
              {sendingAllocationEmails ? 'QUEUEING...' : 'SEND ALLOCATION EMAILS'}
            </NeuButton>
            <NeuButton
              onClick={handleSendAllAllocations}
              disabled={sendingAll}
            >
              {sendingAll ? 'SENDING...' : 'SEND ALL ALLOCATIONS'}
            </NeuButton>
          </div>
        )}
      </div>

      <DraftNoticeList
        notices={draftNotices}
        conferenceSlug={conference.slug}
        onDismiss={dismissDraftNotice}
        onTurnOn={async (eventKey) => {
          if (!session) return;
          const supabase = getAuthedClient(session.access_token);
          await turnOnDefaultEmail(supabase, conference.id, eventKey);
        }}
      />

      {/* Mode toggle: Delegates | Chairs | Delegations | Independents */}
      <NeuInset className="inline-flex p-1.5 mb-6 flex-wrap" style={{ borderRadius: 999, gap: 4 }}>
        {(['delegates', 'chairs', 'delegations', 'independents'] as const).map(m => {
          const active = mode === m;
          return (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="focus:outline-none"
              style={{
                padding: '7px 18px',
                borderRadius: 999,
                fontSize: 11,
                fontFamily: MONO,
                fontWeight: 800,
                letterSpacing: '0.06em',
                border: 'none',
                background: active ? `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})` : 'transparent',
                boxShadow: active ? `0 3px 8px ${NEU_GRADIENTS.forest[0]}44, ${NEU.outSm}` : 'none',
                color: active ? NEU.gold : NEU.muted,
                cursor: 'pointer',
                transition: 'color 200ms, box-shadow 200ms',
              }}
            >
              {m === 'delegates' ? 'DELEGATES' : m === 'chairs' ? 'CHAIRS' : m === 'delegations' ? 'DELEGATIONS' : 'INDEPENDENTS'}
            </button>
          );
        })}
      </NeuInset>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: NEU.forest, borderTopColor: 'transparent' }} />
        </div>
      )}

      {!loading && committees.length === 0 && (
        <NeuCard style={{ padding: '48px 24px' }}>
          <div className="text-center">
            <div className="flex justify-center mb-3">
              <NeuIconDisc gradient={NEU_GRADIENTS.forest} icon={Layers} size={48} />
            </div>
            <p className="font-black text-base mb-1" style={{ color: NEU.ink, fontFamily: OUTFIT }}>No committees yet</p>
            <p className="text-sm" style={{ color: NEU.muted, fontFamily: OUTFIT }}>Add committees first before assigning delegates.</p>
          </div>
        </NeuCard>
      )}

      {!loading && committees.length > 0 && (
        <>
          {/* Suggested assignments strip — deliberately set apart from the rest
              of the page with a warm gold wash + gold hairline frame, so the
              algorithmic picks read as their own distinct surface. */}
          {mode === 'delegates' && suggestions.length > 0 && (
            <div
              className="p-4 mb-6"
              style={{
                borderRadius: 22,
                background: `linear-gradient(140deg, rgba(238,217,138,0.22), rgba(240,235,221,0.55)), ${NEU.surface}`,
                boxShadow: `inset 0 0 0 1.5px ${NEU.deepGold}40, ${NEU.out}`,
              }}
            >
              <div className="flex items-center gap-2 mb-3.5">
                <NeuIconDisc gradient={NEU_GRADIENTS.gold} icon={Sparkles} size={26} iconColor={NEU.forest} />
                <p style={{ fontSize: 12, color: NEU.forest, fontFamily: MONO, letterSpacing: '0.12em', fontWeight: 800 }}>
                  SUGGESTED ASSIGNMENTS
                </p>
                <PointsInfo />
                <p className="hidden sm:block" style={{ fontSize: 10.5, color: NEU.muted, fontFamily: OUTFIT, marginLeft: 'auto' }}>
                  Ranked by preferences, experience fit and committee fill
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {suggestions.map(sug => {
                  const key = `${sug.app.id}-${sug.slot.id}`;
                  const busy = quickAssigning === key;
                  const expanded = expandedSuggestionKey === key;
                  const sugHistory = sug.app.profiles ? history[sug.app.profiles.id] : undefined;
                  const toggle = () => setExpandedSuggestionKey(prev => (prev === key ? null : key));
                  return (
                    <NeuInset key={key} small className="px-3 py-2.5">
                      <div className="flex items-center gap-3">
                        {/* Clicking the delegate opens their full application
                            detail (same info as the rail card), so the
                            organizer can vet a pick before assigning. */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={toggle}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                          className="flex items-center gap-3 flex-1 min-w-0 focus:outline-none"
                          style={{ cursor: 'pointer' }}
                          title={expanded ? 'Hide applicant detail' : 'View applicant detail'}
                        >
                          <PersonAvatar name={sug.app.profiles?.display_name ?? sug.app.invited_name ?? 'Unknown'} url={sug.app.profiles?.avatar_url ?? null} size={30} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                                {sug.app.profiles?.display_name ?? sug.app.invited_name}
                              </p>
                              <ArrowRight size={12} style={{ color: NEU.muted, flexShrink: 0 }} />
                              <CountryFlag code={sug.slot.country_code} w={19} h={13} radius={2} alt={sug.slot.country_name} />
                              <p className="text-sm truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{sug.slot.country_name}</p>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1.5" style={{ fontSize: 10, fontWeight: 800, color: NEU.forest, fontFamily: MONO }}>
                                <LogoDisc bare src={sug.committee.logo_url} size={20} fallbackText={committeeLabels(sug.committee).big} alt="" />
                                {committeeLabels(sug.committee).big}
                              </span>
                              {sug.reasons.slice(0, 2).map(r => <ReasonChip key={r} reason={r} />)}
                              <span style={{ fontSize: 11, fontWeight: 800, color: fitColor(sug.score), fontFamily: MONO, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
                                {sug.score}
                              </span>
                            </div>
                          </div>
                          {expanded
                            ? <ChevronUp size={14} style={{ color: NEU.muted, flexShrink: 0 }} />
                            : <ChevronDown size={14} style={{ color: NEU.muted, flexShrink: 0 }} />}
                        </div>
                        <NeuButton onClick={() => quickAssign(sug)} disabled={busy} style={{ padding: '8px 16px', fontSize: 11 }}>
                          {busy ? '...' : 'ASSIGN'}
                        </NeuButton>
                      </div>
                      {expanded && <DelegateDetail app={sug.app} history={sugHistory} />}
                    </NeuInset>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected-applicant banner (click path) */}
          {mode === 'delegates' && selectedApp && (
            <NeuInset className="flex items-center gap-2.5 px-4 py-2.5 mb-5">
              <MousePointerClick size={14} style={{ color: NEU.green, flexShrink: 0 }} />
              <p className="text-sm min-w-0 truncate" style={{ color: NEU.forest, fontFamily: OUTFIT }}>
                <span style={{ fontWeight: 700 }}>{selectedApp.profiles?.display_name ?? selectedApp.invited_name}</span> selected. Click a committee panel to pick their country, or drag their card.
              </p>
              <button
                onClick={() => setSelectedAppId(null)}
                className="focus:outline-none flex-shrink-0"
                style={{ color: NEU.green, marginLeft: 'auto', lineHeight: 0 }}
                title="Clear selection"
              >
                <X size={15} />
              </button>
            </NeuInset>
          )}

          {mode === 'delegates' && (
            <div className="flex flex-col xl:flex-row gap-6 items-start">
              {/* Left rail, unassigned applicants */}
              <div className="w-full xl:w-[320px] flex-shrink-0">
                <RailHeader count={filteredApps.length} />

                {/* Search */}
                <RailSearch value={search} onChange={setSearch} />

                {filteredApps.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                    {accepted.length === 0 ? 'No accepted applicants yet.' : 'No applicants match your search.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredApps.map(app => {
                      const expanded = expandedAppId === app.id;
                      const selected = selectedAppId === app.id;
                      const beingDragged = dragAppId === app.id;
                      const userHistory = app.profiles ? history[app.profiles.id] : undefined;
                      const nationality = app.profiles?.nationality ?? null;
                      const natCountry = nationality ? getCountryByName(nationality) : undefined;
                      const displayName = app.profiles?.display_name ?? app.invited_name ?? 'Unknown';
                      const level = effectiveLevel(app);
                      const age = ageOf(app);
                      const roleLabel = app.role === 'head-delegate' ? 'Head Delegate' : 'Delegate';
                      const firstPref = [...(app.application_preferences ?? [])]
                        .sort((a, b) => a.preference_order - b.preference_order)[0];
                      return (
                        <div
                          key={app.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('text/plain', app.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDragAppId(app.id);
                          }}
                          onDragEnd={() => { setDragAppId(null); setDropTargetId(null); }}
                          onClick={() => setSelectedAppId(prev => (prev === app.id ? null : app.id))}
                          className="p-3"
                          style={{
                            backgroundColor: NEU.surface,
                            borderRadius: 18,
                            boxShadow: selected ? `0 0 0 1.5px ${NEU.forest}, ${NEU.out}` : NEU.outSm,
                            opacity: beingDragged ? 0.45 : 1,
                            cursor: 'grab',
                            transition: `box-shadow 200ms cubic-bezier(0.22,1,0.36,1)`,
                          }}
                          onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
                          onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
                        >
                          <div className="flex items-start gap-2.5">
                            <GripVertical size={13} style={{ color: NEU.muted, flexShrink: 0, marginTop: 14, opacity: 0.5 }} />
                            {/* Avatar (~40% larger) with the delegate's home flag
                                tucked into its bottom-right, slightly overlapping. */}
                            <div style={{ position: 'relative', flexShrink: 0 }}>
                              <PersonAvatar name={displayName} url={app.profiles?.avatar_url ?? null} size={48} />
                              {natCountry && (
                                <CountryFlag
                                  code={natCountry.code}
                                  w={20}
                                  h={20}
                                  radius={9999}
                                  shadow={FLAG_SHADOW}
                                  alt={nationality ?? ''}
                                  title={nationality ?? ''}
                                  style={{ position: 'absolute', right: -3, bottom: -3, border: `2px solid ${NEU.surface}` }}
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="truncate" style={{ fontSize: 16, fontWeight: 800, color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.15 }}>
                                  {displayName}
                                  {age != null && (
                                    <span style={{ fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>, {age}</span>
                                  )}
                                </p>
                                {!app.profiles && <NotRegisteredChip />}
                                {selected && <Check size={13} style={{ color: NEU.green, flexShrink: 0 }} />}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                <span style={{ fontSize: 11, fontWeight: 600, color: NEU.muted, fontFamily: OUTFIT }}>{roleLabel}</span>
                                <LevelTag level={level} />
                              </div>
                            </div>
                            <button
                              onClick={e => { e.stopPropagation(); setExpandedAppId(expanded ? null : app.id); }}
                              title={expanded ? 'Hide details' : 'Show details'}
                              className="focus:outline-none flex-shrink-0"
                              style={{ color: NEU.muted, lineHeight: 0, marginTop: 3 }}
                            >
                              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                            <DelegationChip app={app} />
                          </div>

                          {firstPref && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <PrefRankBadge order={1} size={16} />
                              <CountryFlag code={firstPref.country_code} w={17} h={12} radius={2} alt={firstPref.country_name} />
                              <span className="truncate" style={{ fontSize: 11, color: NEU.muted, fontFamily: OUTFIT }}>
                                {firstPref.conference_committees?.name ?? 'Unknown'} · {firstPref.country_name}
                              </span>
                            </div>
                          )}

                          {expanded && <DelegateDetail app={app} history={userHistory} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Board, every committee visible at once */}
              <div className="flex-1 min-w-0 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {sortedCommittees.map(c => (
                    <CommitteeBoardPanel
                      key={c.id}
                      committee={c}
                      dragging={dragAppId !== null}
                      isDropTarget={dropTargetId === c.id}
                      selectable={selectedAppId !== null}
                      onDragOverPanel={() => setDropTargetId(c.id)}
                      onDragLeavePanel={() => setDropTargetId(prev => (prev === c.id ? null : prev))}
                      onDropPanel={appId => handleDropOnCommittee(c.id, appId)}
                      onClickPanel={() => { if (selectedAppId) openDropModal(c.id, selectedAppId); }}
                      onRemoveAllocation={handleRemoveAllocation}
                      onOpenOverview={() => setOverviewCommitteeId(c.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chairs mode, mirrors delegates mode's anatomy: searchable
              unassigned rail on the left, drag/click-to-select committee
              cards on the right. No suggestions strip (no preference data). */}
          {mode === 'chairs' && (
            <div className="flex flex-col xl:flex-row gap-6 items-start">
              {/* Left rail, unassigned chair applicants */}
              <div className="w-full xl:w-[320px] flex-shrink-0">
                <RailHeader count={unassignedChairs.length} />

                {/* Search */}
                <RailSearch value={search} onChange={setSearch} />

                {unassignedChairs.length === 0 ? (
                  <p className="text-sm py-6 text-center" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                    {chairApps.length === 0 ? 'No accepted chair applicants yet.' : 'No applicants match your search.'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {unassignedChairs.map(ca => {
                      const selected = selectedChairAppId === ca.id;
                      const beingDragged = dragChairAppId === ca.id;
                      return (
                        <div
                          key={ca.id}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('text/plain', ca.id);
                            e.dataTransfer.effectAllowed = 'move';
                            setDragChairAppId(ca.id);
                          }}
                          onDragEnd={() => { setDragChairAppId(null); setChairDropTargetId(null); }}
                          onClick={() => setSelectedChairAppId(prev => (prev === ca.id ? null : ca.id))}
                          className="p-3"
                          style={{
                            backgroundColor: NEU.surface,
                            borderRadius: 18,
                            boxShadow: selected ? `0 0 0 1.5px ${NEU.forest}, ${NEU.out}` : NEU.outSm,
                            opacity: beingDragged ? 0.45 : 1,
                            cursor: 'grab',
                            transition: `box-shadow 200ms cubic-bezier(0.22,1,0.36,1)`,
                          }}
                          onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
                          onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
                        >
                          <div className="flex items-start gap-2">
                            <GripVertical size={13} style={{ color: NEU.muted, flexShrink: 0, marginTop: 6, opacity: 0.5 }} />
                            <PersonAvatar name={ca.profiles?.display_name ?? 'Unknown'} url={ca.profiles?.avatar_url ?? null} size={34} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="font-semibold text-sm truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                                  {ca.profiles?.display_name ?? 'Unknown'}
                                </p>
                                {selected && <Check size={13} style={{ color: NEU.green, flexShrink: 0 }} />}
                              </div>
                              <p className="text-xs mt-0.5" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                                chair · {ca.experience_level ?? 'n/a'}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Board, every committee visible at once */}
              <div className="flex-1 min-w-0 w-full">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {sortedCommittees.map(c => (
                    <ChairBoardPanel
                      key={c.id}
                      committee={c}
                      invites={invitesByCommittee.get(c.id) ?? []}
                      dragging={dragChairAppId !== null}
                      isDropTarget={chairDropTargetId === c.id}
                      selectable={selectedChairAppId !== null}
                      onDragOverPanel={() => setChairDropTargetId(c.id)}
                      onDragLeavePanel={() => setChairDropTargetId(prev => (prev === c.id ? null : prev))}
                      onDropPanel={chairAppId => handleChairDropOnCommittee(c.id, chairAppId)}
                      onClickPanel={() => handleChairClickOnCommittee(c)}
                      onRemoveChair={(userId, name) => handleRemoveChair(userId, c, name)}
                      onRevokeInvite={invite => handleRevokeInvite(invite, c)}
                      onInvite={() => setInviteModalCommitteeId(c.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Selected-chair banner (click path) */}
      {mode === 'chairs' && selectedChairAppId && (() => {
        const selectedChairApp = chairApps.find(ca => ca.id === selectedChairAppId);
        if (!selectedChairApp) return null;
        return (
          <div
            className="fixed left-1/2 z-40 flex items-center gap-2.5 px-5 py-3"
            style={{
              bottom: 24, transform: 'translateX(-50%)', borderRadius: 999,
              background: `linear-gradient(135deg, ${NEU_GRADIENTS.forest[0]}, ${NEU_GRADIENTS.forest[1]})`,
              boxShadow: `0 12px 34px rgba(27,56,40,0.34), ${NEU.outSm}`,
            }}
          >
            <MousePointerClick size={14} style={{ color: NEU.gold, flexShrink: 0 }} />
            <p className="text-sm min-w-0" style={{ color: '#FFFFFF', fontFamily: OUTFIT }}>
              <span style={{ fontWeight: 700 }}>{selectedChairApp.profiles?.display_name}</span> selected. Click a committee to assign, or drag their card.
            </p>
            <button
              onClick={() => setSelectedChairAppId(null)}
              className="focus:outline-none flex-shrink-0"
              style={{ color: NEU.gold, marginLeft: 4, lineHeight: 0 }}
              title="Clear selection"
            >
              <X size={15} />
            </button>
          </div>
        );
      })()}

      {inviteModalCommittee && conference && (
        <InviteChairModal
          conferenceId={conference.id}
          committee={inviteModalCommittee}
          onClose={() => setInviteModalCommitteeId(null)}
          onInvited={name => {
            setInviteModalCommitteeId(null);
            showFlash('ok', `Invite sent to ${name}`);
            // The invite row (id/token) is server-minted, fetch it silently
            // instead of wiping the board behind a spinner.
            loadData({ silent: true });
          }}
        />
      )}

      {/* Drop popup, open slots for the target committee, most urgent first */}
      {dropModal && dropModalCommittee && dropModalApp && (
        <DropAllocateModal
          committee={dropModalCommittee}
          app={dropModalApp}
          onClose={() => setDropModal(null)}
          onAssigned={(slot, msg) => {
            // The insert already succeeded inside the modal (its button was
            // the only busy control), commit the same change locally and
            // swap in the real row id with a silent refetch.
            applyLocalAllocation(dropModalCommittee, dropModalApp, slot);
            showFlash('ok', msg);
            setSelectedAppId(null);
            loadData({ silent: true });
          }}
        />
      )}


      {mode === 'delegations' && (
        <DelegationsView conference={conference} showFlash={showFlash} />
      )}

      {mode === 'independents' && (
        <IndependentsView conference={conference} showFlash={showFlash} />
      )}

      {/* Slot-first assign modal (from a panel's expanded slot list) */}
      {assignModal && assignModalCommittee && (
        <AssignModal
          committee={assignModalCommittee}
          unassigned={accepted}
          preSelectedSlot={assignModal.preSlot}
          onClose={() => setAssignModal(null)}
          onAssigned={(app, slot, sentEmail) => {
            // Writes already succeeded inside the modal, commit the same
            // change locally and fetch the real row id silently.
            applyLocalAllocation(assignModalCommittee, app, slot, sentEmail);
            loadData({ silent: true });
          }}
        />
      )}

      {/* Click-into committee overview — list view with per-row detail + actions */}
      {overviewCommittee && (
        <CommitteeOverviewModal
          committee={overviewCommittee}
          history={history}
          onClose={() => setOverviewCommitteeId(null)}
          onRemoveAllocation={handleRemoveAllocation}
          onAssignSlot={slot => setAssignModal({ committeeId: overviewCommittee.id, preSlot: slot })}
          onChangeAllocation={(alloc, slot) => {
            // "Change" frees the seat (optimistic, synchronous state update) and
            // immediately opens the assign flow for that now-open slot so the
            // organizer can pick a replacement.
            handleRemoveAllocation(alloc);
            setOverviewCommitteeId(null);
            setAssignModal({ committeeId: overviewCommittee.id, preSlot: slot });
          }}
        />
      )}

      {confirmModal}

      {/* Floating action-feedback toasts (fixed overlay, never shifts layout) */}
      <ToastHost />
    </div>
  );
}
