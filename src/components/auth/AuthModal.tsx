'use client';

// ── "Log in or sign up": the whole auth flow in one pop-up ───────────────────
//
// Owner, 18 Sep 2026: make it a pop-up so the user never leaves the page, and
// "literally do EXACTLY as Airbnb, except don't have Apple and make it green".
// First screen: X top right, the gavel mark, "Log in or sign up", ONE email
// field, a green Continue, "or", and a square Google tile. Continue asks the
// database which way to go (`auth_email_status`) and the same dialog moves on:
//
//   email ─┬─ 'password' ── password ── (forgot → forgotSent)
//          ├─ 'google'   ── "signs in with Google" ── Google
//          └─ 'new'      ── signup ("Finish signing up") ── code
//   Google (any time) ── /auth/callback?via=modal ── back on the same page;
//          a missing nationality / date of birth, or a brand-new account,
//          comes back with `?auth=finish` → the finish step
//   new accounts, after the basics ── the questionnaire (4 steps, skippable)
//
// `afterSignedIn` is the one exit: missing basics → finish (no X, no Escape,
// no backdrop; Sign out is the only other way out, the CompleteBasicsGate
// rule); a new account with no education level → the questionnaire; else the
// dialog closes and the visitor stays on the page (or goes to `next`).
//
// Account existence: `auth_email_status` (SECURITY DEFINER) answers only
// 'new' | 'password' | 'google' | 'invalid'. Anyone can learn whether an
// address has an account and whether it uses Google. That is Airbnb's
// trade-off and the owner approved it (18 Sep 2026). Forgot-password still
// answers neutrally.

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
import { CODE_LENGTH, GoogleIcon, isValidEmail, useCooldown } from '@/app/auth/authUi';
import {
  AuthSideImage, BORDER, ErrorLine, FOCUS, FloatInput, FloatPassword, GreenButton, Hint, INK, INK_SOFT,
  KIT_CSS, OUTFIT, TermsLine, TextButton,
} from './authModalKit';
import AuthQuestionnaire from './AuthQuestionnaire';

type Step =
  | 'email'
  | 'password'
  | 'google'
  | 'signup'
  | 'confirm'
  | 'forgot'
  | 'forgotSent'
  | 'finish'
  | 'questions';

type EmailStatus = 'new' | 'password' | 'google' | 'invalid';

/** An account younger than this, still without an education level, gets the
 *  questionnaire. Older accounts that skipped it are not asked again. */
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000;

const todayIso = () => new Date().toISOString().slice(0, 10);

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
  if (m.includes('invalid login credentials')) return 'That password is not right. Try again, or reset it.';
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('only request this after')) {
    return 'That is a few too many tries in a row. Wait a minute and try again.';
  }
  if (m.includes('already registered') || m.includes('already been registered')) return 'This email already has an account. Log in instead.';
  if (m.includes('already confirmed')) return 'This email is already confirmed. Go back and log in.';
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

/** Opens the modal from `?auth=` (the /auth/signin redirect, an OAuth return
 *  with `auth=finish`, a guard's redirect) and strips those keys from the bar.
 *  Keyed on the search params, so a client navigation to such a URL opens it. */
function AuthQueryOpener() {
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
      : { step, next: p.get('next') ?? undefined, email: p.get('email') ?? undefined, apply: p.get('apply') === '1', notice };
    // `auth=finish` is appended to the page's own URL by /auth/callback, so
    // only that key goes. The others were put there for the modal alone.
    const keys = step === 'finish' ? ['auth'] : ['auth', 'next', 'email', 'apply', 'verified', 'error'];
    keys.forEach((k) => p.delete(k));
    const clean = url.pathname + (p.toString() ? `?${p.toString()}` : '') + url.hash;
    window.history.replaceState(window.history.state, '', clean);
    openAuth(req);
  }, [auth]);
  return null;
}

// ── The dialog ──────────────────────────────────────────────────────────────

type ProfileCheck = { basicsMissing: boolean; wantsQuestions: boolean } | null;

