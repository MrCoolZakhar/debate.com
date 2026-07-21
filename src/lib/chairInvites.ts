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
