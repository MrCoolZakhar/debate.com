'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createAuthClient } from '@/lib/supabase-auth';
import { ageAt } from '@/lib/age';
import { DatePicker } from '@/components/DatePicker';
import {
  AuthLayout,
  CardHeading,
  CheckEmailScreen,
  CheckMark,
  ErrorBanner,
  FieldLabel,
  GoogleButton,
  NoticeScreen,
  OrDivider,
  OUTFIT,
  PasswordField,
  PrimaryActionButton,
  PrimaryButton,
  TextField,
  isValidEmail,
} from '../authUi';

// Today's date as an ISO 'YYYY-MM-DD' string — the latest birthday we allow.
const TODAY_ISO = new Date().toISOString().slice(0, 10);

/**
 * Date-of-birth field built on the shared friendly DatePicker.
 * `max` = today (nobody is born in the future) and the calendar seeds around
 * 2005 so the typical delegate isn't stranded on the current month; the year
 * <input> inside the picker lets them jump decades in one keystroke.
 */
function DobField({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  return (
    <div>
      <FieldLabel>Date of birth</FieldLabel>
      <DatePicker
        value={value}
        onChange={onChange}
        max={TODAY_ISO}
        initialView="2005-06-15"
        placeholder="Select your date of birth"
      />
      <p className="text-xs mt-1" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        You must be at least 13. Some conferences use this to check age requirements.
      </p>
    </div>
  );
}

type Phase = 'form' | 'awaiting' | 'verified';

function SignUpInner() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState(''); // ISO 'YYYY-MM-DD' from the DatePicker
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [continuing, setContinuing] = useState(false);

  const supabase = useMemo(() => createAuthClient(), []);

  // ── Live verification detection ──────────────────────────────────────────
  // While the awaiting screen shows, watch for the account being confirmed —
  // possibly in ANOTHER tab (the email link opens /auth/callback there, which
  // sets the shared session cookie). Poll getSession, subscribe to auth-state
  // changes, and re-check on tab focus / storage writes. All listeners are torn
  // down on unmount and once we've transitioned to the verified state.
  useEffect(() => {
    if (phase !== 'awaiting') return;
    let done = false;

    const markVerified = () => {
      if (done) return;
      done = true;
      setPhase('verified');
    };

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) markVerified();
    };

    // Poll every 3s.
    const poll = setInterval(check, 3000);
    // Same-tab auth changes.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) markVerified();
    });
    // Cross-tab signals.
    const onStorage = () => { void check(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void check(); };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisible);
    // Fire an immediate check in case verification already happened.
    void check();

    return () => {
      done = true;
      clearInterval(poll);
      sub.subscription.unsubscribe();
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, supabase]);

  async function handleContinue() {
    setContinuing(true);
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      router.push('/auth/onboarding');
    } else {
      // Verified but the session didn't stick to this tab — send them to sign
      // in rather than a dead end.
      router.push('/auth/signin?next=/auth/onboarding&verified=1');
    }
  }

  function resendSignupEmail(): Promise<string | null> {
    return supabase.auth
      .resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/onboarding` },
      })
      .then(({ error }) => (error ? error.message : null))
      .catch((e) => (e instanceof Error ? e.message : 'Could not resend right now. Please try again.'));
  }

  async function handleGoogleSignUp() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/onboarding`,
      },
    });
  }

  async function handleEmailSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setEmailError('');
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address, including a domain like example.com.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!dob) {
      setError('Please enter your date of birth.');
      return;
    }
    const dateOfBirth = dob; // already 'YYYY-MM-DD' from the DatePicker
    const age = ageAt(dateOfBirth);
    if (age === null || age < 0 || age > 120) {
      setError('That date of birth doesn’t look right. Please double-check it.');
      return;
    }
    if (age < 13) {
      setError('You need to be at least 13 years old to create a Gavelling account.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, date_of_birth: dateOfBirth },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/auth/onboarding`,
      },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Instant entry: when email confirmation is DISABLED, signUp returns a
    // live session — go straight to onboarding. With confirmation ON (the
    // normal path) there is no session, so the awaiting-verification screen
    // is the primary outcome.
    if (data.session) {
      router.push('/auth/onboarding');
      return;
    }
    setLoading(false);
    setPhase('awaiting');
  }

  return (
    <AuthLayout
      eyebrow="Model UN, run properly"
      headline="Take the floor."
      sub="Create an account to attend conferences, build your MUN CV, and run committees of your own."
    >
      {phase === 'verified' ? (
        <NoticeScreen
          icon={<CheckMark size={26} />}
          title="You're verified. Happy Gavelling!"
          action={
            <PrimaryActionButton loading={continuing} loadingText="TAKING YOU IN…" onClick={handleContinue}>
              CONTINUE
            </PrimaryActionButton>
          }
        >
          Your email is confirmed and your account is ready. Let&apos;s finish setting things up.
        </NoticeScreen>
      ) : phase === 'awaiting' ? (
        <CheckEmailScreen
          email={email}
          intro={
            <>
              We&apos;ve sent a confirmation link to your inbox. Open it and click{' '}
              <strong style={{ color: '#1C1410' }}>ACTIVATE MY ACCOUNT</strong> to finish creating your account. This page will update automatically once you do.
            </>
          }
          onResend={resendSignupEmail}
          footer={
            <button
              type="button"
              onClick={() => { setPhase('form'); setError(''); }}
              className="text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
              style={{ color: '#9A8A78', fontFamily: OUTFIT, background: 'none', border: 'none', cursor: 'pointer', outlineColor: '#1B3828' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#1B3828'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = '#9A8A78'; }}
            >
              Wrong email? Start over
            </button>
          }
        />
      ) : (
        <>
          <CardHeading
            title="Create your account"
            sub="Join Gavelling to track your MUN history, attend conferences, and more."
          />

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <GoogleButton label="SIGN UP WITH GOOGLE" onClick={handleGoogleSignUp} />
          <OrDivider />

          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <TextField
              label="Full name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Lovelace"
              autoComplete="name"
            />
            <div>
              <TextField
                label="Email address"
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                placeholder="you@example.com"
                autoComplete="email"
                aria-invalid={!!emailError}
                aria-describedby={emailError ? 'signup-email-error' : undefined}
              />
              {emailError && (
                <p id="signup-email-error" role="alert" className="text-xs mt-1.5" style={{ color: '#8B2020', fontFamily: OUTFIT }}>
                  {emailError}
                </p>
              )}
            </div>
            <DobField value={dob} onChange={setDob} />
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              placeholder="Min. 8 characters"
              minLength={8}
              autoComplete="new-password"
            />

            <PrimaryButton loading={loading} loadingText="CREATING ACCOUNT...">
              CREATE ACCOUNT
            </PrimaryButton>
          </form>

          <p className="text-sm text-center mt-5" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
            Already have an account?{' '}
            <Link href="/auth/signin" className="font-semibold transition-colors" style={{ color: '#1B3828' }}>
              Sign in
            </Link>
          </p>

          <p className="text-xs text-center mt-3" style={{ color: '#C0B4A4', fontFamily: OUTFIT }}>
            By creating an account you agree to our Terms of Service and Privacy Policy
          </p>
        </>
      )}
    </AuthLayout>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
          <div className="w-5 h-5 border-2 border-[#1B3828] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SignUpInner />
    </Suspense>
  );
}
