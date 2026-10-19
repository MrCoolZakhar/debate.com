// societySeats.ts: which seats a delegation holds, which seats are free, and
// ONE suggested set of countries that fits the spots still needing a seat.
//
// Pure, no I/O. The Delegations tab, the delegation pop-up's Seats tab and the
// allocation page all read the conference's committees with their
// `committee_country_slots` and `conference_allocations` and hand them here,
// so a "free seat" means the same thing on every screen.
//
// Rules:
//   - A seat is one person. A double delegation slot (`delegation_size` 2) is
//     two seats, and counts as 2 everywhere.
//   - A delegation is given WHOLE country slots (a block seat takes every seat
//     of the country in that committee, as the assignment page does), so only
//     a slot with no allocation at all is free to give.
//   - Observer slots are never given to a delegation.
//   - A delegation holds an allocation when the row carries its `society_id`
//     (a block seat, filled or not) or belongs to one of its members.
//     A seat is FILLED when a person is on it.

export interface SeatSlot {
  id: string;
  country_code: string;
  country_name: string;
  delegation_size: number;
  is_observer?: boolean | null;
}

export interface SeatAllocation {
  id: string;
  country_code: string;
  country_name?: string | null;
  seat: number | null;
  society_id: string | null;
  application_id: string | null;
  user_id: string | null;
}

export interface SeatCommittee {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  committee_country_slots: SeatSlot[];
  conference_allocations: SeatAllocation[];
}

/** One whole country slot in one committee that nobody holds. */
export interface FreeSlot {
  committeeId: string;
  committeeName: string;
  abbreviation: string | null;
  logoUrl: string | null;
  countryCode: string;
  countryName: string;
  /** Seats in the slot: 1, or 2 for a double delegation. */
  size: number;
}

/** A country across the conference's committees. */
export interface CountrySeats {
  code: string;
  name: string;
  /** Free seats, doubles counted as 2. */
  free: number;
  freeSlots: FreeSlot[];
  /** Every committee seating this country, free or not, in committee order. */
  committees: { committeeId: string; name: string; abbreviation: string | null; logoUrl: string | null; size: number; free: boolean }[];
}

function slotSize(s: SeatSlot): number {
  return Math.max(1, Math.round(s.delegation_size || 1));
}

