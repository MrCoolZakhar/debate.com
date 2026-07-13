// Secretariat (organizer) token-invite flow — the organizer counterpart of
// chairInvites.ts. Unlike organizer email lookup (which requires an existing
// profile), this works for people WITHOUT a Gavelling account: the
// create_organizer_invite RPC mints a token row (invited_user_id null when no
// profile matches) and we queue an email whose button deep-links to
// /invites/organizer/[token], where the invitee signs in/up and accepts.

import type { getAuthedClient } from '@/lib/supabase-auth';
import { getSiteUrl, flattenBlocksToPlainText, type EmailBlock } from '@/lib/emailBlocks';
import { renderEmailHtml, type EmailRenderConference } from '@/lib/emailHtml';
import { resolveTokens, type EmailTokenContext } from '@/lib/emailTokens';
import { triggerEmailDelivery } from '@/lib/emailDelivery';

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

// ── Invite email ─────────────────────────────────────────────────────────────
// Mirrors emailEvents.queueChairInviteEmail: one outbox row keyed on
// recipient_email (the invitee may have no application, or no account at all),
// then a delivery trigger. Uses a 'custom' button block pointing straight at
// the token URL so no new ButtonDestination is needed.

interface QueueOrganizerInviteEmailArgs {
  conferenceId: string;
  token: string;
  invitedEmail: string;
  invitedName: string;
}

interface ConferenceRow {
  slug: string;
  acronym: string;
  full_name: string;
  banner_url: string | null;
  logo_url: string | null;
  contact_email: string | null;
}

async function queueOrganizerInviteEmail(
  supabase: AuthedClient,
  args: QueueOrganizerInviteEmailArgs
): Promise<void> {
  const { conferenceId, token, invitedEmail, invitedName } = args;

  const { data: confData } = await supabase
    .from('conferences')
    .select('slug, acronym, full_name, banner_url, logo_url, contact_email')
    .eq('id', conferenceId)
    .single();

  const conference = confData as ConferenceRow | null;
  const renderConf: EmailRenderConference = {
    slug: conference?.slug ?? '',
    acronym: conference?.acronym ?? '',
    full_name: conference?.full_name ?? '',
    banner_url: conference?.banner_url ?? null,
    logo_url: conference?.logo_url ?? null,
    contact_email: conference?.contact_email ?? '',
  };

  const ctx: EmailTokenContext = {
    delegate_name: invitedName,
    conference_name: conference?.full_name ?? null,
  };

  const acceptUrl = `${getSiteUrl()}/invites/organizer/${token}`;
  const blocks: EmailBlock[] = [
    { type: 'paragraph', content: `You've been invited to join the organizing team of ${renderConf.acronym}.` },
    { type: 'paragraph', content: 'Accepting gives you access to the conference management dashboard. If you don’t have a Gavelling account yet, you can create one in a minute when you open the link.' },
    { type: 'button', label: 'ACCEPT INVITATION', destination: 'custom', url: acceptUrl },
  ];

  const subject = `You're invited to help organize ${renderConf.acronym}`;
  const flatBody = flattenBlocksToPlainText(blocks, renderConf);

  const { error } = await supabase.from('email_outbox').insert({
    conference_id: conferenceId,
    template_id: null,
    recipient_application_id: null,
    recipient_email: invitedEmail,
    subject: resolveTokens(subject, ctx),
    body: resolveTokens(flatBody, ctx),
    body_html: renderEmailHtml({ blocks, conference: renderConf, ctx }),
    status: 'pending',
  });
  if (error) return;

  triggerEmailDelivery(supabase);
}
