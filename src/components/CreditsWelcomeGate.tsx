'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getAuthedClient } from '@/lib/supabase-auth';
import CreditsWelcomeModal from '@/components/CreditsWelcomeModal';

// The anonymous, code-based committee-session product (chair/delegate/advisor/
// voting screens, the /join code entry) and the auth flow itself never render
// the SiteNav site chrome — the welcome modal has no business appearing there.
const EXCLUDED_PREFIXES = ['/auth', '/chair', '/delegate', '/advisor', '/voting', '/join'];

function isExcludedPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

// Mounted once in the root layout. Replaces the old profile-page-only
// WelcomeTokenModal trigger so a fresh signup is greeted wherever
// postOnboardingDest sends them, not only if they happen to visit /account/profile.
export default function CreditsWelcomeGate() {
  const pathname = usePathname();
  const { user, session, loading: authLoading } = useAuth();
  const [seen, setSeen] = useState<boolean | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  // Guards against the modal re-opening from a token refresh re-running the
  // fetch after the user already dismissed it this session.
  const handledRef = useRef(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !session) return;
    if (handledRef.current) return;
    const supabase = getAuthedClient(session.access_token);
    supabase
      .from('profiles')
      .select('welcome_token_seen')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (handledRef.current) return;
        const flag = (data as { welcome_token_seen?: boolean } | null)?.welcome_token_seen ?? null;
        setSeen(flag);
        if (flag === false) {
          handledRef.current = true;
          setShowWelcome(true);
        }
      });
  }, [authLoading, user, session]);

  function dismissWelcome() {
    handledRef.current = true;
    setShowWelcome(false);
    if (user && session) {
      getAuthedClient(session.access_token)
        .from('profiles').update({ welcome_token_seen: true }).eq('id', user.id).then(() => {});
    }
  }

  if (isExcludedPath(pathname)) return null;
  if (!user || !session) return null;
  if (seen === null || seen === true) return null;
  if (!showWelcome) return null;

  return <CreditsWelcomeModal onClose={dismissWelcome} />;
}
