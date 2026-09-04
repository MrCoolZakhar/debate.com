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
): Promise<QueueEventEmailResult> {
  const ids = Array.from(new Set(applicationIds.filter(Boolean)));
  if (ids.length === 0) {
    return { outcome: 'no-recipients', drafted: false, eventKey: ALLOCATION_EVENT_KEY, eventLabel: 'Allocation Assigned' };
  }

  let result = await queueEventEmail(supabase, conferenceId, ALLOCATION_EVENT_KEY, ids);
  if (result.outcome === 'unconfigured') {
    const { ok } = await turnOnDefaultEmail(supabase, conferenceId, ALLOCATION_EVENT_KEY);
    if (ok) result = await queueEventEmail(supabase, conferenceId, ALLOCATION_EVENT_KEY, ids);
  }

  const queued = result.queuedApplicationIds ?? [];
  if (queued.length > 0) {
    await supabase
      .from('conference_allocations')
      .update({ allocation_sent: true, allocation_sent_at: new Date().toISOString() })
      .eq('conference_id', conferenceId)
      .in('application_id', queued);
  }
  return result;
}
