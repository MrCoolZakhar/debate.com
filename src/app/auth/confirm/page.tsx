'use client';

import { useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createAuthClient } from '@/lib/supabase-auth';
import Loader from '@/components/Loader';
import {
  AuthLayout,
  CardHeading,
  CodeVerifyScreen,
  ErrorBanner,
  OUTFIT,
  PrimaryButton,
  TextField,
  VerifiedScreen,
  destinationAfterVerify,
  isValidEmail,
  safeNext,
} from '../authUi';

type Phase = 'email' | 'code' | 'verified';

/**
 * Standalone email confirmation.
 *
 * Confirmation codes now arrive with no link at all, so a code that expires,
 * a bookmark, or simply closing the signup tab used to leave someone with no
 * route back into their own account. This route is that route: give us the
 * address you signed up with and we will send a fresh code.
 */
function ConfirmInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams, '/');

  // Prefill from ?email=, e.g. arriving from a link that already knows who
  // this is. Seeded at first render rather than in an effect, so there is no
  // cascading render and no frame showing an empty field. Stays editable.
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [phase, setPhase] = useState<Phase>('email');

  const supabase = useMemo(() => createAuthClient(), []);

  function sendCode(): Promise<string | null> {
    return supabase.auth
      .resend({
        type: 'signup',
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      })
      .then(() => null)
      .catch(() => null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address, including a domain like example.com.');
      return;
    }
    setLoading(true);
    // Deliberately swallow the result and advance either way, exactly as
    // /auth/forgot does. Reporting the error would say whether an account
    // exists for this address, and this page is reachable by anyone.
    await sendCode();
    setLoading(false);
    setPhase('code');
  }

  async function handleContinue() {
    setContinuing(true);
    router.push(await destinationAfterVerify(supabase, next));
  }

  return (
    <AuthLayout
      eyebrow="Model UN, run properly"
      headline="Confirm your email."
      sub="Enter your address and we'll send you a fresh confirmation email."
    >
      {phase === 'verified' ? (
        <VerifiedScreen onContinue={handleContinue} busy={continuing} />
      ) : phase === 'code' ? (
        <CodeVerifyScreen
          email={email}
          startCooldown
          intro="If an account is waiting to be confirmed for this address, we sent a confirmation email to"
          onVerify={async (token) => {
            const { error } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
            if (error) return 'That code is not right, or it has expired. Request a new one below.';
            setPhase('verified');
            return null;
          }}
          onResend={sendCode}
          footer={
            <button
              type="button"
              onClick={() => { setPhase('email'); setError(''); }}
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
            title="Confirm your email"
            sub="We'll send a 6-digit code to the address you signed up with."
          />

          {error && <ErrorBanner>{error}</ErrorBanner>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="Email address"
              type="email"
              required
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <PrimaryButton loading={loading} loadingText="SENDING...">
              SEND CODE
            </PrimaryButton>
          </form>
        </>
      )}
    </AuthLayout>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EDE7D8' }}>
          <Loader size={64} label="Loading confirmation" />
        </div>
      }
    >
      <ConfirmInner />
    </Suspense>
  );
}
