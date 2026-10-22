// ── The seat-fit engine ──────────────────────────────────────────────────────
// Every score, reason chip and suggestion the organiser's Assignment page shows
// comes from here: preference matching, the experience / difficulty fit, the
// fill and importance nudges, the delegation (society) rules (purity skip,
// pair bonus, concentration penalty with the spread exception), the greedy
// suggestion builder and its swap-improvement pass.
//
// Pure on purpose: no React, no Supabase, no I/O. It was lifted out of
// `src/app/manage/[slug]/assignment/page.tsx` unchanged (owner, 21 Oct 2026)
// so the new seat board and, later, the Applications pop-up score a seat with
// exactly the numbers the board ranks by. The types below are the smallest
// shapes the engine reads; the page's own row types (AcceptedApp,
// CommitteeData, SlotRow, AllocationRow) satisfy them structurally.

export interface FitPref {
  preference_order: number;
  country_code: string;
  country_name: string;
  conference_committee_id: string;
}

export interface FitApp {
  id: string;
  experience_level: string | null;
  society_id: string | null;
  invited_name: string | null;
  profiles: { id?: string; display_name?: string | null; mun_experience_level?: string | null } | null;
  application_preferences: readonly FitPref[];
}

/** What every "is this seat open" check reads off a slot. */
export interface FitSlotSize {
  country_code: string;
  delegation_size: number;
}

export interface FitSlot extends FitSlotSize {
  id: string;
  country_name: string;
  importance: ImportanceTier;
}

/** What the open-seat checks read off an allocation row. */
export interface FitSeatRow {
  country_code: string;
  seat: number;
}

export interface FitAllocation extends FitSeatRow {
  society_id?: string | null;
  applications?: { society_id?: string | null } | null;
}

export interface FitCommittee {
  id: string;
  difficulty?: string | null;
  total_slots: number;
  committee_country_slots: readonly FitSlot[];
  conference_allocations: readonly FitAllocation[];
}

/** Allocation rows of one committee, grouped by country (groupAllocationsByCountry). */
export type SeatsByCountry = ReadonlyMap<string, readonly FitSeatRow[]>;

// Importance tiers. Mapping: green = LOW importance to the committee,
// yellow/gold = MEDIUM, red = HIGH. 'standard' = unrated (neutral). This
// matches the setup editor's canonical mapping (ConferenceRosterPicker.tsx).
export type ImportanceTier = 'standard' | 'high' | 'medium' | 'low';

