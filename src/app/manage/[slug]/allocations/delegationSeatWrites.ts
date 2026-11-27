// delegationSeatWrites.ts: the allocation page's two writes, give and take back.
//
// Give: while DELEGATIONS_V2_DB is off, the plain block-seat insert in
// applications/delegations/seatWrites.ts (one insert for every seat of the
// press, rows counted). While it is on, organiser_give_society_seats with the
// contract in scratch-delegations-rebuild.sql (CLIENT CONTRACT):
//   p_seats = [{ conference_committee_id, country_code, seat }], one entry per
//   SEAT (both seats of a double), all or nothing; refuses over the conference's
//   seat limit with `allowed_more` and a plain sentence in `error`.
// The v2 path is written inline here; it sends the same body as v2.ts's
// giveSocietySeatsRpc (conference_committee_id, country_code, seat) and also
// checks that `created` equals the number of seats sent.
//
// Take back: only an EMPTY block seat of the delegation (society_id set, no
// person). A seat with a person on it is never taken back here.
//   v1  the whole slot (committee + country) goes back or nothing does: when
//       any seat of the slot (both seats of a double) holds a person, or is not
//       a block seat of this delegation, nothing is deleted and a plain
//       sentence says why; otherwise every seat of the slot is deleted,
//       filtered on empty block seats of this society, rows counted (RLS
//       "Organizers manage allocations", ALL, is_conference_organizer).
//   v2  organiser_take_back_society_seat(p_allocation) per seat.

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { DELEGATIONS_V2_DB } from '@/app/manage/[slug]/applications/delegations/v2';
import { giveSocietySeats as giveBlockSeats } from '@/app/manage/[slug]/applications/delegations/seatWrites';
import type { FreeSlot } from '@/app/manage/[slug]/applications/delegations/societySeats';

export type SeatWriteResult = { ok: true } | { ok: false; error: string };

const SIGNED_OUT = 'Your session has expired. Refresh the page and sign in again.';

export async function giveSeats(args: { conferenceId: string; societyId: string; slots: FreeSlot[] }): Promise<SeatWriteResult> {
  if (!DELEGATIONS_V2_DB) {
    const r = await giveBlockSeats(args);
    return r.ok ? { ok: true } : { ok: false, error: r.error };
  }
  const fallback = 'Those allocations were not given. Try again.';
  const seats = args.slots.flatMap(s => Array.from({ length: Math.max(1, s.size) }, (_, i) => ({
    conference_committee_id: s.committeeId,
    country_code: s.countryCode,
    seat: i + 1,
  })));
  if (seats.length === 0) return { ok: false, error: 'There are no free allocations to give.' };
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const { data, error } = await c.rpc('organiser_give_society_seats', { p_society: args.societyId, p_seats: seats });
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const r = (data ?? {}) as { ok?: boolean; created?: number; error?: string };
    if (r.ok !== true) return { ok: false, error: plainOrFallback(r.error, fallback) };
    if (typeof r.created === 'number' && r.created !== seats.length) return { ok: false, error: fallback };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

export async function takeBackSeats(args: { societyId: string; allocationIds: string[] }): Promise<SeatWriteResult> {
  const fallback = 'That allocation was not removed. Try again.';
  const ids = args.allocationIds.filter(id => !id.startsWith('temp-'));
  if (ids.length === 0) return { ok: false, error: fallback };
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    if (DELEGATIONS_V2_DB) {
      for (const id of ids) {
        const { data, error } = await c.rpc('organiser_take_back_society_seat', { p_allocation: id });
        if (error) return { ok: false, error: friendlyError(error, fallback) };
        const r = (data ?? {}) as { ok?: boolean; error?: string };
        if (r.ok !== true) return { ok: false, error: plainOrFallback(r.error, fallback) };
      }
      return { ok: true };
    }
    const placed = 'Someone is in this allocation, so it stays with the delegation.';
    type SeatRow = { id: string; conference_committee_id: string | null; country_code: string | null; society_id: string | null; user_id: string | null; application_id: string | null };
    const cols = 'id, conference_committee_id, country_code, society_id, user_id, application_id';
    // 1. The slots the pressed seats belong to.
    const { data: picked, error: pickErr } = await c.from('conference_allocations').select(cols).in('id', ids);
    if (pickErr) return { ok: false, error: friendlyError(pickErr, fallback) };
    const pickedRows = (picked ?? []) as SeatRow[];
    if (pickedRows.length !== ids.length) return { ok: false, error: fallback };
    const slots = new Map<string, { committeeId: string; countryCode: string }>();
    for (const r of pickedRows) {
      if (!r.conference_committee_id || !r.country_code) return { ok: false, error: fallback };
      slots.set(`${r.conference_committee_id}|${r.country_code}`, { committeeId: r.conference_committee_id, countryCode: r.country_code });
    }
    // 2. Every seat of those slots: all must be empty block seats of this society.
    const slotIds: string[] = [];
    for (const slot of slots.values()) {
      const { data: rows, error: slotErr } = await c.from('conference_allocations')
        .select(cols)
        .eq('conference_committee_id', slot.committeeId)
        .eq('country_code', slot.countryCode);
      if (slotErr) return { ok: false, error: friendlyError(slotErr, fallback) };
      for (const r of (rows ?? []) as SeatRow[]) {
        if (r.user_id || r.application_id) return { ok: false, error: placed };
        if (r.society_id !== args.societyId) return { ok: false, error: 'This allocation is shared with someone outside the delegation, so it stays as it is.' };
        slotIds.push(r.id);
      }
    }
    // 3. Delete them all, still filtered on empty block seats, rows counted.
    const { data, error } = await c.from('conference_allocations')
      .delete()
      .in('id', slotIds)
      .eq('society_id', args.societyId)
      .is('user_id', null)
      .is('application_id', null)
      .select('id');
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    if (!data || data.length !== slotIds.length) {
      return { ok: false, error: 'Someone was just allocated here, so it stays with the delegation.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}
