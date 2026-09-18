'use client';
// Idle logout for the delegate page (/delegate/[code]).
//
// A delegate who does nothing for DELEGATE_IDLE_LOGOUT_MS is signed out of their seat on
// that device: the page gives up its own claim (leave_delegate_seat) and returns to the
// join page with a notice. A warning shows DELEGATE_IDLE_WARNING_MS before that.
//
// Activity = pointer, touch, key, scroll or wheel on the page, the tab becoming visible
// again, or an explicit action (markDelegateActivity(): request to speak, status change,
// chat send, document submit). Passive realtime updates are NOT activity.
//
// Time is wall clock: the hook stores a timestamp and compares against Date.now(), never
// a decrementing counter, so a phone that slept for 70 minutes logs out the moment it
// wakes. An event that arrives after the deadline has already passed logs out rather than
// counting as activity (a wake tap must not rescue an expired seat).
//
// The server backs this up: claim_delegate_seat treats a claim not seen for 65 minutes as
// expired, and the page's 30 s re-verify stops once isIdle() is true, so an idle device
// that never runs this code (closed lid, killed tab) still frees the seat.
//
// Nothing here writes committee state (AGENTS.md rules 3 and 4). The hook only changes
// React state when the warning opens or closes; the per-second countdown lives in
// DelegateIdleWarning.
import { useCallback, useEffect, useRef, useState } from 'react';

export const DELEGATE_IDLE_LOGOUT_MS = 60 * 60 * 1000;
export const DELEGATE_IDLE_WARNING_MS = 2 * 60 * 1000;

const ACTIVITY_EVENT = 'gavelling:delegate-activity';

/** An explicit delegate action. Safe to call anywhere: a no-op when nothing listens. */
export function markDelegateActivity(): void {
  try {
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACTIVITY_EVENT));
  } catch { /* old browser without Event constructor: the pointer event already counted */ }
}

export interface DelegateIdle {
  /** The warning is open. */
  warning: boolean;
  /** Wall-clock ms at which the delegate is logged out. */
  deadline: () => number;
  /** True once the idle threshold has passed (the re-verify must stop). */
  isIdle: () => boolean;
  /** "I'm here". */
  stillHere: () => void;
  /** Re-evaluate now (the countdown calls this when it reaches zero). */
  check: () => void;
}

export function useDelegateIdleLogout(enabled: boolean, onLogout: () => void): DelegateIdle {
  // 0 until the hook is enabled, which stamps the real start time (render must stay pure).
  const lastActivity = useRef(0);
  const fired = useRef(false);
  const [warning, setWarning] = useState(false);
  const onLogoutRef = useRef(onLogout);
  useEffect(() => { onLogoutRef.current = onLogout; }, [onLogout]);

  const isIdle = useCallback(
    () => lastActivity.current > 0 && Date.now() - lastActivity.current >= DELEGATE_IDLE_LOGOUT_MS,
    [],
  );
  const deadline = useCallback(() => lastActivity.current + DELEGATE_IDLE_LOGOUT_MS, []);

  const check = useCallback(() => {
    if (fired.current || lastActivity.current === 0) return;
    const idleFor = Date.now() - lastActivity.current;
    if (idleFor >= DELEGATE_IDLE_LOGOUT_MS) {
      fired.current = true;
      setWarning(false);
      onLogoutRef.current();
      return;
    }
    setWarning(idleFor >= DELEGATE_IDLE_LOGOUT_MS - DELEGATE_IDLE_WARNING_MS);
  }, []);

  const activity = useCallback(() => {
    if (fired.current || lastActivity.current === 0) return;
    // Past the deadline already (a sleeping device that just woke): log out, do not reset.
    if (Date.now() - lastActivity.current >= DELEGATE_IDLE_LOGOUT_MS) { check(); return; }
    lastActivity.current = Date.now();
    setWarning((w) => (w ? false : w));
  }, [check]);

  useEffect(() => {
    // Disabled (e.g. the session is suspended): not idle, so the seat re-verify keeps the
    // claim alive through the break. Re-enabling below starts a fresh hour.
    if (!enabled) { lastActivity.current = 0; return; }
    // Enabling (the seat was just confirmed) is a fresh start, not inherited idle time.
    lastActivity.current = Date.now();
    fired.current = false;
    const opts: AddEventListenerOptions = { capture: true, passive: true };
    const events = ['pointerdown', 'pointermove', 'touchstart', 'keydown', 'wheel'] as const;
    // No 'scroll': the page scrolls itself (chat pinning to the newest message, a list that
    // shrinks), which would keep an abandoned phone "active" forever. Real scrolling always
    // comes with wheel, touch or keys.
    for (const e of events) document.addEventListener(e, activity, opts);
    window.addEventListener(ACTIVITY_EVENT, activity);
    const onVisible = () => { if (document.visibilityState === 'visible') activity(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const id = setInterval(check, 5_000);
    return () => {
      for (const e of events) document.removeEventListener(e, activity, opts);
      window.removeEventListener(ACTIVITY_EVENT, activity);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      clearInterval(id);
      setWarning(false);
    };
  }, [enabled, activity, check]);

  const stillHere = useCallback(() => activity(), [activity]);

  return { warning: enabled && warning, deadline, isIdle, stillHere, check };
}
