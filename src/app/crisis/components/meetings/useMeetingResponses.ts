'use client';
// Gavelling Crisis: who answered a meeting invitation so far (crisis_meeting_responses, read through RLS), kept fresh by the live
// ping on crisis_meetings. Answers may not ping, so a screen showing a meeting that is still asking the others passes `fast`:
// it then re-reads every 8 s while the tab is visible. null until the first read lands; a failed re-read keeps what is shown.

import { useCallback, useEffect, useRef, useState } from 'react';
import { listMeetingResponses, type CrisisRef } from '@/lib/crisis/api';
import { useCrisisLive } from '@/lib/crisis/live';
import type { MeetingResponse } from './meetingKit';

export function useMeetingResponses(ref: CrisisRef, enabled: boolean, fast = false): { responses: MeetingResponse[] | null; reload: () => Promise<void> } {
  const [responses, setResponses] = useState<MeetingResponse[] | null>(null);
  const seq = useRef(0);
  const reload = useCallback(async () => {
    if (!enabled) return;
    const mine = ++seq.current;
    try {
      const r = await listMeetingResponses(ref);
      if (mine === seq.current) setResponses(r);
    } catch {
      // A failed re-read keeps what is on screen; the next ping or poll tries again.
    }
  }, [ref, enabled]);
  useEffect(() => {
    const t = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(t);
  }, [reload]);
  useEffect(() => {
    if (!enabled || !fast) return undefined;
    const t = window.setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 8000);
    return () => window.clearInterval(t);
  }, [enabled, fast, reload]);
  useCrisisLive(enabled ? ref.id : null, ['crisis_meetings'], () => { void reload(); });
  return { responses, reload };
}
