// The paywalled body of a premium guide.
//
// GET /api/guides/<slug> with `Authorization: Bearer <access token>`.
//   401  no token, or a token the database refuses (expired, forged)
//   403  a real account that is not on Unlimited right now
//   404  no such guide
//   200  { blocks } : every section after the public teaser
//
// The decision is the database's: my_unlimited_status() is asked WITH the
// caller's own JWT (SECURITY DEFINER, reads auth.uid()), exactly as the
// client's useUnlimitedStatus() asks it. The client's answer only decides
// whether to call this route; it never unlocks anything by itself.

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

  const { data, error } = await client.rpc('my_unlimited_status');
  if (error) return NextResponse.json({ ok: false, reason: 'signin' }, { status: 401, headers: NO_STORE });
  const status = (data as { status?: string } | null)?.status;
  if (status !== 'trial' && status !== 'monthly' && status !== 'annual') {
    return NextResponse.json({ ok: false, reason: 'unlimited' }, { status: 403, headers: NO_STORE });
  }

  return NextResponse.json({ ok: true, blocks: guide.premium }, { headers: NO_STORE });
}
