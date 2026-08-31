'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/components/Loader';
import { createAuthClient } from '@/lib/supabase-auth';
import {
  AuthLayout,
  NoticeScreen,
  OUTFIT,
  PrimaryLinkButton,
} from '../authUi';

/**
 * /auth/error — human-readable explanation when /auth/callback can't complete
 * (expired / already-used / malformed link). The callback redirects here with
 * ?reason=expired|invalid|missing and the original ?next= so we can point the
 * user at the right recovery step (password reset vs. sign in).
 *
 * Before showing anything we check for a live session: a duplicated callback
 * hit can consume the one-time code on one request and fail on the other, so
 * a visitor can arrive here fully signed in. In that case this page is a lie —
 * forward them to where they were going instead. The session cookie can land a
 * beat after the redirect, so we poll briefly rather than checking once.
 */

const COPY: Record<string, { title: string; body: string }> = {
  /* Both of these are reached most often by someone whose token was spent
     before they ever used it: a confirmation link and its 6-digit code are the
     same one-time token, and mail providers fetch links in a message on the
     recipient's behalf — Gmail does. The account is then already confirmed and
     the person is one sign-in away, so the copy leads with that instead of
     leaving them to conclude their registration failed. */
  expired: {
    title: 'This link has already been used',
    body: 'Email links expire quickly and only work once — and your mail provider may well have opened it before you did. If this was a sign-up confirmation, your account is most likely active already: sign in below and you are in.',
  },
  invalid: {
    title: 'This link has already been used',
    body: 'We couldn’t verify this link. Email links only work once, and your mail provider may have opened it before you did. If this was a sign-up confirmation, your account is most likely active already: sign in below and you are in.',
  },
  missing: {
    title: 'Nothing to confirm here',
    body: 'This page is only reachable from an email link, and it looks like the link was incomplete.',
  },
  generic: {
    title: 'Something went wrong',
    body: 'We couldn’t complete that just now. Please request a new link and try again.',
  },
};

/** How long to wait for a late-arriving session cookie before giving up. */
const SESSION_GRACE_MS = 2500;
const SESSION_POLL_MS = 300;

function AuthErrorInner() {
  const router = useRouter();
  const params = useSearchParams();
  const reason = params.get('reason') ?? 'generic';
  const rawNext = params.get('next') ?? '';
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '';
  const copy = COPY[reason] ?? COPY.generic;

  const supabase = useMemo(() => createAuthClient(), []);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return true;
      if (data.session) {
        router.replace(next || '/');
        return true;
      }
      return false;
    };

    const tick = async () => {
      if (await check()) return;
      if (Date.now() - startedAt >= SESSION_GRACE_MS) {
        if (!cancelled) setChecking(false);
        return;
      }
      timer = setTimeout(tick, SESSION_POLL_MS);
    };

    let timer: ReturnType<typeof setTimeout> = setTimeout(tick, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [supabase, router, next]);

  // A recovery link points at /auth/reset — the right next step is a fresh
  // reset email. Anything else (signup confirmation, OAuth) routes to sign in.
  const isReset = next.includes('/auth/reset');
  const suffix = next ? `?next=${encodeURIComponent(next)}` : '';
  const signInHref = `/auth/signin${suffix}`;
  const signUpHref = `/auth/signup${suffix}`;

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
        <Loader size={64} label="Finishing sign in" />
      </div>
    );
  }

  return (
    <AuthLayout
      eyebrow="Model UN, run properly"
      headline="Let’s get you back on track."
      sub="Links time out for your security. Requesting a new one only takes a moment."
    >
      <NoticeScreen
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <line x1="12" y1="7" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12" y2="17" />
          </svg>
        }
        title={copy.title}
        action={
          isReset
            ? <PrimaryLinkButton href="/auth/forgot">REQUEST A NEW LINK</PrimaryLinkButton>
            : <PrimaryLinkButton href={signInHref}>BACK TO SIGN IN</PrimaryLinkButton>
        }
      >
        {copy.body}
      </NoticeScreen>

      <p className="text-sm text-center mt-5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        {isReset ? (
          <>
            Remembered it?{' '}
            <Link href={signInHref} className="font-semibold" style={{ color: '#1B3828' }}>
              Sign in
            </Link>
          </>
        ) : (
          <>
            Forgotten your password?{' '}
            <Link href="/auth/forgot" className="font-semibold" style={{ color: '#1B3828' }}>
              Reset it
            </Link>
            {' · '}
            Need an account?{' '}
            <Link href={signUpHref} className="font-semibold" style={{ color: '#1B3828' }}>
              Sign up
            </Link>
          </>
        )}
      </p>
    </AuthLayout>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
          <Loader size={64} label="Loading" />
        </div>
      }
    >
      <AuthErrorInner />
    </Suspense>
  );
}