/** Reads what the exit needs to know. Null = could not read (fail open). */
async function checkProfile(fresh: boolean): Promise<ProfileCheck> {
  const { data: { user } } = await supabaseAuthClient.auth.getUser();
  if (!user) return null;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await supabaseAuthClient
      .from('profiles')
      .select('nationality, date_of_birth, education_level')
      .eq('id', user.id)
      .maybeSingle();
    if (!res.error && res.data) {
      const row = res.data as { nationality: string | null; date_of_birth: string | null; education_level: string | null };
      const isNew = fresh || (Date.now() - Date.parse(user.created_at ?? '') < NEW_ACCOUNT_MS);
      return {
        basicsMissing: !row.nationality?.trim() || !row.date_of_birth,
        wantsQuestions: isNew && row.education_level == null,
      };
    }
    if (attempt < 3) await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
  }
  return null;
}

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
  // Questionnaire position and whether the account was just made here.
  const [q, setQ] = useState(0);
  const [fresh, setFresh] = useState(false);
  const saveQuestionsRef = useRef<() => Promise<void>>(async () => {});
  const [nestedOpen, setNestedOpen] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const next = useMemo(() => targetOf(request), [request]);

  const locked = step === 'finish';
  const inQuestions = step === 'questions';

  /** Close and land. Staying on this page = refresh its server data. */
  const land = useCallback(() => {
    setBasicsGateStatus('ok');
    closeAuth();
    const here = window.location.pathname + window.location.search + window.location.hash;
    if (request.next && request.next !== here) router.push(request.next);
    else router.refresh();
  }, [request.next, router]);

  const skipQuestions = useCallback(async () => {
    try { await saveQuestionsRef.current(); } catch { /* optional */ }
    land();
  }, [land]);

  const close = useCallback(() => {
    if (locked) return;
    if (inQuestions) { void skipQuestions(); return; }
    closeAuth();
  }, [locked, inQuestions, skipQuestions]);

  useScrollLock(true);
  // Registered even when locked (with a no-op), so Escape neither closes the
  // finish step nor anything hidden behind it. Stands down while the
  // conference form is open over the questionnaire, so its own Escape wins.
  useModalEscape(locked || nestedOpen ? () => {} : close, !nestedOpen);

  // ── The phone keyboard ────────────────────────────────────────────────────
  // A fixed, full-height sheet keeps the LAYOUT viewport's height when iOS
  // opens the keyboard, so its foot (and the Continue button on it) ends up
  // behind the keys. `--gv-vvh` / `--gv-vvt` carry the VISUAL viewport, which
  // the sheet's height and top read at ≤743px; on a desktop browser (or any
  // browser without visualViewport) nothing is set and the CSS falls back to
  // 100dvh / 0. Read-only: no state, one rAF per event.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const apply = () => {
      frame = 0;
      root.style.setProperty('--gv-vvh', `${Math.round(vv.height)}px`);
      root.style.setProperty('--gv-vvt', `${Math.round(vv.offsetTop)}px`);
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(apply); };
    apply();
    vv.addEventListener('resize', schedule);
    vv.addEventListener('scroll', schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      vv.removeEventListener('resize', schedule);
      vv.removeEventListener('scroll', schedule);
      root.style.removeProperty('--gv-vvh');
      root.style.removeProperty('--gv-vvt');
    };
  }, []);

  // Keep the field the visitor just tapped in view inside the sheet: the
  // keyboard animates in after the focus, so this waits for it. The body is
  // pinned by useScrollLock, so only the sheet's own scroller moves.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      window.setTimeout(() => {
        if (!el.isConnected) return;
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 260);
    };
    panel.addEventListener('focusin', onFocusIn);
    return () => panel.removeEventListener('focusin', onFocusIn);
  }, []);

  // Focus: first field on every step, back to the opener on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    return () => { try { opener?.focus?.(); } catch { /* gone */ } };
  }, []);
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const t = window.setTimeout(() => {
      const first = panel.querySelector<HTMLElement>('[data-autofocus], .gv-auth-body input:not([type=hidden]):not([disabled]):not([readonly]), .gv-auth-body button');
      first?.focus({ preventScroll: true });
    }, 40);
    return () => window.clearTimeout(t);
  }, [step, q]);

  // Focus trap: Tab cycles inside the panel (events from a portaled child
  // dialog bubble here through React and are left alone).
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const panel = panelRef.current;
    if (!panel || !panel.contains(e.target as Node)) return;
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
    if (inQuestions && q > 0) { setQ(q - 1); return; }
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory(history.slice(0, -1));
    setStep(prev);
  };

  /** Every signed-in exit. */
  const afterSignedIn = useCallback(async (justCreated = false) => {
    if (justCreated) setFresh(true);
    const check = await checkProfile(justCreated || fresh);
    setBusy(false);
    if (!check) { land(); return; }
    setHistory([]);
    setError('');
    if (check.basicsMissing) { setStep('finish'); return; }
    if (check.wantsQuestions) { setQ(0); setStep('questions'); return; }
    land();
  }, [fresh, land]);

  async function startGoogle() {
    if (oauthBusy) return;
    setError('');
    // Answers another visitor left in a pending sign-up belong to them.
    clearPendingBasics();
    setOauthBusy(true);
    const { error: e } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callbackUrl(next) } });
    // On success the browser is already on its way to Google.
    if (e) { setOauthBusy(false); setError(friendlyAuthError(e.message)); }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError('');
    const clean = email.trim();
    if (!isValidEmail(clean)) { setError('Enter a valid email, like name@example.com.'); return; }
    setEmail(clean);
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc('auth_email_status', { p_email: clean });
    setBusy(false);
    const status = (rpcError ? null : data) as EmailStatus | null;
    setStatusUnknown(!status);
    // If the check itself fails, the password step is the safe guess: it
    // links to sign-up for anyone who turns out to be new.
    if (status === 'new') go('signup');
    else if (status === 'google') go('google');
    else if (status === 'invalid') setError('Enter a valid email, like name@example.com.');
    else go('password');
  }

  function resendSignupCode(): Promise<string | null> {
    return supabase.auth
      .resend({ type: 'signup', email, options: { emailRedirectTo: callbackUrl(next) } })
      .then(({ error: e }) => (e ? friendlyAuthError(e.message) : null))
      .catch((e) => (e instanceof Error ? friendlyAuthError(e.message) : 'Could not resend right now. Please try again.'));
  }

  const headTitle =
    step === 'email' ? null
    : step === 'password' || step === 'google' ? 'Log in'
    : step === 'signup' || step === 'finish' ? 'Finish signing up'
    : step === 'confirm' ? 'Confirm your email'
    : step === 'forgot' || step === 'forgotSent' ? 'Reset your password'
    : null; // the questionnaire titles itself, large, in the body

  const showBack = !locked && (inQuestions ? q > 0 : history.length > 0);

  // Phone sheet (the CSS at ≤743px reads both): the hero band only on the
  // short steps, and the sticky primary button on the long ones, where the
  // form scrolls and the action must stay reachable above the safe area.
  const longStep = step === 'signup' || step === 'finish' || inQuestions;

  const node = (
    <div
      className="gv-auth-backdrop"
      onMouseDown={(e) => {
        // Only a press on the backdrop itself. Clicks inside portaled
        // popovers (country list, calendar) bubble here through React.
        if (e.target === e.currentTarget && !locked && !inQuestions) closeAuth();
      }}
    >
      <style>{KIT_CSS}</style>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gv-auth-title"
        className={`gv-auth-panel gv-split${inQuestions ? ' gv-wide' : ''}`}
        data-step={step}
        data-hero={longStep ? '0' : '1'}
        data-cta={longStep ? 'sticky' : undefined}
        onKeyDown={onKeyDown}
      >
        {/* Owner, 19 Sep 2026: the "Wall" layout. The designed image on the
            left on every step, the steps on the right; one column below 860px. */}
        <AuthSideImage />
        <div className="gv-auth-main">
        <div className="gv-auth-head">
          <div className="gv-auth-head-l">
            {showBack && (
              <button type="button" onClick={back} aria-label="Back" className={`gv-auth-icon ${FOCUS}`}>
                <ArrowLeft size={18} strokeWidth={2.2} aria-hidden />
              </button>
            )}
          </div>
          {headTitle ? <h2 id="gv-auth-title" className="gv-auth-head-title">{headTitle}</h2> : <span />}
          <div className="gv-auth-head-r">
            {inQuestions ? (
              <button type="button" onClick={() => void skipQuestions()} className={`gv-auth-skip ${FOCUS}`}>Skip for now</button>
            ) : !locked ? (
              <button type="button" onClick={close} aria-label="Close" className={`gv-auth-icon ${FOCUS}`}>
                <X size={18} strokeWidth={2.2} aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        <div className="gv-auth-body">
          {step === 'email' && (
            <form className="gv-auth-screen" onSubmit={submitEmail} noValidate>
              <div className="gv-auth-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/gavelling-mark.png" alt="" className="gv-auth-mark" />
                <span className="gv-auth-word">Gavelling</span>
              </div>
              <h2 id="gv-auth-title" className="gv-auth-big">Log in or sign up</h2>
              <p className="gv-auth-intro">One account for applying, chairing and organising. Free to start.</p>
              {request.apply && <p className="gv-notice" role="status">Log in or sign up to carry on with your application. We will bring you straight back to it.</p>}
              {request.notice && <p className="gv-notice" role="status">{request.notice}</p>}
              <FloatInput
                id="gv-auth-email"
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
                invalid={!!error}
                aria-describedby={error ? 'gv-auth-email-error' : undefined}
                data-autofocus
              />
              {error && <ErrorLine id="gv-auth-email-error">{error}</ErrorLine>}
              <div style={{ marginTop: 8 }}>
                <GreenButton busy={busy} busyText="Checking…">Continue</GreenButton>
              </div>
              <div className="gv-or" aria-hidden><span /><em>or</em><span /></div>
              <div className="gv-socials">
                <button type="button" onClick={startGoogle} disabled={oauthBusy} aria-label="Continue with Google" title="Continue with Google" className={`gv-social ${FOCUS}`}>
                  <GoogleIcon />
                  {/* The word shows on the phone sheet only, where this is a
                      full-width outlined button and a bare tile reads as a
                      mystery. Same accessible name either way. */}
                  <span className="gv-social-label">Continue with Google</span>
                </button>
              </div>
              <p className="gv-auth-terms">
                By continuing you agree to the{' '}
                <Link href="/terms" target="_blank" rel="noopener" className={`gv-inline ${FOCUS}`}>Terms</Link> and{' '}
                <Link href="/privacy" target="_blank" rel="noopener" className={`gv-inline ${FOCUS}`}>Privacy Policy</Link>.
              </p>
            </form>
          )}

          {step === 'password' && (
            <PasswordStep
              email={email}
              onChangeEmail={back}
              onForgot={() => go('forgot')}
              onNew={statusUnknown ? () => go('signup') : undefined}
              onSignedIn={() => afterSignedIn(false)}
              onUnconfirmed={async () => {
                const err = await resendSignupCode();
                setConfirmMode('unconfirmed');
                go('confirm');
                if (err) setError(err);
              }}
            />
          )}

          {step === 'google' && (
            <div className="gv-auth-screen">
              <p className="gv-auth-lead"><strong>{email}</strong> signs in with Google.</p>
              {error && <ErrorLine>{error}</ErrorLine>}
              <button type="button" onClick={startGoogle} disabled={oauthBusy} className={`gv-social ${FOCUS}`} style={{ width: '100%', gap: 12, fontFamily: OUTFIT, fontSize: 16, fontWeight: 600, color: INK }} data-autofocus>
                <GoogleIcon />
                {oauthBusy ? 'Opening Google…' : 'Continue with Google'}
              </button>
              <Hint>Rather use a password? <TextButton onClick={() => go('forgot')}>Email me a link to set one</TextButton></Hint>
            </div>
          )}

          {step === 'signup' && (
            <SignupStep
              email={email}
              next={next}
              onDone={() => afterSignedIn(true)}
              onAwaitingCode={() => { setConfirmMode('signup'); go('confirm'); }}
              onExisting={() => go('password')}
            />
          )}

          {step === 'confirm' && (
            <CodeStep
              email={email}
              intro={confirmMode === 'unconfirmed' ? 'Your email is not confirmed yet. Enter the code we sent to' : 'Enter the code we sent to'}
              initialError={error}
              onVerify={async (token) => {
                const { error: e } = await supabase.auth.verifyOtp({ email, token, type: 'signup' });
                if (e) return 'That code is not right, or it has expired. Request a new one below.';
                await afterSignedIn(confirmMode === 'signup');
                return null;
              }}
              onResend={resendSignupCode}
            />
          )}

          {step === 'forgot' && <ForgotStep email={email} setEmail={setEmail} onSent={() => go('forgotSent')} />}

          {step === 'forgotSent' && (
            <CheckEmailStep
              email={email}
              onResend={async () => { await sendResetEmail(email); return null; }}
              onBackToLogin={() => { setHistory([]); setStep('email'); }}
            />
          )}

          {step === 'finish' && (
            <FinishStep
              onDone={async (wantsQuestions) => {
                if (wantsQuestions) { setQ(0); setStep('questions'); return; }
                land();
              }}
              fresh={fresh}
              onNoSession={() => closeAuth()}
              onSignOut={async () => {
                await signOut();
                closeAuth();
                window.location.href = '/';
              }}
            />
          )}

          {step === 'questions' && (
            <AuthQuestionnaire
              q={q}
              setQ={setQ}
              onDone={land}
              registerSave={(fn) => { saveQuestionsRef.current = fn; }}
              onNestedOpen={setNestedOpen}
            />
          )}
        </div>
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

// ── Steps ───────────────────────────────────────────────────────────────────

function EmailChip({ email, onChange }: { email: string; onChange: () => void }) {
  return (
    <div className="gv-chip">
      <Mail size={16} strokeWidth={2} aria-hidden style={{ color: INK_SOFT, flexShrink: 0 }} />
      <span className="gv-chip-text">{email}</span>
      <span style={{ marginLeft: 'auto' }}><TextButton onClick={onChange}>Change</TextButton></span>
    </div>
  );
}

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
      <FloatPassword
        id="gv-auth-password"
        value={password}
        onChange={(v) => { setPassword(v); if (error) setError(''); }}
        autoComplete="current-password"
        invalid={!!error}
        describedBy={error ? 'gv-auth-password-error' : undefined}
      />
      {error && <ErrorLine id="gv-auth-password-error">{error}</ErrorLine>}
      <div style={{ marginTop: 8 }}>
        <GreenButton busy={busy} busyText="Logging in…">Log in</GreenButton>
      </div>
      <div className="gv-row" style={{ marginTop: 4 }}>
        <TextButton onClick={onForgot}>Forgot password?</TextButton>
        {onNew && <TextButton onClick={onNew} quiet>New here? Create an account</TextButton>}
      </div>
    </form>
  );
}

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
    // Email confirmation off: a live session, straight on. On (the normal
    // case): the 6-digit code step; the email link works too.
    if (data.session) { await onDone(); return; }
    // An address that already has an account comes back as a user with no
    // identities (Supabase's enumeration guard): send them to the password.
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
      <FloatInput id="gv-auth-first" label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" data-autofocus />
      <FloatInput id="gv-auth-last" label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
      <Hint>Make sure it matches how it should read on a certificate or an award.</Hint>

      <div className="gv-static gv-dp" style={{ marginTop: 8 }}>
        <label className="gv-static-label" htmlFor="gv-auth-dob">Date of birth</label>
        <DatePicker id="gv-auth-dob" value={dob} onChange={setDob} max={todayIso()} initialView="2005-06-15" placeholder="Select your date of birth" />
      </div>
      <Hint>You must be at least 13. Conferences only ever see your age.</Hint>

      <div className="gv-static" style={{ marginTop: 8 }}>
        <label className="gv-static-label" htmlFor="gv-auth-nat">Nationality</label>
        <CountryField id="gv-auth-nat" value={nationality} onChange={setNationality} placeholder="Start typing a country" inputStyle={COUNTRY_INPUT} />
      </div>
      {guessed ? <GeoGuessNote countryName={guessed} /> : <Hint>Conferences allocate seats by nationality.</Hint>}

      <div style={{ marginTop: 8 }} className="gv-auth-screen">
        <FloatInput id="gv-auth-email-ro" label="Email" value={email} readOnly aria-readonly />
        <FloatPassword id="gv-auth-new-password" value={password} onChange={setPassword} autoComplete="new-password" />
        <Hint>At least 8 characters.</Hint>
      </div>

      {error && <ErrorLine>{error}</ErrorLine>}
      <TermsLine />
      <GreenButton busy={busy} busyText="Creating your account…">Agree and continue</GreenButton>
    </form>
  );
}

