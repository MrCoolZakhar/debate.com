'use client';

// ── When a conference room stops being restartable ──────────────────────────
//
// Owner, 23 Oct 2026: a conference room that was ended stays restartable until the
// conference's last day is over (src/lib/roomRetention.ts, `reopenWindowEndsAt`). This
// file answers "when is that" for one live session, with one anon read: the
// `conference_committees` row linked to the session and its conference's dates. Both
// tables have an anon `true` SELECT policy, so a private conference is covered.
//
// The instant is 23:59 on the last day (end_date, else start_date) in the conference's
// own timezone. With no timezone stored (most conferences today) it is 23:59 in UTC-12,
// the last place on earth where that day is still running: generous on purpose, so a
// room is never refused while its last day is still on somewhere. The database mirrors
// the same rule in `start_my_chair_session` (scratch-conference-rooms.sql, section C1).
//
// null = not a conference room, no dates, or the read failed: callers then keep the
// standalone 24 hours. Nothing here writes.

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { endOfDayIso } from '@/lib/applicationWindow';

/** The latest timezone on earth: where a calendar day ends last. */
const LAST_ZONE = 'Etc/GMT+12';

function validZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** 23:59 on the conference's last day, as epoch ms, or null without dates. */
export function conferenceLastDayEndsAtMs(c: {
  start_date?: string | null;
  end_date?: string | null;
  timezone?: string | null;
}): number | null {
  const lastDay = (c.end_date || c.start_date || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastDay)) return null;
  const ms = Date.parse(endOfDayIso(lastDay, validZone(c.timezone) ?? LAST_ZONE));
  return Number.isFinite(ms) ? ms : null;
}

const cache = new Map<string, number | null>();

/** The reopen limit of the conference room `sessionId`, or null (see above). Cached per session. */
export async function loadConferenceRoomEndsAt(sessionId: string): Promise<number | null> {
  if (cache.has(sessionId)) return cache.get(sessionId) ?? null;
  try {
    const { data, error } = await supabase
      .from('conference_committees')
      .select('conference_id, conferences (start_date, end_date, timezone)')
      .eq('session_id', sessionId)
      .maybeSingle();
    if (error) return null;
    const conf = (data as { conferences?: { start_date: string | null; end_date: string | null; timezone: string | null } | null } | null)?.conferences ?? null;
    const ms = conf ? conferenceLastDayEndsAtMs(conf) : null;
    cache.set(sessionId, ms);
    return ms;
  } catch {
    return null;
  }
}

/** React wrapper: the limit for a conference room, null until known (or for a standalone room). */
export function useConferenceRoomEndsAt(sessionId: string | null | undefined, isConferenceRoom: boolean): number | null {
  const [endsAt, setEndsAt] = useState<number | null>(() => (sessionId && cache.has(sessionId) ? cache.get(sessionId) ?? null : null));
  useEffect(() => {
    if (!sessionId || !isConferenceRoom) return;
    let cancelled = false;
    void loadConferenceRoomEndsAt(sessionId).then((ms) => { if (!cancelled) setEndsAt(ms); });
    return () => { cancelled = true; };
  }, [sessionId, isConferenceRoom]);
  return isConferenceRoom ? endsAt : null;
}
