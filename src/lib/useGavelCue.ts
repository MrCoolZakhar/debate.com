'use client';

import { useEffect, useRef } from 'react';
import { clampGavelSeconds, playGavelKnock, retainGavelAudioUnlock } from './gavelSound';

/**
 * Whether this device may knock, and at what second mark. Built once on the chair page
 * and shared by every countdown it watches.
 */
export interface GavelCue {
  /** Moderator's device, session live (not ended, not suspended), setting switched on. */
  armed: boolean;
  /** Knock when the countdown reaches this many seconds (clamped to 1..600). */
  atSeconds: number;
  /**
   * The session code. Two tabs of the chair page on one device are the SAME device, so
   * both are Moderator, and a background tab keeps ticking the anchor it loaded (the
   * Moderator ignores current_speaker events, RULE 6) long after the other tab paused or
   * called the next speaker. Only the tab the chair last clicked or typed in knocks.
   */
  scope?: string;
}

/** The largest drop between two consecutive running samples that is still a countdown. */
export const GAVEL_MAX_STEP_SECONDS = 2;
/** The longest gap between two samples that is still one continuous countdown. */
const MAX_SAMPLE_GAP_MS = 3000;

// ── Which tab of this device drives the knock ────────────────────────────────
const TAB_ID = typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const tabKey = (scope: string) => `gavelling-gavel-knock-tab:${scope}`;
const scopes = new Map<string, number>();
const onTabGesture = () => {
  for (const scope of scopes.keys()) {
    try { if (localStorage.getItem(tabKey(scope)) !== TAB_ID) localStorage.setItem(tabKey(scope), TAB_ID); } catch { /* storage blocked */ }
  }
};
function retainTabScope(scope: string): () => void {
  if (typeof window === 'undefined') return () => {};
  if (scopes.size === 0) {
    window.addEventListener('pointerdown', onTabGesture, true);
    window.addEventListener('keydown', onTabGesture, true);
  }
  scopes.set(scope, (scopes.get(scope) ?? 0) + 1);
  return () => {
    const n = (scopes.get(scope) ?? 1) - 1;
    if (n > 0) scopes.set(scope, n); else scopes.delete(scope);
    if (scopes.size === 0) {
      window.removeEventListener('pointerdown', onTabGesture, true);
      window.removeEventListener('keydown', onTabGesture, true);
    }
  };
}
/** No recorded tab (storage blocked, nobody clicked yet) = this tab may knock. */
function thisTabDrives(scope: string | undefined): boolean {
  if (!scope) return true;
  try {
    const owner = localStorage.getItem(tabKey(scope));
    return !owner || owner === TAB_ID;
  } catch { return true; }
}

type Sample = { remaining: number; running: boolean; identity: string; at: number };

/**
 * Knock the gavel ONCE when a running countdown crosses from above the mark to at or
 * below it.
 *
 * A PURE READER of timer values that already exist (AGENTS.md RULES 3 and 4). It holds
 * nothing but refs: it never calls setCommittee or updateLocal, never touches
 * localUpdateTime and never writes to the database. The only side effect is sound.
 *
 * A crossing is a GENUINE countdown step, which means all of:
 *   - two consecutive samples that were BOTH running, straddling the mark;
 *   - the same `identity` on both (the clock's anchor: a reseat, a Next, a Restart, a new
 *     limit, a catch-up or a gavel resync gives a new identity, so a value that JUMPED to
 *     below the mark is never read as a countdown);
 *   - a drop of at most GAVEL_MAX_STEP_SECONDS, taken within MAX_SAMPLE_GAP_MS. A tab
 *     that slept or was throttled and wakes 40 s later, a server clock offset correction,
 *     or a stale derived value catching up in the next render all move the value by more
 *     than a tick, and a knock that late would sound random;
 *   - this is the tab of the device the chair last used (`cue.scope`, see GavelCue).
 * Paused, started already at or below the mark, a reload that lands at 12 s, landing on 0
 * and changing the mark itself never play.
 */
export function useGavelCue(
  remaining: number,
  running: boolean,
  cue: GavelCue | null | undefined,
  identity: string | number | null = null,
): void {
  const armed = !!cue?.armed;
  const at = clampGavelSeconds(cue?.atSeconds);
  const scope = cue?.scope;
  const id = identity === null ? '' : String(identity);
  const prevRef = useRef<Sample | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    prevRef.current = { remaining, running, identity: id, at: now };
    if (!armed || !prev || !prev.running || !running) return;
    if (prev.identity !== id) return;
    if (!(prev.remaining > at && remaining <= at && remaining > 0)) return;
    if (prev.remaining - remaining > GAVEL_MAX_STEP_SECONDS) return;
    if (now - prev.at > MAX_SAMPLE_GAP_MS) return;
    if (!thisTabDrives(scope)) return;
    playGavelKnock();
  }, [remaining, running, id, armed, at, scope]);

  // While this device may knock, unlock audio on its first click or key press, so the
  // knock can later fire from a timer with no gesture of its own.
  useEffect(() => {
    if (!armed) return;
    return retainGavelAudioUnlock();
  }, [armed]);

  useEffect(() => {
    if (!armed || !scope) return;
    return retainTabScope(scope);
  }, [armed, scope]);
}