function CodeStep({
  email, intro, initialError, onVerify, onResend,
}: {
  email: string; intro: string; initialError?: string;
  onVerify: (code: string) => Promise<string | null>; onResend: () => Promise<string | null>;
}) {
  const { remaining, active, start } = useCooldown(60);
  const [code, setCode] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [sent, setSent] = useState(false);

  // A code was sent on the way in, so the first resend waits.
  useEffect(() => { start(); }, [start]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (verifying || code.length !== CODE_LENGTH) { if (code.length !== CODE_LENGTH) setError(`Enter all ${CODE_LENGTH} digits.`); return; }
    setError('');
    setVerifying(true);
    const err = await onVerify(code);
    setVerifying(false);
    if (err) setError(err);
  }

  async function resend() {
    if (active || resending) return;
    setError('');
    setSent(false);
    setResending(true);
    const err = await onResend();
    setResending(false);
    if (err) { setError(err); return; }
    start();
    setSent(true);
  }

  return (
    <form className="gv-auth-screen" onSubmit={submit} noValidate>
      <p className="gv-auth-lead">{intro} <strong>{email}</strong>.</p>
      <FloatInput
        id="gv-auth-code"
        label={`${CODE_LENGTH}-digit code`}
        value={code}
        onChange={(e) => { setCode(e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH)); if (error) setError(''); }}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        invalid={!!error}
        style={{ letterSpacing: '0.3em', fontVariantNumeric: 'tabular-nums' }}
        data-autofocus
      />
      {error && <ErrorLine>{error}</ErrorLine>}
      <div style={{ marginTop: 8 }}>
        <GreenButton busy={verifying} busyText="Checking…">Continue</GreenButton>
      </div>
      <p className="gv-hint" aria-live="polite">
        {sent ? 'Sent. Check your inbox and spam. ' : 'Did not get it? '}
        {active
          ? <>You can send another in {remaining}s.</>
          : <TextButton onClick={() => void resend()}>{resending ? 'Sending…' : 'Send a new code'}</TextButton>}
      </p>
      <Hint>The link in the email works too. It brings you back here, signed in.</Hint>
    </form>
  );
}

