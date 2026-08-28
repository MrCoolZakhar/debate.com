import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';

// This route reads request cookies and must never be cached or prerendered.
export const dynamic = 'force-dynamic';

/** Only allow relative paths to prevent open-redirect via ?next=. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const otpType = searchParams.get('type') as EmailOtpType | null;
  const next = safeNext(searchParams.get('next'));

  // Supabase can redirect straight to the callback with an error (e.g. an
  // expired or already-consumed link) instead of a usable code. Forward the
  // reason to the explanation screen rather than silently bouncing.
  const providerError = searchParams.get('error');
  const providerErrorCode = searchParams.get('error_code');
  if (providerError) {
    const reason = providerErrorCode === 'otp_expired' || providerError === 'access_denied'
      ? 'expired'
      : 'invalid';
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${reason}&next=${encodeURIComponent(next)}`,
    );
  }

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
  async function destinationFor(userId: string): Promise<string> {
    const { data: profile } = await supabase
      .from('profiles')
      .select('education_level')
      .eq('id', userId)
      .maybeSingle();
    if (!profile || profile.education_level == null) {
      if (next === '/auth/onboarding') return `${origin}/auth/onboarding`;
      return `${origin}/auth/onboarding?next=${encodeURIComponent(next)}`;
    }
    return `${origin}${next}`;
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
      return NextResponse.redirect(await destinationFor(data.user.id));
    }
    const msg = (error?.message || '').toLowerCase();
    const reason = msg.includes('expire') ? 'expired' : 'invalid';
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${reason}&next=${encodeURIComponent(next)}`,
    );
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      return NextResponse.redirect(await destinationFor(data.user.id));
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
      return NextResponse.redirect(await destinationFor(existing.user.id));
    }

    const msg = (error?.message || '').toLowerCase();
    const reason = msg.includes('expire') ? 'expired' : 'invalid';
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${reason}&next=${encodeURIComponent(next)}`,
    );
  }

  // No code and no error param — nothing to exchange.
  return NextResponse.redirect(`${origin}/auth/error?reason=missing&next=${encodeURIComponent(next)}`);
}
