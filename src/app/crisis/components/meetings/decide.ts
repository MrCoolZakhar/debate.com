'use client';
// Gavelling Crisis: decide a meeting and learn whether it landed. The database only moves a meeting from the right state
// (approve or decline what waits, hold what is approved) and answers false otherwise; api.ts's decideMeeting hides that answer,
// so the meeting screens use this one and say "This meeting was already decided" on false.

import { UserFacingError } from '@/lib/friendlyError';
import { crisisError, type CrisisRef } from '@/lib/crisis/api';
import { getCrisisClient } from '@/lib/crisis/client';
import type { MeetingStatus } from '@/lib/crisis/types';

export const MEETING_ALREADY_DECIDED = 'This meeting was already decided';

/** True when the decision landed, false when the meeting was no longer in the state it needed. Throws a friendly error otherwise. */
export async function decideMeetingChecked(ref: CrisisRef, meetingId: string, status: MeetingStatus, staffNote?: string | null, outcomeNote?: string | null): Promise<boolean> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const res = await client.rpc('crisis_decide_meeting', { p_meeting: meetingId, p_status: status, p_staff_note: staffNote ?? null, p_outcome_note: outcomeNote ?? null });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not save that meeting decision.'));
  return res.data !== false;
}
