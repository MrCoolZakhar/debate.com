// seatWrites.ts: giving a delegation block seats.
//
// A block seat is a `conference_allocations` row with the delegation's
// `society_id` and nobody on it (user_id and application_id null), exactly the
// row the assignment page's insertSocietyBlockAllocation writes, so no
// application status is touched and no email is queued. A delegation always
// takes a WHOLE country slot: both seats of a double.
//
// Differences from the assignment page, on purpose:
//   - Every row of one press goes in ONE insert statement, so the seats land
//     together or not at all (no half-held double to roll back by hand).
//   - The insert asks for `.select('id')` and counts the rows (CLAUDE.md §5).
// RLS: "Organizers manage allocations" (ALL, is_conference_organizer on the
// committee's conference); `guard_allocation_seat` refuses a seat a slot does
// not have (SEAT_UNAVAILABLE); the unique indexes refuse a taken seat (23505).
//
// While DELEGATIONS_V2_DB is on the same press goes through
// organiser_give_society_seats instead, which also enforces the seat limit.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError } from '@/lib/friendlyError';
import type { FreeSlot } from './societySeats';
import { DELEGATIONS_V2_DB, giveSocietySeatsRpc } from './v2';

export type GiveResult = { ok: true; given: number } | { ok: false; error: string };

const SIGNED_OUT = 'Your session has expired. Refresh the page and sign in again.';

export async function giveSocietySeats(args: {
  conferenceId: string;
  societyId: string;
  slots: FreeSlot[];
}): Promise<GiveResult> {
  const fallback = 'Those seats were not given. Try again.';
  const seats = args.slots.reduce((n, s) => n + s.size, 0);
  if (seats === 0) return { ok: false, error: 'There are no free seats to give.' };

  if (DELEGATIONS_V2_DB) {
    const r = await giveSocietySeatsRpc(args.societyId, args.slots.flatMap(s => Array.from({ length: s.size }, (_, i) => ({
      conference_committee_id: s.committeeId, country_code: s.countryCode, seat: i + 1,
    }))));
    return r.ok ? { ok: true, given: r.given ?? seats } : r;
  }

  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const { data: { user } } = await c.auth.getUser();
    const rows = args.slots.flatMap(s => Array.from({ length: s.size }, (_, i) => ({
      conference_id: args.conferenceId,
      conference_committee_id: s.committeeId,
      country_code: s.countryCode,
      country_name: s.countryName,
      society_id: args.societyId,
      user_id: null,
      application_id: null,
      allocation_sent: false,
      seat: i + 1,
      assigned_by: user?.id ?? null,
    })));
    const { data, error } = await c.from('conference_allocations').insert(rows).select('id');
    if (error) {
      if (error.message?.includes('SEAT_UNAVAILABLE')) return { ok: false, error: 'One of those countries no longer has that many seats. The list is up to date now, try again.' };
      if (error.code === '23505') return { ok: false, error: 'One of those seats was just taken. The list is up to date now, try again.' };
      return { ok: false, error: friendlyError(error, fallback) };
    }
    if (!data || data.length !== rows.length) return { ok: false, error: fallback };
    return { ok: true, given: data.length };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}
