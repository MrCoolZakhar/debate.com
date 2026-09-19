import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { EmailOtpType, User } from '@supabase/supabase-js';
import { PENDING_BASICS_COOKIE, pendingBasicsFor } from '@/lib/pendingBasics';

// This route reads request cookies and must never be cached or prerendered.
export const dynamic = 'force-dynamic';

/** Only allow relative paths to prevent open-redirect via ?next=. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

/** `next` with `auth=finish` added, keeping its own query and hash. */
function withAuthFinish(next: string): string {
  const hashAt = next.indexOf('#');
  const path = hashAt === -1 ? next : next.slice(0, hashAt);
  const hash = hashAt === -1 ? '' : next.slice(hashAt);
  return `${path}${path.includes('?') ? '&' : '?'}auth=finish${hash}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const otpType = searchParams.get('type') as EmailOtpType | null;
  const next = safeNext(searchParams.get('next'));
  // Started from the "Log in or sign up" modal (src/components/auth/AuthModal.tsx).
  // Those users go back to the page they were on, never to /auth/onboarding: a
  // missing nationality or date of birth re-opens the modal there, on its
  // "Finish signing up" step (`?auth=finish`), which cannot be dismissed.
  const viaModal = searchParams.get('via') === 'modal';

  const cookieStore = await cookies();
  const supabase = createServerClient(
    'https://luruhkwrgisytejswlas.supabase.co',
    'sb_publishable_k7NdduzaXK358z8ew18ZKA_vBSieDlV',
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const userAgent = request.headers.get('user-agent');

  /**
   * Fire-and-forget instrumentation. Never let a logging failure break a
   * sign-in: every call is wrapped and the result discarded. Only
   * error.message is ever passed as error text, never a raw URL, because a
   * callback URL carries a live token.
   */
  async function logFailure(
    stage: string,
    opts: { errorText?: string | null; shownReason?: string | null; hadSession?: boolean } = {},
  ): Promise<void> {
    try {
      await supabase.rpc('log_auth_flow_failure', {
        p_stage: stage,
        p_error_text: opts.errorText ?? null,
        p_shown_reason: opts.shownReason ?? null,
        p_had_session: opts.hadSession ?? false,
        p_next_path: next,
        p_user_agent: userAgent,
      });
    } catch {
      // Instrumentation must never break auth.
    }
  }

  // Supabase can redirect straight to the callback with an error (e.g. an
  // expired or already-consumed link) instead of a usable code. Forward the
  // reason to the explanation screen rather than silently bouncing.
  const providerError = searchParams.get('error');
  const providerErrorCode = searchParams.get('error_code');
  if (providerError) {
    const reason = providerErrorCode === 'otp_expired' || providerError === 'access_denied'
      ? 'expired'
      : 'invalid';
    await logFailure('provider', {
      errorText: providerErrorCode ? `${providerError}:${providerErrorCode}` : providerError,
      shownReason: reason,
    });
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${reason}&next=${encodeURIComponent(next)}`,
    );
  }

  /**
   * Where a now-authenticated user should land.
   *
   * Onboarding gate: OAuth/Google sign-ups never pass through the signup
   * wizard, so a brand-new user would otherwise land straight in the app
   * without recording their education level / MUN CV. The onboarding wizard
   * writes profiles.education_level, so a user whose profile has a null
   * education_level (or no profile row yet) hasn't onboarded — send them to
   * /auth/onboarding, preserving the intended destination so onboarding can
   * forward them on afterwards. Users who already onboarded skip this and go
   * straight to next, so nobody loops.
   */
  async function destinationFor(userId: string, createdAt?: string | null): Promise<string> {
    // A recovery link exists to reach the reset form. Putting onboarding in
    // front of it interrupts a repair with a survey, and the session behind it
    // is a recovery session, so anyone who wanders off inside onboarding can
    // lose the reset entirely. `next` is the load-bearing signal because the
    // recovery template comes back as a PKCE code with next=/auth/reset and
    // carries no type; otpType covers a token_hash recovery link as well.
    if (otpType === 'recovery' || next === '/auth/reset' || next.startsWith('/auth/reset?')) {
      return `${origin}${next}`;
    }
    const { data: profile } = await supabase
      .from('profiles')
      .select('education_level, nationality, date_of_birth')
      .eq('id', userId)
      .maybeSingle();
    // Two separate reasons to send someone to onboarding. education_level is
    // the original "has not onboarded" signal. nationality/date_of_birth are
    // required at sign-up, but a Google account made from /auth/signin (or one
    // whose sign-up answers could not be written), and every account created
    // before they were required, can be missing them while having onboarded
    // long ago. Those users get the
    // basics screen, which is the only unskippable thing in onboarding, and
    // then land on the questionnaire they can skip as usual.
    const needsOnboarding = !profile || profile.education_level == null;
    const needsBasics = !!profile && (!profile.nationality || !profile.date_of_birth);
    if (viaModal) {
      // No row yet (the signup trigger has not committed) is treated as
      // missing basics too: the modal's finish step re-reads and closes itself
      // if it turns out complete. A brand-new account (under a day old) with
      // no education level gets the questionnaire in the same pop-up, the
      // modal's stand-in for /auth/onboarding.
      const created = createdAt ? Date.parse(createdAt) : NaN;
      const isNew = Number.isFinite(created) && Date.now() - created < 24 * 60 * 60 * 1000;
      if (!profile || needsBasics || (isNew && needsOnboarding)) return `${origin}${withAuthFinish(next)}`;
      return `${origin}${next}`;
    }
    if (needsOnboarding || needsBasics) {
      if (next === '/auth/onboarding') return `${origin}/auth/onboarding`;
      return `${origin}/auth/onboarding?next=${encodeURIComponent(next)}`;
    }
    return `${origin}${next}`;
  }

  /**
   * Nationality and date of birth asked on /auth/signup BEFORE "Sign up with
   * Google", parked in a short-lived cookie (src/lib/pendingBasics.ts). This
   * route is the first thing that runs after Google, so it writes them here,
   * before destinationFor decides whether the basics screen is still needed.
   * Only for an account created after the answers were given, only into EMPTY
   * columns (each update is conditional on the column being null), and the
   * cookie is cleared whatever happens, so it is used at most once.
   */
  async function applyPendingBasics(user: User): Promise<void> {
    const raw = cookieStore.get(PENDING_BASICS_COOKIE)?.value;
    if (!raw) return;
    try {
      const basics = pendingBasicsFor(raw, user.created_at);
      if (basics) {
        const a = await supabase
          .from('profiles')
          .update({ nationality: basics.nationality })
          .eq('id', user.id)
          .is('nationality', null);
        const b = await supabase
          .from('profiles')
          .update({ date_of_birth: basics.dateOfBirth })
          .eq('id', user.id)
          .is('date_of_birth', null);
        // supabase-js resolves on a failed write. Keep the cookie then, so
        // /auth/onboarding can try again from it.
        if (a.error || b.error) return;
      }
    } catch {
      // Never break a sign-in over this. destinationFor re-reads the row, so a
      // write that did not land still routes to the basics screen, and
      // /auth/onboarding retries from the same cookie.
      return;
    }
    cookieStore.set(PENDING_BASICS_COOKIE, '', { path: '/', maxAge: 0 });
  }

  /** Every signed-in exit of this route goes through here. */
  async function land(user: User): Promise<string> {
    await applyPendingBasics(user);
    return destinationFor(user.id, user.created_at);
  }

  // ── Email links (signup confirmation, magic link, recovery, email change) ──
  // token_hash links are stateless: unlike PKCE they carry no browser-bound
  // verifier, so they work when the recipient opens the email on their phone
  // after signing up on a laptop. Handled before code because a link never
  // carries both.
  if (tokenHash && otpType) {
    const { data, error } = await supabase.auth.verifyOtp({
      type: otpType,
      token_hash: tokenHash,
    });
    if (!error && data.user) {
      return NextResponse.redirect(await land(data.user));
    }

    // Same reasoning as the code branch below: this route gets hit twice for a
    // single confirmation more often than you would think (mail scanner
    // prefetch, a duplicated navigation, two Vercel instances racing). The
    // first hit consumes the one-time token and mints the session; the second
    // finds it gone. Ask whether we already have a session before showing an
    // error, because an error screen shown to an authenticated user sends them
    // backwards.
    const { data: existing } = await supabase.auth.getUser();
    if (existing.user) {
      await logFailure('otp', {
        errorText: error?.message ?? null,
        shownReason: 'recovered',
        hadSession: true,
      });
      return NextResponse.redirect(await land(existing.user));
    }

    const msg = (error?.message || '').toLowerCase();
    const reason = msg.includes('expire') ? 'expired' : 'invalid';
    await logFailure('otp', { errorText: error?.message ?? null, shownReason: reason });
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${reason}&next=${encodeURIComponent(next)}`,
    );
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      return NextResponse.redirect(await land(data.user));
    }

    // The exchange failed — but that does NOT mean sign-in failed.
    //
    // This route gets hit twice for a single sign-in more often than you'd
    // think (browser/proxy retry, a duplicated navigation, two Vercel
    // instances racing). The first hit consumes the one-time code and mints
    // the session; the second hit finds the flow state already gone and
    // fails with flow_state_not_found. A second OAuth start overwriting the
    // code_verifier cookie produces the same shape via bad_code_verifier.
    // In both cases the visitor is, or is about to be, properly signed in —
    // showing them "this link isn't valid" is a lie that dead-ends them.
    //
    // So: before blaming the link, ask whether we already have a session.
    const { data: existing } = await supabase.auth.getUser();
    if (existing.user) {
      await logFailure('exchange', {
        errorText: error?.message ?? null,
        shownReason: 'recovered',
        hadSession: true,
      });
      return NextResponse.redirect(await land(existing.user));
    }

    const msg = (error?.message || '').toLowerCase();
    const reason = msg.includes('expire') ? 'expired' : 'invalid';
    await logFailure('exchange', { errorText: error?.message ?? null, shownReason: reason });
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${reason}&next=${encodeURIComponent(next)}`,
    );
  }

  // No code and no error param — nothing to exchange.
  await logFailure('missing', { shownReason: 'missing' });
  return NextResponse.redirect(`${origin}/auth/error?reason=missing&next=${encodeURIComponent(next)}`);
}
