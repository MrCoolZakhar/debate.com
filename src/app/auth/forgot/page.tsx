'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { createAuthClient } from '@/lib/supabase-auth';
import {
  AuthLayout,
  CardHeading,
  ErrorBanner,
  OUTFIT,
  PrimaryButton,
  TextField,
} from '../authUi';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const supabase = useMemo(() => createAuthClient(), []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <AuthLayout
      eyebrow="Model UN, run properly"
      headline="Locked out? No problem."
      sub="We'll email you a secure link so you can set a new password and get back to committee."
    >
      {sent ? (
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
            Check your email
          </h2>
          <p className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            If an account exists for <strong style={{ color: '#1C1410' }}>{email}</strong>, we&apos;ve
            sent a link to reset your password. The link expires after a short while.
          </p>
          <Link
            href="/auth/signin"
            className="inline-block mt-6 text-sm font-semibold transition-colors"
            style={{ color: '#1B3828', fontFamily: OUTFIT }}
          >
            Back to sign in
          </Link>
        </div>
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
