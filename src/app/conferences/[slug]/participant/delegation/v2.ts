// The delegations rebuild, database half (docs/conferences/delegations.md).
//
// DELEGATIONS_V2_DB stays false until the chat's Supabase work has applied part 1
// (scratch-delegations-part1-people-and-seats.sql), which creates the objects below. While it is false NOTHING here is called and the leader card
// renders none of the pieces that need them (the extra member menu items, the
// position paper column, the open seats card and the reshuffle line).
//
// Objects this file expects, none of which exist yet (19 Oct 2026):
//   delegation_place_member(p_application, p_allocation) leader seats a member in a block seat
//   delegation_remove_member(p_application)             leader removes a member (waits for
//       Christian's money functions: called only while DELEGATIONS_MONEY_DB is on)
//   delegation_unplace_member(p_application)            leader takes a member out of their seat
//   my_delegation_open_seats(p_society)                 the delegation's block seats; the
//       card also needs each row's allocation id (`allocation_id`) to place a member
//   conferences.delegation_reshuffle_until              the reshuffle deadline
//   a leader read of members' position_papers rows, and
//   delegation_submit_member_paper(p_application, p_file_url, p_file_name,
//       p_file_size)                                    writes a member's paper row
//   delegation_invite_short_code(p_society) returns text  the short invite code
//       (e.g. westbrook-academy-k7q3mx) for https://gavelling.com/i/<code>; its
//       twin resolve_delegation_short_invite(p_code) is read by src/app/i/[code]

import { getFreshAuthedClient } from '@/lib/supabase-auth';
import { friendlyError, plainOrFallback } from '@/lib/friendlyError';

export const DELEGATIONS_V2_DB = true;

// DELEGATIONS_MONEY_DB waits for Christian's money functions (delegation_remove_member,
// organiser_set_member_role), built in his chat with a rollback test; what we asked
// for is in docs/conferences/delegations-requests-for-christian.md. Anything that
// moves money with a person goes behind this flag, never behind DELEGATIONS_V2_DB.
// Flip both v2.ts copies together once his functions are live.
// Leaders never move anyone to or from faculty advisor (owners, 20 Oct 2026):
// delegation_set_role is withdrawn and nothing here calls it.
export const DELEGATIONS_MONEY_DB = true;

export type Result = { ok: true } | { ok: false; error: string };

export type MemberRole = 'delegate' | 'head-delegate' | 'faculty-advisor';

const SIGNED_OUT = 'Your session has expired. Refresh the page and sign in again.';

async function call(fn: string, args: Record<string, unknown>, fallback: string): Promise<Result> {
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const { data, error } = await c.rpc(fn, args);
    if (error) return { ok: false, error: friendlyError(error, fallback) };
    const r = (data ?? {}) as { ok?: boolean; error?: string; message?: string };
    if (r.ok !== true) return { ok: false, error: plainOrFallback(r.error ?? r.message, fallback) };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}

export function placeMember(applicationId: string, allocationId: string): Promise<Result> {
  return call('delegation_place_member', { p_application: applicationId, p_allocation: allocationId }, 'They could not be given that allocation. Try again.');
}

export function removeMember(applicationId: string): Promise<Result> {
  return call('delegation_remove_member', { p_application: applicationId }, 'They could not be removed. Try again.');
}

export function unplaceMember(applicationId: string): Promise<Result> {
  return call('delegation_unplace_member', { p_application: applicationId }, 'They could not be unallocated. Try again.');
}

/** The delegation's short invite code, or null (flag off, not a leader, or a failed read). */
export async function readInviteShortCode(societyId: string): Promise<string | null> {
  if (!DELEGATIONS_V2_DB) return null;
  try {
    const c = await getFreshAuthedClient();
    if (!c) return null;
    const { data, error } = await c.rpc('delegation_invite_short_code', { p_society: societyId });
    if (error || typeof data !== 'string' || !data.trim()) return null;
    return data.trim();
  } catch {
    return null;
  }
}

/** One block seat of the delegation with nobody in it. */
export interface OpenSeat {
  allocation_id: string | null;
  conference_committee_id: string;
  committee: string;
  abbreviation: string | null;
  logo_url: string | null;
  country_code: string | null;
  /** The seat's country name, shown beside its flag. */
  country_name: string;
  /** A custom crest from committee_country_slots, drawn before the flag. */
  country_logo_url: string | null;
  /** The seat number inside the country (1, or 2 for the second seat of a double). */
  seat: number;
  delegation_size: number | null;
}

