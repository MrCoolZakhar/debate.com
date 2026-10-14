// ============================================================
// src/lib/awards.ts
//
// The single vocabulary for delegate awards across the whole product.
//
// HOW AWARDS WORK IN MUN (the model this file encodes)
// Awards are decided once per conference, at the end of the final session,
// and announced at the closing ceremony. Per committee the dais (the chairs)
// deliberates and names a Best Delegate, usually one or two Outstanding
// Delegates, a few Honourable Mentions scaled to committee size, sometimes
// Verbal Commendations (spoken, no certificate) and a Best Position Paper
// (a written award). The secretariat sets the categories and quotas in
// advance, collects every committee's slate, ratifies it (checks quotas,
// conflicts, spelling on certificates) and only then publishes. Delegation
// awards (Best Delegation, Best Small Delegation) go to a school or society
// and are tallied by the secretariat from the committee awards.
//
// HOW GAVELLING MAPS IT
//   conferences.awards_config        the categories, quotas, points, deadline,
//                                    whether the secretariat must ratify
//   conference_awards                one row per honour: nominated → approved
//                                    → published (status column)
//   conference_committees.awards_*   the per-committee slate lifecycle stamps
//                                    (submitted / approved / return note)
//   conferences.awards_published_at  the ceremony moment
//   publish_conference_awards()      SQL: flips rows to published and mints
//                                    ONE gavelling_verified MUN CV entry per
//                                    recipient per conference. Gavelling
//                                    Points were retired in prompt 48: this
//                                    no longer writes points_ledger.
//
// The organiser sets awards up in Manage → Settings → Awards (11 Oct 2026:
// blank slate, one question, presets in categories, custom awards; shared or
// per committee). Until `setUp` is true NOTHING about awards is offered to
// chairs (`awardsOfferedFor`). Chairs nominate from their conference page
// (ChairParticipant → AwardsCard) with the session scoreboard beside them as
// evidence. The secretariat desk (/manage/[slug]/awards) is retired for now. Delegates see their
// honours on their conference page and their MUN CV after publication, never
// before: the RLS on conference_awards only exposes published rows.
//
// RULES
// - `award_type` keys are stable identifiers; labels are what people see.
//   Never rename a key (it is what the CV pipeline and points fallback match).
// - `points` on each type is inert since prompt 48: award_points_for() was
//   dropped from the database and nothing credits it any more. Left in the
//   shape (never read for crediting) so a stored config still parses.
// - Anonymous (standalone) sessions never show award UI (PRD rule 8). Gate on
//   `session_origin === 'conference'` before linking here from a session.
// ============================================================

import type { ScoreboardDelegateRow } from './conferenceScoreboard';

export type AwardTier = 'gold' | 'silver' | 'bronze' | 'special';
export type AwardScope = 'committee' | 'conference';

export interface AwardTypeConfig {
  /** Stable identifier, kebab-case. Custom awards get `custom-<slug>`. */
  key: string;
  label: string;
  tier: AwardTier;
  /** 'committee' = one slate per committee; 'conference' = delegation award picked by the secretariat. */
  scope: AwardScope;
  /** How many of this award each committee gives (committee scope only). */
  perCommittee: number;
  /** Inert since prompt 48 (Gavelling Points retired): kept only so a
   *  stored config still parses, never read for crediting. */
  points: number;
  enabled: boolean;
  builtin: boolean;
  /** One line shown to chairs beside the slot. */
  description: string;
  /** Custom awards only (13 Oct 2026): the conference_committee ids that give
   *  it. Absent or empty = every committee. `configForCommittee` drops the
   *  award for any committee not listed, so its chairs are never offered it. */
  committees?: string[];
}

/** One committee's own awards (Settings → Awards, "No, set them per committee"). */
export interface CommitteeAwardSet {
  types: AwardTypeConfig[];
}

