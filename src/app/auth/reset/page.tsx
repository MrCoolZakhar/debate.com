'use client';

import { useEffect, useMemo, useState } from 'react';
import { createAuthClient } from '@/lib/supabase-auth';
import {
  AuthLayout,
  CardHeading,
  CheckMark,
  ErrorBanner,
  NoticeScreen,
  OUTFIT,
  PasswordField,
  PrimaryButton,
  PrimaryLinkButton,
} from '../authUi';

/**
 * /auth/reset — landing page for the password-recovery email link.
 * The recovery link points at /auth/callback?next=/auth/reset, so by the
 * time the user arrives here the session has already been established by
 * the code exchange. We just take a new password via updateUser.
 */
export default function ResetPasswordPage() {
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
  }

  return (
    <AuthLayout
      eyebrow="Model UN, run properly"
      headline="Set a new password."
      sub="Pick something strong, then you're straight back into your conferences."
    >
      {done ? (
        <NoticeScreen
          icon={<CheckMark size={26} />}
          title="Password updated"
          action={
            <div style={{ marginTop: 24 }}>
              <PrimaryLinkButton href="/">CONTINUE TO GAVELLING</PrimaryLinkButton>
            </div>
          }
        >
          You&apos;re signed in and ready to go.
        </NoticeScreen>
      ) : hasSession === null ? (
        // Still establishing (or failing to establish) the recovery session.
        // Show a neutral checking state rather than flashing the form for a
        // link that may have already expired.
        <div className="py-10 flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
          <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: '#1B3828', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>Checking your reset link…</p>
        </div>
      ) : hasSession === false ? (
        <NoticeScreen
          icon={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B3828" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="7" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12" y2="17" />
            </svg>
          }
          title="This reset link has expired"
          action={<PrimaryLinkButton href="/auth/forgot">REQUEST A NEW LINK</PrimaryLinkButton>}
        >
          Password reset links only work once and expire quickly. Request a fresh one and we&apos;ll email it straight over.
        </NoticeScreen>
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