/** Every country that has a delegate slot somewhere, with its free seats. Sorted by name. */
export function countrySeats(committees: SeatCommittee[]): CountrySeats[] {
  const byCode = new Map<string, CountrySeats>();
  const ordered = committees.slice().sort((a, b) => committeeKey(a).localeCompare(committeeKey(b)));
  for (const c of ordered) {
    const taken = new Set(c.conference_allocations.map(a => a.country_code));
    for (const s of c.committee_country_slots) {
      if (s.is_observer) continue;
      const code = s.country_code;
      let entry = byCode.get(code);
      if (!entry) {
        entry = { code, name: s.country_name, free: 0, freeSlots: [], committees: [] };
        byCode.set(code, entry);
      }
      const size = slotSize(s);
      const free = !taken.has(code);
      entry.committees.push({ committeeId: c.id, name: c.name, abbreviation: c.abbreviation, logoUrl: c.logo_url, size, free });
      if (free) {
        entry.free += size;
        entry.freeSlots.push({
          committeeId: c.id, committeeName: c.name, abbreviation: c.abbreviation, logoUrl: c.logo_url,
          countryCode: code, countryName: s.country_name, size,
        });
      }
    }
  }
  return Array.from(byCode.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function committeeKey(c: SeatCommittee): string {
  return `${(c.abbreviation ?? '').trim() || c.name}`.toLowerCase();
}

/** Seats a delegation holds (given) and how many of them have a person on them (filled). */
export function societySeatCounts(
  committees: SeatCommittee[],
  societyId: string,
  memberApplicationIds: ReadonlySet<string>,
): { given: number; filled: number } {
  let given = 0;
  let filled = 0;
  for (const c of committees) {
    for (const a of c.conference_allocations) {
      const mine = a.society_id === societyId || (!!a.application_id && memberApplicationIds.has(a.application_id));
      if (!mine) continue;
      given += 1;
      if (a.application_id || a.user_id) filled += 1;
    }
  }
  return { given, filled };
}

/** The allocation rows a delegation holds, for showing a person's seat. */
export function societyAllocations(
  committees: SeatCommittee[],
  societyId: string,
  memberApplicationIds: ReadonlySet<string>,
): { committee: SeatCommittee; allocation: SeatAllocation }[] {
  const out: { committee: SeatCommittee; allocation: SeatAllocation }[] = [];
  for (const c of committees) {
    for (const a of c.conference_allocations) {
      if (a.society_id === societyId || (!!a.application_id && memberApplicationIds.has(a.application_id))) {
        out.push({ committee: c, allocation: a });
      }
    }
  }
  return out;
}

export interface SuggestedCountry {
  code: string;
  name: string;
  /** Seats taken from this country (doubles as 2). */
  n: number;
  /** True when every free seat of the country is used. */
  whole: boolean;
  slots: FreeSlot[];
}

export interface Suggestion {
  countries: SuggestedCountry[];
  /** Seats in the suggestion. */
  total: number;
  /** True when `total` equals the seats asked for. */
  exact: boolean;
}

/** Seat counts a country can give PART of: any k below its total, except odd k when it has no single slots. */
function partialAmounts(c: CountrySeats): number[] {
  const ones = c.freeSlots.filter(s => s.size === 1).length;
  const twos = c.freeSlots.filter(s => s.size >= 2).length;
  const out: number[] = [];
  for (let k = 1; k < c.free; k++) {
    const t = Math.min(twos, Math.floor(k / 2));
    if (k - 2 * t <= ones) out.push(k);
  }
  return out;
}

/** The slots that make up exactly k seats of a country: doubles first, then singles, in committee order. */
function pickSlots(c: CountrySeats, k: number): FreeSlot[] {
  if (k >= c.free) return c.freeSlots.slice();
  const twos = c.freeSlots.filter(s => s.size >= 2);
  const ones = c.freeSlots.filter(s => s.size === 1);
  const t = Math.min(twos.length, Math.floor(k / 2));
  const picked = [...twos.slice(0, t), ...ones.slice(0, k - 2 * t)];
  return picked;
}

const INF = Number.POSITIVE_INFINITY;

/**
 * ONE set of countries whose free seats add up exactly to `need`, preferring
 * the fewest countries and whole countries: a set of whole countries when one
 * exists, else whole countries plus part of one more. When the conference has
 * fewer free seats than `need`, the largest total it can reach.
 */
export function suggestSeats(countries: CountrySeats[], need: number): Suggestion {
  const empty: Suggestion = { countries: [], total: 0, exact: need <= 0 };
  if (need <= 0) return empty;
  // Bigger countries first, then by name, so ties land on a stable answer.
  const list = countries.filter(c => c.free > 0).sort((a, b) => b.free - a.free || a.name.localeCompare(b.name));
  if (list.length === 0) return { ...empty, exact: false };
  const N = need;
  // dp0[s]: fewest whole countries summing to s. dp1[s]: fewest countries
  // summing to s with exactly one of them taken in part. Back pointers per item.
  const dp0 = new Array<number>(N + 1).fill(INF);
  const dp1 = new Array<number>(N + 1).fill(INF);
  dp0[0] = 0;
  // Per item and sum: the step that improved the state, or null when the item left it as it was.
  type Step = { amt: number; whole: boolean; from: 0 | 1 };
  const steps0: (Step | null)[][] = [];
  const steps1: (Step | null)[][] = [];
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const parts = partialAmounts(c);
    const prev0 = dp0.slice();
    const prev1 = dp1.slice();
    const row0 = new Array<Step | null>(N + 1).fill(null);
    const row1 = new Array<Step | null>(N + 1).fill(null);
    for (let s = 0; s <= N; s++) {
      // Whole country.
      if (c.free <= s) {
        if (prev0[s - c.free] + 1 < dp0[s]) { dp0[s] = prev0[s - c.free] + 1; row0[s] = { amt: c.free, whole: true, from: 0 }; }
        if (prev1[s - c.free] + 1 < dp1[s]) { dp1[s] = prev1[s - c.free] + 1; row1[s] = { amt: c.free, whole: true, from: 1 }; }
      }
      // Part of this country, the one partial of the set.
      for (const k of parts) {
        if (k > s) break;
        if (prev0[s - k] + 1 < dp1[s]) { dp1[s] = prev0[s - k] + 1; row1[s] = { amt: k, whole: false, from: 0 }; }
      }
    }
    steps0.push(row0);
    steps1.push(row1);
  }

  // The best reachable total: exactly N when possible, else the largest below it.
  let target = -1;
  let layer: 0 | 1 = 0;
  for (let s = N; s > 0; s--) {
    if (dp0[s] < INF && dp0[s] <= dp1[s]) { target = s; layer = 0; break; }
    if (dp1[s] < INF) { target = s; layer = 1; break; }
  }
  if (target <= 0) return { ...empty, exact: false };

  // Walk back. A step recorded at item i applies only when the state at
  // (i, s, layer) was set by item i (it stays null when i left it unchanged).
  const picked: SuggestedCountry[] = [];
  let s = target;
  let L: 0 | 1 = layer;
  for (let i = list.length - 1; i >= 0 && s > 0; i--) {
    const step = (L === 0 ? steps0 : steps1)[i][s];
    if (!step) continue;
    const c = list[i];
    picked.push({ code: c.code, name: c.name, n: step.amt, whole: step.whole, slots: pickSlots(c, step.amt) });
    s -= step.amt;
    L = step.from;
  }
  picked.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
  const total = picked.reduce((t, p) => t + p.n, 0);
  return { countries: picked, total, exact: total === need };
}
