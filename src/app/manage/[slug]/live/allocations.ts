// ─────────────────────────────────────────────────────────────────────────────
// WHO IS ACTUALLY SITTING BEHIND A DELEGATION.
//
// The live session tables know a delegation as a STRING and nothing else.
// `delegates.country`, `speakers_list.country` and `current_speaker.country` are
// all plain text; none of the three carries a user id, and none carries a seat
// number. So "France" on a live card is a nameplate, not a person — and the one
// place the person exists is the conferences side, in `conference_allocations`.
//
// ── DOUBLE DELEGATION, AS THE DATABASE ACTUALLY MODELS IT ───────────────────
//
// Verified against production (`luruhkwrgisytejswlas`), not assumed:
//
//   • `conference_allocations.seat` is `smallint NOT NULL DEFAULT 1`. It is
//     never null — 0 of 192 rows — and only ever 1 or 2.
//   • The double marker lives on the SLOT, as
//     `committee_country_slots.delegation_size` (`integer NOT NULL DEFAULT 1`,
//     values 1 and 2 only). There is no `double_delegation` column, no `seats`
//     and no `capacity`. `committee_country_slots` is UNIQUE on
//     (conference_committee_id, country_code), so doubleness is a VALUE on one
//     slot row, never a second row.
//   • `conference_committees.delegation_size` is a committee-wide mirror of the
//     same thing, and in production the two never disagree: all 22 committees
//     with any double slot have every slot double. That column is what this page
//     reads, because it needs one number per committee and not 17,189 slot rows.
//   • Uniqueness on the allocation side is
//     (conference_committee_id, country_code, seat) — that constraint IS the
//     second-delegate mechanism.
//
// ── THE CONSEQUENCE THAT MATTERS FOR EVERY COUNT ON THIS PAGE ───────────────
//
// `delegates` carries a UNIQUE index on (committee_id, country). Measured across
// all 5,450 production rows, the number of (committee_id, country) groups with
// more than one row is ZERO — the live session physically cannot hold two
// delegate rows for one delegation.
//
// So a double delegation is TWO PEOPLE ON ONE SEAT: one roll entry, one place in
// the speakers' list, one vote, one scoreboard row — and two humans. Every count
// on the live page is per-seat and is therefore already right; what was missing
// was the second NAME, which is what this module supplies. Anything that
// "fixed" the roll to count two would be inventing a vote.
//
// ── JOINING BACK TO THE LIVE SESSION ────────────────────────────────────────
//
// On `country_name`, not `country_code`. Measured over the 98 allocations whose
// committee has a live roll: 90 match `delegates.country` on the full name, and
// case-folding and trimming gain exactly nothing (90 = 90, no drift). The code
// join scores only 36, because it lands solely on custom committees where
// `country_code` and `country_name` are the same literal string.
//
// This module WRITES NOTHING.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js';

/** One human holding one seat of one delegation. */
export interface AllocatedPerson {
  allocationId: string;
  /** 1 or 2. A single delegation only ever has seat 1. */
  seat: number;
  /** Resolved display name, or null when the seat is allocated to nobody yet. */
  name: string | null;
  avatarUrl: string | null;
  userId: string | null;
}

/** Every allocated seat in a conference, keyed `${confCommitteeId}|${countryName}`
 *  and sorted by seat. A country with a double delegation has two entries. */
export type AllocationIndex = Map<string, AllocatedPerson[]>;

export const allocationKey = (confCommitteeId: string, country: string) =>
  `${confCommitteeId}|${country.trim()}`;

interface AllocationRow {
  id: string;
  conference_committee_id: string;
  country_name: string;
  seat: number | null;
  user_id: string | null;
  profiles: { display_name: string | null; avatar_url: string | null } | null;
  applications: { invited_name: string | null } | null;
}

/** Display name for a seat, in the same precedence the assignment page uses
 *  (`manage/[slug]/assignment/page.tsx:237-245`): profile display name, then the
 *  invited name off the application, then nothing.
 *
 *  Every source is TRIMMED and skipped when blank rather than taken with `??`. A
 *  profile can carry a whitespace-only `display_name` — it happens — and `??`
 *  would let that through and render a nameless person.
 *
 *  Returning null rather than a placeholder is deliberate: 37.5% of production
 *  allocations (72 of 192) have no `user_id` at all, so an unclaimed seat is the
 *  ordinary case and the UI has to be able to say so honestly. */
function seatName(row: AllocationRow): string | null {
  const dn = row.profiles?.display_name?.trim();
  if (dn) return dn;
  const invited = row.applications?.invited_name?.trim();
  if (invited) return invited;
  return null;
}

/**
 * Load every allocation in one conference and index it by committee + country.
 *
 * ONE query for the whole conference, loaded lazily and once — the same shape as
 * the conference scoreboard beside it. It is deliberately NOT folded into the
 * live page's 10-second poll: allocations change when an organiser assigns a
 * delegate, which is not a live-floor event, and adding a table to that poll
 * would cost a scan every ten seconds for data that moves once a week.
 *
 * Failure is reported by returning an empty index rather than throwing. A live
 * board must still draw when a secondary read fails; the caller degrades to
 * showing the delegation without its people.
 */
export async function loadAllocationIndex(
  supabase: SupabaseClient,
  conferenceId: string,
): Promise<AllocationIndex> {
  const index: AllocationIndex = new Map();
  const { data, error } = await supabase
    .from('conference_allocations')
    // NOTE the column name: `conference_committee_id`. There is no
    // `committee_id` on this table, which is why the scoreboard's
    // `fetchAllByCommittee` helper cannot be pointed at it.
    .select('id, conference_committee_id, country_name, seat, user_id,'
      + ' profiles:user_id (display_name, avatar_url),'
      + ' applications:application_id (invited_name)')
    .eq('conference_id', conferenceId);

  if (error) {
    console.error('[live/allocations] conference_allocations load failed:', error);
    return index;
  }

  for (const row of (data ?? []) as unknown as AllocationRow[]) {
    const country = (row.country_name ?? '').trim();
    if (!country) continue;
    const key = allocationKey(row.conference_committee_id, country);
    const list = index.get(key);
    const person: AllocatedPerson = {
      allocationId: row.id,
      // The column is NOT NULL in the schema; the `?? 1` is for the type, not
      // for the data, and matches the column's own default.
      seat: row.seat ?? 1,
      name: seatName(row),
      avatarUrl: row.profiles?.avatar_url ?? null,
      userId: row.user_id,
    };
    if (list) list.push(person);
    else index.set(key, [person]);
  }

  for (const list of index.values()) list.sort((a, b) => a.seat - b.seat);
  return index;
}
