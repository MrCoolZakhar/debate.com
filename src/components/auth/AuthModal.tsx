'use client';

// ── "Log in or sign up": the whole auth flow in one pop-up ───────────────────
//
// Owner, 18 Sep 2026: "Instead of the log in and sign up page being a complete
// separate page, simply make it a pop-up, so the user never goes to a different
// page ... Airbnb's flow, exactly that." One field first (email). Continue asks
// the database which way to go (`auth_email_status`, below) and the next step
// opens in the same dialog:
//
//   email ─┬─ 'password' ── password ── (forgot → forgotSent)
//          ├─ 'google'   ── "You signed up with Google" ── Continue with Google
//          └─ 'new'      ── signup ("Finish signing up") ── confirm (6-digit code)
//   Google (any time) ── /auth/callback?via=modal ── back on the same page;
//          missing nationality / date of birth → `?auth=finish` → finish step
//
// Every signed-in exit goes through `afterSignedIn`: nationality and date of
// birth missing → the finish step (no X, no Escape, no backdrop, Sign out is
// the only other way out: the same rule as CompleteBasicsGate); otherwise the
// dialog closes and the visitor stays on the page (or goes to `next`).
//
// Account-existence: `auth_email_status` is a SECURITY DEFINER RPC returning
// only 'new' | 'password' | 'google' | 'invalid' for an email. That is the
// Airbnb trade-off, stated plainly: anyone can learn whether an address has a
// Gavelling account, and whether it uses Google. Supabase already disclosed as
// much before (signUp answers an existing address with an empty `identities`
// list, and the old sign-in page said "email not confirmed" for an unconfirmed
// one), the platform holds no sensitive account types, and forgot-password
// still answers neutrally. If that ever matters, swap the RPC for "always show
// the password step, with a Create an account link" and nothing else changes.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, LogOut, Mail, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabaseAuthClient } from '@/lib/supabase-auth';
import { CountryField } from '@/components/CountryField';
import { DatePicker } from '@/components/DatePicker';
import { GeoGuessNote, useNationalityPrefill } from '@/components/GeoCountryGuess';
import { useModalEscape } from '@/components/ModalOverlay';
import { useScrollLock } from '@/hooks/useScrollLock';
import { clearPendingBasics, validateBasics } from '@/lib/pendingBasics';
import { setBasicsGateStatus } from '@/lib/basicsGateState';
import { closeAuth, openAuth, useAuthModal, type AuthRequest } from '@/lib/authModal';
import {
  CheckEmailScreen,
  CodeVerifyScreen,
  EyeIcon,
  EyeOffIcon,
  GoogleIcon,
  isValidEmail,
} from '@/app/auth/authUi';

// ── Tokens ──────────────────────────────────────────────────────────────────

const OUTFIT = "'Outfit', sans-serif";
const INK = '#1C1410';
const INK_SOFT = '#5E5246'; // 7:1 on the panel, for real sentences
const HAIR = '#E6DECC';
const FIELD_BORDER = '#B9AE98';
const FOREST = '#1B3828';
const GOLD = '#EED98A';
const DANGER = '#8B2020';
const PANEL = '#FFFDF8';
const FOCUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B6871F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFDF8]';

type Step =
  | 'email'
  | 'password'
  | 'google'
  | 'signup'
  | 'confirm'
  | 'forgot'
  | 'forgotSent'
  | 'finish';

type EmailStatus = 'new' | 'password' | 'google' | 'invalid';

const TODAY_ISO = () => new Date().toISOString().slice(0, 10);

/** Where the visitor should end up after signing in. */
function targetOf(req: AuthRequest): string {
  if (req.next) return req.next;
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search + window.location.hash;
}

