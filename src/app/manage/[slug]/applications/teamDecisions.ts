// ── Deciding an application: the shared code (Job Board prompt 3) ─────────
//
// Two callers, one path each:
//   acceptTeamApplication  Settings > Team accepts a secretariat or staff
//                          applicant through accept_team_application, then
//                          runs the post-accept effects moved here unchanged
//                          from the Applications page's secretariat accept:
//                          the application_accepted email (notifyIfNeeded,
//                          heldUnresolvedMessage), payment_available when the
//                          role pays after acceptance, and the pool auto-cover.
//   rejectUpdates / writeReject / rejectFollowUps
//                          the Applications page's reject, split so Settings
//                          > Team runs the SAME update, the SAME rejection
//                          email and the SAME credit refund. Never a second
//                          path.
// Verified writes: an error, or null data, is a failure. The RPC's own
// exception is written for people and is surfaced as it is.

import { getAuthedClient, getFreshAuthedClient } from '@/lib/supabase-auth';
import { queueEventEmail, notifyIfNeeded, heldUnresolvedMessage } from '@/lib/emailEvents';
import { notifyErr } from '@/lib/appNotify';
import { UserFacingError } from '@/lib/friendlyError';
import { poolForRole, fillFreeSpots } from '@/app/manage/[slug]/assignment/delegationShared';

type Client = ReturnType<typeof getAuthedClient>;
export type PushDraftNotice = (eventKey: string, outcome: 'unconfigured' | 'sent-default') => void;

export interface TeamAcceptInput {
  conferenceId: string;
  appId: string;
  role: string;
  societyId: string | null;
  /** application_role_configs.payment_timing of the applicant's role. */
  paymentTiming: string | null;
  /** bundlePermissions('custom', picked sections). */
  permissions: Record<string, unknown>;
  /** Null: the server uses the first pick's listing title. */
  publicTitle: string | null;
  pushDraftNotice: PushDraftNotice;
}

/** Accepts and adds to the team. Throws on a refusal; `followUpFailed` when an email or auto-cover step failed after it. */
export async function acceptTeamApplication(input: TeamAcceptInput): Promise<{ organizerId: string; followUpFailed: boolean }> {
  const supabase = await getFreshAuthedClient();
  if (!supabase) throw new UserFacingError('Your session has expired, please refresh and sign in again.');
  const { data, error } = await supabase.rpc('accept_team_application', {
    p_application_id: input.appId,
    p_permissions: input.permissions,
    p_public_title: input.publicTitle,
  });
  if (error) throw error;
  if (!data) throw new UserFacingError('Could not accept the application. Please try again.');
  const organizerId = data as string;

  // Secondary effects, exactly what a plain accept does: a failure here must
  // NOT roll back the accept.
  let followUpFailed = false;
  try {
    const result = await queueEventEmail(supabase, input.conferenceId, 'application_accepted', [input.appId]);
    notifyIfNeeded(result, input.pushDraftNotice);
    const held = heldUnresolvedMessage(result);
    if (held) notifyErr(held, 'email-held');
    const acceptedIds = new Set(result.queuedApplicationIds ?? []);

    if (input.paymentTiming === 'after_acceptance') {
      const payResult = await queueEventEmail(supabase, input.conferenceId, 'payment_available', [input.appId], undefined, { suppressIds: acceptedIds });
      notifyIfNeeded(payResult, input.pushDraftNotice);
    }

    const pool = poolForRole(input.role);
    if (input.societyId && pool) {
      await fillFreeSpots(supabase, input.conferenceId, input.societyId, pool, { suppressIds: acceptedIds });
    }
  } catch {
    followUpFailed = true;
  }
  return { organizerId, followUpFailed };
}

export interface RejectRow {
  role: string;
  payment_status: string | null;
  self_paid: boolean | null;
  society_id: string | null;
}

export interface RejectUpdates { status: 'rejected'; organizer_note: string | null; payment_status?: string }

/** The row patch a reject writes. Rejecting a pool-covered (not self-paid) paid
 *  member releases their spot back to the delegation. */
export function rejectUpdates(row: RejectRow, note: string): RejectUpdates {
  const pool = poolForRole(row.role);
  const releasesSpot = row.payment_status === 'paid' && !row.self_paid && !!row.society_id && !!pool;
  const updates: RejectUpdates = { status: 'rejected', organizer_note: note.trim() || null };
  if (releasesSpot) updates.payment_status = 'unpaid';
  return updates;
}

/** The PRIMARY write, and only that. Throws on an error. */
export async function writeReject(supabase: Client, appId: string, updates: RejectUpdates, userId: string): Promise<void> {
  const { error } = await supabase.from('applications').update({ ...updates, decided_by: userId, decided_at: new Date().toISOString() }).eq('id', appId);
  if (error) throw error;
}

/**
 * After the reject landed: the rejection email, then the credit refund.
 * Returns the sentence to show when one of them could not be confirmed, else null.
 */
export async function rejectFollowUps(supabase: Client, conferenceId: string, appId: string, pushDraftNotice: PushDraftNotice): Promise<string | null> {
  let problem: string | null = null;
  try {
    const result = await queueEventEmail(supabase, conferenceId, 'application_rejected', [appId]);
    notifyIfNeeded(result, pushDraftNotice);
  } catch {
    problem = 'Rejected, but the rejection email could not be queued.';
  }

  // Refund whatever credit the applicant spent, if any. A benign
  // {refunded:false} means there was nothing to refund.
  //
  // THIS IS MONEY, AND A CATCH CANNOT SEE A FAILED RPC: supabase-js resolves
  // on a PostgREST error, so `error` is checked explicitly.
  try {
    const freshSupabase = await getFreshAuthedClient();
    if (!freshSupabase) {
      problem = 'Rejected, but the credit refund could not be confirmed. Refresh to verify.';
    } else {
      const { error: refundError } = await freshSupabase.rpc('refund_credit_for_application', { p_application_id: appId });
      if (refundError) {
        console.error('[applications]', refundError);
        problem = 'Rejected, but the credit refund could not be confirmed. Refresh to verify.';
      }
    }
  } catch {
    problem = 'Rejected, but the credit refund could not be confirmed. Refresh to verify.';
  }
  return problem;
}
