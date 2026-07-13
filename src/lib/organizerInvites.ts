// Organizer token-invite flow — the organizer counterpart of chairInvites.ts.
// Works whether or not the invitee already has a Gavelling account: the
// create_organizer_invite RPC mints a token row (invited_user_id null when no
// profile matches) and we queue an email (mirroring queueChairInviteEmail,
// registry + template + default-fallback) whose button deep-links to
// /invites/organizer/[token], where the invitee signs in/up and accepts.

import type { getAuthedClient } from '@/lib/supabase-auth';
import { queueOrganizerInviteEmail } from '@/lib/emailEvents';

type AuthedClient = ReturnType<typeof getAuthedClient>;

export interface OrganizerInviteRow {
  id: string;
  email: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked';
  created_at: string;
}

export interface SendOrganizerInviteArgs {
  conferenceId: string;
  email: string;
}

export interface SendOrganizerInviteResult {
  ok: boolean;
  error?: string;
  inviteId?: string;
  invitedEmail?: string;
  invitedName?: string;
  hasAccount?: boolean;
  existing?: boolean;
}

interface CreateOrganizerInviteRpcResult {
  ok: boolean;
  error?: string;
  existing?: boolean;
  invite_id?: string;
  token?: string;
  invited_email?: string;
  invited_name?: string;
  has_account?: boolean;
}

/** Create (or reuse) a pending organizer invite and queue the invite email. */
export async function sendOrganizerInvite(
  supabase: AuthedClient,
  args: SendOrganizerInviteArgs
): Promise<SendOrganizerInviteResult> {
  const { data, error } = await supabase.rpc('create_organizer_invite', {
    p_conference_id: args.conferenceId,
    p_email: args.email.trim(),
  });
  if (error) return { ok: false, error: error.message || 'Could not send that invite.' };

  const result = data as CreateOrganizerInviteRpcResult;
  if (!result.ok) return { ok: false, error: result.error ?? 'Could not send that invite.' };

  await queueOrganizerInviteEmail(supabase, {
    conferenceId: args.conferenceId,
    token: result.token!,
    invitedEmail: result.invited_email!,
    invitedName: result.invited_name!,
  });

  return {
    ok: true,
    inviteId: result.invite_id,
    invitedEmail: result.invited_email,
    invitedName: result.invited_name,
    hasAccount: result.has_account,
    existing: result.existing,
  };
}

/** Pending invites for the settings Organizers tab (RLS: organizers only). */
export async function listPendingOrganizerInvites(
  supabase: AuthedClient,
  conferenceId: string
): Promise<OrganizerInviteRow[]> {
  const { data } = await supabase
    .from('conference_organizer_invites')
    .select('id, email, status, created_at')
    .eq('conference_id', conferenceId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  return (data as OrganizerInviteRow[] | null) ?? [];
}

/** Withdraw a pending invite (the token link stops working). */
export async function revokeOrganizerInvite(
  supabase: AuthedClient,
  inviteId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('conference_organizer_invites')
    .update({ status: 'revoked', responded_at: new Date().toISOString() })
    .eq('id', inviteId)
    .eq('status', 'pending');
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
