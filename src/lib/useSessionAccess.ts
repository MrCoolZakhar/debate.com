'use client';

// ── useSessionAccess ──────────────────────────────────────────────────────────
// The conference access guard shared by /chair/[code], /voting/[code] and
// /advisor/[code]. One implementation, because all three had the same bug.
//
// THE BUG (15 Sep 2026, "the session starts loading and refreshes by itself"):
// each page ran its guard in an effect keyed on `session?.access_token` and began with
// `setAccessState('checking')`. supabase-js refreshes the access token about once an
// hour on a visible tab, and again when a tab that slept past expiry becomes visible
// (`_onVisibilityChanged` → `_recoverAndRefresh` → TOKEN_REFRESHED). Every refresh gave
// AuthProvider a new token, the guard re-ran, and the page rendered the full-screen
// GavelLoader over a live committee, unmounting every panel, modal and draft beneath it,
// then drew the room again: exactly a spontaneous reload. It hit every SIGNED-IN chair,
// standalone rooms included (the 'checking' reset ran before the conference check).
// The same flip toggled `useChairDeviceLock`'s `enabled`, which re-ran its load claim
// WITH takeover, so an hourly refresh on one device could kick the same account's other
// device. And because the guard failed closed, a re-check that hit a dropped connection
// or an expired token turned a live session into the sign-in or "not your committee"
// screen.
//
// THE RULES NOW:
//   • Keyed on the user id, never on the token. The token is read through a ref at
//     check time, so a refresh re-runs nothing.
//   • A re-check (sign-in, account switch, Retry) keeps a settled 'allowed' /
//     'standalone' on screen until it has a definite new answer.
//   • A check that could not be answered (the conference lookup or the membership read
//     failed) is NOT a verdict: a settled page stays as it is, a first load shows
//     'error' with an inline Retry (`retry()`), never the loader and never a reload.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  detectConferenceSessionOrNull,
  isConferenceSessionOrNull,
  verifyConferenceAccess,
  type ConferenceAccess,
} from '@/lib/conferenceAccess';

export type SessionAccessState = 'checking' | 'standalone' | 'allowed' | 'denied' | 'signin' | 'error';

const settled = (s: SessionAccessState) => s === 'allowed' || s === 'standalone';

export function useSessionAccess(opts: {
  code: string;
  /** 'dais' = detectConferenceSession (chair, voting); 'origin' = isConferenceSession (advisor). */
  gate: 'dais' | 'origin';
  /** Which verified conference roles may open this page. */
  allow: (kind: ConferenceAccess['kind']) => boolean;
}): { state: SessionAccessState; retry: () => void } {
  const { code, gate } = opts;
  const { user, session, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState<SessionAccessState>('checking');
  const [retryTick, setRetryTick] = useState(0);

  // Declared BEFORE the guard effect, so in the commit where the user changes this ref
  // already carries the new session's token when the guard reads it.
  const tokenRef = useRef<string | null>(session?.access_token ?? null);
  useEffect(() => { tokenRef.current = session?.access_token ?? null; }, [session?.access_token]);
  const allowRef = useRef(opts.allow);
  useEffect(() => { allowRef.current = opts.allow; }, [opts.allow]);

  useEffect(() => {
    let cancelled = false;
    // Auth still resolving: stay on whatever is showing ('checking' on a first load).
    if (authLoading) return;
    const keepOr = (next: SessionAccessState) => (prev: SessionAccessState) => (settled(prev) ? prev : next);
    void (async () => {
      if (cancelled) return;
      setState(keepOr('checking'));
      const isConf = gate === 'dais'
        ? await detectConferenceSessionOrNull(code)
        : await isConferenceSessionOrNull(code);
      if (cancelled) return;
      if (isConf === null) { setState(keepOr('error')); return; }
      if (!isConf) { setState('standalone'); return; }
      const token = tokenRef.current;
      if (!token || !userId) { setState('signin'); return; }
      const access = await verifyConferenceAccess(code, token, userId);
      if (cancelled) return;
      if (access.kind === 'error') { setState(keepOr('error')); return; }
      setState(allowRef.current(access.kind) ? 'allowed' : 'denied');
    })();
    return () => { cancelled = true; };
  }, [code, gate, authLoading, userId, retryTick]);

  const retry = useCallback(() => {
    setState('checking');
    setRetryTick((n) => n + 1);
  }, []);

  return { state, retry };
}