export interface AwardsConfig {
  /** Stored `enabled !== false` AND `setUp`. Every reader gates on this, so a
   *  conference that never set awards up reads as off everywhere (11 Oct 2026). */
  enabled: boolean;
  /** The organiser finished the first question in Settings → Awards. Absent on
   *  every config written before 11 Oct 2026, which therefore read as NOT set up. */
  setUp: boolean;
  /** true = one shared set (`types`) for every committee; false = committees may
   *  carry their own set in `perCommittee`, inheriting `types` until they do. */
  sameForAll: boolean;
  /** conference_committee_id → that committee's own set. Read only while
   *  `sameForAll` is false; kept when switching back so nothing is lost. */
  perCommittee: Record<string, CommitteeAwardSet>;
  /** true = the secretariat must approve each committee's slate before it can be published. */
  requireApproval: boolean;
  /** ISO timestamp chairs must submit by. null = the conference end date. */
  chairDeadline: string | null;
  /** Stamped the first time an organiser saves the awards setup; drives the dashboard checklist. */
  configuredAt: string | null;
  types: AwardTypeConfig[];
}

export const DEFAULT_AWARD_TYPES: AwardTypeConfig[] = [
  {
    key: 'best-delegate', label: 'Best Delegate', tier: 'gold', scope: 'committee',
    perCommittee: 1, points: 100, enabled: true, builtin: true,
    description: 'Led the room: research, speeches, bloc-building and drafting, all conference long.',
  },
  {
    key: 'outstanding-delegate', label: 'Outstanding Delegate', tier: 'silver', scope: 'committee',
    perCommittee: 1, points: 60, enabled: true, builtin: true,
    description: 'Consistently strong contributions that shaped the debate.',
  },
  {
    key: 'honourable-mention', label: 'Honourable Mention', tier: 'silver', scope: 'committee',
    perCommittee: 2, points: 30, enabled: true, builtin: true,
    description: 'A clear step above the floor: recognised, not ranked.',
  },
  {
    key: 'most-improved', label: 'Most Improved', tier: 'bronze', scope: 'committee',
    perCommittee: 1, points: 0, enabled: false, builtin: true,
    description: 'Grew the most over the conference, from first speech to last.',
  },
  {
    key: 'best-position-paper', label: 'Best Position Paper', tier: 'bronze', scope: 'committee',
    perCommittee: 1, points: 30, enabled: true, builtin: true,
    description: 'The strongest written preparation submitted before the conference.',
  },
  {
    key: 'verbal-commendation', label: 'Verbal Commendation', tier: 'bronze', scope: 'committee',
    perCommittee: 2, points: 10, enabled: false, builtin: true,
    description: 'A spoken thank-you for one memorable contribution. No certificate.',
  },
  {
    key: 'best-delegation', label: 'Best Delegation', tier: 'gold', scope: 'conference',
    perCommittee: 0, points: 0, enabled: false, builtin: true,
    description: 'The school or society whose delegates collected the most honours.',
  },
  {
    key: 'best-small-delegation', label: 'Best Small Delegation', tier: 'silver', scope: 'conference',
    perCommittee: 0, points: 0, enabled: false, builtin: true,
    description: 'Best Delegation among societies sending five delegates or fewer.',
  },
];

export const DEFAULT_AWARDS_CONFIG: AwardsConfig = {
  enabled: false,
  setUp: false,
  sameForAll: true,
  perCommittee: {},
  requireApproval: true,
  chairDeadline: null,
  configuredAt: null,
  types: DEFAULT_AWARD_TYPES,
};

/** Weight used to tally delegation standings from committee honours. */
export const AWARD_WEIGHT: Record<string, number> = {
  'best-delegate': 5,
  'outstanding-delegate': 3,
  'honourable-mention': 2,
  'best-position-paper': 1,
  'verbal-commendation': 1,
  'most-improved': 1,
};

// ── Presets offered in Settings → Awards (11 Oct 2026) ──────────────────────
// Grouped the way an organiser thinks about them. Keys are the stable
// award_type identifiers above; `names` are label suggestions (the first is
// the default). Custom awards are `custom-<slug>` (awardKeyFromLabel).

export interface AwardPreset {
  key: string;
  /** 1, 2, 3 for the placements; null for the others. */
  place: number | null;
  /** Label options; the organiser may also type their own. */
  names: string[];
  /** Fluent 3D emoji name for Emoji3D. */
  emoji: string;
  /** Per committee when first switched on. */
  defaultCount: number;
  /** One short line on the card. */
  line: string;
}