export async function readOpenSeats(societyId: string): Promise<OpenSeat[] | null> {
  try {
    const c = await getFreshAuthedClient();
    if (!c) return null;
    const { data, error } = await c.rpc('my_delegation_open_seats', { p_society: societyId });
    if (error || !Array.isArray(data)) return null;
    return (data as Record<string, unknown>[]).map(r => ({
      allocation_id: typeof r.allocation_id === 'string' ? r.allocation_id : null,
      conference_committee_id: String(r.conference_committee_id ?? ''),
      committee: String(r.name ?? r.committee ?? ''),
      abbreviation: typeof r.abbreviation === 'string' ? r.abbreviation : null,
      logo_url: typeof r.logo_url === 'string' ? r.logo_url : null,
      country_code: typeof r.country_code === 'string' ? r.country_code : null,
      country_name: typeof r.country_name === 'string' ? r.country_name : '',
      country_logo_url: typeof r.country_logo_url === 'string' ? r.country_logo_url : null,
      seat: typeof r.seat === 'number' ? r.seat : Number(r.seat) || 1,
      delegation_size: typeof r.delegation_size === 'number' ? r.delegation_size : null,
    }));
  } catch {
    return null;
  }
}

/** The reshuffle deadline, only while the conference lets leaders swap their own people. */
export async function readReshuffleUntil(conferenceId: string): Promise<string | null> {
  try {
    const c = await getFreshAuthedClient();
    if (!c) return null;
    const { data, error } = await c.from('conferences')
      .select('allocation_swap_mode, delegation_reshuffle_until').eq('id', conferenceId).maybeSingle();
    if (error || !data) return null;
    const row = data as { allocation_swap_mode?: string | null; delegation_reshuffle_until?: string | null };
    return row.allocation_swap_mode === 'self_serve' ? row.delegation_reshuffle_until ?? null : null;
  } catch {
    return null;
  }
}

/** Position paper status per member user id, for the members' committees. */
export async function readPaperStatuses(userIds: string[], committeeIds: string[]): Promise<Map<string, string> | null> {
  if (userIds.length === 0 || committeeIds.length === 0) return new Map();
  try {
    const c = await getFreshAuthedClient();
    if (!c) return null;
    const { data, error } = await c.from('position_papers')
      .select('user_id, status, conference_committee_id').in('user_id', userIds).in('conference_committee_id', committeeIds);
    if (error) return null;
    return new Map(((data ?? []) as { user_id: string; status: string }[]).map(r => [r.user_id, r.status] as const));
  } catch {
    return null;
  }
}

/** The position-papers bucket's own limit (the member's card uses the same). */
const PAPER_MAX_BYTES = 5 * 1024 * 1024;

/**
 * A leader uploads a PDF position paper for a seated member: the object goes to
 * the same path as the member's own card, then delegation_submit_member_paper
 * writes (or replaces) the row.
 */
export async function uploadPaperForMember(args: {
  conferenceId: string; committeeId: string; applicationId: string; memberUserId: string; file: File;
}): Promise<Result> {
  const fallback = 'The position paper could not be uploaded. Try again.';
  if (args.file.type !== 'application/pdf') return { ok: false, error: 'Choose a PDF file.' };
  if (args.file.size > PAPER_MAX_BYTES) return { ok: false, error: 'The file is over 5 MB. Choose a smaller PDF.' };
  try {
    const c = await getFreshAuthedClient();
    if (!c) return { ok: false, error: SIGNED_OUT };
    const path = `${args.conferenceId}/${args.committeeId}/${args.memberUserId}_${Date.now()}.pdf`;
    const { error: upErr } = await c.storage.from('position-papers').upload(path, args.file, { contentType: 'application/pdf' });
    if (upErr) return { ok: false, error: friendlyError(upErr, fallback) };
    const { data: { publicUrl } } = c.storage.from('position-papers').getPublicUrl(path);
    const { data, error } = await c.rpc('delegation_submit_member_paper', {
      p_application: args.applicationId,
      p_file_url: publicUrl,
      p_file_name: args.file.name,
      p_file_size: args.file.size,
    });
    const r = (data ?? {}) as { ok?: boolean; error?: string; message?: string };
    if (error || r.ok !== true) {
      await c.storage.from('position-papers').remove([path]);
      return { ok: false, error: error ? friendlyError(error, fallback) : plainOrFallback(r.error ?? r.message, fallback) };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: friendlyError(e, fallback) };
  }
}
