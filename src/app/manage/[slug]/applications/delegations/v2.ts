// The organiser side of the delegations rebuild, database half
// (docs/conferences/delegations.md).
//
// DELEGATIONS_V2_DB stays false until the chat's Supabase work has applied part 1
// (scratch-delegations-part1-people-and-seats.sql), which creates the objects below. While it is false NOTHING here is called and the Delegations
// tab renders none of the pieces that need them: the seat limit radio, the
// "Until" date. The role select and "Remove from delegation" in the pop-up
// wait for DELEGATIONS_MONEY_DB instead (below).
// Seats are given with the plain block-seat insert (seatWrites.ts) meanwhile.
//
// Objects this file expects, none of which exist yet (19 Oct 2026):
//   conferences.delegation_seat_limit text      'none' | 'paid' | 'expected', default 'none'
//   conferences.delegation_reshuffle_until      timestamptz, the reshuffle deadline (written as 'YYYY-MM-DD')
//   organiser_give_society_seats(p_society uuid, p_seats jsonb)
//       p_seats = [{ conference_committee_id, country_code, seat: 1|2 }] (1..200), all or
//       nothing, enforces the seat limit; answers { ok, created, allocation_ids } or
//       { ok: false, code, error } (the CLIENT CONTRACT in scratch-delegations-part1-people-and-seats.sql)
//   organiser_take_back_society_seat(p_allocation uuid) -> { ok, allocation_id, society_id }
//   delegation_remove_member(p_application) callable by the conference's organisers as
//       well as the delegation's leaders (the leader card's wrapper is reused)
//   organiser_set_member_role(p_application, p_role) -> { ok, code, error }, organisers
//       only: the role move with its money in one step (organiserSetMemberRole below)
//   organiser_set_head(p_application, p_head) -> { ok, code, error }, organisers only:
//       delegate <-> head delegate (organiserSetHead below, DELEGATIONS_MONEY_DB)

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';

export const DELEGATIONS_V2_DB = false;

// DELEGATIONS_MONEY_DB waits for Christian's money functions (delegation_remove_member,
// organiser_set_member_role), built in his chat with a rollback test; what we asked
// for is in docs/conferences/delegations-requests-for-christian.md. While it is false
// the pop-up's role select and "Remove from delegation" are drawn disabled with the
// hover title "Coming soon, waiting for Christian" (owner, 20 Oct 2026). Only
// organisers move someone between delegate and faculty advisor (owners, 20 Oct 2026);
// delegation_set_role is withdrawn and nothing calls it. Flip both v2.ts copies together.
export const DELEGATIONS_MONEY_DB = false;

export type SeatLimit = 'none' | 'paid' | 'expected';

export const SEAT_LIMIT_OPTIONS: { value: SeatLimit; label: string }[] = [
  { value: 'none', label: 'No limit' },
  { value: 'paid', label: 'Up to the spots they paid for' },
  { value: 'expected', label: 'Up to their expected size' },
];

export type V2Result = { ok: true; given?: number } | { ok: false; error: string };

/** One seat for organiser_give_society_seats: a double slot is two entries, seat 1 and seat 2. */
export interface GiveSeat {
  conference_committee_id: string;
  country_code: string;
  seat: number;
}

const SIGNED_OUT = 'Your session has expired. Refresh the page and sign in again.';

/** The two v2 conference settings. Only ever read while DELEGATIONS_V2_DB is on. */
export async function readDelegationSettings(conferenceId: string): Promise<{ limit: SeatLimit; until: string | null } | null> {
  if (!DELEGATIONS_V2_DB) return null;
  try {
    const c = await getFreshAuthedClient();
    if (!c) return null;
    const { data, error } = await c.from('conferences')
      .select('delegation_seat_limit, delegation_reshuffle_until').eq('id', conferenceId).maybeSingle();
    if (error || !data) return null;
    const row = data as { delegation_seat_limit?: string | null; delegation_reshuffle_until?: string | null };
    const limit: SeatLimit = row.delegation_seat_limit === 'paid' || row.delegation_seat_limit === 'expected' ? row.delegation_seat_limit : 'none';
    return { limit, until: row.delegation_reshuffle_until ? row.delegation_reshuffle_until.slice(0, 10) : null };
  } catch {
    return null;
  }
}

