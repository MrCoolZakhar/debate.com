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
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';
import { queueEventEmail } from '@/lib/emailEvents';
import { queueAllocationEmails } from '@/lib/allocationEmail';
import { placeMember, unplaceMember } from '@/app/conferences/[slug]/participant/delegation/v2';
import { moveSeat as leaderMoveSeat } from '@/app/conferences/[slug]/participant/delegation/seat/seatWrites';
import type { FreeSlot } from './societySeats';
import { DELEGATIONS_V2_DB, giveSocietySeatsRpc, takeBackSocietySeatRpc, type GiveSeat } from './v2';

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

/**
 * Gives exactly these seats (one entry per seat: a double's seat 1 or seat 2 on
 * its own), all or nothing, through organiser_give_society_seats, which also
 * enforces the conference's seat limit. Verified: `created` must equal the
 * seats sent. The Allocations tab's one-tap chips (owner, 21 Oct 2026).
 */
export async function giveExactSeats(societyId: string, seats: GiveSeat[]): Promise<GiveResult> {
  const fallback = 'Those allocations were not given. Try again.';
  if (seats.length === 0) return { ok: false, error: 'There are no free allocations to give.' };
  if (!DELEGATIONS_V2_DB) return { ok: false, error: fallback };
  const r = await giveSocietySeatsRpc(societyId, seats);
  if (!r.ok) return r;
  if (typeof r.given === 'number' && r.given !== seats.length) return { ok: false, error: fallback };
  return { ok: true, given: r.given ?? seats.length };
}

/** Takes one empty block seat back from a delegation (organiser_take_back_society_seat). */
export async function takeBackOneSeat(allocationId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (allocationId.startsWith('temp-')) return { ok: false, error: 'That allocation was not taken back. Try again.' };
  const r = await takeBackSocietySeatRpc(allocationId);
  return r.ok ? { ok: true } : r;
}

// ── People in seats (the delegation pop-up's People tab, owner 20 Oct 2026) ──
//
// The organiser places a member in one of the delegation's open seats, takes a
// member out of their seat (the seat stays with the delegation as Open), moves
// a seated member's seat to a member with none, or switches two seated members.
// These are seat writes, never money: no payment_status, no invoice.
//
// While DELEGATIONS_V2_DB is off they are the writes the assignment page makes
// today (RLS "Organizers manage allocations" and "Organizers update applications"):
//   place     the allocation row is re-pointed at the person (as performSwap in
//             assignment/delegationShared.tsx does: application_id, user_id,
//             assigned_by, allocation_sent back to false), only while it is still
//             empty and the delegation's; then the application gets its
//             assigned_* fields and accepted becomes assigned (insertAllocation);
//             then the allocation email when the conference sends it on assign
//             (conferences.allocation_email_auto, as insertAllocation).
//   take out  the row keeps the seat for the delegation (society_id set, nobody on
//             it, the "Open seat" of docs/conferences/delegations.md); the
//             application's assigned_* are cleared and assigned goes back to
//             accepted; then the allocation_removed email (handleRemoveAllocation).
//   Each first write counts its row; when the second is refused the first is put
//   back, so nothing is left half done.
// While it is on, place and take out are delegation_place_member and
// delegation_unplace_member, which accept organisers (part 1 SQL).
// switch     perform_delegation_swap, which lets organisers swap whatever the
//            reshuffle setting says (the inbox's Approve uses it the same way).


export type PersonSeatResult = { ok: true } | { ok: false; error: string };

export interface SeatPerson {
  id: string;
  user_id: string | null;
  status: string;
}

export interface SeatPlace {
  allocationId: string;
  committeeId: string;
  countryCode: string;
  countryName: string;
}

type Client = NonNullable<Awaited<ReturnType<typeof getFreshAuthedClient>>>;

const SEAT_CHANGED = 'That seat just changed. The list is up to date now, try again.';

async function actorOf(c: Client): Promise<string | null> {
  try {
    const { data: { user } } = await c.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

async function emailsOnAssign(c: Client, conferenceId: string): Promise<boolean> {
  const { data } = await c.from('conferences').select('allocation_email_auto').eq('id', conferenceId).maybeSingle();
  return (data as { allocation_email_auto?: boolean } | null)?.allocation_email_auto === true;
}

async function placeDirect(c: Client, args: { conferenceId: string; societyId: string; seat: SeatPlace; person: SeatPerson; actor: string | null }): Promise<PersonSeatResult> {
  const { seat, person, societyId } = args;
  const fallback = 'That seat was not saved. Try again.';
  const { data: rows, error } = await c.from('conference_allocations')
    .update({ application_id: person.id, user_id: person.user_id, assigned_by: args.actor, allocation_sent: false, allocation_sent_at: null })
    .eq('id', seat.allocationId)
    .eq('society_id', societyId)
    .is('application_id', null)
    .is('user_id', null)
    .select('id');
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'They already hold a seat. Take them out of it first.' };
    return { ok: false, error: friendlyError(error, fallback) };
  }
  if (!rows || rows.length !== 1) return { ok: false, error: SEAT_CHANGED };
  const { data: apps, error: appErr } = await c.from('applications').update({
    ...(person.status === 'accepted' ? { status: 'assigned' } : {}),
    assigned_committee_id: seat.committeeId,
    assigned_country_code: seat.countryCode,
    assigned_country_name: seat.countryName,
    decided_by: args.actor,
    decided_at: new Date().toISOString(),
  }).eq('id', person.id).select('id');
  if (appErr || !apps || apps.length !== 1) {
    await c.from('conference_allocations').update({ application_id: null, user_id: null }).eq('id', seat.allocationId).eq('application_id', person.id);
    return { ok: false, error: 'That seat could not be finished, so nothing changed. Try again.' };
  }
  return { ok: true };
}

