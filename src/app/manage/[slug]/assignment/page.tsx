'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X, Check, Sparkles, ChevronDown, ChevronUp, Award, Globe2, ArrowRight, GripVertical,
  MousePointerClick, Plus, Info, Layers, Gavel, UserRound, Users, Trash2, Repeat, MoreVertical,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useManage } from '@/app/manage/[slug]/layout';
import { getAuthedClient } from '@/lib/supabase-auth';
import { reportBlocked } from '@/lib/reportCrash';
import { useAuth } from '@/components/AuthProvider';
import { getFlagUrl, getCountryByName } from '@/lib/countries';
import { ageAt } from '@/lib/age';
import { LevelInsignia, LEVEL_ACCENT } from '@/app/account/accountUi';
import DelegationsView from '@/app/manage/[slug]/assignment/DelegationsView';
import IndependentsView from '@/app/manage/[slug]/assignment/IndependentsView';
import { queueEventEmail, notifyIfNeeded, turnOnDefaultEmail } from '@/lib/emailEvents';
import {
  queueAllocationEmails, allocationSendMessage, AllocationEmailBar, type AllocationTarget,
} from '@/app/manage/[slug]/assignment/allocationEmails';
import { sendChairInvite, findChairInviteRoleConflict } from '@/lib/chairInvites';
import { useDraftNotices, DraftNoticeList } from '@/components/DraftNotice';
import { useConfirmModal } from '@/components/ConfirmModal';
import { NotRegisteredChip } from '@/app/manage/[slug]/assignment/delegationShared';
import { LogoDisc } from '@/components/LogoDisc';
import ProfileLink from '@/components/ProfileLink';
import {
  NEU, NEU_GRADIENTS, NeuCard, NeuInset, NeuButton, NeuIconDisc, NeuProgress,
} from '@/components/neu';
import Portal from '@/components/Portal';
import { ModalOverlay as SharedModalOverlay } from '@/components/ModalOverlay';
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

// ── Double-delegation seat helpers ────────────────────────────────────────────
// Groups allocation rows by country_code (each group sorted by seat ascending),
// the shared building block every "is this country/seat open" check now uses
// instead of the old one-row-per-country Map/Set.
function groupAllocationsByCountry(allocations: AllocationRow[]): Map<string, AllocationRow[]> {
  const map = new Map<string, AllocationRow[]>();
  for (const a of allocations) {
    const arr = map.get(a.country_code);
    if (arr) arr.push(a); else map.set(a.country_code, [a]);
  }
  for (const arr of map.values()) arr.sort((x, y) => x.seat - y.seat);
  return map;
}

// A slot is FULL once its allocation count reaches its delegation_size —
// this is the "has no open seat" check that replaces every old
// "has any allocation" (allocatedCodes.has / allocByCode.has) gate.
function isSlotFull(slot: SlotRow, byCountry: Map<string, AllocationRow[]>): boolean {
  return (byCountry.get(slot.country_code)?.length ?? 0) >= slot.delegation_size;
}

// Lowest seat number (1-based) not currently occupied for this slot. Used by
// every assignment path that doesn't have an explicit seat choice.
function lowestOpenSeat(slot: SlotRow, byCountry: Map<string, AllocationRow[]>): number {
  const taken = new Set((byCountry.get(slot.country_code) ?? []).map(a => a.seat));
  for (let s = 1; s <= slot.delegation_size; s++) if (!taken.has(s)) return s;
  return slot.delegation_size;
}

// The delegation (society) behind an allocation row: its own society_id if
// it's a block seat, else the society_id of the application behind it.
function allocationSocietyId(a: AllocationRow): string | null {
  return a.society_id ?? a.applications?.society_id ?? null;
}

// The row occupying the OTHER seat of a double country when exactly one of
// its two seats is currently held — the delegation-purity safeguard only
// applies in that exact situation (single-seat countries, empty double
// countries, and already-full double countries are all unaffected).
function siblingSeatAllocation(slot: SlotRow, byCountry: Map<string, AllocationRow[]>): AllocationRow | null {
  if (slot.delegation_size < 2) return null;
  const rows = byCountry.get(slot.country_code) ?? [];
  return rows.length === 1 ? rows[0] : null;
}

// Distinct allocated COUNTRIES (not seats) — the "filled" numerator against
// total_slots everywhere a committee shows a fill count. A double country
// with only one seat taken still counts as filled-in-progress.
function distinctCountryFilled(allocations: AllocationRow[]): number {
  return new Set(allocations.map(a => a.country_code)).size;
}

// The display NAME for an occupied (delegate) allocation row. A profile can
// carry a blank/whitespace display_name (a real occurrence when the row exists
// but the name was never set), and `??` would let that empty string through and
// render a nameless chip — so every source is trimmed and skipped when empty,
// falling back display_name → application invited_name → email → a neutral
// 'Assigned', never blank.
function allocateeName(alloc: AllocationRow): string {
  const dn = alloc.profiles?.display_name?.trim();
  if (dn) return dn;
  const inv = alloc.applications?.invited_name?.trim();
  if (inv) return inv;
  const email = alloc.profiles?.email?.trim();
  if (email) return email;
  return 'Assigned';
}

// A delegation (society) as a draggable allocation SOURCE in the left rail.
interface DelegationSource {
  id: string;
  name: string;
  memberCount: number;
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
  invited_name: string | null;
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
//   experience:  a SYMMETRIC difficulty-match term keyed on the gap between the
//                delegate's experience level and the committee's difficulty:
//                gap 0 → +20, gap 1 → 0, gap 2 → −15, gap 3 → −30. See
//                EXPERIENCE_GAP_SCORE / experienceFitScore. Neutral (0, no chip)
//                when either side is unknown — never a silent penalty.
//   society:     (suggestions only) +35 to complete a valid same-society double
//                delegation, −30 to spread a clumping delegation, and a hard
//                skip for a cross-society sibling seat. See scoreSocietyFit.
//   fullness:    12 * (1 - filled/total) , nudges suggestions toward emptier committees
//   importance:  +18 / +10 / +4 / 0 for an open high / medium / low / standard
//                seat, so the algorithm fills seats — and the committees that
//                still hold them — in order of importance.

// ── The two skill scales, and how they map onto one another ──────────────────
// A delegate's EXPERIENCE and a committee's DIFFICULTY are two SEPARATE
// vocabularies that today happen to spell their rungs with the same four words.
// The mapping between them is declared EXPLICITLY below — one rank map per
// scale — rather than inferred from array position, so that if either scale
// ever grows a rung (say difficulty gains 'crisis-veteran', or experience gains
// 'novice') only the map changes and the scorer keeps working. Never re-derive
// the correspondence from an index coincidence.
//
// Delegate experience (applications.experience_level, derived from the MUN CV
// entry count in src/lib/munExperience.ts: 0-1 beginner, 2-4 intermediate,
// 5-8 advanced, 9+ expert):
const EXPERIENCE_LEVEL_RANK: Record<string, number> = {
  beginner: 0, intermediate: 1, advanced: 2, expert: 3,
};
// Committee difficulty is the organiser-set `difficulty` field, picked from the
// four buttons in CommitteeEditorModal — it is NEVER one of the committee_type
// values (general-assembly / specialised / crisis), so those never map onto a
// rung here (a GA committee is graded by its own `difficulty`, not its type).
// Its rank map is DIFFICULTY_RANK, declared below and shared with the board
// sort. `difficultyLevel` is the scoring-side reader: it converts that map's
// "unknown sorts last" 99 sentinel into `null`, because for SCORING an unset
// difficulty must be neutral, not the hardest rung.
//
// Both readers return `null` for a missing/blank/unrecognised value, and
// experienceFitScore then contributes nothing at all — see there.
function experienceLevelRank(s: string | null | undefined): number | null {
  const r = EXPERIENCE_LEVEL_RANK[(s ?? '').toLowerCase().trim()];
  return r === undefined ? null : r;
}

// Importance-weighted need: an open high/medium-importance seat is a higher
// priority to fill than a standard one, so a committee still missing its
// high/medium seats scores higher as a target than one only missing standard
// seats. Mirrors the TIER_RANK urgency order (high > medium > low > standard).
const IMPORTANCE_NEED_WEIGHT: Record<ImportanceTier, number> = { high: 18, medium: 10, low: 4, standard: 0 };

// Committee difficulty ordering for the default board sort (ascending): the
// gentlest committees first, hardest last. Mirrors the canonical DIFF_ORDER in
// the committees page EXACTLY — difficulty is strictly one of the four rungs and
// is NEVER inferred from committee_type (a general-assembly committee sorts by
// its own real `difficulty` field, not by being a GA). An unset/unknown
// difficulty sorts last (99), matching the committees board, rather than being
// silently treated as 'intermediate'.
const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 0, intermediate: 1, advanced: 2, expert: 3,
};
function difficultyRank(d: string | null | undefined): number {
  return DIFFICULTY_RANK[(d ?? '').toLowerCase().trim()] ?? 99;
}
/** The SCORING-side read of committee difficulty: the same rung map as the
 *  board sort, but an unset/unrecognised difficulty comes back as `null`
 *  instead of the sort's "last" sentinel, so the fit term can stay neutral
 *  rather than treating a blank field as the hardest committee on the board. */
function difficultyLevel(d: string | null | undefined): number | null {
  const r = DIFFICULTY_RANK[(d ?? '').toLowerCase().trim()];
  return r === undefined ? null : r;
}

// ── Experience ↔ difficulty fit ───────────────────────────────────────────────
// The single most common allocation mistake organisers report is a delegate
// landing at the wrong DIFFICULTY — a first-timer dropped into an expert crisis
// room, or a nine-conference veteran parked in a beginner GA. So the term is
// scored on the ABSOLUTE gap between the two rungs and is fully SYMMETRIC:
// over-qualified is exactly as wrong as under-qualified, and neither direction
// is favoured.
//
//   gap 0 (exact match) → +20   a real, decisive reward
//   gap 1 (one rung)    →   0   acceptable stretch, neither rewarded nor punished
//   gap 2               → −15
//   gap 3               → −30
//
// Calibration against the rest of the model (preference 50/30/15, exact country
// pick 25, fill up to 12, seat importance up to 18, society ±35/30): the term
// now spans 50 points end to end, which is the same width as the single largest
// signal in the model (a 1st-choice preference). That is deliberate — it makes
// difficulty match co-equal with preference rather than a rounding error. A
// 1st-choice seat two rungs off (50 − 15 = 35) no longer beats a 3rd-choice seat
// that fits perfectly (15 + 20 = 35, a tie), and a 1st choice three rungs off
// (50 − 30 = 20) loses outright to it. The +20 bonus sits between the 3rd- and
// 2nd-choice preference tiers: strong enough to reorder seats within a
// preference tier and to lift a well-fitted lower preference over a badly
// fitted higher one, but never so large that it alone outranks a whole
// preference step (a 2nd choice that fits, 30 + 20 = 50, exactly matches a bare
// 1st choice at the same fit… which is the intended "fit is worth a tier").
//
// The four-rung scales cap the gap at 3, so gap ≥ 4 is unreachable today. If a
// scale ever grows a rung, the penalty EXTRAPOLATES linearly at −15 per rung
// beyond gap 1 (gap 4 → −45, gap 5 → −60) rather than clamping, keeping the
// curve consistent in both directions.
const EXPERIENCE_MATCH_BONUS = 20;
const EXPERIENCE_GAP_STEP = 15;
const EXPERIENCE_GAP_SCORE: Record<number, number> = {
  0: EXPERIENCE_MATCH_BONUS,
  1: 0,
  2: -EXPERIENCE_GAP_STEP,
  3: -2 * EXPERIENCE_GAP_STEP,
};
function experienceGapScore(gap: number): number {
  const table = EXPERIENCE_GAP_SCORE[gap];
  // Beyond the table (only reachable if a scale grows a rung): keep going at
  // −15 per level, the same slope the table already describes.
  return table === undefined ? -EXPERIENCE_GAP_STEP * (gap - 1) : table;
}

/** Pure scorer for the experience ↔ difficulty match. No I/O, no state.
 *
 *  MISSING DATA IS NEUTRAL. If the delegate has no usable experience level, or
 *  the committee has no difficulty set, we cannot know whether the match is
 *  good or bad — so the term contributes exactly 0 and adds no chip. It is NOT
 *  defaulted onto a rung: defaulting an unknown to 'beginner' (rung 0) would
 *  penalise every legacy/imported committee and every chair-role application
 *  into never being suggested, and defaulting it to 'intermediate' (the old
 *  behaviour) silently invented a −15 for any expert or beginner committee. A
 *  0 here reads as "this seat is decided on preference, fill and importance",
 *  which is the honest answer.
 *
 *  The delegate's level falls back to the profile mirror
 *  (profiles.mun_experience_level) when the application row carries none —
 *  same derived value, already loaded on the row, no extra fetch. */
function experienceFitScore(
  app: Pick<AcceptedApp, 'experience_level' | 'profiles'>,
  difficulty: string | null | undefined,
): { points: number; reasons: string[] } {
  const expL = experienceLevelRank(app.experience_level ?? app.profiles?.mun_experience_level);
  const diffL = difficultyLevel(difficulty);
  if (expL === null || diffL === null) return { points: 0, reasons: [] };
  const gap = Math.abs(expL - diffL);
  const points = experienceGapScore(gap);
  if (points > 0) return { points, reasons: [`EXP MATCH +${points}`] };
  // ASCII hyphen on purpose: ReasonChip detects a penalty with
  // reason.includes('-'), which a Unicode minus would not trip.
  if (points < 0) return { points, reasons: [`EXP GAP ${points}`] };
  return { points: 0, reasons: [] };
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
  // Experience ↔ difficulty fit: symmetric, and decisive in both directions.
  // A missing level on either side contributes 0 rather than a guessed rung —
  // see experienceFitScore.
  const exp = experienceFitScore(app, committee.difficulty);
  score += exp.points;
  reasons.push(...exp.reasons);
  return { score, reasons };
}