/** One verified write of a v2 conference column: exactly one row back counts as saved. */
export async function writeDelegationSetting(
  conferenceId: string,
  patch: { delegation_seat_limit?: SeatLimit; delegation_reshuffle_until?: string | null },
): Promise<V2Result> {
  const fallback = 'That setting was not saved. Try again.';
  if (!DELEGATIONS_V2_DB) return { ok: false, error: fallback };
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const { data, error } = await c.from('conferences').update(patch).eq('id', conferenceId).select('id');
    if (error || !data || data.length !== 1) return { ok: false, error: friendlyError(error, fallback) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** Gives whole open country slots to a delegation in one transaction (the database enforces the seat limit). */
export async function giveSocietySeatsRpc(
  societyId: string,
  seats: GiveSeat[],
): Promise<V2Result> {
  const fallback = 'Those seats were not given. Try again.';
  if (!DELEGATIONS_V2_DB) return { ok: false, error: fallback };
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const { data, error } = await c.rpc('organiser_give_society_seats', { p_society: societyId, p_seats: seats });
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const r = (data ?? {}) as { ok?: boolean; created?: number; error?: string; message?: string };
    if (r.ok !== true) return { ok: false, error: plainOrFallback(r.error ?? r.message, fallback) };
    return { ok: true, given: typeof r.created === 'number' ? r.created : undefined };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** Takes an empty block seat back from a delegation. */
export async function takeBackSocietySeatRpc(allocationId: string): Promise<V2Result> {
  const fallback = 'That seat was not taken back. Try again.';
  if (!DELEGATIONS_V2_DB) return { ok: false, error: fallback };
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const { data, error } = await c.rpc('organiser_take_back_society_seat', { p_allocation: allocationId });
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const r = (data ?? {}) as { ok?: boolean; error?: string; message?: string };
    if (r.ok !== true) return { ok: false, error: plainOrFallback(r.error ?? r.message, fallback) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/**
 * An organiser moves a member between delegate, head delegate and faculty advisor.
 * organiser_set_member_role moves the person's ticket and money with them in one
 * step and answers { ok, code, error }; its sentence is shown as given.
 */
export async function organiserSetMemberRole(
  applicationId: string,
  role: 'delegate' | 'head-delegate' | 'faculty-advisor',
): Promise<V2Result> {
  const fallback = 'That role change was not saved. Try again.';
  if (!DELEGATIONS_MONEY_DB) return { ok: false, error: fallback };
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const { data, error } = await c.rpc('organiser_set_member_role', { p_application: applicationId, p_role: role });
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const r = (data ?? {}) as { ok?: boolean; code?: string; error?: string; message?: string };
    if (r.ok !== true) return { ok: false, error: plainOrFallback(r.error ?? r.message, fallback) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/**
 * An organiser makes a delegate a head delegate, or a head delegate a delegate.
 * organiser_set_head(p_application uuid, p_head boolean) is Christian's (not
 * live, 20 Oct 2026) and answers { ok, code, error }; only called while
 * DELEGATIONS_MONEY_DB is on, its sentence shown as given.
 */
export async function organiserSetHead(applicationId: string, head: boolean): Promise<V2Result> {
  const fallback = 'That role change was not saved. Try again.';
  if (!DELEGATIONS_MONEY_DB) return { ok: false, error: fallback };
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const { data, error } = await c.rpc('organiser_set_head', { p_application: applicationId, p_head: head });
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const r = (data ?? {}) as { ok?: boolean; code?: string; error?: string; message?: string };
    if (r.ok !== true) return { ok: false, error: plainOrFallback(r.error ?? r.message, fallback) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

/** The hover title on every control that waits for DELEGATIONS_MONEY_DB. */
export const WAITING_FOR_CHRISTIAN = 'Coming soon, waiting for Christian';
