import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Only allow relative paths to prevent open-redirect via ?next=. */
function safeNext(raw: string | null): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) return raw;
  return '/';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
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

  if (code) {
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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // Exchange failed — the code was expired, already used, or malformed.
    const msg = (error.message || '').toLowerCase();
    const reason = msg.includes('expire') ? 'expired' : 'invalid';
    return NextResponse.redirect(
      `${origin}/auth/error?reason=${reason}&next=${encodeURIComponent(next)}`,
    );
  }

  // No code and no error param — nothing to exchange.
  return NextResponse.redirect(`${origin}/auth/error?reason=missing&next=${encodeURIComponent(next)}`);
}