function ForgotStep({ email, setEmail, onSent }: { email: string; setEmail: (v: string) => void; onSent: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!isValidEmail(email)) { setError('Enter a valid email, like name@example.com.'); return; }
    setBusy(true);
    const err = await sendResetEmail(email.trim());
    setBusy(false);
    if (err) { setError(friendlyAuthError(err)); return; }
    onSent();
  }
  return (
    <form className="gv-auth-screen" onSubmit={submit} noValidate>
      <p className="gv-auth-lead">Enter your email and we will send you a link to choose a new password.</p>
      <FloatInput id="gv-auth-forgot-email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }} invalid={!!error} data-autofocus />
      {error && <ErrorLine>{error}</ErrorLine>}
      <div style={{ marginTop: 8 }}>
        <GreenButton busy={busy} busyText="Sending…">Send reset link</GreenButton>
      </div>
    </form>
  );
}

function CheckEmailStep({ email, onResend, onBackToLogin }: { email: string; onResend: () => Promise<string | null>; onBackToLogin: () => void }) {
  const { remaining, active, start } = useCooldown(60);
  const [sent, setSent] = useState(false);
  useEffect(() => { start(); }, [start]);
  return (
    <div className="gv-auth-screen">
      <p className="gv-auth-lead">
        If an account exists for <strong>{email}</strong>, we sent it a link to choose a new password. It expires after a short while.
      </p>
      <GreenButton type="button" onClick={onBackToLogin}>Back to log in</GreenButton>
      <p className="gv-hint" aria-live="polite">
        {sent ? 'Sent again. ' : 'Nothing yet? Check spam, or '}
        {active ? <>send another in {remaining}s.</> : <TextButton onClick={async () => { await onResend(); setSent(true); start(); }}>send it again</TextButton>}
      </p>
    </div>
  );
}

