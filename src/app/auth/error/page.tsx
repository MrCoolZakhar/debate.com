'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Loader from '@/components/Loader';
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
 */

const COPY: Record<string, { title: string; body: string }> = {
  expired: {
    title: 'This link has expired',
    body: 'The link you followed is no longer valid. Email links expire quickly and can only be used once.',
  },
  invalid: {
    title: 'This link isn’t valid',
    body: 'We couldn’t verify this link. It may have already been used, or been copied incorrectly.',
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

function AuthErrorInner() {
  const params = useSearchParams();
  const reason = params.get('reason') ?? 'generic';
  const next = params.get('next') ?? '';
  const copy = COPY[reason] ?? COPY.generic;

  // A recovery link points at /auth/reset — the right next step is a fresh
  // reset email. Anything else (signup confirmation, OAuth) routes to sign in.
  const isReset = next.includes('/auth/reset');

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
            : <PrimaryLinkButton href="/auth/signin">BACK TO SIGN IN</PrimaryLinkButton>
        }
      >
        {copy.body}
      </NoticeScreen>

      <p className="text-sm text-center mt-5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        {isReset ? (
          <>
            Remembered it?{' '}
            <Link href="/auth/signin" className="font-semibold" style={{ color: '#1B3828' }}>
              Sign in
            </Link>
          </>
        ) : (
          <>
            Need an account?{' '}
            <Link href="/auth/signup" className="font-semibold" style={{ color: '#1B3828' }}>
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
