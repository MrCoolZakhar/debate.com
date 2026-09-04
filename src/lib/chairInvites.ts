// Shared "invite a chair by email" flow for both call sites (the committees
// page's Add Chair modal and the assignment page's Chairs mode). Wraps the
// create_chair_invite RPC and the invite email in one call so both UIs stay
// in sync.

import type { getAuthedClient } from '@/lib/supabase-auth';
import { queueChairInviteEmail } from '@/lib/emailEvents';

export interface SendChairInviteArgs {
  conferenceId: string;
  committeeId: string;
  committeeName: string;
  email: string;
  /** Full name for the invitee. Used when they have no account yet; once they
   *  join, their own profile name takes over. */
  name?: string;
}

export interface SendChairInviteResult {
  ok: boolean;
  error?: string;
  invitedName?: string;
}

interface CreateChairInviteRpcResult {
  ok: boolean;
  error?: string;
  existing?: boolean;
  invite_id?: string;
  token?: string;
  invited_name?: string;
  invited_email?: string;
}

export interface ChairInviteRoleConflict {
  displayName: string;
  role: string;
}

/**
 * Two-roles warning lookup: does `email` belong to a registered user who
 * already holds an active (submitted/accepted/assigned/checked-in)
 * application at this conference, in a role other than chair? Resolves
 * null for an unregistered email or one with no such application — both
 * send the invite immediately, no warning. Goes through the same
 * applications+profiles join every /manage/ page already reads under
 * organizer RLS, rather than a cold profiles-by-email lookup (profiles
 * has no policy for that).
 */
export async function findChairInviteRoleConflict(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string,
  email: string
): Promise<ChairInviteRoleConflict | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  const { data } = await supabase
    .from('applications')
    .select('role, profiles (display_name, email)')
    .eq('conference_id', conferenceId)
    .neq('role', 'chair')
    .in('status', ['submitted', 'accepted', 'assigned', 'checked-in']);
  const rows = (data ?? []) as unknown as { role: string; profiles: { display_name: string; email: string } | null }[];
  const match = rows.find(r => r.profiles?.email?.toLowerCase() === normalized);
  return match?.profiles ? { displayName: match.profiles.display_name, role: match.role } : null;
}

export async function sendChairInvite(
  supabase: ReturnType<typeof getAuthedClient>,
  args: SendChairInviteArgs
): Promise<SendChairInviteResult> {
  const { data, error } = await supabase.rpc('create_chair_invite', {
    p_committee_id: args.committeeId,
    p_email: args.email.trim(),
    p_name: args.name?.trim() || null,
  });
  if (error) return { ok: false, error: error.message || 'Could not invite that chair.' };

  const result = data as CreateChairInviteRpcResult;
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not invite that chair.' };

  await queueChairInviteEmail(supabase, {
    conferenceId: args.conferenceId,
    committeeName: args.committeeName,
    token: result.token!,
    invitedEmail: result.invited_email!,
    invitedName: result.invited_name!,
  });

  return { ok: true, invitedName: result.invited_name };
}

// ── Pending invites, the organiser-side view ─────────────────────────────────
//
// A chair who has been invited but has not yet accepted exists only as a
// `conference_chair_invites` row with status 'pending' — they are NOT in
// `conference_committees.chair_user_ids` and NOT in the `display_chairs`
// the DB trigger derives from it. That is deliberate: `display_chairs` is what
// the PUBLIC conference page prints, and an invitation is not a public fact.
// Every ORGANISER surface that shows a dais should show these alongside the
// seated chairs, marked pending; no public surface ever should.

export interface PendingChairInvite {
  id: string;
  committee_id: string;
  email: string;
  invited_name: string | null;
  /** Joined profile, present only when the invitee already has an account. */
  profiles: { display_name: string; avatar_url: string | null } | null;
}

/** The name to show for a pending invitee: their account name if they have
 *  one, else the name the organiser typed, else the email. */
export function pendingInviteName(invite: PendingChairInvite): string {
  return invite.profiles?.display_name ?? invite.invited_name ?? invite.email;
}

/** Every still-pending chair invite across one conference, for grouping by
 *  committee_id at the call site. */
export async function fetchPendingChairInvites(
  supabase: ReturnType<typeof getAuthedClient>,
  conferenceId: string
): Promise<PendingChairInvite[]> {
  const { data } = await supabase
    .from('conference_chair_invites')
    .select('id, committee_id, email, invited_name, profiles (display_name, avatar_url)')
    .eq('conference_id', conferenceId)
    .eq('status', 'pending');
  return (data ?? []) as unknown as PendingChairInvite[];
}

/**
 * Resend a pending invite. This is deliberately the SAME call as the first
 * send: `create_chair_invite` reuses an existing pending row for the same
 * person on the same committee and hands back its original token, so the
 * invitee's accept link never changes underneath them — only a fresh
 * email_outbox row is queued. No new invite row, no second link to confuse
 * them, and no role-conflict prompt (that decision was made when the invite
 * was first sent).
 */
export async function resendChairInvite(
  supabase: ReturnType<typeof getAuthedClient>,
  args: { conferenceId: string; committeeId: string; committeeName: string; email: string }
): Promise<SendChairInviteResult> {
  return sendChairInvite(supabase, args);
}

/**
 * Withdraw a pending invite. 'revoked', never a delete — the row is the
 * audit trail of who was asked, and the accept link must stop working.
 *
 * `.select('id')` is load-bearing, NOT decoration. PostgREST reports an UPDATE
 * that matched ZERO rows as a success with no error — so without asking for the
 * updated row back, an RLS-rejected write (organizer access pulled, a stale
 * token) returns true, both call sites keep their optimistic removal, and the
 * invite silently reappears on the next load. Same rule the resume latch is
 * held to; see AGENTS.md → SUSPEND DEBATE on `startResumeRollCall`.
 *
 * The `status = 'pending'` guard closes the other end of that race: if the
 * invitee ACCEPTED between the organiser's page load and their click, they are
 * a seated chair now, not a pending invite. Without the guard this would stamp
 * 'revoked' over an accepted row; with it, no row matches, the caller rolls its
 * optimistic removal back and says so.
 */
export async function revokeChairInvite(
  supabase: ReturnType<typeof getAuthedClient>,
  inviteId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('conference_chair_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('status', 'pending')
    .select('id');
  return !error && (data ?? []).length > 0;
}