function callbackUrl(next: string): string {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}&via=modal`;
}

/** Plain-language versions of the Supabase auth errors people actually hit. */
function friendlyAuthError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That password is not right. Try again, or reset it below.';
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('only request this after')) {
    return 'That is a few too many tries in a row. Wait a minute and try again.';
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'This email already has an account. Log in instead.';
  }
  if (m.includes('password') && m.includes('at least')) return 'Your password needs at least 8 characters.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'We could not reach Gavelling. Check your connection and try again.';
  return raw;
}

// ── Host: mounted once in the root layout ───────────────────────────────────

export default function AuthModalHost() {
  const { open, request, nonce } = useAuthModal();
  return (
    <>
      <Suspense fallback={null}><AuthQueryOpener /></Suspense>
      {open ? <AuthModal key={nonce} request={request} /> : null}
    </>
  );
}

function AuthQueryOpener() {
  useAuthQueryOpener();
  return null;
}

/** Opens the modal from `?auth=` (the /auth/signin redirect, an OAuth return
 *  with `auth=finish`, a guard's redirect) and strips those keys from the bar.
 *  Keyed on the search params, so a client navigation to such a URL opens it
 *  too. The host sits in a Suspense boundary for useSearchParams. */
function useAuthQueryOpener() {
  const searchParams = useSearchParams();
  const auth = searchParams.get('auth');
  useEffect(() => {
    if (!auth) return;
    const url = new URL(window.location.href);
    const p = url.searchParams;
    if (!p.get('auth')) return;
    const step = auth === 'finish' ? 'finish' : auth === 'signup' ? 'signup' : auth === 'forgot' ? 'forgot' : 'signin';
    let notice: string | undefined;
    if (p.get('verified') === '1') notice = 'Your email is confirmed. Log in to carry on.';
    if (p.get('error') === 'auth_callback_failed') notice = 'That sign-in did not go through. Please try again.';
    const req: AuthRequest = step === 'finish'
      ? { step }
      : {
          step,
          next: p.get('next') ?? undefined,
          email: p.get('email') ?? undefined,
          apply: p.get('apply') === '1',
          notice,
        };
    // `auth=finish` is appended to the page's own URL by /auth/callback, so
    // only that key goes. The others were put there for the modal alone.
    const keys = step === 'finish' ? ['auth'] : ['auth', 'next', 'email', 'apply', 'verified', 'error'];
    keys.forEach((k) => p.delete(k));
    const clean = url.pathname + (p.toString() ? `?${p.toString()}` : '') + url.hash;
    window.history.replaceState(window.history.state, '', clean);
    openAuth(req);
  }, [auth]);
}

// ── The dialog ──────────────────────────────────────────────────────────────

function AuthModal({ request }: { request: AuthRequest }) {
  const router = useRouter();
  const { signOut } = useAuth();
  const supabase = supabaseAuthClient;

  const [step, setStep] = useState<Step>(
    request.step === 'finish' ? 'finish' : request.step === 'forgot' ? 'forgot' : 'email',
  );
  const [history, setHistory] = useState<Step[]>([]);
  const [email, setEmail] = useState(request.email ?? '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState(false);
  const [confirmMode, setConfirmMode] = useState<'signup' | 'unconfirmed'>('signup');
  // True when the account check failed and the password step is a guess: only
  // then does it offer "New here? Create an account".
  const [statusUnknown, setStatusUnknown] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const next = useMemo(() => targetOf(request), [request]);

  const dismissable = step !== 'finish';
  const close = useCallback(() => { if (dismissable) closeAuth(); }, [dismissable]);

  useScrollLock(true);
  // The finish step registers a no-op on purpose: top of the shared Escape
  // stack, so Escape neither closes it nor anything hidden behind it.
  useModalEscape(dismissable ? close : () => {}, true);

  // Focus: first field on every step, back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => { try { opener?.focus?.(); } catch { /* gone */ } };
  }, []);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const t = window.setTimeout(() => {
      const first = panel.querySelector<HTMLElement>('[data-autofocus], input:not([type=hidden]):not([disabled]), button[data-primary]');
      first?.focus({ preventScroll: true });
    }, 30);
    return () => window.clearTimeout(t);
  }, [step]);

  // Focus trap: Tab cycles inside the panel.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
    )).filter((el) => el.offsetParent !== null || el === document.activeElement);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const go = (s: Step) => {
    setError('');
    setHistory((h) => [...h, step]);
    setStep(s);
  };
  const back = () => {
    setError('');
    setHistory((h) => {
      const prev = h[h.length - 1];
      if (prev) setStep(prev);
      return h.slice(0, -1);
    });
  };

  /** Close and land. Staying on this page = refresh its server data. */
  const land = useCallback(() => {
    setBasicsGateStatus('ok');
    closeAuth();
    const here = window.location.pathname + window.location.search + window.location.hash;
    if (request.next && request.next !== here) router.push(request.next);
    else router.refresh();
  }, [request.next, router]);

  /** Every signed-in exit. Missing basics → the finish step. */
  const afterSignedIn = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { land(); return; }
    let row: { nationality: string | null; date_of_birth: string | null } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await supabase.from('profiles').select('nationality, date_of_birth').eq('id', user.id).maybeSingle();
      if (!res.error && res.data) { row = res.data; break; }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
    }
    // A row we could not read is not a row with blanks in it (same rule as
    // CompleteBasicsGate): land, and the gate re-reads on the next page.
    if (!row || (row.nationality?.trim() && row.date_of_birth)) { land(); return; }
    setBusy(false);
    setHistory([]);
    setError('');
    setStep('finish');
  }, [land, supabase]);

  async function startGoogle() {
    if (oauthBusy) return;
    setError('');
    // Answers another visitor left on the old sign-up page in this browser
    // belong to the account THEY were creating.
    clearPendingBasics();
    setOauthBusy(true);
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl(next) },
    });
    // On success the browser is already on its way to Google.
    if (e) { setOauthBusy(false); setError(friendlyAuthError(e.message)); }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    const clean = email.trim();
    if (!isValidEmail(clean)) { setError('Enter a valid email address, like name@example.com.'); return; }
    setEmail(clean);
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc('auth_email_status', { p_email: clean });
    setBusy(false);
    const status = (rpcError ? null : data) as EmailStatus | null;
    setStatusUnknown(!status);
    // If the check itself fails, the password step is the safe guess: it links
    // to sign-up for anyone who turns out to be new.
    if (status === 'new') go('signup');
    else if (status === 'google') go('google');
    else if (status === 'invalid') setError('Enter a valid email address, like name@example.com.');
    else go('password');
  }

  function resendSignupCode(): Promise<string | null> {
    return supabase.auth
      .resend({ type: 'signup', email, options: { emailRedirectTo: callbackUrl(next) } })
      .then(({ error: e }) => (e ? friendlyAuthError(e.message) : null))
      .catch((e) => (e instanceof Error ? friendlyAuthError(e.message) : 'Could not resend right now. Please try again.'));
  }

  const title =
    step === 'email' ? 'Log in or sign up'
    : step === 'password' ? 'Log in'
    : step === 'google' ? 'Log in'
    : step === 'signup' ? 'Finish signing up'
    : step === 'confirm' ? 'Confirm your email'
    : step === 'forgot' || step === 'forgotSent' ? 'Reset your password'
    : 'Finish signing up';

  const showBack = dismissable && history.length > 0;

  const node = (
    <div
      className="gv-auth-backdrop"
      onMouseDown={(e) => {
        // Only a press on the backdrop itself. Clicks inside portaled
        // popovers (country list, calendar) bubble here through React.
        if (e.target === e.currentTarget && dismissable) close();
      }}
    >
      <style>{MODAL_CSS}</style>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gv-auth-title"
        className="gv-auth-panel"
        onKeyDown={onKeyDown}
      >
        {/* Header: X (or back) at the inline start, the title centred. */}
        <div className="gv-auth-head">
          <div className="gv-auth-head-slot">
            {showBack ? (
              <button type="button" onClick={back} aria-label="Back" className={`gv-auth-icon ${FOCUS}`}>
                <ArrowLeft size={18} strokeWidth={2.4} aria-hidden />
              </button>
            ) : dismissable ? (
              <button type="button" onClick={close} aria-label="Close" className={`gv-auth-icon ${FOCUS}`}>
                <X size={18} strokeWidth={2.4} aria-hidden />
              </button>
            ) : null}
          </div>
          <h2 id="gv-auth-title" className="gv-auth-title">{title}</h2>
          <div className="gv-auth-head-slot" />
        </div>

        <div className="gv-auth-body">
          {step === 'email' && (
            <EmailStep
              email={email}
              setEmail={(v) => { setEmail(v); if (error) setError(''); }}
              error={error}
              busy={busy}
              oauthBusy={oauthBusy}
              apply={!!request.apply}
              notice={request.notice}
              onSubmit={submitEmail}
              onGoogle={startGoogle}
            />
          )}

          {step === 'password' && (
            <PasswordStep
              email={email}
              onChangeEmail={back}
              onForgot={() => go('forgot')}
              onNew={statusUnknown ? () => go('signup') : undefined}
              onSignedIn={afterSignedIn}
              onUnconfirmed={async () => {
                const err = await resendSignupCode();
                setConfirmMode('unconfirmed');
                go('confirm');
                if (err) setError(err);
              }}
            />
          )}

          {step === 'google' && (
            <GoogleAccountStep
              email={email}
              busy={oauthBusy}
              error={error}
              onGoogle={startGoogle}
              onSetPassword={() => go('forgot')}
            />
          )}

          {step === 'signup' && (
            <SignupStep
              email={email}
              next={next}
              onDone={afterSignedIn}
              onAwaitingCode={() => { setConfirmMode('signup'); go('confirm'); }}
              onExisting={() => go('password')}
            />
          )}

          {step === 'confirm' && (
            <div className="gv-auth-screen">
              {error && <ErrorLine>{error}</ErrorLine>}
              <CodeVerifyScreen
                email={email}
                startCooldown
                intro={confirmMode === 'unconfirmed'
                  ? 'Your email is not confirmed yet. We sent a 6-digit code to'
                  : 'We sent a 6-digit code to'}
                onVerify={async (token) => {
                  const { error: e } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
                  if (e) return 'That code is not right, or it has expired. Request a new one below.';
                  await afterSignedIn();
                  return null;
                }}
                onResend={resendSignupCode}
                footer={
                  <p className="gv-auth-small">
                    You can also open the link in the email. It brings you back here, signed in.
                  </p>
                }
              />
            </div>
          )}

          {step === 'forgot' && (
            <ForgotStep
              email={email}
              setEmail={setEmail}
              onSent={() => go('forgotSent')}
            />
          )}

          {step === 'forgotSent' && (
            <div className="gv-auth-screen">
              <CheckEmailScreen
                email={email}
                intro="If an account exists for this address, we sent a link to choose a new password. It expires after a short while."
                onResend={async () => {
                  // Never reveal whether an account exists: always "sent".
                  await sendResetEmail(email);
                  return null;
                }}
                footer={
                  <button type="button" onClick={() => { setHistory([]); setStep('email'); }} className={`gv-auth-link ${FOCUS}`}>
                    Back to log in
                  </button>
                }
              />
            </div>
          )}

          {step === 'finish' && (
            <FinishStep
              onDone={land}
              onNoSession={() => closeAuth()}
              onSignOut={async () => {
                await signOut();
                closeAuth();
                window.location.href = '/';
              }}
            />
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

function sendResetEmail(email: string) {
  return supabaseAuthClient.auth
    .resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset` })
    .then(({ error }) => (error ? error.message : null))
    .catch((e) => (e instanceof Error ? e.message : 'Something went wrong.'));
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function ErrorLine({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <p id={id} role="alert" className="gv-auth-error">{children}</p>
  );
}

