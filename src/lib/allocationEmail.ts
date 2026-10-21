// ── Allocation announcement: the queue ───────────────────────────────────────
// "You are France in DISEC" is the single most important message this product
// sends. This module is the ONLY place 'allocation_assigned' is raised and the
// ONLY place conference_allocations.allocation_sent / allocation_sent_at is
// flipped to true — the two have to move together or the roster starts lying.
//
// It lives in src/lib (not beside the organiser UI) because two very different
// callers need it and neither can import the other's:
//
//   • the organiser's assignment page, in the browser, with their own JWT
//   • /api/emails/queue-participant, on the server, with the service role,
//     when a DELEGATION LEADER seats one of their own block members
//
// The second caller is why this is not a 'use client' module. A leader's own
// session can never insert an email_outbox row (the table's only RLS policy is
// organiser-writes) and can never flip allocation_sent, so their half has to
// run server-side — but it must run the SAME rules, or who happened to press
// the button would decide whether a delegate is ever told where they sit.

import type { getAuthedClient } from '@/lib/supabase-auth';
import { queueEventEmail, turnOnDefaultEmail, type QueueEventEmailResult } from '@/lib/emailEvents';

export const ALLOCATION_EVENT_KEY = 'allocation_assigned';

// ── The 3-minute buffer (owner, 21 Oct 2026) ────────────────────────────────
// An allocation emailed on Assign waits ALLOCATION_EMAIL_BUFFER_SECONDS in the
// outbox (send_after), so a quick re-assign or unassign voids it and the
// delegate only ever gets the final seat. It needs the database half in
// scratch-allocation-email-buffer.sql: the 'cancelled' outbox status,
// cancel_pending_allocation_emails(), and the trigger that stamps
// allocation_sent when the row actually leaves (so the delegate cannot see the
// seat before the email does). Until an owner applies that file and flips this,
// every send is immediate and stamped at queue time, exactly as before.
export const ALLOCATION_EMAIL_BUFFER_DB = false;
export const ALLOCATION_EMAIL_BUFFER_SECONDS = 180;

/** send_after for a buffered allocation email, from the caller's best "now"
 *  (pass the database clock where the caller has one). Null while the buffer is off. */
export function allocationBufferSendAfter(nowMs: number): string | null {
  if (!ALLOCATION_EMAIL_BUFFER_DB) return null;
  return new Date(nowMs + ALLOCATION_EMAIL_BUFFER_SECONDS * 1000).toISOString();
}

/**
 * Voids every allocation email for these applications that is still waiting in
 * the buffer (status pending or held, never claimed by the sender). Returns how
 * many applications had one voided: for those the delegate was never told, so
 * the caller sends no "removed" / "changed" email either. 0 while the buffer is
 * off, and 0 on any failure (the caller then behaves as if it had gone out).
 */
export async function cancelBufferedAllocationEmails(
  supabase: Client,
  conferenceId: string,
  applicationIds: string[],
): Promise<Set<string>> {
  const ids = Array.from(new Set(applicationIds.filter(Boolean)));
  if (!ALLOCATION_EMAIL_BUFFER_DB || ids.length === 0) return new Set();
  try {
    const { data, error } = await supabase.rpc('cancel_pending_allocation_emails', {
      p_conference: conferenceId,
      p_application_ids: ids,
    });
    if (error || !Array.isArray(data)) return new Set();
    return new Set((data as { application_id: string }[]).map(r => r.application_id));
  } catch {
    return new Set();
  }
}

type Client = ReturnType<typeof getAuthedClient>;

/**
 * Queues the allocation announcement for `applicationIds` and marks exactly
 * the recipients that actually got an outbox row as sent.
 *
 * Two behaviours worth keeping:
 *
 * • **Unconfigured self-heals.** queueEventEmail returns 'unconfigured' — and
 *   sends nothing at all — when the conference has no email_templates row for
 *   the event. Most conferences have none, which is why MUJMUN's 70 delegates
 *   got no allocation email and the announcement had to go out as a manual
 *   276-recipient broadcast. The registry has always declared this event
 *   `defaultDelivery: 'immediate'`, so an event that has never been configured
 *   turns its default copy on and retries once, the same thing the "TURN ON"
 *   affordance on the DraftNotice does. This is the superset rule already
 *   documented for draft_reminder / request_received.
 *   A row that EXISTS with enabled=false is an explicit organiser "off" and is
 *   honoured — never re-enabled here.
 *
 * • **Only what queued gets marked.** allocation_sent is a claim that a
 *   delegate was told. Recipients dropped by their notification preferences,
 *   or every recipient when the template is switched off, are left unsent so
 *   the roster keeps telling the truth.
 */
export async function queueAllocationEmails(
  supabase: Client,
  conferenceId: string,
  applicationIds: string[],
  /** Buffered send (organiser auto-email on Assign only). With the buffer on,
   *  allocation_sent is NOT stamped here: the database stamps it when the row
   *  actually leaves, and a voided row never stamps it. */
  opts?: { sendAfter?: string | null },
): Promise<QueueEventEmailResult> {
  const ids = Array.from(new Set(applicationIds.filter(Boolean)));
  if (ids.length === 0) {
    return { outcome: 'no-recipients', drafted: false, eventKey: ALLOCATION_EVENT_KEY, eventLabel: 'Allocation Assigned' };
  }

  const buffered = ALLOCATION_EMAIL_BUFFER_DB && !!opts?.sendAfter;
  const queueOpts = buffered ? { sendAfter: opts!.sendAfter! } : undefined;
  let result = await queueEventEmail(supabase, conferenceId, ALLOCATION_EVENT_KEY, ids, undefined, queueOpts);
  if (result.outcome === 'unconfigured') {
    const { ok } = await turnOnDefaultEmail(supabase, conferenceId, ALLOCATION_EVENT_KEY);
    if (ok) result = await queueEventEmail(supabase, conferenceId, ALLOCATION_EVENT_KEY, ids, undefined, queueOpts);
  }

  const queued = result.queuedApplicationIds ?? [];
  if (queued.length > 0 && !buffered) {
    await supabase
      .from('conference_allocations')
      .update({ allocation_sent: true, allocation_sent_at: new Date().toISOString() })
      .eq('conference_id', conferenceId)
      .in('application_id', queued);
  }
  return result;
}
