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
}

/**
 * Knock the gavel ONCE when a running countdown crosses from above the mark to at or
 * below it.
 *
 * A PURE READER of timer values that already exist (AGENTS.md RULES 3 and 4). It holds
 * nothing but refs: it never calls setCommittee or updateLocal, never touches
 * localUpdateTime and never writes to the database. The only side effect is sound.
 *
 * A crossing needs TWO consecutive samples that were BOTH running, straddling the mark:
 *   - paused, or started already at or below the mark: the earlier sample was not a
 *     running one above the mark, so nothing plays;
 *   - a reload that lands at 12s: the first running sample is 12 (the one before it was
 *     the paused initial state, or no sample at all), so nothing plays;
 *   - extra time lifting it back above the mark: the next genuine crossing plays again;
 *   - landing on 0 (a tab asleep past the deadline) plays nothing, time is already up.
 * Changing the mark itself never plays: the remaining time did not move.
 */
export function useGavelCue(remaining: number, running: boolean, cue: GavelCue | null | undefined): void {
  const armed = !!cue?.armed;
  const at = clampGavelSeconds(cue?.atSeconds);
  const prevRef = useRef<{ remaining: number; running: boolean } | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { remaining, running };
    if (!armed || !prev || !prev.running || !running) return;
    if (prev.remaining > at && remaining <= at && remaining > 0) playGavelKnock();
  }, [remaining, running, armed, at]);

  // While this device may knock, unlock audio on its first click or key press, so the
  // knock can later fire from a timer with no gesture of its own.
  useEffect(() => {
    if (!armed) return;
    return retainGavelAudioUnlock();
  }, [armed]);
}