export const AWARD_PRESET_GROUPS: { id: 'placements' | 'other'; title: string; presets: AwardPreset[] }[] = [
  {
    id: 'placements',
    title: 'Placements',
    presets: [
      { key: 'best-delegate', place: 1, names: ['Best Delegate', 'Diplomacy Award'], emoji: '1st place medal', defaultCount: 1, line: 'First place' },
      { key: 'outstanding-delegate', place: 2, names: ['Outstanding Delegate'], emoji: '2nd place medal', defaultCount: 1, line: 'Second place' },
      { key: 'honourable-mention', place: 3, names: ['Honourable Mention'], emoji: '3rd place medal', defaultCount: 2, line: 'Third place' },
    ],
  },
  {
    id: 'other',
    title: 'Other awards',
    presets: [
      { key: 'most-improved', place: null, names: ['Most Improved'], emoji: 'Chart increasing', defaultCount: 1, line: 'Grew the most' },
      { key: 'verbal-commendation', place: null, names: ['Verbal Commendation'], emoji: 'Speaking head', defaultCount: 1, line: 'Said out loud' },
      { key: 'best-position-paper', place: null, names: ['Best Position Paper'], emoji: 'Scroll', defaultCount: 1, line: 'Best written paper' },
    ],
  },
];

export const PRESET_KEYS: ReadonlySet<string> = new Set(AWARD_PRESET_GROUPS.flatMap((g) => g.presets.map((p) => p.key)));

/**
 * The set a brand-new setup starts from: the three placements switched on,
 * everything else off, counts at each preset's default. Delegation awards
 * (conference scope) stay off: they need the secretariat desk, which is retired.
 */
export function freshAwardTypes(): AwardTypeConfig[] {
  const preset = new Map(AWARD_PRESET_GROUPS.flatMap((g) => g.presets).map((p) => [p.key, p]));
  return DEFAULT_AWARD_TYPES.map((t) => {
    const p = preset.get(t.key);
    if (!p) return { ...t, enabled: false };
    return { ...t, label: p.names[0], perCommittee: p.defaultCount, enabled: p.place !== null };
  });
}

export function awardKeyFromLabel(label: string): string {
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `custom-${slug || 'award'}`;
}

/** Parses a stored `types` list: built-ins in canonical order with stored overrides, then custom types in stored order. */
function parseTypes(raw: unknown): AwardTypeConfig[] {
  const storedTypes: Partial<AwardTypeConfig>[] = Array.isArray(raw)
    ? (raw as Partial<AwardTypeConfig>[]).filter((t) => t && typeof t.key === 'string')
    : [];
  const byKey = new Map(storedTypes.map((t) => [t.key as string, t]));

  const types: AwardTypeConfig[] = DEFAULT_AWARD_TYPES.map((def) => {
    const s = byKey.get(def.key);
    if (!s) return { ...def };
    return {
      ...def,
      label: typeof s.label === 'string' && s.label.trim() ? s.label.trim() : def.label,
      perCommittee: clampInt(s.perCommittee, def.perCommittee, 0, 10),
      points: clampInt(s.points, def.points, 0, 1000),
      enabled: typeof s.enabled === 'boolean' ? s.enabled : def.enabled,
    };
  });
  const seen = new Set(types.map((t) => t.key));
  for (const s of storedTypes) {
    const key = s.key as string;
    if (seen.has(key)) continue;
    seen.add(key);
    types.push({
      key,
      label: typeof s.label === 'string' && s.label.trim() ? s.label.trim() : 'Custom award',
      tier: isTier(s.tier) ? s.tier : 'special',
      scope: s.scope === 'conference' ? 'conference' : 'committee',
      perCommittee: clampInt(s.perCommittee, 1, 0, 10),
      points: clampInt(s.points, 0, 0, 1000),
      enabled: s.enabled !== false,
      builtin: false,
      description: typeof s.description === 'string' ? s.description : '',
      ...(Array.isArray(s.committees) && s.committees.some((x) => typeof x === 'string')
        ? { committees: s.committees.filter((x): x is string => typeof x === 'string') }
        : {}),
    });
  }
  return types;
}