// ── Double-delegation seat helpers ────────────────────────────────────────────
// Groups allocation rows by country_code (each group sorted by seat ascending),
// the shared building block every "is this country/seat open" check now uses
// instead of the old one-row-per-country Map/Set.
export function groupAllocationsByCountry<A extends FitSeatRow>(allocations: readonly A[]): Map<string, A[]> {
  const map = new Map<string, A[]>();
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
export function isSlotFull(slot: FitSlotSize, byCountry: SeatsByCountry): boolean {
  return (byCountry.get(slot.country_code)?.length ?? 0) >= slot.delegation_size;
}

// Lowest seat number (1-based) not currently occupied for this slot. Used by
// every assignment path that doesn't have an explicit seat choice.
export function lowestOpenSeat(slot: FitSlotSize, byCountry: SeatsByCountry): number {
  const taken = new Set((byCountry.get(slot.country_code) ?? []).map(a => a.seat));
  for (let s = 1; s <= slot.delegation_size; s++) if (!taken.has(s)) return s;
  return slot.delegation_size;
}

// The delegation (society) behind an allocation row: its own society_id if
// it's a block seat, else the society_id of the application behind it.
export function allocationSocietyId(a: FitAllocation): string | null {
  return a.society_id ?? a.applications?.society_id ?? null;
}

// The row occupying the OTHER seat of a double country when exactly one of
// its two seats is currently held — the delegation-purity safeguard only
// applies in that exact situation (single-seat countries, empty double
// countries, and already-full double countries are all unaffected).
export function siblingSeatAllocation<A extends FitAllocation>(slot: FitSlotSize, byCountry: ReadonlyMap<string, readonly A[]>): A | null {
  if (slot.delegation_size < 2) return null;
  const rows = byCountry.get(slot.country_code) ?? [];
  return rows.length === 1 ? rows[0] : null;
}

// Distinct allocated COUNTRIES (not seats) — the "filled" numerator against
// total_slots everywhere a committee shows a fill count. A double country
// with only one seat taken still counts as filled-in-progress.
export function distinctCountryFilled(allocations: readonly { country_code: string }[]): number {
  return new Set(allocations.map(a => a.country_code)).size;
}

// ── Scoring ───────────────────────────────────────────────────────────────────
// SCORES ARE OUT OF 100 (owner, 22 Oct 2026: "scores out of 100, shown as a
// percentage", with a traffic light: 80 to 100 green, 60 to 79 amber, under 60
// red). The ratios between the parts are the ones the engine always used; only
// the scale moved. The old raw weights were preference 50 / 30 / 15, exact
// country 25, experience +20 / 0 / -15 / -30, room fill up to 24, importance
// 18 / 10 / 4, pair +35, concentration -20, member pick 25. The best seat one
// person can get adds up the positive person parts at their maximum:
//   1st choice 50 + exact country 25 + level match 20 + empty room 24 + high seat 18 = 137.
// Every part is scaled by 100 / 137 and rounded, so that best seat is exactly
// 100 (FIT_MAX) and every penalty keeps its proportion:
//   preference:  1st choice committee +36, 2nd +22, 3rd +11 (PREF_POINTS)
//                +18 more if the slot is the exact country they asked for in
//                that preference (COUNTRY_PICK_POINTS)
//   experience:  a SYMMETRIC difficulty-match term keyed on the gap between the
//                delegate's experience level and the committee's difficulty:
//                gap 0 → +15, gap 1 → 0, gap 2 → −11, gap 3 → −22. See
//                EXPERIENCE_GAP_SCORE / experienceFitScore. Neutral (0, no chip)
//                when either side is unknown — never a silent penalty.
//   society:     (suggestions only) +26 to complete a valid same-society double
//                delegation, −15 to spread a clumping delegation, and a hard
//                skip for a cross-society sibling seat. See scoreSocietyFit.
//   room fill:   round(18 * (1 - seats filled / seats in the committee)), so an
//                emptier committee scores higher. Read off the SHARE of seats
//                taken (a double country is two seats), never a raw count, so a
//                small room and a big room at the same fill score the same.
//                See roomFill.
//   importance:  +13 / +7 / +3 / 0 for an open high / medium / low / standard
//                seat, so the algorithm fills seats — and the committees that
//                still hold them — in order of importance.
// The ranking itself uses the unclamped total (a pair completion on top of a
// perfect seat still ranks above a plain perfect seat); what a person READS
// is fitPercent(score): rounded and clamped to 0..100.
export const PREF_POINTS: readonly number[] = [36, 22, 11];
export const COUNTRY_PICK_POINTS = 18;

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
export const EXPERIENCE_LEVEL_RANK: Record<string, number> = {
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
export function experienceLevelRank(s: string | null | undefined): number | null {
  const r = EXPERIENCE_LEVEL_RANK[(s ?? '').toLowerCase().trim()];
  return r === undefined ? null : r;
}

// Importance-weighted need: an open high/medium-importance seat is a higher
// priority to fill than a standard one, so a committee still missing its
// high/medium seats scores higher as a target than one only missing standard
// seats. Mirrors the TIER_RANK urgency order (high > medium > low > standard).
export const IMPORTANCE_NEED_WEIGHT: Record<ImportanceTier, number> = { high: 13, medium: 7, low: 3, standard: 0 };

// Committee difficulty ordering for the default board sort (ascending): the
// gentlest committees first, hardest last. Mirrors the canonical DIFF_ORDER in
// the committees page EXACTLY — difficulty is strictly one of the four rungs and
// is NEVER inferred from committee_type (a general-assembly committee sorts by
// its own real `difficulty` field, not by being a GA). An unset/unknown
// difficulty sorts last (99), matching the committees board, rather than being
// silently treated as 'intermediate'.
export const DIFFICULTY_RANK: Record<string, number> = {
  beginner: 0, intermediate: 1, advanced: 2, expert: 3,
};
export function difficultyRank(d: string | null | undefined): number {
  return DIFFICULTY_RANK[(d ?? '').toLowerCase().trim()] ?? 99;
}
/** The SCORING-side read of committee difficulty: the same rung map as the
 *  board sort, but an unset/unrecognised difficulty comes back as `null`
 *  instead of the sort's "last" sentinel, so the fit term can stay neutral
 *  rather than treating a blank field as the hardest committee on the board. */
export function difficultyLevel(d: string | null | undefined): number | null {
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
//   gap 0 (exact match) → +15   a real, decisive reward
//   gap 1 (one rung)    →   0   acceptable stretch, neither rewarded nor punished
//   gap 2               → −11
//   gap 3               → −22
//
// Calibration against the rest of the model (preference 36/22/11, exact country
// pick 18, room fill up to 18, seat importance up to 13, society +26/−15; the old
// 50/30/15 scale times 100/137, see Scoring): the term spans 37 points end to
// end, about the width of the single largest signal in the model (a 1st-choice
// preference). That is deliberate — it makes difficulty match co-equal with
// preference rather than a rounding error. A 1st-choice seat two rungs off
// (36 − 11 = 25) about ties a 3rd-choice seat that fits perfectly (11 + 15 =
// 26), and a 1st choice three rungs off (36 − 22 = 14) loses outright to it.
// The +15 bonus sits between the 3rd- and 2nd-choice preference tiers: strong
// enough to reorder seats within a preference tier and to lift a well-fitted
// lower preference over a badly fitted higher one, but never so large that it
// alone outranks a whole preference step.
//
// The four-rung scales cap the gap at 3, so gap ≥ 4 is unreachable today. If a
// scale ever grows a rung, the penalty EXTRAPOLATES linearly at −11 per rung
// beyond gap 1 rather than clamping, keeping the curve consistent in both
// directions.
export const EXPERIENCE_MATCH_BONUS = 15;
export const EXPERIENCE_GAP_STEP = 11;
const EXPERIENCE_GAP_SCORE: Record<number, number> = {
  0: EXPERIENCE_MATCH_BONUS,
  1: 0,
  2: -EXPERIENCE_GAP_STEP,
  3: -2 * EXPERIENCE_GAP_STEP,
};
export function experienceGapScore(gap: number): number {
  const table = EXPERIENCE_GAP_SCORE[gap];
  // Beyond the table (only reachable if a scale grows a rung): keep going at
  // −EXPERIENCE_GAP_STEP per level, the same slope the table already describes.
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
export function experienceFitScore(
  app: Pick<FitApp, 'experience_level' | 'profiles'>,
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
  // The tag says WHICH WAY the mismatch goes (owner: "experience unmatched
  // doesn't say if their experience is too low or too high").
  if (points < 0) return { points, reasons: [expL < diffL ? `EXP TOO LOW ${points}` : `EXP TOO HIGH ${points}`] };
  return { points: 0, reasons: [] };
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

export function scorePrefAndExp(app: FitApp, committee: FitCommittee, slot: FitSlot | null): ScoreResult {
  let score = 0;
  const reasons: string[] = [];
  const prefs = [...(app.application_preferences ?? [])].sort((a, b) => a.preference_order - b.preference_order);
  const matchIdx = prefs.findIndex(p => p.conference_committee_id === committee.id);
  if (matchIdx === 0) { score += PREF_POINTS[0]; reasons.push('1ST CHOICE'); }
  else if (matchIdx === 1) { score += PREF_POINTS[1]; reasons.push('2ND CHOICE'); }
  else if (matchIdx === 2) { score += PREF_POINTS[2]; reasons.push('3RD CHOICE'); }
  if (slot && matchIdx >= 0 && prefs[matchIdx].country_code === slot.country_code) {
    score += COUNTRY_PICK_POINTS;
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

// ── Room fill ────────────────────────────────────────────────────────────────
// How much an emptier committee lifts a seat in it: up to ROOM_FILL_MAX for an
// empty room, 0 for a full one, linear in the SHARE of its seats still open
// (owner, 22 Oct 2026: count twice as much as the old 12, and from the
// percentage of seats filled, not raw counts; 24 on the old scale, 18 out of 100). Seats, not countries: a double
// country is two seats, and a seat counts as filled once an allocation row
// holds it (rows beyond a slot's delegation_size never count twice). A
// committee whose slots are not set up yet falls back to its countries
// against total_slots. A room with no seats at all reads as full (0 points).
export const ROOM_FILL_MAX = 18;

/** The best seat one person can get: 1st choice + exact country + level match
 *  + an empty room + a high-importance seat. 100 by construction (see Scoring). */
export const FIT_MAX = PREF_POINTS[0] + COUNTRY_PICK_POINTS + EXPERIENCE_MATCH_BONUS + ROOM_FILL_MAX + IMPORTANCE_NEED_WEIGHT.high;

/** What a person reads for a score: a whole percentage, 0 to 100. A pair
 *  completion can take the raw total past 100 and penalties below 0; both
 *  read as the edge. */
export function fitPercent(score: number): number {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, Math.round((score / FIT_MAX) * 100)));
}

/** The score's traffic light (owner, 22 Oct 2026): 80 to 100 green, 60 to 79
 *  amber, under 60 red. */
export type FitLight = 'green' | 'amber' | 'red';
export function fitLight(score: number): FitLight {
  const p = fitPercent(score);
  return p >= 80 ? 'green' : p >= 60 ? 'amber' : 'red';
}

export interface RoomFill {
  /** The points the room adds to every seat in it. */
  points: number;
  /** Seats filled, as a whole percentage (what the breakdown prints). */
  pctFull: number;
  seatsFilled: number;
  seatsTotal: number;
}

export function roomFill(committee: Pick<FitCommittee, 'total_slots' | 'committee_country_slots' | 'conference_allocations'>): RoomFill {
  let seatsTotal = 0;
  let seatsFilled = 0;
  if (committee.committee_country_slots.length > 0) {
    const byCountry = groupAllocationsByCountry(committee.conference_allocations);
    for (const s of committee.committee_country_slots) {
      const size = Math.max(0, s.delegation_size);
      seatsTotal += size;
      seatsFilled += Math.min(size, byCountry.get(s.country_code)?.length ?? 0);
    }
  } else {
    seatsTotal = Math.max(0, committee.total_slots);
    seatsFilled = Math.min(seatsTotal, distinctCountryFilled(committee.conference_allocations));
  }
  if (seatsTotal <= 0) return { points: 0, pctFull: 100, seatsFilled: 0, seatsTotal: 0 };
  const share = seatsFilled / seatsTotal;
  return {
    points: Math.round(ROOM_FILL_MAX * (1 - share)),
    pctFull: Math.round(share * 100),
    seatsFilled,
    seatsTotal,
  };
}

export function scoreSlot(app: FitApp, committee: FitCommittee, slot: FitSlot): ScoreResult {
  const base = scorePrefAndExp(app, committee, slot);
  base.score += roomFill(committee).points;
  // NB: the 'NEEDS DELEGATES' chip is NOT decided here. It is a GLOBAL signal —
  // a committee only "needs delegates" relative to how full the OTHER committees
  // are — so it is computed once across the whole board (see needyCommitteeIds)
  // and layered onto suggestions afterwards, not from this single committee's
  // fill in isolation. The room fill points above still nudge emptier committees.
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
//   2. COMPLETES PAIR (+26) — the taken half belongs to the applicant's OWN
//      society (both non-null and equal). Suggesting them here finishes a valid
//      same-society double delegation, so it earns a strong positive comparable
//      to a top preference tier. Returned BEFORE the concentration check, so a
//      genuine pair completion is never also penalised for "clumping". Carries
//      its own reason chip, "COMPLETES PAIR +26".
//   3. CONCENTRATION (−15) — not a pair completion, but a delegate from the
//      applicant's society is ALREADY allocated somewhere in this committee
//      (a delegation block seat counts). Suggesting them here would clump the
//      delegation, so we nudge them toward a different committee. Carries its
//      own reason chip too, "DELEGATION CONCENTRATION -15", so the downrank is
//      as legible as the bonus.
//      EXCEPT a delegation that is already spread: when it holds at least one
//      allocation in SPREAD_SHARE (70%) or more of the conference's committees
//      (committees with at least one seat), there is no concentration penalty
//      at all. A big delegation has to sit everywhere, so penalising it only
//      lowers every member's score for nothing (owner, 21 Oct 2026). The share
//      is worked out across the whole board by spreadSocieties and passed in.
//
// An independent applicant (society_id null) never gets the pair bonus or the
// concentration penalty; only the purity skip can apply to them.
// 35 and 20 on the old scale, times 100/137 (see Scoring).
export const PAIR_BONUS = 26;
export const CONCENTRATION_PENALTY = 15;
export const SPREAD_SHARE = 0.7;

/** The societies that already hold at least one allocation in SPREAD_SHARE or
 *  more of the conference's committees (committees with no seats are not
 *  counted). scoreSocietyFit skips the concentration penalty for them. */
export function spreadSocieties(committees: readonly FitCommittee[]): Set<string> {
  const seated = committees.filter(c => c.total_slots > 0 || c.committee_country_slots.length > 0);
  const spread = new Set<string>();
  if (seated.length === 0) return spread;
  const reach = new Map<string, number>();
  for (const c of seated) {
    const here = new Set<string>();
    for (const a of c.conference_allocations) {
      const soc = allocationSocietyId(a);
      if (soc) here.add(soc);
    }
    for (const soc of here) reach.set(soc, (reach.get(soc) ?? 0) + 1);
  }
  for (const [soc, n] of reach) if (n / seated.length >= SPREAD_SHARE) spread.add(soc);
  return spread;
}
// The flag on a suggestion the swap-improvement pass produced, so an
// organizer sees "this seat was traded for a better combined fit" rather
// than silently landing on a lower own-score seat than expected.
export const SWAP_REASON = 'SWAPPED FOR BETTER TOTAL FIT';
export interface SocietyFit { delta: number; reasons: string[]; disallowed: boolean; }
export function scoreSocietyFit(
  app: FitApp,
  committee: FitCommittee,
  slot: FitSlot,
  byCountry: ReadonlyMap<string, readonly FitAllocation[]>,
  spread: ReadonlySet<string>,
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
  // completion → spread them out, unless the delegation already reaches
  // SPREAD_SHARE of the committees.
  if (soc !== null && !spread.has(soc) && committee.conference_allocations.some(a => allocationSocietyId(a) === soc)) {
    return { delta: -CONCENTRATION_PENALTY, reasons: [`DELEGATION CONCENTRATION -${CONCENTRATION_PENALTY}`], disallowed: false };
  }
  return { delta: 0, reasons: [], disallowed: false };
}

export interface AllocationScore {
  /** base + societyDelta — the ONE number that must be rendered anywhere in
   *  this file that shows "this delegate's score on this slot". */
  total: number;
  /** scoreSlot's own score: preference, country pick, experience fit,
   *  room fill (roomFill), seat importance. */
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
export function allocationScore(
  app: FitApp,
  committee: FitCommittee,
  slot: FitSlot,
  byCountry: ReadonlyMap<string, readonly FitAllocation[]>,
  spread: ReadonlySet<string>,
): AllocationScore {
  const base = scoreSlot(app, committee, slot);
  const soc = scoreSocietyFit(app, committee, slot, byCountry, spread);
  return {
    total: base.score + soc.delta,
    base: base.score,
    societyDelta: soc.delta,
    reasons: [...base.reasons, ...soc.reasons],
    disallowed: soc.disallowed,
  };
}

// ── "Needs delegates": a RELATIVE signal across the whole board ──────────────
// A committee is flagged only when it is conspicuously behind the pack: its
// fill ratio is more than 25% below the SECOND-least-populated committee's.
// Comparing against the second-least (not the least, which is always the
// emptiest and would compare to itself) gives a stable baseline, so the flag
// highlights the one or two committees that genuinely trail the rest rather
// than firing on every under-half-full committee.
export function needyCommitteeIds(committees: readonly FitCommittee[]): Set<string> {
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
}

/** The chip every surface adds last, after the engine's own reasons. */
export const NEEDS_DELEGATES_REASON = 'NEEDS DELEGATES';

type SlotOf<C extends FitCommittee> = C['committee_country_slots'][number];

export interface FitSuggestion<A extends FitApp = FitApp, C extends FitCommittee = FitCommittee> {
  app: A;
  committee: C;
  slot: SlotOf<C>;
  score: number;
  reasons: string[];
  /** An exact seat of a double country, set only when the organiser picked
   *  it in the committee pop-up; otherwise the assign takes the lowest open seat. */
  seat?: number;
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

/** Everyone who already holds a seat (seatedIdentitiesIn on the page). */
export interface SeatedIdentities {
  appIds: ReadonlySet<string>;
  userIds: ReadonlySet<string>;
}

/** One open seat scored for one person (rankSeatsForPerson). `disallowed` is
 *  the purity rule: the other seat of this double country belongs to another
 *  delegation, so the suggestion builder never offers it; a pick list may
 *  still show it, and the page's assign path then asks how to resolve it. */
export type RankedSeat<A extends FitApp, C extends FitCommittee> = FitSuggestion<A, C> & { disallowed: boolean };

/** Every open seat in `committee` for this person, scored with the same
 *  allocationScore the builder uses, best first. Disallowed seats are left out
 *  unless `includeDisallowed`, and then come last. The "needs delegates" chip
 *  is layered on last, like the builder's. */
export function rankSeatsForPerson<A extends FitApp, C extends FitCommittee>(
  app: A,
  committee: C,
  spread: ReadonlySet<string>,
  needy?: ReadonlySet<string>,
  opts?: { includeDisallowed?: boolean },
): RankedSeat<A, C>[] {
  const byCountry = groupAllocationsByCountry(committee.conference_allocations);
  const out: RankedSeat<A, C>[] = [];
  for (const slot of committee.committee_country_slots as readonly SlotOf<C>[]) {
    if (isSlotFull(slot, byCountry)) continue;
    const scored = allocationScore(app, committee, slot, byCountry, spread);
    if (scored.disallowed && !opts?.includeDisallowed) continue;
    const reasons = needy?.has(committee.id) && !scored.reasons.includes(NEEDS_DELEGATES_REASON)
      ? [...scored.reasons, NEEDS_DELEGATES_REASON]
      : scored.reasons;
    out.push({ app, committee, slot, score: scored.total, reasons, disallowed: scored.disallowed });
  }
  out.sort((x, y) => Number(x.disallowed) - Number(y.disallowed) || y.score - x.score);
  return out;
}

/** The waiting people for ONE open seat, scored the same way, best first
 *  (the committee pop-up's "best 2 or 3" and its "Choose someone else" list). */
export function rankPeopleForSeat<A extends FitApp, C extends FitCommittee>(
  people: readonly A[],
  committee: C,
  slot: SlotOf<C>,
  spread: ReadonlySet<string>,
  needy?: ReadonlySet<string>,
  opts?: { includeDisallowed?: boolean },
): RankedSeat<A, C>[] {
  const byCountry = groupAllocationsByCountry(committee.conference_allocations);
  const out: RankedSeat<A, C>[] = [];
  for (const app of people) {
    const scored = allocationScore(app, committee, slot, byCountry, spread);
    if (scored.disallowed && !opts?.includeDisallowed) continue;
    const reasons = needy?.has(committee.id) && !scored.reasons.includes(NEEDS_DELEGATES_REASON)
      ? [...scored.reasons, NEEDS_DELEGATES_REASON]
      : scored.reasons;
    out.push({ app, committee, slot, score: scored.total, reasons, disallowed: scored.disallowed });
  }
  out.sort((x, y) => Number(x.disallowed) - Number(y.disallowed) || y.score - x.score);
  return out;
}

// ── Suggestions (global, across all committees) ─────────────────────────────
// Every accepted, attending applicant is a candidate — INCLUDING those with
// no committee preferences (common in real data). A preference-less delegate
// simply scores 0 on the preference terms; their suggestion is then driven
// by committee fill-need, the seat-importance signal and their experience /
// difficulty skill match, so they are never skipped here.
//
// `limit` caps how many suggestions the greedy pass hands out. The classic
// board's strip has always shown at most 6 (its default here); the seat board
// passes Infinity to list every waiting person who has a reachable seat.
export function buildSuggestions<A extends FitApp, C extends FitCommittee>(
  accepted: readonly A[],
  committees: readonly C[],
  opts: {
    seated: SeatedIdentities;
    spread: ReadonlySet<string>;
    needy: ReadonlySet<string>;
    limit?: number;
  },
): FitSuggestion<A, C>[] {
  const { seated: seatedIdentities, spread, needy: needyIds } = opts;
  const limit = opts.limit ?? 6;
  type Suggestion = FitSuggestion<A, C>;
  // For every candidate, rank ALL their open-seat options best-first (not just
  // their single best). Keeping the full ranked list is what lets the greedy
  // pass below fall through to a candidate's NEXT-best seat when their top pick
  // is claimed by someone else — instead of dropping them entirely. The old
  // code kept only each applicant's one best option, then discarded any whose
  // slot was already taken by a higher scorer, so several applicants sharing a
  // single best seat collapsed to one suggestion and the strip could show
  // fewer than 3 even with plenty of unassigned applicants and open seats.
  const ranked = accepted
    // isSlotFull filters SEATS. This filters PEOPLE, which nothing did: a
    // delegate whose application still read 'accepted' while an allocation
    // row existed for them was suggested on every single load, and every
    // click on that card failed on the one-seat-per-delegate index. user_id
    // is the fallback because an imported delegate's row may carry no
    // application_id.
    .filter(app => !seatedIdentities.appIds.has(app.id)
      && !(app.profiles?.id ? seatedIdentities.userIds.has(app.profiles.id) : false))
    .map(app => {
      const options: Suggestion[] = [];
      for (const c of committees) {
        const byCountry = groupAllocationsByCountry(c.conference_allocations);
        for (const slot of c.committee_country_slots as readonly SlotOf<C>[]) {
          if (isSlotFull(slot, byCountry)) continue;
          // allocationScore folds the base fit and the society-coherence
          // terms (purity skip / pair bonus / concentration penalty) into
          // the ONE total every display in this file renders. A disallowed
          // cross-society sibling seat is dropped here so it never reaches
          // the greedy or swap passes — keeping the whole builder
          // consistent (an option that can't exist is never a fall-through
          // target or a swap destination).
          const scored = allocationScore(app, c, slot, byCountry, spread);
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
    if (out.length >= limit) break;
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
  // reason about (the seat board's longer list stays well inside a frame for
  // a few hundred people).
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
    needyIds.has(s.committee.id) && !s.reasons.includes(NEEDS_DELEGATES_REASON)
      ? { ...s, reasons: [...s.reasons, NEEDS_DELEGATES_REASON] }
      : s
  );
}

// ── Seats for a whole delegation (the seat board's Delegations tab) ──────────
// A delegation is given block seats (society_id set, nobody on them). Which
// seats of a country slot it may take: every seat still open, but only when
// each seat already held there is its own (a double half held by another
// delegation or an independent is the purity rule again, never offered).
// The score is the seat's own part of allocationScore without a person:
// committee fill and seat importance, the pair bonus when it completes its
// own half-held double, the concentration penalty when it already sits in the
// room (skipped for a spread delegation), and a nudge for a seat one of its
// members asked for in a preference. Pure; nothing here reads or writes.

// 25 on the old scale, times 100/137 (see Scoring).
export const MEMBER_PICK_BONUS = 18;

/** The open seat numbers of `slot` this delegation may take, or [] when none. */
export function openSeatsForSociety<A extends FitAllocation>(
  slot: FitSlotSize,
  byCountry: ReadonlyMap<string, readonly A[]>,
  societyId: string,
): number[] {
  const rows = byCountry.get(slot.country_code) ?? [];
  if (rows.some(r => allocationSocietyId(r) !== societyId)) return [];
  const taken = new Set(rows.map(r => r.seat));
  const out: number[] = [];
  for (let s = 1; s <= slot.delegation_size; s++) if (!taken.has(s)) out.push(s);
  return out;
}

export interface SocietySeatOption<C extends FitCommittee = FitCommittee> {
  committee: C;
  slot: SlotOf<C>;
  /** The seat numbers a give takes: every open seat of the slot. */
  seats: number[];
  score: number;
  reasons: string[];
}

/** Every slot of `committee` this delegation may take, best first. */
export function rankSeatsForSociety<C extends FitCommittee>(
  societyId: string,
  committee: C,
  spread: ReadonlySet<string>,
  opts?: {
    needy?: ReadonlySet<string>;
    /** The delegation's members, whose preferences nudge a seat up. */
    members?: readonly Pick<FitApp, 'application_preferences'>[];
    /** Slots never given to a delegation (observer seats), by country code. */
    skip?: ReadonlySet<string>;
  },
): SocietySeatOption<C>[] {
  const byCountry = groupAllocationsByCountry(committee.conference_allocations);
  const fullness = roomFill(committee).points;
  const inRoom = committee.conference_allocations.some(a => allocationSocietyId(a) === societyId);
  const asked = new Map<string, number>();
  for (const m of opts?.members ?? []) {
    for (const p of m.application_preferences ?? []) {
      if (p.conference_committee_id === committee.id) asked.set(p.country_code, (asked.get(p.country_code) ?? 0) + 1);
    }
  }
  const out: SocietySeatOption<C>[] = [];
  for (const slot of committee.committee_country_slots as readonly SlotOf<C>[]) {
    if (opts?.skip?.has(slot.country_code)) continue;
    const seats = openSeatsForSociety(slot, byCountry, societyId);
    if (seats.length === 0) continue;
    let score = fullness + IMPORTANCE_NEED_WEIGHT[slot.importance];
    const reasons: string[] = [];
    if (slot.importance === 'high') reasons.push('HIGH PRIORITY');
    else if (slot.importance === 'medium') reasons.push('PRIORITY SEAT');
    const pair = seats.length < slot.delegation_size;
    if (pair) { score += PAIR_BONUS; reasons.push(`COMPLETES PAIR +${PAIR_BONUS}`); }
    else if (inRoom && !spread.has(societyId)) { score -= CONCENTRATION_PENALTY; reasons.push(`DELEGATION CONCENTRATION -${CONCENTRATION_PENALTY}`); }
    if (asked.has(slot.country_code)) { score += MEMBER_PICK_BONUS; reasons.push('MEMBER PICK'); }
    if (opts?.needy?.has(committee.id)) reasons.push(NEEDS_DELEGATES_REASON);
    out.push({ committee, slot, seats, score, reasons });
  }
  out.sort((x, y) => y.score - x.score || x.slot.country_name.localeCompare(y.slot.country_name));
  return out;
}