function FinishStep({
  onDone, onNoSession, onSignOut, fresh,
}: { onDone: (wantsQuestions: boolean) => void; onNoSession: () => void; onSignOut: () => Promise<void>; fresh: boolean }) {
  const [loaded, setLoaded] = useState<null | { id: string; email: string | null; name: string | null; needNat: boolean; needDob: boolean; wantsQuestions: boolean }>(null);
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
      type Row = { nationality: string | null; date_of_birth: string | null; display_name: string | null; education_level: string | null };
      let row: Row | null = null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await supabaseAuthClient.from('profiles').select('nationality, date_of_birth, display_name, education_level').eq('id', user.id).maybeSingle();
        if (cancelled) return;
        if (!res.error && res.data) { row = res.data as Row; break; }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
      if (cancelled) return;
      // Unreadable: fail open, CompleteBasicsGate asks on the next page.
      if (!row) { onDone(false); return; }
      const isNew = fresh || (Date.now() - Date.parse(user.created_at ?? '') < NEW_ACCOUNT_MS);
      const wantsQuestions = isNew && row.education_level == null;
      const needNat = !row.nationality || !row.nationality.trim();
      const needDob = !row.date_of_birth;
      if (!needNat && !needDob) { onDone(wantsQuestions); return; }
      const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
      setLoaded({ id: user.id, email: user.email ?? null, name: row.display_name || meta?.full_name || meta?.name || null, needNat, needDob, wantsQuestions });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!loaded || saving || signingOut) return;
    setError('');
    // validateBasics checks the pair; each half is checked alone with a
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
    onDone(loaded.wantsQuestions);
  }

  if (!loaded) {
    return <div className="gv-auth-screen" aria-busy="true"><p className="gv-auth-lead" role="status">Getting your account ready…</p></div>;
  }

  return (
    <form className="gv-auth-screen" onSubmit={save} noValidate>
      <p className="gv-auth-lead">
        {loaded.name ? <>Welcome, <strong>{loaded.name.split(' ')[0]}</strong>. </> : null}
        Conferences allocate seats by nationality, and some set an age range, so we need {loaded.needNat && loaded.needDob ? 'both of these' : 'this'} before you carry on.
      </p>
      {loaded.needDob && (
        <>
          <div className="gv-static gv-dp">
            <label className="gv-static-label" htmlFor="gv-auth-finish-dob">Date of birth</label>
            <DatePicker id="gv-auth-finish-dob" value={dob} onChange={(v) => { setDob(v); setError(''); }} max={todayIso()} initialView="2005-06-15" placeholder="Select your date of birth" />
          </div>
          <Hint>You must be at least 13. Conferences only ever see your age.</Hint>
        </>
      )}
      {loaded.needNat && (
        <>
          <div className="gv-static" style={{ marginTop: 8 }}>
            <label className="gv-static-label" htmlFor="gv-auth-finish-nat">Nationality</label>
            <CountryField id="gv-auth-finish-nat" value={nationality} onChange={(v) => { setNationality(v); setError(''); }} placeholder="Start typing a country" inputStyle={COUNTRY_INPUT} />
          </div>
          {guessed ? <GeoGuessNote countryName={guessed} /> : <Hint>Your nationality, not where you study.</Hint>}
        </>
      )}
      {error && <ErrorLine>{error}</ErrorLine>}
      <TermsLine />
      <GreenButton busy={saving} busyText="Saving…">Agree and continue</GreenButton>
      <div className="gv-row" style={{ marginTop: 6 }}>
        <span className="gv-hint" style={{ overflowWrap: 'anywhere' }}>
          {loaded.email ? <>Signed in as <strong style={{ color: INK }}>{loaded.email}</strong></> : null}
        </span>
        <button
          type="button"
          onClick={async () => { if (signingOut) return; setSigningOut(true); await onSignOut(); }}
          className={`gv-textbtn gv-textbtn-quiet ${FOCUS}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <LogOut size={14} strokeWidth={2.2} aria-hidden />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </form>
  );
}

const COUNTRY_INPUT: React.CSSProperties = {
  backgroundColor: '#FFFFFF',
  border: `1px solid ${BORDER}`,
  borderRadius: 12,
  color: INK,
  fontFamily: OUTFIT,
  fontSize: 16,
  height: 56,
  boxSizing: 'border-box',
};