function Field({
  label, id, children, note,
}: { label: string; id: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="gv-auth-field">
      <label htmlFor={id} className="gv-auth-label">{label}</label>
      {children}
      {note}
    </div>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`gv-auth-input ${props.className ?? ''}`} />;
}

function PasswordInput({
  id, value, onChange, autoComplete, placeholder, describedBy,
}: {
  id: string; value: string; onChange: (v: string) => void; autoComplete: string; placeholder?: string; describedBy?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <TextInput
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-describedby={describedBy}
        style={{ paddingRight: 46 }}
        required
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className={`gv-auth-eye ${FOCUS}`}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function ContinueButton({
  children, busy, busyText, type = 'submit', onClick, disabled,
}: {
  children: React.ReactNode; busy?: boolean; busyText?: string; type?: 'submit' | 'button'; onClick?: () => void; disabled?: boolean;
}) {
  const [spot, setSpot] = useState<{ x: number; y: number } | null>(null);
  return (
    <button
      type={type}
      data-primary
      onClick={onClick}
      disabled={busy || disabled}
      aria-busy={busy || undefined}
      className={`gv-auth-cta ${FOCUS}`}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        setSpot({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
      }}
      onMouseLeave={() => setSpot(null)}
      style={spot ? { ['--spot-x' as string]: `${spot.x}%`, ['--spot-y' as string]: `${spot.y}%` } : undefined}
    >
      <span className="gv-auth-cta-shine" aria-hidden style={{ opacity: spot ? 1 : 0 }} />
      <span className="relative">{busy ? busyText ?? 'One moment…' : children}</span>
    </button>
  );
}

function GoogleButtonRow({ onClick, busy, label = 'Continue with Google' }: { onClick: () => void; busy: boolean; label?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={`gv-auth-social ${FOCUS}`}>
      <span className="gv-auth-social-icon"><GoogleIcon /></span>
      <span>{busy ? 'Opening Google…' : label}</span>
    </button>
  );
}

function OrLine() {
  return (
    <div className="gv-auth-or" aria-hidden>
      <span />
      <em>or</em>
      <span />
    </div>
  );
}

function TermsLine({ action }: { action: string }) {
  return (
    <p className="gv-auth-terms">
      By selecting <strong>{action}</strong>, you agree to Gavelling&apos;s{' '}
      <Link href="/terms" target="_blank" rel="noopener" className={FOCUS}>Terms of Service</Link>{' '}
      and acknowledge the{' '}
      <Link href="/privacy" target="_blank" rel="noopener" className={FOCUS}>Privacy Policy</Link>.
    </p>
  );
}

// ── Step: email ─────────────────────────────────────────────────────────────

function EmailStep({
  email, setEmail, error, busy, oauthBusy, apply, notice, onSubmit, onGoogle,
}: {
  email: string; setEmail: (v: string) => void; error: string; busy: boolean; oauthBusy: boolean;
  apply: boolean; notice?: string; onSubmit: (e: React.FormEvent) => void; onGoogle: () => void;
}) {
  return (
    <div className="gv-auth-screen">
      <div className="gv-auth-welcome">
        <img src="/gavelling-mark.png" alt="" width={44} height={44} className="gv-auth-mark" />
        <h3>Welcome to Gavelling</h3>
      </div>

      {apply && (
        <p className="gv-auth-notice" role="status">
          Log in or sign up to carry on with your application. We will bring you straight back to it.
        </p>
      )}
      {notice && <p className="gv-auth-notice" role="status">{notice}</p>}

      <form onSubmit={onSubmit} noValidate>
        <Field label="Email" id="gv-auth-email">
          <TextInput
            id="gv-auth-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? 'gv-auth-email-error' : 'gv-auth-email-hint'}
            data-autofocus
          />
        </Field>
        {error ? (
          <ErrorLine id="gv-auth-email-error">{error}</ErrorLine>
        ) : (
          <p id="gv-auth-email-hint" className="gv-auth-small">
            We will check whether you already have an account. If not, we will set one up.
          </p>
        )}
        <div style={{ marginTop: 16 }}>
          <ContinueButton busy={busy} busyText="Checking…">Continue</ContinueButton>
        </div>
      </form>

      <OrLine />
      <GoogleButtonRow onClick={onGoogle} busy={oauthBusy} />
    </div>
  );
}

// ── Step: password (existing account) ───────────────────────────────────────

function PasswordStep({
  email, onChangeEmail, onForgot, onNew, onSignedIn, onUnconfirmed,
}: {
  email: string; onChangeEmail: () => void; onForgot: () => void; onNew?: () => void;
  onSignedIn: () => Promise<void>; onUnconfirmed: () => Promise<void>;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!password) { setError('Enter your password.'); return; }
    setError('');
    setBusy(true);
    const { error: err } = await supabaseAuthClient.auth.signInWithPassword({ email, password });
    if (err) {
      const code = (err as { code?: string }).code;
      if (code === 'email_not_confirmed' || err.message.toLowerCase().includes('not confirmed')) {
        await onUnconfirmed();
        return;
      }
      setBusy(false);
      setError(friendlyAuthError(err.message));
      return;
    }
    await onSignedIn();
  }

  return (
    <form className="gv-auth-screen" onSubmit={submit} noValidate>
      <EmailChip email={email} onChange={onChangeEmail} />
      <Field label="Password" id="gv-auth-password">
        <PasswordInput
          id="gv-auth-password"
          value={password}
          onChange={(v) => { setPassword(v); if (error) setError(''); }}
          autoComplete="current-password"
          describedBy={error ? 'gv-auth-password-error' : undefined}
        />
      </Field>
      {error && <ErrorLine id="gv-auth-password-error">{error}</ErrorLine>}
      <div style={{ marginTop: 16 }}>
        <ContinueButton busy={busy} busyText="Logging in…">Log in</ContinueButton>
      </div>
      <div className="gv-auth-row">
        <button type="button" onClick={onForgot} className={`gv-auth-link ${FOCUS}`}>Forgot password?</button>
        {onNew && (
          <button type="button" onClick={onNew} className={`gv-auth-link gv-auth-link-quiet ${FOCUS}`}>New here? Create an account</button>
        )}
      </div>
    </form>
  );
}

function EmailChip({ email, onChange }: { email: string; onChange: () => void }) {
  return (
    <div className="gv-auth-chip">
      <Mail size={15} strokeWidth={2.3} aria-hidden style={{ color: FOREST, flexShrink: 0 }} />
      <span className="gv-auth-chip-text">{email}</span>
      <button type="button" onClick={onChange} className={`gv-auth-link ${FOCUS}`} style={{ marginInlineStart: 'auto' }}>
        Change
      </button>
    </div>
  );
}

// ── Step: an account that signs in with Google ──────────────────────────────

function GoogleAccountStep({
  email, busy, error, onGoogle, onSetPassword,
}: { email: string; busy: boolean; error: string; onGoogle: () => void; onSetPassword: () => void }) {
  return (
    <div className="gv-auth-screen">
      <h3 className="gv-auth-h3">Welcome back</h3>
      <p className="gv-auth-lead">
        <strong>{email}</strong> signs in with Google.
      </p>
      {error && <ErrorLine>{error}</ErrorLine>}
      <GoogleButtonRow onClick={onGoogle} busy={busy} />
      <p className="gv-auth-small" style={{ marginTop: 14 }}>
        Rather use a password?{' '}
        <button type="button" onClick={onSetPassword} className={`gv-auth-link ${FOCUS}`}>Email me a link to set one</button>
      </p>
    </div>
  );
}

// ── Step: a new account ─────────────────────────────────────────────────────

function SignupStep({
  email, next, onDone, onAwaitingCode, onExisting,
}: {
  email: string; next: string; onDone: () => Promise<void>; onAwaitingCode: () => void; onExisting: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('');
  const [nationality, setNationality] = useState('');
  const guessed = useNationalityPrefill(nationality, setNationality);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!firstName.trim()) { setError('Enter your first name.'); return; }
    if (!lastName.trim()) { setError('Enter your last name.'); return; }
    const basics = validateBasics(nationality, dob);
    if (!basics.ok) { setError(basics.error); return; }
    if (password.length < 8) { setError('Your password needs at least 8 characters.'); return; }
    setBusy(true);
    const { data, error: err } = await supabaseAuthClient.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          date_of_birth: basics.value.dateOfBirth,
          nationality: basics.value.nationality,
        },
        emailRedirectTo: callbackUrl(next),
      },
    });
    if (err) {
      setBusy(false);
      const m = err.message.toLowerCase();
      if (m.includes('already registered') || m.includes('already been registered')) { onExisting(); return; }
      setError(friendlyAuthError(err.message));
      return;
    }
    // Email confirmation off: a live session, straight in. On (the normal
    // case): the 6-digit code step, the email link works too.
    if (data.session) { await onDone(); return; }
    // An address that already has an account comes back as a user with no
    // identities (Supabase's enumeration guard). Send them to the password.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setBusy(false);
      onExisting();
      return;
    }
    setBusy(false);
    onAwaitingCode();
  }

  return (
    <form className="gv-auth-screen" onSubmit={submit} noValidate>
      <div className="gv-auth-group">
        <Field label="First name" id="gv-auth-first">
          <TextInput id="gv-auth-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" data-autofocus />
        </Field>
        <Field label="Last name" id="gv-auth-last">
          <TextInput id="gv-auth-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
        </Field>
      </div>
      <p className="gv-auth-small" style={{ marginTop: -4 }}>As it should read on a certificate or an award.</p>

      <Field
        label="Date of birth"
        id="gv-auth-dob"
        note={<p className="gv-auth-small">You must be at least 13. Conferences only ever see your age.</p>}
      >
        <DatePicker id="gv-auth-dob" value={dob} onChange={setDob} max={TODAY_ISO()} initialView="2005-06-15" placeholder="Select your date of birth" />
      </Field>

      <Field
        label="Nationality"
        id="gv-auth-nat"
        note={guessed ? <GeoGuessNote countryName={guessed} /> : <p className="gv-auth-small">Conferences allocate seats by nationality.</p>}
      >
        <CountryField id="gv-auth-nat" value={nationality} onChange={setNationality} placeholder="Start typing a country..." inputStyle={COUNTRY_INPUT} />
      </Field>

      <Field label="Email" id="gv-auth-email-ro">
        <TextInput id="gv-auth-email-ro" value={email} readOnly aria-readonly className="gv-auth-input-ro" />
      </Field>

      <Field label="Password" id="gv-auth-new-password" note={<p className="gv-auth-small">At least 8 characters.</p>}>
        <PasswordInput id="gv-auth-new-password" value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>

      {error && <ErrorLine>{error}</ErrorLine>}
      <TermsLine action="Agree and continue" />
      <ContinueButton busy={busy} busyText="Creating your account…">Agree and continue</ContinueButton>
    </form>
  );
}

