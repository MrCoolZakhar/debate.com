'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import PreRegisterNudge from './PreRegisterNudge';
import { hasPreRegistered, PREREG_REGISTERED_KEY } from '@/lib/preregStatus';

const DISMISSED_KEY = 'gavelling-prereg-dismissed';
// Once the nudge has been shown or dismissed anywhere in this browser-tab session, it must
// not appear again, not on navigation, not on another page. Lives in sessionStorage so it
// survives route changes and reloads within the tab, and clears when the tab is closed.
const SESSION_KEY = 'gavelling-prereg-session';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SHOW_DELAY_MS = 1200; // brief beat before the nudge appears, rather than slamming in on load

const EXCLUDED_PREFIXES = ['/chair', '/delegate', '/voting', '/advisor', '/create', '/join', '/pre-register'];
const ALLOWED_PREFIXES = ['/', '/about', '/conferences', '/contact', '/blog'];

function isAllowedRoute(pathname: string): boolean {
  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

function sessionHandled(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}
function markSessionHandled(): void {
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
}

export default function PreRegisterGate() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  const handleClose = useCallback(() => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
    markSessionHandled();
    setShow(false);
  }, []);

  useEffect(() => {
    if (!isAllowedRoute(pathname)) return;

    // Primary guard: shown or dismissed already this session → never again (any page, any
    // navigation). Applies in every environment, so closing it on the landing page keeps it
    // closed everywhere else.
    if (sessionHandled()) return;

    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

    // Persistent cross-session suppression, skipped on localhost so the nudge stays testable
    // from a fresh tab during development.
    if (!isDev) {
      if (hasPreRegistered()) return;
      try {
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed && Date.now() - Number(dismissed) < DISMISS_COOLDOWN_MS) return;
      } catch {}
    }

    let triggered = false;
    const trigger = () => {
      if (triggered) return;
      // Re-check registered in case they signed up via the big modal during the delay.
      if (hasPreRegistered()) return;
      triggered = true;
      markSessionHandled(); // showing it counts as handled, one appearance per session
      setShow(true);
    };

    const timer = setTimeout(trigger, SHOW_DELAY_MS);

    // If the user registers via the big modal while waiting, suppress the nudge.
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREREG_REGISTERED_KEY && e.newValue === 'registered') {
        triggered = true; // prevent timer from firing
        markSessionHandled();
        setShow(false);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('storage', onStorage);
    };
  }, [pathname]);

  if (!show) return null;
  return <PreRegisterNudge onClose={handleClose} />;
}
