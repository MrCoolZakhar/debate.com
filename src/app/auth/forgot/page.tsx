'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createAuthClient } from '@/lib/supabase-auth';
import {
  AuthLayout,
  CardHeading,
  CheckEmailScreen,
  ErrorBanner,
  OUTFIT,
  PrimaryButton,
  TextField,
  isValidEmail,
} from '../authUi';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const supabase = useMemo(() => createAuthClient(), []);

  function sendResetEmail(): Promise<{ error: string | null }> {
    return supabase.auth
      .resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      })
      .then(({ error }) => ({ error: error ? error.message : null }))
      .catch((e) => ({ error: e instanceof Error ? e.message : 'Something went wrong.' }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address, including a domain like example.com.');
      return;
    }
    setLoading(true);
    // Fire the reset. We ALWAYS show the same neutral success screen afterwards,
    // whether or not an account exists — never reveal account existence. Only a
    // hard transport/config failure (not an unknown-email error, which Supabase
    // does not raise) surfaces an error.
    const { error } = await sendResetEmail();
    setLoading(false);
    if (error) setError(error);
    else setSent(true);
  }

  return (
    <AuthLayout
      eyebrow="Model UN, run properly"
      headline="Locked out? No problem."
      sub="We'll email you a secure link so you can set a new password and get back to committee."
    >
      {sent ? (
        <CheckEmailScreen
          email={email}
          intro={
            <>
              If an account exists for this address, we&apos;ve sent a link to reset your
              password. Open it and choose a new password. The link expires after a short while.
            </>
          }
          onResend={async () => {
            // Swallow errors here too — resending must never reveal whether an
            // account exists. Always report success to the user.
            await sendResetEmail();
            return null;
          }}
          footer={
            <Link
              href="/auth/signin"
              className="text-sm font-semibold transition-colors"
              style={{ color: '#9A8A78', fontFamily: OUTFIT }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
            >
              Back to sign in
            </Link>
          }
        />
      ) : (
        <>
          <CardHeading
            title="Reset your password"
            sub="Enter the email you signed up with and we'll send you a reset link."
          />

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <PrimaryButton loading={loading} loadingText="SENDING LINK...">
              SEND RESET LINK
            </PrimaryButton>
          </form>

          <p className="text-sm text-center mt-5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Remembered it?{' '}
            <Link href="/auth/signin" className="font-semibold transition-colors" style={{ color: '#1B3828' }}>
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