// ── Step: forgot password ───────────────────────────────────────────────────

function ForgotStep({ email, setEmail, onSent }: { email: string; setEmail: (v: string) => void; onSent: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isValidEmail(email)) { setError('Enter a valid email address, like name@example.com.'); return; }
    setBusy(true);
    const err = await sendResetEmail(email.trim());
    setBusy(false);
    if (err) { setError(friendlyAuthError(err)); return; }
    onSent();
  }
  return (
    <form className="gv-auth-screen" onSubmit={submit} noValidate>
      <p className="gv-auth-lead">We will email you a link to choose a new password.</p>
      <Field label="Email" id="gv-auth-forgot-email">
        <TextInput id="gv-auth-forgot-email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} />
      </Field>
      {error && <ErrorLine>{error}</ErrorLine>}
      <div style={{ marginTop: 16 }}>
        <ContinueButton busy={busy} busyText="Sending…">Send reset link</ContinueButton>
      </div>
    </form>
  );
}

// ── Step: finish signing up (after Google, or an old account) ───────────────

function FinishStep({
  onDone, onNoSession, onSignOut,
}: { onDone: () => void; onNoSession: () => void; onSignOut: () => Promise<void> }) {
  const [loaded, setLoaded] = useState<null | { id: string; email: string | null; name: string | null; needNat: boolean; needDob: boolean }>(null);
  const [nationality, setNationality] = useState('');
  const [dob, setDob] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const guessed = useNationalityPrefill(nationality, setNationality, !!loaded?.needNat);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabaseAuthClient.auth.getUser();
      if (cancelled) return;
      if (!user) { onNoSession(); return; }
      let row: { nationality: string | null; date_of_birth: string | null; display_name: string | null } | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await supabaseAuthClient.from('profiles').select('nationality, date_of_birth, display_name').eq('id', user.id).maybeSingle();
        if (cancelled) return;
        if (!res.error && res.data) { row = res.data; break; }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
      if (cancelled) return;
      // Unreadable: fail open, CompleteBasicsGate asks on the next page.
      if (!row) { onDone(); return; }
      const needNat = !row.nationality || !row.nationality.trim();
      const needDob = !row.date_of_birth;
      if (!needNat && !needDob) { onDone(); return; }
      const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
      setLoaded({ id: user.id, email: user.email ?? null, name: row.display_name || meta?.full_name || meta?.name || null, needNat, needDob });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!loaded || saving || signingOut) return;
    setError('');
    // validateBasics checks the pair; each half is checked alone here with a
    // harmless stand-in for the other, and only what was missing is written.
    const natCheck = loaded.needNat ? validateBasics(nationality, '2000-01-01') : null;
    if (natCheck && !natCheck.ok) { setError(natCheck.error); return; }
    const dobCheck = loaded.needDob ? validateBasics('France', dob) : null;
    if (dobCheck && !dobCheck.ok) { setError(dobCheck.error); return; }
    const patch: { nationality?: string; date_of_birth?: string } = {};
    if (natCheck && natCheck.ok) patch.nationality = natCheck.value.nationality;
    if (dobCheck && dobCheck.ok) patch.date_of_birth = dobCheck.value.dateOfBirth;
    setSaving(true);
    // `.select('id')`: an update matching no row (an RLS refusal) resolves
    // with error null, and the step would close with the fields still blank.
    const { data, error: err } = await supabaseAuthClient.from('profiles').update(patch).eq('id', loaded.id).select('id');
    setSaving(false);
    if (err || !data || data.length === 0) {
      setError('We could not save that. Please try again. If it keeps failing, sign out and sign back in.');
      return;
    }
    clearPendingBasics();
    onDone();
  }

  if (!loaded) {
    return (
      <div className="gv-auth-screen" aria-busy="true">
        <p className="gv-auth-lead" role="status">Getting your account ready…</p>
      </div>
    );
  }

  return (
    <form className="gv-auth-screen" onSubmit={save} noValidate>
      <p className="gv-auth-lead">
        {loaded.name ? <>Welcome, <strong>{loaded.name.split(' ')[0]}</strong>. </> : null}
        Conferences allocate seats by nationality, and some set an age range, so we need {loaded.needNat && loaded.needDob ? 'both' : 'this'} before you carry on.
      </p>

      {loaded.needNat && (
        <Field
          label="Nationality"
          id="gv-auth-finish-nat"
          note={guessed ? <GeoGuessNote countryName={guessed} /> : <p className="gv-auth-small">Your nationality, not where you study.</p>}
        >
          <CountryField id="gv-auth-finish-nat" value={nationality} onChange={(v) => { setNationality(v); setError(''); }} placeholder="Start typing a country..." inputStyle={COUNTRY_INPUT} />
        </Field>
      )}
      {loaded.needDob && (
        <Field
          label="Date of birth"
          id="gv-auth-finish-dob"
          note={<p className="gv-auth-small">You must be at least 13. Conferences only ever see your age.</p>}
        >
          <DatePicker id="gv-auth-finish-dob" value={dob} onChange={(v) => { setDob(v); setError(''); }} max={TODAY_ISO()} initialView="2005-06-15" placeholder="Select your date of birth" />
        </Field>
      )}

      {error && <ErrorLine>{error}</ErrorLine>}
      <TermsLine action="Agree and continue" />
      <ContinueButton busy={saving} busyText="Saving…">Agree and continue</ContinueButton>

      <div className="gv-auth-row" style={{ marginTop: 14 }}>
        <span className="gv-auth-small" style={{ margin: 0, overflowWrap: 'anywhere' }}>
          {loaded.email ? <>Signed in as <strong style={{ color: INK }}>{loaded.email}</strong></> : null}
        </span>
        <button
          type="button"
          onClick={async () => { if (signingOut) return; setSigningOut(true); await onSignOut(); }}
          className={`gv-auth-link gv-auth-link-quiet ${FOCUS}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <LogOut size={14} strokeWidth={2.4} aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </form>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const COUNTRY_INPUT: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: `1px solid ${FIELD_BORDER}`,
  borderRadius: 12,
  color: INK,
  fontFamily: OUTFIT,
  fontSize: 16,
  paddingTop: 13,
  paddingBottom: 13,
};

const MODAL_CSS = `
.gv-auth-backdrop{position:fixed;inset:0;z-index:9100;display:flex;align-items:center;justify-content:center;padding:24px 16px;background:rgba(28,20,16,0.46);animation:gvAuthFade 200ms ease;font-family:${OUTFIT}}
.gv-auth-panel{position:relative;width:100%;max-width:568px;max-height:calc(100dvh - 48px);display:flex;flex-direction:column;background:${PANEL};border-radius:20px;box-shadow:0 24px 70px rgba(27,56,40,0.28),0 2px 8px rgba(27,56,40,0.12);overflow:hidden;animation:gvAuthRise 280ms cubic-bezier(0.2,0.8,0.2,1);color:${INK}}
.gv-auth-head{display:grid;grid-template-columns:48px 1fr 48px;align-items:center;min-height:64px;padding:0 12px;border-bottom:1px solid ${HAIR};flex-shrink:0}
.gv-auth-head-slot{display:flex;align-items:center;justify-content:center}
.gv-auth-title{margin:0;text-align:center;font-size:16px;font-weight:800;color:${INK};letter-spacing:-0.005em}
.gv-auth-icon{width:36px;height:36px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;color:${INK};background:transparent;border:none;cursor:pointer;transition:background-color 160ms ease}
.gv-auth-icon:hover{background:rgba(27,56,40,0.07)}
.gv-auth-body{overflow-y:auto;padding:24px 24px 28px;overscroll-behavior:contain}
.gv-auth-screen{display:flex;flex-direction:column;gap:12px}
.gv-auth-welcome{display:flex;align-items:center;gap:12px;margin-bottom:10px}
.gv-auth-welcome h3{margin:0;font-size:22px;font-weight:800;letter-spacing:-0.015em;color:${INK}}
.gv-auth-mark{width:44px;height:44px;object-fit:contain;flex-shrink:0}
.gv-auth-h3{margin:0;font-size:20px;font-weight:800;letter-spacing:-0.01em}
.gv-auth-lead{margin:0 0 4px;font-size:15px;line-height:1.5;color:${INK_SOFT};text-wrap:pretty}
.gv-auth-lead strong{color:${INK}}
.gv-auth-notice{margin:0 0 4px;padding:10px 14px;border-radius:12px;background:rgba(27,56,40,0.07);color:${FOREST};font-size:14px;line-height:1.45}
.gv-auth-field{display:flex;flex-direction:column;gap:6px}
.gv-auth-label{font-size:13.5px;font-weight:700;color:${INK}}
.gv-auth-input{width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1px solid ${FIELD_BORDER};background:#FFFFFF;color:${INK};font-family:${OUTFIT};font-size:16px;line-height:1.3;outline:none;transition:border-color 160ms ease,box-shadow 160ms ease}
.gv-auth-input:focus{border-color:${FOREST};box-shadow:0 0 0 3px rgba(27,56,40,0.14)}
.gv-auth-input[aria-invalid="true"]{border-color:${DANGER}}
.gv-auth-input-ro{background:#F6F1E5;color:${INK_SOFT}}
.gv-auth-eye{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:32px;height:32px;display:inline-flex;align-items:center;justify-content:center;border:none;background:none;color:${INK_SOFT};border-radius:8px;cursor:pointer}
.gv-auth-group{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.gv-auth-small{margin:2px 0 0;font-size:12.5px;line-height:1.45;color:${INK_SOFT}}
.gv-auth-error{margin:2px 0 0;font-size:13.5px;line-height:1.45;color:${DANGER}}
.gv-auth-cta{position:relative;overflow:hidden;width:100%;min-height:50px;padding:14px 20px;border:none;border-radius:12px;cursor:pointer;color:${GOLD};font-family:${OUTFIT};font-size:16px;font-weight:800;letter-spacing:0.01em;background:linear-gradient(90deg,#132A1D 0%,#1B3828 38%,#2A5A3C 74%,#4E6A2E 100%);box-shadow:0 8px 20px rgba(27,56,40,0.22);transition:transform 140ms ease,box-shadow 200ms ease,opacity 160ms ease}
.gv-auth-cta:hover{box-shadow:0 10px 26px rgba(27,56,40,0.3)}
.gv-auth-cta:active{transform:scale(0.985)}
.gv-auth-cta:disabled{cursor:default;opacity:0.72}
.gv-auth-cta-shine{position:absolute;inset:0;background:radial-gradient(circle at var(--spot-x,50%) var(--spot-y,50%),rgba(238,217,138,0.32) 0%,rgba(238,217,138,0) 55%);transition:opacity 200ms ease;pointer-events:none}
.gv-auth-social{position:relative;width:100%;min-height:50px;display:flex;align-items:center;justify-content:center;padding:12px 20px;border-radius:12px;border:1px solid ${INK};background:#FFFFFF;color:${INK};font-family:${OUTFIT};font-size:15px;font-weight:700;cursor:pointer;transition:background-color 160ms ease,transform 140ms ease}
.gv-auth-social:hover{background:#F7F3EA}
.gv-auth-social:active{transform:scale(0.985)}
.gv-auth-social:disabled{opacity:0.65;cursor:default}
.gv-auth-social-icon{position:absolute;left:18px;top:50%;transform:translateY(-50%);display:inline-flex}
.gv-auth-or{display:flex;align-items:center;gap:14px;margin:20px 0}
.gv-auth-or span{flex:1;height:1px;background:${HAIR}}
.gv-auth-or em{font-style:normal;font-size:12.5px;color:${INK_SOFT}}
.gv-auth-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 12px;margin-top:6px}
.gv-auth-link{background:none;border:none;padding:4px 2px;border-radius:6px;color:${FOREST};font-family:${OUTFIT};font-size:14px;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.gv-auth-link-quiet{color:${INK_SOFT};font-weight:600}
.gv-auth-chip{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#F6F1E5;margin-bottom:4px}
.gv-auth-chip-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14.5px;font-weight:600}
.gv-auth-terms{margin:4px 0 2px;font-size:12.5px;line-height:1.5;color:${INK_SOFT}}
.gv-auth-terms a{color:${INK};font-weight:700;text-decoration:underline;text-underline-offset:2px}
@keyframes gvAuthFade{from{opacity:0}to{opacity:1}}
@keyframes gvAuthRise{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
@media (max-width:639px){
  .gv-auth-backdrop{padding:0;align-items:flex-end}
  .gv-auth-panel{max-width:none;height:100dvh;max-height:100dvh;border-radius:0;animation:gvAuthSheet 320ms cubic-bezier(0.2,0.8,0.2,1)}
  .gv-auth-body{padding:20px 16px calc(24px + env(safe-area-inset-bottom))}
  .gv-auth-group{grid-template-columns:1fr}
}
@keyframes gvAuthSheet{from{transform:translateY(100%)}to{transform:none}}
@media (prefers-reduced-motion:reduce){.gv-auth-backdrop,.gv-auth-panel{animation:none}}
`;
