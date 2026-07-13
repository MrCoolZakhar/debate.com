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

/** Mark an application as physically present on-site. */
export async function checkInApplication(
  supabase: AuthedClient,
  applicationId: string
): Promise<{ error: string | null; checked_in_at: string | null }> {
  const checkedInAt = new Date().toISOString();

  const { data, error } = await supabase
    .from('applications')
    .update({ status: 'checked-in', checked_in_at: checkedInAt })
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
 */
export async function undoCheckIn(
  supabase: AuthedClient,
  applicationId: string,
  revertTo: 'assigned' | 'accepted' = 'assigned'
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('applications')
    .update({ status: revertTo, checked_in_at: null })
    .eq('id', applicationId);

  if (error) {
    return { error: error.message || 'Could not undo that check-in.' };
  }

  return { error: null };
}
