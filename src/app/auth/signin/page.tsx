'use client';

import { useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createAuthClient } from '@/lib/supabase-auth';
import {
  AuthLayout,
  CardHeading,
  ErrorBanner,
  GoogleButton,
  OrDivider,
  OUTFIT,
  PasswordField,
  PrimaryButton,
  TextField,
} from '../authUi';

function SignInInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasCallbackError = searchParams.get('error') === 'auth_callback_failed';
  const rawNext = searchParams.get('next');
  // Only allow relative paths (must start with a single "/") to prevent open-redirect.
  const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => createAuthClient(), []);

  async function handleGoogleSignIn() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
    } else {
      router.push(next);
    }
  }

  return (
    <AuthLayout
      eyebrow="Model UN, run properly"
      headline="Where the gavel falls."
      sub="Sign in to run committees, track your MUN history, and manage conferences."
    >
      <CardHeading
        title="Welcome back"
        sub="Sign in to access conferences, track your MUN history, and more."
      />

      {hasCallbackError && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-sm text-center"
          style={{
            backgroundColor: 'rgba(184, 132, 74, 0.12)',
            border: '1px solid rgba(184, 132, 74, 0.35)',
            color: '#7A5A20',
            fontFamily: OUTFIT,
          }}
        >
          Sign-in failed. Please try again.
        </div>
      )}
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <GoogleButton label="SIGN IN WITH GOOGLE" onClick={handleGoogleSignIn} />
      <OrDivider />

      <form onSubmit={handleEmailSignIn} className="space-y-4">
        <TextField
          label="Email address"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
        />

        <div>
          <PasswordField
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="current-password"
          />
          <div className="flex justify-end mt-1.5">
            <Link
              href="/auth/forgot"
              className="text-xs font-semibold transition-colors"
              style={{ color: '#9A8A78', fontFamily: OUTFIT }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <PrimaryButton loading={loading} loadingText="SIGNING IN...">
          SIGN IN
        </PrimaryButton>
      </form>

      <p className="text-sm text-center mt-5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="font-semibold transition-colors" style={{ color: '#1B3828' }}>
          Sign up
        </Link>
      </p>

      <p className="text-xs text-center mt-3" style={{ color: '#C0B4A4', fontFamily: OUTFIT }}>
        By signing in you agree to our Terms of Service and Privacy Policy
      </p>
    </AuthLayout>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
          <div className="w-5 h-5 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SignInInner />
    </Suspense>
  );
}
