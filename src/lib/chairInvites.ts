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
