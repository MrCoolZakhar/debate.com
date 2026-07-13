'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createAuthClient } from '@/lib/supabase-auth';
import { ageAt } from '@/lib/age';
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
  blurInput,
  focusInput,
  inputStyle,
  isValidEmail,
} from '../authUi';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/**
 * Three friendly selects (Day / Month / Year) instead of a raw date input.
 * Year list runs newest→oldest starting at (thisYear − 8), down 100 years.
 */
function DobPicker({
  day, month, year,
  onDay, onMonth, onYear,
}: {
  day: string; month: string; year: string;
  onDay: (v: string) => void; onMonth: (v: string) => void; onYear: (v: string) => void;
}) {
  const thisYear = new Date().getFullYear();
  const years = useMemo(
    () => Array.from({ length: 93 }, (_, i) => String(thisYear - 8 - i)),
    [thisYear],
  );
  const daysInMonth = useMemo(() => {
    if (!month) return 31;
    const y = year ? parseInt(year, 10) : 2000; // leap-friendly default
    return new Date(y, parseInt(month, 10), 0).getDate();
  }, [month, year]);
  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => String(i + 1)),
    [daysInMonth],
  );

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: 'none',
    WebkitAppearance: 'none',
    backgroundImage:
      `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239A8A78' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
  };

  return (
    <div>
      <FieldLabel>Date of birth</FieldLabel>
      <div className="grid gap-2" style={{ gridTemplateColumns: '1.6fr 1fr 1.2fr' }}>
        <select
          required
          value={month}
          onChange={(e) => {
            onMonth(e.target.value);
            // Clamp the day if the new month is shorter.
            const y = year ? parseInt(year, 10) : 2000;
            const max = new Date(y, parseInt(e.target.value || '1', 10), 0).getDate();
            if (day && parseInt(day, 10) > max) onDay(String(max));
          }}
          aria-label="Month of birth"
          className="w-full rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none"
          style={selectStyle}
          onFocus={focusInput}
          onBlur={blurInput}
        >
          <option value="" disabled>Month</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={String(i + 1)}>{m}</option>
          ))}
        </select>
        <select
          required
          value={day}
          onChange={(e) => onDay(e.target.value)}
          aria-label="Day of birth"
          className="w-full rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none"
          style={selectStyle}
          onFocus={focusInput}
          onBlur={blurInput}
        >
          <option value="" disabled>Day</option>
          {days.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          required
          value={year}
          onChange={(e) => onYear(e.target.value)}
          aria-label="Year of birth"
          className="w-full rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none"
          style={selectStyle}
          onFocus={focusInput}
          onBlur={blurInput}
        >
          <option value="" disabled>Year</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
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
  const [dobDay, setDobDay] = useState('');
  const [dobMonth, setDobMonth] = useState('');
  const [dobYear, setDobYear] = useState('');
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
    if (!dobDay || !dobMonth || !dobYear) {
      setError('Please enter your date of birth.');
      return;
    }
    const dateOfBirth = `${dobYear}-${dobMonth.padStart(2, '0')}-${dobDay.padStart(2, '0')}`;
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
            <DobPicker
              day={dobDay} month={dobMonth} year={dobYear}
              onDay={setDobDay} onMonth={setDobMonth} onYear={setDobYear}
            />
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