function scoreSlot(app: AcceptedApp, committee: CommitteeData, slot: SlotRow, filled: number, total: number): ScoreResult {
  const base = scorePrefAndExp(app, committee, slot);
  const fullness = Math.round(12 * (1 - filled / Math.max(total, 1)));
  base.score += fullness;
  // NB: the 'NEEDS DELEGATES' chip is NOT decided here. It is a GLOBAL signal —
  // a committee only "needs delegates" relative to how full the OTHER committees
  // are — so it is computed once across the whole board (see needyCommitteeIds)
  // and layered onto suggestions afterwards, not from this single committee's
  // fill in isolation. The fullness score above still nudges emptier committees.
  // Importance-weighted need signal: filling a higher-importance open seat
  // matters more, so it lifts the fit score and the algorithm works through
  // the priority seats — and the committees still holding them — first.
  base.score += IMPORTANCE_NEED_WEIGHT[slot.importance];
  if (slot.importance === 'high') base.reasons.push('HIGH PRIORITY');
  else if (slot.importance === 'medium') base.reasons.push('PRIORITY SEAT');
  return base;
}

// ── Society interaction ──────────────────────────────────────────────────────
// Extra terms layered onto a seat's base fit score to keep whole delegations
// coherent — folded into allocationScore below, so every display in this
// file (suggestions, the drop-allocate modal, the slot-to-applicant modal)
// shows the same honest total, society terms included. What DOES differ by
// surface is disallowed handling: the suggestion BUILDER drops a disallowed
// option before it ever becomes a suggestion, while the manual drop/assign
// modals still surface every open seat and resolve a cross-society sibling
// collision at drop time via siblingSeatAllocation → onConflict, so a chair
// can still override. The three cases are mutually exclusive and resolved in
// this strict priority order:
//
//   1. DISALLOWED (purity) — the seat is the empty half of a DOUBLE country
//      whose other seat is already held by a DIFFERENT society. Because
//      siblingSeatAllocation only returns a row when exactly one of the two
//      seats is taken, `siblingSoc !== soc` catches both a different society AND
//      an independent applicant (soc === null) sitting beside any society's
//      occupant — exactly the allocations the drop modal rejects. Never suggest
//      them.
//   2. COMPLETES PAIR (+35) — the taken half belongs to the applicant's OWN
//      society (both non-null and equal). Suggesting them here finishes a valid
//      same-society double delegation, so it earns a strong positive comparable
//      to a top preference tier. Returned BEFORE the concentration check, so a
//      genuine pair completion is never also penalised for "clumping". Carries
//      its own reason chip, "COMPLETES PAIR +35".
//   3. CONCENTRATION (−30) — not a pair completion, but a delegate from the
//      applicant's society is ALREADY allocated somewhere in this committee
//      (a delegation block seat counts). Suggesting them here would clump the
//      delegation, so we nudge them toward a different committee. Carries its
//      own reason chip too, "DELEGATION CONCENTRATION -30", so the downrank is
//      as legible as the bonus.
//
// An independent applicant (society_id null) never gets the pair bonus or the
// concentration penalty; only the purity skip can apply to them.
const PAIR_BONUS = 35;
const CONCENTRATION_PENALTY = 30;
// The flag on a suggestion the swap-improvement pass produced, so an
// organizer sees "this seat was traded for a better combined fit" rather
// than silently landing on a lower own-score seat than expected.
const SWAP_REASON = 'SWAPPED FOR BETTER TOTAL FIT';
interface SocietyFit { delta: number; reasons: string[]; disallowed: boolean; }
function scoreSocietyFit(
  app: AcceptedApp,
  committee: CommitteeData,
  slot: SlotRow,
  byCountry: Map<string, AllocationRow[]>,
): SocietyFit {
  const soc = app.society_id ?? null;
  // Non-null only for a DOUBLE country with exactly ONE of its two seats taken —
  // the one situation where a sibling-society rule can bite.
  const sibling = siblingSeatAllocation(slot, byCountry);
  const siblingSoc = sibling ? allocationSocietyId(sibling) : null;

  // (1) Purity: cross-society (or independent-beside-a-society) sibling seat.
  if (sibling && siblingSoc !== soc) {
    return { delta: 0, reasons: [], disallowed: true };
  }
  // (2) Complete a valid same-society double delegation.
  if (sibling && soc !== null && siblingSoc === soc) {
    return { delta: PAIR_BONUS, reasons: [`COMPLETES PAIR +${PAIR_BONUS}`], disallowed: false };
  }
  // (3) Same delegation already in this committee, and this is not a pair
  // completion → spread them out.
  if (soc !== null && committee.conference_allocations.some(a => allocationSocietyId(a) === soc)) {
    return { delta: -CONCENTRATION_PENALTY, reasons: [`DELEGATION CONCENTRATION -${CONCENTRATION_PENALTY}`], disallowed: false };
  }
  return { delta: 0, reasons: [], disallowed: false };
}

interface AllocationScore {
  /** base + societyDelta — the ONE number that must be rendered anywhere in
   *  this file that shows "this delegate's score on this slot". */
  total: number;
  /** scoreSlot's own score: preference, country pick, experience fit,
   *  fill need, committee importance. */
  base: number;
  /** scoreSocietyFit's delta: +PAIR_BONUS, -CONCENTRATION_PENALTY, or 0. */
  societyDelta: number;
  /** base reasons followed by the society reason, when either applies. */
  reasons: string[];
  disallowed: boolean;
}

/** The single source of truth for "what score did the engine give this
 *  delegate on this slot" — every display in this file (suggestion rows,
 *  the drop-allocate modal, the slot-to-applicant modal) must route through
 *  this instead of computing its own variant, so the number an organiser
 *  sees always matches the number the ranking actually used. */
