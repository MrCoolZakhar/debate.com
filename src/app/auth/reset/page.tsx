'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createAuthClient } from '@/lib/supabase-auth';
import {
  AuthLayout,
  CardHeading,
  ErrorBanner,
  OUTFIT,
  PasswordField,
  PrimaryButton,
} from '../authUi';

/**
 * /auth/reset — landing page for the password-recovery email link.
 * The recovery link points at /auth/callback?next=/auth/reset, so by the
 * time the user arrives here the session has already been established by
 * the code exchange. We just take a new password via updateUser.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  const supabase = useMemo(() => createAuthClient(), []);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setHasSession(!!data.session);
    });
    // Recovery links using the implicit (hash-fragment) flow establish the
    // session slightly after load — listen so we don't show a false negative.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setHasSession(true);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
    setTimeout(() => router.push('/'), 1800);
  }

  return (
    <AuthLayout
      eyebrow="Model UN, run properly"
      headline="Set a new password."
      sub="Pick something strong — then you're straight back into your conferences."
    >
      {done ? (
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: 'rgba(27, 56, 40, 0.1)' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            Password updated
          </h2>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            You&apos;re signed in — taking you home…
          </p>
        </div>
      ) : hasSession === false ? (
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2" style={{ color: '#1C1410', fontFamily: OUTFIT }}>
            This link has expired
          </h2>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Password reset links only work once and expire quickly. Request a fresh one and try again.
          </p>
          <Link
            href="/auth/forgot"
            className="inline-block mt-6 text-sm font-semibold transition-colors"
            style={{ color: '#1B3828', fontFamily: OUTFIT }}
          >
            Request a new link
          </Link>
        </div>
      ) : (
        <>
          <CardHeading title="Choose a new password" sub="Minimum 8 characters." />

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="New password"
              value={password}
              onChange={setPassword}
              placeholder="Min. 8 characters"
              minLength={8}
              autoComplete="new-password"
            />
            <PasswordField
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              placeholder="Repeat your new password"
              minLength={8}
              autoComplete="new-password"
            />
            <PrimaryButton loading={loading} loadingText="UPDATING...">
              UPDATE PASSWORD
            </PrimaryButton>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
