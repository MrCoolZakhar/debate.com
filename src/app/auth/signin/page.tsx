'use client';

import { useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createAuthClient } from '@/lib/supabase-auth';
import Loader from '@/components/Loader';
import {
  AuthLayout,
  CardHeading,
  CodeVerifyScreen,
  ErrorBanner,
  GoogleButton,
  OrDivider,
  OUTFIT,
  PasswordField,
  PrimaryButton,
  TextField,
  safeNext,
  withNext,
} from '../authUi';

function SignInInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasCallbackError = searchParams.get('error') === 'auth_callback_failed';
  const justVerified = searchParams.get('verified') === '1';
  const isApplying = searchParams.get('apply') === '1';
  const next = safeNext(searchParams, '/');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Latch: a second click starts a second PKCE flow and overwrites the
  // code_verifier cookie, which is what produced bad_code_verifier failures.
  const [oauthLoading, setOauthLoading] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  const supabase = useMemo(() => createAuthClient(), []);

  async function handleGoogleSignIn() {
    if (oauthLoading) return;
    setOauthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser is already navigating away; only a failed start
    // returns here, and the button has to become usable again.
    if (error) {
      setOauthLoading(false);
      setError(error.message);
    }
  }

  // Verifying inline with verifyOtp skips /auth/callback, and with it the
  // onboarding gate that lives there. The signup wizard never collects
  // education_level, so without this a rescued account would land in the app
  // with no education level and no MUN CV. Mirrors destinationFor() in
  // src/app/auth/callback/route.ts.
  async function goAfterVerify() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push(`/auth/signin?next=${encodeURIComponent(next)}&verified=1`);
      return;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('education_level')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile || profile.education_level == null) {
      router.push(next === '/auth/onboarding' ? '/auth/onboarding' : `/auth/onboarding?next=${encodeURIComponent(next)}`);
      return;
    }
    router.push(next);
  }

  function resendSignupCode(): Promise<string | null> {
    return supabase.auth
      .resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      })
      .then(({ error }) => (error ? error.message : null))
      .catch((e) => (e instanceof Error ? e.message : 'Could not resend right now. Please try again.'));
  }

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // An unconfirmed account is not a failed sign-in, it is a missing step.
      // Supabase reports it as code 'email_not_confirmed' on newer clients and
      // only as a message on older ones, so check both.
      const code = (error as { code?: string }).code;
      const unconfirmed =
        code === 'email_not_confirmed' ||
        error.message.toLowerCase().includes('not confirmed');
      if (unconfirmed) {
        await resendSignupCode();
        setLoading(false);
        setUnconfirmedEmail(email);
        return;
      }
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
      {unconfirmedEmail ? (
        <CodeVerifyScreen
          email={unconfirmedEmail}
          startCooldown
          intro="Your email is not confirmed yet. We sent a 6-digit code to"
          onVerify={async (token) => {
            const { error } = await supabase.auth.verifyOtp({ email: unconfirmedEmail, token, type: 'signup' });
            if (error) return 'That code is not right, or it has expired. Request a new one below.';
            await goAfterVerify();
            return null;
          }}
          onResend={resendSignupCode}
          footer={
            <button
              type="button"
              onClick={() => setUnconfirmedEmail(null)}
              className="text-sm font-semibold transition-colors"
              style={{ color: '#9A8A78', fontFamily: OUTFIT }}
            >
              Back to sign in
            </button>
          }
        />
      ) : (
        <>
          <CardHeading
            title="Welcome back"
            sub="Sign in to access conferences, track your MUN history, and more."
          />

          {justVerified && (
            <div
              role="status"
              className="mb-4 px-4 py-3 rounded-xl text-sm text-center"
              style={{
                backgroundColor: 'rgba(27, 56, 40, 0.08)',
                border: '1px solid rgba(27, 56, 40, 0.2)',
                color: '#1B3828',
                fontFamily: OUTFIT,
              }}
            >
              Your email is verified. Sign in to finish setting up your account.
            </div>
          )}
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

          {isApplying && (
            <div
              role="status"
              className="mb-4 px-4 py-3 rounded-xl text-sm text-center"
              style={{
                backgroundColor: 'rgba(27, 56, 40, 0.08)',
                border: '1px solid rgba(27, 56, 40, 0.2)',
                color: '#1B3828',
                fontFamily: OUTFIT,
              }}
            >
              Sign in to continue your application — we&apos;ll take you straight back to it.
            </div>
          )}

          <GoogleButton label="SIGN IN WITH GOOGLE" onClick={handleGoogleSignIn} disabled={oauthLoading} />
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
            <Link href={withNext('/auth/signup', searchParams)} className="font-semibold transition-colors" style={{ color: '#1B3828' }}>
              Sign up
            </Link>
          </p>

          <p className="text-xs text-center mt-3" style={{ color: '#C0B4A4', fontFamily: OUTFIT }}>
            By signing in you agree to our{' '}
            <Link href="/terms" style={{ color: '#9A8A78', fontWeight: 700, textDecoration: 'underline' }}>Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" style={{ color: '#9A8A78', fontWeight: 700, textDecoration: 'underline' }}>Privacy Policy</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
          <Loader size={64} label="Loading sign in" />
        </div>
      }
    >
      <SignInInner />
    </Suspense>
  );
}
