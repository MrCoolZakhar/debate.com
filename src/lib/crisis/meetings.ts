'use client';
// Gavelling Crisis: the meeting clock (docs/crisis/sql/014). Staff and chairs start and stop a meeting;
// the database stamps started_at / ended_at. Not strict: nothing stops by itself, nothing blocks.

import { UserFacingError } from '@/lib/friendlyError';
import { crisisError, type CrisisRef } from './api';
import { getCrisisClient } from './client';

export type MeetingClockAction = 'start' | 'stop' | 'reset';

/** 'start' sets started_at (status approved), 'stop' sets ended_at (status held), 'reset' clears both. */
export async function meetingClock(ref: CrisisRef, meetingId: string, action: MeetingClockAction): Promise<void> {
  const client = await getCrisisClient(ref.conf, ref.crisis);
  const res = await client.rpc('crisis_meeting_clock', { p_meeting: meetingId, p_action: action });
  if (res.error) throw new UserFacingError(crisisError(res.error, 'Could not change the meeting clock. Try again.'));
}

/** 0 -> "00:00", 372 -> "06:12", 3725 -> "1:02:05". */
export function clockText(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const two = (x: number) => String(x).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${two(m)}:${two(sec)}`;
}

/** Seconds a meeting has run: to now while running, to ended_at when stopped, null when never started. */
export function meetingSeconds(m: { started_at: string | null; ended_at: string | null }, nowMs: number): number | null {
  if (!m.started_at) return null;
  const start = new Date(m.started_at).getTime();
  const end = m.ended_at ? new Date(m.ended_at).getTime() : nowMs;
  return Math.max(0, Math.round((end - start) / 1000));
}

/** Running = started, not stopped, and still an approved meeting (a hand-marked "held" or a cancelled one is not running). */
export const meetingRunning = (m: { started_at: string | null; ended_at: string | null; status?: string }) =>
  !!m.started_at && !m.ended_at && (m.status === undefined || m.status === 'approved');
