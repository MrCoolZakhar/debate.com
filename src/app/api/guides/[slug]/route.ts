// The paywalled body of a premium guide.
//
// GET /api/guides/<slug> with `Authorization: Bearer <access token>`.
//   401  no token, or a token the database refuses (expired, forged)
//   403  a real account that may not read it (reason 'locked'): not on
//        Unlimited and has not bought this guide for 1 credit
//   404  no such guide
//   200  { blocks } : every section after the public teaser
//
// The decision is the database's: guide_access(slug) is asked WITH the
// caller's own JWT (SECURITY DEFINER, reads auth.uid()) and answers
// { signed_in, unlimited, unlocked, can_read }: Unlimited OR a permanent
// 1-credit unlock (unlock_guide) opens the guide. The client's own read of
// guide_access only decides whether to call this route; it never unlocks
// anything by itself.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabase';
import { getGuide } from '@/lib/premiumGuides';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'private, no-store', Vary: 'Authorization' };
const TOKEN = /^Bearer ([\w.-]{20,4096})$/;

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404, headers: NO_STORE });

  const m = TOKEN.exec(req.headers.get('authorization') ?? '');
  if (!m) return NextResponse.json({ ok: false, reason: 'signin' }, { status: 401, headers: NO_STORE });

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${m[1]}` } },
  });

  const { data, error } = await client.rpc('guide_access', { p_slug: slug });
  if (error) return NextResponse.json({ ok: false, reason: 'signin' }, { status: 401, headers: NO_STORE });
  const access = (data ?? {}) as { signed_in?: boolean; can_read?: boolean };
  if (access.signed_in !== true) return NextResponse.json({ ok: false, reason: 'signin' }, { status: 401, headers: NO_STORE });
  if (access.can_read !== true) {
    return NextResponse.json({ ok: false, reason: 'locked' }, { status: 403, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, blocks: guide.premium }, { headers: NO_STORE });
}
