// Conference check-in — the "who actually showed up" flow organizers run
// ON-SITE during a conference. Mirrors the style of organizerInvites.ts:
// provider-agnostic pure DB writes that take an already-authed Supabase client
// and return clear error strings. RLS ("Organizers update applications",
// is_conference_organizer) gates the write; these helpers do not re-check it.
//
// State model:
//   accepted | assigned  --checkInApplication-->  checked-in (checked_in_at = now)
//   checked-in           --undoCheckIn(revertTo)->  assigned | accepted (checked_in_at = null)
// The UI decides when the button is shown; these helpers do not hard-block on
// the current status, so an idempotent re-check-in or a defensive undo is safe.

import type { getAuthedClient } from '@/lib/supabase-auth';

type AuthedClient = ReturnType<typeof getAuthedClient>;

/**
 * Mark an application as physically present on-site.
 *
 * `actorId` is the organiser performing the check-in (auth user id) — it is
 * stamped on checked_in_by so the dashboard's activity feed can show WHO ran
 * the desk. Optional so an unauthenticated/legacy caller still writes a valid
 * row (the column is nullable and the feed degrades to no avatar).
 */
export async function checkInApplication(
  supabase: AuthedClient,
  applicationId: string,
  actorId?: string | null
): Promise<{ error: string | null; checked_in_at: string | null }> {
  const checkedInAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('applications')
    .update({ status: 'checked-in', checked_in_at: checkedInAt, checked_in_by: actorId ?? null })
    .eq('id', applicationId)
    .select('checked_in_at')
    .single();

  if (error) {
    return { error: error.message || 'Could not check in that attendee.', checked_in_at: null };
  }

  return { error: null, checked_in_at: (data?.checked_in_at as string | null) ?? checkedInAt };
}

/**
 * Reverse a check-in. Clears checked_in_at and restores the pre-check-in
 * status (default 'assigned' — the usual state an attendee was in before
 * arriving; pass 'accepted' when they had no committee assignment).
 *
 * checked_in_by is cleared alongside checked_in_at — the check-in it recorded
 * no longer happened. `actorId` (the organiser undoing it) lands on
 * decided_by instead, since this write is also the row's latest status change,
 * paired with decided_at so the dashboard feed can place it on the timeline.
 *
 * checkInApplication deliberately does NOT touch decided_at/decided_by: the
 * check-in already has its own feed event (checked_in_at/checked_in_by), and
 * stamping a decision too would print the same moment twice.
 */
export async function undoCheckIn(
  supabase: AuthedClient,
  applicationId: string,
  revertTo: 'assigned' | 'accepted' = 'assigned',
  actorId?: string | null
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('applications')
    .update({ status: revertTo, checked_in_at: null, checked_in_by: null, decided_by: actorId ?? null, decided_at: new Date().toISOString() })
    .eq('id', applicationId);

  if (error) {
    return { error: error.message || 'Could not undo that check-in.' };
  }

  return { error: null };
}