async function takeOutDirect(c: Client, args: { societyId: string; seat: SeatPlace; person: SeatPerson; actor: string | null }): Promise<PersonSeatResult> {
  const { seat, person, societyId } = args;
  const fallback = 'They were not taken out of the seat. Try again.';
  const { data: before } = await c.from('conference_allocations').select('society_id').eq('id', seat.allocationId).maybeSingle();
  const { data: rows, error } = await c.from('conference_allocations')
    .update({ application_id: null, user_id: null, society_id: societyId, assigned_by: args.actor, allocation_sent: false, allocation_sent_at: null })
    .eq('id', seat.allocationId)
    .eq('application_id', person.id)
    .select('id');
  if (error) return { ok: false, error: friendlyError(error, fallback) };
  if (!rows || rows.length !== 1) return { ok: false, error: SEAT_CHANGED };
  const { data: apps, error: appErr } = await c.from('applications').update({
    ...(person.status === 'assigned' ? { status: 'accepted' } : {}),
    assigned_committee_id: null,
    assigned_country_code: null,
    assigned_country_name: null,
    decided_by: args.actor,
    decided_at: new Date().toISOString(),
  }).eq('id', person.id).select('id');
  if (appErr || !apps || apps.length !== 1) {
    const priorSociety = (before as { society_id: string | null } | null)?.society_id ?? null;
    await c.from('conference_allocations')
      .update({ application_id: person.id, user_id: person.user_id, society_id: priorSociety })
      .eq('id', seat.allocationId).is('application_id', null);
    return { ok: false, error: 'They could not be taken out of the seat, so nothing changed. Try again.' };
  }
  return { ok: true };
}

/** An organiser places a member in one of the delegation's open seats. */
export async function organiserPlaceInSeat(args: { conferenceId: string; societyId: string; seat: SeatPlace; person: SeatPerson }): Promise<PersonSeatResult> {
  if (DELEGATIONS_V2_DB) return placeMember(args.person.id, args.seat.allocationId);
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const actor = await actorOf(c);
    const r = await placeDirect(c, { ...args, actor });
    if (!r.ok) return r;
    try {
      if (await emailsOnAssign(c, args.conferenceId)) await queueAllocationEmails(c, args.conferenceId, [args.person.id]);
    } catch { /* the seat stands; the allocation page can send the email later */ }
    return r;
  } catch (e) {
    return { ok: false, error: friendlyError(e, 'That seat was not saved. Try again.') };
  }
}

/** An organiser takes a member out of their seat; the seat stays with the delegation as Open. */
export async function organiserTakeOutOfSeat(args: { conferenceId: string; societyId: string; seat: SeatPlace; person: SeatPerson }): Promise<PersonSeatResult> {
  if (DELEGATIONS_V2_DB) return unplaceMember(args.person.id);
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const actor = await actorOf(c);
    const r = await takeOutDirect(c, { ...args, actor });
    if (!r.ok) return r;
    try { await queueEventEmail(c, args.conferenceId, 'allocation_removed', [args.person.id]); } catch { /* the change stands */ }
    return r;
  } catch (e) {
    return { ok: false, error: friendlyError(e, 'They were not taken out of the seat. Try again.') };
  }
}

/** An organiser moves a seated member's seat to a member with none; `from` stays in the delegation with no seat. */
export async function organiserMoveSeat(args: { conferenceId: string; societyId: string; seat: SeatPlace; from: SeatPerson; to: SeatPerson }): Promise<PersonSeatResult> {
  if (DELEGATIONS_V2_DB) return leaderMoveSeat(args.from.id, args.to.id);
  const fallback = 'The seat could not be moved. Try again.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const actor = await actorOf(c);
    const out = await takeOutDirect(c, { societyId: args.societyId, seat: args.seat, person: args.from, actor });
    if (!out.ok) return out;
    const placed = await placeDirect(c, { conferenceId: args.conferenceId, societyId: args.societyId, seat: args.seat, person: args.to, actor });
    if (!placed.ok) {
      // Put the first person back where they were; the refusal is what is shown.
      const back = args.from.status === 'assigned' ? 'accepted' : args.from.status;
      await placeDirect(c, { conferenceId: args.conferenceId, societyId: args.societyId, seat: args.seat, person: { ...args.from, status: back }, actor });
      return placed;
    }
    // Both moved: the same emails the allocation page sends for each half.
    try { await queueEventEmail(c, args.conferenceId, 'allocation_removed', [args.from.id]); } catch { /* the change stands */ }
    try {
      if (await emailsOnAssign(c, args.conferenceId)) await queueAllocationEmails(c, args.conferenceId, [args.to.id]);
    } catch { /* the change stands */ }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** An organiser switches two seated members of the same delegation (perform_delegation_swap). */
export async function organiserSwitchSeats(appA: string, appB: string): Promise<PersonSeatResult> {
  const fallback = 'The seats could not be switched. Try again.';
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const { data, error } = await c.rpc('perform_delegation_swap', { p_app_a: appA, p_app_b: appB });
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const r = (data ?? {}) as { ok?: boolean; error?: string };
    if (r.ok !== true) return { ok: false, error: plainOrFallback(r.error, fallback) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}
