'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createAuthClient } from '@/lib/supabase-auth';
import { ageAt } from '@/lib/age';
import { DatePicker } from '@/components/DatePicker';
import { CountryField } from '@/components/CountryField';
import { getCountryByName } from '@/lib/countries';
import Loader from '@/components/Loader';
import {
  AuthLayout,
  CardHeading,
  CodeVerifyScreen,
  ErrorBanner,
  FieldLabel,
  GoogleButton,
  OrDivider,
  OUTFIT,
  PasswordField,
  PrimaryButton,
  TextField,
  inputStyle,
  VerifiedScreen,
  destinationAfterVerify,
  isValidEmail,
  safeNext,
  withNext,
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

/**
 * Nationality picker. Mandatory at sign-up because conferences allocate seats
 * by delegation and several enforce nationality/age eligibility — a blank
 * profile silently blocks the applicant at the point of allocation instead.
 */
function NationalityField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <FieldLabel>Nationality</FieldLabel>
      <CountryField
        value={value}
        onChange={onChange}
        placeholder="Start typing a country..."
        inputStyle={{ ...inputStyle, borderRadius: '12px', paddingTop: '12px', paddingBottom: '12px', fontSize: '14px' }}
      />
      <p className="text-xs mt-1" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
        Pick from the list. Conferences use this for delegation allocation.
      </p>
    </div>
  );
}

type Phase = 'form' | 'awaiting' | 'verified';

function SignUpInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Where a verified/OAuth signup lands, e.g. an invite gate wants the visitor
  // back on its own token page rather than the default onboarding funnel.
  // Only relative paths are allowed (must start with a single "/") to prevent
  // open-redirect, same guard as /auth/signin's next handling.
  const isApplying = searchParams.get('apply') === '1';
  const next = safeNext(searchParams, '/auth/onboarding');
  // Name is captured as two fields and stored as one `full_name`. Conferences
  // sort, search and address applicants by their real name, so a single free
  // "Full name" box that people filled with a nickname was worth splitting.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState(''); // ISO 'YYYY-MM-DD' from the DatePicker
  // Nationality is mandatory: conferences allocate by it and several run
  // age/nationality eligibility rules, so an empty profile blocks them.
  const [nationality, setNationality] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  // Latch: a second click starts a second PKCE flow and overwrites the
  // code_verifier cookie, which is what produced bad_code_verifier failures.
  const [oauthLoading, setOauthLoading] = useState(false);
  const [phase, setPhase] = useState<Phase>('form');
  const [continuing, setContinuing] = useState(false);

  const supabase = useMemo(() => createAuthClient(), []);

  // Prefill from ?email=, e.g. an invite link that already knows the
  // recipient's address. The user can still edit it before submitting.
  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) setEmail(emailParam);
  }, [searchParams]);

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
      router.push(await destinationAfterVerify(supabase, next));
    } else {
      // Verified but the session didn't stick to this tab — send them to sign
      // in rather than a dead end.
      router.push(`/auth/signin?next=${encodeURIComponent(next)}&verified=1`);
    }
  }

  /** Raw Supabase auth errors are not written for the person reading them, and
   *  the two that actually happen here both have a useful answer:
   *
   *  • already confirmed — resend refuses, and the user reads that as "the
   *    emails stopped coming". Their account is live; they need sign-in.
   *  • rate limited — the emails really did stop, for a few minutes, and
   *    "try again shortly" is the whole message. */
  function resendMessage(raw: string): string {
    const m = raw.toLowerCase();
    if (m.includes('already confirmed') || m.includes('already been confirmed') || m.includes('already registered')) {
      return 'This email is already confirmed, so there is nothing left to send. Sign in below and you are in.';
    }
    if (m.includes('rate limit') || m.includes('security purposes') || m.includes('only request this after')) {
      return 'That is a few too many in a row — wait a minute or two and try once more.';
    }
    return raw;
  }

  function resendSignupEmail(): Promise<string | null> {
    return supabase.auth
      .resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      })
      .then(({ error }) => (error ? resendMessage(error.message) : null))
      .catch((e) => (e instanceof Error ? resendMessage(e.message) : 'Could not resend right now. Please try again.'));
  }

  async function handleGoogleSignUp() {
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
    if (!firstName.trim()) {
      setError('Please enter your first name.');
      return;
    }
    if (!lastName.trim()) {
      setError('Please enter your last name.');
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
    // Free text is accepted while typing; only a real UN country name gets
    // through, so allocation and eligibility checks can rely on the value.
    const country = getCountryByName(nationality);
    if (!country) {
      setError('Please choose your nationality from the list.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: dateOfBirth,
          nationality: country.name,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }

    // Instant entry: when email confirmation is DISABLED, signUp returns a
    // live session — go straight to onboarding (or wherever `next` points).
    // With confirmation ON (the normal path) there is no session, so the
    // awaiting-verification screen is the primary outcome.
    if (data.session) {
      router.push(next);
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
        <VerifiedScreen onContinue={handleContinue} busy={continuing} />
      ) : phase === 'awaiting' ? (
        <CodeVerifyScreen
          email={email}
          startCooldown
          intro="We sent a 6-digit code to"
          onVerify={async (token) => {
            const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
            if (error) return 'That code is not right, or it has expired. Request a new one below.';
            setPhase('verified');
            return null;
          }}
          onResend={resendSignupEmail}
          footer={
            <div className="flex flex-col items-center" style={{ gap: 10 }}>
              {/* The escape hatch that was missing. Someone whose token was
                  spent by a mail scanner is already confirmed and needs a door
                  to sign-in, not another code they cannot use. */}
              <span className="text-sm" style={{ color: '#9A8A78', fontFamily: OUTFIT }}>
                Already confirmed?{' '}
                <Link href={withNext('/auth/signin', searchParams)} className="font-semibold" style={{ color: '#1B3828' }}>
                  Sign in instead
                </Link>
              </span>
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
            </div>
          }
        />
      ) : (
        <>
          <CardHeading
            title="Create your account"
            sub="Join Gavelling to track your MUN history, attend conferences, and more."
          />

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
              Create your account to continue your application and we&apos;ll take you straight back to it.
            </div>
          )}
          <GoogleButton label="SIGN UP WITH GOOGLE" onClick={handleGoogleSignUp} disabled={oauthLoading} />
          <OrDivider />

          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField
                label="First name"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ada"
                autoComplete="given-name"
              />
              <TextField
                label="Last name"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Lovelace"
                autoComplete="family-name"
              />
            </div>
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
            <NationalityField value={nationality} onChange={setNationality} />
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
            <Link href={withNext('/auth/signin', searchParams)} className="font-semibold transition-colors" style={{ color: '#1B3828' }}>
              Sign in
            </Link>
          </p>

          <p className="text-xs text-center mt-3" style={{ color: '#C0B4A4', fontFamily: OUTFIT }}>
            By creating an account you agree to our{' '}
            <Link href="/terms" style={{ color: '#9A8A78', fontWeight: 700, textDecoration: 'underline' }}>Terms of Service</Link>{' '}
            and{' '}
            <Link href="/privacy" style={{ color: '#9A8A78', fontWeight: 700, textDecoration: 'underline' }}>Privacy Policy</Link>
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
          <Loader size={64} label="Loading sign up" />
        </div>
      }
    >
      <SignUpInner />
    </Suspense>
  );
}