function allocationScore(
  app: AcceptedApp,
  committee: CommitteeData,
  slot: SlotRow,
  filled: number,
  total: number,
  byCountry: Map<string, AllocationRow[]>,
): AllocationScore {
  const base = scoreSlot(app, committee, slot, filled, total);
  const soc = scoreSocietyFit(app, committee, slot, byCountry);
  return {
    total: base.score + soc.delta,
    base: base.score,
    societyDelta: soc.delta,
    reasons: [...base.reasons, ...soc.reasons],
    disallowed: soc.disallowed,
  };
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
  /** Set only when the swap-improvement pass moved this delegate off their
   *  own best available seat and onto this one, because doing so raised the
   *  combined score for both delegates involved. Drives the "SWAPPED FOR
   *  BETTER TOTAL FIT" chip and the before/after score display. */
  swap?: {
    /** This delegate's own best available score, i.e. their greedy pick
     *  before the swap moved them here. */
    ownBestScore: number;
    partnerName: string;
    /** Combined score gained across both delegates by making the swap. */
    netGain: number;
  };
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
function DelegationAvatar({ size = 30 }: { size?: number }) {
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
        aria-label={label || 'Character'}
        title={title}
        style={{
          width: w, height: h, borderRadius: radius,
          backgroundColor: NEU.surface, color: NEU.forest,
          boxShadow: [shadow, 'inset 0 0 0 1px rgba(27,56,40,0.14)'].filter(Boolean).join(', '),
          opacity: dim, ...style,
        }}
      >
        <UserRound size={Math.round(Math.min(w, h) * 0.6)} strokeWidth={2} />
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

/** A scoring-reason chip. Preference-rank reasons take the podium colours; a
 *  penalty (negative point value) reads as a calm red warning; the swap flag
 *  reads as gold, its own distinct tone since it's neither a bonus nor a
 *  penalty; everything else reads as a calm positive (green) neu chip. */
function ReasonChip({ reason }: { reason: string }) {
  const medalFor = reason === '1ST CHOICE' ? 1 : reason === '2ND CHOICE' ? 2 : reason === '3RD CHOICE' ? 3 : 0;
  const m = medalFor ? prefMedal(medalFor) : null;
  const isSwap = reason === SWAP_REASON;
  const isPenalty = reason.includes('-');
  const bg = m ? m.bg : isSwap ? 'rgba(182,135,31,0.16)' : isPenalty ? 'rgba(139,32,32,0.1)' : 'rgba(61,122,82,0.12)';
  const fg = m ? m.fg : isSwap ? '#8A6614' : isPenalty ? '#8B2020' : NEU.green;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full"
      style={{
        fontSize: 9, fontWeight: 800, letterSpacing: '0.05em', fontFamily: MONO,
        backgroundColor: bg,
        color: fg,
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
            {row('Experience fit  +20 / 0 / −15 / −30', 'An exact match between their experience level and the committee difficulty adds 20. One level apart scores 0. Two apart subtracts 15, three apart 30 — the same either way round, so an expert in a beginner committee is penalised exactly like a beginner in an expert one. Scores 0 if their level or the committee difficulty is unset.')}
            {row('Committee fill  up to +12', 'Emptier committees score higher (12 x share still open), nudging suggestions to where seats are needed.')}
            {row('Seat importance  up to +18', 'An open high-importance seat adds 18, medium 10, low 4, standard 0, so higher-priority seats fill first and delegates with no preferences still slot into where they are most needed.')}
            {row('Delegation coherence  +35 / −30', 'Completing a valid double delegation (their society already holds the country’s other seat) adds 35; placing them where a societymate is already seated but not as a pair subtracts 30 to spread the delegation. Cross-society double seats are never suggested.')}
            <span style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, lineHeight: 1.4, paddingTop: 2, borderTop: `1px solid ${NEU.base}` }}>
              Seat importance also orders the seats inside a committee overview, most urgent first.
            </span>
            <span style={{ fontFamily: OUTFIT, fontSize: 10.5, color: NEU.muted, lineHeight: 1.4 }}>
              After ranking, a pair of delegates may be swapped between their suggested seats whenever doing so raises the combined match quality across both.
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
function RailSearch({ value, onChange, placeholder = 'Search applicants...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <NeuInset className="flex items-center gap-2 px-3.5 py-2.5 mb-3" style={{ borderRadius: 999 }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-sm outline-none"
        style={{ backgroundColor: 'transparent', color: NEU.ink, fontFamily: OUTFIT }}
      />
    </NeuInset>
  );
}

/** Segmented toggle for the delegates-board rail: drag individual DELEGATES or
 *  whole DELEGATIONS (societies) onto a committee. */
function RailSourceToggle({ value, onChange }: { value: 'delegates' | 'delegations'; onChange: (v: 'delegates' | 'delegations') => void }) {
  return (
    <NeuInset className="inline-flex p-1 mb-3 w-full" style={{ borderRadius: 999, gap: 4 }}>
      {(['delegates', 'delegations'] as const).map(v => {
        const active = value === v;
        return (
          <button
            key={v}
            onClick={() => onChange(v)}
            className="focus:outline-none inline-flex items-center justify-center gap-1.5 flex-1"
            style={{
              padding: '6px 12px',
              borderRadius: 999,
              fontSize: 10,
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
            {v === 'delegates' ? <UserRound size={12} strokeWidth={2.4} /> : <Users size={12} strokeWidth={2.4} />}
            {v === 'delegates' ? 'DELEGATES' : 'DELEGATIONS'}
          </button>
        );
      })}
    </NeuInset>
  );
}

// Single write path for every allocation on this page: insert into
// conference_allocations (incl. conference_id), friendly duplicate errors,
// then round-trip the application status to 'assigned'.
// `actorId` is the organiser doing the seating (auth user id) — stamped on
// conference_allocations.assigned_by and applications.decided_by so the
// dashboard activity feed can show who made the change.
//
// `emailNow` is the whole point of the allocation email now being reliable:
// EVERY path that seats a delegate runs through here, so the announcement is
// queued here too rather than at five separate call sites (which is how it came
// to be queued at none of them). Callers pass the conference's
// allocation_email_auto flag; the manual-release flow passes false and sends
// later from the header control.
// Returns an error message, or null on success.
async function insertAllocation(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  committee: CommitteeData,
  app: AcceptedApp,
  slot: SlotRow,
  seat: number,
  actorId: string,
  emailNow: boolean,
  pushDraftNotice?: (eventKey: string, outcome: 'unconfigured' | 'sent-default') => void,
): Promise<string | null> {
  // An imported applicant has no account yet, so app.profiles is null and
  // user_id stays null until they claim their invite. conference_allocations
  // .user_id is nullable and the importer already writes nulls, so this is a
  // perfectly valid allocation. Never block on a missing profile: doing so
  // strands every imported delegate until they happen to register.
  const userId = app.profiles?.id ?? null;

  const { error: insertErr } = await supabase.from('conference_allocations').insert({
    conference_id: conferenceId,
    conference_committee_id: committee.id,
    user_id: userId,
    country_code: slot.country_code,
    country_name: slot.country_name,
    application_id: app.id,
    allocation_sent: false,
    seat,
    assigned_by: actorId,
  });
  if (insertErr) {
    if (insertErr.message.includes('SEAT_UNAVAILABLE')) {
      return 'That country does not have a second seat in this committee.';
    }
    if (insertErr.code === '23505') {
      // Two indexes catch a repeat allocation: the old (committee, user_id) one
      // for registered delegates, and the partial (committee, application_id)
      // one that also covers imported delegates, whose null user_id the first
      // index cannot dedupe.
      return insertErr.message.includes('user_id') || insertErr.message.includes('_application_key')
        ? 'This delegate already has an allocation in this committee.'
        : insertErr.message.includes('country_code')
        ? 'That seat is already taken.'
        : 'This allocation already exists.';
    }
    return insertErr.message;
  }

  await supabase.from('applications').update({
    status: 'assigned',
    assigned_committee_id: committee.id,
    assigned_country_code: slot.country_code,
    assigned_country_name: slot.country_name,
    decided_by: actorId,
    decided_at: new Date().toISOString(),
  }).eq('id', app.id);

  // Strictly AFTER the applications update: queueEventEmail resolves the
  // {{committee}} and {{country}} tokens by reading that row back, so queueing
  // any earlier would email a delegate a blank allocation.
  if (emailNow) {
    try {
      const result = await queueAllocationEmails(supabase, conferenceId, [app.id]);
      if (pushDraftNotice) notifyIfNeeded(result, pushDraftNotice);
    } catch {
      // The seat is saved either way. A failed queue leaves allocation_sent
      // false, so the delegate shows as still waiting and the header control
      // can send them in the next wave.
    }
  }

  return null;
}

// Write path for a DELEGATION (block) seat: the same country_code slot is handed
// to a society, not a delegate. user_id / application_id stay null (no delegate
// yet), so NO application status is touched. Friendly duplicate errors.
// Returns an error message, or null on success.
async function insertSocietyAllocation(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  committee: CommitteeData,
  society: DelegationSource,
  slot: SlotRow,
  seat: number,
  actorId: string,
): Promise<string | null> {
  const { error: insertErr } = await supabase.from('conference_allocations').insert({
    conference_id: conferenceId,
    conference_committee_id: committee.id,
    country_code: slot.country_code,
    country_name: slot.country_name,
    society_id: society.id,
    user_id: null,
    application_id: null,
    allocation_sent: false,
    seat,
    assigned_by: actorId,
  });
  if (insertErr) {
    if (insertErr.message.includes('SEAT_UNAVAILABLE')) {
      return 'That country does not have a second seat in this committee.';
    }
    if (insertErr.code === '23505') {
      return insertErr.message.includes('country_code')
        ? 'That seat is already taken.'
        : 'This allocation already exists.';
    }
    return insertErr.message;
  }
  return null;
}

// DELEGATION (block) assignment: the society takes the WHOLE country. On a
// delegation_size 1 slot this is exactly today's single insert. On a double
// slot it inserts both seats in sequence — if the second insert fails, the
// first is deleted so a delegation never half-holds a double country. Refuses
// up front if any seat in the country is already occupied (a block
// assignment never fills around an existing occupant).
async function insertSocietyBlockAllocation(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  committee: CommitteeData,
  society: DelegationSource,
  slot: SlotRow,
  actorId: string,
): Promise<string | null> {
  const existing = committee.conference_allocations.filter(a => a.country_code === slot.country_code);
  if (existing.length > 0) {
    return slot.delegation_size >= 2
      ? 'One seat in this country is already taken — a delegation can only take a fully open country.'
      : 'This country is already allocated in this committee.';
  }
  if (slot.delegation_size < 2) {
    return insertSocietyAllocation(supabase, conferenceId, committee, society, slot, 1, actorId);
  }
  const err1 = await insertSocietyAllocation(supabase, conferenceId, committee, society, slot, 1, actorId);
  if (err1) return err1;
  const err2 = await insertSocietyAllocation(supabase, conferenceId, committee, society, slot, 2, actorId);
  if (err2) {
    const { error: rollbackErr } = await supabase.from('conference_allocations')
      .delete()
      .eq('conference_committee_id', committee.id)
      .eq('country_code', slot.country_code)
      .eq('seat', 1)
      .eq('society_id', society.id);
    if (rollbackErr) {
      return `${err2} The first seat could not be rolled back automatically — check ${slot.country_name} manually.`;
    }
    return err2;
  }
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
  // Thin wrapper over the shared house backdrop (@/components/ModalOverlay),
  // which owns the background scroll lock, Escape-to-close and the dialog ARIA.
  // `px-4` (no vertical padding) preserves this page's original spacing.
  return <SharedModalOverlay onClose={onClose} paddingClassName="px-4">{children}</SharedModalOverlay>;
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

function DelegateDetail({
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
        <span className="truncate flex-1 min-w-0" style={{ fontSize: 12, color: NEU.ink, fontFamily: OUTFIT }}>
          {p.conference_committees?.name ?? 'Unknown'} · {p.country_name}
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
        <span className="truncate min-w-0" style={{ fontSize: 11, color: '#9A8A78', fontFamily: OUTFIT, marginLeft: 'auto' }}>
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
                letterSpacing: '0.06em', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              {showAllPrefs ? 'HIDE REMAINING PREFERENCES' : `SHOW ALL PREFERENCES (+${rest.length})`}
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

// ── DropAllocateModal ─────────────────────────────────────────────────────────
// Opens when an applicant is dropped on (or click-targeted at) a committee.
// Lists that committee's OPEN slots, most urgent first: importance tier order
// high > medium > low > standard, then suggestion score for this applicant.

interface DropAllocateModalProps {
  committee: CommitteeData;
  app: AcceptedApp;
  /** True when this committee trails the board (see needyCommitteeIds on the
   *  page): the "NEEDS DELEGATES" chip is a GLOBAL, relative signal, so it is
   *  decided once across all committees and passed in rather than re-derived
   *  from this one committee's fill. */
  needy?: boolean;
  pushDraftNotice?: (eventKey: string, outcome: 'unconfigured' | 'sent-default') => void;
  onClose: () => void;
  onConflict: (payload: { app: AcceptedApp; slot: SlotRow; seat: number; sibling: AllocationRow }) => void;
  onAssigned: (slot: SlotRow, seat: number, msg: string) => void;
}

function DropAllocateModal({ committee, app, needy = false, pushDraftNotice, onClose, onConflict, onAssigned }: DropAllocateModalProps) {
  const { session } = useAuth();
  const { conference } = useManage();
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const byCountry = groupAllocationsByCountry(committee.conference_allocations);
  const filled = distinctCountryFilled(committee.conference_allocations);
  // The same allocationScore total the suggestion builder ranks on — this
  // modal still surfaces every open seat (a sibling conflict is resolved via
  // onConflict below, not by hiding the seat), but the number shown must
  // always be the honest one, society terms included.
  const rows = committee.committee_country_slots
    .filter(s => !isSlotFull(s, byCountry))
    .map(slot => {
      const scored = allocationScore(app, committee, slot, filled, committee.total_slots, byCountry);
      return {
        slot,
        score: scored.total,
        reasons: needy ? [...scored.reasons, 'NEEDS DELEGATES'] : scored.reasons,
      };
    })
    .sort((a, b) =>
      TIER_RANK[a.slot.importance] - TIER_RANK[b.slot.importance] || b.score - a.score
    );

  async function handleAllocate(slot: SlotRow) {
    if (!session) return;
    if (!conference) { setError('Conference not loaded. Please refresh.'); return; }
    const seat = lowestOpenSeat(slot, byCountry);
    const sibling = siblingSeatAllocation(slot, byCountry);
    const siblingSoc = sibling ? allocationSocietyId(sibling) : null;
    if (sibling && siblingSoc !== (app.society_id ?? null)) {
      onConflict({ app, slot, seat, sibling });
      return;
    }
    setBusySlotId(slot.id);
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const err = await insertAllocation(
      supabase, conference.id, committee, app, slot, seat, session.user.id,
      conference.allocation_email_auto, pushDraftNotice,
    );
    setBusySlotId(null);
    if (err) { setError(err); return; }
    onAssigned(slot, seat, `${app.profiles?.display_name ?? app.invited_name} allocated to ${slot.country_name} in ${committee.abbreviation ?? committee.name}.`);
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
              {/* Static modal header — no clickable ancestor, so a plain link. */}
              <PersonAvatar name={app.profiles?.display_name ?? app.invited_name ?? 'Unknown'} url={app.profiles?.avatar_url ?? null} size={28} userId={app.profiles?.id} />
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

// ── SocietyDropAllocateModal ──────────────────────────────────────────────────
// Opens when a DELEGATION chip is dropped on (or click-targeted at) a committee.
// Lists that committee's OPEN slots by importance tier only (no delegate to
// score against yet). Allocating hands the country slot to the delegation.

interface SocietyDropAllocateModalProps {
  committee: CommitteeData;
  society: DelegationSource;
  onClose: () => void;
  onAssigned: (slot: SlotRow, msg: string) => void;
}

function SocietyDropAllocateModal({ committee, society, onClose, onAssigned }: SocietyDropAllocateModalProps) {
  const { session } = useAuth();
  const { conference } = useManage();
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const byCountry = groupAllocationsByCountry(committee.conference_allocations);
  // A block assignment takes the WHOLE country, so only fully open countries
  // (no allocation at all, on either seat) are offered here.
  const rows = committee.committee_country_slots
    .filter(s => (byCountry.get(s.country_code)?.length ?? 0) === 0)
    .sort((a, b) => TIER_RANK[a.importance] - TIER_RANK[b.importance] || a.country_name.localeCompare(b.country_name));

  async function handleAllocate(slot: SlotRow) {
    if (!session) return;
    if (!conference) { setError('Conference not loaded. Please refresh.'); return; }
    setBusySlotId(slot.id);
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const err = await insertSocietyBlockAllocation(supabase, conference.id, committee, society, slot, session.user.id);
    setBusySlotId(null);
    if (err) { setError(err); return; }
    onAssigned(slot, `${slot.country_name} allocated to ${society.name} in ${committee.abbreviation ?? committee.name}.`);
    onClose();
  }

  return (
    <ModalOverlay onClose={onClose}>
      <NeuModalCard width={560}>
        <div className="flex items-start justify-between mb-1">
          <div className="min-w-0">
            <p style={{ fontSize: 9, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.14em', fontWeight: 700, marginBottom: 6 }}>
              ALLOCATE TO DELEGATION
            </p>
            <h2 className="font-black text-base flex items-center gap-2 flex-wrap" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
              <DelegationAvatar size={28} />
              <span>{society.name}</span>
              <ArrowRight size={14} style={{ color: NEU.muted }} />
              <LogoDisc bare src={committee.logo_url} size={30} fallbackText={committeeLabels(committee).big} alt={committee.name} />
              <span>{committeeLabels(committee).big}</span>
            </h2>
          </div>
          <button onClick={onClose} className="focus:outline-none flex-shrink-0 mt-1" style={{ color: NEU.muted }}><X size={18} /></button>
        </div>
        <p className="text-xs mb-4" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
          The delegation owns the seat until it hands it to one of its delegates. Open seats, most urgent first.
        </p>

        {error && <ModalError msg={error} />}

        {rows.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
            All seats in this committee are filled.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map(slot => {
              const busy = busySlotId === slot.id;
              return (
                <NeuInset key={slot.id} small className="flex items-center gap-3 px-3 py-2.5">
                  <CountryFlag code={slot.country_code} w={24} h={17} radius={3} shadow={FLAG_SHADOW} alt={slot.country_name} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{slot.country_name}</p>
                      <TierBadge tier={slot.importance} />
                    </div>
                  </div>
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
  preSelectedSeat?: number;
  preSelectedApp?: AcceptedApp;
  /** Set when this assignment is really a move: the same application left
   *  this allocation row (already deleted, see onChangeAllocation) for a
   *  new seat within a single organizer action ("Change seat"). On success
   *  a single allocation_changed queues instead of a removal followed by
   *  an assignment. */
  moveFrom?: AllocationRow;
  pushDraftNotice?: (eventKey: string, outcome: 'unconfigured' | 'sent-default') => void;
  onClose: () => void;
  onConflict: (payload: { app: AcceptedApp; slot: SlotRow; seat: number; sibling: AllocationRow }) => void;
  onAssigned: (app: AcceptedApp, slot: SlotRow, seat: number, sentEmail: boolean) => void;
}

function AssignModal({ committee, unassigned, preSelectedSlot, preSelectedSeat, preSelectedApp, moveFrom, pushDraftNotice, onClose, onConflict, onAssigned }: AssignModalProps) {
  const { session } = useAuth();
  const { conference } = useManage();
  const [selectedApp, setSelectedApp] = useState<AcceptedApp | null>(preSelectedApp ?? null);
  const [selectedSlot, setSelectedSlot] = useState<SlotRow | null>(preSelectedSlot ?? null);
  // Follows the conference's release mode: on automatic (the default) this is
  // pre-ticked and the row below just states what will happen; on manual
  // release it starts off and is the organiser's "…but email this one now"
  // escape hatch. A MOVE never uses it — that queues allocation_changed
  // instead, and both firing would email the same delegate twice.
  const [sendEmail, setSendEmail] = useState(conference?.allocation_email_auto ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const byCountry = groupAllocationsByCountry(committee.conference_allocations);
  // Empty slots = slots with an open seat
  const emptySlots = committee.committee_country_slots.filter(s => !isSlotFull(s, byCountry));
  const filled = distinctCountryFilled(committee.conference_allocations);

  // Sort unassigned by score against the selected slot (the same
  // allocationScore total every other display in this file uses, society
  // terms included), or a committee-level-only preview before any slot is
  // picked, since there's no slot yet to score society fit against.
  const scored = unassigned.map(app => ({
    app,
    score: selectedSlot
      ? allocationScore(app, committee, selectedSlot, filled, committee.total_slots, byCountry).total
      : scorePrefAndExp(app, committee, null).score,
  }));
  scored.sort((a, b) => b.score - a.score);

  async function handleAssign() {
    if (!selectedApp || !selectedSlot) { setError('Select an applicant and a country.'); return; }
    // No profiles row means an imported applicant who has not claimed their
    // account yet. That is allocatable, see insertAllocation.
    if (!session) return;
    if (!conference) { setError('Conference not loaded. Please refresh.'); return; }
    const seat = preSelectedSeat ?? lowestOpenSeat(selectedSlot, byCountry);
    const sibling = siblingSeatAllocation(selectedSlot, byCountry);
    const siblingSoc = sibling ? allocationSocietyId(sibling) : null;
    if (sibling && siblingSoc !== (selectedApp.society_id ?? null)) {
      onConflict({ app: selectedApp, slot: selectedSlot, seat, sibling });
      onClose();
      return;
    }
    setSaving(true);
    setError('');
    const supabase = getAuthedClient(session.access_token);

    // A move announces itself with allocation_changed further down, so it never
    // also queues the allocation_assigned announcement.
    const emailNow = !moveFrom && sendEmail;
    const insertErr = await insertAllocation(
      supabase, conference.id, committee, selectedApp, selectedSlot, seat, session.user.id,
      emailNow, pushDraftNotice,
    );
    if (insertErr) {
      setError(insertErr);
      setSaving(false);
      return;
    }

    if (moveFrom) {
      // The old row is already gone (freed before this modal opened, see
      // onChangeAllocation), so all that's left is the single move email.
      try {
        const result = await queueEventEmail(supabase, conference.id, 'allocation_changed', [selectedApp.id]);
        if (pushDraftNotice) notifyIfNeeded(result, pushDraftNotice);
      } catch {
        // Email queueing is secondary, the move stands.
      }
    }

    // allocation_sent is no longer flipped here. It used to be set by this
    // block WITHOUT any email being queued, which is how a conference could
    // show every delegate as emailed having sent nothing. queueAllocationEmails
    // (inside insertAllocation above) is now the only writer, and it marks only
    // the recipients that genuinely got an outbox row.
    setSaving(false);
    onAssigned(selectedApp, selectedSlot, seat, emailNow);
    onClose();
  }

  const appScore = selectedApp
    ? (selectedSlot
        ? allocationScore(selectedApp, committee, selectedSlot, filled, committee.total_slots, byCountry).total
        : scorePrefAndExp(selectedApp, committee, null).score)
    : null;
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
              {/* Pre-selected applicant: static NeuInset (a div), nothing clickable above it. */}
              <PersonAvatar name={preSelectedApp.profiles?.display_name ?? preSelectedApp.invited_name ?? 'Unknown'} url={preSelectedApp.profiles?.avatar_url ?? null} size={34} userId={preSelectedApp.profiles?.id} />
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
                    {/* Picker row is a plain <div> with onClick — nested so picking the
                        applicant still works and only the avatar opens the CV. */}
                    <PersonAvatar name={app.profiles?.display_name ?? app.invited_name ?? 'Unknown'} url={app.profiles?.avatar_url ?? null} size={30} userId={app.profiles?.id} nested />
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

        {/* Allocation email. A move is announced by allocation_changed, so the
            choice is not offered there. */}
        {moveFrom ? (
          <p className="text-xs mb-5" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
            They will be emailed that their allocation has changed.
          </p>
        ) : (
          <label className="flex items-center gap-3 mb-5 cursor-pointer">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={e => setSendEmail(e.target.checked)}
              className="rounded"
              style={{ accentColor: NEU.forest, width: 16, height: 16 }}
            />
            <span className="text-xs" style={{ color: NEU.inkSoft, fontFamily: OUTFIT }}>
              Email them their committee and country now
              {!conference?.allocation_email_auto && (
                <span style={{ color: NEU.muted }}> — allocation emails are on manual release</span>
              )}
            </span>
          </label>
        )}

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

// ── DelegationConflictModal ───────────────────────────────────────────────────
// The delegation-purity safeguard: opens whenever an individual delegate is
// about to take one seat of a double country whose OTHER seat already
// belongs to a delegation the incoming applicant isn't part of. Same modal
// family as the rest of this page (ModalOverlay + NeuModalCard). Owns its own
// write for the two active resolutions so the caller (any of the three
// individual-assignment paths) just stands down once this is showing.

function DelegationConflictModal({
  committee, app, slot, seat, sibling, pushDraftNotice, onClose, onResolved,
}: {
  committee: CommitteeData;
  app: AcceptedApp;
  slot: SlotRow;
  seat: number;
  sibling: AllocationRow;
  pushDraftNotice: (eventKey: string, outcome: 'unconfigured' | 'sent-default') => void;
  onClose: () => void;
  // removedSiblingId is set only when the sibling row was actually deleted,
  // so the caller can drop it from local state without waiting on a refetch.
  onResolved: (msg: string, removedSiblingId?: string) => void;
}) {
  const { session } = useAuth();
  const { conference } = useManage();
  const [busy, setBusy] = useState<'remove' | 'add' | null>(null);
  const [error, setError] = useState('');

  const siblingSocId = allocationSocietyId(sibling);
  const incomingSocId = app.society_id ?? null;
  const siblingName = sibling.delegation?.name ?? sibling.applications?.societies?.name ?? 'that delegation';
  const siblingHolderName = sibling.society_id && !sibling.user_id
    ? (sibling.delegation?.name ?? 'The delegation')
    : (sibling.profiles?.display_name ?? sibling.applications?.invited_name ?? 'The other seat holder');
  const appName = app.profiles?.display_name ?? app.invited_name ?? 'This delegate';
  const incomingDelegationName = app.societies?.name ?? 'their delegation';

  // The purity rule is symmetric (never a mixed pair: one delegation member +
  // one independent, or two different delegations), so the merge option's
  // direction depends on which side (if either) actually holds a delegation.
  // Both sides holding DIFFERENT delegations offers no merge at all — never
  // silently combine two delegations.
  const bothDifferentDelegations = !!siblingSocId && !!incomingSocId;
  const canAddIncomingToSibling = !!siblingSocId && !incomingSocId;
  const canAddSiblingToIncoming = !siblingSocId && !!incomingSocId;

  const bodyText = canAddSiblingToIncoming ? (
    <>
      {slot.country_name}&apos;s other seat in {committeeLabels(committee).big} is held independently by{' '}
      <strong style={{ color: NEU.ink, fontWeight: 800 }}>{siblingHolderName}</strong>, and {appName} belongs to{' '}
      <strong style={{ color: NEU.ink, fontWeight: 800 }}>{incomingDelegationName}</strong>.
    </>
  ) : bothDifferentDelegations ? (
    <>
      {slot.country_name}&apos;s other seat in {committeeLabels(committee).big} belongs to{' '}
      <strong style={{ color: NEU.ink, fontWeight: 800 }}>{siblingName}</strong>, and {appName} belongs to{' '}
      <strong style={{ color: NEU.ink, fontWeight: 800 }}>{incomingDelegationName}</strong> — a different delegation.
    </>
  ) : (
    <>
      {slot.country_name}&apos;s other seat in {committeeLabels(committee).big} belongs to{' '}
      <strong style={{ color: NEU.ink, fontWeight: 800 }}>{siblingName}</strong>, and {appName} isn&apos;t part of that delegation.
    </>
  );

  // Seat the incoming delegate FIRST in both resolutions below, before
  // touching the sibling's row or the incoming applicant's society_id — so a
  // failure on the (secondary) cleanup step never leaves either the seat
  // empty or the applicant's delegation membership corrupted with no seat.
  async function handleRemoveBoth() {
    if (!session || !conference || busy) return;
    if (sibling.id.startsWith('temp-')) {
      setError('The other seat is still saving. Try again in a moment.');
      return;
    }
    setBusy('remove');
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const err = await insertAllocation(
      supabase, conference.id, committee, app, slot, seat, session.user.id,
      conference.allocation_email_auto, pushDraftNotice,
    );
    if (err) { setBusy(null); setError(err); return; }
    const { error: delErr } = await supabase.from('conference_allocations').delete().eq('id', sibling.id);
    if (delErr) {
      setBusy(null);
      onResolved(`${appName} allocated to ${slot.country_name} (seat ${seat}) in ${committee.abbreviation ?? committee.name}, but the other seat holder could not be removed automatically — deallocate them manually.`);
      return;
    }
    if (sibling.application_id) {
      await supabase.from('applications').update({
        status: 'accepted',
        assigned_committee_id: null,
        assigned_country_code: null,
        assigned_country_name: null,
        decided_by: session.user.id, decided_at: new Date().toISOString(),
      }).eq('id', sibling.application_id);
      try {
        const result = await queueEventEmail(supabase, conference.id, 'allocation_removed', [sibling.application_id]);
        notifyIfNeeded(result, pushDraftNotice);
      } catch {
        // Email queueing is secondary, the removal + reassignment stand.
      }
    }
    setBusy(null);
    onResolved(`${appName} allocated to ${slot.country_name} (seat ${seat}) in ${committee.abbreviation ?? committee.name}. ${siblingHolderName} was removed from the other seat.`, sibling.id);
  }

  async function handleAddIncomingToSibling() {
    if (!session || !conference || !siblingSocId || busy) return;
    setBusy('add');
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const err = await insertAllocation(
      supabase, conference.id, committee, { ...app, society_id: siblingSocId }, slot, seat, session.user.id,
      conference.allocation_email_auto, pushDraftNotice,
    );
    if (err) { setBusy(null); setError(err); return; }
    const { data, error: socErr } = await supabase
      .from('applications')
      .update({ society_id: siblingSocId })
      .eq('id', app.id)
      .select('id');
    setBusy(null);
    if (socErr || !data || data.length !== 1) {
      onResolved(`${appName} allocated to ${slot.country_name} (seat ${seat}) in ${committee.abbreviation ?? committee.name}, but could not be added to ${siblingName} — set their delegation manually.`);
      return;
    }
    onResolved(`${appName} added to ${siblingName} and allocated to ${slot.country_name} (seat ${seat}) in ${committee.abbreviation ?? committee.name}.`);
  }

  // Mirror of handleAddIncomingToSibling: the incoming delegate is the one
  // with a delegation here, so it's the SIBLING's application that moves —
  // the incoming delegate is seated with their own society_id untouched.
  async function handleAddSiblingToIncoming() {
    if (!session || !conference || !incomingSocId || busy) return;
    if (sibling.id.startsWith('temp-') || !sibling.application_id) {
      setError('The other seat is still saving. Try again in a moment.');
      return;
    }
    setBusy('add');
    setError('');
    const supabase = getAuthedClient(session.access_token);
    const err = await insertAllocation(
      supabase, conference.id, committee, app, slot, seat, session.user.id,
      conference.allocation_email_auto, pushDraftNotice,
    );
    if (err) { setBusy(null); setError(err); return; }
    const { data, error: socErr } = await supabase
      .from('applications')
      .update({ society_id: incomingSocId })
      .eq('id', sibling.application_id)
      .select('id');
    setBusy(null);
    if (socErr || !data || data.length !== 1) {
      onResolved(`${appName} allocated to ${slot.country_name} (seat ${seat}) in ${committee.abbreviation ?? committee.name}, but ${siblingHolderName} could not be added to ${incomingDelegationName} — set their delegation manually.`);
      return;
    }
    onResolved(`${siblingHolderName} added to ${incomingDelegationName} and ${appName} allocated to ${slot.country_name} (seat ${seat}) in ${committee.abbreviation ?? committee.name}.`);
  }

  return (
    <ModalOverlay onClose={() => { if (!busy) onClose(); }}>
      <NeuModalCard width={440}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 className="font-black text-base" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
            Mixed delegation seats
          </h2>
          <button onClick={onClose} disabled={!!busy} className="focus:outline-none flex-shrink-0" style={{ color: NEU.muted }}><X size={18} /></button>
        </div>
        <p className="text-sm mb-4" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.5 }}>
          {bodyText}
        </p>

        {error && <ModalError msg={error} />}

        <div className="flex flex-col gap-2">
          <NeuButton onClick={handleRemoveBoth} disabled={busy !== null} style={{ width: '100%' }}>
            {busy === 'remove' ? 'REMOVING...' : 'REMOVE BOTH AND CONTINUE'}
          </NeuButton>
          <button
            onClick={onClose}
            disabled={busy !== null}
            className="w-full rounded-full py-2.5 font-bold text-sm focus:outline-none"
            style={{ border: 'none', color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm, fontFamily: OUTFIT, letterSpacing: '0.04em' }}
          >
            PICK A DIFFERENT SEAT
          </button>
          {canAddIncomingToSibling && (
            <div>
              <NeuButton
                onClick={handleAddIncomingToSibling}
                disabled={busy !== null || !siblingSocId}
                gradient={NEU_GRADIENTS.gold}
                style={{ width: '100%' }}
              >
                {busy === 'add' ? 'ADDING...' : 'ADD THEM TO THE DELEGATION'}
              </NeuButton>
              <p className="text-xs mt-1.5 text-center" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.4 }}>
                This moves {appName} into {siblingName} for invoicing and coverage as well.
              </p>
            </div>
          )}
          {canAddSiblingToIncoming && (
            <div>
              <NeuButton
                onClick={handleAddSiblingToIncoming}
                disabled={busy !== null || !incomingSocId}
                gradient={NEU_GRADIENTS.gold}
                style={{ width: '100%' }}
              >
                {busy === 'add' ? 'ADDING...' : `ADD ${siblingHolderName.toUpperCase()} TO ${incomingDelegationName.toUpperCase()}`}
              </NeuButton>
              <p className="text-xs mt-1.5 text-center" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.4 }}>
                This moves {siblingHolderName} into {incomingDelegationName} for invoicing and coverage as well.
              </p>
            </div>
          )}
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
// One occupied-seat chip: holder name + its own deallocate X, exactly the
// single-slot chip's look. Reused for both the delegation_size 1 case and
// each occupied seat of a delegation_size 2 case.
function OccupiedSeatChip({ alloc, onRemoveAllocation }: { alloc: AllocationRow; onRemoveAllocation?: (a: AllocationRow) => void }) {
  const isSociety = !!alloc.society_id && !alloc.user_id;
  const name = isSociety
    ? (alloc.delegation?.name?.trim() || 'Delegation')
    : allocateeName(alloc);
  const removable = !!onRemoveAllocation && !alloc.id.startsWith('temp-');
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm, padding: 2, paddingRight: removable ? 4 : 9 }}
    >
      {isSociety && <Users size={12} strokeWidth={2.4} style={{ color: NEU.deepGold, flexShrink: 0 }} />}
      {/* Both consumers of CountrySlotGrid sit inside the committee panel's
          <div onClick> (a drop target, never a <button>/<a>), so the link is
          legal — nested so clicking the name does not also open the overview.
          The link goes INSIDE the truncating span, not around it, so the
          clipping/max-width geometry is untouched. A delegation-owned seat has
          no user_id, so ProfileLink renders it as bare text. */}
      <span className="truncate" style={{ fontSize: 12, fontWeight: 700, color: NEU.ink, fontFamily: OUTFIT, maxWidth: 120 }}>
        <ProfileLink userId={alloc.user_id} name={name} nested>{name}</ProfileLink>
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

function CountrySlotGrid({
  committee, flagSize = 28, maxHeight, onAssignSlot, onRemoveAllocation,
}: {
  committee: CommitteeData;
  flagSize?: number;
  maxHeight?: number;
  onAssignSlot?: (slot: SlotRow, seat: number) => void;
  onRemoveAllocation?: (a: AllocationRow) => void;
}) {
  const byCountry = groupAllocationsByCountry(committee.conference_allocations);
  const slots = [...committee.committee_country_slots].sort(
    (a, b) => TIER_RANK[a.importance] - TIER_RANK[b.importance] || a.country_name.localeCompare(b.country_name)
  );
  if (slots.length === 0) {
    return <p className="text-xs py-1" style={{ color: NEU.muted, fontFamily: OUTFIT }}>No country slots in this committee.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5" style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      {slots.map(slot => {
        const rows = byCountry.get(slot.country_code) ?? [];
        const flag = (
          <CountryFlag
            code={slot.country_code}
            w={flagSize}
            h={flagSize}
            radius={9999}
            shadow={FLAG_SHADOW}
            dim={rows.length > 0 ? undefined : 0.42}
            alt={slot.country_name}
            title={slot.country_name}
          />
        );

        // Double slot: the flag once, then two seat positions beside it —
        // each an occupied-seat chip or a small dimmed clickable "Seat N"
        // placeholder wired to onAssignSlot for that exact seat.
        if (slot.delegation_size >= 2) {
          const bySeat = new Map(rows.map(r => [r.seat, r]));
          return (
            <span
              key={slot.id}
              className="inline-flex items-center gap-1"
              style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm, borderRadius: 9999, padding: 2 }}
            >
              {flag}
              {Array.from({ length: slot.delegation_size }, (_, i) => i + 1).map(seatNum => {
                const alloc = bySeat.get(seatNum) ?? null;
                if (alloc) {
                  return <OccupiedSeatChip key={seatNum} alloc={alloc} onRemoveAllocation={onRemoveAllocation} />;
                }
                if (onAssignSlot) {
                  return (
                    <button
                      key={seatNum}
                      onClick={e => { e.stopPropagation(); onAssignSlot(slot, seatNum); }}
                      title={`Assign seat ${seatNum} of ${slot.country_name}`}
                      className="focus:outline-none rounded-full"
                      style={{ border: 'none', backgroundColor: NEU.base, padding: '4px 9px', cursor: 'pointer', opacity: 0.65 }}
                    >
                      <span style={{ fontSize: 10, fontWeight: 700, color: NEU.muted, fontFamily: OUTFIT }}>Seat {seatNum}</span>
                    </button>
                  );
                }
                return (
                  <span key={seatNum} className="rounded-full" style={{ backgroundColor: NEU.base, padding: '4px 9px', opacity: 0.55 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: NEU.muted, fontFamily: OUTFIT }}>Seat {seatNum}</span>
                  </span>
                );
              })}
            </span>
          );
        }

        // Single slot: show the country flag BESIDE the occupant chip (mirrors
        // the double-slot layout above) so an assigned country keeps its flag.
        // Previously an occupied single seat rendered a name-only chip with no
        // flag, so committees whose seats were mostly filled read as a column of
        // names with no flags at all.
        const alloc = rows[0] ?? null;
        if (alloc) {
          return (
            <span
              key={slot.id}
              className="inline-flex items-center gap-1"
              style={{ backgroundColor: NEU.surface, boxShadow: NEU.outSm, borderRadius: 9999, padding: 2 }}
            >
              {flag}
              <OccupiedSeatChip alloc={alloc} onRemoveAllocation={onRemoveAllocation} />
            </span>
          );
        }
        if (onAssignSlot) {
          return (
            <button
              key={slot.id}
              onClick={e => { e.stopPropagation(); onAssignSlot(slot, 1); }}
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
  const filled = distinctCountryFilled(committee.conference_allocations);
  const total = committee.total_slots;
  // A committee with at least one double slot also shows a secondary "N/M
  // seats" readout (total seat rows over the sum of every slot's delegation_size).
  const hasDoubleSlot = committee.committee_country_slots.some(s => s.delegation_size >= 2);
  const seatsFilled = committee.conference_allocations.length;
  const seatsTotal = committee.committee_country_slots.reduce((sum, s) => sum + s.delegation_size, 0);
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
        <span className="flex items-baseline gap-1.5 flex-shrink-0">
          <span style={{ fontSize: 15, fontWeight: 900, color: NEU.ink, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
            {filled}<span style={{ color: NEU.muted, fontWeight: 600 }}>/{total}</span>
          </span>
          {hasDoubleSlot && (
            <span style={{ fontSize: 10.5, color: NEU.muted, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
              {seatsFilled}/{seatsTotal} seats
            </span>
          )}
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
  onAssignSlot: (slot: SlotRow, seat: number) => void;
  onChangeAllocation: (a: AllocationRow) => void;
}) {
  // Keyed by `${slot.id}-${seat}` since a double slot now shows up to two rows.
  const [expandedSeatKey, setExpandedSeatKey] = useState<string | null>(null);
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
          {slots.flatMap(slot => {
            const rows = byCountry.get(slot.country_code) ?? [];
            const bySeat = new Map(rows.map(r => [r.seat, r]));
            const seatLabel = (seatNum: number) => (slot.delegation_size >= 2 ? ` — SEAT ${seatNum}` : '');

            return Array.from({ length: slot.delegation_size }, (_, i) => i + 1).map(seatNum => {
              const alloc = bySeat.get(seatNum) ?? null;
              const seatKey = `${slot.id}-${seatNum}`;

              if (!alloc) {
                // Open seat — clicking assigns this exact seat.
                return (
                  <button
                    key={seatKey}
                    onClick={() => { onAssignSlot(slot, seatNum); onClose(); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 focus:outline-none text-left"
                    style={{ backgroundColor: NEU.base, borderRadius: 14, boxShadow: NEU.inSm }}
                  >
                    <CountryFlag code={slot.country_code} w={30} h={30} radius={9999} shadow={FLAG_SHADOW} dim={0.5} alt={slot.country_name} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 13.5, fontWeight: 700, color: NEU.ink, fontFamily: OUTFIT }}>{slot.country_name}</p>
                      <p style={{ fontSize: 10.5, color: NEU.muted, fontFamily: MONO, letterSpacing: '0.06em', marginTop: 1 }}>OPEN SEAT{seatLabel(seatNum)}</p>
                    </div>
                    <TierBadge tier={slot.importance} />
                    <span className="inline-flex items-center gap-1 flex-shrink-0" style={{ fontSize: 10.5, fontWeight: 800, color: NEU.forest, fontFamily: MONO, letterSpacing: '0.04em' }}>
                      <Plus size={12} strokeWidth={2.6} /> ASSIGN
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
                return (
                  <div
                    key={seatKey}
                    className="flex items-center gap-3 px-3 py-2.5"
                    style={{ backgroundColor: NEU.surface, borderRadius: 14, boxShadow: NEU.outSm }}
                  >
                    <CountryFlag code={slot.country_code} w={30} h={30} radius={9999} shadow={FLAG_SHADOW} alt={slot.country_name} title={slot.country_name} />
                    <DelegationAvatar size={30} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 14, fontWeight: 800, color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.15 }}>
                        {alloc.delegation?.name ?? 'Delegation'}
                      </p>
                      <p className="truncate" style={{ fontSize: 11, color: NEU.muted, fontFamily: OUTFIT, marginTop: 1 }}>{slot.country_name}{seatLabel(seatNum)}</p>
                    </div>
                    <span
                      className="inline-flex items-center gap-1 flex-shrink-0"
                      style={{ padding: '3px 9px', borderRadius: 999, backgroundColor: NEU.base, boxShadow: NEU.inSm, fontSize: 9.5, fontWeight: 800, color: NEU.deepGold, fontFamily: MONO, letterSpacing: '0.08em' }}
                    >
                      <Users size={11} strokeWidth={2.4} /> DELEGATION
                    </span>
                    {removableSoc && (
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
                    <CountryFlag code={slot.country_code} w={30} h={30} radius={9999} shadow={FLAG_SHADOW} alt={slot.country_name} title={slot.country_name} />
                    {/* Seat row is a role="button" <div> (not a real <button>), so the
                        link is legal; nested keeps the expand/collapse toggle intact. */}
                    <PersonAvatar name={name} url={alloc.profiles?.avatar_url ?? null} size={30} userId={alloc.user_id} nested />
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 14, fontWeight: 800, color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.15 }}>
                        {name}
                        {age != null && <span style={{ fontWeight: 600, color: NEU.muted, fontVariantNumeric: 'tabular-nums' }}>, {age}</span>}
                      </p>
                      <p className="truncate" style={{ fontSize: 11, color: NEU.muted, fontFamily: OUTFIT, marginTop: 1 }}>{slot.country_name}{seatLabel(seatNum)}</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 flex-shrink-0">
                      <DelegationChip app={app} />
                      <LevelTag level={effectiveLevel(app)} />
                    </div>
                    <RowMenu
                      items={[
                        { label: 'Change seat', icon: <Repeat size={14} />, onClick: () => onChangeAllocation(alloc) },
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
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  // Two-roles warning, a bespoke neumorphic dialog (matches the invite card
  // above it) rather than the shared (flat) ConfirmModal.
  const [roleConflict, setRoleConflict] = useState<{ displayName: string; role: string; email: string; name: string } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  async function doSend(em: string, nm: string) {
    if (!session) return;
    const supabase = getAuthedClient(session.access_token);
    const result = await sendChairInvite(supabase, {
      conferenceId,
      committeeId: committee.id,
      committeeName: committee.name,
      email: em,
      name: nm,
    });
    if (!result.ok) {
      setError(result.error ?? 'Could not invite that chair.');
      return;
    }
    onInvited(result.invitedName ?? em);
  }

  async function handleInvite() {
    const em = email.trim();
    const nm = name.trim();
    if (!em || !nm || !session) return;
    setInviting(true);
    setError('');
    const supabase = getAuthedClient(session.access_token);

    // Two-roles warning: this email already belongs to a registered user
    // with an active application in another role, confirm before giving
    // them a second one.
    const conflict = await findChairInviteRoleConflict(supabase, conferenceId, em);
    if (conflict) {
      setInviting(false);
      setRoleConflict({ ...conflict, email: em, name: nm });
      return;
    }

    await doSend(em, nm);
    setInviting(false);
  }

  async function handleProceedRoleConflict() {
    if (!roleConflict || confirmBusy) return;
    setConfirmBusy(true);
    await doSend(roleConflict.email, roleConflict.name);
    setConfirmBusy(false);
    setRoleConflict(null);
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
          No Gavelling account needed. They&apos;ll get an email invite and show as pending until they join through the link, where they can sign up. Their name updates to match how they sign up.
        </p>
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
            placeholder="Full name"
            autoFocus
            style={{
              border: 'none', borderRadius: 999, padding: '10px 14px',
              fontSize: 13, color: NEU.ink, backgroundColor: NEU.base, boxShadow: NEU.inSm, outline: 'none',
              fontFamily: OUTFIT,
            }}
          />
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleInvite(); } }}
              placeholder="chair@example.com"
              style={{
                flex: 1, border: 'none', borderRadius: 999, padding: '10px 14px',
                fontSize: 13, color: NEU.ink, backgroundColor: NEU.base, boxShadow: NEU.inSm, outline: 'none',
                fontFamily: OUTFIT,
              }}
            />
            <NeuButton onClick={handleInvite} disabled={inviting || !email.trim() || !name.trim()} style={{ padding: '10px 18px', fontSize: 11 }}>
              {inviting ? 'INVITING…' : 'INVITE'}
            </NeuButton>
          </div>
        </div>
        {error && <div className="mt-2"><ModalError msg={error} /></div>}
      </NeuModalCard>
      {roleConflict && (
        <ModalOverlay onClose={() => { if (!confirmBusy) setRoleConflict(null); }}>
          <NeuModalCard width={420}>
            <p className="text-base mb-2" style={{ color: NEU.ink, fontWeight: 800, fontFamily: OUTFIT }}>
              This person already holds a role
            </p>
            <p className="text-sm mb-5" style={{ color: NEU.muted, fontFamily: OUTFIT, lineHeight: 1.55 }}>
              {roleConflict.displayName} already has an active {roleConflict.role.replace(/-/g, ' ')} application at this conference. Accepting this chair invite will give them two roles.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setRoleConflict(null)}
                disabled={confirmBusy}
                className="flex-1 rounded-full py-2.5 font-bold text-sm focus:outline-none"
                style={{
                  border: 'none', color: NEU.ink, backgroundColor: NEU.surface, boxShadow: NEU.outSm,
                  fontFamily: OUTFIT, letterSpacing: '0.04em', cursor: confirmBusy ? 'default' : 'pointer',
                }}
              >
                CANCEL
              </button>
              <NeuButton onClick={handleProceedRoleConflict} disabled={confirmBusy} style={{ flex: 1 }}>
                {confirmBusy ? 'PROCEEDING...' : 'PROCEED'}
              </NeuButton>
            </div>
          </NeuModalCard>
        </ModalOverlay>
      )}
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
                  {/* Reuses the idAligned guard above — a dais entry only links when
                      chair_user_ids lines up with display_chairs. The enclosing panel
                      is a <div> with onClick (not a <button>), hence nested; the X
                      remove button below is a sibling, never inside the link. */}
                  <PersonAvatar name={ch.name} url={ch.avatar_url} size={24} userId={userId} nested />
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
                  {inv.profiles?.display_name ?? inv.invited_name ?? inv.email}
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
  const { conference, refreshConferenceQuiet } = useManage();
  const { session, loading: authLoading } = useAuth();
  const [accepted, setAccepted] = useState<AcceptedApp[]>([]);
  const [committees, setCommittees] = useState<CommitteeData[]>([]);
  const [chairApps, setChairApps] = useState<ChairApp[]>([]);
  const [chairInvites, setChairInvites] = useState<PendingChairInvite[]>([]);
  const [societies, setSocieties] = useState<DelegationSource[]>([]);
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
  // Left-rail source in delegates mode: individual DELEGATES or whole DELEGATIONS
  // (societies) dragged onto a committee to own a block seat.
  const [railSource, setRailSource] = useState<'delegates' | 'delegations'>('delegates');
  const [dragSocietyId, setDragSocietyId] = useState<string | null>(null);
  const [societyDropModal, setSocietyDropModal] = useState<{ committeeId: string; societyId: string } | null>(null);
  const [assignModal, setAssignModal] = useState<{ committeeId: string; preSlot?: SlotRow; preSeat?: number; preApp?: AcceptedApp; moveFrom?: AllocationRow } | null>(null);
  const [overviewCommitteeId, setOverviewCommitteeId] = useState<string | null>(null);
  // Delegation-purity safeguard: set whenever an individual-delegate
  // assignment path (drop modal, slot-first assign modal, one-click
  // suggestion) hits a double country whose other seat belongs to a
  // delegation the incoming applicant isn't part of.
  const [conflict, setConflict] = useState<{ committee: CommitteeData; app: AcceptedApp; slot: SlotRow; seat: number; sibling: AllocationRow } | null>(null);
  // Chairs board interactions
  const [selectedChairAppId, setSelectedChairAppId] = useState<string | null>(null);
  const [dragChairAppId, setDragChairAppId] = useState<string | null>(null);
  const [chairDropTargetId, setChairDropTargetId] = useState<string | null>(null);
  const [inviteModalCommitteeId, setInviteModalCommitteeId] = useState<string | null>(null);
  const [sendingAllocationEmails, setSendingAllocationEmails] = useState(false);
  const [pendingAuto, setPendingAuto] = useState<boolean | null>(null);
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

    const [appRes, commRes, chairRes, inviteRes, socRes, socAppsRes] = await Promise.all([
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
            id, user_id, country_code, country_name, allocation_sent, allocation_sent_at, application_id, society_id, seat,
            profiles (id, display_name, email, nationality, date_of_birth, mun_experience_level, avatar_url),
            delegation:society_id (name),
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
        .select('id, committee_id, email, token, invited_name, profiles (display_name)')
        .eq('conference_id', conference.id)
        .eq('status', 'pending'),
      // Delegations (societies) that can OWN a block seat, plus every
      // application's society_id so we can show each delegation's member count.
      supabase
        .from('societies')
        .select('id, name')
        .eq('conference_id', conference.id)
        .order('name', { ascending: true }),
      supabase
        .from('applications')
        .select('society_id')
        .eq('conference_id', conference.id)
        .not('society_id', 'is', null),
    ]);

    if (seq !== loadSeq.current) return; // stale response, a newer load superseded this one

    const apps = ((appRes.data ?? []) as unknown as AcceptedApp[]).filter(a => a.attending !== false);
    const comms = (commRes.data ?? []) as unknown as CommitteeData[];

    const socCounts = new Map<string, number>();
    for (const row of (socAppsRes.data ?? []) as { society_id: string }[]) {
      socCounts.set(row.society_id, (socCounts.get(row.society_id) ?? 0) + 1);
    }
    const socs = ((socRes.data ?? []) as { id: string; name: string }[]).map(s => ({
      id: s.id, name: s.name, memberCount: socCounts.get(s.id) ?? 0,
    }));

    setAccepted(apps);
    setCommittees(comms);
    setChairApps((chairRes.data ?? []) as unknown as ChairApp[]);
    setChairInvites((inviteRes.data ?? []) as unknown as PendingChairInvite[]);
    setSocieties(socs);
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
  function applyLocalAllocation(committee: CommitteeData, app: AcceptedApp, slot: SlotRow, seat: number, sent = false): AllocationRow {
    const row: AllocationRow = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      // null, not '': AllocationRow.user_id is string | null, and an imported
      // delegate genuinely has no user id until they claim their account.
      user_id: app.profiles?.id ?? null,
      country_code: slot.country_code,
      country_name: slot.country_name,
      allocation_sent: sent,
      allocation_sent_at: sent ? new Date().toISOString() : null,
      application_id: app.id,
      seat,
      profiles: app.profiles ? { display_name: app.profiles.display_name, avatar_url: app.profiles.avatar_url } : null,
      // society_id must be carried onto the temp row too — the delegation-
      // purity safeguard (allocationSocietyId) reads it off a sibling row,
      // and this optimistic row can itself be that sibling for a few hundred
      // ms until the silent refetch swaps in the real one.
      applications: { invited_name: app.invited_name ?? null, society_id: app.society_id ?? null },
    };
    setCommittees(prev => prev.map(c =>
      c.id === committee.id ? { ...c, conference_allocations: [...c.conference_allocations, row] } : c
    ));
    setAccepted(prev => prev.filter(a => a.id !== app.id));
    return row;
  }

  // Optimistic commit for a DELEGATION (block) seat: the society row(s) appear
  // in the committee panel with temp ids. A double slot takes the WHOLE
  // country, so this always adds one row per seat (1 on a single slot, 1 and 2
  // on a double one). Unlike a delegate, the society STAYS in the rail (it can
  // own seats across many committees), so nothing is removed.
  function applyLocalSocietyAllocation(committee: CommitteeData, society: DelegationSource, slot: SlotRow): AllocationRow[] {
    const rows: AllocationRow[] = Array.from({ length: slot.delegation_size }, (_, i) => ({
      id: `temp-${Date.now()}-${i}-${Math.random().toString(36).slice(2)}`,
      user_id: null,
      country_code: slot.country_code,
      country_name: slot.country_name,
      allocation_sent: false,
      application_id: null,
      seat: i + 1,
      society_id: society.id,
      delegation: { name: society.name },
      profiles: null,
      applications: null,
    }));
    setCommittees(prev => prev.map(c =>
      c.id === committee.id ? { ...c, conference_allocations: [...c.conference_allocations, ...rows] } : c
    ));
    return rows;
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

    const byCountry = groupAllocationsByCountry(sug.committee.conference_allocations);
    const seat = lowestOpenSeat(sug.slot, byCountry);
    const sibling = siblingSeatAllocation(sug.slot, byCountry);
    const siblingSoc = sibling ? allocationSocietyId(sibling) : null;
    if (sibling && siblingSoc !== (sug.app.society_id ?? null)) {
      setConflict({ committee: sug.committee, app: sug.app, slot: sug.slot, seat, sibling });
      return;
    }

    inFlightAssignKeys.current.add(key);
    setQuickAssigning(key);
    const supabase = getAuthedClient(session.access_token);
    const conferenceId = conference.id;

    const tempRow = applyLocalAllocation(sug.committee, sug.app, sug.slot, seat, conference.allocation_email_auto);
    showFlash('ok', `${sug.app.profiles?.display_name ?? sug.app.invited_name} assigned to ${sug.slot.country_name} in ${sug.committee.abbreviation ?? sug.committee.name}.`);

    (async () => {
      const err = await insertAllocation(
        supabase, conferenceId, sug.committee, sug.app, sug.slot, seat, session.user.id,
        conference.allocation_email_auto, pushDraftNotice,
      );
      if (err) {
        rollbackLocalAllocation(sug.committee.id, sug.app, tempRow.id);
        // The seat was shown as filled and then silently vanished. ONE report
        // per click — inFlightAssignKeys makes a concurrent second call for the
        // same app/slot impossible, and the .catch below is the other half of
        // this same branch, never an additional one.
        reportBlocked('assign delegate to committee', new Error(err), {
          conferenceId, committeeId: sug.committee.id, applicationId: sug.app.id, slotId: sug.slot.id,
        });
        showFlash('err', err);
        return;
      }
      loadData({ silent: true }); // swap the temp row for the real UUID
    })().catch((e) => {
      rollbackLocalAllocation(sug.committee.id, sug.app, tempRow.id);
      reportBlocked('assign delegate to committee', e, {
        conferenceId, committeeId: sug.committee.id, applicationId: sug.app.id, slotId: sug.slot.id,
      });
      showFlash('err', 'Could not save this assignment.');
    }).finally(() => {
      inFlightAssignKeys.current.delete(key);
      setQuickAssigning(prev => (prev === key ? null : prev));
    });
  }

  // ── Allocation email release ───────────────────────────────────────────────
  // The whole "who has been told their committee and country" surface. There
  // used to be two adjacent header buttons here: SEND ALL ALLOCATIONS, which
  // flipped conference_allocations.allocation_sent and queued NO email at all,
  // and SEND ALLOCATION EMAILS, which queued emails and marked nobody. Both are
  // gone — queueAllocationEmails does the two together or neither.
  const allocationTargets: AllocationTarget[] = useMemo(() => {
    const out: AllocationTarget[] = [];
    for (const c of committees) {
      const label = c.abbreviation ?? c.name;
      for (const a of c.conference_allocations) {
        // Delegation (block) seats have no application_id — the society holds
        // the country until it hands the seat to one of its delegates, and
        // there is nobody to email yet.
        if (!a.application_id) continue;
        out.push({
          applicationId: a.application_id,
          name: a.profiles?.display_name ?? a.applications?.invited_name ?? 'Unnamed delegate',
          committee: label,
          countryCode: a.country_code,
          countryName: a.country_name,
          sent: a.allocation_sent,
          sentAt: a.allocation_sent_at ?? null,
        });
      }
    }
    return out;
  }, [committees]);

  // The conference row is the truth; `pendingAuto` is only the in-flight
  // override that makes the toggle answer instantly. No mirroring effect —
  // once refreshConferenceQuiet lands, the override clears and the context
  // value takes over, which is also what the assign modals read.
  const autoAllocationEmail = pendingAuto ?? conference?.allocation_email_auto ?? true;

  function handleToggleAutoAllocationEmail(next: boolean) {
    if (!session || !conference || pendingAuto !== null) return;
    setPendingAuto(next);
    const supabase = getAuthedClient(session.access_token);
    const conferenceId = conference.id;
    (async () => {
      const { data, error } = await supabase
        .from('conferences')
        .update({ allocation_email_auto: next })
        .eq('id', conferenceId)
        .select('id');
      if (error || !data || data.length !== 1) {
        showFlash('err', 'Could not change how allocation emails are sent.');
        return;
      }
      // The assign modals read conference.allocation_email_auto straight off
      // the manage context, so the context has to learn about this too.
      await refreshConferenceQuiet();
      showFlash('ok', next
        ? 'Allocation emails will now send automatically as you seat delegates.'
        : 'Allocation emails are on manual release — nobody is emailed until you send.');
    })().catch(() => {
      showFlash('err', 'Could not change how allocation emails are sent.');
    }).finally(() => setPendingAuto(null));
  }

  async function handleReleaseAllocationEmails(applicationIds: string[], scope: 'new' | 'all' | 'custom') {
    if (!session || !conference || sendingAllocationEmails) return;
    const ids = Array.from(new Set(applicationIds));
    if (ids.length === 0) {
      showFlash('err', 'Nobody selected.');
      return;
    }
    // Re-sending is legitimate (a delegate who lost the email, a corrected
    // country), but it must never be a surprise — so say how many of this wave
    // have already had it.
    const idSet = new Set(ids);
    const alreadySent = allocationTargets.filter(t => t.sent && idSet.has(t.applicationId)).length;
    const { confirmed } = await confirm({
      title: `Email ${ids.length} delegate${ids.length === 1 ? '' : 's'}?`,
      body: alreadySent > 0
        ? `Each one is sent their own committee and country. ${alreadySent} of them ${alreadySent === 1 ? 'has' : 'have'} already had this email — they will get it again.`
        : 'Each one is sent their own committee and country.',
      confirmLabel: 'Send',
    });
    if (!confirmed) return;

    setSendingAllocationEmails(true);
    const supabase = getAuthedClient(session.access_token);
    try {
      const result = await queueAllocationEmails(supabase, conference.id, ids);
      notifyIfNeeded(result, pushDraftNotice);
      const flash = allocationSendMessage(result, ids.length);
      showFlash(flash.kind, flash.msg);
      // Pull the real allocation_sent / allocation_sent_at back rather than
      // guessing which recipients the preference gate dropped.
      loadData({ silent: true });
    } catch (e) {
      reportBlocked('send allocation emails', e, { conferenceId: conference.id, recipientCount: ids.length, scope });
      showFlash('err', 'Could not send the allocation emails.');
    } finally {
      setSendingAllocationEmails(false);
    }
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
        // The seat visibly emptied and then came back. inFlightRemoveIds keeps
        // this to one report per allocation per click.
        reportBlocked('remove delegate allocation', delErr, {
          conferenceId, allocationId: allocation.id, committeeId,
        });
        showFlash('err', 'Could not remove this allocation.');
        return;
      }
      if (allocation.application_id) {
        await supabase.from('applications').update({
          status: 'accepted',
          assigned_committee_id: null,
          assigned_country_code: null,
          assigned_country_name: null,
          decided_by: session.user.id, decided_at: new Date().toISOString(),
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
    })().catch((e) => {
      rollback();
      reportBlocked('remove delegate allocation', e, {
        conferenceId, allocationId: allocation.id, committeeId,
      });
      showFlash('err', 'Could not remove this allocation.');
    }).finally(() => inFlightRemoveIds.current.delete(allocation.id));
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
        await supabase.from('applications').update({ status: 'assigned', assigned_committee_id: committee.id, decided_by: session.user.id, decided_at: new Date().toISOString() }).eq('id', chairApp.id);
      }
      // Only newly added chairs get the email, not everyone already on the
      // dais, they'd get spammed one more time on every unrelated re-save.
      if (!alreadyOnDais && conference) {
        const result = await queueEventEmail(supabase, conference.id, 'chair_assigned', [chairApp.id]);
        notifyIfNeeded(result, pushDraftNotice);
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
          .update({ status: 'accepted', assigned_committee_id: null, decided_by: session.user.id, decided_at: new Date().toISOString() })
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

  // ── "Needs delegates" — a RELATIVE signal across the whole board ─────────────
  // A committee is flagged only when it is conspicuously behind the pack: its
  // fill ratio is more than 25% below the SECOND-least-populated committee's.
  // Comparing against the second-least (not the least, which is always the
  // emptiest and would compare to itself) gives a stable baseline, so the flag
  // highlights the one or two committees that genuinely trail the rest rather
  // than firing on every under-half-full committee.
  const needyCommitteeIds = useMemo<Set<string>>(() => {
    const needy = new Set<string>();
    if (committees.length < 2) return needy;
    const ratios = committees.map(c => ({
      id: c.id,
      // total_slots 0 → treat as "full" (ratio 1) so an empty-of-seats committee
      // never reads as needing delegates.
      ratio: c.total_slots > 0 ? distinctCountryFilled(c.conference_allocations) / c.total_slots : 1,
    }));
    const secondLeast = [...ratios].sort((a, b) => a.ratio - b.ratio)[1].ratio;
    const threshold = secondLeast * 0.75; // >25% below the second-least-populated
    for (const r of ratios) if (r.ratio < threshold) needy.add(r.id);
    return needy;
  }, [committees]);

  // ── Suggestions (global, across all committees) ─────────────────────────────
  // Every accepted, attending applicant is a candidate — INCLUDING those with
  // no committee preferences (common in real data). A preference-less delegate
  // simply scores 0 on the preference terms; their suggestion is then driven
  // by committee fill-need, the seat-importance signal and their experience /
  // difficulty skill match, so they are never skipped here.
  const suggestions = useMemo<Suggestion[]>(() => {
    // For every candidate, rank ALL their open-seat options best-first (not just
    // their single best). Keeping the full ranked list is what lets the greedy
    // pass below fall through to a candidate's NEXT-best seat when their top pick
    // is claimed by someone else — instead of dropping them entirely. The old
    // code kept only each applicant's one best option, then discarded any whose
    // slot was already taken by a higher scorer, so several applicants sharing a
    // single best seat collapsed to one suggestion and the strip could show
    // fewer than 3 even with plenty of unassigned applicants and open seats.
    const ranked = accepted
      .map(app => {
        const options: Suggestion[] = [];
        for (const c of committees) {
          const byCountry = groupAllocationsByCountry(c.conference_allocations);
          const filled = distinctCountryFilled(c.conference_allocations);
          for (const slot of c.committee_country_slots) {
            if (isSlotFull(slot, byCountry)) continue;
            // allocationScore folds the base fit and the society-coherence
            // terms (purity skip / pair bonus / concentration penalty) into
            // the ONE total every display in this file renders. A disallowed
            // cross-society sibling seat is dropped here so it never reaches
            // the greedy or swap passes — keeping the whole builder
            // consistent (an option that can't exist is never a fall-through
            // target or a swap destination).
            const scored = allocationScore(app, c, slot, filled, c.total_slots, byCountry);
            if (scored.disallowed) continue;
            options.push({
              app, committee: c, slot,
              score: scored.total,
              reasons: scored.reasons,
            });
          }
        }
        options.sort((a, b) => b.score - a.score);
        return options;
      })
      .filter(options => options.length > 0)
      // Process the strongest candidates first (by their best available score).
      .sort((a, b) => b[0].score - a[0].score);

    // Fast lookup: for a given applicant (by app id) + slot (by slot id), the
    // pre-scored Suggestion object. This lets the swap-improvement pass below
    // re-cost a hypothetical reassignment — and reuse its reasons — without
    // re-running scoreSlot. Only open (non-full) slots appear here, exactly the
    // ones a suggestion may legally target.
    const optionByAppSlot = new Map<string, Map<string, Suggestion>>();
    for (const options of ranked) {
      if (options.length === 0) continue;
      const m = new Map<string, Suggestion>();
      for (const s of options) m.set(s.slot.id, s);
      optionByAppSlot.set(options[0].app.id, m);
    }

    // Greedy: each candidate takes their highest-scoring seat that still has an
    // open seat left in this suggestion set — one suggestion per candidate, and
    // never more suggestions for a slot than its open seats. Because a candidate
    // whose top pick is gone falls through to their next-best seat, this yields
    // as many suggestions as there are open seats: at least 3 whenever there are
    // ≥3 unassigned candidates with a reachable committee and ≥3 open seats, and
    // simply what exists when there are genuinely fewer.
    const openSeatsLeft = new Map<string, number>();
    const out: Suggestion[] = [];
    for (const options of ranked) {
      for (const s of options) {
        if (!openSeatsLeft.has(s.slot.id)) {
          const byCountry = groupAllocationsByCountry(s.committee.conference_allocations);
          openSeatsLeft.set(s.slot.id, s.slot.delegation_size - (byCountry.get(s.slot.country_code)?.length ?? 0));
        }
        const remaining = openSeatsLeft.get(s.slot.id)!;
        if (remaining <= 0) continue;
        openSeatsLeft.set(s.slot.id, remaining - 1);
        out.push(s);
        break;
      }
      if (out.length >= 6) break;
    }

    // ── Local swap-improvement pass ───────────────────────────────────────────
    // Pure greedy assigns each candidate their best STILL-OPEN seat in candidate
    // order, which can be globally suboptimal AND unfair: a strong candidate can
    // grab a seat a second candidate needed far more, leaving the second one a
    // poor fallback. Worked example — seat S1 scores A=100 / B=90, seat S2 scores
    // A=95 / B=10: greedy gives A→S1(100), B→S2(10) = 110, but A→S2(95) +
    // B→S1(90) = 185 is clearly better for the conference AND fairer to B. We
    // repair this with pairwise swaps: for any two suggestions, if exchanging
    // their seats STRICTLY raises the combined score — and both candidates
    // actually had the other's seat as an open, valid option — perform the swap.
    //
    // Seat capacity is always preserved: a swap exchanges exactly one occupant of
    // slot i with one occupant of slot j, so every slot keeps its head-count (a
    // double-delegation slot filled by two suggestions stays filled by two). Each
    // swap strictly increases the total score, which is bounded above, so the
    // loop always terminates; the guard is only a belt-and-braces safety cap.
    // This stays a suggestion AID, not a full assignment solver — with ≤6
    // suggestions the repeated O(n²) sweeps are trivially cheap and easy to
    // reason about.
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 24) {
      improved = false;
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) {
          const si = out[i];
          const sj = out[j];
          if (si.slot.id === sj.slot.id) continue; // same seat → swap is a no-op
          const iOnJ = optionByAppSlot.get(si.app.id)?.get(sj.slot.id);
          const jOnI = optionByAppSlot.get(sj.app.id)?.get(si.slot.id);
          if (!iOnJ || !jOnI) continue; // a candidate can't legally take the other's seat
          if (iOnJ.score + jOnI.score > si.score + sj.score) {
            // Legible instead of mysterious: tag both sides of the trade with
            // what each delegate gave up (their own best available score,
            // i.e. what they held right before this swap), who they traded
            // with, and the combined gain — rendered as a reason chip plus a
            // tooltip in the suggestion row.
            const netGain = (iOnJ.score + jOnI.score) - (si.score + sj.score);
            const siName = si.app.profiles?.display_name ?? si.app.invited_name ?? 'this delegate';
            const sjName = sj.app.profiles?.display_name ?? sj.app.invited_name ?? 'this delegate';
            out[i] = { ...iOnJ, swap: { ownBestScore: si.score, partnerName: sjName, netGain } }; // app i now sits in slot j (with slot-j reasons)
            out[j] = { ...jOnI, swap: { ownBestScore: sj.score, partnerName: siName, netGain } }; // app j now sits in slot i (with slot-i reasons)
            improved = true;
          }
        }
      }
    }

    // Display strongest-first: greedy insertion + swaps mostly follow score
    // order, but a fall-through pick can land lower, so re-sort the cards high → low.
    out.sort((a, b) => b.score - a.score);
    // Layer on the global "needs delegates" chip (see needyCommitteeIds) — added
    // last so preference / country / experience reasons still lead the row.
    return out.map(s =>
      needyCommitteeIds.has(s.committee.id) && !s.reasons.includes('NEEDS DELEGATES')
        ? { ...s, reasons: [...s.reasons, 'NEEDS DELEGATES'] }
        : s
    );
  }, [accepted, committees, needyCommitteeIds]);

  if (!conference) return null;

  const selectedApp = accepted.find(a => a.id === selectedAppId) ?? null;
  const dropModalCommittee = dropModal ? committees.find(c => c.id === dropModal.committeeId) ?? null : null;
  const dropModalApp = dropModal ? accepted.find(a => a.id === dropModal.appId) ?? null : null;
  const societyDropModalCommittee = societyDropModal ? committees.find(c => c.id === societyDropModal.committeeId) ?? null : null;
  const societyDropModalSociety = societyDropModal ? societies.find(s => s.id === societyDropModal.societyId) ?? null : null;
  const assignModalCommittee = assignModal ? committees.find(c => c.id === assignModal.committeeId) ?? null : null;
  const overviewCommittee = overviewCommitteeId ? committees.find(c => c.id === overviewCommitteeId) ?? null : null;

  // Board: open the drop popup for a committee + applicant (drag or click path)
  function openDropModal(committeeId: string, appId: string) {
    const app = accepted.find(a => a.id === appId);
    if (!app) return;
    setDropModal({ committeeId, appId });
  }

  function openSocietyDropModal(committeeId: string, societyId: string) {
    if (!societies.some(s => s.id === societyId)) return;
    setSocietyDropModal({ committeeId, societyId });
  }

  // One drop handler for both rail sources. A society drag encodes its payload
  // as `society:<id>` (delegates drop their bare app id), so the target is
  // routed to the right allocation flow.
  function handleDropOnCommittee(committeeId: string, dropped: string) {
    const payload = dropped || (dragSocietyId ? `society:${dragSocietyId}` : dragAppId) || '';
    setDragAppId(null);
    setDragSocietyId(null);
    setDropTargetId(null);
    if (!payload) return;
    if (payload.startsWith('society:')) { openSocietyDropModal(committeeId, payload.slice(8)); return; }
    openDropModal(committeeId, payload);
  }

  // Left rail: search, alphabetical
  const filteredApps = [...accepted]
    .filter(app => (app.profiles?.display_name ?? app.invited_name ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.profiles?.display_name ?? a.invited_name ?? '').localeCompare(b.profiles?.display_name ?? b.invited_name ?? ''));

  // Delegations rail source: every society, searchable by name.
  const filteredSocieties = [...societies]
    .filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

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
          <AllocationEmailBar
            autoSend={autoAllocationEmail}
            onToggleAuto={handleToggleAutoAllocationEmail}
            togglePending={pendingAuto !== null}
            targets={allocationTargets}
            busy={sendingAllocationEmails}
            onSend={handleReleaseAllocationEmails}
          />
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
                          onClick={toggle}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
                          className="flex items-center gap-2.5 flex-1 min-w-0 focus:outline-none"
                          style={{ cursor: 'pointer' }}
                          title={expanded ? 'Hide applicant detail' : 'View applicant detail'}
                        >
                          {/* role="button" <div>, not a real <button> — link is legal;
                              nested keeps the expand/collapse toggle working. */}
                          <PersonAvatar name={sug.app.profiles?.display_name ?? sug.app.invited_name ?? 'Unknown'} url={sug.app.profiles?.avatar_url ?? null} size={30} userId={sug.app.profiles?.id} nested />
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>
                              {sug.app.profiles?.display_name ?? sug.app.invited_name}
                            </p>
                            <ArrowRight size={12} style={{ color: NEU.muted, flexShrink: 0 }} />
                            <CountryFlag code={sug.slot.country_code} w={19} h={13} radius={2} alt={sug.slot.country_name} />
                            <p className="text-sm truncate" style={{ color: NEU.ink, fontFamily: OUTFIT }}>{sug.slot.country_name}</p>
                          </div>
                          {expanded
                            ? <ChevronUp size={14} style={{ color: NEU.muted, flexShrink: 0 }} />
                            : <ChevronDown size={14} style={{ color: NEU.muted, flexShrink: 0 }} />}
                        </div>
                        {sug.swap ? (
                          <span
                            className="inline-flex items-baseline gap-1 flex-shrink-0"
                            title={`Suggested here at ${sug.score}; their own best available seat scored ${sug.swap.ownBestScore}.`}
                          >
                            <span style={{ fontSize: 11, fontWeight: 800, color: fitColor(sug.score), fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                              {sug.score}
                            </span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: NEU.muted, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                              (best {sug.swap.ownBestScore})
                            </span>
                          </span>
                        ) : (
                          <span className="flex-shrink-0" style={{ fontSize: 11, fontWeight: 800, color: fitColor(sug.score), fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
                            {sug.score}
                          </span>
                        )}
                        <NeuButton onClick={() => quickAssign(sug)} disabled={busy} style={{ padding: '8px 16px', fontSize: 11 }}>
                          {busy ? '...' : 'ASSIGN'}
                        </NeuButton>
                      </div>
                      {/* Row 2 — committee + reason tags on a single line. The
                          committee chip (with logo) truncates first so the tags
                          always sit next to each other and never wrap to a third
                          row. */}
                      <div className="flex items-center gap-1.5 mt-2 min-w-0" style={{ flexWrap: 'nowrap', overflow: 'hidden' }}>
                        <span className="inline-flex items-center gap-1.5 min-w-0" style={{ fontSize: 10, fontWeight: 800, color: NEU.forest, fontFamily: MONO }}>
                          <LogoDisc bare src={sug.committee.logo_url} size={18} fallbackText={committeeLabels(sug.committee).big} alt="" />
                          <span className="truncate">{committeeLabels(sug.committee).big}</span>
                        </span>
                        <span className="flex items-center gap-1.5 flex-shrink-0">
                          {sug.reasons.slice(0, 3).map(r => <ReasonChip key={r} reason={r} />)}
                          {sug.swap && (
                            <span title={`Swapped with ${sug.swap.partnerName}, a net gain of +${sug.swap.netGain} across both delegates.`}>
                              <ReasonChip reason={SWAP_REASON} />
                            </span>
                          )}
                        </span>
                      </div>
                      {expanded && <DelegateDetail app={sug.app} history={sugHistory} contextCommitteeId={sug.committee.id} contextCountryCode={sug.slot.country_code} />}
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
              {/* Left rail, unassigned applicants (or delegations to block-allocate) */}
              <div className="w-full xl:w-[320px] flex-shrink-0">
                {/* Source toggle: drag individual delegates, or whole delegations. */}
                <RailSourceToggle
                  value={railSource}
                  onChange={v => { setRailSource(v); if (v === 'delegations') setSelectedAppId(null); }}
                />

                <RailHeader count={railSource === 'delegates' ? filteredApps.length : filteredSocieties.length} />

                {/* Search */}
                <RailSearch
                  value={search}
                  onChange={setSearch}
                  placeholder={railSource === 'delegates' ? 'Search applicants...' : 'Search delegations...'}
                />

                {railSource === 'delegations' ? (
                  filteredSocieties.length === 0 ? (
                    <p className="text-sm py-6 text-center" style={{ color: NEU.muted, fontFamily: OUTFIT }}>
                      {societies.length === 0 ? 'No delegations yet.' : 'No delegations match your search.'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {filteredSocieties.map(soc => {
                        const beingDragged = dragSocietyId === soc.id;
                        return (
                          <div
                            key={soc.id}
                            draggable
                            onDragStart={e => {
                              e.dataTransfer.setData('text/plain', `society:${soc.id}`);
                              e.dataTransfer.effectAllowed = 'move';
                              setDragSocietyId(soc.id);
                            }}
                            onDragEnd={() => { setDragSocietyId(null); setDropTargetId(null); }}
                            className="p-3 flex items-center gap-2.5"
                            style={{
                              backgroundColor: NEU.surface,
                              borderRadius: 18,
                              boxShadow: NEU.outSm,
                              opacity: beingDragged ? 0.45 : 1,
                              cursor: 'grab',
                              transition: 'box-shadow 200ms cubic-bezier(0.22,1,0.36,1)',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSmHover; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow = NEU.outSm; }}
                          >
                            <GripVertical size={13} style={{ color: NEU.muted, flexShrink: 0, opacity: 0.5 }} />
                            <DelegationAvatar size={40} />
                            <div className="flex-1 min-w-0">
                              <p className="truncate" style={{ fontSize: 15, fontWeight: 800, color: NEU.ink, fontFamily: OUTFIT, lineHeight: 1.15 }}>
                                {soc.name}
                              </p>
                              <p className="flex items-center gap-1 mt-0.5" style={{ fontSize: 10.5, color: NEU.muted, fontFamily: MONO, letterSpacing: '0.04em', fontVariantNumeric: 'tabular-nums' }}>
                                <Users size={11} strokeWidth={2.2} /> {soc.memberCount} {soc.memberCount === 1 ? 'MEMBER' : 'MEMBERS'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : filteredApps.length === 0 ? (
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
                              {/* The card itself is the drag source (a <div draggable>,
                                  not a <button>), so the link is legal. PersonAvatar
                                  always renders its ProfileLink with draggable={false},
                                  which per the HTML drag spec is NOT a drag source — the
                                  browser walks up to the nearest draggable ancestor, i.e.
                                  this card, so the card's own dataTransfer payload still
                                  starts the drag from anywhere on the avatar. Same trick
                                  the inner <img draggable={false}> already relies on.
                                  nested keeps the card's select-on-click working. */}
                              <PersonAvatar name={displayName} url={app.profiles?.avatar_url ?? null} size={48} userId={app.profiles?.id} nested />
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

              {/* Board, every committee visible at once. A masonry (CSS
                  columns) layout instead of a grid: panels of different heights
                  pack tightly down each column with no empty gaps between rows,
                  so a short committee never leaves dead space beneath it waiting
                  on a taller neighbour. Each panel is break-inside-avoid + a
                  bottom margin (columns have no row gap of their own). */}
              <div className="flex-1 min-w-0 w-full">
                <div className="columns-1 md:columns-2 2xl:columns-3" style={{ columnGap: '1rem' }}>
                  {sortedCommittees.map(c => (
                    <div key={c.id} className="mb-4 break-inside-avoid">
                    <CommitteeBoardPanel
                      committee={c}
                      dragging={dragAppId !== null || dragSocietyId !== null}
                      isDropTarget={dropTargetId === c.id}
                      selectable={selectedAppId !== null}
                      onDragOverPanel={() => setDropTargetId(c.id)}
                      onDragLeavePanel={() => setDropTargetId(prev => (prev === c.id ? null : prev))}
                      onDropPanel={appId => handleDropOnCommittee(c.id, appId)}
                      onClickPanel={() => { if (selectedAppId) openDropModal(c.id, selectedAppId); }}
                      onRemoveAllocation={handleRemoveAllocation}
                      onOpenOverview={() => setOverviewCommitteeId(c.id)}
                    />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Chairs mode, mirrors delegates mode's anatomy: searchable
              unassigned rail on the left, drag/click-to-select committee
              cards on the right. No suggestions strip (no preference data). */}
          {mode === 'chairs' && (
            <div className="w-full">
              {/* No unassigned-chairs rail: chairs are invited per committee by
                  name + email. Masonry (CSS columns) so dais cards of different
                  heights pack tightly with no empty gaps between rows. */}
              <div className="columns-1 md:columns-2 2xl:columns-3" style={{ columnGap: '1rem' }}>
                {sortedCommittees.map(c => (
                  <div key={c.id} className="mb-4 break-inside-avoid">
                  <ChairBoardPanel
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
                  </div>
                ))}
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
          needy={needyCommitteeIds.has(dropModalCommittee.id)}
          pushDraftNotice={pushDraftNotice}
          onClose={() => setDropModal(null)}
          onConflict={payload => { setConflict({ committee: dropModalCommittee, ...payload }); setDropModal(null); }}
          onAssigned={(slot, seat, msg) => {
            // The insert already succeeded inside the modal (its button was
            // the only busy control), commit the same change locally and
            // swap in the real row id with a silent refetch.
            applyLocalAllocation(dropModalCommittee, dropModalApp, slot, seat);
            showFlash('ok', msg);
            setSelectedAppId(null);
            loadData({ silent: true });
          }}
        />
      )}

      {/* Delegation drop popup: open slots for a block seat handed to a society */}
      {societyDropModal && societyDropModalCommittee && societyDropModalSociety && (
        <SocietyDropAllocateModal
          committee={societyDropModalCommittee}
          society={societyDropModalSociety}
          onClose={() => setSocietyDropModal(null)}
          onAssigned={(slot, msg) => {
            // Insert already succeeded inside the modal; commit the society
            // row(s) locally and swap in the real row ids with a silent refetch.
            applyLocalSocietyAllocation(societyDropModalCommittee, societyDropModalSociety, slot);
            showFlash('ok', msg);
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
          preSelectedSeat={assignModal.preSeat}
          preSelectedApp={assignModal.preApp}
          moveFrom={assignModal.moveFrom}
          pushDraftNotice={pushDraftNotice}
          onClose={() => setAssignModal(null)}
          onConflict={payload => { setConflict({ committee: assignModalCommittee, ...payload }); setAssignModal(null); }}
          onAssigned={(app, slot, seat, sentEmail) => {
            // Writes already succeeded inside the modal, commit the same
            // change locally and fetch the real row id silently.
            applyLocalAllocation(assignModalCommittee, app, slot, seat, sentEmail);
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
          onAssignSlot={(slot, seat) => setAssignModal({ committeeId: overviewCommittee.id, preSlot: slot, preSeat: seat })}
          onChangeAllocation={async (alloc) => {
            // "Change seat" moves THIS delegate to a different country within
            // the same committee. The old row has to be freed before the new
            // one can be inserted (a delegate can only hold one seat per
            // committee), so unlike Deallocate this frees the seat WITHOUT
            // queuing allocation_removed — AssignModal fires a single
            // allocation_changed once the new seat actually lands.
            if (!session || !conference) return;
            const supabase = getAuthedClient(session.access_token);
            const committeeId = overviewCommittee.id;
            const { error } = await supabase.from('conference_allocations').delete().eq('id', alloc.id);
            if (error) { showFlash('err', 'Could not free that seat.'); return; }
            if (alloc.application_id) {
              await supabase.from('applications').update({
                status: 'accepted', assigned_committee_id: null, assigned_country_code: null, assigned_country_name: null,
                decided_by: session.user.id, decided_at: new Date().toISOString(),
              }).eq('id', alloc.application_id);
            }
            setCommittees(prev => prev.map(c => c.id === committeeId
              ? { ...c, conference_allocations: c.conference_allocations.filter(a => a.id !== alloc.id) }
              : c));
            setOverviewCommitteeId(null);
            setAssignModal({ committeeId, preApp: allocationToApp(alloc), moveFrom: alloc });
          }}
        />
      )}

      {/* Delegation-purity safeguard: another delegation holds the other seat
          of this double country. */}
      {conflict && (
        <DelegationConflictModal
          committee={conflict.committee}
          app={conflict.app}
          slot={conflict.slot}
          seat={conflict.seat}
          sibling={conflict.sibling}
          pushDraftNotice={pushDraftNotice}
          onClose={() => setConflict(null)}
          onResolved={(msg, removedSiblingId) => {
            // Patch local state immediately (drop the removed sibling row,
            // commit the new one) instead of waiting on the silent refetch,
            // consistent with every other assignment path on this page.
            if (removedSiblingId) {
              setCommittees(prev => prev.map(c =>
                c.id === conflict.committee.id
                  ? { ...c, conference_allocations: c.conference_allocations.filter(a => a.id !== removedSiblingId) }
                  : c
              ));
            }
            applyLocalAllocation(conflict.committee, conflict.app, conflict.slot, conflict.seat);
            setConflict(null);
            showFlash('ok', msg);
            loadData({ silent: true });
          }}
        />
      )}

      {confirmModal}

      {/* Floating action-feedback toasts (fixed overlay, never shifts layout) */}
      <ToastHost />
    </div>
  );
}
