'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import PreRegisterNudge from './PreRegisterNudge';
import { hasPreRegistered, PREREG_REGISTERED_KEY } from '@/lib/preregStatus';

const DISMISSED_KEY = 'gavelling-prereg-dismissed';
const SEEN_KEY = 'gavelling-prereg-seen';
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const EXCLUDED_PREFIXES = ['/chair', '/delegate', '/voting', '/advisor', '/create', '/join', '/pre-register'];
const ALLOWED_PREFIXES = ['/', '/about', '/conferences', '/contact', '/blog'];

function isAllowedRoute(pathname: string): boolean {
  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) return false;
  return ALLOWED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export default function PreRegisterGate() {
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  const handleClose = useCallback(() => {
    try { localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch {}
    setShow(false);
  }, []);

  useEffect(() => {
    if (!isAllowedRoute(pathname)) return;

    const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

    // Check already registered (skip in dev)
    if (!isDev && hasPreRegistered()) return;

    // Check dismissed cooldown (skip in dev)
    if (!isDev) {
      try {
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed && Date.now() - Number(dismissed) < DISMISS_COOLDOWN_MS) return;
      } catch {}
    }

    // Record first qualifying view
    try {
      if (!localStorage.getItem(SEEN_KEY)) localStorage.setItem(SEEN_KEY, String(Date.now()));
    } catch {}

    let triggered = false;
    const trigger = () => {
      if (triggered) return;
      // Re-check registered in case they signed up via big modal during the delay
      if (hasPreRegistered()) return;
      triggered = true;
      setShow(true);
    };

    // Show immediately on page load
    const timer = setTimeout(trigger, 0);

    // Exit-intent (desktop)
    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) trigger();
    };
    document.addEventListener('mouseout', onMouseOut);

    // Scroll past 40% (mobile-friendly)
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (total > 0 && scrolled / total >= 0.4) trigger();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // If user registers via big modal while waiting, suppress nudge
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREREG_REGISTERED_KEY && e.newValue === 'registered') {
        triggered = true; // prevent timer from firing
        setShow(false);
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mouseout', onMouseOut);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('storage', onStorage);
    };
  }, [pathname]);

  if (!show) return null;
  return <PreRegisterNudge onClose={handleClose} />;
}