/**
 * Reads `conferences.awards_config` into a full AwardsConfig.
 *
 * SET-UP RULE (11 Oct 2026, owner: "If a conference does not set up awards,
 * never offer it to chairs"): a blob without `setUp: true` is NOT set up, and
 * `enabled` is then false, whatever else it holds. That includes `{}` (which
 * used to mean "platform defaults"). The eight configs saved by the old
 * settings screen (with `configuredAt` and `types`) count as set up, as one
 * shared set. Published awards are unaffected: they are
 * read by status, never through this flag.
 */
export function getAwardsConfig(raw: unknown): AwardsConfig {
  const blob = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  // A config the old settings screen saved on purpose (it stamped
  // `configuredAt` and wrote `types`) counts as set up: those organisers chose
  // their awards, so their chairs keep them. Only `{}` / never-touched blobs
  // are "not set up".
  const legacyConfigured = typeof blob.configuredAt === 'string' && Array.isArray(blob.types);
  const setUp = blob.setUp === true || legacyConfigured;
  const perCommittee: Record<string, CommitteeAwardSet> = {};
  if (blob.perCommittee && typeof blob.perCommittee === 'object' && !Array.isArray(blob.perCommittee)) {
    for (const [id, v] of Object.entries(blob.perCommittee as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const rawTypes = (v as { types?: unknown }).types;
      if (!Array.isArray(rawTypes)) continue;
      perCommittee[id] = { types: parseTypes(rawTypes) };
    }
  }
  return {
    enabled: blob.enabled !== false && setUp,
    setUp,
    sameForAll: blob.sameForAll !== false,
    perCommittee,
    requireApproval: blob.requireApproval !== false,
    chairDeadline: typeof blob.chairDeadline === 'string' && blob.chairDeadline ? blob.chairDeadline : null,
    configuredAt: typeof blob.configuredAt === 'string' && blob.configuredAt ? blob.configuredAt : null,
    types: parseTypes(blob.types),
  };
}

/** Whether this committee gives its own awards (false = it uses the shared set). */
export function committeeHasOwnAwards(config: AwardsConfig, committeeId: string | null | undefined): boolean {
  return !config.sameForAll && !!committeeId && !!config.perCommittee[committeeId];
}

/**
 * The config as ONE committee sees it: `types` replaced by that committee's own
 * set when the conference sets awards per committee and this one has its own.
 * Everything else (slots, completeness, suggestions) then works unchanged.
 */
export function configForCommittee(config: AwardsConfig, committeeId: string | null | undefined): AwardsConfig {
  const base = committeeHasOwnAwards(config, committeeId) ? config.perCommittee[committeeId as string].types : config.types;
  if (!committeeId) return base === config.types ? config : { ...config, types: base };
  return { ...config, types: base.filter((t) => awardGivenBy(t, committeeId)) };
}

/** Does this committee give this award? A custom award may name its committees. */
export function awardGivenBy(t: AwardTypeConfig, committeeId: string): boolean {
  return !t.committees || t.committees.length === 0 || t.committees.includes(committeeId);
}

/**
 * Committees whose chairs sent their slate for approval and are waiting on the
 * organisers (13 Oct 2026): submitted, not approved, and not already published
 * (a committee is published when it has awards and all of them are). A return
 * clears both stamps, so it stops counting at once.
 */
export function awardsWaitingCount(
  committees: { id: string; awards_submitted_at: string | null; awards_approved_at: string | null }[],
  rows: { conference_committee_id: string | null; status: string }[],
): number {
  const byCommittee = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.conference_committee_id) continue;
    const list = byCommittee.get(r.conference_committee_id) ?? [];
    list.push(r.status);
    byCommittee.set(r.conference_committee_id, list);
  }
  return committees.filter((c) => {
    if (!c.awards_submitted_at || c.awards_approved_at) return false;
    const st = byCommittee.get(c.id) ?? [];
    return !(st.length > 0 && st.every((x) => x === 'published'));
  }).length;
}

/**
 * The one gate for every chair-facing awards affordance: set up, switched on,
 * and at least one award this committee gives. Published awards are shown by
 * their own readers and never pass through here.
 */
export function awardsOfferedFor(config: AwardsConfig, committeeId: string | null | undefined): boolean {
  if (!config.enabled || !config.setUp) return false;
  return committeeSlots(configForCommittee(config, committeeId)).length > 0;
}

function clampInt(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function isTier(v: unknown): v is AwardTier {
  return v === 'gold' || v === 'silver' || v === 'bronze' || v === 'special';
}

/** Committee-scope, enabled, at least one per committee — the slots a chair fills. */
export function committeeSlots(config: AwardsConfig): AwardTypeConfig[] {
  return config.types.filter((t) => t.enabled && t.scope === 'committee' && t.perCommittee > 0);
}

/** Conference-scope, enabled — the delegation awards the secretariat assigns. */
export function delegationAwardTypes(config: AwardsConfig): AwardTypeConfig[] {
  return config.types.filter((t) => t.enabled && t.scope === 'conference');
}

/** The moment chairs must submit by. Falls back to 23:59 local on the conference end date. */
export function chairDeadline(config: AwardsConfig, conferenceEndDate: string | null): Date | null {
  if (config.chairDeadline) return new Date(config.chairDeadline);
  if (conferenceEndDate) return new Date(`${conferenceEndDate}T23:59:59`);
  return null;
}

// ── Rows ─────────────────────────────────────────────────────────────────────

export type AwardStatus = 'nominated' | 'approved' | 'published';

/** A `conference_awards` row as selected by AWARD_COLUMNS. */
export interface ConferenceAwardRow {
  id: string;
  conference_id: string;
  conference_committee_id: string | null;
  user_id: string | null;
  assigned_by: string;
  award_type: string;
  award_label: string;
  country_code: string | null;
  country_name: string | null;
  society_id: string | null;
  allocation_id: string | null;
  recipient_name: string | null;
  points_awarded: number;
  status: AwardStatus;
  rationale: string | null;
  position: number;
  published_at: string | null;
  created_at: string;
}

export const AWARD_COLUMNS =
  'id, conference_id, conference_committee_id, user_id, assigned_by, award_type, award_label, country_code, country_name, society_id, allocation_id, recipient_name, points_awarded, status, rationale, position, published_at, created_at';

// ── Slate lifecycle ──────────────────────────────────────────────────────────

export type SlateState =
  | 'off'         // awards disabled for the conference
  | 'open'        // chairs may nominate
  | 'returned'    // secretariat sent it back with a note; chairs may edit again
  | 'submitted'   // chairs handed it in; waiting for the secretariat
  | 'approved'    // ratified; locked for chairs
  | 'published';  // announced; visible to delegates

export interface SlateStamps {
  awards_submitted_at: string | null;
  awards_approved_at: string | null;
  awards_return_note: string | null;
}

export function slateState(
  committee: SlateStamps,
  conferencePublishedAt: string | null,
  config: AwardsConfig,
): SlateState {
  // Published first: a ceremony that already happened stays visible even if
  // awards were later switched off or never marked set up.
  if (conferencePublishedAt) return 'published';
  if (!config.enabled) return 'off';
  if (committee.awards_approved_at) return 'approved';
  if (committee.awards_submitted_at) return 'submitted';
  if (committee.awards_return_note) return 'returned';
  return 'open';
}

export const SLATE_STATE_LABEL: Record<SlateState, string> = {
  off: 'Awards off',
  open: 'Not submitted',
  returned: 'Returned',
  submitted: 'Submitted',
  approved: 'Approved',
  published: 'Published',
};

/** Whether the chair may still edit (mirrors `committee_awards_locked()` plus the submitted state). */
export function chairCanEdit(state: SlateState): boolean {
  return state === 'open' || state === 'returned';
}

/** Quota check for one committee's rows against the configured slots. */
export function slateCompleteness(rows: ConferenceAwardRow[], config: AwardsConfig) {
  const slots = committeeSlots(config);
  let filled = 0;
  let total = 0;
  const over: string[] = [];
  const missing: string[] = [];
  for (const slot of slots) {
    const n = rows.filter((r) => r.award_type === slot.key).length;
    total += slot.perCommittee;
    filled += Math.min(n, slot.perCommittee);
    if (n > slot.perCommittee) over.push(slot.label);
    if (n < slot.perCommittee) missing.push(slot.label);
  }
  return { filled, total, over, missing, complete: filled === total && over.length === 0 };
}

// ── Evidence: suggestions from the session scoreboard ───────────────────────

export interface PaperEvidence {
  country_code: string;
  status: string; // submitted | reviewed | approved | rejected
}

/**
 * A starting slate from the quantitative record: rank by the blended headline
 * score, hand out the committee slots top-down, and give Best Position Paper
 * to the highest-ranked delegate whose paper the chairs approved. Observers
 * and absent delegates are skipped. Returns country → award keys; the chair
 * edits from there, it is never applied silently.
 */
export function suggestSlate(
  rows: ScoreboardDelegateRow[],
  config: AwardsConfig,
  papers: PaperEvidence[] = [],
  countryCodeByName: Record<string, string> = {},
): Record<string, string[]> {
  const ranked = [...rows]
    .filter((r) => !r.isObserver && r.status !== 'absent')
    .sort((a, b) => b.headline - a.headline || b.speakingSeconds - a.speakingSeconds || a.country.localeCompare(b.country));
  const out: Record<string, string[]> = {};
  const taken = new Set<string>();
  const give = (country: string, key: string) => {
    (out[country] ??= []).push(key);
  };

  const approvedPapers = new Set(papers.filter((p) => p.status === 'approved').map((p) => p.country_code));
  for (const slot of committeeSlots(config)) {
    if (slot.key === 'best-position-paper') continue;
    // The record cannot tell who improved most: the chairs' call, never suggested.
    if (slot.key === 'most-improved') continue;
    let n = 0;
    for (const r of ranked) {
      if (n >= slot.perCommittee) break;
      if (taken.has(r.country)) continue;
      taken.add(r.country);
      give(r.country, slot.key);
      n += 1;
    }
  }
  const bpp = committeeSlots(config).find((s) => s.key === 'best-position-paper');
  if (bpp && approvedPapers.size > 0) {
    const pick = ranked.find((r) => approvedPapers.has(countryCodeByName[r.country] ?? r.country));
    if (pick) give(pick.country, bpp.key);
  }
  return out;
}

/** 1-based rank of a country by headline within its committee rows. */
export function rankByHeadline(rows: ScoreboardDelegateRow[]): Map<string, number> {
  const ranked = [...rows]
    .filter((r) => !r.isObserver)
    .sort((a, b) => b.headline - a.headline || b.speakingSeconds - a.speakingSeconds);
  const map = new Map<string, number>();
  ranked.forEach((r, i) => map.set(r.country, i + 1));
  return map;
}

// ── Delegation standings ─────────────────────────────────────────────────────

export interface DelegationStanding {
  societyId: string;
  societyName: string;
  delegates: number;
  points: number;
  honours: number;
}

/**
 * Tally committee awards by society using AWARD_WEIGHT. `societyByAllocation`
 * maps allocation_id → { societyId, societyName }; `delegatesBySociety` is the
 * society's total allocated seats (for the small-delegation cut-off).
 */
export function delegationStandings(
  rows: ConferenceAwardRow[],
  societyByAllocation: Record<string, { societyId: string; societyName: string }>,
  delegatesBySociety: Record<string, number>,
): DelegationStanding[] {
  const acc = new Map<string, DelegationStanding>();
  for (const r of rows) {
    if (!r.allocation_id) continue;
    const s = societyByAllocation[r.allocation_id];
    if (!s) continue;
    const cur = acc.get(s.societyId) ?? {
      societyId: s.societyId, societyName: s.societyName,
      delegates: delegatesBySociety[s.societyId] ?? 0, points: 0, honours: 0,
    };
    cur.points += AWARD_WEIGHT[r.award_type] ?? 1;
    cur.honours += 1;
    acc.set(s.societyId, cur);
  }
  return [...acc.values()].sort((a, b) => b.points - a.points || b.honours - a.honours || a.societyName.localeCompare(b.societyName));
}

export const SMALL_DELEGATION_MAX = 5;
